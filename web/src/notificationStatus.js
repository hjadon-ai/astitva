export function notificationStatus({ allowed, wanted, permission, secure, supported, configured, registered }) {
  if (!allowed) return { title: 'Disabled by administrator', detail: 'An administrator must enable web notifications.' };
  if (!secure || !supported) return { title: 'Browser notifications unavailable', detail: 'Use a supported browser on HTTPS or localhost.' };
  if (permission === 'denied') return { title: 'Blocked by browser', detail: 'Allow notifications in this site’s browser settings, then enable them here.' };
  if (!wanted || permission !== 'granted') return { title: 'Notifications off', detail: 'Enable notifications and allow the browser permission prompt.' };
  if (!configured) return { title: 'Open-chat alerts only', detail: 'Background push is not configured. Alerts require an open, unlocked conversation.' };
  if (!registered) return { title: 'Background push not connected', detail: 'Reconnect notifications to register this browser for background delivery.' };
  return { title: 'Background push ready', detail: 'New-message alerts can arrive while the chat is locked or its tab is closed. Browser and system notification settings still apply.' };
}
