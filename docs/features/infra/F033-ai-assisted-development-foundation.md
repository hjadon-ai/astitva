# F033: AI-assisted development foundation and Development Control Center

- **Status:** Done
- **Branch:** `feature/F033-ai-assisted-development-foundation`
- **Pull request:** Not created

## Goal

Give the product owner a trustworthy local view of which Approved feature would run next, why it would run, what prevents other work from starting, and whether unfinished work would be resumed. Establish a persistent planning and run model before granting AI agents implementation or Git permissions.

The first milestone is READ-ONLY / DRY-RUN with respect to repository documents, application data, Git, and external systems. An explicit evaluation may write only ignored local planning state. It never executes the plan. The owner remains the scope approval authority, final reviewer, and the only person who can move reviewed work to Done.

## Existing implementation and constraints

The existing Control Center is a separate, dependency-free Node HTTP server and plain JavaScript page in tracked `tools/control-center/`, bound to `127.0.0.1:4318`. It reads feature Markdown/index rows, displays categories, and provides explicit owner approval and recommendation actions. Per-category timers generate Proposed documents using Codex; settings and pending proposal IDs persist in ignored `settings.json`, but the single running-job guard is in memory.

There is no existing indexed implementation-automation feature. F033 extends this local tool without moving developer controls into the hosted React/Express product. React, Express, MongoDB, existing application features, hosting, and integration boundaries remain unchanged.

Owner-approved corrections reconcile applicable rules to one feature at a time on `feature/F###-short-name`, Approved → In Progress → Review, and owner-confirmed Done after manual review/merge. Historical branch names and Done records remain unchanged. Any new unresolved conflict blocks dry-run selection with an explicit human action.

Source, tests, synthetic fixtures, UI/assets, OpenAPI, Postman and README are tracked in `tools/control-center/`. Runtime settings, history, jobs/checkpoints, locks, logs, temporary files and machine configuration stay ignored under `.local/control-center/`; existing state is preserved. Node `>=22.20.0 <25`, without external dependencies.

Current product worktree changes, including F032, are unrelated and must remain untouched.

## User flow

1. The owner opens the local Control Center and selects Development, beside the existing category navigation.
2. The page shows Dry run only, execution disabled, the last recorded evaluation, and planned implementation/quality times.
3. The owner selects Evaluate dry run. The server reads the feature index/documents and creates one local planning result.
4. The owner sees Resume F###, Next candidate F###, No eligible work, or Human action required, with ordering reasons and blockers.
5. The owner opens a feature's existing read-only document view, reviews missing metadata/dependencies, and edits the authoritative document manually when needed.
6. After another evaluation, the owner compares the latest decision with earlier evaluations. No status, branch, code, or Git operation is changed.

## Wireframe or UI changes

```text
Astitva Development Control Center           [Dry run only]
Categories | Development                    [Evaluate dry run]

Execution disabled • Planning healthy • Evaluated 2 minutes ago

What would AI work on next?
F### Feature title / Resume F### / No eligible work

Why was it selected?
Highest eligible priority; oldest approval among equal priorities
Unfinished In Progress work takes precedence

When is the next planned automation window?
12:00 PM Pacific • planned only, execution disabled

What is blocked and why?
F### • dependency F### is not Done / workflow conflict

What requires my action?
Missing metadata / inconsistent status / recover unfinished work

Implementation planned: 00:00, 04:00, 12:00, 16:00 Pacific
Quality planned: 08:00 Pacific • tests not run
Last evaluation: timestamp | Next planned slot: timestamp
Scheduling not enabled

[All] [Approved] [In Progress] [Blocked] [Review] [Other]
ID    Feature      Status       Priority  Dependencies  Decision / reason
F###  Example      Approved     High      None          Next candidate
F###  Example      Approved     Medium    F###          Dependency unfinished
F###  Example      In Progress  High      None          Would resume / needs checkpoint

Required human actions
• Add approvedAt to F###; no approval date was inferred.
• Resolve index/document disagreement for F###.

Recent evaluations
Time | Start / Resume / None / Blocked | Feature | Explanation
[Open evaluation details]
```

