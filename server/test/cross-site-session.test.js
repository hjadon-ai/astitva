const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

test('Production bearer session opens Family when cross-site cookies are unavailable', async (t) => {
  Object.assign(process.env, {
    ASTITVA_ENV: 'production',
    MONGODB_URL: 'mongodb+srv://astitva-user:password@astitva0.example.mongodb.net/astitva_prod',
    WEB_URL: 'https://astitva-example.web.app', CORS_ORIGINS: 'https://astitva-example.web.app',
    SESSION_COOKIE_NAME: 'astitva_prod_session', PLAID_ENABLED: 'false', PLAID_ENV: 'production',
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-password', EMAIL_FROM: 'Astitva <noreply@example.com>'
  });
  const { resetRuntimeConfigForTests } = require('../src/config/runtime');
  resetRuntimeConfigForTests();
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const { Family } = require('../src/models/Family');
  const InvitedEmail = require('../src/models/InvitedEmail');
  const userId = '507f1f77bcf86cd799439011';
  const user = { id: userId, _id: userId, name: 'Mobile User', email: 'mobile@example.com',
    emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash('password123', 4) };
  const sessions = new Map();
  let enabledFeatures = { family: true, chat: false };
  t.mock.method(InvitedEmail, 'findOne', async () => enabledFeatures);
  t.mock.method(User, 'findOne', async ({ email }) => email === user.email ? user : null);
  t.mock.method(Session, 'create', async (entry) => { sessions.set(entry.tokenHash, entry); return entry; });
  t.mock.method(Session, 'findOne', ({ tokenHash }) => ({ populate: async () =>
    sessions.has(tokenHash) ? { userId: user } : null }));
  t.mock.method(Session, 'deleteOne', async ({ tokenHash }) => { sessions.delete(tokenHash); });
  t.mock.method(Family, 'find', async () => [{
    _id: userId, creatorId: userId,
    people: [{ _id: userId, userId, name: user.name, email: user.email,
      gender: 'neutral', role: 'ADMIN', status: 'ACCEPTED' }], relations: [], shares: []
  }]);
  t.mock.method(require('../src/services/notificationSettings'), 'notificationSettings', async () => ({ webEnabled: false, expectedVersion: null }));
  const { createApp } = require('../src/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = process.env.WEB_URL;
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json'
  }, body: JSON.stringify({ email: user.email, password: 'password123' }) });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  const { sessionToken } = await login.json();
  assert.match(sessionToken, /^[a-f0-9]{64}$/);
  const account = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${sessionToken}` } });
  assert.deepEqual((await account.json()).user.features,
    { priorities: false, diet: false, finance: false, family: true, chat: false });
  assert.equal((await fetch(`${base}/api/family`, { headers: { Origin: origin } })).status, 401);
  const family = await fetch(`${base}/api/family`, { headers: {
    Origin: origin, Authorization: `Bearer ${sessionToken}`
  } });
  assert.equal(family.status, 200);
  assert.equal((await family.json()).families[0].self.name, user.name);
  const deniedChat = await fetch(`${base}/api/chat/conversations`, { headers: {
    Origin: origin, Authorization: `Bearer ${sessionToken}`
  } });
  assert.equal(deniedChat.status, 403);
  assert.equal((await deniedChat.json()).code, 'FEATURE_NOT_ENABLED');
  for (const path of ['/api/diet/days/2026-10-02', '/api/priorities/days/2026-10-02']) {
    const denied = await fetch(`${base}${path}`, { headers: {
      Origin: origin, Authorization: `Bearer ${sessionToken}`
    } });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, 'FEATURE_NOT_ENABLED');
  }
  enabledFeatures = { family: false, chat: false };
  assert.equal((await fetch(`${base}/api/family`, { headers: {
    Origin: origin, Authorization: `Bearer ${sessionToken}`
  } })).status, 403, 'changing the invite record takes effect without re-login');
  enabledFeatures = { family: true, chat: false };
  const preflight = await fetch(`${base}/api/family`, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization'
  } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);
  assert.equal((await fetch(`${base}/api/auth/me`, { headers: {
    Authorization: `Bearer ${sessionToken}`
  } })).status, 200);
  assert.equal((await fetch(`${base}/api/family`, { headers: {
    Authorization: `Bearer ${crypto.randomBytes(32).toString('hex')}`
  } })).status, 401);
  assert.equal((await fetch(`${base}/api/family`, { headers: {
    Cookie: login.headers.get('set-cookie').split(';')[0], Authorization: 'Bearer invalid'
  } })).status, 401, 'an invalid bearer token cannot fall back to a different cookie session');
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: {
    Origin: origin, Authorization: `Bearer ${sessionToken}`
  } });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(`${base}/api/family`, { headers: {
    Authorization: `Bearer ${sessionToken}`
  } })).status, 401);
  for (const client of ['ios', 'postman']) {
    const nativeLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: {
      'X-Astitva-Client': client, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ email: user.email, password: 'password123' }) });
    assert.equal(nativeLogin.status, 200);
    assert.equal(nativeLogin.headers.get('set-cookie'), null);
    const nativeToken = (await nativeLogin.json()).sessionToken;
    assert.match(nativeToken, /^[a-f0-9]{64}$/);
    const nativeHeaders = { 'X-Astitva-Client': client, Authorization: `Bearer ${nativeToken}` };
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: nativeHeaders })).status, 200);
    assert.equal((await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { 'X-Astitva-Client': client, Authorization: `Bearer ${'b'.repeat(64)}` }
    })).status, 204);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: nativeHeaders })).status, 200,
      'a different token must not invalidate the native session');
    assert.equal((await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: nativeHeaders })).status, 204);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers: nativeHeaders })).status, 401);
  }

});
