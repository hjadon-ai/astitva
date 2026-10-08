import test from 'node:test';
import assert from 'node:assert/strict';
import { privateNotification, notificationTarget, createMessageAlerts } from '../src/privateNotification.js';
const chatId = 'a'.repeat(24);
test('private alerts ignore injected content and cannot navigate to an external URL', () => {
  const alert = privateNotification({ type: 'anonymous_chat_message', conversationId: chatId,
    text: 'secret', title: 'Secret alias', url: 'https://evil.example', notificationId: 'b'.repeat(64) });
  assert.equal(alert.title, 'Daily Check'); assert.equal(alert.options.body, 'You have a new chat message.');
  assert.ok(!JSON.stringify(alert).includes('secret')); assert.equal(alert.id, 'b'.repeat(64));
  assert.equal(notificationTarget({ conversationId: chatId, url: 'https://evil.example' }, 'https://example.com'), `https://example.com/?chat=${chatId}#chat`);
  assert.equal(privateNotification({ type: 'other', conversationId: chatId }), null);
  assert.equal(privateNotification({ type: 'anonymous_chat_message', conversationId: '../admin' }), null);
});
test('listener alerts exclude initial history, sender messages and repeated snapshots', () => {
  const alerts = []; const receive = createMessageAlerts((payload) => alerts.push(payload));
  receive(chatId, [{ id: 'old', self: false }]);
  receive(chatId, [{ id: 'old', self: false }, { id: 'new', self: false }, { id: 'mine', self: true }]);
  receive(chatId, [{ id: 'new', self: false }, { id: 'mine', self: true }]);
  assert.equal(alerts.length, 1); assert.equal(alerts[0].notificationId, 'new');
});