Use the current light surfaces, system font, blue action buttons, compact labelled badges, and restrained borders. Keep categories and the Markdown review dialog. Add a Development view and a Blocked badge, not a new application shell or animated dashboard. Use text with color for status, visible keyboard focus, announced evaluation results, and stacked mobile rows at 320px without horizontal page scrolling.

Distinguish feature status from planning eligibility: a dependency-blocked Approved feature remains Approved. An unsafe dry-run decision is blocked; it does not rewrite the feature to Blocked. Future authorized execution will persist an actual Blocked transition and reason.

## In scope

- Pure deterministic document parsing, validation, dependency analysis, and selection.
- Read-only current status, priority, approval metadata, dependency, resume, and blocker display.
- Manual evaluation and local persisted history with restart recovery.
- Planned schedule calculations with Pacific timezone and UTC instants.
- Automation health, freshness, stale/corrupt-state warnings, and required human actions.
- Versioned durable state with reserved execution/checkpoint fields.
- Draft local REST contract, disposable-fixture tests, and a simple Control Center presentation.
- Implementation-time documentation of this tool's API and recovery behaviour, without changing product APIs.

## Out of scope

- Automatic Codex invocation, implementation, validation agents, tests, or bug fixing.
- Automatic feature/document/status/metadata writes from evaluation.
- Branch/worktree creation or modification, Git commits/pushes/fetches, PR creation, merges, deployment, or GitHub API calls.
- Active implementation or quality scheduling, LaunchAgent installation, or background catch-up execution.
- New bug-management UI, notifications, billing changes, or purchases.
- Automatic backfilling of historical approval dates or alteration of historical Done records.
- Product React/Express changes, new MongoDB collections, production access, or a full Control Center rewrite.
- Changes to existing category scheduler settings, Codex invocation, proposal approval behaviour, or activation of paused schedules.

Existing proposal-generation controls remain separately labelled and retain their current behaviour. F033 does not activate them or route Development evaluation to their Codex endpoint.

## API changes

Draft endpoints belong to the local Control Center on port 4318, not the product Express server. GET requests do not persist state. POST evaluation requires the existing local origin/control-token checks and application/json. Examples below use fictional fixture IDs and dates, not real approval records.

### GET /api/development/state

Request: no body.

200 example:

```json
{
  "mode": "dry-run",
  "executionEnabled": false,
  "health": {"status": "healthy", "reasons": []},
  "timezone": "America/Los_Angeles",
  "schedule": {
    "enabled": false,
    "implementationTimes": ["00:00", "04:00", "12:00", "16:00"],
    "qualityTime": "08:00",
    "nextImplementationAt": "2026-10-05T19:00:00Z",
    "nextQualityAt": "2026-10-06T15:00:00Z"
  },
  "lastEvaluation": null,
  "activeFeatureId": null,
  "requiredHumanActions": []
}
```

Last planned slot and next planned slots are returned separately from actual evaluation times. Null is shown as Never evaluated / No execution recorded, not as a completed run.

### POST /api/development/evaluations

Request body: `{}`. Do not accept client-supplied feature status, approval time, clock override, executable, repository path, or branch operation.

201 example:

```json
{
  "runId": "local-unique-id",
  "kind": "dry-run",
  "outcome": "planned",
  "evaluatedAt": "2026-10-05T18:30:00Z",
  "decision": {
    "action": "would_start",
    "featureId": "F101",
    "reasonCodes": ["highest_priority", "oldest_approval"]
  },
  "features": [
    {
      "id": "F101",
      "status": "Approved",
      "priority": "High",
      "approvedAt": "2026-10-01T16:00:00Z",
      "dependsOn": [],
      "eligibility": "eligible",
      "reasons": []
    },
    {
      "id": "F102",
      "status": "Approved",
      "priority": "Medium",
      "approvedAt": "2026-10-02T16:00:00Z",
      "dependsOn": ["F103"],
      "eligibility": "blocked",
      "reasons": [{"code": "dependency_unfinished", "featureId": "F103"}]
    }
  ],
  "requiredHumanActions": []
}
```

