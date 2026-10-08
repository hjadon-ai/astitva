# F037: Named shared meal libraries

- **Status:** Review
- **Branch:** `feature/F037-shared-meal-libraries`
- **Pull request:** Not created
- **Approval:** Owner requested local implementation; approved remaining defaults in chat.

## Goal
Create named meal libraries through CSV preview or manual items, use one database entity for multiple users, and allow Admin-reviewed public publication.

## User flow and wireframe
Diet → Meal Library → My libraries / Public libraries → library cards → selected library items and Add to day. Create panel: name, nutrition source, description, tags, optional CSV → preview rows/errors → select rows → accept. Include format-only AI prompt and sample download. Owner actions: edit items, share with verified account by exact email, revoke, submit, delete/archive. Recipient: remove reference. Admin Panel → Meal libraries → inspect submitted metadata/items → publish or return with feedback; unpublish available.

## In scope
Independent libraries; user references; immutable public snapshots pending review; one-serving validated items; same CSV format as F008 (1 MB/500 rows); owner-only editing; immediate read-only private sharing; existing personal meals lazily converted to one private library without losing source records; daily nutrition snapshots unchanged. Archive disables future selection for everyone. Never-shared/unpublished private library may be hard deleted; ever-shared/public/submitted libraries soft delete. Managed NON_USER libraries belong to the person, with no external sharing/submission authority, and transfer on claiming.

## Out of scope
MCP, AI invocation, external nutrition sources, medical certification, deployment, notification emails, recipient editing.

## API changes
Authenticated Diet APIs under /api/diet/libraries: GET list (scope=mine|public), POST create {name,nutritionSource,description,tags,rows}; POST /import-preview multipart file; POST /migrate-existing; GET /:id; PATCH /:id {expectedRevision,...metadata}; POST /:id/items; PATCH/DELETE /:id/items/:itemId; POST /:id/items/:itemId/add-to-day {date,mealType,quantity}; PUT /:id/access {expectedRevision,email}; DELETE /:id/access/:userId; PUT/DELETE /:id/reference; POST /:id/submit; DELETE /:id (expectedRevision). Owner mutations require revision, 409 on concurrent changes; 400 invalid CSV/items; 404 inaccessible; 403 managed distribution prohibited.
Admin /api/admin/meal-libraries GET review list; GET /:id draft; POST /:id/review {expectedRevision,action:publish|return|unpublish,feedback}. Only configured application Admins. Public revisions stay immutable until another review; private recipients see current owner draft. Submitted draft is locked until decision/withdraw via return by Admin. Archived entities retained.

## MongoDB changes
mealLibraries: ownerId (account or managed person), name, nutritionSource, description, tags, items embedded bounded 500, published snapshot, reviewStatus, feedback, archivedAt, everDistributed, legacyOwnerId, revision. mealLibraryReferences: libraryId,userId,kind owner|shared|saved (unique pair). Shares are explicit references; public discovery requires active published snapshot. No private owner email in public payload. Existing dietLibraryMeals remain intact as migration source; daily meals continue storing nutrition snapshots.

## Architecture decisions
React/Express/MongoDB; embedded library contents enable atomic revision-controlled updates. Transactional reference/share/delete/log operations prevent archive/revoke races. No automatic public updates. Source labels are provenance, not proof of accuracy.

## Acceptance criteria
- Preview saves nothing; rejected rows cannot be imported; same names rejected inside one library.
- Users share one library ID, owner alone edits; no unshared access via forged IDs.
- Admin publication exposes only approved snapshot; draft changes do not modify it.
- Delete/archive/remove follow history rules and never alter daily records.
- Existing items migrate idempotently, and managed access remains authorized on each request.

## Local verification
Synthetic integration suite passed for CSV preview/errors, independent entities, owner/recipient authorization, sharing/revocation, review locking, Admin-only publication, public snapshot isolation, quantity-scaled logging, archive/hard delete, stale revisions, idempotent migration, managed distribution denial and claiming transfer. Ten existing frontend tests passed. Frontend production build passed (existing bundle-size warning). Default server suite and syntax checks recorded after final validation. Browser interaction review remains for the owner at http://localhost:3000 → Diet → Meal Library; Admin Panel → Meal libraries. No commit, push or deployment.

