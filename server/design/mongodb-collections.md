# MongoDB collections

Databases on local MongoDB port `27017`:

- Dev: `astitva`
- Stage: `astitva_stage`

The application connects to only one database per process. It never copies or queries data across profiles.

## invitedEmails (F012)

`invitedEmails` replaces the Production `INVITED_EMAILS` Render variable. It stores one normalized, unique email address, timestamps, and top-level Boolean feature flags: `priorities`, `diet`, `finance`, `family`, and `chat`. An absent record or absent flag defaults to Family only (`family: true`; all others `false`). The API checks the current flags for every authenticated feature request, and `/api/auth/login` and `/api/auth/me` return them for navigation. Setting a flag to `false` revokes that feature even for an existing account. A successful Family invitation upserts the address whether or not the account already exists. Production signup checks this collection before creating a User; an active matching Family invitation token remains a fallback for links sent before this change. Neither an invited-email record nor a matching account links a person to a family; verified login and explicit invitation acceptance remain required. For an initial owner signup, add that address to the collection manually in Atlas before removing the old Render variable.

Local Stage includes `sample.invited@example.invalid` with `family: true` and all other flags `false` as an example. This placeholder cannot receive email and is not a usable sign-in account.

## families and familyInvitations (F018)

`families` stores a creator User ID and embedded `people`, `relations`, and `shares`. A person has one stable embedded ObjectId, name, optional invitation email, optional linked User ID, chosen male/female/neutral relationship label, ADMIN/EDITOR/READONLY role, and NON_USER/PENDING/ACCEPTED status. Only an accepted linked person can authenticate into a family. Relations are directed parent-to-child or symmetric sibling/partner pairs; labels and Born in/Spouse grouping are calculated from the signed-in person's perspective. A child added under a partner pair receives a parent edge from each partner. One current partner per person is enforced by the API. Siblings are never inferred.

`shares` contains an owner User ID, recipient User ID, and `diet` or `finance` feature. It starts empty; only the owner can add or remove a grant. The read endpoint checks both accounts are still accepted members and the grant on every request. Finance reads project display fields and exclude connections, encrypted access tokens, and provider credentials. Removing a relationship prunes people no longer connected to the creator and removes their grants and pending invitations; it never deletes Astitva user accounts.

`familyInvitations` stores family ID, person ID, normalized email, SHA-256 hash of a random single-use token, and seven-day expiration. A TTL index expires old invitations. Acceptance checks the logged-in verified User email, exactly one matching User record, the pending person, and no existing link to that User in the family before filling the existing person's `userId`. Neither a matching email nor a pending invite grants access. Resending replaces the prior token.

The verified recipient can see active invitations in the Family tab and accept there without retaining the emailed URL. The email link remains valid too. When an invited account created an empty personal family before accepting, acceptance removes that self-only document so the shared family becomes its single view. A personal family with actual relationships is preserved as a separate view.

`familyActivity` (F016) stores display-safe family mutation events for one week. Each event has a family ID, actor User ID and name snapshot (or System), action, optional affected person ID/name and Diet/Finance feature, a short summary, and creation time. An index on `{ familyId: 1, createdAt: -1, _id: -1 }` supports cursor pagination; a TTL index on `createdAt` removes entries after seven days. Reads require current accepted membership. No invitation token, email, credential, or private Diet/Finance contents are stored.

## Finance collections (F006)

`financeConnections` stores one Plaid Item per user, provider environment, and institution. It contains `providerEnvironment` (`sandbox` or `production`), provider and institution identifiers, status, incremental transaction cursor, sync timestamps, excluded provider account IDs, and the Plaid access token encrypted with AES-256-GCM. Plaid credentials and each profile's separate encryption key remain in server environment variables. The server rejects a connection whose stored provider environment does not match the running profile before attempting to decrypt its token.

`financeAccounts` stores the normalized current view of each locally tracked account: owner and connection references, provider account ID, display name and mask, type, asset class, original currency, current/available balance, credit limit, and balance timestamp. Full account and routing numbers are never stored.

`financeTransactions` stores normalized Plaid transaction changes by stable provider transaction ID. Each document includes ownership references, provider dates, merchant/display names, amount and currency, expense/income/other direction, personal-finance category, and pending state. Monthly USD spending excludes pending, income, transfers, and loan payments.

`financeHoldings` stores the latest investment positions by account and provider security ID, including display name, ticker, quantity, price, market value, original currency, and price date. Holdings are replaced during each successful connection sync.

Finance collection indexes enforce provider-ID uniqueness within the owner/account boundary and support owner, account, connection, asset-class, and date queries. Disconnecting an institution deletes its four local data groups after Plaid confirms Item removal. Stopping one account records its provider account ID on the connection exclusion list and deletes only that account's local data.