Decision actions: `would_start`, `would_resume`, `none`, `blocked`. A blocked/empty queue is a successful evaluation with explicit reasons, not an HTTP server failure. Repeating evaluation records a fresh observation, never claims or executes work.

### GET /api/development/evaluations?limit=20&before=<opaque-cursor>

200: `{"evaluations": [], "nextCursor": null}`. Default 20; integer limit 1–50; newest first with stable run-ID tie-break; cursor pagination. Return summaries without full logs.

### GET /api/development/evaluations/:runId

200: full planning result, source fingerprint, schedule snapshot, blocker details, and required human actions. Never return secrets, control tokens, arbitrary file contents, or absolute filesystem paths.

### Important errors

- 400: invalid JSON, unknown POST fields, invalid limit/cursor/run ID.
- 403: invalid host/origin/control token.
- 404: unknown evaluation.
- 409: concurrent evaluation or source changed during evaluation; reread before retry.
- 413/415: existing body-size/content-type protections.
- 503: unreadable source or corrupt/unsupported/unwritable state; return a safe reason and human action without resetting state.
- 500: unexpected error; sanitized response and local diagnostic record.

GET state should expose degraded health when safely readable; unavailable storage must never be reported as healthy. No start/commit/push/merge/fix endpoint exists in F033.

## MongoDB changes

None recommended for F033. Do not add automation collections to Dev, Stage, or Atlas or use application login/data for developer control.

Persist the small single-process planning store in ignored `.local/control-center/development-state.json`, separate from existing scheduler settings. This reuses the current atomic-file pattern and avoids a database dependency for the Control Center. Keep persistence behind a repository-independent adapter so a later, separately approved local MongoDB or SQLite migration can preserve the same versioned records if multiple writers or volume justify it.

No OpenAPI, Postman, model, or product collection file changes occur at proposal time.

## Scheduling design

Use America/Los_Angeles, including daylight-saving changes; store instants as UTC ISO-8601 values and display timezone-labelled local times. Planned implementation slots are 00:00, 04:00, 12:00, 16:00; daily quality is 08:00.

F033 calculates previous/next slots when reading/evaluating. It installs no timer or OS job for execution, creates no synthetic completed runs, and never invokes agents at a planned time. Closing Control Center does not falsely imply a scheduler is active. Display stale evaluations independently of planned times.

Reserve unique schedule-slot keys consisting of local date, job kind, slot time, and timezone. Later scheduled execution must record missed/coalesced slots, avoid duplicate execution after restart/wake, and serialize work. A future local LaunchAgent can trigger a lightweight worker; machine sleep/offline limitations must remain visible. Scheduler activation requires separate approval.

## Feature-selection algorithm

Proposed document metadata, to be adopted by owner edits or a separately authorized approval-flow enhancement:

```text
- **Priority:** High
- **Approved at:** 2026-10-01T16:00:00Z
- **Depends on:** None
```

Map these fields to `priority`, `approvedAt`, and `dependsOn` in API/state. Priority order: High, Medium, Low. An Approved feature missing valid priority or approval metadata is ineligible and requires human action; eligible features may still be ranked unless an independent workflow/source conflict blocks selection. The rationale always says highest priority among eligible features, not among every feature in the repository. Dependencies are explicit F### IDs; None explicitly means an empty list. Require a valid timezone-qualified approval instant no later than evaluation time. Do not infer approval from Git history, filesystem dates, index order, or missing fields.

