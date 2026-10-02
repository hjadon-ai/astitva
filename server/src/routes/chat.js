const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');
const Session = require('../models/Session');
const User = require('../models/User');
const { ChatInvitation, ChatConversation, ChatDeletion } = require('../models/Chat');
const { getRuntimeConfig } = require('../config/runtime');
const { createRateLimit } = require('../middleware/security');
const { sessionToken } = require('../middleware/sessionToken');
const { requireFeature } = require('../middleware/featureAccess');

const router = express.Router();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const validId = (value) => /^[a-f\d]{24}$/i.test(value || '');
const validToken = (value) => /^[a-f\d]{64}$/i.test(value || '');
const same = (a, b) => String(a) === String(b);
const failure = (response, status, message) => response.status(status).json({ error: message });
const unavailable = (response) => failure(response, 404, 'Invitation is unavailable.');
const missing = (response) => failure(response, 404, 'Conversation not found.');
const validAlias = (value) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 40;
const validPin = (value) => typeof value === 'string' && /^\d{6}$/.test(value);

router.use(async (request, response, next) => {
  const token = sessionToken(request);
  if (typeof token !== 'string') return failure(response, 401, 'Authentication required.');
  const session = await Session.findOne({ tokenHash: hash(token), expiresAt: { $gt: new Date() } }).populate('userId');
  if (!session?.userId) return failure(response, 401, 'Authentication required.');
  if (!session.userId.emailVerifiedAt) return failure(response, 403, 'Email verification required.');
  request.featureUser = session.userId;
  request.chatUser = session.userId;
  next();
});
router.use(requireFeature('chat'));

const rate = createRateLimit({ max: 40, windowMs: 15 * 60 * 1000 });
const publicConversation = (conversation, userId) => ({
  id: String(conversation._id),
  aliases: conversation.participants.map((p) => ({ alias: p.alias, self: same(p.userId, userId) })),
  pinSet: Boolean(conversation.participants.find((p) => same(p.userId, userId))?.pinHash),
  updatedAt: conversation.updatedAt,
  messageCount: conversation.messages.length
});
async function member(request, response) {
  if (!validId(request.params.id)) { missing(response); return null; }
  const conversation = await ChatConversation.findOne({ _id: request.params.id,
    'participants.userId': request.chatUser._id });
  if (!conversation) { missing(response); return null; }
  return { conversation, participant: conversation.participants.find((p) => same(p.userId, request.chatUser._id)) };
}
function unlocked(request, participant) {
  const token = request.get('X-Chat-Unlock');
  return Boolean(token && validToken(token) && participant.unlockTokenHash === hash(token) &&
    participant.unlockExpiresAt > new Date());
}

router.post('/invitations', rate, async (request, response) => {
  const alias = request.body?.alias;
  if (!validAlias(alias)) return failure(response, 400, 'Choose an alias of 1–40 characters.');
  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await ChatInvitation.create({ creatorId: request.chatUser._id,
    creatorAlias: alias.trim(), tokenHash: hash(token), expiresAt: new Date(Date.now() + 24 * 3600000) });
  response.status(201).json({ id: String(invitation._id), token, expiresAt: invitation.expiresAt });
});

