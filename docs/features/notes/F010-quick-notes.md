# F010: Quick Notes

- **Status:** Approved
- **Branch:** Not created
- **Pull request:** Not created

The project owner approved the documented behavior, wireframe, limits, API, architecture decisions, and acceptance criteria for future implementation.

## Goal

Let a user capture and revisit personal information without leaving their private workspace. A small list and plain-text editor provide a predictable place to save thoughts without the complexity of a document-management system.

## User flow

1. A logged-in, verified user selects the existing **Notes** navigation entry; the content panel opens **Quick Notes**.
2. The user opens a saved note or chooses New note, enters a title and body, and explicitly selects Save.
3. The editor shows Unsaved changes until saving succeeds, then Saved. The list places the saved note first.
4. Selecting another note, New note, another workspace page, or Log out while dirty asks the user to Stay or Discard changes and continue. Staying preserves the editor so the user can save first.
5. Delete asks for confirmation before removing a saved note. Cancelling preserves all editor text.
6. If another tab saved the same note first, a conflict keeps the local draft visible and offers an explicit reload of the saved version after confirming that the draft will be discarded.

## Wireframe or UI changes

Reuse the current profile shell and its Notes link (`#notes`), currently a workspace placeholder, rather than adding another sidebar entry. F002 defines the private layout and F003 the verification gate. F009 is a separate Proposed feature and is not a prerequisite.

```text
Astitva.      Quick Notes
Overview     [New note]
Diet         Notes list             Editor
Finance      -------------------    Title [Weekend ideas________]
Projects     Weekend ideas          Body
Notes        Updated Sep 22         [Visit the park.             ]
             Reading list           [                            ]
[Log out]    Updated Sep 21          Unsaved changes
             [Load more]            [Save] [Delete]

Empty list:  No notes yet. [New note]
No editor:   Choose a note or create one.
New editor:  Title [________________] Body [___________________]
             Not saved yet          [Save] [Discard draft]
Delete:      Delete “Weekend ideas”? This cannot be undone.
             [Cancel] [Delete note]
```

- Wide screens: a compact list beside the editor inside the existing content area. Narrow screens: list and editor occupy separate views with a Back to notes button; Back uses the unsaved-change guard. Keep native controls and existing styles; avoid horizontal page scrolling.
- Loading: separate list/editor loading text. Disable editor actions until its note loads. Ignore stale fetch responses when selection changes. Failed list/open requests show Retry and do not overwrite an existing draft.
- Empty states: distinguish no saved notes, no selected note, an empty body, and a new unsaved draft. New note does not write to MongoDB until Save succeeds. Discard draft asks for confirmation if dirty.
- Dirty tracking compares title/body with the last successfully loaded/saved values; undoing edits back to those values clears Unsaved changes. New untouched drafts show Not saved yet. Title and body have visible length guidance.
- Saving: show Saving…, disable duplicate mutations and navigation, and keep entered text visible. On success update the saved baseline, ID/version, and list. Save is disabled for invalid or unchanged content. A new note requires a valid title; an empty body is allowed.
- Errors: preserve title/body after every failed save, including validation, network, session, and version errors. Show a readable message beside the editor. A failed list refresh after a successful save reports a refresh error, not a failed save. Never automatically retry POST after an uncertain response; tell the user to refresh the list and check for the created note before retrying, retaining the draft.
- Unsaved navigation: guard note selection, New, Back to notes, profile links, hash/back/forward navigation, and logout before abandoning the editor. A cancelled navigation preserves selection, URL, and text. Use a native `beforeunload` warning for reload/tab-close when dirty, acknowledging browser support and wording restrictions. No draft persistence or recovery after a forced close is promised. Session-expiry errors preserve the mounted draft for copying; explicit logout discards it only after the guard.
- Use labelled text input and textarea, keyboard-operable list buttons and actions, visible focus, and an indicated selected note. On editor open focus its title; after delete/discard focus New note or the next list entry. Confirmation dialogs manage focus, default to the non-destructive choice, support Escape to cancel, and return focus on cancellation. Announce saving/saved/unsaved status politely and errors as alerts.

## In scope

- Create, list, open, edit, explicitly save, and confirm deletion of private notes.
- A short title and plain-text body, visible save/dirty states, navigation warnings, and preservation of failed-save text.
- Newest-updated-first list with bounded pages and Load more.
- Optimistic concurrency checks for edits and deletes to prevent silent overwrites between tabs.
- During approved implementation: update OpenAPI and Postman requests/examples/local variables for this contract, including conflicts, pagination, authentication, and ownership; document the approved collection in `server/design/mongodb-collections.md` before coding it. These files remain unchanged at proposal time.

## Out of scope