1. Read the index and referenced documents and the applicable workflow instructions (root AGENTS.md, README.md, docs/INSTRUCTIONS.md, feature README/WORKFLOW, and relevant nested instructions). Detect duplicate IDs, missing files, invalid paths, index/document status mismatches, malformed metadata, unknown/self dependencies, and cycles. If workflow rules conflict or cannot be safely interpreted, return a blocked decision with the conflicting rule/file references and the required owner action; do not select a feature or rewrite instructions. Include instruction fingerprints in source consistency checks.
2. A declared dependency is finished when its document and index both say Done, including historical Done features. No additional completion-provenance review or migration is required. Missing or disagreeing dependency records remain blockers. This does not authorize agents to mark future work Done; that remains owner-only.
3. If multiple In Progress features or conflicting active checkpoint ownership exist, return blocked with a reconciliation action; select nothing.
4. If exactly one In Progress feature exists, reserve it ahead of every Approved feature. Return would_resume only when the persisted scope/checkpoint and declared dependencies are consistent. If state is missing or changed, return blocked with “recover/checkpoint unfinished work”; never start another feature. This version only reports resume intent.
5. Otherwise consider only matching Approved documents with valid priority, approvedAt, and dependencies. Proposed, Needs revision, Review, Blocked, Done, and unknown statuses are ineligible.
6. Exclude unfinished/missing/cyclic dependencies and show reasons.
7. Choose highest priority, then oldest approvedAt, then lowest numeric feature ID for an exact tie. Show the complete rationale.
8. Missing or invalid priority/approval metadata excludes that Approved feature and creates a human action; it does not by itself prevent selection of another eligible feature. Dependency-blocked work likewise does not block independent eligible work. Duplicate identity, inconsistent authoritative source, or unresolved workflow conflict blocks selection. Explain any excluded higher/unknown-priority work without inventing metadata.
9. Recheck source fingerprints before saving. If changed during evaluation, discard the result and return 409.

Never mutate eligibility into feature status. The owner can correct documents manually, then evaluate again. An Approved feature with no valid approval timestamp remains visibly Approved but cannot be selected.

## Persistent run/checkpoint model

Use schemaVersion 1, a monotonic state revision, and stable IDs. The file is an operational cache/audit store; documents remain authoritative for scope and approval. Record document/index hashes and a normalized approved-scope fingerprint separately from lifecycle fields, so later status changes do not look like scope changes.

- **Root:** schemaVersion, revision, policyVersion, timezone, disabled schedule configuration, lastEvaluationId, activeJob (null initially), evaluations, jobs, checkpoints, and events.
- **Evaluation:** runId, kind=dry-run, trigger=manual, start/end, outcome, source/policy fingerprints, schedule snapshot, decision, feature assessments, human actions. No agent or test success is fabricated.
- **Future job:** jobId, featureId, approvedAt, approvedScopeHash, phase, status, branch, worktree reference, base/head commit, latestCheckpointId, retryCount, retryAfter, blockedReason.
- **Future run:** responsibility (orchestrator/implementation/validation/quality), sessionId, start/end/heartbeat, outcome, error category, usage summary, artifact references, schedule-slot key.
- **Future checkpoint:** feature/job ID, scope hash, phase, completed/remaining steps, HEAD, dirty-diff fingerprint, sessionId, test/validation evidence references.
- **Future lease:** holder identity, generation, heartbeat, expiry. Do not activate a worker lease in F033; later execution must verify the former process has stopped before takeover.
- **Events:** state transition/evaluation IDs, UTC timestamp, actor, reason. Reserve links to future bug/test records rather than implementing those systems.

Only planning records are populated in F033. Future fields are null/empty and must not claim execution. Unfinished execution will remain In Progress; usage/time limits are resumable waiting reasons. Unsafe execution will become Blocked without AI improvisation.

Serialize writes in one process; use an exclusive writer guard across processes. Write the entire next state to an owner-readable temporary file, flush it, and atomically replace the prior snapshot. Release the guard only after persistence. Fail safely on corrupt JSON or unknown schema versions; do not replace with defaults. Recover an abandoned guard only after confirming its owning process is absent; never merely on elapsed time.

