import { notificationStatus } from './notificationStatus';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import workerUrl from './notificationWorker.js?worker&url';
import { firebaseApp } from './firebaseClient';

const preferenceKey = 'astitva.webNotifications';
let allowed = false;
let worker; let messaging; let token; let unsubscribe; let lastRefresh = 0;
const statusChanged = () => window.dispatchEvent(new Event('astitva:notification-status'));
export async function browserNotificationStatus() {
  const supported = Boolean('Notification' in window && 'serviceWorker' in navigator) && await isSupported().catch(() => false);
  return notificationStatus({ allowed, wanted: notificationsWanted(), permission: window.Notification?.permission,
    secure: window.isSecureContext, supported, configured: Boolean(firebaseApp && import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim()), registered: Boolean(token) });
}
export const notificationsWanted = () => localStorage.getItem(preferenceKey) === 'enabled';
async function getWorker() {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('Browser notifications require a supported browser and HTTPS or localhost.');
  }
  if (!worker) worker = await navigator.serviceWorker.register(workerUrl, { type: 'module', scope: '/' });
  return worker;
}
async function tellWorker(data) {
  const registration = await getWorker();
  const active = registration.active || await new Promise((resolve, reject) => {
    const installing = registration.installing || registration.waiting;
    if (!installing) return reject(new Error('Notification service is not ready. Try again.'));
    const changed = () => {
      if (installing.state === 'activated') { installing.removeEventListener('statechange', changed); resolve(installing); }
      else if (installing.state === 'redundant') { installing.removeEventListener('statechange', changed); reject(new Error('Notification service could not start.')); }
    };
    installing.addEventListener('statechange', changed); changed();
  });
  const channel = new MessageChannel();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Notification service did not respond.')); }, 5000);
    channel.port1.onmessage = () => { clearTimeout(timeout); channel.port1.close(); resolve(); };
    active.postMessage(data, [channel.port2]);
  });
  return registration;
}
export async function refreshWebNotifications(apiRequest, force = false) {
  if (!allowed || !('Notification' in window) || !notificationsWanted() || Notification.permission !== 'granted') return 'disabled';
  if (!force && Date.now() - lastRefresh < 12 * 3600000) return token ? 'background' : 'open_chat';
  const registration = await tellWorker({ type: 'notification_state', enabled: true });
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
  if (!firebaseApp || !vapidKey || !(await isSupported())) { lastRefresh = Date.now(); statusChanged(); return 'open_chat'; }
  messaging ||= getMessaging(firebaseApp);
  const nextToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  await apiRequest('/api/notifications/devices', { method: 'PUT', body: JSON.stringify({ token: nextToken, platform: 'web' }) });
  token = nextToken;
  unsubscribe?.();
  unsubscribe = onMessage(messaging, (payload) => showWebNotification(payload.data).catch(() => {}));
  lastRefresh = Date.now(); statusChanged();
  return 'background';
}
export async function enableWebNotifications(apiRequest) {
  if (!allowed) throw new Error('Web notifications are disabled by the administrator.');
  // Permission must be requested from the explicit button's user gesture.
  if (!('Notification' in window)) throw new Error('This browser does not support notifications.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser’s site settings to enable alerts.');
  localStorage.setItem(preferenceKey, 'enabled');
  try { return await refreshWebNotifications(apiRequest, true); }
  finally { statusChanged(); }
}
export async function showWebNotification(payload) {
  if (!allowed || !('Notification' in window) || !notificationsWanted() || Notification.permission !== 'granted') return;
  await tellWorker({ type: 'show_private_notification', payload });
}
export async function setWebNotificationsAllowed(value, apiRequest) {
  allowed = value; statusChanged();
  if (!value) await disableWebNotifications(apiRequest, false);
  else return refreshWebNotifications(apiRequest);
}
export async function disableWebNotifications(apiRequest, forget = true) {
  if (forget) localStorage.removeItem(preferenceKey);
  unsubscribe?.(); unsubscribe = null; lastRefresh = 0;
  if ('serviceWorker' in navigator && 'Notification' in window) await tellWorker({ type: 'notification_state', enabled: false }).catch(() => {});
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const notifications = await registration?.getNotifications();
    notifications?.forEach((notification) => notification.close());
  }
  const previous = token; token = null; statusChanged();
  try { if (previous) await apiRequest('/api/notifications/devices', { method: 'DELETE', body: JSON.stringify({ token: previous }) }); }
  finally { if (messaging) await deleteToken(messaging).catch(() => {}); }
}
