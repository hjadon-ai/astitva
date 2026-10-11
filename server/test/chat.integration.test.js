const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('F027 Stage invitation, PIN, isolation and deletion', {
  skip: process.env.ASTITVA_TEST_CHAT !== '1', timeout: 60000
}, async (t) => {
  Object.assign(process.env, { ASTITVA_ENV: 'stage', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage',
    PLAID_ENV: 'production', PLAID_CLIENT_ID: 'local-test', PLAID_SECRET: 'local-test',
    FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32) });
  const { FakeChatFirestore } = require('./helpers/fakeChatFirestore');
  const firestore = new FakeChatFirestore();
  t.mock.method(require('../src/services/firebaseAdmin'), 'firebaseFirestore', () => firestore);
  t.mock.method(require('../src/services/firebaseAdmin'), 'firebaseMessaging', () => null);
  const mongoose = require('mongoose');
  const express = require('express');
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const { ChatInvitation, ChatConversation, ChatDeletion } = require('../src/models/Chat');
  const InvitedEmail = require('../src/models/InvitedEmail');
  const ids = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
  const emails = ids.map((id) => `f027-${id}@example.invalid`);
  const cookies = ids.map(() => crypto.randomBytes(32).toString('hex'));
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      const invitations = await ChatInvitation.find({ creatorId: { $in: ids } }).select('_id').lean();
      await Promise.all([
        ChatConversation.deleteMany({ invitationId: { $in: invitations.map((x) => x._id) } }),
        ChatInvitation.deleteMany({ creatorId: { $in: ids } }),
        ChatDeletion.deleteMany({ emailIds: { $in: emails } }),
        InvitedEmail.deleteMany({ email: { $in: emails } }),
        Session.deleteMany({ userId: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })
      ]);
    }
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 2500 });
  await Promise.all([ChatInvitation.createIndexes(), ChatConversation.createIndexes(), ChatDeletion.createIndexes()]);
  for (let i = 0; i < ids.length; i++) {
    await InvitedEmail.create({ email: emails[i], family: true, chat: true });
    await User.create({ _id: ids[i], name: `F027 ${i}`, email: emails[i],
      passwordHash: 'fixture', emailVerifiedAt: new Date() });
    await Session.create({ userId: ids[i], tokenHash: crypto.createHash('sha256').update(cookies[i]).digest('hex'),
      expiresAt: new Date(Date.now() + 3600000) });
  }
  const app = express();
  app.locals.runtime = require('../src/config/runtime').getRuntimeConfig();
  app.use(require('cookie-parser')()); app.use(express.json());
  app.use('/api/chat', require('../src/routes/chat'));
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/chat`;
  async function req(method, path, body, account = 0, unlock) {
    const response = await fetch(base + path, { method, headers: {
      ...(account === null ? {} : { Cookie: `astitva_stage_session=${cookies[account]}` }),
      ...(unlock ? { 'X-Chat-Unlock': unlock } : {}), 'Content-Type': 'application/json'
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  assert.equal((await req('GET', '/conversations', undefined, null)).status, 401);
  const invite = await req('POST', '/invitations', { alias: 'Sky' });
  assert.equal(invite.status, 201);
  const token = invite.body.token;
  assert.equal((await ChatInvitation.findById(invite.body.id)).tokenHash,
    crypto.createHash('sha256').update(token).digest('hex'));
  assert.equal((await req('POST', `/invitations/${token}/accept`, { alias: 'Sky' })).status, 404);
  const accepted = await req('POST', `/invitations/${token}/accept`, { alias: 'River' }, 1);
  assert.equal(accepted.status, 201);
  const id = accepted.body.conversation.id;
  assert.deepEqual(accepted.body.conversation.aliases.map((a) => a.alias), ['Sky', 'River']);
  assert.equal((await req('POST', `/invitations/${token}/accept`, { alias: 'Other' }, 2)).status, 404);
  const declined = await req('POST', '/invitations', { alias: 'Second' });
  assert.equal((await req('POST', `/invitations/${declined.body.token}/decline`, {}, 2)).status, 204);
  assert.equal((await req('POST', `/invitations/${declined.body.token}/accept`, { alias: 'Late' }, 1)).status, 404);
  const expired = await req('POST', '/invitations', { alias: 'Third' });
  await ChatInvitation.updateOne({ _id: expired.body.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await req('POST', `/invitations/${expired.body.token}/accept`, { alias: 'Late' }, 1)).status, 404);
  assert.equal((await req('GET', '/conversations', undefined, 2)).body.conversations.length, 0);
  assert.equal((await req('GET', `/conversations/${id}/messages`, undefined, 2)).status, 410);
  assert.equal((await req('GET', `/conversations/${id}/messages`, undefined, 0)).status, 410);
  assert.equal((await req('POST', `/conversations/${id}/pin`, { pin: '123456' }, 0)).status, 204);
  assert.equal((await req('POST', `/conversations/${id}/pin`, { pin: '654321' }, 1)).status, 204);
  for (let i = 0; i < 3; i++) assert.equal((await req('POST', `/conversations/${id}/unlock`, { pin: '000000' })).status, 403);
  const locked = await req('POST', `/conversations/${id}/unlock`, { pin: '000000' });
  assert.equal(locked.status, 429);
  assert.ok(new Date(locked.body.retryAt).getTime() > Date.now() + 24 * 60000);
  assert.equal((await req('POST', `/conversations/${id}/unlock`, { pin: '123456' })).status, 429);
  await ChatConversation.updateOne({ _id: id, 'participants.userId': ids[0] },
    { $set: { 'participants.$.lockedUntil': new Date(Date.now() - 1000) } });
  for (let i = 0; i < 4; i++) await req('POST', `/conversations/${id}/unlock`, { pin: '000000' });
  const second = await ChatConversation.findById(id);
  assert.equal(second.participants[0].lockouts, 2);
  assert.ok(second.participants[0].lockedUntil.getTime() > Date.now() + 49 * 60000);
  await ChatConversation.updateOne({ _id: id, 'participants.userId': ids[0] },
    { $set: { 'participants.$.lockedUntil': new Date(Date.now() - 1000),
      'participants.$.lockouts': 5, 'participants.$.failedAttempts': 3 } });
  const capped = await req('POST', `/conversations/${id}/unlock`, { pin: '000000' });
  assert.equal(capped.status, 429);
  assert.ok(new Date(capped.body.retryAt).getTime() <= Date.now() + 361 * 60000);
  assert.ok(new Date(capped.body.retryAt).getTime() >= Date.now() + 359 * 60000);
  await ChatConversation.updateOne({ _id: id, 'participants.userId': ids[0] },
    { $set: { 'participants.$.lockedUntil': new Date(Date.now() - 1000) } });
  const a = await req('POST', `/conversations/${id}/unlock`, { pin: '123456' });
  let b = await req('POST', `/conversations/${id}/unlock`, { pin: '654321' }, 1);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  firestore.documents.set(`chats/${id}`, { active: true, participants: ids.slice(0, 2).map(String) });
  const sent = await req('POST', `/conversations/${id}/messages`, { text: 'Hello', clientMessageId: crypto.randomUUID() }, 0, a.body.token);
  assert.equal(sent.status, 201);
  assert.equal((await firestore.collection(`chats/${id}/messages`).get()).size, 1);
  assert.equal((await req('GET', `/conversations/${id}/messages`, undefined, 1, b.body.token)).status, 410,
    'reads stay direct Firestore');
  assert.equal((await req('GET', '/conversations', undefined, 1)).body.conversations[0].unreadCount, 1);
  assert.equal((await req('GET', '/conversations', undefined, 0)).body.conversations[0].unreadCount, 0);
  assert.equal((await req('GET', '/conversations', undefined, 2)).body.conversations.length, 0);
  assert.equal((await req('POST', `/conversations/${id}/read`, { messageId: sent.body.messageId }, 1)).status, 403);
  assert.equal((await req('POST', `/conversations/${id}/read`, { messageId: sent.body.messageId }, 2, b.body.token)).status, 404);
  assert.equal((await req('POST', `/conversations/${id}/read`, { messageId: sent.body.messageId }, 0, a.body.token)).status, 404);
  assert.equal((await req('POST', `/conversations/${id}/read`, { messageId: sent.body.messageId }, 1, b.body.token)).status, 204);
  assert.equal((await req('GET', '/conversations', undefined, 1)).body.conversations[0].unreadCount, 0);
  assert.equal((await req('POST', `/conversations/${id}/lock`, {}, 2)).status, 404);
  assert.equal((await req('POST', `/conversations/${id}/lock`, {}, 1)).status, 204);
  assert.equal((await req('POST', `/conversations/${id}/messages`, { text: 'Locked', clientMessageId: crypto.randomUUID() }, 1, b.body.token)).status, 403,
    'lock invalidates the previous token');
  assert.equal((await req('POST', `/conversations/${id}/read`, { messageId: sent.body.messageId }, 1, b.body.token)).status, 403);
  assert.equal((await req('POST', `/conversations/${id}/messages`, { text: 'Still open', clientMessageId: crypto.randomUUID() }, 0, a.body.token)).status, 201,
    'locking one participant leaves the other unlocked');
  b = await req('POST', `/conversations/${id}/unlock`, { pin: '654321' }, 1);
  assert.equal(b.status, 200);
  assert.equal((await req('PATCH', `/conversations/${id}/alias`, { alias: 'Ocean' }, 1, b.body.token)).status, 204);
  assert.equal((await req('PATCH', `/conversations/${id}/alias`, { alias: 'Wrong' }, 2, b.body.token)).status, 404);
  assert.equal(firestore.documents.get(`chats/${id}/messages/${sent.body.messageId}`).senderAlias, 'Sky');
  assert.equal((await req('POST', `/conversations/${id}/messages`, { text: 'Third party', clientMessageId: crypto.randomUUID() }, 2, a.body.token)).status, 404);
  assert.equal((await req('DELETE', `/conversations/${id}`, undefined, 1)).status, 200,
    'forgotten PIN does not prevent deleting a conversation');
  assert.equal((await req('GET', '/conversations', undefined, 0)).body.conversations.length, 0);
  const deletion = await ChatDeletion.findOne({ emailIds: emails[0] });
  assert.equal(deletion.messageCount, 2);
  assert.equal((await firestore.collection(`chats/${id}/sendRequests`).get()).size, 0);
  assert.equal(deletion.emailIds.length, 2);
  assert.ok(deletion.bytesDeleted > 0);
});
