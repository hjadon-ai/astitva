import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatSender } from '../src/chatSender.js';

test('recoverable failures retain the send ID and draft; partial success does not resend', async () => {
  const requests = []; let fail = true; let ids = 0;
  const sender = createChatSender(async (path, options) => {
    requests.push({ path, options });
    if (fail) throw Object.assign(new Error('Offline'), { status: 503 });
    return { messageSaved: true, notificationStatus: 'failed', warning: 'Message saved; notification could not be submitted.' };
  }, () => `id-${++ids}`);
  const draft = 'my private message';
  await assert.rejects(sender.send('chat', draft, 'unlock'), /Offline/);
  assert.equal(sender.pendingText('chat'), draft, 'retry draft remains available across locked conversation views');
  await assert.rejects(sender.send('chat', 'changed draft', 'unlock'), /original message/);
  fail = false;
  const result = await sender.send('chat', draft, 'unlock');
  assert.equal(result.messageSaved, true); assert.ok(result.warning);
  assert.equal(requests.length, 2); assert.equal(ids, 1); assert.equal(draft, 'my private message');
  assert.equal(requests[0].options.body, requests[1].options.body);
  assert.equal(requests[0].options.headers['X-Chat-Unlock'], 'unlock');
  assert.equal(requests[0].path, '/api/chat/conversations/chat/messages');
  await sender.send('chat', 'next message', 'unlock'); assert.equal(ids, 2);
});

test('in-flight submits are excluded and definitive validation errors release the ID', async () => {
  let finish; let calls = 0; let ids = 0;
  const sender = createChatSender(() => { calls++; return new Promise((resolve) => { finish = resolve; }); }, () => `id-${++ids}`);
  const first = sender.send('chat', 'message', 'unlock');
  assert.equal(sender.isBusy(), true);
  assert.equal(await sender.send('chat', 'message', 'unlock'), null); assert.equal(calls, 1);
  finish({ messageSaved: true }); await first;
  const invalid = createChatSender(async () => { throw Object.assign(new Error('invalid'), { status: 400 }); }, () => `id-${++ids}`);
  await assert.rejects(invalid.send('chat', 'bad', 'unlock'));
  await assert.rejects(invalid.send('chat', 'new', 'unlock')); assert.equal(ids, 3);
});
