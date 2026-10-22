const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
test('F052 architecture requires a live verified Admin and never reflects configuration values', { skip: process.env.ASTITVA_TEST_ARCHITECTURE !== '1', timeout: 30000 }, async t => {
  const mongoose = require('mongoose');
  const db = 'mongodb://127.0.0.1:27017/f052_fixture_' + process.pid;
  Object.assign(process.env, { ASTITVA_ENV:'stage', MONGODB_URL:'mongodb://127.0.0.1:27017/astitva_stage', PLAID_ENV:'production', PLAID_CLIENT_ID:'fixture', PLAID_SECRET:'fixture-secret-not-for-reference', FINANCE_TOKEN_ENCRYPTION_KEY:'11'.repeat(32), ADMIN_EMAILS:'admin@example.invalid' });
  require('../src/config/runtime').resetRuntimeConfigForTests();
  await mongoose.connect(db, { serverSelectionTimeoutMS: 2500 });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const User = require('../src/models/User'), Session = require('../src/models/Session');
  const users = await User.create([
    {name:'Admin',email:'admin@example.invalid',passwordHash:'fixture',emailVerifiedAt:new Date()},
    {name:'Member',email:'member@example.invalid',passwordHash:'fixture',emailVerifiedAt:new Date()},
    {name:'Unverified',email:'unverified@example.invalid',passwordHash:'fixture'}
  ]);
  const tokens = users.map(() => crypto.randomBytes(32).toString('hex'));
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  await Session.create(users.map((u,i) => ({userId:u._id,tokenHash:hash(tokens[i]),expiresAt:new Date(Date.now()+60000)})));
  const app = require('../src/app').createApp();
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/architecture`;
  const call = token => fetch(url,{headers:token ? {Authorization:'Bearer '+token} : {}});
  assert.equal((await call()).status,401);
  assert.equal((await call(tokens[1])).status,403);
  assert.equal((await call(tokens[2])).status,403);
  const response = await call(tokens[0]); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
  const text = await response.text(), data = JSON.parse(text);
  assert.ok(data.sections.some(section => section.id === 'apis'));
  assert.ok(data.sections.some(section => section.id === 'mcp'));
  assert.ok(data.nodes.some(node => node.icon === 'mongodb'));
  assert.ok(data.configuration.some(row => row[1] === 'firebase.json'));
  assert.ok(!text.includes(process.env.PLAID_SECRET)); assert.ok(!text.includes(process.env.FINANCE_TOKEN_ENCRYPTION_KEY)); assert.ok(!text.includes(tokens[0])); assert.ok(!text.includes(users[0].email));
  await Session.updateOne({tokenHash:hash(tokens[0])},{$set:{expiresAt:new Date(0)}});
  assert.equal((await call(tokens[0])).status,401);
});
