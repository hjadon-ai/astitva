import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { hash, plannedSchedule, readSource, scopeHash, selectFeature, workflowIssues, validApprovalTime } from './development-planner.mjs';
import { createDevelopment, emptyState } from './development-state.mjs';

const NOW = new Date('2026-10-05T18:30:00Z');
function fixture(t, specs = [{ id: 'F101', status: 'Approved', priority: 'High', approvedAt: '2026-10-01T16:00:00Z', dependsOn: 'None' }]) {
  const root = mkdtempSync(join(tmpdir(), 'f033-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs/features/infra'), { recursive: true });
  const dataRoot = join(root, 'control-data'); mkdirSync(dataRoot);
  writeFileSync(join(root, 'README.md'), 'Use feature/F###-short-name. Only the owner marks reviewed work Done. Never push main or merge.\n');
  let index = '# Features\n\n| ID | Feature | Status | Branch | Pull request |\n| --- | --- | --- | --- | --- |\n';
  for (const s of specs) {
    const file = `infra/${s.id}-example.md`;
    index += `| ${s.id} | [Example ${s.id}](${file}) | ${s.indexStatus || s.status} | Not created | Not created |\n`;
    let text = `# ${s.id}: Example\n\n- **Status:** ${s.status}\n`;
    for (const [key, label] of [['priority', 'Priority'], ['approvedAt', 'Approved at'], ['dependsOn', 'Depends on']]) if (s[key] !== undefined) text += `- **${label}:** ${s[key]}\n`;
    text += '\n## Goal\n\nA bounded fixture feature.\n';
    writeFileSync(join(root, 'docs/features', file), text);
  }
  writeFileSync(join(root, 'docs/features/README.md'), index);
  const api = createDevelopment({ repoRoot: root, dataRoot, clock: () => NOW });
  const choose = state => selectFeature(readSource(root), state || emptyState(), NOW);
  return { root, dataRoot, api, choose };
}
const high = (id, extra = {}) => ({ id, status: 'Approved', priority: 'High', approvedAt: '2026-10-01T16:00:00Z', dependsOn: 'None', ...extra });

test('selection honors eligibility, High/Medium/Low, approval instant and numeric tie', t => {
  const f = fixture(t, [high('F102'), high('F101'), high('F103', { approvedAt: '2026-09-30T16:00:00Z' }), high('F104', { priority: 'Medium', approvedAt: '2026-09-01T16:00:00Z' }), high('F105', { status: 'Proposed' })]);
  assert.equal(f.choose().decision.featureId, 'F103');
  const p = join(f.root, 'docs/features/infra/F103-example.md'); writeFileSync(p, readFileSync(p, 'utf8').replace('High', 'Low'));
  assert.equal(f.choose().decision.featureId, 'F101');
  assert.equal(f.choose().features.find(x => x.id === 'F105').eligibility, 'ineligible');
});

test('missing metadata excludes individual work without inventing approval', t => {
  const f = fixture(t, [high('F101', { priority: undefined, approvedAt: undefined }), high('F102', { priority: 'Medium' }), high('F103', { priority: 'Critical', approvedAt: '2030-10-01T16:00:00Z' })]);
  const plan = f.choose(); assert.equal(plan.decision.featureId, 'F102');
  assert.ok(plan.requiredHumanActions.some(x => x.code === 'priority_required' && x.forFeatureId === 'F101'));
  assert.ok(plan.requiredHumanActions.some(x => x.code === 'approval_metadata_required'));
});

test('historical Done satisfies dependencies; unfinished, unknown and cycles do not', t => {
  const f = fixture(t, [high('F101', { dependsOn: 'F105' }), high('F102', { dependsOn: 'F103' }), high('F103', { dependsOn: 'F102' }), high('F104', { dependsOn: 'F199' }), { id: 'F105', status: 'Done' }]);
  const plan = f.choose(); assert.equal(plan.decision.featureId, 'F101');
  assert.ok(plan.requiredHumanActions.some(x => x.code === 'dependency_cycle'));
  assert.ok(plan.requiredHumanActions.some(x => x.code === 'dependency_missing'));
  const p = join(f.root, 'docs/features/infra/F105-example.md'); writeFileSync(p, readFileSync(p, 'utf8').replace('Done', 'Review'));
  assert.equal(f.choose().decision.action, 'blocked'); // index disagreement is a source blocker
});

