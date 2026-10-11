const NotificationDevice = require('../models/NotificationDevice');
const Session = require('../models/Session');
const User = require('../models/User');
const { ChatConversation } = require('../models/Chat');
const InvitedEmail = require('../models/InvitedEmail');
const { notificationSettings } = require('./notificationSettings');
const { firebaseMessaging } = require('./firebaseAdmin');

const inactiveSince = () => new Date(Date.now() - 2 * 86400000);
const permanentCodes = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

async function eligibleDevices(conversationId, senderId) {
  const conversation = await ChatConversation.findById(conversationId).lean();
  if (!conversation || !conversation.participants.some((p) => String(p.userId) === String(senderId))) return [];
  const recipientIds = conversation.participants.filter((p) => String(p.userId) !== String(senderId)).map((p) => p.userId);
  // One aggregate joins sessions, verification and access instead of per-device
  // or per-recipient queries. The TTL monitor is eventual, so filter inactivity too.
  const webEnabled = (await notificationSettings()).webEnabled;
  return NotificationDevice.aggregate([
    { $match: { userId: { $in: recipientIds }, platform: { $in: webEnabled ? ['ios', 'web'] : ['ios'] }, updatedAt: { $gt: inactiveSince() } } },
    { $lookup: { from: Session.collection.name, let: { session: '$sessionId', owner: '$userId' },
      pipeline: [{ $match: { $expr: { $and: [
        { $eq: ['$_id', '$$session'] }, { $eq: ['$userId', '$$owner'] }, { $gt: ['$expiresAt', new Date()] }
      ] } } }], as: 'session' } },
    { $match: { 'session.0': { $exists: true } } },
    { $lookup: { from: User.collection.name, localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.emailVerifiedAt': { $ne: null } } },
    { $lookup: { from: InvitedEmail.collection.name, localField: 'user.email', foreignField: 'email', as: 'access' } },
    { $match: { 'access.chat': true } },
    { $project: { _id: 1, userId: 1, sessionId: 1, revision: 1, token: 1, platform: 1 } }
  ]);
}

const safeCodes = new Set([
  'messaging/registration-token-not-registered', 'messaging/invalid-registration-token',
  'messaging/third-party-auth-error', 'messaging/authentication-error',
  'messaging/mismatched-credential', 'messaging/invalid-argument',
  'messaging/server-unavailable', 'messaging/internal-error',
  'messaging/quota-exceeded', 'messaging/unknown-error', 'app/invalid-credential'
]);
function logSubmissionFailure(error, platform = 'unknown') {
  console.warn('Chat notification submission failed.', {
    code: safeCodes.has(error?.code) ? error.code : 'unclassified',
    platform: ['web', 'ios'].includes(platform) ? platform : 'unknown'
  });
}

async function submitChatNotification(conversationId, senderId, messageId) {
  // Errors deliberately stay generic: provider errors can include device tokens.
  try {
    const devices = (await eligibleDevices(conversationId, senderId)).sort((a, b) => a.platform.localeCompare(b.platform));
    if (!devices.length) return 'not_requested';
    const messaging = firebaseMessaging();
    if (!messaging) { logSubmissionFailure(null); return 'failed'; }
    let failed = false;
    let submitted = false;
    for (let offset = 0; offset < devices.length; offset += 500) {
      const candidates = devices.slice(offset, offset + 500).filter((d) => d.platform === devices[offset].platform);
      // Keep platform-specific payloads separate, even across the 500-token boundary.
      offset -= 500 - candidates.length;
      // Recheck ownership/session revisions immediately before dispatch. Most
      // conversations have a handful of devices, so this adds one bounded query.
      const current = await NotificationDevice.aggregate([
        { $match: { $or: candidates.map((d) => ({ _id: d._id, userId: d.userId,
          sessionId: d.sessionId, revision: d.revision })), updatedAt: { $gt: inactiveSince() } } },
        { $lookup: { from: Session.collection.name, let: { session: '$sessionId', owner: '$userId' },
          pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$_id', '$$session'] },
            { $eq: ['$userId', '$$owner'] }, { $gt: ['$expiresAt', new Date()] }] } } }], as: 'session' } },
        { $match: { 'session.0': { $exists: true } } }, { $project: { _id: 1 } }
      ]);
      const currentIds = new Set(current.map((d) => String(d._id)));
      const batch = candidates.filter((d) => currentIds.has(String(d._id)));
      if (!batch.length) continue;
      if (batch[0].platform === 'web' && !(await notificationSettings()).webEnabled) continue;
      const payload = { tokens: batch.map((d) => d.token),
        data: { type: 'anonymous_chat_message', conversationId: String(conversationId) } };
      if (batch[0].platform === 'web') {
        // Data-only avoids Firebase's automatic background notification alongside
        // our private service-worker display. The stable ID deduplicates listeners.
        payload.data.notificationId = messageId;
        payload.webpush = { headers: { TTL: '300', Urgency: 'normal' } };
      } else {
        payload.notification = { title: 'Daily Check', body: 'You have a new chat message.' };
        payload.apns = { headers: { 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 300) },
          payload: { aps: { sound: 'default' } } };
      }
      submitted = true;
      const result = await messaging.sendEachForMulticast(payload);
      if (!Array.isArray(result.responses) || result.responses.length !== batch.length) { logSubmissionFailure(null, batch[0].platform); return 'failed'; }
      for (let i = 0; i < result.responses.length; i++) {
        const outcome = result.responses[i];
        if (outcome.success) continue;
        failed = true;
        logSubmissionFailure(outcome.error, batch[i].platform);
        if (permanentCodes.has(outcome.error?.code)) {
          const device = batch[i];
          await NotificationDevice.deleteOne({ _id: device._id, userId: device.userId,
            sessionId: device.sessionId, revision: device.revision });
        }
      }
    }
    return failed ? 'failed' : submitted ? 'submitted' : 'not_requested';
  } catch (error) {
    logSubmissionFailure(error);
    return 'failed';
  }
}
module.exports = { submitChatNotification, logSubmissionFailure };
