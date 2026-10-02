// Explicit opt-in. Uses local Dev MongoDB and removes only this test's fixture records.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('Production signup reads invitedEmails and accepts existing Family links', {
  skip: process.env.ASTITVA_TEST_INVITED_EMAIL !== '1', timeout: 30000
}, async (t) => {
  Object.assign(process.env, {
    ASTITVA_ENV: 'production',
    MONGODB_URL: 'mongodb+srv://astitva-user:password@astitva0.example.mongodb.net/astitva_prod',
    WEB_URL: 'https://astitva-example.web.app', CORS_ORIGINS: 'https://astitva-example.web.app',
    SESSION_COOKIE_NAME: 'astitva_prod_session', PLAID_ENABLED: 'false', PLAID_ENV: 'production',
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'smtp-user', SMTP_PASSWORD: 'smtp-password', EMAIL_FROM: 'Astitva <noreply@example.com>'
  });
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const InvitedEmail = require('../src/models/InvitedEmail');
  const EmailVerificationToken = require('../src/models/EmailVerificationToken');
  const { FamilyInvitation } = require('../src/models/Family');
  t.mock.method(require('../src/services/email'), 'sendVerificationEmail', async () => {});
  const suffix = crypto.randomBytes(8).toString('hex');
  const allowed = `f012-${suffix}@example.invalid`;
  const linked = `f012-link-${suffix}@example.invalid`;
  const denied = `f012-denied-${suffix}@example.invalid`;
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      const users = await User.find({ email: { $in: [allowed, linked] } }).select('_id').lean();
      await Promise.all([
        EmailVerificationToken.deleteMany({ userId: { $in: users.map((user) => user._id) } }),
        FamilyInvitation.deleteMany({ email: linked }),
        InvitedEmail.deleteMany({ email: allowed }),
        User.deleteMany({ email: { $in: [allowed, linked] } })
      ]);
    }
    await mongoose.disconnect();
  });
  await mongoose.connect('mongodb://127.0.0.1:27017/astitva', { serverSelectionTimeoutMS: 2500 });
  await Promise.all([User.createIndexes(), InvitedEmail.createIndexes(), FamilyInvitation.createIndexes()]);
  const { resetRuntimeConfigForTests } = require('../src/config/runtime');
  resetRuntimeConfigForTests();
  server = await new Promise((resolve) => {
    const listener = require('../src/app').createApp().listen(0, '127.0.0.1', () => resolve(listener));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/auth/signup`;
  async function signup(email, familyInviteToken) {
    const response = await fetch(url, { method: 'POST', headers: {
      Origin: process.env.WEB_URL, 'Content-Type': 'application/json'
    }, body: JSON.stringify({ name: 'Fixture', email, password: 'test-password-123', familyInviteToken }) });
    return { status: response.status, body: await response.json() };
  }

  assert.equal((await signup(denied)).body.code, 'INVITATION_REQUIRED');
  await InvitedEmail.create({ email: allowed.toUpperCase() });
  const created = await signup(allowed.toUpperCase());
  assert.equal(created.status, 201);
  assert.equal(created.body.user.email, allowed);
  assert.equal((await signup(allowed)).status, 409, 'an existing account cannot be recreated');

  const token = crypto.randomBytes(32).toString('hex');
  await FamilyInvitation.create({ familyId: new mongoose.Types.ObjectId(), personId: new mongoose.Types.ObjectId(),
    email: linked, tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 3600000) });
  assert.equal((await signup(linked, token)).status, 201, 'an already sent Family link remains usable');
});
