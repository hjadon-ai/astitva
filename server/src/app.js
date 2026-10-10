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
  app.use(cookieParser());
  const mcpManagement = require('./routes/mcp').installMcp(app, runtime);
  app.use(unsafeOriginGuard(runtime));
  app.use((req,res,next)=>{if((req.get('X-Astitva-Member')||req.get('X-Astitva-Family'))&&!/^\/api\/(diet|priorities)(?:\/|$)/.test(req.path))return res.status(403).json({error:'This operation is unavailable in a managed workspace.'});next();});
  // Priorities authenticates before parsing JSON and handles malformed bodies locally.
  app.use('/api/priorities', require('./routes/priorities'));
  app.use('/api/diet/libraries', express.json({limit:'1mb'}));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/mcp', mcpManagement);

  app.get('/api/health', (request, response) => {
    response.status(200).json({
      status: 'ok',
      version,
      commit: process.env.RENDER_GIT_COMMIT || null,
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
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/diet', require('./routes/diet'));
  app.use('/api/finance', require('./routes/finance'));
  app.use('/api/family', require('./routes/family'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/chat', require('./routes/chat'));

  app.use('/api', (request, response) => response.status(404).json({ error: 'API endpoint not found. Check that the web and server versions match.' }));

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
