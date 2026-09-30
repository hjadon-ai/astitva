# F009: Daily Priorities

- **Status:** Review
- **Branch:** `feature/F009-daily-priorities`
- **Pull request:** Not created

The project owner approved the documented behavior, wireframe, API, storage, architecture decisions, and acceptance criteria for future implementation.

## Goal

Help a user choose a small, achievable focus for a day and see what they have completed. Keeping the list to three priorities makes the private workspace useful for daily action without introducing a full task-management system.

## User flow

1. A logged-in, verified user opens **Daily Priorities** from the existing private profile sidebar.
2. The selected date defaults to today in the browser's local calendar. The user sees the day's priorities and completion progress.
3. The user adds a short title, saves it, and repeats until there are up to three priorities.
4. A checkbox completes or reopens a priority. Inline Edit and Delete controls correct or remove it.
5. Previous, Next, Today, and a date input allow viewing and editing today or past dates. Next is disabled on today; future dates cannot be selected.
6. Returning later or reloading shows saved data for the selected day. Unfinished priorities remain on their original date.

## Wireframe or UI changes

Keep the existing profile shell, account context, responsive sidebar, and logout behavior. Recommend inserting Daily Priorities immediately below Overview, using one content panel and the existing button/form styles.

```text
Astitva.          Daily Priorities
Overview         [Previous] [2026-09-22] [Today] [Next: disabled]
Daily Priorities
Diet             1 of 3 complete
Finance          [x] Send proposal             [Edit] [Delete]
Projects         [ ] Read one chapter          [Edit] [Delete]
Notes            [ ] Take a walk               [Edit] [Delete]
                 Three priorities selected. Delete one to add another.
[Log out]        [Add priority: disabled]

Empty day:       0 of 0 complete
                 No priorities for this date. Choose up to three.
                 [Add priority]

Inline add/edit: Title [____________________________]
                 [Save] [Cancel]
```

- Progress uses the actual list size as its denominator, not remaining capacity: one completed item among two is “1 of 2 complete.” Completed items still occupy slots. Keep rows in insertion order when completed or reopened.
- Loading: show “Loading priorities…” and disable mutations until that date loads; do not present the previous date's rows as current data.
- Empty: show the empty state above and an enabled Add action. Full: disable Add and explain the three-slot limit; editing, deleting, and toggling remain available.
- Saving: show “Saving…” (or “Deleting…”), prevent duplicate submissions, and disable date navigation and other mutations until settled. Update rows and progress after success. Cancel exits an unsaved form; disable date navigation while a form is dirty until Save or Cancel.
- Errors: show a nearby readable message and Retry for load failures; preserve unsaved title text on save failure. On a limit conflict, reload the day while retaining the draft. After an uncertain network result, reload before offering a manual retry; never automatically repeat an add.
- Delete uses a small inline confirmation with Delete and Cancel. On success, return focus to the next row or Add. Edit focuses its title input; Cancel returns focus to its triggering button.
- Use native labelled buttons, date/text inputs, and checkboxes with visible focus. Checkbox labels name the priority; Edit/Delete accessible names include its title. All actions work by keyboard (Tab, Enter, Space as appropriate). Announce saving/progress changes with a polite status region and errors with an alert. Do not rely on color or strikethrough alone.
- Ignore obsolete fetch responses after a date change; a slow response cannot replace the selected day's view.

## In scope

- Private priorities for authenticated, verified accounts, with up to three items per user per selected date, including completed items.
- Add, edit title, delete, complete, and reopen; short titles only.
- Today by default, plus viewing and editing past dates; completion progress and all states described above.
- Persistence in localhost MongoDB and REST integration using the existing session conventions.
- During future approved implementation: update the linked OpenAPI definition and Postman collection/local request variables with success, validation, authorization, ownership, and limit examples; document the approved collection in `server/design/mongodb-collections.md` before implementing it. No changes to those files in this proposal.

## Out of scope

