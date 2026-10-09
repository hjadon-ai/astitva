const assert = require('node:assert/strict');
const test = require('node:test');

const productionEnvironment = {
  ASTITVA_ENV: 'production',
  MONGODB_URL: 'mongodb+srv://astitva-user:password@astitva0.example.mongodb.net/astitva_prod?retryWrites=true&w=majority',
  WEB_URL: 'https://astitva-example.web.app',
  CORS_ORIGINS: 'https://astitva-example.web.app',
  SESSION_COOKIE_NAME: 'astitva_prod_session',
  PLAID_ENABLED: 'false',
  PLAID_ENV: 'production',
  RENDER_GIT_COMMIT: '0123456789abcdef0123456789abcdef01234567',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
  EMAIL_FROM: 'Astitva <noreply@example.com>'
};

test('Production health, origin, invitation, and disabled Finance behavior are enforced before database access', async (t) => {
  Object.assign(process.env, productionEnvironment);
  const { resetRuntimeConfigForTests } = require('../src/config/runtime');
  resetRuntimeConfigForTests();
  const { mock } = t;
  const InvitedEmail = require('../src/models/InvitedEmail');
  mock.method(InvitedEmail, 'exists', async () => null);
  const { createApp } = require('../src/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: productionEnvironment.WEB_URL }
    });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-origin'), productionEnvironment.WEB_URL);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(await health.json(), {
      status: 'ok',
      version: require('../package.json').version,
      commit: productionEnvironment.RENDER_GIT_COMMIT,
      message: 'Astitva server is running',
      environment: 'production',
      dataLocation: 'cloud',
      financeProvider: {
        name: 'plaid',
        environment: 'production',
        enabled: false,
        configured: false
      }
    });

    const missingEndpoint = await fetch(`${baseUrl}/api/missing-endpoint`);
    assert.equal(missingEndpoint.status, 404);
    assert.match(missingEndpoint.headers.get('content-type'), /application\/json/);
    assert.match((await missingEndpoint.json()).error, /web and server versions match/);

    const blockedOrigin = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://malicious.example' },
      body: JSON.stringify({ name: 'Blocked', email: 'blocked@example.com', password: 'password123' })
    });
    assert.equal(blockedOrigin.status, 403);
    assert.equal((await blockedOrigin.json()).code, 'ORIGIN_NOT_ALLOWED');

    const blockedInvitation = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: productionEnvironment.WEB_URL },
      body: JSON.stringify({ name: 'Blocked', email: 'blocked@example.com', password: 'password123' })
    });
    assert.equal(blockedInvitation.status, 403);
    assert.equal((await blockedInvitation.json()).code, 'INVITATION_REQUIRED');

    const finance = await fetch(`${baseUrl}/api/finance/summary`);
    assert.equal(finance.status, 503);
    assert.equal((await finance.json()).code, 'FINANCE_DISABLED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
