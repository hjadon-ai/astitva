import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const POLICY_VERSION = 1;
export const TIMEZONE = 'America/Los_Angeles';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const issue = (code, message, extra = {}) => ({ code, message, ...extra });
export function validApprovalTime(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) > now.getTime()) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export const fault = (status, code, message) => Object.assign(new Error(message), { status, code });

export function plannedSchedule(now = new Date()) {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const slots = { implementation: [], quality: [] };
  const base = Math.floor(now.getTime() / 3600000) * 3600000;
  for (let offset = -48; offset <= 48; offset++) {
    const instant = new Date(base + offset * 3600000);
    const parts = Object.fromEntries(format.formatToParts(instant).map(p => [p.type, p.value]));
    const time = `${parts.hour}:${parts.minute}`;
    const kind = ['00:00', '04:00', '12:00', '16:00'].includes(time) ? 'implementation' : time === '08:00' ? 'quality' : null;
    if (kind) slots[kind].push({ at: instant.toISOString(), key: `${parts.year}-${parts.month}-${parts.day}/${kind}/${time}/${TIMEZONE}` });
  }
  const previous = kind => slots[kind].filter(slot => Date.parse(slot.at) <= now.getTime()).at(-1);
  const next = kind => slots[kind].find(slot => Date.parse(slot.at) > now.getTime());
  return { enabled: false, implementationTimes: ['00:00', '04:00', '12:00', '16:00'], qualityTime: '08:00', previousImplementationAt: previous('implementation').at, nextImplementationAt: next('implementation').at, previousQualityAt: previous('quality').at, nextQualityAt: next('quality').at, nextImplementationSlot: next('implementation').key, nextQualitySlot: next('quality').key };
}

// Approval/lifecycle metadata is separate from the scope checkpoint fingerprint.
export function scopeHash(text) {
  return hash(text.replace(/^- \*\*(?:Status|Branch|Pull request|Priority|Approved at|Depends on):\*\*.*\r?\n/gm, '').trim());
}

