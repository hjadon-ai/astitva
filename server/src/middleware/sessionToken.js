const { getRuntimeConfig } = require('../config/runtime');

const tokenPattern = /^[a-f0-9]{64}$/i;

function sessionToken(request) {
  const authorization = request.get('Authorization');
  if (authorization !== undefined) {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    return match ? match[1] : null;
  }
  const cookie = request.cookies?.[getRuntimeConfig().sessionCookieName];
  return typeof cookie === 'string' && tokenPattern.test(cookie) ? cookie : null;
}

module.exports = { sessionToken };
