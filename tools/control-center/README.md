# Astitva feature control center

This is a local-only mini web app. It binds to `127.0.0.1:4318`, uses no npm dependencies. Source is tracked in `tools/control-center/`; runtime data stays ignored in `.local/control-center/`. Supported Node: `>=22.20.0 <25`. Feature documents remain in the repository's `docs/features/<category>/` folders.

Start it from the repository root:

```sh
node tools/control-center/server.mjs
```
Stop
lsof -ti tcp:4318 | xargs kill

Open `http://127.0.0.1:4318`. Stop it with Ctrl+C. To use another port, set `CONTROL_CENTER_PORT` before starting. The `codex` CLI must be available in the process PATH for scheduled feature generation; `CODEX_BIN` can select another executable.

Each folder under `docs/features/` appears as a category. Add category creates a matching folder and README. Each category has its own paused/active schedule, interval, and features-per-run count. Schedules run only while this server is running. Family starts paused. The earlier external family LaunchAgent is unloaded and is not controlled by this page.

Each run reads every feature markdown document, proposes the next feature IDs in its category, and updates the feature index. A failed or partial run retries the same IDs. The page shows the last result and lets you run a category immediately. Review opens the full Markdown document. **Approve feature** records answers and changes `Proposed` to `Approved`. **Recommend new proposal** requires written feedback, marks the current proposal `Needs revision`, and makes that feedback available to the next category proposal run. Neither action implements or deploys a feature.

The app stores scheduler settings in ignored `settings.json`. It accepts browser writes only from its local origin with a per-process control token. It does not send messages or publish changes.

## F033 Development dry runs

The default **Development** view answers: what would AI work on next, why, when is the next planned window, what is blocked, and what requires owner action. Select **Evaluate dry run** to record a manual planning observation. No agent, test, implementation, Git, or remote operation runs. Existing category proposal generators remain separate and are unchanged; do not use their Run now button to evaluate development work.

Planning uses High → Medium → Low priorities, then the oldest approval instant, then numeric feature ID. Approved documents must explicitly declare:

```text
- **Priority:** High
- **Approved at:** 2026-10-01T16:00:00Z
- **Depends on:** None
```

Use comma-separated F### IDs for dependencies. Matching document/index Done dependencies, including historical records, count as finished. Missing metadata excludes the individual Approved feature; source/workflow inconsistencies block the whole decision. In Progress work reserves the slot: without consistent persisted job/checkpoint evidence, the page requests recovery and never chooses other work. F033 does not create or edit checkpoints.

Conflicting branch/completion rules, if introduced, make evaluation show **Human action required**. The page identifies the file, line and rule. It does not rewrite instructions or invent approval dates. Resolve these only through an explicit owner decision outside the dry-run endpoint.

The four implementation windows (00:00, 04:00, 12:00, 16:00) and daily 08:00 quality window are calculated in America/Los_Angeles with daylight-saving changes. They are **planned only**: no new timers, LaunchAgents, Codex runs, or test schedules are installed. Previous planned slots are not completed runs. GET refreshes readiness/health and shows whether the last manual observation is stale; it never records an evaluation.

### Local API

All endpoints belong to this loopback tool, not the hosted product. GET responses have no write side effects. POST requires the existing local host/origin, X-Control-Token, JSON and 16 KiB body checks.

| Method | Path | Behaviour |
| --- | --- | --- |
| GET | /api/development/state | Mode, disabled schedule, current readiness, health, source freshness, latest recorded decision and human actions |
| POST | /api/development/evaluations | Accept only `{}`; persist one manual observation; return 201 even for a blocked decision |
| GET | /api/development/evaluations?limit=20&before=cursor | Newest first by evaluation instant, then run ID; default 20, maximum 50; summaries and cursor |
| GET | /api/development/evaluations/:runId | Retained observation including source fingerprints, reasons, metadata and planned schedule |

The cursor is an opaque retained evaluation ID; an expired cursor returns 400 and the client must reload the first page. Invalid requests/IDs: 400; invalid host/origin/token: 403; missing result: 404; contention/source changes: 409; oversized body: 413; non-JSON POST: 415; unreadable/corrupt/unsupported/unwritable state: 503; unexpected errors: sanitized 500. State GET reports degraded health for unavailable state rather than silently resetting it. No start/commit/push/merge/fix endpoint exists. Complete OpenAPI and importable Postman examples are in `development.openapi.json` and `development.postman_collection.json` beside this README. The product API definitions and application collection are unchanged.

### Persistence and recovery

`development-state.json` is ignored, versioned local state, separate from category `settings.json`. Schema version 1 contains a monotonic revision, policy version, timezone/disabled schedule, latest evaluation ID, latest 100 observations, bounded events, and reserved jobs/checkpoints/activeJob/lease fields. Future execution fields remain empty; no agent/test success is fabricated. Current source hashes include relevant instructions. Scope hashes exclude lifecycle/queue metadata so a status-only change is not a scope edit.

An exclusive `development-state.lock/owner.json` guard serializes independent processes. Writes use an owner-readable temporary file, fsync, and atomic replacement; failed writes preserve the previous snapshot. Corrupt or unsupported snapshots are never overwritten with defaults. No guard is reclaimed automatically on time alone. If a crash leaves a guard, inspect its locally recorded PID and confirm that process is stopped; if the PID exists or ownership is unclear, do not remove it. Only after confirming absence should the owner remove the abandoned guard and retry. To recover corrupt state, preserve the damaged file and restore a verified local backup explicitly. Never copy state to GitHub or load it from production.

### Verification

```sh
node --test .local/control-center/development.test.mjs
node tools/control-center/test.mjs
node --check .local/control-center/server.mjs
node --check .local/control-center/development-planner.mjs
node --check .local/control-center/development-state.mjs
node --check .local/control-center/public/app.js
```

Tests use disposable feature/state repositories, synthetic clocks, and loopback fixture servers. They require no application database, credentials, live provider, or AI access. Source, tests, synthetic fixtures, public assets and API specifications are version controlled. Settings, history, jobs/checkpoints, locks, logs, temporary files and machine configuration remain under ignored `.local/control-center/`. `CONTROL_CENTER_DATA_DIR` overrides runtime storage for isolated fixtures; never point it into tracked source. Existing local state requires no migration.
