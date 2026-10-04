const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isNativeRequest(request) {
  return request.get('Origin') === undefined && request.get('Cookie') === undefined &&
    ['ios', 'postman'].includes(request.get('X-Astitva-Client'));
}

function securityHeaders(runtime) {
  return (request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (runtime.isProduction) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

function unsafeOriginGuard(runtime) {
  const allowedOrigins = new Set(runtime.corsOrigins);
  return (request, response, next) => {
    if (!runtime.isProduction || !unsafeMethods.has(request.method)) return next();
    const origin = request.get('Origin');
    // This marker selects native transport; route handlers still authenticate
    // credentials/tokens. Never permit cookie-based or unapproved-origin writes.
    const nativeRequest = isNativeRequest(request);
    const bearerRequest = /^Bearer [a-f0-9]{64}$/i.test(request.get('Authorization') || '') &&
      (!request.path?.startsWith('/api/auth/') || request.path === '/api/auth/logout');
    const nativeLogin = request.method === 'POST' && request.path === '/api/auth/login' &&
      request.get('Authorization') === undefined &&
      /^application\/json(?:\s*;|$)/i.test(request.get('Content-Type') || '');
    if (nativeRequest && (bearerRequest || nativeLogin)) return next();
    if (!origin || !allowedOrigins.has(origin)) {
      return response.status(403).json({
        error: 'This request origin is not allowed.',
        code: 'ORIGIN_NOT_ALLOWED'
      });
    }
    next();
  };
}

function createRateLimit({ max, windowMs }) {
  const attempts = new Map();
  return (request, response, next) => {
    if (!request.app.locals.runtime.isProduction) return next();
    const now = Date.now();
    const key = request.ip;
    const current = attempts.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    entry.count += 1;
    attempts.set(key, entry);

    response.setHeader('RateLimit-Limit', String(max));
    response.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    response.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > max) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return response.status(429).json({
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED'
      });
    }
    next();
  };
}

module.exports = { createRateLimit, isNativeRequest, securityHeaders, unsafeOriginGuard };