function safeRead(root, name) {
  const full = resolve(root, name);
  if (full !== root && !full.startsWith(root + sep)) throw fault(503, 'unsafe_source', 'A source path escapes the repository.');
  let cursor = root;
  for (const segment of relative(root, full).split(sep)) {
    cursor = join(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw fault(503, 'unsafe_source', 'Symlinked source paths are not allowed.');
  }
  if (!lstatSync(full).isFile() || lstatSync(full).size > 524288) throw fault(503, 'unsafe_source', 'A source file is invalid or too large.');
  return readFileSync(full, 'utf8');
}

export function workflowIssues(instructions) {
  const findings = [];
  for (const [file, text] of Object.entries(instructions)) {
    let fenced = false;
    text.split(/\r?\n/).forEach((line, index) => {
      if (line.startsWith('```')) { fenced = !fenced; return; }
      if (fenced) return;
      const value = line.trim();
      if (!value || value.startsWith('|') || value.startsWith('#')) return; // Historical index rows are records, not workflow rules.
      const conflict = /feature\/(?:changes_|\{date\})|one active (?:work )?branch|same active work branch|keep the same active branch/i.test(value) || /mark.*(?:implemented|implementation).*Done|mark.*Done.*same work|Done.*implementation exists|Done means.*implementation|implementation-time Done/i.test(value);
      const unsafe = !/\b(?:never|not|no|manual|owner|user)\b/i.test(value) && /automatically.*(?:merge|push.*main)|auto.?merge/i.test(value);
      const ambiguous = /^(?:- |\d+\. )/.test(value) && /(?:name|create|use|keep|mark|push|merge).*(?:branch|Done|main)/i.test(value) && !conflict && !unsafe && !/(?:feature\/F###|feature\/{date}|record|recorded|owner|user|manual|never|not|after.*merge|then mark|approved|future)/i.test(value);
      if (conflict || unsafe || ambiguous) findings.push(issue(conflict || unsafe ? 'workflow_conflict' : 'workflow_ambiguous', 'Reconcile this workflow rule with per-feature branches and owner-only completion before selection.', { file, line: index + 1, rule: value.slice(0, 350) }));
    });
  }
  return findings;
}

export function readSource(repoRoot) {
  const root = realpathSync(repoRoot);
  const files = {};
  const read = name => { if (!(name in files)) files[name] = safeRead(root, name); return files[name]; };
  try {
    const index = read('docs/features/README.md');
    const instructions = {};
    for (const name of ['AGENTS.md', 'README.md', 'docs/INSTRUCTIONS.md', 'docs/AGENTS.md', 'docs/features/INSTRUCTIONS.md', 'docs/features/AGENTS.md', 'docs/features/WORKFLOW.md', 'chatgpt-project/PROJECT_INSTRUCTIONS.md']) {
      if (existsSync(join(root, name))) instructions[name] = read(name);
    }
    instructions['docs/features/README.md'] = index;
    const sourceIssues = [];
    const features = [];
    for (const line of index.split(/\r?\n/)) {
      if (!/^\|\s*F\d+\s*\|/.test(line)) continue;
      const row = line.match(/^\|\s*(F\d{3})\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+)\|/);
      if (!row) { sourceIssues.push(issue('invalid_index_row', 'Correct a malformed feature index row.')); continue; }
      const [, id, title, path, status] = row;
      const feature = { id, title, path, status: status.trim(), documentStatus: null, priority: null, approvedAt: null, dependsOn: null, reasons: [], scopeHash: null };
      features.push(feature);
      if (!/^[a-z][a-z0-9-]*\/F\d{3}(?:-[a-z0-9-]+)?\.md$/.test(path) || !path.split('/').at(-1).startsWith(id)) {
        sourceIssues.push(issue('unsafe_feature_path', 'Correct the feature path; only category feature Markdown is allowed.', { featureId: id })); continue;
      }
      const name = `docs/features/${path}`;
      if (!existsSync(join(root, name))) { sourceIssues.push(issue('missing_feature_document', 'Restore the indexed feature document.', { featureId: id })); continue; }
      const content = read(name);
      feature.scopeHash = scopeHash(content);
      const metadata = label => {
        const matches = [...content.matchAll(new RegExp(`^- \\*\\*${label}:\\*\\* (.+)$`, 'gm'))];
        if (matches.length > 1) feature.reasons.push(issue('duplicate_metadata', `Correct duplicate ${label} fields.`));
        return matches.length === 1 ? matches[0][1].trim() : null;
      };
      feature.documentStatus = metadata('Status');
      feature.priority = metadata('Priority');
      feature.approvedAt = metadata('Approved at');
      const dependencies = metadata('Depends on');
      feature.dependsOn = dependencies === 'None' ? [] : dependencies && /^F\d{3}(?:\s*,\s*F\d{3})*$/.test(dependencies) ? dependencies.split(/\s*,\s*/) : null;
      if (feature.status !== feature.documentStatus) sourceIssues.push(issue('status_mismatch', 'Make the index and document status agree.', { featureId: id, file: name }));
      if (!['Proposed', 'Approved', 'In Progress', 'Review', 'Blocked', 'Done', 'Needs revision'].includes(feature.status)) sourceIssues.push(issue('unknown_status', 'Resolve an unknown feature status.', { featureId: id }));
      for (const instruction of ['INSTRUCTIONS.md', 'AGENTS.md']) {
        const nested = `${dirname(name)}/${instruction}`;
        if (existsSync(join(root, nested))) instructions[nested] = read(nested);
      }
    }
    for (const feature of features) if (features.filter(f => f.id === feature.id).length > 1) sourceIssues.push(issue('duplicate_feature_id', 'Resolve duplicate feature IDs.', { featureId: feature.id }));
    const fingerprints = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => [name, hash(text)]));
    return { features, issues: [...sourceIssues, ...workflowIssues(instructions)], fingerprints, fingerprint: hash(JSON.stringify(fingerprints)) };
  } catch (cause) {
    if (cause.status) throw cause;
    throw fault(503, 'source_unavailable', 'Planning source is unreadable. Check local feature documents and permissions.');
  }
}

