const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { submitChatNotification } = require('./chatNotifications');

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
class ChatSendError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function validateSend(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['text', 'clientMessageId'].includes(key)) ||
      typeof body.text !== 'string' || !body.text.trim() || body.text.trim().length > 2000 ||
      typeof body.clientMessageId !== 'string' ||
      !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.clientMessageId)) {
    throw new ChatSendError(400, 'Text of 1–2,000 characters and a clientMessageId UUID v4 are required.');
  }
  return { text: body.text.trim(), clientMessageId: body.clientMessageId.toLowerCase() };
}
function publicResult(messageId, notificationStatus) {
  const warning = notificationStatus === 'failed' ? 'Message saved; notification could not be submitted.'
    : notificationStatus === 'pending' ? 'Message saved; notification submission is unconfirmed. Do not resend the message.' : null;
  return { messageId, messageSaved: true, notificationStatus, ...(warning ? { warning } : {}) };
}

async function saveChatMessage({ firestore, conversationId, senderId, input, authorize }) {
  const messageId = digest(`${senderId}:${input.clientMessageId}`);
  const contentHash = digest(input.text);
  const chatRef = firestore.doc(`chats/${conversationId}`);
  const messageRef = chatRef.collection('messages').doc(messageId);
  const receiptRef = chatRef.collection('sendRequests').doc(messageId);
  // A single durable transaction claims the dispatch before calling FCM. Only the
  // creator may submit; replays never resubmit an ambiguous/crashed attempt.
  const saved = await firestore.runTransaction(async (transaction) => {
    const [chat, receipt] = await Promise.all([transaction.get(chatRef), transaction.get(receiptRef)]);
    const sender = await authorize();
    if (!chat.exists || !chat.data().active || !chat.data().participants.includes(String(senderId))) {
      throw new ChatSendError(404, 'Conversation not found.');
    }
    if (receipt.exists) {
      if (receipt.data().contentHash !== contentHash) throw new ChatSendError(409, 'This send identifier was already used for different text.');
      return { created: false, notificationStatus: receipt.data().notificationStatus };
    }
    transaction.create(messageRef, { senderUid: String(senderId), senderAlias: sender.alias,
      text: input.text, createdAt: FieldValue.serverTimestamp() });
    transaction.create(receiptRef, { contentHash, notificationStatus: 'pending', createdAt: FieldValue.serverTimestamp() });
    // Touch the parent so a simultaneous tombstone/delete serializes with this send.
    transaction.update(chatRef, { updatedAt: FieldValue.serverTimestamp() });
    return { created: true, notificationStatus: 'pending' };
  });
  if (!saved.created) return { created: false, result: publicResult(messageId, saved.notificationStatus) };
  let notificationStatus;
  try { notificationStatus = await submitChatNotification(conversationId, senderId, messageId); }
  catch { notificationStatus = 'failed'; }
  try {
    // Never recreate a receipt or deleted chat when delivery finishes late.
    await receiptRef.update({ notificationStatus });
  } catch {
    // The message was already committed. A failed status write must never cause
    // clients to repeat delivery; the durable pending claim is replay-safe.
    notificationStatus = 'pending';
  }
  return { created: true, result: publicResult(messageId, notificationStatus) };
}
module.exports = { ChatSendError, validateSend, saveChatMessage };