test('one In Progress reserves work; only a consistent checkpoint gives would_resume', t => {
  const f = fixture(t, [high('F101', { status: 'In Progress', priority: 'Low' }), high('F102')]);
  assert.equal(f.choose().decision.action, 'blocked'); assert.equal(f.choose().decision.featureId, 'F101');
  const state = emptyState(); const fingerprint = readSource(f.root).features[0].scopeHash;
  state.activeJob = { jobId: 'job-1', featureId: 'F101', approvedScopeHash: fingerprint, latestCheckpointId: 'cp-1' };
  state.checkpoints = [{ checkpointId: 'cp-1', jobId: 'job-1', featureId: 'F101', approvedScopeHash: fingerprint, phase: 'implementation', headCommit: 'a'.repeat(40), sessionId: 'session-1' }];
  assert.equal(f.choose(state).decision.action, 'would_resume');
  state.checkpoints[0].approvedScopeHash = 'changed'; assert.equal(f.choose(state).decision.action, 'blocked');
});

test('multiple In Progress or conflicting job ownership blocks all new work', t => {
  const f = fixture(t, [high('F101', { status: 'In Progress' }), high('F102', { status: 'In Progress' })]);
  assert.ok(f.choose().requiredHumanActions.some(x => x.code === 'multiple_in_progress'));
  const g = fixture(t); const state = emptyState(); state.activeJob = { featureId: 'F102' };
  assert.equal(g.choose(state).decision.action, 'blocked');
});

test('workflow conflicts include file/rule evidence and no automatic reconciliation', t => {
  const f = fixture(t);
  const text = '- Use one active work branch for all pending changes.\n- Name work branches feature/changes_DD-Mmm-YYYY.\n- Mark implementation Done in the same work.\n';
  writeFileSync(join(f.root, 'AGENTS.md'), text);
  assert.equal(f.choose().decision.action, 'blocked');
  assert.ok(f.choose().requiredHumanActions.some(x => x.file === 'AGENTS.md' && x.line && x.rule));
  assert.equal(readFileSync(join(f.root, 'AGENTS.md'), 'utf8'), text);
  assert.ok(workflowIssues({ 'AGENTS.md': '- Use branches named feature/something-else.\n' }).length);
});

test('unsafe paths, symlinks, status mismatches, duplicate IDs and fields fail safely', t => {
  const f = fixture(t, [high('F101', { indexStatus: 'Done' })]); assert.equal(f.choose().decision.action, 'blocked');
  const g = fixture(t); const index = join(g.root, 'docs/features/README.md');
  const row = readFileSync(index, 'utf8').split('\n').find(x => x.startsWith('| F101'));
  writeFileSync(index, readFileSync(index, 'utf8') + row + '\n'); assert.equal(g.choose().decision.action, 'blocked');
  writeFileSync(index, readFileSync(index, 'utf8').replaceAll('infra/F101-example.md', '../../private.md')); assert.equal(g.choose().decision.action, 'blocked');
  const h = fixture(t); const file = join(h.root, 'docs/features/infra/F101-example.md'); rmSync(file); symlinkSync(join(h.root, 'README.md'), file);
  assert.throws(() => readSource(h.root), e => e.status === 503 && e.code === 'unsafe_source');
  const j = fixture(t); const jp = join(j.root, 'docs/features/infra/F101-example.md'); writeFileSync(jp, readFileSync(jp, 'utf8') + '\n- **Priority:** Low\n'); assert.equal(j.choose().decision.action, 'none');
});

test('scope checkpoint hash excludes lifecycle metadata but detects actual scope edits', () => {
  const doc = '# F101\n- **Status:** Approved\n- **Priority:** High\n- **Branch:** Not created\n\n## Goal\nScope.\n';
  assert.equal(scopeHash(doc), scopeHash(doc.replace('Approved', 'In Progress').replace('High', 'Low')));
  assert.notEqual(scopeHash(doc), scopeHash(doc.replace('Scope.', 'Changed scope.')));
});

test('Pacific planning handles midnight, spring/fall DST and 08:00 quality without jobs', () => {
  const s = plannedSchedule(NOW); assert.equal(s.nextImplementationAt, '2026-10-05T19:00:00.000Z'); assert.equal(s.nextQualityAt, '2026-10-06T15:00:00.000Z'); assert.equal(s.enabled, false);
  assert.equal(plannedSchedule(new Date('2026-03-08T08:01:00Z')).nextImplementationAt, '2026-03-08T11:00:00.000Z');
  assert.equal(plannedSchedule(new Date('2026-11-01T07:01:00Z')).nextImplementationAt, '2026-11-01T12:00:00.000Z');
  assert.equal(plannedSchedule(new Date('2026-10-06T06:59:00Z')).nextImplementationAt, '2026-10-06T07:00:00.000Z');
});