## Diet collections (F005 and F008)

`dietMeals` stores `userId`, `consumedOn` (YYYY-MM-DD), `name`, `mealType`, optional `servingDescription`, and numeric `calories`, `proteinGrams`, `carbohydrateGrams`, `fatGrams`, `fiberGrams`, plus timestamps. F008 adds `source`, optional `sourceLibraryMealId`, and `quantity` as snapshot metadata. A library meal is copied into these fields, so later library edits and deletion do not change history. Index `(userId, consumedOn)` supports private daily queries.

`dietNutritionTargets` stores one unique `userId`, the five nutrition targets, `waterMilliliters`, and timestamps. Existing F005 documents may omit water until the owner saves the enhanced form. Targets apply to all dates, including past dates. Calories and water are whole numbers; grams have at most one decimal place. Meals allow zero; targets must be positive. Daily totals and the 4/4/9 macro comparison are calculated, not persisted.

`dietWaterEntries` stores each intake action with `userId`, `consumedOn`, positive whole-number `amountMilliliters`, and timestamps. Amounts are limited to 5,000 ml per entry. Index `(userId, consumedOn)` supports daily totals and entry deletion.

`dietLibraryMeals` stores private, reusable one-serving meals. Each document has `userId`, display `name`, unique-per-owner `normalizedName`, category, serving description, the five nutrition values, optional ingredients and notes, and timestamps. Indexes on `(userId, normalizedName)` and `(userId, category, name)` support duplicate prevention, listing, filtering, and search. Uploaded CSV data is validated in memory and is never stored as a file or preview document.

## users

Stores local accounts.

| Field | Type | Purpose |
| --- | --- | --- |
| `name` | String | Display name |
| `email` | String | Unique, normalized login email |
| `passwordHash` | String | Bcrypt password hash; the password is never stored |
| `emailVerifiedAt` | Date or null | Time ownership of the email was verified |
| `passwordResetRequestTimestamps` | Date array | Successful reset-email requests retained for the rolling 24-hour limit |
| `createdAt` | Date | Creation time |
| `updatedAt` | Date | Last update time |

## emailVerificationTokens

Stores single-use email verification tokens. Only the SHA-256 hash is stored. Expired records are removed by a MongoDB TTL index.

| Field | Type | Purpose |
| --- | --- | --- |
| `tokenHash` | String | Unique SHA-256 hash of the emailed token |
| `userId` | ObjectId | Reference to the unverified user |
| `expiresAt` | Date | One-hour expiration and TTL field |
| `createdAt` | Date | Creation time |
| `updatedAt` | Date | Last update time |

## sessions

Stores login sessions. Expired records are removed by a MongoDB TTL index.

| Field | Type | Purpose |
| --- | --- | --- |
| `tokenHash` | String | SHA-256 hash of the browser session token |
| `userId` | ObjectId | Reference to the user |
| `expiresAt` | Date | Session expiration and TTL field |
| `createdAt` | Date | Creation time |
| `updatedAt` | Date | Last update time |

## passwordResetTokens

Stores single-use password-reset tokens. Only the SHA-256 hash is stored. Expired records are removed by a MongoDB TTL index.

| Field | Type | Purpose |
| --- | --- | --- |
| `tokenHash` | String | Unique SHA-256 hash of the emailed token |
| `userId` | ObjectId | Reference to the verified user |
| `expiresAt` | Date | One-hour expiration and TTL field |
| `createdAt` | Date | Creation time |
| `updatedAt` | Date | Last update time |

## `dailyPriorityDays` (F009)

One private calendar day per user, with up to three priorities in insertion order.
`userId` is a required immutable User ObjectId derived exclusively from the session;
`date` is a required immutable real `YYYY-MM-DD` calendar date. `priorities` defaults
to an empty array and contains at most three embedded items, each with a generated
ObjectId `_id`, a required trimmed single-line `title` (1–120 JavaScript string
units), and a required boolean `completed` (default false). Day `createdAt` and
`updatedAt` are server-managed BSON Dates. Progress is calculated, never stored.

The unique `{ userId: 1, date: 1 }` index is created before the server accepts
requests; retain the default `_id` index. Empty days remain after deletion. GET
never initializes a day. POST first performs an owner/date-only `$setOnInsert`
upsert (duplicate-key races reuse that same day), then a non-upsert atomic `$push`
filtered by `'priorities.2': { $exists: false }`. A missed capacity predicate is
409. PATCH uses positional `$set` of supplied fields only; DELETE uses `$pull`.
Every filter includes owner/date and item mutations also match item ID. No stale
array replacements, process locks, replica sets, or transactions are required.

The browser-declared `X-Time-Zone` IANA zone determines today's server-side upper
bound; it is a calendar preference, never authorization. Dates remain verbatim
strings across timezone changes. No automatic carryover or day deletion exists.