## Open questions
None; owner approved immediate read-only sharing, archive blocking new selections, and existing-items private migration.

Legacy-origin libraries always archive on deletion to prevent retained source records from recreating them. Existing original meal records remain stored as a compatibility source. Discovery displays up to 200 libraries; search filters items inside the selected library. No full library pagination or notifications in this version.

## Iterative Diet UI review

Owner authorized small local presentation/usability refinements with a 10-second interruption window before and after each change, until 10:30 PM Pacific. First change: segmented library browsing, teal/violet/blue access cards, readable review badges, grouped owner actions and responsive styling. Permissions and storage behavior unchanged.

Owner-approved single UI cycle: compact teal date navigation immediately below the unchanged Diet header; icon-only previous/next buttons retain accessible labels and 44px targets, date input and Today retain existing behavior. Stop after this change for owner review.

Owner-approved Nutrition UI cycle: calorie-emphasized responsive summary grid, consistent Consumed/Target hierarchy, teal/blue/amber/violet/green nutrient colors, and explicit red exceeded-target text. Values, target math, sharing and API behavior unchanged.

Owner-requested compact redesign: five-column vertical nutrient progress bars, Calories bar twice the width, capped display with explicit exceeded text, accessible progress values, short rise animation and reduced-motion support. Target calculations unchanged.

Owner refinement: replace individual tinted nutrition tiles with one neutral dashboard card; align bars and values, use muted colors only on fills, place labels below bars, separate Calories with a fine divider and retain its double-width bar. Calculations unchanged.

UI cycle 1: consumed/target values, progress percentages and remaining/over labels; restrained reference-inspired orange/coral/blue/green/violet bars. Calculations and permissions unchanged.

UI cycle 2: keyboard-accessible macro target disclosure keeps formula details available without dominating the overview.

UI cycle 3: compact Water card with blue intake hierarchy, slim progress and responsive quick-add grouping; recording behavior unchanged.

UI cycle 4: meal-group counts and compact, labeled nutrition badges improve scanning without changing meal content.

UI cycle 5: local name search filters fetched library cards independently from item search; no API/permission changes.

Owner-directed Water refinement after interrupting the loop: compact jug widget with vertical target fill, one-shot animation/reduced-motion support, quick-add buttons and expandable custom entry/history. Water APIs and stored amounts unchanged.

UI cycle 6: responsive Nutrition/Water overview grouping; shared Diet remains Nutrition-only.

UI cycle 7: compact manual/library meal action strip, with accessible expanded-state connection to library content.

UI cycle 8: neutral Lucide meal-type markers and compact meal-row alignment, retaining visible edit/delete actions.

UI cycle 9: compact library creation steps, visible CSV size/row limits and clearer validation panels. Import logic unchanged.

UI cycle 10: consistent visible keyboard focus, readable mobile form inputs and single-column editors. Ten-cycle session complete; no automatic continuation, commit or deployment. Frontend build and whitespace checks passed after each change; final frontend tests passed. Browser interaction review remains owner-led.

Owner-requested intake layout: combine Water and daily Meals in one fixed-height keyboard-scrollable panel beside Nutrition on desktop, below it on narrow screens. Shared Diet shows meals without private Water controls. Logging, edit and delete actions remain intact.

Owner correction: intake panel now sits below Nutrition, Water remains outside the scroll container, and only Meals scrolls. Water writes use confirmed API entry responses to update water state in place, preserving Nutrition, library/form state and meal scroll position. Failed writes leave intake unchanged. Added a focused water recalculation test.

Owner-requested target editor: render a compact responsive target form inside Daily Overview; bottom editor now handles meal entries only. Target validation and save API unchanged.

