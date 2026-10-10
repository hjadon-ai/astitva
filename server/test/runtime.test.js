const assert = require('node:assert/strict');
const test = require('node:test');
const { validateRuntimeEnvironment } = require('../src/config/runtime');

const base = {
  PLAID_CLIENT_ID: 'client-id',
  PLAID_SECRET: 'secret-value',
  FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32)
};

const productionBase = {
  ASTITVA_ENV: 'production',
  MONGODB_URL: 'mongodb+srv://astitva-user:password@astitva0.example.mongodb.net/astitva_prod?retryWrites=true&w=majority',
  WEB_URL: 'https://astitva-example.web.app',
  CORS_ORIGINS: 'https://astitva-example.web.app',
  SESSION_COOKIE_NAME: 'astitva_prod_session',
  PLAID_ENABLED: 'false',
  PLAID_ENV: 'production',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
  EMAIL_FROM: 'Astitva <noreply@example.com>'
};

test('Dev selects Sandbox, the dev database, and its own cookie', () => {
  const config = validateRuntimeEnvironment({
    ...base,
    ASTITVA_ENV: 'dev',
    PLAID_ENV: 'sandbox',
    MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva'
  });
  assert.equal(config.plaidBaseUrl, 'https://sandbox.plaid.com');
  assert.equal(config.databaseName, 'astitva');
  assert.equal(config.sessionCookieName, 'astitva_dev_session');
});

test('Stage selects Production, the stage database, and its own cookie', () => {
  const config = validateRuntimeEnvironment({
    ...base,
    ASTITVA_ENV: 'stage',
    PLAID_ENV: 'production',
    MONGODB_URL: 'mongodb://localhost:27017/astitva_stage'
  });
  assert.equal(config.plaidBaseUrl, 'https://production.plaid.com');
  assert.equal(config.databaseName, 'astitva_stage');
  assert.equal(config.sessionCookieName, 'astitva_stage_session');
});

test('Dev can use authenticated Gmail SMTP for account emails', () => {
  const config = validateRuntimeEnvironment({
    ...base,
    ASTITVA_ENV: 'dev',
    PLAID_ENV: 'sandbox',
    MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'sender@gmail.com',
    SMTP_PASSWORD: 'app-password',
    EMAIL_FROM: 'Astitva <sender@gmail.com>'
  });
  assert.deepEqual(config.smtp, {
    host: 'smtp.gmail.com', port: 465, secure: true,
    user: 'sender@gmail.com', password: 'app-password',
    from: 'Astitva <sender@gmail.com>'
  });
});

test('Dev rejects incomplete or insecure Gmail SMTP settings', () => {
  const local = {
    ...base, ASTITVA_ENV: 'dev', PLAID_ENV: 'sandbox',
    MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva',
    SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '465', SMTP_SECURE: 'true',
    SMTP_USER: 'sender@gmail.com'
  };
  assert.throws(() => validateRuntimeEnvironment(local), /SMTP_USER and SMTP_PASSWORD/);
  assert.throws(() => validateRuntimeEnvironment({
    ...local, SMTP_PASSWORD: 'app-password', SMTP_SECURE: 'false'
  }), /Gmail SMTP/);
});

test('runtime validation rejects crossed profiles and remote MongoDB', () => {
  assert.throws(() => validateRuntimeEnvironment({
    ...base, ASTITVA_ENV: 'stage', PLAID_ENV: 'sandbox', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage'
  }), /Plaid production/);
  assert.throws(() => validateRuntimeEnvironment({
    ...base, ASTITVA_ENV: 'stage', PLAID_ENV: 'production', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva'
  }), /astitva_stage/);
  assert.throws(() => validateRuntimeEnvironment({
    ...base, ASTITVA_ENV: 'dev', PLAID_ENV: 'sandbox', MONGODB_URL: 'mongodb://mongo.example.com:27017/astitva'
  }), /localhost/);
});

test('runtime validation rejects placeholder credentials and invalid keys', () => {
  assert.throws(() => validateRuntimeEnvironment({
    ...base, ASTITVA_ENV: 'stage', PLAID_ENV: 'production', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage', PLAID_SECRET: 'your-production-secret'
  }), /PLAID_SECRET/);
  assert.throws(() => validateRuntimeEnvironment({
    ...base, ASTITVA_ENV: 'dev', PLAID_ENV: 'sandbox', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva', FINANCE_TOKEN_ENCRYPTION_KEY: 'short'
  }), /32 bytes/);
});

