// Opt-in local MongoDB fixtures; Firebase/FCM are always fake, never live.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { FakeChatFirestore } = require('./helpers/fakeChatFirestore');

test('F032 device ownership, session eligibility, HTTP send authorization and private FCM outcomes', {
  skip: process.env.ASTITVA_TEST_NOTIFICATIONS !== '1', timeout: 30000
}, async (t) => {
  Object.assign(process.env, { ASTITVA_ENV: 'stage', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage',
    PLAID_ENV: 'production', PLAID_CLIENT_ID: 'test-client', PLAID_SECRET: 'test-secret',
    FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32) });
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const InvitedEmail = require('../src/models/InvitedEmail');
  const Device = require('../src/models/NotificationDevice');
  const { ChatConversation } = require('../src/models/Chat');
  const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
  const emails = ids.map((id) => `f032-${id}@example.invalid`);
  const tokens = ids.map(() => crypto.randomBytes(32).toString('hex'));
  const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
  const unlock = crypto.randomBytes(32).toString('hex');
  const firestore = new FakeChatFirestore();
  const submitted = []; let outcome = 'ok'; let beforeOutcome = null;
  let webEnabled = false;
  t.mock.method(require('../src/services/notificationSettings'), 'notificationSettings', async () => ({ webEnabled, expectedVersion: null }));
  const messaging = { async sendEachForMulticast(payload) {
    submitted.push(payload);
    if (beforeOutcome) await beforeOutcome();
    if (outcome === 'throw') throw new Error('Sensitive provider error must not be logged');
    return { responses: payload.tokens.map(() => outcome === 'ok' ? { success: true }
      : { success: false, error: { code: outcome } }) };
  } };
  t.mock.method(require('../src/services/firebaseAdmin'), 'firebaseFirestore', () => firestore);
  t.mock.method(require('../src/services/firebaseAdmin'), 'firebaseMessaging', () => messaging);
  const logs = [];
  t.mock.method(console, 'error', (...values) => logs.push(values));
  let server; let conversation;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) await Promise.all([
      Device.deleteMany({ userId: { $in: ids } }), Session.deleteMany({ userId: { $in: ids } }),
      InvitedEmail.deleteMany({ email: { $in: emails } }), User.deleteMany({ _id: { $in: ids } }),
      ChatConversation.deleteMany({ 'participants.userId': { $in: ids } })
    ]);
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 2500 });
  await Device.createIndexes();
  const sessions = [];
  for (let i = 0; i < ids.length; i++) {
    await User.create({ _id: ids[i], name: 'Fixture', email: emails[i], passwordHash: 'fixture',
      ...(i === 3 ? {} : { emailVerifiedAt: new Date() }) });
    await InvitedEmail.create({ email: emails[i], chat: true });
    sessions.push(await Session.create({ userId: ids[i], tokenHash: hash(tokens[i]), expiresAt: new Date(Date.now() + 3600000) }));
  }
  conversation = await ChatConversation.create({ invitationId: new mongoose.Types.ObjectId(),
    participants: [{ userId: ids[0], alias: 'Sky', unlockTokenHash: hash(unlock), unlockExpiresAt: new Date(Date.now() + 60000) },
      { userId: ids[1], alias: 'River' }] });
  firestore.documents.set(`chats/${conversation.id}`, { active: true, participants: [String(ids[0]), String(ids[1])] });
  require('../src/config/runtime').resetRuntimeConfigForTests();
  server = require('../src/app').createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, method = 'GET', body, account = 0, unlockValue = unlock) {
    const response = await fetch(base + path, { method, headers: {
      ...(account === null ? {} : { Authorization: `Bearer ${tokens[account]}` }),
      'Content-Type': 'application/json', 'X-Astitva-Client': 'ios',
      ...(unlockValue ? { 'X-Chat-Unlock': unlockValue } : {})
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  const path = '/api/notifications/devices';
  const senderToken = `f032-sender-${crypto.randomBytes(30).toString('hex')}`;
  const recipientToken = `f032-recipient-${crypto.randomBytes(30).toString('hex')}`;
  const registration = { token: recipientToken, platform: 'ios' };
  assert.equal((await call(path, 'PUT', registration, null)).status, 401);
  assert.equal((await call(path, 'PUT', registration, 3)).status, 403);
  for (const invalid of [null, [], {}, { ...registration, platform: 'android' }, { ...registration, token: 'short' },
    { ...registration, token: 'x '.repeat(30) }, { ...registration, token: 'x'.repeat(4097) }, { ...registration, userId: ids[1] }]) {
    assert.equal((await call(path, 'PUT', invalid)).status, 400);
  }
  assert.deepEqual((await call(path, 'PUT', registration, 1)).body, { registered: true });
  await call(path, 'PUT', registration, 1);
  assert.equal(await Device.countDocuments({ tokenHash: hash(recipientToken) }), 1);
  assert.equal((await call(path, 'PUT', registration, 2)).status, 200);
  await call(path, 'DELETE', { token: recipientToken }, 1);
  assert.equal(String((await Device.findOne({ tokenHash: hash(recipientToken) })).userId), String(ids[2]));
  await call(path, 'PUT', registration, 1);
  await call(path, 'PUT', { token: senderToken, platform: 'ios' }, 0);
  const secondDeviceToken = `f032-secondary-${crypto.randomBytes(30).toString('hex')}`;
  await call(path, 'PUT', { token: secondDeviceToken, platform: 'ios' }, 1);
  assert.equal(await Device.countDocuments({ userId: ids[1] }), 2, 'multiple devices per account');
  await call(path, 'DELETE', { token: secondDeviceToken }, 1);
  const ttl = (await Device.collection.indexes()).find((i) => i.key.updatedAt);
  assert.equal(ttl.expireAfterSeconds, 2 * 86400);
  assert.equal((await Device.findOne({ tokenHash: hash(recipientToken) }).lean()).token, undefined, 'hidden default token field');
  const sendPath = `/api/chat/conversations/${conversation.id}/messages`;
  const body = () => ({ text: 'private message', clientMessageId: crypto.randomUUID() });
  assert.equal((await call(sendPath, 'POST', body(), null)).status, 401);
  assert.equal((await call(sendPath, 'POST', body(), 3)).status, 403);
  assert.equal((await call(sendPath, 'POST', body(), 2)).status, 404);
  assert.equal((await call(sendPath, 'POST', body(), 0, null)).status, 403);
  assert.equal((await call(sendPath, 'POST', body(), 0, '0'.repeat(64))).status, 403);
  await ChatConversation.updateOne({ _id: conversation._id, 'participants.userId': ids[0] },
    { $set: { 'participants.$.unlockExpiresAt': new Date(Date.now() - 1) } });
  assert.equal((await call(sendPath, 'POST', body())).status, 403);
  await ChatConversation.updateOne({ _id: conversation._id, 'participants.userId': ids[0] },
    { $set: { 'participants.$.unlockExpiresAt': new Date(Date.now() + 60000) } });
  await InvitedEmail.updateOne({ email: emails[0] }, { $set: { chat: false } });
  assert.equal((await call(sendPath, 'POST', body())).status, 403);
  await InvitedEmail.updateOne({ email: emails[0] }, { $set: { chat: true } });
  assert.equal((await call(sendPath, 'POST', { ...body(), senderUid: String(ids[2]) })).status, 400);
  const request = body();
  const saved = await call(sendPath, 'POST', request);
  assert.equal(saved.status, 201); assert.equal(saved.body.messageSaved, true);
  assert.equal(saved.body.notificationStatus, 'submitted');
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].tokens, [recipientToken]);
  assert.deepEqual(submitted[0].notification, { title: 'Daily Check', body: 'You have a new chat message.' });
  assert.deepEqual(submitted[0].data, { type: 'anonymous_chat_message', conversationId: conversation.id });
  assert.ok(!JSON.stringify(saved.body).includes(recipientToken));
  assert.ok(!JSON.stringify(submitted[0]).includes('private message'));
  const stored = firestore.documents.get(`chats/${conversation.id}/messages/${saved.body.messageId}`);
  assert.equal(stored.senderUid, String(ids[0])); assert.equal(stored.senderAlias, 'Sky');
  assert.equal((await call(sendPath, 'POST', request)).status, 200); assert.equal(submitted.length, 1);
  assert.equal((await call(sendPath, 'POST', { ...request, text: 'different' })).status, 409);
  outcome = 'messaging/internal-error';
  const partial = await call(sendPath, 'POST', body());
  assert.equal(partial.status, 201); assert.equal(partial.body.notificationStatus, 'failed');
  assert.ok(await Device.exists({ tokenHash: hash(recipientToken) }));
  outcome = 'throw';
  assert.equal((await call(sendPath, 'POST', body())).body.messageSaved, true);
  outcome = 'messaging/registration-token-not-registered';
  beforeOutcome = async () => { await call(path, 'PUT', registration, 2); };
  await call(sendPath, 'POST', body());
  assert.ok(await Device.exists({ tokenHash: hash(recipientToken), userId: ids[2] }), 'cleanup cannot remove switched token');
  beforeOutcome = null;
  await call(path, 'PUT', registration, 1);
  await call(sendPath, 'POST', body());
  assert.equal(await Device.exists({ tokenHash: hash(recipientToken) }), null);
  assert.ok(await Device.exists({ tokenHash: hash(senderToken) }));
  outcome = 'ok';
  await call(path, 'PUT', registration, 1);
  await Session.updateOne({ _id: sessions[1]._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  const callsBefore = submitted.length;
  assert.equal((await call(sendPath, 'POST', body())).body.notificationStatus, 'not_requested');
  assert.equal(submitted.length, callsBefore, 'expired sessions cannot receive');
  assert.equal((await call(path, 'PUT', registration, 1)).status, 401);
  await Session.updateOne({ _id: sessions[1]._id }, { $set: { expiresAt: new Date(Date.now() + 60000) } });
  // Native driver bypasses Mongoose timestamps only to create an expired fixture.
  await Device.collection.updateOne({ tokenHash: hash(recipientToken) }, { $set: { updatedAt: new Date(Date.now() - 3 * 86400000) } });
  assert.equal((await call(sendPath, 'POST', body())).body.notificationStatus, 'not_requested');
  await call(path, 'PUT', registration, 1);
  await InvitedEmail.updateOne({ email: emails[1] }, { $set: { chat: false } });
  assert.equal((await call(sendPath, 'POST', body())).body.notificationStatus, 'not_requested');
  await call(path, 'DELETE', { token: recipientToken }, 1);
  await call(path, 'DELETE', { token: recipientToken }, 1);
  assert.equal(await Device.exists({ tokenHash: hash(recipientToken) }), null);
  await InvitedEmail.updateOne({ email: emails[1] }, { $set: { chat: true } });
  const webToken = `f032-web-${crypto.randomBytes(30).toString('hex')}`;
  assert.equal((await call(path, 'PUT', { token: webToken, platform: 'web' }, 1)).status, 200);
  const beforeWeb = submitted.length;
  assert.equal((await call(sendPath, 'POST', body())).body.notificationStatus, 'not_requested');
  assert.equal(submitted.length, beforeWeb, 'global web setting defaults off');
  webEnabled = true;
  const webMessage = await call(sendPath, 'POST', body());
  assert.equal(webMessage.body.notificationStatus, 'submitted');
  const webPayload = submitted.at(-1);
  assert.deepEqual(webPayload.tokens, [webToken]);
  assert.equal(webPayload.notification, undefined, 'data-only web payload prevents duplicate automatic display');
  assert.equal(webPayload.data.notificationId, webMessage.body.messageId);
  assert.equal(webPayload.webpush.headers.TTL, '300');
  webEnabled = false;
  assert.equal((await call(sendPath, 'POST', body())).body.notificationStatus, 'not_requested');
  assert.equal(logs.length, 0, 'provider errors and sensitive tokens are not logged');
});
