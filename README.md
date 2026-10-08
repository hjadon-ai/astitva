Context:
I am building a simple single page website
Idea is to build a web application powered by backend
The development sould be very slow
I will take all solution architect based decisions
Do not deploy the application without an explicit deployment request. Local implementation and validation come first.

Task:
Create folder structure for the web application
Create seperate folder strcuture for backend application 
Create/suggest folder structure for mcp tool/server

Constraints:
Do simple small tasks and ask for my input
Increase speed once I allow
Keep first version very simple
Help me learn with you
I am technical developer and designer
I get uncomfortable if I do not understand the wireframe

Working process:
- Suggest one small change at a time and explain its purpose.
- Wait for my approval before creating folders, files, or code.
- Do not choose frameworks or architecture on my behalf.
- Before implementing a page, agree with me on a simple wireframe.
- After each change, explain what changed and pause for my review.

Current status:
- The React web application runs locally on port 3000.
- The Express server runs locally on port 3001.
- MongoDB runs locally. Dev uses `astitva`; Stage uses the isolated `astitva_stage` database.
- Health, signup, email verification, password reset, login, current-user, and logout APIs are implemented and documented for Postman.
- Signup, email verification, password reset, login, profile-session restoration, and logout are connected to the local authentication APIs.
- The authenticated Overview tab currently contains sample layout content.
- Daily diet tracking and Finance are available from the verified profile. Dev uses Plaid Sandbox; Stage uses Plaid Production for real accounts.
- Finance reads synchronized data from local MongoDB; Plaid credentials and encrypted access tokens remain on the server.

Feature tracking:
- Keep the feature index in `docs/features/README.md`.
- Give every feature an ID such as `F001`.
- Write and review the feature document before implementation.
- Use these statuses: Proposed, Approved, In Progress, Review, Done.
- Record the Git branch and pull request in the feature document when they exist.

Git workflow:
1. Approve the feature document.
2. Create a branch named `feature/F###-short-name`.
3. Implement only the approved scope.
4. Run and review the feature locally.
5. Commit the reviewed changes.
6. Push only the feature branch when requested; never push directly to `main`.
7. Give the user the branch name and ask them to create and review a pull request. Record its link in the feature index when it exists.
8. The user merges the pull request manually; then mark the feature Done.

Remote rule:
- Do not initialize a remote, push a branch, or create a pull request without an explicit request. Never merge a pull request on the user's behalf or push directly to `main`.
- A request to build, proceed, or test authorizes local work only.

ChatGPT brainstorming project:
- Setup files are in `chatgpt-project/`.
- Use that ChatGPT Project to brainstorm and produce copy-ready Codex feature prompts.
- Keep repository implementation and Git actions in Codex under the workflow above.

F005 is ready for manual review: Diet is accessible from the verified profile, with meal entry, daily totals, fiber, and editable targets. See `docs/features/diet/F005-daily-diet-tracking.md` for manual checks.

## Local environments

Install dependencies once in `server/` and `web/`, then start MongoDB and Mailpit. Configure one or both ignored profile files from their tracked examples:

- `server/.env.dev.example` → `server/.env.dev` for Plaid Sandbox and `astitva`
- `server/.env.stage.example` → `server/.env.stage` for Plaid Production/Trial and `astitva_stage`

Use independent 32-byte finance encryption keys. Then run one profile from the repository root:

```sh
./scripts/start-local.sh dev
./scripts/start-local.sh stage
```

Only one profile runs at a time on ports `3000` and `3001`. Stage remains local; browser Plaid Link and server requests to Plaid are its only external communication. Import the matching Dev or Stage Postman environment from `server/design/`.

F006 is ready for manual review. F007 adds the isolated local Stage profile and environment banner. See their feature documents in `docs/features/` for manual checks.

F011 is ready for manual review on `feature/F011-application-visual-system`. It adds the shared light visual system, responsive application shell, Lucide icons, reusable presentation components, and consistent styling without changing API behavior.

F009 Daily Priorities is ready for manual review on `feature/F009-daily-priorities`.
The private page supports up to three priorities per day, completion progress,
past-date navigation, inline editing and deletion, and local MongoDB persistence.
The automated MongoDB ownership and concurrency suite and the web build pass. See
`docs/features/priorities/F009-daily-priorities.md` for the manual browser checklist.

F012 adds a locally reviewable Production profile and deployment configuration for Firebase Hosting, Render, MongoDB Atlas, invite-only signup, and provider-neutral SMTP. It does not deploy anything. See `docs/infra/production.md`.

F008 Diet targets and Meal Library is implemented on `feature/F008-diet-targets-meal-library` and merged into main. It adds six daily targets, water tracking, a personal Meal Library, and CSV preview/import.

## Anonymous Chat notifications (F032)

Message sends now use `POST /api/chat/conversations/:id/messages` with `{ text, clientMessageId }` and `X-Chat-Unlock`. Keep the UUID v4 unchanged for retries. The server derives identity/alias and atomically saves the Firestore message and a durable notification claim. History, pagination, and live listeners stay direct Firestore reads. Older direct-write clients do not trigger notifications; no Cloud Functions or browser push are used.

Future iOS clients register an FCM token with `PUT /api/notifications/devices` (`{ token, platform: "ios" }`) and remove it with authenticated `DELETE` (`{ token }`). Registrations belong to one account/session and expire after two inactive days; refresh on login, foreground entry, and token changes, and remove before logout/account switch. Logout/expiry disables notification eligibility even before TTL cleanup.

