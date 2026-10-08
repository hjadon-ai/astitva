const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { FakeChatFirestore } = require('./helpers/fakeChatFirestore');

test('F032 durable send claims, exact schema, replay/conflict and notification partial success', async (t) => {
  let notifications = 0;
  let delivery = 'submitted';
  t.mock.method(require('../src/services/chatNotifications'), 'submitChatNotification', async () => {
    notifications++;
    assert.ok(db.writes.some((w) => w.path.includes('/messages/')), 'persist before submit');
    return delivery;
  });
  // Load after installing the mock: the production service imports this function.
  delete require.cache[require.resolve('../src/services/chatMessageSend')];
  const { validateSend, saveChatMessage, ChatSendError } = require('../src/services/chatMessageSend');
  const db = new FakeChatFirestore();
  db.documents.set('chats/chat', { active: true, participants: ['sender', 'recipient'] });
  const input = validateSend({ text: '  private message  ', clientMessageId: crypto.randomUUID() });
  const args = { firestore: db, conversationId: 'chat', senderId: 'sender', input,
    authorize: async () => ({ alias: 'Server alias' }) };
  const results = await Promise.all([saveChatMessage(args), saveChatMessage(args)]);
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal(notifications, 1);
  assert.equal(db.writes.filter((w) => w.path.includes('/messages/')).length, 1);
  const message = db.documents.get(`chats/chat/messages/${results[0].result.messageId}`);
  assert.deepEqual(Object.keys(message).sort(), ['createdAt', 'senderAlias', 'senderUid', 'text']);
  assert.equal(message.senderUid, 'sender'); assert.equal(message.senderAlias, 'Server alias');
  assert.equal(message.text, 'private message'); assert.ok(message.createdAt);
  const replay = await saveChatMessage(args);
  assert.equal(replay.result.notificationStatus, 'submitted'); assert.equal(notifications, 1);
  await assert.rejects(saveChatMessage({ ...args, input: { ...input, text: 'different' } }), (e) => e.status === 409);
  delivery = 'failed';
  const failureArgs = { ...args, input: { ...input, clientMessageId: crypto.randomUUID() } };
  const partial = await saveChatMessage(failureArgs);
  assert.equal(partial.result.messageSaved, true); assert.equal(partial.result.notificationStatus, 'failed');
  assert.ok(partial.result.warning); await saveChatMessage(failureArgs); assert.equal(notifications, 2);
  db.failStatus = true;
  const crashArgs = { ...args, input: { ...input, clientMessageId: crypto.randomUUID() } };
  assert.equal((await saveChatMessage(crashArgs)).result.notificationStatus, 'pending');
  assert.equal((await saveChatMessage(crashArgs)).result.notificationStatus, 'pending');
  assert.equal(notifications, 3, 'ambiguous status never resubmits');
  db.failStatus = false;
  const before = db.writes.length;
  await assert.rejects(saveChatMessage({ ...args, input: { ...input, clientMessageId: crypto.randomUUID() },
    authorize: async () => { throw new ChatSendError(403, 'Locked'); } }), (e) => e.status === 403);
  assert.equal(db.writes.length, before, 'revalidation failure aborts persistence');
  db.documents.set('chats/chat', { active: false, participants: ['sender'] });
  await assert.rejects(saveChatMessage(args), (e) => e.status === 404);
  assert.equal(db.writes.length, before, 'tombstone is never recreated');
  for (const body of [null, [], {}, { text: '', clientMessageId: crypto.randomUUID() },
    { text: 'x'.repeat(2001), clientMessageId: crypto.randomUUID() },
    { text: 'ok', clientMessageId: 'invalid' },
    { text: 'ok', clientMessageId: crypto.randomUUID(), senderUid: 'forged' }]) {
    assert.throws(() => validateSend(body), (e) => e.status === 400);
  }
  assert.equal(validateSend({ text: 'x'.repeat(2000), clientMessageId: crypto.randomUUID() }).text.length, 2000);
});