test('GET is non-writing; manual results survive restart, retain 100, keep source byte-identical', async t => {
  const f = fixture(t); const source = readSource(f.root).fingerprint;
  f.api.state(); assert.equal(existsSync(f.api.store.path), false);
  for (let i = 0; i < 103; i++) await f.api.evaluate({});
  const restored = createDevelopment({ repoRoot: f.root, dataRoot: f.dataRoot, clock: () => NOW });
  assert.equal(restored.store.read().evaluations.length, 100); assert.equal(restored.store.read().revision, 103);
  assert.equal(readSource(f.root).fingerprint, source); assert.equal(restored.state().executionEnabled, false);
  assert.equal(restored.store.read().activeJob, null); assert.deepEqual(restored.store.read().jobs, []);
  const page = restored.history(new URLSearchParams('limit=20')); assert.equal(page.evaluations.length, 20); assert.ok(page.nextCursor);
  assert.equal(restored.history(new URLSearchParams(`before=${page.nextCursor}`)).evaluations.length, 20);
  assert.equal(restored.detail(page.evaluations[0].runId).kind, 'dry-run');
  assert.throws(() => restored.history(new URLSearchParams('limit=1.5')), e => e.status === 400);
  assert.throws(() => restored.detail('bad'), e => e.status === 400);
  assert.throws(() => restored.detail('00000000-0000-4000-8000-000000000000'), e => e.status === 404);
});

test('concurrent writers are serialized with no duplicate persisted evaluations', async t => {
  const f = fixture(t); const other = createDevelopment({ repoRoot: f.root, dataRoot: f.dataRoot, clock: () => NOW });
  const first = f.api.evaluate({}); await assert.rejects(other.evaluate({}), e => e.status === 409); await first;
  await other.evaluate({}); assert.equal(f.api.store.read().revision, 2);
  assert.equal(existsSync(f.api.store.lock), false);
});

test('source changes during evaluation discard the observation and release guard', async t => {
  const f = fixture(t); let reads = 0;
  const api = createDevelopment({ repoRoot: f.root, dataRoot: f.dataRoot, clock: () => NOW, sourceReader: root => { const s = readSource(root); if (++reads > 1) s.fingerprint = 'changed'; return s; } });
  await assert.rejects(api.evaluate({}), e => e.status === 409); assert.equal(existsSync(api.store.path), false); assert.equal(existsSync(api.store.lock), false);
});

test('corrupt, unsupported, readonly and symlinked state is preserved and never healthy', async t => {
  const f = fixture(t);
  for (const content of ['broken JSON', JSON.stringify({ ...emptyState(), schemaVersion: 99 }), JSON.stringify({ ...emptyState(), evaluations: [{}] })]) {
    writeFileSync(f.api.store.path, content); assert.equal(f.api.state().health.status, 'degraded');
    await assert.rejects(f.api.evaluate({}), e => e.status === 503); assert.equal(readFileSync(f.api.store.path, 'utf8'), content);
  }
  writeFileSync(f.api.store.path, JSON.stringify(emptyState())); chmodSync(f.api.store.path, 0o400);
  assert.equal(f.api.state().health.status, 'degraded'); await assert.rejects(f.api.evaluate({}), e => e.status === 503);
  chmodSync(f.api.store.path, 0o600); rmSync(f.api.store.path); symlinkSync(join(f.root, 'README.md'), f.api.store.path);
  await assert.rejects(f.api.evaluate({}), e => e.status === 503);
});

test('abandoned/ambiguous writer guard is not reclaimed based on elapsed time', async t => {
  const f = fixture(t); mkdirSync(f.api.store.lock); writeFileSync(join(f.api.store.lock, 'owner.json'), '{}');
  await assert.rejects(f.api.evaluate({}), e => e.status === 409); assert.equal(f.api.state().health.status, 'blocked'); assert.ok(existsSync(f.api.store.lock));
});

