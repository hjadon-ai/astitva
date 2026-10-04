const assert = require('node:assert/strict');
const test = require('node:test');
const { createRateLimit, unsafeOriginGuard } = require('../src/middleware/security');

function responseRecorder() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('Production unsafe requests require an exact approved origin', () => {
  const guard = unsafeOriginGuard({
    isProduction: true,
    corsOrigins: ['https://astitva-example.web.app']
  });
  const blocked = responseRecorder();
  guard({ method: 'POST', get: () => 'https://malicious.example' }, blocked, () => assert.fail('must block'));
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.body.code, 'ORIGIN_NOT_ALLOWED');

  let allowed = false;
  guard({ method: 'DELETE', get: () => 'https://astitva-example.web.app' }, responseRecorder(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('Production rate limits return a stable response after the allowed count', () => {
  const limit = createRateLimit({ max: 1, windowMs: 60000 });
  const request = { ip: '127.0.0.1', app: { locals: { runtime: { isProduction: true } } } };
  limit(request, responseRecorder(), () => {});
  const blocked = responseRecorder();
  limit(request, blocked, () => assert.fail('must block'));
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
});

test('Native transport permits cookie-free JSON login and bearer writes only', () => {
  const guard = unsafeOriginGuard({ isProduction: true, corsOrigins: ['https://astitva-example.web.app'] });
  const bearer = `Bearer ${'a'.repeat(64)}`;
  const cases = [
    { path: '/api/auth/login', headers: { 'X-Astitva-Client': 'ios', 'Content-Type': 'application/json' }, allowed: true },
    { path: '/api/auth/logout', headers: { 'X-Astitva-Client': 'ios', Authorization: bearer }, allowed: true },
    { path: '/api/auth/signup', headers: { 'X-Astitva-Client': 'ios', 'Content-Type': 'application/json' }, allowed: false },
    { path: '/api/auth/signup', headers: { 'X-Astitva-Client': 'ios', Authorization: bearer }, allowed: false },
    { path: '/api/auth/login', headers: { 'Content-Type': 'application/json' }, allowed: false },
    { path: '/api/auth/login', headers: { 'X-Astitva-Client': 'ios', 'Content-Type': 'text/plain' }, allowed: false },
    { path: '/api/auth/login', headers: { 'X-Astitva-Client': 'ios', 'Content-Type': 'application/json', Cookie: 'session=value' }, allowed: false },
    { path: '/api/auth/logout', headers: { 'X-Astitva-Client': 'ios', Authorization: bearer, Cookie: 'session=value' }, allowed: false },
    { path: '/api/auth/logout', headers: { 'X-Astitva-Client': 'ios', Authorization: 'Bearer invalid' }, allowed: false },
    { path: '/api/auth/logout', headers: { 'X-Astitva-Client': 'ios', Authorization: bearer, Origin: 'https://malicious.example' }, allowed: false },
    { path: '/api/auth/logout', headers: { 'X-Astitva-Client': 'ios', Authorization: bearer, Origin: 'null' }, allowed: false }
  ];
  for (const client of ['ios', 'postman']) {
    for (const original of cases) {
      const item = { ...original, headers: { ...original.headers } };
      if (item.headers['X-Astitva-Client']) item.headers['X-Astitva-Client'] = client;
      let allowed = false;
      const response = responseRecorder();
      guard({ method: 'POST', path: item.path, get: (name) => item.headers[name] }, response, () => { allowed = true; });
      assert.equal(allowed, item.allowed, JSON.stringify(item));
      if (!allowed) assert.equal(response.body.code, 'ORIGIN_NOT_ALLOWED');
    }
  }
});