- Descriptions, subtasks, reminders, recurring tasks, categories, drag-and-drop ordering, calendar integrations, and future-date planning.
- Automatic carryover, moving/copying an item to another date, shared lists, public display, reporting, and notifications.
- Linking to existing Projects placeholders, new frameworks, deployment, or changes to existing authentication behavior.

## API changes — draft REST contract

All endpoints use the existing HTTP-only `astitva_session` cookie and reject expired/missing sessions with `401`, or authenticated unverified accounts with `403`. Derive ownership exclusively from the session; never accept `userId` from the client. Scope every feature read and write to that owner and date; item mutations also match the embedded item ID.

Recommend the required `X-Time-Zone: America/Los_Angeles` header on every request below, populated from the browser's IANA timezone. The server uses its current instant in that zone to validate that the requested date is not future. Missing/unsupported zones return `400`. This is a client-declared calendar preference, not an authorization boundary; no timezone profile field is introduced.

### Read a day

`GET /api/priorities/days/2026-09-22` — no request body.

`200` example:

```json
{
  "date": "2026-09-22",
  "priorities": [
    { "id": "507f1f77bcf86cd799439011", "title": "Send proposal", "completed": false }
  ],
  "progress": { "completed": 0, "total": 1, "limit": 3 }
}
```

A missing day returns `200` with `priorities: []` and progress `{ "completed": 0, "total": 0, "limit": 3 }`; GET does not create a document.

### Add a priority

`POST /api/priorities/days/2026-09-22/priorities`

```json
{ "title": "Send proposal" }
```

`201` example:

```json
{ "priority": { "id": "507f1f77bcf86cd799439011", "title": "Send proposal", "completed": false } }
```

The server generates the ID and initial completion state. A full day returns `409` with `{ "error": "This date already has three priorities." }`, without inserting anything.

### Edit, complete, or reopen a priority

`PATCH /api/priorities/days/2026-09-22/priorities/507f1f77bcf86cd799439011`

Accept title and/or completed; at least one is required. Examples:

```json
{ "title": "Send revised proposal" }
```

```json
{ "completed": true }
```

```json
{ "completed": false }
```

`200` example after completing:

```json
{ "priority": { "id": "507f1f77bcf86cd799439011", "title": "Send revised proposal", "completed": true } }
```

Set the supplied boolean explicitly rather than using a toggle operation. Omitted fields remain unchanged; neither ownership nor date can be edited.

### Delete a priority

`DELETE /api/priorities/days/2026-09-22/priorities/507f1f77bcf86cd799439011` — no request body.

`204`, no response body. Deletion frees a slot. A repeat delete returns `404`.

### Important errors and response handling

- All endpoints: `400` for a malformed or impossible date, a future date, or invalid timezone; `401` and `403` as above; `500` for an unexpected server/storage failure with a generic message.
- POST/PATCH: `400` for invalid JSON/body shape, unknown fields, blank/overlong/non-string titles, a non-boolean completion value, or an empty PATCH. POST accepts only title; PATCH accepts only title/completed.
- PATCH/DELETE: `404` for malformed item IDs or items absent from that user's specified date, including another user's IDs. Never reveal the actual owner.
- POST: `409` for the three-item limit, including concurrent requests.
- Preserve the implemented Diet convention: `{ "error": "Human-readable message." }`, for example `{ "error": "Use a valid YYYY-MM-DD date." }`. Do not expose database details or stack traces.
- After mutations, refetch the selected day for authoritative rows and calculated progress. A successful mutation followed by a failed refresh shows a refresh error, not a claim that saving failed. No real-time cross-tab synchronization is proposed.

## MongoDB changes — proposed

### `dailyPriorityDays`

Recommend one document per user/date with at most three embedded items:

| Field | Type and validation |
| --- | --- |
| `_id` | MongoDB ObjectId, generated by server |
| `userId` | Required ObjectId reference to User; immutable session-derived owner |
| `date` | Required immutable `YYYY-MM-DD` string representing a real calendar date |
| `priorities` | Required array, default empty, maximum three items |
| `priorities[]._id` | Server-generated ObjectId, stable and distinct within the day |
| `priorities[].title` | Required trimmed string, 1–120 characters using the existing JavaScript string-length convention; reject line breaks |
| `priorities[].completed` | Required boolean, default false |
| `createdAt`, `updatedAt` | Server-managed BSON Date timestamps on the day document |