The generic payload is **Daily Check** / **You have a new chat message.** Only notification type and conversation ID are routing data; tapping must still enforce session, feature access and PIN unlock. Never show message text/aliases or persist PINs from push data. Saved-message responses distinguish `submitted`, `not_requested`, `failed`, and `pending`. Submission does not guarantee display. There is no notification retry worker: an interrupted claim may miss a notification, and resending the same message identifier never resubmits it.

Reuse server `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_BASE64`; no new server environment variables or secrets are required. Enable the FCM HTTP v1 API and grant the existing service account Messaging permissions in the same Firebase project. Later iOS work must register the real bundle ID/Firebase iOS app, configure APNs credentials in Firebase, enable the Push Notifications entitlement, request notification permission, integrate Firebase Messaging token refresh, and handle authenticated locked-chat navigation. These external settings and actual device display are not verified by local mocked tests. [FCM has no usage charge](https://firebase.google.com/pricing); Firestore operations, Render, storage, and other infrastructure retain separate quotas/costs.

Local verification: `cd server && ASTITVA_TEST_NOTIFICATIONS=1 ASTITVA_TEST_CHAT=1 npm test`; then `cd ../web && npm test && npm run build`. These integration checks use random local MongoDB fixtures and fake Firebase/FCM, never production records or real notifications. Current status and handoff context live in [F032](docs/features/chat/F032-private-chat-push-notifications.md).

## Local Development Control Center

Tracked source: [tools/control-center](tools/control-center/README.md). Start with `node tools/control-center/server.mjs`; validate with `npm --prefix tools/control-center test` and `npm --prefix tools/control-center run check`. Node `>=22.20.0 <25`, no dependencies. Runtime data remains ignored under `.local/control-center/`. Development evaluations are manual dry runs only.


## Shared family units (F035, local review)

The Family tab includes shared Born-in/Formed units, relationship-first NON_USER creation, exact-email requests and explicit in-app relationship/merge decisions. Combining two units needs one current ADMIN acceptance from each side; email links only open the inbox. Existing legacy families remain separately available and are never automatically converted. An account with legacy family records needs an owner-reviewed conversion mapping before normalized creation/linking. See [F035](docs/features/family/F035-shared-family-units.md).

All normalized writes require replica-set transactions. The local MongoDB service now uses the single-node `astitvaLocal` replica set with the same database directory and port 27017. Dev/Stage database isolation and environment files remain unchanged. No production configuration or data conversion was performed.

F035 validation uses an isolated test replica set at port 27135, named `f035test`, with a disposable `f035_fixture_*` database:

```sh
ASTITVA_TEST_FAMILY_UNITS=1 F035_TEST_MONGODB_URL='mongodb://127.0.0.1:27135/f035_fixture_review?replicaSet=f035test' node --test server/test/family-graph.test.js server/test/family-units.integration.test.js
node server/scripts/family-conversion-preview.js server/test/fixtures/f035-conversion.json
```

The test requires that isolated replica set to be running; it refuses other URIs and removes only its disposable database. Email is mocked. The conversion preview uses synthetic input and never changes records. API documentation: `server/design/family-units.openapi.json`, aggregate OpenAPI and the **Shared Family Units (F035)** Postman folder. Refresh actual revisions/previewRevisions before Postman mutations; cookie writes require an approved Origin header.

## Shared family-member workspace (F034, local review)

In your personal Family view, use Sharing to grant or revoke Diet, Finance or scoped Family information for accepted members. The top-right **Viewing workspace** selector opens only another member's explicitly shared modules, using read-only module layouts. **Self** or **Back to my profile** restores your own workspace. F035's existing family units/requests remain in place; legacy data is not automatically converted.

From the Astitva repository, run `./scripts/start-local.sh stage` (local Stage) or `./scripts/start-local.sh dev` (Sandbox), then open http://localhost:3000. Start only one profile on ports 3000/3001. This requires your existing local MongoDB/Mailpit and ignored profile configuration. Shared Family grants retain their original member scope; additional members need a fresh explicit grant. No deployment was performed.

F036 managed NON_USER workspaces: ADMIN/EDITOR select a Non User from the family selector to manage enabled general modules (Diet, Daily Priorities, Family information). Finance, Anonymous Chat and Admin are premium and unavailable. No separate account or session is created. Category registration is explicit in server/src/services/featureCategories.js. Claiming transfers managed records atomically; conflicting existing account data/identity requires review, and automatic manager access ends. No editing-consent grant API is introduced; existing account sharing remains read-only.

## Named meal libraries (F037, local review)

Diet → Meal Library now supports named collections, CSV preview, a format-only AI prompt, manual items, verified-account read-only sharing and public discovery. Admin Panel → Meal libraries reviews submitted drafts and publishes approved snapshots. Owner edits remain private until another publication. Existing personal templates become My personal meals on opening the list, idempotently; original templates and logged nutrition remain intact. Archive stops new selections; previously distributed libraries retain records. A migrated library is archived even if private so preserved source rows cannot accidentally recreate it. No automatic AI, email or deployment. Normal MongoDB replica-set support is required for reference/import/log transactions.

Synthetic integration check: `ASTITVA_TEST_MEAL_LIBRARIES=1 F037_TEST_MONGODB_URL='mongodb://127.0.0.1:27135/f037_fixture_review?replicaSet=f035test' node --test server/test/meal-libraries.integration.test.js`. API specification: server/design/meal-libraries.openapi.json; Postman folder Named Meal Libraries (F037).
