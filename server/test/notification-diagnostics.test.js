const test = require('node:test');
const assert = require('node:assert/strict');
const { logSubmissionFailure } = require('../src/services/chatNotifications');
test('push diagnostics log known codes without provider messages, tokens or arbitrary values', (t) => {
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  logSubmissionFailure({ code: 'messaging/third-party-auth-error', message: 'secret-device-token' }, 'web');
  logSubmissionFailure({ code: 'secret-device-token', message: 'private-message' }, 'private-id');
  assert.deepEqual(logs, [
    ['Chat notification submission failed.', { code: 'messaging/third-party-auth-error', platform: 'web' }],
    ['Chat notification submission failed.', { code: 'unclassified', platform: 'unknown' }]
  ]);
});
