import test from 'node:test';
import assert from 'node:assert/strict';
import { chatScrollAction, chatViewportSize, sameChatViewport, syncChatViewport } from '../src/chatScroll.js';
test('opening/unlocking jumps to latest; history and incoming messages preserve a reader’s position', () => {
  const previous = { chatId: 'a', firstId: '2', lastId: '8' };
  assert.equal(chatScrollAction(null, previous, false), 'bottom');
  assert.equal(chatScrollAction(previous, { ...previous, chatId: 'b' }, false), 'bottom');
  assert.equal(chatScrollAction(previous, { ...previous, firstId: '1' }, false), 'preserve');
  assert.equal(chatScrollAction(previous, { ...previous, lastId: '9', self: false }, false), 'notify');
  assert.equal(chatScrollAction(previous, { ...previous, lastId: '9', self: false }, true), 'bottom');
  assert.equal(chatScrollAction(previous, { ...previous, lastId: '9', self: true }, false), 'bottom');
  assert.equal(chatScrollAction(previous, previous, false), 'none');
});

test('banner/composer resize keeps latest fully visible without moving a history reader', () => {
  let top = 500;
  const board = { clientHeight: 500, scrollHeight: 1000, get scrollTop() { return top; }, set scrollTop(value) { top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); } };
  const size = chatViewportSize(board);
  board.clientHeight = 440;
  assert.equal(sameChatViewport(board, size), false, 'resize scroll event is not user navigation');
  const next = syncChatViewport(board, true);
  assert.equal(board.scrollTop, 560, 'latest message stays above composer after banner shrinks viewport');
  assert.equal(sameChatViewport(board, next), true);
  board.scrollTop = 120;
  board.clientHeight = 400;
  syncChatViewport(board, false);
  assert.equal(board.scrollTop, 120, 'resizing preserves a reader in history');
  board.clientHeight = 0;
  syncChatViewport(board, true);
  assert.equal(board.scrollTop, 120, 'hidden mobile thread does not change scroll');
});
