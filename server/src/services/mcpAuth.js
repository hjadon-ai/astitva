const crypto = require('crypto');
const { Client, Authorization, Grant, Bucket } = require('../models/Mcp');
const User = require('../models/User');
const Session = require('../models/Session');
const { sessionToken } = require('../middleware/sessionToken');
const { featuresForEmail } = require('../middleware/featureAccess');
const { AccessDeniedError, InvalidClientMetadataError, InvalidGrantError, InvalidScopeError, InvalidTargetError, InvalidTokenError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const scope = 'diet:read';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const random = () => crypto.randomBytes(32).toString('hex');
const future = seconds => new Date(Date.now() + seconds * 1000);
const live = () => ({ expiresAt: { $gt: new Date() } });
function validRedirect(value) {
  try { const u = new URL(value); return value.length <= 2048 && !u.username && !u.password && !u.hash && (u.protocol === 'https:' || u.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)); } catch { return false; }
}
async function eligibleUser(userId) {
  const user = await User.findById(userId);
  if (!user?.emailVerifiedAt) throw Object.assign(new AccessDeniedError('Verified Diet and MCP access are required.'), { status: 403 });
  const features = await featuresForEmail(user.email);
  if (!features.diet || !features.mcp) throw Object.assign(new AccessDeniedError('Diet and MCP access must be enabled by an administrator.'), { status: 403 });
  return user;
}
async function sessionUser(req, res, next) {
  if (req.get('X-Astitva-Member') || req.get('X-Astitva-Family') || req.get('X-Astitva-Workspace')) return res.status(403).json({ error: 'Use your own workspace.' });
  const token = sessionToken(req);
  const session = token && await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } });
  if (!session) return res.status(401).json({ error: 'Authentication required.' });
  try { req.mcpUser = await eligibleUser(session.userId); next(); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); throw error; }
}
function createProvider(runtime) {
  const resource = runtime.mcpPublicUrl;
  function checkResource(value) { if (value?.href !== resource) throw new InvalidTargetError('Use the advertised MCP resource URL.'); }
  const provider = {
    clientsStore: {
      async getClient(id) { return (await Client.findOne({ clientId: id, ...live() }).lean())?.metadata; },
      async registerClient(input) {
        if (input.token_endpoint_auth_method !== 'none' || !Array.isArray(input.redirect_uris) || input.redirect_uris.length < 1 || input.redirect_uris.length > 5 || input.redirect_uris.some(uri => !validRedirect(uri))) throw new InvalidClientMetadataError('Use a public PKCE client and valid HTTPS or loopback callback URLs.');
        const metadata = { client_id: random(), client_id_issued_at: Math.floor(Date.now() / 1000), client_name: String(input.client_name || 'AI assistant').slice(0, 100), redirect_uris: input.redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope };
        await Client.create({ clientId: metadata.client_id, metadata, expiresAt: future(90 * 86400) });
        return metadata;
      }
    },
    async authorize(client, params, res) {
      checkResource(params.resource);
      if (params.scopes?.some(s => s !== scope)) throw new InvalidScopeError('Only diet:read is supported.');
      if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge) || (params.state?.length || 0) > 2048) throw new InvalidGrantError('Invalid authorization parameters.');
      const ticket = random();
      await Authorization.create({ requestHash: hash(ticket), clientId: client.client_id, clientName: client.client_name, redirectUri: params.redirectUri, state: params.state, challenge: params.codeChallenge, resource, expiresAt: future(600) });
      const url = new URL(runtime.webUrl); url.hash = 'settings?mcp_request=' + ticket;
      res.redirect(url.href);
    },
    async challengeForAuthorizationCode(client, code) {
      const row = await Authorization.findOne({ codeHash: hash(code), clientId: client.client_id, ...live() }).lean();
      if (!row) throw new InvalidGrantError('Authorization code is invalid or expired.');
      return row.challenge;
    },
    async exchangeAuthorizationCode(client, code, verifier, redirectUri, requestedResource) {
      checkResource(requestedResource);
      const row = await Authorization.findOneAndDelete({ codeHash: hash(code), clientId: client.client_id, redirectUri, ...live(), userId: { $ne: null } }).lean();
      if (!row) throw new InvalidGrantError('Authorization code is invalid or expired.');
      await eligibleUser(row.userId);
      const access = random(), refresh = random();
      await Grant.create({ userId: row.userId, clientId: client.client_id, clientName: row.clientName, scope, resource, accessHash: hash(access), refreshHash: hash(refresh), accessExpiresAt: future(3600), expiresAt: future(30 * 86400) });
      return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope };
    },
    async exchangeRefreshToken(client, token, scopes, requestedResource) {
      checkResource(requestedResource);
      if (scopes?.some(s => s !== scope)) throw new InvalidScopeError('Only diet:read is supported.');
      const row = await Grant.findOne({ refreshHash: hash(token), clientId: client.client_id, revokedAt: null, ...live() }).lean();
      if (!row) throw new InvalidGrantError('Refresh token is invalid or expired.');
      await eligibleUser(row.userId);
      const access = random(), refresh = random();
      const updated = await Grant.findOneAndUpdate({ _id: row._id, refreshHash: hash(token), revokedAt: null, ...live() }, { $set: { accessHash: hash(access), refreshHash: hash(refresh), accessExpiresAt: future(3600) } });
      if (!updated) throw new InvalidGrantError('Refresh token was already used or revoked.');
      return { access_token: access, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope };
    },
    async verifyAccessToken(token) {
      const row = await Grant.findOne({ accessHash: hash(token), revokedAt: null, resource, scope, accessExpiresAt: { $gt: new Date() }, ...live() }).lean();
      if (!row) throw new InvalidTokenError('Access token is invalid, expired or revoked.');
      await eligibleUser(row.userId);
      return { token, clientId: row.clientId, scopes: [scope], expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000), resource: new URL(resource), extra: { userId: String(row.userId) } };
    },
    async revokeToken(client, request) {
      await Grant.updateMany({ clientId: client.client_id, $or: [{ accessHash: hash(request.token) }, { refreshHash: hash(request.token) }], revokedAt: null }, { $set: { revokedAt: new Date() } });
    }
  };
  return provider;
}
async function consumeToolLimit(userId) {
  const minute = Math.floor(Date.now() / 60000);
  const key = hash('tools:' + userId + ':' + minute);
  let row;
  try { row = await Bucket.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) } }, { upsert: true, returnDocument: 'after' }); }
  catch (error) { if (error.code !== 11000) throw error; row = await Bucket.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { returnDocument: 'after' }); }
  return { allowed: row.count <= 30, retryAfter: 60 - Math.floor(Date.now() / 1000) % 60 };
}
module.exports = { scope, hash, random, future, live, validRedirect, eligibleUser, sessionUser, createProvider, consumeToolLimit };
