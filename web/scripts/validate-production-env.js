const value = process.env.VITE_API_BASE_URL?.trim();

if (!value) {
  console.error('VITE_API_BASE_URL is required for a Production build.');
  process.exit(1);
}

let url;
try {
  url = new URL(value);
} catch (_) {
  console.error('VITE_API_BASE_URL must be a valid HTTPS origin.');
  process.exit(1);
}

if (url.protocol !== 'https:' || url.origin === 'null' || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash || /service_name/i.test(url.hostname)) {
  console.error('VITE_API_BASE_URL must be an HTTPS origin without a path, query, or fragment.');
  process.exit(1);
}

console.log(`Production API origin: ${url.origin}`);

const firebaseVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];
const missing = firebaseVariables.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Firebase web configuration is missing: ${missing.join(', ')}. Set these GitHub Actions variables before building production.`);
  process.exit(1);
}
if (process.env.VITE_FIRESTORE_EMULATOR === 'true') {
  console.error('VITE_FIRESTORE_EMULATOR must not be enabled for a Production build.');
  process.exit(1);
}
