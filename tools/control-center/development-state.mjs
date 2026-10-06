import { randomUUID } from 'node:crypto';
import { accessSync, closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { fault, issue, plannedSchedule, POLICY_VERSION, readSource, selectFeature, TIMEZONE } from './development-planner.mjs';

export function emptyState() {
  return { schemaVersion: 1, revision: 0, policyVersion: POLICY_VERSION, timezone: TIMEZONE, schedule: { enabled: false, implementationTimes: ['00:00', '04:00', '12:00', '16:00'], qualityTime: '08:00' }, lastEvaluationId: null, activeJob: null, evaluations: [], jobs: [], checkpoints: [], events: [], lease: null };
}

export class DevelopmentStore {
  constructor(dataRoot) {
    this.root = realpathSync(dataRoot);
    this.path = join(this.root, 'development-state.json');
    this.lock = join(this.root, 'development-state.lock');
  }
  read() {
    try {
      if (!existsSync(this.path)) return emptyState();
      const stat = lstatSync(this.path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024 * 1024) throw new Error();
      const state = JSON.parse(readFileSync(this.path, 'utf8'));
      if (state.schemaVersion !== 1 || state.policyVersion !== POLICY_VERSION || state.timezone !== TIMEZONE || !Number.isSafeInteger(state.revision) || state.revision < 0 || state.schedule?.enabled !== false || !['evaluations', 'jobs', 'checkpoints', 'events'].every(key => Array.isArray(state[key])) || state.evaluations.length > 100 || !('lastEvaluationId' in state) || !('activeJob' in state) || state.lease !== null) throw new Error();
      if (state.activeJob !== null && (typeof state.activeJob !== 'object' || !/^F\d{3}$/.test(state.activeJob.featureId || ''))) throw new Error();
      if (state.jobs.some(job => !job || typeof job !== 'object' || typeof job.jobId !== 'string' || !/^F\d{3}$/.test(job.featureId || '')) || state.checkpoints.some(cp => !cp || typeof cp !== 'object' || typeof cp.checkpointId !== 'string' || !/^F\d{3}$/.test(cp.featureId || ''))) throw new Error();
      const ids = new Set();
      for (const run of state.evaluations) {
        if (!validRunId(run.runId) || ids.has(run.runId) || run.kind !== 'dry-run' || run.trigger !== 'manual' || !Number.isFinite(Date.parse(run.evaluatedAt)) || !['would_start', 'would_resume', 'none', 'blocked'].includes(run.decision?.action) || !Array.isArray(run.features) || !Array.isArray(run.requiredHumanActions) || typeof run.sourceFingerprint !== 'string' || run.features.some(f => !f || !/^F\d{3}$/.test(f.id || ''))) throw new Error();
        ids.add(run.runId);
      }
      if (state.lastEvaluationId !== null && state.lastEvaluationId !== state.evaluations[0]?.runId) throw new Error();
      return state;
    } catch {
      throw fault(503, 'state_unavailable', 'Planning state is corrupt, unsupported or unreadable. Preserve it and restore a verified local backup; do not reset it.');
    }
  }
  assertWritable() {
    try {
      accessSync(this.root, constants.W_OK);
      if (!(lstatSync(this.root).mode & 0o200)) throw new Error();
      if (existsSync(this.path)) {
        const stat = lstatSync(this.path);
        if (!stat.isFile() || stat.isSymbolicLink() || !(stat.mode & 0o200)) throw new Error();
        accessSync(this.path, constants.W_OK);
      }
    } catch { throw fault(503, 'state_not_writable', 'Planning state is not writable. Check owner permissions.'); }
  }
  acquire() {
    this.assertWritable();
    try { mkdirSync(this.lock, { mode: 0o700 }); }
    catch (cause) {
      if (cause.code === 'EEXIST') throw fault(409, 'evaluation_busy', 'Another evaluation or an abandoned writer guard exists. Confirm the recorded process is stopped before removing an abandoned guard.');
      throw fault(503, 'state_not_writable', 'Cannot acquire the local planning writer guard.');
    }
    const owner = randomUUID();
    try { writeFileSync(join(this.lock, 'owner.json'), JSON.stringify({ pid: process.pid, owner, createdAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' }); }
    catch { rmSync(this.lock, { recursive: true }); throw fault(503, 'state_not_writable', 'Cannot persist the writer guard.'); }
    return () => {
      // Only this process's guard may be released. Never reclaim a guard on age alone.
      try {
        const recorded = JSON.parse(readFileSync(join(this.lock, 'owner.json'), 'utf8'));
        if (recorded.owner === owner) rmSync(this.lock, { recursive: true });
      } catch { /* An ambiguous guard requires owner recovery. */ }
    };
  }
  save(state) {
    this.assertWritable();
    const temporary = join(this.root, `development-state.${randomUUID()}.tmp`);
    let fd;
    try {
      fd = openSync(temporary, 'wx', 0o600);
      writeFileSync(fd, JSON.stringify(state, null, 2) + '\n');
      fsyncSync(fd); closeSync(fd); fd = undefined;
      renameSync(temporary, this.path);
    } catch {
      throw fault(503, 'state_not_writable', 'Cannot persist planning state; the previous snapshot has been preserved.');
    } finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(temporary)) rmSync(temporary);
    }
  }
}
export const validRunId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
const summary = run => ({ runId: run.runId, kind: run.kind, evaluatedAt: run.evaluatedAt, outcome: run.outcome, decision: run.decision });

export function createDevelopment({ repoRoot, dataRoot, clock = () => new Date(), sourceReader = readSource }) {
  const store = new DevelopmentStore(dataRoot);
  const current = () => {
    const state = store.read();
    const source = sourceReader(repoRoot);
    const plan = selectFeature(source, state, clock());
    const last = state.evaluations[0] || null;
    return { state, source, plan, last };
  };
  return {
    store,
    state() {
      const now = clock();
      const base = { mode: 'dry-run', executionEnabled: false, timezone: TIMEZONE, schedule: plannedSchedule(now), agents: 'not_run', tests: 'not_run' };
      try {
        const { state, source, plan, last } = current();
        let health = { status: plan.decision.action === 'blocked' ? 'blocked' : 'healthy', reasons: plan.requiredHumanActions };
        try { store.assertWritable(); } catch (cause) { health = { status: 'degraded', reasons: [issue(cause.code, cause.message)] }; }
        if (existsSync(store.lock)) health = { status: 'blocked', reasons: [...health.reasons, issue('evaluation_busy', 'Writer guard present; check for an active evaluation or recover an abandoned guard safely.')] };
        return { ...base, health, revision: state.revision, lastEvaluation: last ? summary(last) : null, stale: last ? last.sourceFingerprint !== source.fingerprint || now - new Date(last.evaluatedAt) > 86400000 : true, activeFeatureId: state.activeJob?.featureId || plan.resumeFeatureId, currentPlan: plan, requiredHumanActions: [...plan.requiredHumanActions, ...health.reasons.filter(r => !plan.requiredHumanActions.includes(r))] };
      } catch (cause) {
        return { ...base, health: { status: 'degraded', reasons: [issue(cause.code || 'source_unavailable', cause.message)] }, lastEvaluation: null, activeFeatureId: null, stale: true, currentPlan: { decision: { action: 'blocked', featureId: null, explanation: 'Planning is unavailable; human action is required.' }, features: [], requiredHumanActions: [] }, requiredHumanActions: [issue(cause.code || 'source_unavailable', cause.message)] };
      }
    },
    async evaluate(body) {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw fault(400, 'invalid_request', 'Evaluation accepts only an empty JSON object.');
      const release = store.acquire();
      try {
        const startedAt = clock().toISOString();
        const { state, source, plan } = current();
        await setImmediate(); // Allow concurrent requests to observe the exclusive guard.
        if (sourceReader(repoRoot).fingerprint !== source.fingerprint) throw fault(409, 'source_changed', 'Planning source changed during evaluation. Read the documents again and retry.');
        const evaluatedAt = clock().toISOString();
        const run = { runId: randomUUID(), kind: 'dry-run', trigger: 'manual', startedAt, evaluatedAt, completedAt: evaluatedAt, outcome: plan.decision.action === 'blocked' ? 'blocked' : 'planned', ...plan, sourceFingerprint: source.fingerprint, sourceFingerprints: source.fingerprints, policyVersion: POLICY_VERSION, schedule: plannedSchedule(new Date(evaluatedAt)) };
        state.revision++;
        state.lastEvaluationId = run.runId;
        state.evaluations = [run, ...state.evaluations].slice(0, 100);
        state.events = [{ runId: run.runId, at: evaluatedAt, actor: 'owner', reason: 'manual_dry_run' }, ...state.events].slice(0, 100);
        store.save(state);
        return run;
      } finally { release(); }
    },
    history(params) {
      const raw = params.get('limit');
      if ([...params.keys()].some(key => !['limit', 'before'].includes(key)) || (raw !== null && !/^(?:[1-9]|[1-4]\d|50)$/.test(raw))) throw fault(400, 'invalid_pagination', 'Use an integer limit from 1 to 50.');
      let runs = [...store.read().evaluations].sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt) || b.runId.localeCompare(a.runId));
      const before = params.get('before');
      if (before !== null) {
        if (!validRunId(before)) throw fault(400, 'invalid_cursor', 'Invalid evaluation cursor.');
        const offset = runs.findIndex(run => run.runId === before);
        if (offset < 0) throw fault(400, 'expired_cursor', 'Cursor is no longer retained; reload history from the first page.');
        runs = runs.slice(offset + 1);
      }
      const limit = raw === null ? 20 : Number(raw);
      const page = runs.slice(0, limit);
      return { evaluations: page.map(summary), nextCursor: runs.length > limit ? page.at(-1).runId : null };
    },
    detail(id) {
      if (!validRunId(id)) throw fault(400, 'invalid_run_id', 'Invalid evaluation ID.');
      const run = store.read().evaluations.find(r => r.runId === id);
      if (!run) throw fault(404, 'evaluation_not_found', 'Evaluation not found.');
      return run;
    }
  };
}