test('Production accepts Atlas and disables Plaid without requiring Plaid secrets', () => {
  const config = validateRuntimeEnvironment(productionBase);
  assert.equal(config.databaseName, 'astitva_prod');
  assert.equal(config.financeEnabled, false);
  assert.equal(config.financeProviderConfigured, false);
  assert.deepEqual(config.sessionCookieOptions, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/'
  });
});

test('Production can use Gmail API without blocked SMTP ports', () => {
  const config = validateRuntimeEnvironment({
    ...productionBase,
    EMAIL_PROVIDER: 'gmail-api',
    SMTP_HOST: '', SMTP_PORT: '', SMTP_SECURE: '', SMTP_USER: '', SMTP_PASSWORD: '',
    GMAIL_CLIENT_ID: 'gmail-client-id',
    GMAIL_CLIENT_SECRET: 'gmail-client-secret',
    GMAIL_REFRESH_TOKEN: 'gmail-refresh-token'
  });
  assert.equal(config.emailProvider, 'gmail-api');
  assert.deepEqual(config.gmailApi, {
    clientId: 'gmail-client-id', clientSecret: 'gmail-client-secret', refreshToken: 'gmail-refresh-token'
  });
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase, EMAIL_PROVIDER: 'gmail-api'
  }), /GMAIL_CLIENT_ID/);
});

test('Production rejects local data, insecure origins, and reused cookies', () => {
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_prod'
  }), /MongoDB Atlas/);
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    WEB_URL: 'http://astitva-example.web.app'
  }), /HTTPS origin/);
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    SESSION_COOKIE_NAME: 'astitva_dev_session'
  }), /unique production cookie/);
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    WEB_URL: 'https://PROJECT_ID.web.app',
    CORS_ORIGINS: 'https://PROJECT_ID.web.app'
  }), /HTTPS origin/);
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    MONGODB_URL: 'mongodb+srv://APP_USER:APP_PASSWORD@CLUSTER.mongodb.net/astitva_prod'
  }), /placeholders/);
});

test('Production requires Plaid credentials, encryption, and redirect configuration only when enabled', () => {
  assert.throws(() => validateRuntimeEnvironment({
    ...productionBase,
    PLAID_ENABLED: 'true'
  }), /PLAID_CLIENT_ID/);

  const config = validateRuntimeEnvironment({
    ...productionBase,
    ...base,
    PLAID_ENV: 'production',
    PLAID_ENABLED: 'true',
    PLAID_REDIRECT_URI: 'https://astitva-example.web.app'
  });
  assert.equal(config.financeEnabled, true);
  assert.equal(config.financeProviderConfigured, true);
  assert.equal(config.plaidRedirectUri, 'https://astitva-example.web.app');
});

test('Admin email is normalized, private, optional, and validated', () => {
  const config = { ...base, ASTITVA_ENV: 'stage', PLAID_ENV: 'production',
    MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage' };
  assert.deepEqual(validateRuntimeEnvironment(config).adminEmails, []);
  assert.deepEqual(validateRuntimeEnvironment({ ...config, ADMIN_EMAILS: ' Admin@Example.com , other@example.com,admin@example.com ' }).adminEmails, ['admin@example.com', 'other@example.com']);
  for (const email of ['broken', 'a b@example.com', 'a@b', 'a'.repeat(255) + '@example.com']) {
    assert.throws(() => validateRuntimeEnvironment({ ...config, ADMIN_EMAILS: email }), /ADMIN_EMAILS/);
  }
});

test('MCP is opt-in and rejects unsafe public resource configuration', () => {
  assert.equal(validateRuntimeEnvironment(productionBase).mcpPublicUrl, '');
  assert.equal(validateRuntimeEnvironment({...productionBase,MCP_PUBLIC_URL:'https://api.example.test/mcp'}).mcpPublicUrl,'https://api.example.test/mcp');
  for (const url of ['http://api.example.test/mcp','https://user:pass@api.example.test/mcp','https://api.example.test/mcp?token=x','https://api.example.test/other']) assert.throws(()=>validateRuntimeEnvironment({...productionBase,MCP_PUBLIC_URL:url}),/MCP_PUBLIC_URL/);
});
