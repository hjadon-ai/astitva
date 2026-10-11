# F040: Diet plan and everyday workflow

- **Status:** Done
- **Branch:** `feature/F040-diet-plan-workflow`
- **Pull request:** Merged; owner confirmed in chat on October 10, 2026 (PR number not recorded).
- **Approval:** Owner approved the discussed phased implementation in chat. Proposed → Approved → In Progress.

## Goal
Guide new Diet users from measurements to a saved plan and daily targets, then prioritize everyday recording.

## User flow
Daily Record → setup card → Your Plan → measurements and BMI preview → goal and optional calorie questions → save → review/edit daily targets → return to Daily Record.

## In scope
Phase 1: combine Body & Goals and Target into Your Plan, guided setup and compact saved summary, preserve saved data and explicit calorie application. Phase 2 (after owner review): improve Library access and everyday recording. Phase 3 (after owner review): progress connections and broader state/layout polish.

## Out of scope
New calculation models, automatic calorie application, deployment, changes to shared read-only permissions. No separate Overview tab: preserve the existing combined Daily Summary.

## Wireframe or UI changes
Stable Daily Record / Trends / Your Plan tabs and existing flip. First-time setup card above the workspace; saved profile becomes a compact plan summary. Two guided form stages, then daily target review in the same Plan panel. Library remains unchanged in Phase 1.

## API changes
None for Phase 1. Reuse body-goals GET, preview, PUT and apply-target, and existing daily target PUT. Persisted profile determines setup state across devices; no browser-only completion flag.

## MongoDB changes
None.

## Architecture decisions
Server remains authoritative for estimates and revisions. Saving a plan never applies calories automatically. Users can record without completing setup, and configure daily targets without optional calorie answers. Existing macro-derived calorie rules remain intact.

## Acceptance criteria
- Existing saved plans open as summaries with explicit editing.
- New users can preview BMI from measurements before selecting a goal.
- Optional calorie answers remain optional; existing eligibility restrictions remain.
- Daily target editing lives in Your Plan with current values visible.
- Loading/errors do not imply setup is missing; read-only Diet never loads body data.
- Existing recordings, predictions, units, and explicit calorie confirmation remain supported.

## Phase 2
Owner reviewed Phase 1 and requested proceeding. Add Recent meals alongside Food Library in the existing Add food card. Recent selections show recorded portions and historical nutrition; explicit Add meal creates a new record through existing manual-meal validation. Current library meals continue through their authorized add-to-day endpoint. Manage Library remains separate.

GET /api/diet/meals/recent: authenticated feature/managed owner scope, up to 8 distinct portions from the 100 latest dated records. No new collection. Identical food names with different portions or nutrition stay distinct.

## Phase 2 verification
Passed: 25 web tests, 10 Diet service tests, web build (existing large-bundle warning), git diff check. New tests cover distinct recent portions and fractional repeat rounding without multiplying the original library quantity again. Local browser confirmed Add food / Recent meals / Food Library controls. The running server still returns 404 for the new endpoint: restart it before testing Recent meals. Authenticated endpoint/database integration and repeat-save remain for local owner review; no user records were created during browser checks.

Review: restart the local server with the same environment you currently use; open Daily Record → Recent meals; choose an existing meal, adjust recorded portions and meal type, then Add meal. Check selected date, timeline and totals. Repeat from Food Library; verify manual entry and Manage Library still work. Phase 3 was subsequently authorized and implemented.

## Phase 3
Owner requested implementation and local launch. Trends now links to Daily Record and Your Plan, with weight-record and goal-review actions, empty-period guidance, and current nutrition/target refresh when daily intake changes. Daily date navigation and meal timeline appear only in Daily Record; returning users no longer see the setup banner. Weight reloads show loading instead of stale results. Responsive plan/target/progress controls were refined and duplicate Plan heading removed.

Verification: 25 web tests passed, production build passed with the existing chunk-size warning, git diff check passed. Local browser confirmed Recent meals loads successfully after API restart; Nutrition and Weight & prediction load existing records; Review Your Plan opens the correct tab; daily-only content is hidden there. Inspected Day layouts at desktop and 390px mobile, then restored desktop and Daily Record. No test records created. Night/Original visual checks, new-user setup persistence, repeat-save, and shared/managed end-to-end permission regression remain for owner review. Local web at http://localhost:3000/#diet and API at 127.0.0.1:3001 are running. No commit or push.

## Local verification
Phase 1: web suite passed (23 tests), production build passed (existing large-bundle warning), and git diff check passed. Local browser verified existing saved profile and targets, Edit plan → measurement preview → goal stage, and Cancel without saving. Day desktop layout inspected. New-user persistence, mobile, Night and Original need owner review. No server changes, commits or pushes.

Owner review: open Diet → Your Plan; edit measurements and preview BMI; choose a goal and optional calorie answers; preview/save; review active daily targets and edit them; apply a saved calorie estimate only through confirmation; reload and check Daily Record/Trends. Phase 2 was subsequently authorized and implemented.

## Open questions
None for Phase 1; later phases wait for owner review.

Owner-review correction: removed the legacy compact overview-face class from Trends, which squeezed the chart into a fractional grid row after adding progress controls. Nutrition chart now has a dedicated 320px desktop / 240px mobile height in normal document flow. Local browser confirmed 1048×320 desktop chart; web build and diff check passed.
