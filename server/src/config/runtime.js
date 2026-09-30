const crypto = require('crypto');

const profiles = Object.freeze({
  dev: Object.freeze({
    plaidEnvironment: 'sandbox',
    plaidBaseUrl: 'https://sandbox.plaid.com',
    databaseName: 'astitva',
    sessionCookieName: 'astitva_dev_session'
  }),
  stage: Object.freeze({
    plaidEnvironment: 'production',
    plaidBaseUrl: 'https://production.plaid.com',
    databaseName: 'astitva_stage',
    sessionCookieName: 'astitva_stage_session'
  }),
  production: Object.freeze({
    plaidEnvironment: 'production',
    plaidBaseUrl: 'https://production.plaid.com',
    databaseName: 'astitva_prod'
  })
});

function required(name, environment) {
  const value = environment[name]?.trim();
  if (!value || /^(change|replace|your)[-_ ]/i.test(value)) {
    throw new Error(`${name} must be configured for this environment.`);
  }
  return value;
}

function booleanValue(name, value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function encryptionKeyValid(value) {
  if (/^[a-f0-9]{64}$/i.test(value)) return true;
  try {
    return Buffer.from(value, 'base64').length === 32;
  } catch (_) {
    return false;
  }
}

function mongoDatabase(mongoUrl, localOnly) {
  let parsed;
  try {
    parsed = new URL(mongoUrl);
  } catch (_) {
    throw new Error('MONGODB_URL must be a valid MongoDB URL.');
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (localOnly) {
    if (parsed.protocol !== 'mongodb:' || !localHosts.has(parsed.hostname) || (parsed.port && parsed.port !== '27017')) {
      throw new Error('MONGODB_URL must use MongoDB on localhost port 27017.');
    }
  } else {
    if (parsed.protocol !== 'mongodb+srv:' || localHosts.has(parsed.hostname)) {
      throw new Error('Production MONGODB_URL must use a remote MongoDB Atlas mongodb+srv connection.');
    }
    if (!parsed.username || !parsed.password) {
      throw new Error('Production MONGODB_URL must include Atlas database-user credentials.');
    }
    if (/^(app[_-]?user|app[_-]?password)$/i.test(decodeURIComponent(parsed.username)) ||
        /^(app[_-]?user|app[_-]?password)$/i.test(decodeURIComponent(parsed.password)) ||
        parsed.hostname.toLowerCase().startsWith('cluster.')) {
      throw new Error('Production MONGODB_URL must not contain example placeholders.');
    }
    if (['false', '0'].includes(parsed.searchParams.get('tls')) || ['false', '0'].includes(parsed.searchParams.get('ssl'))) {
      throw new Error('Production MONGODB_URL must not disable TLS.');
    }
  }

  return parsed.pathname.replace(/^\//, '').split('/')[0];
}

function httpsOrigin(name, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (parsed.protocol !== 'https:' || parsed.origin === 'null' || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash || /(project_id|service_name)/i.test(parsed.hostname)) {
    throw new Error(`${name} must be an HTTPS origin without a path, query, or fragment.`);
  }
  return parsed.origin;
}

function commaSeparated(name, environment) {
  return required(name, environment).split(',').map((value) => value.trim()).filter(Boolean);
}

function invitedEmails(environment) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = [...new Set(commaSeparated('INVITED_EMAILS', environment).map((email) => email.toLowerCase()))];
  if (!emails.length || emails.some((email) => !emailPattern.test(email))) {
    throw new Error('INVITED_EMAILS must contain at least one valid email address.');
  }
  return emails;
}

function localSmtpConfig(environment) {
  const host = environment.SMTP_HOST?.trim() || '127.0.0.1';
  const port = Number(environment.SMTP_PORT || 1025);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }
  const secure = environment.SMTP_SECURE === undefined
    ? false
    : booleanValue('SMTP_SECURE', environment.SMTP_SECURE.trim());
  const user = environment.SMTP_USER?.trim() || '';
  const password = environment.SMTP_PASSWORD?.trim() || '';
  if (Boolean(user) !== Boolean(password)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must both be configured for authenticated SMTP.');
  }
  if (host.toLowerCase() === 'smtp.gmail.com' && (!user ||
      !((port === 465 && secure) || (port === 587 && !secure)))) {
    throw new Error('Gmail SMTP requires credentials and TLS on port 465 or 587.');
  }
  return Object.freeze({
    host, port, secure, user, password,
    from: environment.EMAIL_FROM?.trim() || 'Astitva Local <no-reply@astitva.local>'
  });
}

function localConfig(name, profile, environment) {
  const mongoUrl = required('MONGODB_URL', environment);
  if (mongoDatabase(mongoUrl, true) !== profile.databaseName) {
    throw new Error(`${name} must use the ${profile.databaseName} MongoDB database.`);
  }
  if (environment.PLAID_ENV?.trim() !== profile.plaidEnvironment) {
    throw new Error(`${name} must use Plaid ${profile.plaidEnvironment}.`);
  }
  required('PLAID_CLIENT_ID', environment);
  required('PLAID_SECRET', environment);
  const encryptionKey = required('FINANCE_TOKEN_ENCRYPTION_KEY', environment);
  if (!encryptionKeyValid(encryptionKey)) {
    throw new Error('FINANCE_TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes encoded as hex or base64.');
  }

  return {
    environment: name,
    isProduction: false,
    plaidEnvironment: profile.plaidEnvironment,
    plaidBaseUrl: profile.plaidBaseUrl,
    databaseName: profile.databaseName,
    mongoUrl,
    sessionCookieName: profile.sessionCookieName,
    sessionCookieOptions: Object.freeze({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' }),
    financeProvider: 'plaid',
    financeEnabled: true,
    financeProviderConfigured: true,
    plaidRedirectUri: environment.PLAID_REDIRECT_URI?.trim() || '',
    webUrl: (environment.WEB_URL || 'http://localhost:3000').replace(/\/$/, ''),
    corsOrigins: Object.freeze(['http://localhost:3000', 'http://127.0.0.1:3000']),
    invitedEmails: Object.freeze([]),
    emailProvider: 'smtp',
    gmailApi: null,
    smtp: localSmtpConfig(environment)
  };
}

function productionConfig(profile, environment) {
  const mongoUrl = required('MONGODB_URL', environment);
  if (mongoDatabase(mongoUrl, false) !== profile.databaseName) {
    throw new Error(`production must use the ${profile.databaseName} MongoDB database.`);
  }

  const webUrl = httpsOrigin('WEB_URL', required('WEB_URL', environment));
  const corsOrigins = [...new Set(commaSeparated('CORS_ORIGINS', environment)
    .map((origin) => httpsOrigin('CORS_ORIGINS', origin)))];
  if (!corsOrigins.includes(webUrl)) {
    throw new Error('CORS_ORIGINS must include WEB_URL.');
  }

  const sessionCookieName = required('SESSION_COOKIE_NAME', environment);
  if (!/^[A-Za-z0-9_-]+$/.test(sessionCookieName) ||
      Object.values(profiles).some((candidate) => candidate.sessionCookieName === sessionCookieName)) {
    throw new Error('SESSION_COOKIE_NAME must be a unique production cookie name.');
  }

  if (environment.PLAID_ENV?.trim() !== 'production') {
    throw new Error('production must use Plaid production.');
  }
  const financeEnabled = booleanValue('PLAID_ENABLED', environment.PLAID_ENABLED?.trim());
  let financeProviderConfigured = false;
  let plaidRedirectUri = '';
  if (financeEnabled) {
    required('PLAID_CLIENT_ID', environment);
    required('PLAID_SECRET', environment);
    const encryptionKey = required('FINANCE_TOKEN_ENCRYPTION_KEY', environment);
    if (!encryptionKeyValid(encryptionKey)) {
      throw new Error('FINANCE_TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes encoded as hex or base64.');
    }
    plaidRedirectUri = httpsOrigin('PLAID_REDIRECT_URI', required('PLAID_REDIRECT_URI', environment));
    financeProviderConfigured = true;
  }

  const emailProvider = environment.EMAIL_PROVIDER?.trim() || 'smtp';
  if (!['smtp', 'gmail-api'].includes(emailProvider)) {
    throw new Error('EMAIL_PROVIDER must be smtp or gmail-api.');
  }
  const smtpPort = emailProvider === 'smtp' ? Number(required('SMTP_PORT', environment)) : null;
  if (emailProvider === 'smtp' && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  return {
    environment: 'production',
    isProduction: true,
    plaidEnvironment: profile.plaidEnvironment,
    plaidBaseUrl: profile.plaidBaseUrl,
    databaseName: profile.databaseName,
    mongoUrl,
    sessionCookieName,
    sessionCookieOptions: Object.freeze({ httpOnly: true, sameSite: 'none', secure: true, path: '/' }),
    financeProvider: 'plaid',
    financeEnabled,
    financeProviderConfigured,
    plaidRedirectUri,
    webUrl,
    corsOrigins: Object.freeze(corsOrigins),
    invitedEmails: Object.freeze(invitedEmails(environment)),
    emailProvider,
    gmailApi: emailProvider === 'gmail-api' ? Object.freeze({
      clientId: required('GMAIL_CLIENT_ID', environment),
      clientSecret: required('GMAIL_CLIENT_SECRET', environment),
      refreshToken: required('GMAIL_REFRESH_TOKEN', environment)
    }) : null,
    smtp: emailProvider === 'smtp' ? Object.freeze({
      host: required('SMTP_HOST', environment),
      port: smtpPort,
      secure: booleanValue('SMTP_SECURE', required('SMTP_SECURE', environment)),
      user: required('SMTP_USER', environment),
      password: required('SMTP_PASSWORD', environment),
      from: required('EMAIL_FROM', environment)
    }) : Object.freeze({ from: required('EMAIL_FROM', environment) })
  };
}

function validateRuntimeEnvironment(environment = process.env) {
  const name = environment.ASTITVA_ENV?.trim();
  const profile = profiles[name];
  if (!profile) throw new Error('ASTITVA_ENV must be dev, stage, or production.');

  const config = name === 'production'
    ? productionConfig(profile, environment)
    : localConfig(name, profile, environment);

  return Object.freeze({
    ...config,
    instanceId: crypto.createHash('sha256').update(`${name}:${config.mongoUrl}`).digest('hex').slice(0, 12)
  });
}

let runtimeConfig;
function getRuntimeConfig() {
  runtimeConfig ||= validateRuntimeEnvironment();
  return runtimeConfig;
}

function resetRuntimeConfigForTests() {
  runtimeConfig = undefined;
}

module.exports = { getRuntimeConfig, profiles, resetRuntimeConfigForTests, validateRuntimeEnvironment };
