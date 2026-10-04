const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function firebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (!projectId || !encoded) return null;
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 must contain valid Base64-encoded JSON.');
  }
  if (serviceAccount.project_id !== projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase service-account project and credentials do not match FIREBASE_PROJECT_ID.');
  }
  return { projectId, serviceAccount };
}

function firebaseAuth() {
  const config = firebaseConfig();
  if (!config) return null;
  const app = getApps()[0] || initializeApp({ projectId: config.projectId, credential: cert(config.serviceAccount) });
  return getAuth(app);
}

function firebaseFirestore() {
  const config = firebaseConfig();
  if (!config) return null;
  const app = getApps()[0] || initializeApp({ projectId: config.projectId, credential: cert(config.serviceAccount) });
  return getFirestore(app);
}

async function revokeFirebaseGrants({ userId, sessionHash }) {
  const firestore = firebaseFirestore();
  if (!firestore || (!userId && !sessionHash)) return;
  let query = firestore.collectionGroup('grants');
  if (userId) query = query.where('uid', '==', String(userId));
  if (sessionHash) query = query.where('sessionHash', '==', sessionHash);
  const grants = await query.get();
  if (grants.empty) return;
  const batch = firestore.batch();
  grants.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
}

module.exports = { firebaseAuth, firebaseFirestore, revokeFirebaseGrants };
