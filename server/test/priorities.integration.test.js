// Explicit opt-in: connects only to local Dev and deletes only generated fixture owners.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('F009 real MongoDB REST ownership, persistence, validation and concurrent writes', {
  skip: process.env.ASTITVA_TEST_PRIORITIES !== '1', timeout: 60000
}, async (t) => {
  Object.assign(process.env, { ASTITVA_ENV: 'dev', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva',
    PLAID_ENV: 'sandbox', PLAID_CLIENT_ID: 'local-test', PLAID_SECRET: 'local-test', FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32) });
  const mongoose = require('mongoose');
  const express = require('express');
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const Day = require('../src/models/DailyPriorityDay');
  const InvitedEmail = require('../src/models/InvitedEmail');
  const owners = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await Promise.all([Day.deleteMany({ userId: { $in: owners } }), Session.deleteMany({ userId: { $in: owners } }),
        InvitedEmail.deleteMany({ email: { $in: owners.map((id) => `f009-${id}@example.invalid`) } }), User.deleteMany({ _id: { $in: owners } })]);
    }
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 2500 });
  await Day.createIndexes();
  const tokens = owners.map(() => crypto.randomBytes(32).toString('hex'));
  for (let index = 0; index < owners.length; index++) {
    await InvitedEmail.create({ email: `f009-${owners[index]}@example.invalid`, priorities: true });
    await User.create({ _id: owners[index], name: 'F009 test', email: `f009-${owners[index]}@example.invalid`, passwordHash: 'test-only-not-a-login-hash', emailVerifiedAt: index === 2 ? null : new Date() });
    await Session.create({ userId: owners[index], tokenHash: crypto.createHash('sha256').update(tokens[index]).digest('hex'), expiresAt: new Date(Date.now() + (index === 3 ? -60000 : 3600000)) });
  }
  const app = express();
  app.use(require('cookie-parser')());
  app.use('/api/priorities', require('../src/routes/priorities'));
  server = await new Promise((resolve, reject) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.on('error', reject); });
  const origin = `http://127.0.0.1:${server.address().port}/api/priorities`;
  const day = '/days/2024-02-29';
  async function request(method, path = day, body, account = 0, zone = 'America/Los_Angeles', raw = false) {
    const response = await fetch(origin + path, { method, headers: {
      ...(account === null ? {} : { Cookie: `astitva_dev_session=${tokens[account]}` }),
      ...(zone === null ? {} : { 'X-Time-Zone': zone }), 'Content-Type': 'application/json'
    }, ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  assert.equal((await request('GET', day, undefined, null)).status, 401);
  assert.equal((await request('GET', day, undefined, 2)).status, 403);
  assert.equal((await request('GET', day, undefined, 3)).status, 401);
  assert.deepEqual((await request('GET')).body.progress, { completed: 0, total: 0, limit: 3 });
  assert.equal(await Day.countDocuments({ userId: owners[0] }), 0, 'GET must not initialize');
  for (const path of ['/days/2025-02-29', '/days/9999-01-01']) assert.equal((await request('GET', path)).status, 400);
  for (const zone of [null, 'Invalid/Zone']) assert.equal((await request('GET', day, undefined, 0, zone)).status, 400);
  for (const body of [{ title: 'a', userId: String(owners[1]) }, { title: 12 }, {}, { title: 'a\nb' }, { title: 'x'.repeat(121) }]) {
    assert.equal((await request('POST', `${day}/priorities`, body)).status, 400);
  }
  assert.equal((await request('POST', `${day}/priorities`, '{invalid', 0, 'UTC', true)).status, 400);
  const race = await Promise.all(Array.from({ length: 12 }, (_, index) => request('POST', `${day}/priorities`, { title: `Focus ${index}` })));
  assert.equal(race.filter((result) => result.status === 201).length, 3);
  assert.equal(race.filter((result) => result.status === 409).length, 9);
  assert.equal(await Day.countDocuments({ userId: owners[0], date: '2024-02-29' }), 1);
  const rows = (await request('GET')).body.priorities;
  assert.equal(rows.length, 3);
  const item = `${day}/priorities/${rows[0].id}`;
  assert.equal((await request('PATCH', item, { title: 'private' }, 1)).status, 404);
  assert.equal((await request('DELETE', item, undefined, 1)).status, 404);
  assert.equal((await request('GET', day, undefined, 1)).body.priorities.length, 0);
  assert.equal((await request('PATCH', item, { completed: 'true' })).status, 400);
  assert.equal((await request('PATCH', `${day}/priorities/bad`, { completed: true })).status, 404);
  const edits = await Promise.all([request('PATCH', item, { title: 'Renamed' }), request('PATCH', item, { completed: true }), request('PATCH', `${day}/priorities/${rows[1].id}`, { title: 'Unrelated' })]);
  assert.ok(edits.every((result) => result.status === 200));
  let view = (await request('GET')).body;
  assert.deepEqual(view.priorities.map((row) => row.id), rows.map((row) => row.id));
  assert.equal(view.priorities[0].title, 'Renamed'); assert.equal(view.priorities[0].completed, true);
  assert.equal(view.priorities[1].title, 'Unrelated'); assert.equal(view.progress.completed, 1);
  assert.equal((await request('POST', `${day}/priorities`, { title: 'Full' })).status, 409);
  assert.equal((await request('PATCH', item, { completed: false })).status, 200);
  assert.equal((await request('DELETE', item)).status, 204);
  assert.equal((await request('DELETE', item)).status, 404);
  assert.equal((await request('PATCH', item, { title: 'Gone' })).status, 404);
  const capacityRace = await Promise.all(Array.from({ length: 8 }, () => request('POST', `${day}/priorities`, { title: 'Same title allowed' })));
  assert.equal(capacityRace.filter((result) => result.status === 201).length, 1);
  assert.equal(capacityRace.filter((result) => result.status === 409).length, 7);
  assert.equal((await request('GET', '/days/2024-03-01')).body.priorities.length, 0, 'No carryover');
  for (const row of (await request('GET')).body.priorities) await request('DELETE', `${day}/priorities/${row.id}`);
  assert.equal((await request('GET')).body.progress.total, 0);
  assert.equal(await Day.countDocuments({ userId: owners[0], date: '2024-02-29' }), 1, 'Retain empty days');
});
