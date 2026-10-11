const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { FakeChatFirestore } = require('./helpers/fakeChatFirestore');
const { unreadCount, markRead } = require('../src/services/chatReadState');

test('unread state excludes own messages, isolates participants and never skips equal-time newer messages', async () => {
  const db = new FakeChatFirestore();
  db.documents.set('chats/chat', { active: true, participants: ['a', 'b'] });
  for (const [id, senderUid, seconds] of [['01', 'a', 1], ['02', 'b', 2], ['03', 'b', 2], ['04', 'b', 3]]) {
    db.documents.set(`chats/chat/messages/${id}`, { senderUid, createdAt: new Timestamp(seconds, 0) });
  }
  assert.equal(await unreadCount(db, 'chat', 'a', 'b'), 3);
  assert.equal(await unreadCount(db, 'chat', 'b', 'a'), 1);
  assert.equal(await markRead(db, 'chat', 'a', 'b', '02'), true);
  assert.equal(await unreadCount(db, 'chat', 'a', 'b'), 2, 'same timestamp with later ID remains unread');
  assert.equal(await unreadCount(db, 'chat', 'b', 'a'), 1, 'other participant is untouched');
  await Promise.all([markRead(db, 'chat', 'a', 'b', '04'), markRead(db, 'chat', 'a', 'b', '03')]);
  assert.equal(await unreadCount(db, 'chat', 'a', 'b'), 0);
  db.documents.set('chats/chat/messages/05', { senderUid: 'b', createdAt: new Timestamp(4, 0) });
  await markRead(db, 'chat', 'a', 'b', '02');
  assert.equal(await unreadCount(db, 'chat', 'a', 'b'), 1, 'late acknowledgements cannot move cursor backward');
  assert.equal(await markRead(db, 'chat', 'a', 'b', '01'), false, 'cannot acknowledge own message');
  assert.equal(await markRead(db, 'chat', 'stranger', 'b', '05'), false);
  await assert.rejects(markRead(db, 'chat', 'a', 'b', '05', async () => { throw new Error('Locked'); }), /Locked/);
  assert.equal(await unreadCount(db, 'chat', 'a', 'b'), 1, 'revoked unlock does not advance cursor');
  db.documents.set('chats/chat', { active: false, participants: ['a', 'b'] });
  assert.equal(await markRead(db, 'chat', 'a', 'b', '05'), false, 'deleted chat cannot gain a read state');
});