test('manual planning API protects writes; no Codex, scheduled jobs or source mutation', async t => {
  const f = fixture(t);
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const sentinel = join(f.root, 'codex-was-invoked'); const fakeCodex = join(f.root, 'fake-codex'); writeFileSync(fakeCodex, `#!/bin/sh\ntouch '${sentinel}'\n`, { mode: 0o700 });
  const child = spawn(process.execPath, [join(import.meta.dirname, 'server.mjs')], { env: { ...process.env, ASTITVA_REPO_ROOT: f.root, CONTROL_CENTER_DATA_DIR: f.dataRoot, CONTROL_CENTER_PORT: String(port), CODEX_BIN: fakeCodex }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = ''; child.stderr.on('data', b => { errors += b; });
  t.after(async () => { child.kill('SIGTERM'); await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('close', resolve); }); });
  let token;
  for (let n = 0; n < 50; n++) { try { const r = await fetch(base + '/api/state'); token = (await r.json()).token; break; } catch { await delay(50); } }
  assert.ok(token, errors);
  const original = readSource(f.root).fingerprint;
  async function post(body, extra = {}) { return fetch(base + '/api/development/evaluations', { method: 'POST', headers: { Origin: base, 'X-Control-Token': token, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) }); }
  assert.equal((await post({}, { 'X-Control-Token': 'wrong' })).status, 403);
  assert.equal((await post({}, { Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await post({ featureId: 'F101' })).status, 400);
  assert.equal((await post({}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post({ huge: 'x'.repeat(17000) })).status, 413);
  const stateBefore = await (await fetch(base + '/api/development/state')).json(); assert.equal(stateBefore.lastEvaluation, null); assert.equal(existsSync(f.api.store.path), false);
  const result = await post({}); assert.equal(result.status, 201); const run = await result.json(); assert.equal(run.decision.featureId, 'F101');
  assert.equal((await fetch(base + `/api/development/evaluations/${run.runId}`)).status, 200);
  assert.equal((await fetch(base + '/api/development/evaluations?limit=0')).status, 400);
  assert.equal((await fetch(base + '/api/development/evaluations/bad')).status, 400);
  assert.equal((await fetch(base + '/api/development/start', { method: 'POST', headers: { Origin: base, 'X-Control-Token': token, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  assert.equal(readSource(f.root).fingerprint, original); assert.equal(existsSync(sentinel), false);
  const serialized = JSON.stringify(run); assert.equal(serialized.includes(f.root), false);
  for (const name of ['development-planner.mjs', 'development-state.mjs']) assert.doesNotMatch(readFileSync(join(import.meta.dirname, name), 'utf8'), /child_process|fetch\(|setInterval\(|setTimeout\(/);
});


test('approval timestamps reject impossible calendar dates and support offset instants', () => {
  assert.equal(validApprovalTime('2026-02-30T12:00:00Z', NOW), false);
  assert.equal(validApprovalTime('2026-10-01T09:00:00-07:00', NOW), true);
  assert.equal(validApprovalTime('2026-10-01T09:00:00', NOW), false);
});

test('independent processes contend safely for the same persistence file', async t => {
  const f = fixture(t);
  const module = new URL('./development-state.mjs', import.meta.url).href;
  const script = `import {createDevelopment} from ${JSON.stringify(module)}; import {setTimeout as delay} from 'node:timers/promises'; const api=createDevelopment({repoRoot:process.argv[1],dataRoot:process.argv[2]}); let completed=0; for(let n=0;n<100 && completed<5;n++){try{await api.evaluate({});completed++;}catch(e){if(e.status!==409)throw e;await delay(5);}} if(completed!==5)process.exitCode=1;`;
  await Promise.all([1,2].map(() => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module','-e',script,f.root,f.dataRoot], {stdio:['ignore','ignore','pipe']});
    let errors=''; child.stderr.on('data', b => {errors+=b;}); child.on('error',reject); child.on('close', code => code===0 ? resolve() : reject(new Error(errors)));
  })));
  assert.equal(f.api.store.read().revision, 10);
  assert.equal(new Set(f.api.store.read().evaluations.map(r=>r.runId)).size,10);
});


test('historical branch records and branch-link bookkeeping are not workflow conflicts', () => {
  assert.deepEqual(workflowIssues({ 'docs/features/README.md': '| F101 | Feature | Done | feature/changes_04-Oct-2026 | Not created |\n', 'docs/INSTRUCTIONS.md': '- Keep Git branches and pull-request links recorded with their feature.\n' }), []);
});