Create a unique compound index `{ userId: 1, date: 1 }` before enabling writes; it both enforces one day per owner and supports reads. The default `_id` index is retained; no separate item or progress index is needed. Derive progress from the array, never persist counters. Retain empty day documents after deletion to simplify concurrency.

Validate strict body fields and types in Express before Mongoose casting, then define corresponding schema validation for persisted fields and array length. Validate real dates including leap years, not only a regex. Array validators alone are not the concurrent-limit mechanism.

### Concurrent requests and the three-item limit

1. Initialize the day with an owner/date-only upsert using `$setOnInsert` and an empty array. Two first requests may race on the unique index; handle duplicate-key by proceeding against the existing owner/date document, not by creating another day.
2. Add with a separate atomic, non-upsert update matching `{ userId, date, 'priorities.2': { $exists: false } }` and `$push` of one validated item. The capacity predicate and push occur in the same single-document write. With two items, only one competing add can match and append; the rest return `409`.
3. PATCH uses a targeted positional `$set` of supplied fields; DELETE uses `$pull`. Both match owner/date/item ID and never replace the full array from a stale read. Completion does not change array length. Same-field competing edits are last-write-wins; different-field edits preserve one another. Edits after deletion return `404`.
4. Do not use a count-then-insert check, in-process lock, or a capacity-filtered upsert. Retaining empty days means a nonmatching capacity update is a full day during normal feature operations. No day-delete endpoint is introduced.

This keeps the invariant across Express processes without multi-document transactions or a MongoDB replica-set requirement. Document and test the initialization race and full-day race during implementation.

## Architecture decisions — approved

- Keep React with Vite, the existing private profile/hash navigation and relative `/api` proxy, Express.js routes, Mongoose models, and localhost MongoDB (`astitva`). Recommend a small Daily Priorities component and one dedicated REST route/model group, using existing styling and API helpers.
- Follow F002's private shell, F003's verification gate, and F005's per-day flow and implemented error/response wrappers. Enforce session expiry and verification on every backend request as well as the UI; authentication lookup follows the existing session convention.
- Recommend embedded day documents because the list has a hard bound of three and is read as one day. Single-document atomic mutations enforce capacity without infrastructure changes. All database filters and initialization/retry paths include the authenticated owner.
- Store date-only values verbatim as validated strings. Construct browser today from local year/month/day, not `toISOString().slice(0, 10)`. Display the date string via calendar components or directly; do not parse it as UTC and then format locally. Calendar navigation increments calendar days, not 24-hour timestamp durations. UTC timestamps are audit instants only and never determine an item's selected day.
- Recommend the timezone header above to enforce the no-future rule consistently with browser-local today rather than the server's timezone. Changing browser timezone never reassigns existing records. Today is recomputed on opening the page and using Today; an explicitly selected date stays selected across midnight. Server validation remains authoritative for each request.
- Recommend 120-character single-line titles, insertion order, duplicate titles allowed, actual-count progress, inline delete confirmation, and last-write-wins for the same field. These keep the first version small without introducing ranking, version history, or a conflict-resolution UI.

## Acceptance criteria — for future implementation