Keep the latest 100 dry-run evaluations with bounded summaries and no raw AI transcripts. Do not prune active jobs/checkpoints or referenced execution evidence in future phases. Versioned adapter migrations must preserve identity and state; backup/recovery is local and explicit.

## Architecture decisions

Owner decisions recorded for proposal review (approved scope):

- Extend the existing local Node/plain-JavaScript Control Center for F033. Reuse its safety checks and visual patterns; do not couple developer filesystem access to the hosted product.
- Use a pure selector plus timezone planner, a persistence adapter, and small local REST handlers. No AI is needed to calculate selection.
- Use versioned local-file persistence for this milestone; no MongoDB collection or new service.
- Make Evaluate dry run the only new mutation: it writes operational planning records, never source or Git state. Existing approval controls remain explicitly owner-operated.
- Use High, Medium and Low priorities. Missing required priority/approval metadata makes the individual Approved feature ineligible and requires owner action. Historical Done features satisfy dependencies; inconsistent records or conflicting/unsafe workflow rules block selection.
- Keep evaluation manual only and retain the latest 100 evaluation results. Display the five owner questions prominently: next work, selection reason, planned window, blockers, and required action.
- Separate four logical future responsibilities; one serial worker can perform them without four persistent AI processes.
- Later execution must enforce scope, validation, and Git policies in deterministic code as well as prompts. Approval of F033 does not approve later execution phases.

Likely implementation files: existing Control Center server/public files/README/test fixtures and new local selector/planner/state modules. Owner-approved packaging and workflow corrections are recorded above; do not change unrelated instructions. F007/F012 isolation and current integration-test fixture boundaries constrain later testing phases.

## Security and Git safety boundaries

- Loopback-only host, origin, token, JSON and body-size checks remain intact. Safely render documents/reasons as text.
- Restrict reads to the feature index, validated feature Markdown under docs/features, explicitly allowlisted applicable workflow instruction files, and ignored automation state. Reject traversal, symlink escapes, duplicate IDs, and arbitrary caller-supplied filesystem paths.
- Do not read environment files, credentials, application records, private user data, or production services. No remote requests or notification integrations.
- No subprocess, Codex, Git, npm, shell, branch, or deployment command is reachable from new dry-run endpoints.
- Source documents/index remain byte-identical after evaluation, including approval and status fields. Preserve unrelated worktree changes.
- Future feature branches must use feature/F###-short-name. Automation may eventually commit/push those branches only after separate authorization and validation; never push main, force-push, merge, create PRs, or invoke deployment workflows.
- Only owner actions approve scope and mark reviewed work Done. Review does not equal merge/deployment; unfinished dependencies prevent starts.
- State failure creates a visible blocked plan/human action, never an automatic “repair” of documents or approval data.

## Acceptance criteria

- A healthy manual evaluation returns a deterministic candidate and explains priority, approval-time and ID tie-breaks.
- A Proposed feature is never selected, regardless of priority; only explicitly Approved, matching documents are eligible for a new start.
- Missing/invalid metadata, duplicate IDs, status mismatches, unsafe paths, missing dependencies, and cycles produce named reasons/human actions without guessing.
- Unfinished declared dependencies prevent starts; matching historical Done records satisfy dependencies without additional owner confirmation.
- Only High, Medium and Low priorities are accepted. An Approved feature lacking required priority/approval metadata remains Approved, is excluded from selection, and has a visible human action; other eligible work may be selected.
- Conflicting or unsafe-to-interpret workflow rules block the decision with file/rule references and an explicit owner action, without guessing or changing instructions.
- One valid In Progress feature takes precedence; missing checkpoint data or multiple In Progress records blocks selection of another feature.
- Status, priority, approval time, dependencies, would-resume intent, health, and required human actions are visible.
- Four implementation times and 08:00 quality time are Pacific-labelled, DST-correct, and clearly marked planned/not enabled.
- Previous/next planned times are distinct from actual evaluation history; tests and agent activity show Not run in this milestone.
- Manual planning results survive a server restart; GET does not write state; concurrent writes do not lose history.
- Corrupt/unsupported/unwritable state fails safely without replacement, fake healthy status, or document mutation.
- Repository and Git state remain unchanged through evaluation. No agent, shell command, test, GitHub operation, branch, or automatic fix is invoked.
- Existing category settings, proposal generation and owner approval/recommendation behaviour are preserved, with no paused scheduler activated.
- Desktop/mobile layouts and keyboard navigation remain usable with text status cues and visible focus.

