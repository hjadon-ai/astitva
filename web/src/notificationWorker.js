import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseApp } from './firebaseClient';
import { privateNotification, notificationTarget } from './privateNotification';

const stateCache = 'astitva-notification-state';
const statePath = new URL('/__notification_state', self.location.origin).href;
let work = Promise.resolve();
function serial(task) { work = work.then(task, task); return work; }
async function readState() {
  const cache = await caches.open(stateCache);
  const value = await cache.match(statePath);
  return value ? value.json() : { enabledUntil: 0, seen: [] };
}
async function writeState(value) {
  const cache = await caches.open(stateCache);
  await cache.put(statePath, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }));
}
async function show(data) {
  const notification = privateNotification(data);
  if (!notification) return;
  const state = await readState();
  if (state.enabledUntil <= Date.now() || (notification.id && state.seen.includes(notification.id))) return;
  if (notification.id) {
    state.seen = [...state.seen, notification.id].slice(-100);
    await writeState(state);
  }
  await self.registration.showNotification(notification.title, notification.options);
}
// Install our click handler before Firebase's handlers. Notifications never unlock a chat.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const url = notificationTarget(event.notification.data, self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (current) { await current.navigate(url); await current.focus(); }
    else await self.clients.openWindow(url);
  })());
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  event.waitUntil(serial(async () => {
    if (event.data?.type === 'notification_state') {
      const state = await readState();
      await writeState({ ...state, enabledUntil: event.data.enabled ? Date.now() + 2 * 86400000 : 0 });
    } else if (event.data?.type === 'show_private_notification') await show(event.data.payload);
    event.ports[0]?.postMessage({ ok: true });
  }));
});
if (firebaseApp) onBackgroundMessage(getMessaging(firebaseApp), (payload) => serial(() => show(payload.data)));