- A verified user can navigate to the proposed panel within the existing private shell; logged-out requests return `401`, unverified requests return `403`.
- Opening the panel selects browser-local today; past dates can be read and edited, and future dates are unavailable in the UI and rejected by the API under the declared timezone.
- Add, rename, delete, complete, and reopen persist after reload. Three items fill the day even if all are complete; deleting one permits another add.
- Progress equals completed rows over actual rows, including “0 of 0 complete” when empty. Completion does not reorder rows.
- Concurrent adds to an empty day produce one owner/date document and at most three items; concurrent adds to a two-item day yield exactly one success and capacity conflicts for the others. Concurrent operations cannot overwrite an unrelated item or field through a stale array replacement.
- Two accounts cannot read or mutate each other's priorities, including with guessed IDs; a read on an otherwise identical date returns only the caller's own list.
- Dates retain their exact selected value across reload, timezone changes, midnight, and daylight-saving boundaries. Impossible dates, invalid zones, invalid types, unknown fields, blank titles, line breaks, and overlong titles are rejected without saving.
- Unfinished items do not appear on another date automatically. No future planning or other out-of-scope controls appear.
- Loading, empty, full, saving, deletion confirmation, failed loads, failed saves, uncertain network results, and capacity conflicts behave as specified. Slow responses cannot show a different day's rows.
- All actions are keyboard accessible with meaningful labels, visible focus, sensible focus restoration, and announced status/errors.
- After approval and implementation, OpenAPI, Postman, and collection design documentation match the reviewed contract and include the important errors. Everything runs locally.

### Implementation and local verification

Implemented on `feature/F009-daily-priorities` in the isolated Git worktree
`/private/tmp/astitva-implement-approved-F009`, based on committed F011 (`43c799a`).
The original checkout and its uncommitted feature-document organization remain
untouched. F008 is committed and pushed separately; this worktree's unchanged F008
records describe its older committed baseline. No F009 commits, pushes, or pull
requests were created.

F009 adds the private Daily Priorities panel, browser-local date navigation,
inline add/edit/delete, completion and actual-count progress, draft preservation,
explicit refresh after uncertain writes, and stale-load protection. REST routes
validate session/verification, timezone/calendar date, strict bodies, and owner
filters. `dailyPriorityDays` uses the approved unique index, atomic capacity push,
positional field updates, and retained empty days. OpenAPI, Postman, both local
request environments, and collection documentation cover the feature. Runtime
cookies follow the existing F007 convention (`astitva_dev_session` or
`astitva_stage_session`) rather than introducing a new authentication behavior.

Validation on September 23, 2026:

- Passed: `npm test` in `server/`: 16 tests passed and the explicitly opt-in F009
  MongoDB integration test was skipped as designed.
- Passed: `ASTITVA_TEST_PRIORITIES=1 npm test`: all 17 tests passed. The integration
  suite covered missing, expired, and unverified sessions; another owner's item ID;
  missing days; strict validation; persistence; concurrent first adds; full-day
  races; independent field updates; deletion and reopening; retained empty days;
  and no carryover. Generated fixtures were removed after the run.
- Passed: `npm run build` in `web/`; Node syntax checks; JSON artifact parsing;
  local OpenAPI reference checks; and `git diff --check`.
- Passed: the isolated Dev worktree connected to local MongoDB and served the web
  app and API on ports 3000 and 3001. The page, Vite health proxy, unauthenticated
  `401`, local login, and authenticated empty-day response were verified over HTTP.
- Not run: interactive browser checks for responsive layout, keyboard focus, and
  simulated network states because no controllable browser is available in this
  tool session. These remain in the owner's manual review below.

### Remaining validation and manual review checklist

1. Open `http://localhost:3000`, log in with a verified account, open **Daily Priorities**, add three items,
   complete/reopen and rename one, then delete one and add a replacement. Reload
   and confirm insertion order, exact progress, and saved data.
2. Test empty/past days, future-date rejection, browser-local today near midnight,
   and daylight-saving calendar navigation. No unfinished item should carry over.
3. Use keyboard Tab/Enter/Space through add/edit/delete confirmation and Cancel;
   check focus restoration, announced status/errors, and narrow-screen layout.
4. Simulate slow date loads, failed loads, failed saves, lost mutation responses,
   successful writes followed by failed refreshes, and a competing fourth add.
   Confirm no stale rows, duplicate automatic adds, lost draft, or false save error.
5. Import the matching Postman environment and exercise the Daily Priorities
   folder with verified, unverified, and second-owner sessions.
6. Revalidate integration when combining with F008 in the owner's Git workflow;
   shared API helper, navigation, styles and API index changes may require review.

## Open questions

None. The project owner approved the proposed page and interaction, date-only calendar behavior, item rules, embedded day-document storage, and atomic concurrency design.
