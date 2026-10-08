import { firebaseApp } from './firebaseClient';
import { getAuth, inMemoryPersistence, setPersistence, signInWithCustomToken, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, getDocs, getFirestore, limit, onSnapshot,
  orderBy, query, startAfter } from 'firebase/firestore';

const app = firebaseApp;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const oldestDocuments = new Map();

function publicMessage(entry) {
  const value = entry.data();
  return { id: entry.id, alias: value.senderAlias, self: value.senderUid === auth.currentUser?.uid,
    text: value.text, createdAt: value.createdAt?.toDate?.() || new Date() };
}

if (db && import.meta.env.VITE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export async function openFirestoreChat(customToken, chatId, onMessages, onError) {
  if (!auth || !db) throw new Error('Firebase web configuration is missing.');
  await setPersistence(auth, inMemoryPersistence);
  await signInWithCustomToken(auth, customToken);
  const messages = collection(db, 'chats', chatId, 'messages');
  const latest = query(messages, orderBy('createdAt', 'desc'), limit(50));
  const unsubscribe = onSnapshot(latest, (snapshot) => {
    oldestDocuments.set(chatId, snapshot.docs.at(-1) || null);
    onMessages(snapshot.docs.map(publicMessage).reverse());
  }, onError);
  return unsubscribe;
}

export async function loadOlderFirestoreMessages(chatId) {
  if (!auth?.currentUser || !db) throw new Error('Unlock this conversation first.');
  const cursor = oldestDocuments.get(chatId);
  if (!cursor) return [];
  const older = await getDocs(query(collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'), startAfter(cursor), limit(50)));
  oldestDocuments.set(chatId, older.docs.at(-1) || null);
  return older.docs.map(publicMessage).reverse();
}

export async function closeFirestoreChat() {
  oldestDocuments.clear();
  if (auth?.currentUser) await signOut(auth);
}
