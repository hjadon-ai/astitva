// Opt-in: local Stage only; removes only randomly named fixtures created here.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('F031 admin authorization, search, invitees, atomic edits and Chat revocation', {
  skip: process.env.ASTITVA_TEST_ADMIN !== '1', timeout: 30000
}, async (t) => {
  const suffix = crypto.randomBytes(8).toString('hex');
  const adminEmail = `f031-admin-${suffix}@example.invalid`;
  Object.assign(process.env, {
    ASTITVA_ENV: 'stage', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva_stage',
    PLAID_ENV: 'production', PLAID_CLIENT_ID: 'test-client', PLAID_SECRET: 'test-secret',
    FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32), ADMIN_EMAILS: ` ${adminEmail.toUpperCase()} `
  });
  const mongoose = require('mongoose');
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const InvitedEmail = require('../src/models/InvitedEmail');
  let revoked = [];
  let failRevoke = false;
  t.mock.method(require('../src/services/firebaseAdmin'), 'revokeFirebaseGrants', async ({ userId }) => {
    revoked.push(String(userId));
    if (failRevoke) throw new Error('Fixture revocation failure');
  });
  const sent = [];
  let failEmail = false;
  t.mock.method(require('../src/services/email'), 'sendAdminInvitationEmail', async (email) => {
    if (failEmail) throw new Error('Fixture delivery failure');
    sent.push(email);
  });
  const emails = [adminEmail, `f031-member-${suffix}@example.invalid`, `f031-unverified-${suffix}@example.invalid`,
    `f031-invite-${suffix}@example.invalid`, `f031-other-${suffix}@example.invalid`];
  let server;
  let ids = [];
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) await Promise.all([
      Session.deleteMany({ userId: { $in: ids } }), User.deleteMany({ email: { $in: emails } }),
      InvitedEmail.deleteMany({ email: { $in: emails } })
    ]);
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 2500 });
  await Promise.all([User.createIndexes(), InvitedEmail.createIndexes()]);
  const [admin, member, unverified] = await User.create([
    { name: 'Admin fixture', email: emails[0], passwordHash: 'never-return-this', emailVerifiedAt: new Date() },
    { name: `Member [${suffix}]`, email: emails[1], passwordHash: 'never-return-this', emailVerifiedAt: new Date() },
    { name: 'Unverified fixture', email: emails[2], passwordHash: 'never-return-this' }
  ]);
  ids = [admin, member, unverified].map((user) => user._id);
  const tokens = [admin, member, unverified].map(() => crypto.randomBytes(32).toString('hex'));
  await Session.create([admin, member, unverified].map((user, index) => ({ userId: user._id,
    tokenHash: crypto.createHash('sha256').update(tokens[index]).digest('hex'), expiresAt: new Date(Date.now() + 60000) })));
  const { resetRuntimeConfigForTests, getRuntimeConfig } = require('../src/config/runtime');
  resetRuntimeConfigForTests();
  server = require('../src/app').createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, { token = tokens[0], cookie = false, method = 'GET', body } = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: {
      ...(token ? cookie ? { Cookie: `astitva_stage_session=${token}` } : { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const endpoints = [
    ['/api/admin/users?q=Member', 'GET'], [`/api/admin/users/${member.id}`, 'GET'],
    [`/api/admin/users/${member.id}`, 'PATCH'], ['/api/admin/invitees', 'POST'],
    [`/api/admin/invitees?email=${emails[3]}`, 'GET'], [`/api/admin/invitees/${member.id}`, 'PATCH']
  ];
  for (const [path, method] of endpoints) {
    assert.equal((await call(path, { token: null, method })).status, 401);
    const denied = await call(path, { token: tokens[1], method });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'ADMIN_ACCESS_REQUIRED');
    assert.equal((await call(path, { token: tokens[2], method })).status, 403);
  }
  assert.equal((await call('/api/admin/users?q=Member', { token: '0'.repeat(64) })).status, 401);
  const search = await call(`/api/admin/users?q=${encodeURIComponent(`[${suffix}]`)}`, { cookie: true });
  assert.equal(search.status, 200);
  assert.equal(search.headers.get('cache-control'), 'no-store');
  assert.equal(search.body.users.length, 1, 'regex characters are literal');
  assert.equal(search.body.users[0].id, member.id);
  assert.ok(!JSON.stringify(search.body).includes('passwordHash'));
  assert.ok(!JSON.stringify(search.body).includes('never-return-this'));
  assert.equal((await call('/api/admin/users?q=Member&limit=51')).status, 400);
  assert.equal((await call('/api/admin/users?q=&page=0')).status, 400);
  assert.equal((await call('/api/admin/users/not-an-id')).status, 404);
  assert.equal((await call(`/api/admin/users?q=${emails[4]}`)).body.users.length, 0);
  const me = await call('/api/auth/me');
  assert.equal(me.body.user.isAdmin, true);
  assert.equal((await call('/api/auth/me', { token: tokens[1] })).body.user.isAdmin, false);
  assert.ok(!JSON.stringify((await call('/api/health')).body).includes(adminEmail));

  let loaded = (await call(`/api/admin/users/${member.id}`)).body.user;
  const original = loaded.expectedVersion;
  assert.equal((await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { name: 'Forbidden name', expectedVersion: original } })).status, 400);
  assert.equal((await User.findById(member._id)).name, member.name);
  assert.equal((await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { email: emails[4], expectedVersion: original } })).status, 400);
  let changed = await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { features: { chat: true, diet: true, mcp: true }, expectedVersion: loaded.expectedVersion } });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.user.features.chat, true);
  assert.equal(loaded.features.mcp, false);
  assert.equal(changed.body.user.features.mcp, true);
  assert.equal(changed.body.user.features.family, true);
  assert.equal((await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { features: { chat: false }, expectedVersion: loaded.expectedVersion } })).status, 409);
  changed = await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { features: { chat: false }, expectedVersion: changed.body.user.expectedVersion } });
  assert.equal(changed.status, 200);
  assert.ok(revoked.includes(member.id));
  assert.equal((await call('/api/auth/me', { token: tokens[1] })).body.user.features.diet, true);
  assert.equal((await call('/api/auth/me', { token: tokens[1] })).body.user.features.mcp, true);
  assert.equal((await call('/api/chat/conversations', { token: tokens[1] })).status, 403);

  const made = await call('/api/admin/invitees', { method: 'POST',
    body: { email: ` ${emails[3].toUpperCase()} `, features: { priorities: true, chat: false } } });
  assert.equal(made.status, 201);
  assert.equal(made.body.invitationSent, true);
  assert.deepEqual(sent, [emails[3]]);
  assert.equal(made.body.invitee.email, emails[3]);
  assert.equal(made.body.invitee.registered, false);
  assert.equal(made.body.invitee.features.family, true);
  assert.equal(await User.exists({ email: emails[3] }), null, 'invite does not create an account');
  assert.equal((await call('/api/admin/invitees', { method: 'POST',
    body: { email: emails[3], features: { chat: true } } })).status, 409);
  for (const flags of [{ admin: true }, { diet: 'true' }, {}]) {
    assert.equal((await call('/api/admin/invitees', { method: 'POST', body: { email: emails[4], features: flags } })).status, 400);
  }
  assert.deepEqual(sent, [emails[3]], 'duplicates do not send email');
  const sendPath = `/api/admin/invitees/${made.body.invitee.id}/send-invitation`;
  assert.equal((await call(sendPath, { token: tokens[1], method: 'POST' })).status, 403);
  failEmail = true;
  assert.equal((await call(sendPath, { method: 'POST' })).status, 503);
  const failedMail = await call('/api/admin/invitees', { method: 'POST',
    body: { email: emails[4], features: { family: true } } });
  assert.equal(failedMail.status, 201);
  assert.equal(failedMail.body.invitationSent, false);
  assert.ok(await InvitedEmail.exists({ email: emails[4] }));
  failEmail = false;
  assert.equal((await call(sendPath, { method: 'POST' })).status, 200);
  const found = await call(`/api/admin/invitees?email=${emails[3].toUpperCase()}`);
  assert.equal(found.status, 200);
  const edited = await call(`/api/admin/invitees/${made.body.invitee.id}`, { method: 'PATCH',
    body: { features: { finance: true }, expectedVersion: found.body.invitee.expectedVersion } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.invitee.features.finance, true);
  assert.equal((await call(`/api/admin/invitees/${made.body.invitee.id}`, { method: 'PATCH',
    body: { features: { diet: true }, expectedVersion: found.body.invitee.expectedVersion } })).status, 409);
  const absentRegistered = await call(`/api/admin/invitees?email=${adminEmail}`);
  assert.equal(absentRegistered.status, 404);
  assert.equal(absentRegistered.body.registered, true);

  failRevoke = true;
  const failure = await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { features: { chat: false }, expectedVersion: changed.body.user.expectedVersion } });
  assert.equal(failure.status, 503);
  assert.equal(failure.body.code, 'CHAT_REVOCATION_PENDING');
  assert.equal((await InvitedEmail.findOne({ email: member.email })).chat, false);
  failRevoke = false;
  loaded = (await call(`/api/admin/users/${member.id}`)).body.user;
  assert.equal((await call(`/api/admin/users/${member.id}`, { method: 'PATCH',
    body: { features: { chat: false }, expectedVersion: loaded.expectedVersion } })).status, 200);

  process.env.ADMIN_EMAILS = `${emails[0]}, ${emails[1]}, ${emails[2]}`; resetRuntimeConfigForTests();
  assert.equal((await call('/api/admin/users?q=Member', { token: tokens[1] })).status, 200);
  assert.equal((await call('/api/admin/users?q=Member', { token: tokens[2] })).status, 403);
  // The same active session must lose admin authority after configuration changes.
  process.env.ADMIN_EMAILS = emails[1]; resetRuntimeConfigForTests();
  assert.deepEqual(getRuntimeConfig().adminEmails, [emails[1]]);
  assert.equal((await call('/api/admin/users?q=Member')).status, 403);
  process.env.ADMIN_EMAILS = ''; resetRuntimeConfigForTests();
  assert.equal((await call('/api/admin/users?q=Member', { token: tokens[1] })).status, 403);
});