## Anonymous Chat collections (F027)

`chatInvitations` stores the creator User ID, creator alias, SHA-256 hash of a 32-byte random invitation token, pending/accepted/declined state, and a 24-hour claim expiry. The raw token is returned once for manual sharing and is never stored. A TTL index removes invitations one day after expiry; claim atomically changes pending state so a URL can be accepted once.

`chatConversations` stores two participant User IDs and aliases, one hashed six-digit PIN verifier and attempt/lockout/unlock state per participant, and messages containing sender ID, text, and timestamp. Unlock tokens are random, stored only as hashes, valid for 15 minutes, and scoped to a participant and conversation. No PIN or unlock token is stored in plaintext. Only accepted participants can list or access a conversation; messages require an active unlock. Deleting one or all conversations removes them for both participants.

`chatDeletions` stores only the two normalized account email IDs, message count, serialized byte count deleted, and deletion time. A TTL index removes the record after 30 days. It contains no alias, PIN, invitation token, or message content.

## Admin Panel (F031)

No new collection or admin role field is added. `ADMIN_EMAILS` is server runtime configuration, and only matching verified users can access admin APIs. User profile fields remain read-only; feature edits update `invitedEmails` by normalized email, including for registered users. The existing unique email index prevents duplicate invitees. Admin create sends an invitation email without creating a User or verifying an account. Delivery failures preserve the access record.

Admin reads return opaque edit versions derived from each record's ID, timestamp and editable values. Feature access saves through conditional single-document writes, allowing standalone local MongoDB without multi-document transactions. A stale version returns `409`. Existing records and missing legacy flags require no migration; a missing access record is created conditionally using email uniqueness. Search escapes literal input, bounds result pages, and applies a five-second query limit. Substring search does not assume that a normal name index will optimize it.

Disabling Chat saves the access flag first, then removes the user's Firestore grants in bounded batches. No successful response is returned before cleanup finishes. A Firestore outage returns `503 CHAT_REVOCATION_PENDING` explaining that access was saved and existing grant cleanup needs retry; reload and save disabled Chat again. New Chat bootstrap requests recheck feature access after grant/token creation and remove the new grant if access was disabled during the request. This is a cross-store operation, not a MongoDB/Firestore transaction.

## Notification devices (F032)

`notificationDevices` stores user/session references, platform (`ios`), sensitive token (excluded by default from model selections), unique SHA-256 token digest, random registration revision, and timestamps. Unique digest prevents duplicate ownership; owner ID supports lookup. `updatedAt` has a two-day TTL index. Registration refreshes expiry; dispatch also filters inactivity, active matching sessions, verified users, and current Chat access. MongoDB TTL cleanup is asynchronous and does not control eligibility. No polling cleanup job. Permanent FCM failures delete only the exact selected owner/session/revision.

Firestore `chats/{id}/sendRequests/{messageId}` is server-only idempotency/dispatch bookkeeping with text digest, creation timestamp and notification status; no second message-body store. It is denied to clients by existing default-deny rules and is removed with recursive chat deletion. Retain it for the conversation lifetime so old retries cannot duplicate messages; no time-based expiry that would reopen identifiers. Messages keep exactly the existing F029 fields. Sends atomically create message/claim and touch the chat parent; deletion tombstones the parent before removing MongoDB/Firestore records. Notification submission is at most once per application send identifier; a crash can leave a pending claim. Cross-provider notification delivery cannot be atomically tied to MongoDB logout or account switch once an APNs request is already in flight.

### F020 family person details

Existing `families.people` add nullable preferredName (trimmed single-line, max 80 UTF-16 code units), birthDate (real YYYY-MM-DD calendar date), and note (plain text, max 1000 UTF-16 code units). Age is derived from viewer local date, never stored. No new collection/index. Existing person IDs, user links, roles, relations, invitation state and shares are preserved; users are never updated. ADMIN/EDITOR writes require accepted membership.

### F023 Family Social

`familyPosts`: familyId, authorId/name snapshot, type (update/milestone/announcement), plain text (max 2000), audience (family/selected) and recipient account IDs (max 100), optional embedded photo bytes/MIME (JPEG/PNG, max 2 MiB), reactions (unique caller IDs, max 1000), integer version, deletion flag and timestamps. Compound familyId/deleted/createdAt/_id index supports bounded chronological pagination; reads omit image bytes and expose only authorized photo endpoints. Soft removal clears text/photo/reactions, hides all content and deletes comments. No automatic retention expiry.

`familyPostComments`: familyId, postId, authorId/name snapshot, plain text max 500, timestamps; postId/createdAt/_id index. All operations authenticate current accepted membership and post audience. Pending, removed and unrelated accounts are denied. READONLY may write as explicitly approved. User IDs preserve selected-recipient identity after re-entry.