Owner-approved target behavior change: Calories are read-only in the editor and derived on every server save from protein ×4 + carbohydrate ×4 + fat ×9, rounded to whole kcal. Fiber remains separate. Water remains editable. Existing target records are preserved until the owner next saves. Legacy callers may send calories but that value is ignored; OpenAPI/Postman updated.

Owner-requested target popover: icon trigger with tooltip/accessible label, click toggle, attached form and mouse-leave close. Keyboard editing stays open until focus leaves; Escape closes and returns focus. Touch closes through toggle/Cancel. Busy saves do not close on hover out.

### Local UI refinement — daily tracker meal search

Meal logging sits alongside water and daily meals. A single search includes items from owned, shared and saved libraries (existing 200-library API limit), showing library and serving context. Select an item, choose meal type and serving quantity, then add to the selected day. Existing authorization remains enforced by the add-to-day API. Manual entry and library management remain available; shared read-only Diet views hide logging controls. Successful quick additions refresh meal totals without replacing the water tracker.

Daily Tracker layout refinement: one section header, a stable blue-tinted hydration card, a fixed meal composer with visible meal/serving labels, and a separately scrollable meal history. Meal actions use labelled icons; mobile stacks hydration above meals. Search result rows distinguish food names from source libraries; successful additions have an inline confirmation.

Tracker revision: hydration and meal logging occupy two entry cards, followed by a full-width meal timeline grouped by category. Meal history uses natural document scrolling, with no fixed-height internal scroller. Search suggestions sit directly beneath the search field; quantity/type remain in the composer. Mobile stacks both entry cards above the timeline.

### Intake history — owner-requested enhancement

An accessible chart icon in Daily Overview switches to intake trends; the return icon restores daily overview. The latest ten calendar days include calories, protein, carbs, fat, fiber and water. Previous/next controls browse ten-day windows back to three calendar months ago, with a partial window at the boundary. The server validates date/timezone bounds and derives the owner from the session or reauthorized managed-member context. Shared read-only contexts do not expose this new endpoint through their UI.

`GET /api/diet/history?end=YYYY-MM-DD&timezone=America/Los_Angeles` returns bounds, current targets, and up to ten daily aggregate totals plus meal/water entry counts. Both query parameters are optional; end defaults to timezone-local today, timezone defaults to UTC. Invalid input or out-of-range dates return 400; existing authentication and feature/managed authorization return 401/403. Existing owner/date indexes support bounded aggregation; no model or collection changes.

Chart lines show percentage of each current target, with a dashed 100% reference, selectable series and keyboard-accessible daily detail buttons. Historical targets are not stored; this limitation is visible. Days with no entries are distinguished with hollow points and counts; they do not prove actual zero consumption. No targets disables that metric's percentage series while retaining raw daily values. No new dependencies, scheduled work, production changes or external integrations.

Overview refinement: daily bars and history share a two-face card with a short 3D flip. The hidden face is inert and excluded from accessibility; reduced-motion preference disables the transition. History loads on first use and remains mounted to preserve date/series selection. Both faces share maximum natural height, including responsive content. The SVG uses fixed visual height and non-scaling strokes, finer grid lines and clear day controls; pointer inspection and keyboard daily buttons update the same detail summary.

Sizing correction: Nutrition now determines the flip card height. The chart face is positioned within the same bounds, with a compact toolbar, legend, plot and daily summary. Graph content no longer increases Nutrition height; responsive SVG dimensions follow the space available.

CSV prompt refinement: the owner-supplied prompt now asks an external AI to confirm the CSV format, ask 3–5 adaptive multiple-choice questions, summarize, then generate the ten-column CSV. Icon links open ChatGPT, Claude and Gemini in a new tab. Links send no prompt or application data; users copy and paste manually. CSV preview and validation remain unchanged.

Meal browser refinement: clicking/focusing meal search opens all available items grouped under their added libraries. Library groups support independent collapse/expand and global controls. An All libraries selector narrows search to one library; text searches names, serving descriptions and library names. Selection closes the popup and retains the quantity/type add flow. Escape, outside click and leaving focus close the popup; Arrow Down moves from search to the library filter. Existing API limits and server authorization remain unchanged.
