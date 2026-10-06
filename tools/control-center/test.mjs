import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const fixture = mkdtempSync(join(tmpdir(), 'astitva-control-center-'));
const categoryRoot = join(fixture, 'docs/features/family');
const dataRoot = join(fixture, 'control-data');
mkdirSync(categoryRoot, { recursive: true });
mkdirSync(dataRoot);
const documentPath = join(categoryRoot, 'F101-test-feature.md');
const recommendationPath = join(categoryRoot, 'F102-new-idea.md');
const indexPath = join(fixture, 'docs/features/README.md');
writeFileSync(documentPath, '# F101: Test feature\n\n- **Status:** Proposed\n\n## Goal\n\nTest approval.\n\n## Open questions\n\n1. First decision?\n2. Second decision?\n');
writeFileSync(recommendationPath, '# F102: New idea\n\n- **Status:** Proposed\n\n## Goal\n\nTest recommendation.\n');
writeFileSync(indexPath, '# Features\n\n| ID | Feature | Status | Branch | Pull request |\n| --- | --- | --- | --- | --- |\n| F101 | [Test feature](family/F101-test-feature.md) | Proposed | Not created | Not created |\n| F102 | [New idea](family/F102-new-idea.md) | Proposed | Not created | Not created |\n');

const port = 4327;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [join(import.meta.dirname, 'server.mjs')], {
  env: { ...process.env, ASTITVA_REPO_ROOT: fixture, CONTROL_CENTER_DATA_DIR: dataRoot, CONTROL_CENTER_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let childError = '';
child.stderr.on('data', (chunk) => { childError += chunk; });

async function api(path, method = 'GET', body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json', 'X-Control-Token': token || '' } : {}), Origin: base },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await api('/api/health'); ready = true; break; }
    catch { await delay(100); }
  }
  assert.ok(ready, `Control center did not start: ${childError}`);
  const state = await api('/api/state');
  assert.equal(state.status, 200);
  assert.equal(state.data.categories[0].slug, 'family');
  assert.equal(state.data.categories[0].enabled, false);
  const token = state.data.token;
  const feature = await api('/api/features/F101');
  assert.equal(feature.data.status, 'Proposed');
  assert.deepEqual(feature.data.openQuestions, ['First decision?', 'Second decision?']);

  assert.equal((await api('/api/features/F101/approve', 'POST', {}, 'incorrect')).status, 403);
  assert.equal((await api('/api/features/F101/approve', 'POST', {}, token)).status, 400);
  assert.equal((await api('/api/features/F101/approve', 'POST', { answers: ['One'] }, token)).status, 400);
  assert.equal((await api('/api/features/F101/approve', 'POST', { answers: ['One', ''], comment: 'Review' }, token)).status, 400);
  assert.match(readFileSync(documentPath, 'utf8'), /\*\*Status:\*\* Proposed/);
  assert.equal((await api('/api/features/F101/approve', 'POST', { answers: ['Choose A', 'Choose B'], comment: 'Ready for implementation.' }, token)).status, 200);
  const approved = readFileSync(documentPath, 'utf8');
  assert.match(approved, /\*\*Status:\*\* Approved/);
  assert.match(approved, /## Owner decisions\n\n### 1\. First decision\?\n\n> Choose A\n\n### 2\. Second decision\?\n\n> Choose B/);
  assert.match(approved, /## Approval comment\n\n> Ready for implementation\./);
  assert.match(readFileSync(indexPath, 'utf8'), /F101.*\| Approved \|/);
  assert.equal((await api('/api/features/F101/approve', 'POST', {}, token)).status, 409);

  assert.equal((await api('/api/features/F102/recommend', 'POST', { feedback: 'Try a simpler flow.' }, 'incorrect')).status, 403);
  assert.equal((await api('/api/features/F102/recommend', 'POST', {}, token)).status, 400);
  assert.equal((await api('/api/features/F102/recommend', 'POST', { feedback: '  ' }, token)).status, 400);
  assert.equal((await api('/api/features/F102/recommend', 'POST', { feedback: 'Try a simpler flow.' }, token)).status, 200);
  const recommended = readFileSync(recommendationPath, 'utf8');
  assert.match(recommended, /\*\*Status:\*\* Needs revision/);
  assert.match(recommended, /## Review feedback\n\n> Try a simpler flow\./);
  assert.match(readFileSync(indexPath, 'utf8'), /F102.*\| Needs revision \|/);
  assert.equal((await api('/api/features/F102/approve', 'POST', { answers: [] }, token)).status, 409);
  assert.equal((await api('/api/features/F102/recommend', 'POST', { feedback: 'Again' }, token)).status, 409);

  assert.equal((await api('/api/categories', 'POST', { name: 'Projects' }, token)).status, 201);
  assert.equal((await api('/api/categories/projects/schedule', 'POST', { action: 'start', intervalMinutes: 30, featuresPerRun: 2 }, token)).status, 200);
  assert.equal((await api('/api/state')).data.categories.find((category) => category.slug === 'projects').enabled, true);
  assert.equal((await api('/api/categories/projects/schedule', 'POST', { action: 'pause' }, token)).status, 200);
  assert.equal((await api('/api/state')).data.categories.find((category) => category.slug === 'projects').enabled, false);
  console.log('Control center API smoke test passed.');
} finally {
  child.kill('SIGTERM');
  await delay(100);
  rmSync(fixture, { recursive: true, force: true });
}