Search, tags, folders, pinning, rich text, Markdown rendering, attachments, sharing, autosave, version history, draft storage, collaborative editing, automatic conflict merging, and deployment. Plain text resembling HTML or Markdown is displayed literally. No changes to authentication behavior or other feature scopes.

## API changes — draft REST contract

All operations use the existing HTTP-only `astitva_session` cookie, session-expiry checks, and verified-account rule as implemented for Diet. Every feature query includes the authenticated user ID; never accept ownership from request data. Responses omit owner IDs and internal database details. Use the implemented `{ "error": "Human-readable message." }` error convention.

### List notes

`GET /api/notes?limit=20` — no body. Default limit 20; accept integers 1–50 only. Return summaries without bodies:

```json
{
  "notes": [
    { "id": "507f1f77bcf86cd799439011", "title": "Weekend ideas", "updatedAt": "2026-09-22T15:30:00.000Z", "version": 1 }
  ],
  "nextCursor": null
}
```

`200`; empty list is `{ "notes": [], "nextCursor": null }`. When more exist, nextCursor is an opaque URL-safe encoding of the last returned `(updatedAt, id)` pair. Next request example: `GET /api/notes?limit=20&cursor=<URL-encoded-nextCursor>`. Fetch limit + 1 to determine continuation; return at most limit records. Sort by `updatedAt` descending, then `_id` descending; continuation selects strictly older tuples within the caller's records. Validate cursor shape, timestamp, and ObjectId; never use client-supplied filter objects. A cursor does not grant access to its originating user's records.

### Create

`POST /api/notes`

```json
{ "title": "Weekend ideas", "body": "Visit the park.\nBring a book." }
```

`201` example:

```json
{
  "note": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Weekend ideas",
    "body": "Visit the park.\nBring a book.",
    "version": 1,
    "createdAt": "2026-09-22T15:30:00.000Z",
    "updatedAt": "2026-09-22T15:30:00.000Z"
  }
}
```

### Open

`GET /api/notes/507f1f77bcf86cd799439011` — no body. `200` returns the same full `{ "note": ... }` shape as Create. Always fetch a full note before editing; a list summary is not an editor baseline.

### Save edits

`PUT /api/notes/507f1f77bcf86cd799439011`

```json
{ "title": "Weekend plans", "body": "Visit the park on Saturday.", "version": 1 }
```

Require both content fields and the last loaded/saved version. `200` returns the full note, for example:

```json
{
  "note": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Weekend plans",
    "body": "Visit the park on Saturday.",
    "version": 2,
    "createdAt": "2026-09-22T15:30:00.000Z",
    "updatedAt": "2026-09-22T16:00:00.000Z"
  }
}
```

Every accepted save increments version, even if a direct API caller submits unchanged content. PUT is selected for saving the complete editor content, not partial field updates.

### Delete

`DELETE /api/notes/507f1f77bcf86cd799439011?version=2` — no body. Version is required so a stale tab cannot delete unseen edits. `204` has no response body. Repeat deletion returns `404`.

### Important errors

- All endpoints: `401` for missing/expired session; `403` for an unverified account; `500` for unexpected storage/server failure, with no stack trace or database details.
- List: `400` for invalid limit or cursor.
- Create/save: `400` for malformed JSON, missing/unknown fields, wrong types, invalid title/body, or invalid version on save. Oversized requests return `413` under the server's existing request-size guard; do not raise that guard for this feature.
- Open/save/delete: `404` for malformed IDs or a note absent from the authenticated user's records, including another user's ID.
- Save/delete: `400` for missing or invalid version (positive safe integer required); `409` for a version mismatch on an owned note: `{ "error": "This note changed in another tab. Reload the saved note before trying again." }`. Nothing changes on conflict.
- A delete elsewhere followed by Save returns `404`; keep the local draft for copying, without recreating the note automatically.

## MongoDB changes — proposed

### `quickNotes`

| Field | Type and validation |
| --- | --- |
| `_id` | Server-generated ObjectId |
| `userId` | Required immutable ObjectId reference to User, assigned from session |
| `title` | Required trimmed single-line string, 1–120 characters; reject line breaks |
| `body` | Required plain-text string, 0–10,000 characters; preserve whitespace and line breaks |
| `version` | Required positive safe integer, initially 1; incremented only by server on save |
| `createdAt`, `updatedAt` | Server-managed BSON Date timestamps |

Recommend the existing JavaScript string-length convention for both limits (UTF-16 code units), applied identically in frontend and backend. Duplicate titles are allowed. Do not render HTML from either field.

Create `{ userId: 1, updatedAt: -1, _id: -1 }` for owned sorted lists and cursor pagination; retain the default unique `_id` index for point lookups. No body/search index or additional collection is needed. Validate exact request shapes/types before Mongoose casting, and mirror length/type requirements in the schema. Unknown fields, client timestamps, and client owner IDs are rejected.

