// Explicit opt-in. Uses local Dev MongoDB and removes only F018 fixture records.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('F018 invitation, perspective, roles, and private sharing', {
  skip: process.env.ASTITVA_TEST_FAMILY !== '1', timeout: 60000
}, async (t) => {
  Object.assign(process.env, { ASTITVA_ENV: 'dev', MONGODB_URL: 'mongodb://127.0.0.1:27017/astitva',
    PLAID_ENV: 'sandbox', PLAID_CLIENT_ID: 'local-test', PLAID_SECRET: 'local-test',
    FINANCE_TOKEN_ENCRYPTION_KEY: '11'.repeat(32) });
  const mongoose = require('mongoose');
  const express = require('express');
  const User = require('../src/models/User');
  const Session = require('../src/models/Session');
  const { Family, FamilyInvitation, FamilyActivity } = require('../src/models/Family');
  const { Meal } = require('../src/models/Diet');
  const ids = Array.from({ length: 3 }, () => new mongoose.Types.ObjectId());
  const cookies = ids.map(() => crypto.randomBytes(32).toString('hex'));
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      const families = await Family.find({ creatorId: { $in: ids } }).select('_id').lean();
      await Promise.all([
        FamilyInvitation.deleteMany({ familyId: { $in: families.map((family) => family._id) } }),
        FamilyActivity.deleteMany({ familyId: { $in: families.map((family) => family._id) } }),
        Family.deleteMany({ creatorId: { $in: ids } }), Meal.deleteMany({ userId: { $in: ids } }),
        Session.deleteMany({ userId: { $in: ids } }), User.deleteMany({ _id: { $in: ids } })
      ]);
    }
    await mongoose.disconnect();
  });
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 2500 });
  await Promise.all([Family.createIndexes(), FamilyInvitation.createIndexes(), FamilyActivity.createIndexes()]);
  for (let i = 0; i < ids.length; i++) {
    await User.create({ _id: ids[i], name: ['Alex', 'Blair', 'Casey'][i],
      email: `f018-${ids[i]}@example.invalid`, passwordHash: 'fixture', emailVerifiedAt: new Date() });
    await Session.create({ userId: ids[i], tokenHash: crypto.createHash('sha256').update(cookies[i]).digest('hex'),
      expiresAt: new Date(Date.now() + 3600000) });
  }
  const app = express();
  app.use(require('cookie-parser')());
  app.use(express.json());
  app.use('/api/family', require('../src/routes/family'));
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const origin = `http://127.0.0.1:${server.address().port}/api/family`;
  async function request(method, path = '', body, account = 0) {
    const response = await fetch(origin + path, { method, headers: {
      ...(account === null ? {} : { Cookie: `astitva_dev_session=${cookies[account]}` }),
      'Content-Type': 'application/json'
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  assert.equal((await request('GET', '', undefined, null)).status, 401);
  const created = await request('POST', '', { gender: 'male' });
  assert.equal(created.status, 201);
  const familyId = created.body.family.id;
  assert.equal(created.body.family.self.role, 'ADMIN');
  assert.equal((await request('GET', '/sharing/summary')).body.features.diet.sharedWith.length, 0);
  assert.equal((await request('GET', `/${familyId}/activity`, undefined, null)).status, 401);
  assert.equal((await request('GET', `/${familyId}/activity?limit=0`)).status, 400);
  assert.equal((await request('GET', `/${familyId}/activity?before=bad`)).status, 400);
  const child = await request('POST', `/${familyId}/people`, { name: 'Casey',
    email: `f018-${ids[2]}@example.invalid`, relationship: 'son' });
  assert.equal(child.status, 201);
  assert.equal((await request('POST', `/${familyId}/people`, { name: 'Daisy', relationship: 'daughter' })).status, 201);
  const wife = await request('POST', `/${familyId}/people`, {
    name: 'Blair', email: `f018-${ids[1]}@example.invalid`, relationship: 'wife'
  });
  assert.equal(wife.status, 201);
  const wifeConnection = wife.body.family.connections.find((edge) => edge.label === 'Wife');
  const wifeId = wifeConnection.person.id;
  assert.equal(wifeConnection.label, 'Wife');
  assert.equal((await request('GET', `/${familyId}`, undefined, 1)).status, 404, 'email matching alone grants no access');
  assert.equal((await request('GET', `/${familyId}/activity`, undefined, 1)).status, 404);
  const token = crypto.randomBytes(32).toString('hex');
  await FamilyInvitation.create({ familyId, personId: wifeId, email: `f018-${ids[1]}@example.invalid`,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) });
  await Family.updateOne({ _id: familyId, 'people._id': wifeId }, { $set: { 'people.$.status': 'PENDING' } });
  const wifeOwnFamily = await request('POST', '', {}, 1);
  assert.equal(wifeOwnFamily.status, 201);
  assert.equal((await request('GET', '/invitations', undefined, 1)).body.invitations.length, 1);
  assert.equal((await request('POST', '/invitations/accept', { token }, 2)).status, 403);
  const accepted = await request('POST', '/invitations/accept', { token }, 1);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.family.self.role, 'READONLY');
  assert.equal((await request('GET', `/${familyId}/activity`, undefined, 1)).status, 200);
  assert.equal(accepted.body.family.connections[0].label, 'Husband');
  assert.equal((await Family.exists({ _id: wifeOwnFamily.body.family.id })), null, 'empty duplicate family is removed after acceptance');
  assert.equal((await request('GET', '', undefined, 1)).body.families.length, 1);
  assert.equal((await request('POST', '/invitations/accept', { token }, 1)).status, 410);
  assert.equal((await request('POST', `/${familyId}/people`, { name: 'Child', relationship: 'son' }, 1)).status, 403);
  const childOwnFamily = await request('POST', '', {}, 2);
  assert.equal(childOwnFamily.status, 201);
  const childId = child.body.family.connections.find((edge) => edge.person.name === 'Casey').person.id;
  const childToken = crypto.randomBytes(32).toString('hex');
  const childInvitation = await FamilyInvitation.create({ familyId, personId: childId,
    email: `f018-${ids[2]}@example.invalid`,
    tokenHash: crypto.createHash('sha256').update(childToken).digest('hex'),
    expiresAt: new Date(Date.now() + 3600000) });
  await Family.updateOne({ _id: familyId, 'people._id': childId }, { $set: { 'people.$.status': 'PENDING' } });
  assert.equal((await request('GET', '/invitations', undefined, 2)).body.invitations[0].id, String(childInvitation._id));
  assert.equal((await request('POST', `/invitations/${childInvitation._id}/accept`, undefined, 2)).status, 200);
  assert.equal((await Family.exists({ _id: childOwnFamily.body.family.id })), null);
  const sonView = (await request('GET', `/${familyId}`, undefined, 2)).body.family;
  assert.deepEqual(sonView.connections.filter((edge) => edge.group === 'bornIn').map((edge) => edge.label).sort(), ['Father', 'Mother']);
  const wifeView = await request('GET', `/${familyId}`, undefined, 1);
  assert.equal(wifeView.body.family.connections.find((edge) => edge.person.name === 'Casey').label, 'Son');
  assert.equal(wifeView.body.family.connections.find((edge) => edge.person.name === 'Daisy').label, 'Daughter');
  const childEdge = child.body.family.connections.find((edge) => edge.person.name === 'Casey');
  assert.equal((await request('DELETE', `/${familyId}/relations/${childEdge.relationId}`)).status, 200);
  assert.equal((await request('GET', `/${familyId}`, undefined, 1)).body.family.connections.some((edge) => edge.person.name === 'Casey'), false,
    'removing a shared child relationship removes it from both partner views');
  assert.equal((await request('GET', `/${familyId}`, undefined, 1)).body.family.connections.some((edge) => edge.person.name === 'Daisy'), true);
  assert.deepEqual(wifeView.body.family.sharedWithMe, [], 'sharing defaults off');
  const denied = await request('GET', `/${familyId}/shared/${ids[0]}/diet?date=2026-09-30`, undefined, 1);
  assert.equal(denied.status, 403);
  assert.equal((await request('PATCH', `/${familyId}/people/${wifeId}/role`, { role: 'EDITOR' }, 1)).status, 403);
  assert.equal((await request('PATCH', `/${familyId}/people/${wifeId}/role`, { role: 'EDITOR' })).status, 200);
  assert.equal((await request('PATCH', `/${familyId}/people/${wifeId}`, {})).status, 400);
  assert.equal((await request('POST', `/${familyId}/people`, { name: 'Dana', relationship: 'mother' }, 1)).status, 201);
  assert.equal((await request('DELETE', `/${familyId}/relations/${wifeView.body.family.connections[0].relationId}`, undefined, 1)).status, 403);
  assert.equal((await request('PUT', `/${familyId}/shares/diet/${ids[1]}`)).status, 200);
  const ownerSummary = (await request('GET', '/sharing/summary')).body.features;
  const recipientSummary = (await request('GET', '/sharing/summary', undefined, 1)).body.features;
  assert.equal(ownerSummary.diet.sharedWith[0].person.name, 'Blair');
  assert.equal(recipientSummary.diet.sharedBy[0].person.name, 'Alex');
  assert.equal(ownerSummary.finance.sharedWith.length, 0);
  assert.equal(JSON.stringify(ownerSummary).includes('f018-'), false, 'summary omits emails');
  const firstActivityPage = await request('GET', `/${familyId}/activity?limit=2`, undefined, 1);
  assert.equal(firstActivityPage.status, 200);
  assert.equal(firstActivityPage.body.events.length, 2);
  assert.ok(firstActivityPage.body.nextCursor);
  const secondActivityPage = await request('GET', `/${familyId}/activity?limit=2&before=${encodeURIComponent(firstActivityPage.body.nextCursor)}`, undefined, 1);
  assert.equal(secondActivityPage.status, 200);
  assert.notEqual(firstActivityPage.body.events[1].id, secondActivityPage.body.events[0].id);
  assert.equal(JSON.stringify(firstActivityPage.body).includes('f018-'), false, 'activity omits emails');
  assert.equal(JSON.stringify(firstActivityPage.body).includes(token), false, 'activity omits invitation token');
  assert.equal((await request('GET', `/${familyId}/shared/${ids[0]}/diet?date=2026-09-30`, undefined, 1)).status, 200);
  assert.equal((await request('GET', `/${familyId}/shared/${ids[0]}/diet?date=2026-02-31`, undefined, 1)).status, 400);
  assert.equal((await request('GET', `/${familyId}/shared/${ids[0]}/finance?month=2026-09`, undefined, 1)).status, 403);
  assert.equal((await request('PUT', `/${familyId}/shares/finance/${ids[1]}`)).status, 200);
  assert.equal((await request('GET', '/sharing/summary', undefined, 1)).body.features.finance.sharedBy.length, 1);
  assert.equal((await request('DELETE', `/${familyId}/shares/finance/${ids[1]}`)).status, 200);
  assert.equal((await request('GET', '/sharing/summary', undefined, 1)).body.features.finance.sharedBy.length, 0);
  assert.equal((await request('DELETE', `/${familyId}/shares/diet/${ids[1]}`)).status, 200);
  assert.equal((await request('GET', '/sharing/summary', undefined, 1)).body.features.diet.sharedBy.length, 0);
  assert.equal((await request('GET', `/${familyId}/shared/${ids[0]}/diet?date=2026-09-30`, undefined, 1)).status, 403);
  assert.equal((await request('PUT', `/${familyId}/shares/diet/${ids[1]}`)).status, 200);
  assert.equal((await request('DELETE', `/${familyId}/relations/${wifeView.body.family.connections[0].relationId}`)).status, 200);
  assert.equal((await request('GET', `/${familyId}`, undefined, 1)).status, 404, 'disconnect revokes membership');
  assert.equal((await request('GET', `/${familyId}/activity`, undefined, 1)).status, 404, 'disconnect revokes activity access');
  assert.equal((await request('GET', `/${familyId}/shared/${ids[0]}/diet?date=2026-09-30`, undefined, 1)).status, 404, 'disconnect revokes sharing');
  assert.equal((await request('GET', `/${familyId}`, undefined, 2)).status, 404);
});
