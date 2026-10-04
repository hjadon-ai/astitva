const crypto = require('node:crypto');
const Session = require('../models/Session');
const { getRuntimeConfig } = require('../config/runtime');
const { sessionToken } = require('./sessionToken');

function isAdmin(user) {
  const emails = getRuntimeConfig().adminEmails;
  return Boolean(user.emailVerifiedAt && emails.includes(user.email?.trim().toLowerCase()));
}

async function requireAdmin(request, response, next) {
  response.setHeader('Cache-Control', 'no-store');
  const token = sessionToken(request);
  if (!token) return response.status(401).json({ error: 'Session is invalid or expired.' });
  const session = await Session.findOne({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  }).populate('userId');
  if (!session?.userId) return response.status(401).json({ error: 'Session is invalid or expired.' });
  if (!session.userId.emailVerifiedAt) return response.status(403).json({ error: 'Email verification required.' });
  if (!isAdmin(session.userId)) return response.status(403).json({
    error: 'You do not have permission to access the Admin Panel.', code: 'ADMIN_ACCESS_REQUIRED'
  });
  request.adminUser = session.userId;
  next();
}

module.exports = { isAdmin, requireAdmin };
