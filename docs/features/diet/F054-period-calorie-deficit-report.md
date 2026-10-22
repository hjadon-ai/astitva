# F054: Daily, weekly and monthly calorie deficit report

- **Status:** Review
- **Branch:** `feature/F054-period-calorie-deficit-report`
- **Pull request:** Not created

## Goal

Fetch an estimated calorie deficit or surplus from recorded meals for a selected day, week or calendar month. Show the maintenance basis and logging coverage so missing or partial records cannot be mistaken for complete intake.

## User flow

1. An authenticated Diet user selects a period, reference date and IANA timezone in an API client.
2. The API resolves the calendar range and reads recorded meal calories and the current Body & Goals maintenance estimate.
3. The response shows daily results, eligible-day totals, coverage and limitations. No maintenance estimate produces an explicit unavailable result.

## In scope

- `daily`, `weekly` and `monthly` periods, with explicit reference date and timezone.
- Daily means the reference date; weekly means Monday–Sunday containing that date; monthly means its calendar month.
- Current Body & Goals maintenance estimate as the initial basis, explicitly identified in every response. This is not a historical maintenance reconstruction.
- Estimated deficit = maintenance calories minus recorded consumed calories. Positive is deficit; negative is surplus. Never clamp surplus to zero or multiply recorded meal calories by quantity again.
- Chronological daily entries. Future days are excluded from totals; today is partial; past days with no meals are unlogged and excluded from deficit totals.
- Past days with meals are recorded, not certified complete. Label results “estimated deficit from recorded meals.”
- Period intake and net deficit totals over past days with recorded meals; report today's partial values separately. Include day counts and total basis so the period total is not presented as a complete-week/month result when coverage is incomplete.
- Reuse application session, verified-email, Diet feature and existing workspace authorization. No caller-supplied owner ID.
- Update OpenAPI and Postman using existing collection authentication conventions; add meaningful authorization/calendar/calculation tests when implemented.

## Out of scope

- Historical maintenance snapshots, new energy equations, exercise-calorie imports, inferred meals or treating no logs as fasting.
- A logging-complete marker, medical advice, new UI, MCP tools, or automatic target changes.

## Wireframe or UI changes

None. API-only first delivery.

## API changes

`GET /api/diet/reports/calorie-deficit`:

| Parameter | Required | Description |
| --- | --- | --- |
| `period` | Yes | `daily`, `weekly`, or `monthly` |
| `date` | Yes | Valid reference calendar date, `YYYY-MM-DD` |
| `timezone` | Yes | Valid IANA timezone, used to establish today and future/partial states |

Example: `/api/diet/reports/calorie-deficit?period=weekly&date=2026-10-20&timezone=America/Los_Angeles`.

Response: echoed inputs; resolved start/end; `asOfDate`; availability status; maintenance calories/day and `maintenanceBasis: current-body-goals-estimate`; daily date/status/meal count/recorded calories/estimated deficit; coverage counts; past-recorded-day period totals; separate today-partial totals; and limitations. Unlogged/future deficits are null, never a full-day maintenance deficit. No eligible recorded days produces an unavailable/null deficit total rather than an asserted zero deficit.

Missing or unusable maintenance returns HTTP 200 with `status: unavailable`, a stable reason, null deficit values and available recorded intake. Do not silently substitute the saved intake target for maintenance. Invalid/missing/unknown/repeated parameters return 400; invalid/expired sessions return 401; verification, feature or workspace denial returns 403 (or the existing workspace not-found behavior). Use `Cache-Control: no-store`.

## MongoDB changes

None. Read existing meal and Body & Goals records. Confirm the exact maintenance source during implementation; do not invent a stored field or add historical snapshots implicitly.

## Architecture decisions

- Reuse the existing Body & Goals calculation/source for the current maintenance estimate, subject to its existing eligibility rules.
- Meal dates already represent calendar dates; timezone determines today's classification, not a conversion of stored meal dates.
- Keep today's partial estimate separate from period totals. Daily-today reports therefore have partial results rather than a completed-day total.
- Future-only ranges and empty periods remain explicit, with no inferred consumption or deficit.
- Approval of this document would authorize only the defined report, not additional health calculations or infrastructure changes.

## Acceptance criteria

- Boundaries are correct across month/year transitions, leap years and timezone changes around midnight, including DST dates.
- A reference Tuesday resolves to the containing Monday–Sunday week.
- Existing portion totals are summed once; surplus reduces the net deficit.
- Future, unlogged and today-partial days are distinguished and excluded from completed-past-day totals.
- Coverage counts and the current-estimate basis accompany results; partially recorded past days are not called complete.
- Missing/ineligible maintenance never falls back to intake targets or returns invented deficit values.
- Users cannot read another owner's report by supplying an ID or forged workspace headers.
- Postman request works with the same saved login cookie as existing Diet requests; explicit bearer sessions also work.

## Local verification

Focused unit/isolated-database HTTP tests: 7 passed. Coverage includes cookie/bearer access, expired/unverified/feature-denied access, owner isolation, forged workspace rejection, no fallback to saved intake targets, inclusive calendar and leap-year boundaries, timezone midnight/DST, invalid/duplicate inputs, surplus and missing/partial/future logging. Full server suite: 75 passed, 15 opt-in tests skipped. Stage health passed; anonymous report access returns 401. Stage runs from the main workspace. No database schema, UI or MCP changes. No commit, push or Production deployment performed.

## Open questions

None. Maintenance comes from estimateBodyGoals(current dietBodyGoals profile).maintenanceCalories, with existing eligibility checks. Final response uses totals, todayPartial, coverage and chronological days; unavailable period totals do not suppress todayPartial. Only the owner may mark Done after review/merge.
