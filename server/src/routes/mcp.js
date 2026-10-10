const express = require('express');
const { mcpAuthRouter, createOAuthMetadata } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createDietMcp } = require('../services/dietMcp');
const { Authorization, Grant } = require('../models/Mcp');
const A = require('../services/mcpAuth');
function installMcp(app, runtime) {
  const resource = runtime.mcpPublicUrl;
  const management = express.Router();
  management.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  management.use(A.sessionUser);
  management.get('/connections', async (req, res) => {
    const grants = await Grant.find({ userId: req.mcpUser._id, revokedAt: null, ...A.live() }).sort({ createdAt: -1 }).limit(101).lean();
    res.json({ enabled: Boolean(resource), endpoint: resource || null, hasMore: grants.length > 100, connections: grants.slice(0, 100).map(g => ({ id: String(g._id), clientName: g.clientName, scope: g.scope, createdAt: g.createdAt, expiresAt: g.expiresAt })) });
  });
  management.delete('/connections/:id', async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Connection not found.' });
    const grant = await Grant.findOneAndUpdate({ _id: req.params.id, userId: req.mcpUser._id }, { $set: { revokedAt: new Date() } });
    if (!grant) return res.status(404).json({ error: 'Connection not found.' });
    res.status(204).end();
  });
  const consentRequest = async ticket => /^[a-f0-9]{64}$/i.test(ticket) ? Authorization.findOne({ requestHash: A.hash(ticket), codeHash: null, ...A.live() }).lean() : null;
  management.get('/consent/:ticket', async (req, res) => {
    const row = resource && await consentRequest(req.params.ticket);
    if (!row) return res.status(404).json({ error: 'Connection request expired or unavailable. Restart login from your assistant.' });
    res.json({ clientName: row.clientName, redirectUri: row.redirectUri, account: req.mcpUser.email, scope: A.scope });
  });
  management.post('/consent/:ticket', async (req, res) => {
    if (!resource || !req.body || typeof req.body.allow !== 'boolean' || Object.keys(req.body).some(key => key !== 'allow')) return res.status(400).json({ error: 'Choose Allow or Deny.' });
    const row = await consentRequest(req.params.ticket);
    if (!row) return res.status(404).json({ error: 'Connection request expired or already used.' });
    const code = A.random();
    const filter = { _id: row._id, codeHash: null, ...A.live() };
    const updated = req.body.allow ? await Authorization.findOneAndUpdate(filter, { $set: { userId: req.mcpUser._id, codeHash: A.hash(code), expiresAt: A.future(60) } }) : await Authorization.findOneAndDelete(filter);
    if (!updated) return res.status(409).json({ error: 'Connection request already used.' });
    const callback = new URL(row.redirectUri);
    if (row.state !== undefined) callback.searchParams.set('state', row.state);
    callback.searchParams.set(req.body.allow ? 'code' : 'error', req.body.allow ? code : 'access_denied');
    res.json({ redirectUrl: callback.href });
  });
  // Normal application origin/session protections apply to this router.
  if (!resource) return management;
  const provider = A.createProvider(runtime), origin = new URL(resource).origin;
  const protocol = express.Router();
  protocol.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if ((req.get('Cookie') && !(req.method === 'GET' && req.path === '/authorize')) || req.get('X-Astitva-Member') || req.get('X-Astitva-Family') || req.get('X-Astitva-Workspace')) return res.status(403).json({ error: 'Cookie-free own-workspace protocol access required.' });
    if (req.get('Origin') && !new Set([...runtime.corsOrigins, origin]).has(req.get('Origin'))) return res.status(403).json({ error: 'Origin not allowed.' });
    next();
  });
  protocol.use(express.json({ limit: '16kb' }), express.urlencoded({ extended: false, limit: '16kb' }));
  protocol.get('/.well-known/oauth-authorization-server', (req, res) => res.json({
    ...createOAuthMetadata({ provider, issuerUrl: new URL(origin), scopesSupported: [A.scope] }),
    token_endpoint_auth_methods_supported: ['none'], revocation_endpoint_auth_methods_supported: ['none']
  }));
  protocol.use(mcpAuthRouter({ provider, issuerUrl: new URL(origin), resourceServerUrl: new URL(resource), scopesSupported: [A.scope], resourceName: 'Astitva Diet (read-only)' }));
  protocol.all('/mcp', async (req, res) => {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(req.get('Authorization') || '');
    let auth;
    try { if (match) auth = await provider.verifyAccessToken(match[1]); }
    catch (error) { if (error.status === 403) return res.status(403).json({ error: error.message }); if (error.constructor.name !== 'InvalidTokenError') throw error; }
    if (!auth) { res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${A.scope}"`); return res.status(401).json({ error: 'MCP authorization required.' }); }
    // Stateless transport exposes only POST request/response; no resumable SSE sessions.
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST for stateless MCP requests.' }); }
    if (Array.isArray(req.body)) return res.status(400).json({ error: 'MCP batches are not supported.' });
    if (req.body?.method === 'tools/call') {
      const limit = await A.consumeToolLimit(auth.extra.userId);
      if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'RATE_LIMITED', retryAfter: limit.retryAfter }); }
    }
    const server = createDietMcp(auth.extra.userId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  // Installed before the application's origin guard; only these exact protocol paths bypass it.
  app.use((req, res, next) => /^\/(?:mcp\/?|authorize\/?|token\/?|register\/?|revoke\/?|\.well-known\/oauth-(?:authorization-server|protected-resource)(?:\/mcp)?\/?$)$/.test(req.path) ? protocol(req, res, next) : next());
  return management;
}
module.exports = { installMcp };