## Local verification

Implemented locally on `feature/F033-ai-assisted-development-foundation`; manually reviewed and approved by the owner.

- All 18 focused development-planner/state/API tests pass, including priority/approval ordering, dependency and workflow blockers, checkpoint recovery, source races, independent-process writes, corruption, retention, Pacific DST and endpoint safety.
- Existing Control Center API smoke test passes. Server, planner, state and browser JavaScript syntax checks pass.
- Disposable fixtures verify source-document byte identity and no dry-run Codex execution. Existing unrelated worktree files retain their recorded hashes.
- Browser review passed at 1440×900 and 320×844, with keyboard activation, filter navigation, evaluation dialog close/Escape and focus restoration. No browser console errors were observed in the fixture view.
- Local standalone OpenAPI and Postman documentation describes the development endpoints; product API documents are untouched.

Source is tracked in `tools/control-center/`; runtime data remains ignored in `.local/control-center/`. Owner-approved workflow reconciliation and F010/F019/F028 metadata corrections do not authorize later-phase execution.

## Phased path

1. **F033 dry run:** manual planning, durable evaluation history, health/actions, disabled schedule display. No execution permissions.
2. **Separately approved manual pilot:** reconcile instructions; isolate feature worktrees and synthetic test infrastructure; add explicit owner-triggered Codex implementation, checkpoints, independent validation and Review evidence. Keep Git publication separately controlled.
3. **Separately approved scheduled implementation:** local scheduling at the four agreed times; one durable lease; resume unfinished work first; bounded retries and quota waiting; validated scoped commits/pushes if authorized. PR creation/merge and Done remain owner-only.
4. **Separately approved daily quality:** 08:00 local full-suite execution on a recorded clean baseline, including opt-in integration checks in isolated MongoDB and fake providers; distinguish pass/fail/skip/unavailable/manual checks; surface deduplicated bugs, test results and agent history. No automatic bug approval/fix.

These phases are a roadmap, not additional F033 scope or permission. No feature IDs, branches, agents, or infrastructure for later phases are created by approving this document.

## Owner decisions

1. Use the existing local Control Center with versioned local-file persistence.
2. Use High, Medium and Low priorities. Approved features missing required priority or approval metadata are not automatically eligible and require human action.
3. Evaluate dry runs manually only; retain the latest 100 results.
4. Historical Done features satisfy dependencies. Conflicting or unsafe-to-interpret workflow rules block selection and display the required human action.

These decisions were approved by the owner before implementation. Later execution phases remain unapproved.

## Open questions

None. No material design questions remain for this dry-run milestone. Future workflow conflicts must remain visible blockers requiring owner reconciliation. Later execution, Git publishing, and quality phases require separate approval.

## Approved correction verification

Source moved to tracked `tools/control-center/` with Node `>=22.20.0 <25` and no dependencies. Existing runtime settings/history were preserved in ignored `.local/control-center/`. All 18 F033 tests, existing API smoke test, syntax checks and diff whitespace checks passed. The relocated live UI loaded with preserved history; manual Evaluate dry run selected F019 (High, dependency F018 Done), with zero feature/workflow blockers and no required human actions. Browser console reported no errors. F033 is Done following explicit owner approval; no implementation, Codex execution, scheduled execution, commits, pushes, PRs or merges occurred through evaluation.

## Owner completion confirmation

The owner manually reviewed and approved the implementation and explicitly requested Done status and feature-branch publication. No merge or PR creation is authorized; the owner will create and review the PR manually. Later automation phases remain unapproved.
