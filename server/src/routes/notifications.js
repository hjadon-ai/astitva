const crypto = require('node:crypto');
const express = require('express');
const Session = require('../models/Session');
const NotificationDevice = require('../models/NotificationDevice');
const { sessionToken } = require('../middleware/sessionToken');
const { createRateLimit } = require('../middleware/security');

const router = express.Router();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
router.use(async (request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  const token = sessionToken(request);
  if (!token) return response.status(401).json({ error: 'Authentication required.' });
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).populate('userId');
  if (!session?.userId) return response.status(401).json({ error: 'Authentication required.' });
  if (!session.userId.emailVerifiedAt) return response.status(403).json({ error: 'Email verification required.' });
  request.deviceSession = session;
  next();
});
router.use(createRateLimit({ max: 30, windowMs: 60 * 1000 }));

function validBody(body, registration) {
  return body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).every((key) => (registration ? ['token', 'platform'] : ['token']).includes(key)) &&
    typeof body.token === 'string' && body.token.length >= 20 && body.token.length <= 4096 &&
    /^[A-Za-z0-9_.:\-]+$/.test(body.token) && (!registration || ['ios', 'web'].includes(body.platform));
}
router.put('/devices', async (request, response) => {
  if (!validBody(request.body, true)) return response.status(400).json({ error: 'A valid iOS or web registration token is required.' });
  const tokenHash = hash(request.body.token);
  const update = { token: request.body.token, platform: request.body.platform, userId: request.deviceSession.userId._id,
    sessionId: request.deviceSession._id, revision: crypto.randomUUID() };
  try {
    await NotificationDevice.updateOne({ tokenHash }, { $set: update, $setOnInsert: { tokenHash } },
      { upsert: true, runValidators: true });
  } catch (error) {
    // Simultaneous first registrations can race on the unique digest index.
    if (error.code !== 11000) throw new Error('Device registration could not be saved.');
    await NotificationDevice.updateOne({ tokenHash }, { $set: update }, { runValidators: true });
  }
  return response.json({ registered: true });
});
router.delete('/devices', async (request, response) => {
  if (!validBody(request.body, false)) return response.status(400).json({ error: 'A valid registration token is required.' });
  await NotificationDevice.deleteOne({ tokenHash: hash(request.body.token), userId: request.deviceSession.userId._id });
  return response.status(204).end();
});
router.use((error, request, response, next) => {
  response.status(503).json({ error: 'Device registration is temporarily unavailable.' });
});
module.exports = router;