export function selectFeature(source, state, now = new Date()) {
  const features = structuredClone(source.features);
  const requiredHumanActions = [...source.issues];
  const byId = new Map(features.map(f => [f.id, f]));
  const reaches = (current, target, seen = new Set()) => {
    if (seen.has(current)) return false;
    seen.add(current);
    return (byId.get(current)?.dependsOn || []).some(id => id === target || reaches(id, target, seen));
  };
  const activeJobs = state.jobs.filter(job => ['In Progress', 'running', 'waiting'].includes(job.status));
  for (const feature of features) {
    const reasons = feature.reasons;
    if (['Approved', 'In Progress'].includes(feature.status)) {
      if (!['High', 'Medium', 'Low'].includes(feature.priority)) reasons.push(issue('priority_required', 'Set Priority to High, Medium or Low.'));
      if (!validApprovalTime(feature.approvedAt, now)) reasons.push(issue('approval_metadata_required', 'Record a valid, explicit Approved at timestamp.'));
      if (feature.dependsOn === null) reasons.push(issue('dependencies_required', 'Declare Depends on: None or explicit feature IDs.'));
    }
    for (const id of feature.dependsOn || []) {
      const dep = byId.get(id);
      if (id === feature.id || reaches(id, feature.id)) reasons.push(issue('dependency_cycle', 'Resolve the dependency cycle.', { featureId: id }));
      else if (!dep) reasons.push(issue('dependency_missing', 'Correct the missing dependency.', { featureId: id }));
      else if (dep.status !== 'Done' || dep.documentStatus !== 'Done') reasons.push(issue('dependency_unfinished', `Wait for ${id} to reach Done.`, { featureId: id }));
    }
    feature.eligibility = feature.status === 'Approved' && reasons.length === 0 && feature.documentStatus === 'Approved' ? 'eligible' : ['Approved', 'In Progress'].includes(feature.status) ? 'blocked' : 'ineligible';
    for (const reason of reasons) requiredHumanActions.push({ ...reason, forFeatureId: feature.id });
  }
  const active = features.filter(f => f.status === 'In Progress' || f.documentStatus === 'In Progress');
  let decision = { action: 'none', featureId: null, reasonCodes: ['no_eligible_work'], explanation: 'No eligible Approved work.' };
  const block = (reason, featureId = null) => { decision = { action: 'blocked', featureId, reasonCodes: [reason], explanation: 'Human action is required before work can be selected.' }; };
  if (source.issues.length) block('source_or_workflow_conflict');
  else if (active.length > 1) { requiredHumanActions.push(issue('multiple_in_progress', 'Reconcile multiple In Progress features before selecting work.')); block('multiple_in_progress'); }
  else if (activeJobs.length > 1 || (activeJobs.length === 1 && activeJobs[0].jobId !== state.activeJob?.jobId)) { requiredHumanActions.push(issue('checkpoint_ownership_conflict', 'Reconcile multiple persisted active jobs.')); block('checkpoint_ownership_conflict'); }
  else if (state.activeJob && (!active.length || state.activeJob.featureId !== active[0].id)) { requiredHumanActions.push(issue('checkpoint_ownership_conflict', 'Reconcile persisted job ownership with feature status.')); block('checkpoint_ownership_conflict'); }
  else if (active.length === 1) {
    const feature = active[0];
    const job = state.activeJob;
    const checkpoint = state.checkpoints.find(c => c.checkpointId === job?.latestCheckpointId);
    const valid = job && checkpoint && checkpoint.jobId === job.jobId && checkpoint.featureId === feature.id && job.approvedScopeHash === feature.scopeHash && checkpoint.approvedScopeHash === feature.scopeHash && checkpoint.phase && /^[0-9a-f]{40}$/.test(checkpoint.headCommit || '') && (!job.headCommit || job.headCommit === checkpoint.headCommit) && checkpoint.sessionId;
    if (feature.reasons.length || !valid) {
      requiredHumanActions.push(issue('resume_checkpoint_required', `Recover/checkpoint unfinished work for ${feature.id}; do not start another feature.`, { forFeatureId: feature.id }));
      block('resume_checkpoint_required', feature.id);
    } else { feature.eligibility = 'would_resume'; decision = { action: 'would_resume', featureId: feature.id, reasonCodes: ['unfinished_work_first'], explanation: 'Unfinished In Progress work takes precedence over Approved features.' }; }
  } else {
    const rank = { High: 0, Medium: 1, Low: 2 };
    const candidate = features.filter(f => f.eligibility === 'eligible').sort((a, b) => rank[a.priority] - rank[b.priority] || Date.parse(a.approvedAt) - Date.parse(b.approvedAt) || Number(a.id.slice(1)) - Number(b.id.slice(1)))[0];
    if (candidate) decision = { action: 'would_start', featureId: candidate.id, reasonCodes: ['highest_priority', 'oldest_approval', 'feature_id_tie_break'], explanation: `${candidate.priority}: highest priority among eligible features; oldest approval breaks equal-priority ties, then feature ID.` };
  }
  return { decision, features, requiredHumanActions, resumeFeatureId: active.length === 1 ? active[0].id : null };
}
