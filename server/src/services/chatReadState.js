const { FieldPath } = require('firebase-admin/firestore');

function comparePosition(a, b) {
  return a.createdAt.seconds - b.createdAt.seconds ||
    a.createdAt.nanoseconds - b.createdAt.nanoseconds ||
    (a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0);
}
async function unreadCount(firestore, chatId, userId, otherId) {
  const ref = firestore.doc(`chats/${chatId}`);
  const state = await ref.collection('readStates').doc(String(userId)).get();
  let query = ref.collection('messages').where('senderUid', '==', String(otherId))
    .orderBy('createdAt').orderBy(FieldPath.documentId());
  if (state.exists) query = query.startAfter(state.data().createdAt, state.data().messageId);
  return (await query.count().get()).data().count;
}
async function markRead(firestore, chatId, userId, otherId, messageId, authorize = async () => {}) {
  const ref = firestore.doc(`chats/${chatId}`);
  const stateRef = ref.collection('readStates').doc(String(userId));
  return firestore.runTransaction(async (tx) => {
    const [chat, message, state] = await Promise.all([
      tx.get(ref), tx.get(ref.collection('messages').doc(messageId)), tx.get(stateRef)
    ]);
    await authorize();
    if (!chat.exists || !chat.data().active || !chat.data().participants.includes(String(userId))) return false;
    if (!message.exists || message.data().senderUid !== String(otherId) || !message.data().createdAt) return false;
    const position = { createdAt: message.data().createdAt, messageId };
    if (!state.exists) tx.create(stateRef, position);
    else if (comparePosition(position, state.data()) > 0) tx.update(stateRef, position);
    return true;
  });
}
module.exports = { unreadCount, markRead, comparePosition };