### Preventing silent overwrites

Save uses a single atomic `findOneAndUpdate` with `{ _id, userId, version: expectedVersion }`, setting title/body and updatedAt and incrementing version by one. Return the post-update note. Never load a note and later save it without a version predicate, and do not rely on Mongoose's default `__v` behavior to enforce this contract.

Delete matches `{ _id, userId, version: expectedVersion }` atomically. If save/delete matches nothing, perform an owner-scoped existence check: absent returns `404`, present returns `409`. Races may change that classification, but cannot authorize a stale write. A version overflow must fail without mutation rather than wrap; it is not a practical first-version UI case.

When two tabs save version 1, exactly one succeeds with version 2. The other receives `409`, keeps its draft and old baseline version, and cannot silently force a retry using a newly fetched version. The user may copy their draft, explicitly discard it and reload the saved note, then reapply changes and Save. No automatic merge, force-overwrite button, or stored version history is proposed.

## Architecture decisions — approved

- Keep React/Vite, Express.js REST APIs, Mongoose, localhost MongoDB (`astitva`), existing relative `/api` requests, and the private profile shell. Recommend one small Notes component and a dedicated route/model group; use current styles and API helpers.
- Activate the existing Notes placeholder as a real private page. Implement unsaved navigation handling at the private shell boundary as well as inside Notes so links, browser history, and logout cannot bypass it. Keep this change limited to guarding the Notes editor.
- Use explicit Save, a baseline comparison for dirty state, and an application-managed integer version for atomic concurrency checks. This requires no locks, transactions, realtime service, or replica-set setup.
- Recommend 120-character titles, 10,000-character bodies, and 20 summaries per list page with a maximum of 50. Fetch bodies only on open. Load more makes older notes reachable without an unbounded response.
- Pagination is a live list, not a snapshot. Concurrent updates can move notes between pages; deduplicate IDs when appending pages and refresh from page one after local mutations or explicit Refresh. Do not promise a perfectly frozen list across tabs. A list refresh must never replace a dirty editor.
- Store UTC timestamps as instants and display local update times; no date-only grouping is needed. Sort on server timestamps with an ID tie-breaker.
- Preserve authentication and verification in both frontend and every route; owner/version predicates also apply to retries and conflict checks. Avoid unrelated auth refactors. A proposal is not authorization to implement or modify API design files.

## Acceptance criteria — for future implementation

- A verified user opens Quick Notes from the existing Notes link within the private workspace; logged-out requests return `401`, unverified requests `403`.
- Creating a draft makes no database record until Save. Saved title/body persist across reload; opening, editing, and deleting work as specified.
- Titles are trimmed and validated; body whitespace survives a round trip. Empty bodies and duplicate titles are allowed. HTML/Markdown-like content stays literal text.
- Notes sort newest-updated first with deterministic tie ordering. Each list response is bounded, omits bodies, and Load more can reach older notes; refreshing resets pagination without destroying the editor draft.
- Dirty state appears when content differs from its saved baseline and clears on successful save or exact reversion. Navigating away, switching notes, starting another note, using browser history, and logging out warn before dirty text is discarded. Cancel preserves the current editor; supported reload/close actions trigger the browser warning.
- Deletion of saved notes always asks for confirmation and uses the loaded version. Cancel preserves text; successful deletion removes the note and restores useful focus.
- Failed saves retain title/body. A successful save with a failed list refresh stays marked saved. Uncertain creates are not automatically retried.
- Two simultaneous saves with one version produce one success and one conflict. A stale delete cannot remove newer edits. Conflict and deleted-elsewhere states preserve the draft and require explicit action; reloading a newer version does not silently resubmit local text.
- Another account cannot list, open, save, or delete the first account's notes, including by guessed IDs or reused pagination cursors.
- Blank/overlong/multiline titles, overlong bodies, wrong types, unknown fields, invalid pagination and missing versions receive the documented errors without mutation.
- Loading, empty, error, saving, unsaved, and conflict states are visible; keyboard users can perform every action. Wide and narrow layouts fit without horizontal page scrolling.
- After approval and implementation, OpenAPI, Postman, and MongoDB design documentation cover the reviewed contract and representative errors. The feature runs locally with the existing stack.

### Local verification

Documentation only; no implementation tests run. After implementation approval, verify the criteria with two verified users, an unverified user, and two tabs editing the same note. Exercise save/save and save/delete races, a deleted note, large and invalid inputs, multiple list pages and tied timestamps, keyboard/narrow layouts, browser navigation warnings, and simulated save/load failures. Run appropriate server tests and the web build, then review the documented Postman requests locally.

## Open questions

None. The project owner approved the proposed responsive layout, plain-text scope and limits, explicit-save and unsaved-navigation behavior, deletion confirmation, and integer-version conflict handling.
