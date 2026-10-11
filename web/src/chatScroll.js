export function chatScrollAction(previous, next, nearBottom) {
  if (!previous || previous.chatId !== next.chatId) return 'bottom';
  if (previous.lastId !== next.lastId) return nearBottom || next.self ? 'bottom' : 'notify';
  if (previous.firstId !== next.firstId) return 'preserve';
  return 'none';
}

export function chatViewportSize(board) {
  return { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight };
}
export function sameChatViewport(board, size) {
  return size?.clientHeight === board.clientHeight && size?.scrollHeight === board.scrollHeight;
}
export function syncChatViewport(board, pinned) {
  if (pinned && board.clientHeight > 0) board.scrollTop = board.scrollHeight;
  return chatViewportSize(board);
}
