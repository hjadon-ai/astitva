const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { getRuntimeConfig } = require('./config/runtime');
const { securityHeaders, unsafeOriginGuard } = require('./middleware/security');
const { version } = require('../package.json');

function createApp() {
  const runtime = getRuntimeConfig();
  const allowedOrigins = new Set(runtime.corsOrigins);
  const app = express();
  app.locals.runtime = runtime;

  if (runtime.isProduction) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders(runtime));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, Boolean(origin && allowedOrigins.has(origin)) ? origin : false);
    }
  }));
  app.use(unsafeOriginGuard(runtime));
  app.use(cookieParser());
  // Priorities authenticates before parsing JSON and handles malformed bodies locally.
  app.use('/api/priorities', require('./routes/priorities'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (request, response) => {
    response.status(200).json({
      status: 'ok',
      version,
      message: 'Astitva server is running',
      environment: runtime.environment,
      dataLocation: runtime.isProduction ? 'cloud' : 'local',
      financeProvider: {
        name: runtime.financeProvider,
        environment: runtime.plaidEnvironment,
        enabled: runtime.financeEnabled,
        configured: runtime.financeProviderConfigured
      }
    });
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/diet', require('./routes/diet'));
  app.use('/api/finance', require('./routes/finance'));

  app.use((error, request, response, next) => {
    if (error.type === 'entity.too.large') {
      return response.status(413).json({ error: 'The request body is too large.' });
    }
    if (error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'The request body must contain valid JSON.' });
    }
    console.error('Unhandled API error:', error.message);
    response.status(500).json({ error: 'The server could not complete this request.' });
  });

  return app;
}

module.exports = { createApp };
