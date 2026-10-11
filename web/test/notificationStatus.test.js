import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationStatus } from '../src/notificationStatus.js';
test('notification readiness distinguishes permission, configuration and actual registration', () => {
  const ready = { allowed: true, wanted: true, permission: 'granted', secure: true, supported: true, configured: true, registered: true };
  assert.equal(notificationStatus(ready).title, 'Background push ready');
  for (const [override, title] of [
    [{ allowed: false }, 'Disabled by administrator'],
    [{ permission: 'denied' }, 'Blocked by browser'],
    [{ permission: 'default' }, 'Notifications off'],
    [{ wanted: false }, 'Notifications off'],
    [{ secure: false }, 'Browser notifications unavailable'],
    [{ supported: false }, 'Browser notifications unavailable'],
    [{ configured: false }, 'Open-chat alerts only'],
    [{ registered: false }, 'Background push not connected']
  ]) assert.equal(notificationStatus({ ...ready, ...override }).title, title);
});