`families.pinnedPostId`: nullable post reference. Atomic pointer replacement guarantees at most one announcement pin per family. Audience authorization applies to reading the pinned post; pinning never widens audience. No new photo storage integration.


## Shared family units (F035)

Normalized authoritative collections: `familyPeople` (stable identity, optional partial-unique linked User ID, name/gender), `familyUnits` (creator attribution, per-person relationship anchors, revision, ACTIVE/MERGED and mergedIntoId), `familyMemberships` (unique unit/person pair, role, unit-scoped optional details), and `familyRelationships` (unit-scoped directional parent/canonical partner/sibling edges). Born-in/Formed context is derived from edges and initial relationship anchors relative to each viewer; it is not a permanent unit type.

`familyRequests` stores exact-email recipient, initiator, source/target units and identities, optional selected NON_USER, explicit relationship decision, per-unit ADMIN approvals/revisions, seven-day expiry, idempotency key, pin choice and delivery state. No raw invitation token is required for the email link: it opens the authenticated in-app inbox. `familyRequestQuotas` enforces two sends per sender/recipient/UTC day transactionally. Delivery uses a single PENDING → SENDING claim, then SENT/FAILED; an interrupted SENDING remains visibly unresolved without automatic retry.

`familyMerges` is a durable, unique-per-request transactional audit with source/survivor IDs, consenting ADMINs, revisions and preserved person IDs. The older unit survives, with ID order breaking timestamp ties. The retired normalized unit remains MERGED with mergedIntoId. Membership conflicts choose ADMIN > EDITOR > READONLY. People are never deduplicated automatically.

A `families` document with `normalizedUnit: true` is a compatibility projection for the existing sharing, activity and social APIs, not authoritative person/role/relationship storage. F035 regenerates its people/edges inside transactions; legacy identity mutations are denied for these units. Existing sharing/social writes acquire a transactional unit revision so concurrent merge previews become stale. Retired compatibility projections are removed only inside the merge transaction; audit/retired normalized units remain.

Merging preserves existing grants, posts, comments, invitation and activity references. Older family-wide social posts become selected-audience posts addressed only to their original accepted accounts, preventing new access through a merge. Multiple pins require an explicit keeper choice; both posts survive. Conflicting unit-scoped member details block merging. Linked accounts and private owner data are never removed by NON_USER cleanup. Removal explicitly detaches incident relationships and clears historical person references while retaining name snapshots; pending requests/invitations block removal. Global identity removal requires no remaining membership or request reference.

No existing legacy records are converted automatically. The offline `server/scripts/family-conversion-preview.js` accepts a sanitized owner-provided JSON export and produces only a review report; it has no apply mode or database connection. Ambiguous existing placement requires a reviewed mapping before conversion. New normalized creation/linking is blocked for users with unconverted legacy family records to avoid parallel duplicate representations.

## F034 shared workspace grants

Extend families.shares.feature and familyActivity.feature with family. Family grants include visiblePersonIds (ObjectId array): a snapshot of the originally authorized unit members, intersected with current accepted unit access on every read. Merges preserve/intersect this scope rather than broadening it; missing scopes deny Family reads. Diet/Finance grants remain unchanged. No persisted selected-owner session or copied profile is created.

Family requests: requestedRole (READONLY default, EDITOR or ADMIN) records the initiating ADMIN’s explicit planned recipient role. It activates only at accepted linking/approved merge, after rechecking the initiating ADMIN. Existing higher roles are retained. Member discovery is internal exact-email resolution; no account-existence or private-family directory response is exposed.

F035 Self birth date: `familyPeople.birthDate` is an optional validated YYYY-MM-DD/null field. An explicit Self birth-date edit sets this canonical value and refreshes all active unit projections in one transaction. Membership notes/preferred names remain per-unit. Absent canonical values retain existing per-unit dates until the owner saves Self.

F036 managed ownership: existing dietMeals, dietNutritionTargets, dietWaterEntries, dietLibraryMeals and dailyPriorityDays userId keys may refer to an unlinked familyPeople ID. Only authorized managed-context services resolve those IDs. No pseudo User is created. Linking atomically transfers these keys to the verified account, rejecting existing recipient records. Managed writes increment the person's optimistic version and unit version inside the data transaction to serialize against linking/removal.

## F037 named meal libraries

`mealLibraries` embeds up to 500 validated one-serving items, ownerId, metadata, revision and immutable published snapshot; archivedAt and everDistributed preserve distribution history. `mealLibraryReferences` links libraryId/userId with owner/shared/saved kind and unique pair. OwnerId may be a managed family person; claim transfers it and references atomically. Unique sparse legacyOwnerId makes F008 migration idempotent. Legacy meals and daily nutrition snapshots remain stored.
