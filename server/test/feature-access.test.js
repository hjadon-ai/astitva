const test = require('node:test');
const assert = require('node:assert/strict');

test('invite flags default to Family only and explicit false revokes access', async (t) => {
  const InvitedEmail = require('../src/models/InvitedEmail');
  const { featuresForEmail } = require('../src/middleware/featureAccess');
  let record = null;
  t.mock.method(InvitedEmail, 'findOne', async ({ email }) => {
    assert.equal(email, 'sample@example.invalid');
    return record;
  });
  const defaults = { priorities: false, diet: false, finance: false, family: true, chat: false, mcp: false };
  assert.deepEqual(await featuresForEmail('SAMPLE@example.invalid'), defaults);
  record = { email: 'sample@example.invalid' };
  assert.deepEqual(await featuresForEmail('sample@example.invalid'), defaults);
  record = { email: 'sample@example.invalid', family: false, chat: true };
  assert.deepEqual(await featuresForEmail('sample@example.invalid'), { ...defaults, family: false, chat: true });
});