router.get('/invitations', async (request, response) => {
  const invitations = await ChatInvitation.find({ creatorId: request.chatUser._id,
    status: 'pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  response.json({ invitations: invitations.map((entry) => ({ id: String(entry._id), expiresAt: entry.expiresAt })) });
});

async function claim(request, response, status) {
  if (!validToken(request.params.token)) return unavailable(response);
  if (status === 'accepted' && !validAlias(request.body?.alias)) {
    return failure(response, 400, 'Choose an alias of 1–40 characters.');
  }
  const invitation = await ChatInvitation.findOneAndUpdate({ tokenHash: hash(request.params.token),
    creatorId: { $ne: request.chatUser._id }, status: 'pending', expiresAt: { $gt: new Date() } },
  { $set: { status } }, { returnDocument: 'before' });
  if (!invitation) return unavailable(response);
  if (status === 'declined') return response.status(204).end();
  try {
    const conversation = await ChatConversation.create({ invitationId: invitation._id,
      participants: [
        { userId: invitation.creatorId, alias: invitation.creatorAlias || 'Anonymous' },
        { userId: request.chatUser._id, alias: request.body.alias.trim() }
      ] });
    return response.status(201).json({ conversation: publicConversation(conversation, request.chatUser._id) });
  } catch (error) {
    await ChatInvitation.updateOne({ _id: invitation._id, status: 'accepted' }, { $set: { status: 'pending' } });
    throw error;
  }
}
router.post('/invitations/:token/accept', rate, (request, response) => claim(request, response, 'accepted'));
router.post('/invitations/:token/decline', rate, (request, response) => claim(request, response, 'declined'));

router.get('/conversations', async (request, response) => {
  const conversations = await ChatConversation.find({ 'participants.userId': request.chatUser._id })
    .sort({ updatedAt: -1 }).select('-messages.text').lean();
  response.json({ conversations: conversations.map((entry) => publicConversation(entry, request.chatUser._id)) });
});
router.post('/conversations/:id/pin', rate, async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  if (found.participant.pinHash) return failure(response, 409, 'This conversation already has a PIN.');
  if (!validPin(request.body?.pin)) return failure(response, 400, 'Enter a six-digit PIN.');
  const pinHash = await bcrypt.hash(request.body.pin, 12);
  const result = await ChatConversation.updateOne({ _id: found.conversation._id,
    participants: { $elemMatch: { userId: request.chatUser._id, pinHash: { $exists: false } } } },
  { $set: { 'participants.$.pinHash': pinHash } });
  if (!result.modifiedCount) return failure(response, 409, 'This conversation already has a PIN.');
  response.status(204).end();
});
router.post('/conversations/:id/unlock', rate, async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  const { participant, conversation } = found;
  if (!participant.pinHash) return failure(response, 409, 'Set a PIN for this conversation first.');
  if (!validPin(request.body?.pin)) return failure(response, 400, 'Enter a six-digit PIN.');
  const now = Date.now();
  if (participant.lockedUntil && participant.lockedUntil.getTime() > now) {
    return response.status(429).json({ error: 'PIN locked. Try again later.', retryAt: participant.lockedUntil });
  }
  // Conditional updates prevent simultaneous guesses from bypassing the attempt counter.
  if (!await bcrypt.compare(request.body.pin, participant.pinHash)) {
    const failures = participant.failedAttempts + 1;
    const lockouts = participant.lockouts + (failures >= 4 ? 1 : 0);
    const lockedUntil = failures >= 4 ? new Date(now + Math.min(360, 25 * 2 ** Math.min(lockouts - 1, 4)) * 60000) : null;
    const update = await ChatConversation.updateOne({ _id: conversation._id,
      participants: { $elemMatch: { userId: request.chatUser._id,
        failedAttempts: participant.failedAttempts, lockouts: participant.lockouts } } },
    { $set: { 'participants.$.failedAttempts': failures >= 4 ? 0 : failures,
      'participants.$.lockouts': lockouts, 'participants.$.lockedUntil': lockedUntil,
      'participants.$.unlockTokenHash': null, 'participants.$.unlockExpiresAt': null } });
    if (!update.modifiedCount) return failure(response, 409, 'PIN state changed. Try again.');
    return lockedUntil ? response.status(429).json({ error: 'PIN locked. Try again later.', retryAt: lockedUntil })
      : failure(response, 403, 'Incorrect PIN.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(now + 15 * 60000);
  const update = await ChatConversation.updateOne({ _id: conversation._id,
    participants: { $elemMatch: { userId: request.chatUser._id,
      failedAttempts: participant.failedAttempts, lockouts: participant.lockouts,
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }] } } },
  { $set: { 'participants.$.failedAttempts': 0, 'participants.$.lockedUntil': null,
    'participants.$.unlockTokenHash': hash(token), 'participants.$.unlockExpiresAt': expiresAt } });
  if (!update.modifiedCount) return failure(response, 409, 'PIN state changed. Try again.');
  response.json({ token, expiresAt });
});
router.post('/conversations/:id/lock', async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  await ChatConversation.updateOne({ _id: found.conversation._id,
    'participants.userId': request.chatUser._id },
  { $set: { 'participants.$.unlockTokenHash': null, 'participants.$.unlockExpiresAt': null } });
  response.status(204).end();
});
router.patch('/conversations/:id/alias', rate, async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  if (!unlocked(request, found.participant)) return failure(response, 403, 'Unlock this conversation first.');
  if (!validAlias(request.body?.alias)) return failure(response, 400, 'Choose an alias of 1–40 characters.');
  const result = await ChatConversation.updateOne({ _id: found.conversation._id,
    participants: { $elemMatch: { userId: request.chatUser._id,
      unlockTokenHash: hash(request.get('X-Chat-Unlock')), unlockExpiresAt: { $gt: new Date() } } } },
  { $set: { 'participants.$.alias': request.body.alias.trim() } });
  if (!result.modifiedCount) return missing(response);
  response.status(204).end();
});
router.get('/conversations/:id/messages', async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  if (!unlocked(request, found.participant)) return failure(response, 403, 'Unlock this conversation first.');
  response.json({ messages: found.conversation.messages.map((message) => ({ id: String(message._id),
    alias: found.conversation.participants.find((p) => same(p.userId, message.senderId))?.alias || 'Anonymous',
    self: same(message.senderId, request.chatUser._id), text: message.text, createdAt: message.createdAt })) });
});
router.post('/conversations/:id/messages', rate, async (request, response) => {
  const found = await member(request, response);
  if (!found) return;
  if (!unlocked(request, found.participant)) return failure(response, 403, 'Unlock this conversation first.');
  const text = request.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 2000) {
    return failure(response, 400, 'Enter a message of 1–2,000 characters.');
  }
  const message = { _id: crypto.randomBytes(12).toString('hex'), senderId: request.chatUser._id,
    text: text.trim(), createdAt: new Date() };
  const result = await ChatConversation.updateOne({ _id: found.conversation._id,
    'participants.userId': request.chatUser._id,
    'participants.unlockTokenHash': hash(request.get('X-Chat-Unlock')) },
  { $push: { messages: message }, $set: { updatedAt: new Date() } });
  if (!result.modifiedCount) return missing(response);
  response.status(201).json({ message: { id: message._id, text: message.text, self: true,
    alias: found.participant.alias, createdAt: message.createdAt } });
});
async function removeConversations(request, response, all) {
  const query = { 'participants.userId': request.chatUser._id };
  if (!all) {
    if (!validId(request.params.id)) return missing(response);
    query._id = request.params.id;
  }
  const conversations = await ChatConversation.find(query);
  if (!all && !conversations.length) return missing(response);
  // Delete only documents still containing this participant; each document is removed once.
  let deleted = 0;
  for (const conversation of conversations) {
    const removed = await ChatConversation.findOneAndDelete({ _id: conversation._id,
      'participants.userId': request.chatUser._id });
    if (!removed) continue;
    const users = await User.find({ _id: { $in: removed.participants.map((p) => p.userId) } }).select('email').lean();
    await ChatDeletion.create({ emailIds: users.map((user) => user.email).sort(),
      messageCount: removed.messages.length, bytesDeleted: Buffer.byteLength(JSON.stringify(removed.toObject())) });
    deleted++;
  }
  response.json({ deleted });
}
router.delete('/conversations/:id', rate, (request, response) => removeConversations(request, response, false));
router.delete('/conversations', rate, (request, response) => removeConversations(request, response, true));

module.exports = router;
