# MongoDB collections

Databases on local MongoDB port `27017`:

- Dev: `astitva`
- Stage: `astitva_stage`

The application connects to only one database per process. It never copies or queries data across profiles.

## families and familyInvitations (F018)

`families` stores a creator User ID and embedded `people`, `relations`, and `shares`. A person has one stable embedded ObjectId, name, optional invitation email, optional linked User ID, chosen male/female/neutral relationship label, ADMIN/EDITOR/READONLY role, and NON_USER/PENDING/ACCEPTED status. Only an accepted linked person can authenticate into a family. Relations are directed parent-to-child or symmetric sibling/partner pairs; labels and Born in/Spouse grouping are calculated from the signed-in person's perspective. A child added under a partner pair receives a parent edge from each partner. One current partner per person is enforced by the API. Siblings are never inferred.

`shares` contains an owner User ID, recipient User ID, and `diet` or `finance` feature. It starts empty; only the owner can add or remove a grant. The read endpoint checks both accounts are still accepted members and the grant on every request. Finance reads project display fields and exclude connections, encrypted access tokens, and provider credentials. Removing a relationship prunes people no longer connected to the creator and removes their grants and pending invitations; it never deletes Astitva user accounts.

`familyInvitations` stores family ID, person ID, normalized email, SHA-256 hash of a random single-use token, and seven-day expiration. A TTL index expires old invitations. Acceptance checks the logged-in verified User email, exactly one matching User record, the pending person, and no existing link to that User in the family before filling the existing person's `userId`. Neither a matching email nor a pending invite grants access. Resending replaces the prior token.

The verified recipient can see active invitations in the Family tab and accept there without retaining the emailed URL. The email link remains valid too. When an invited account created an empty personal family before accepting, acceptance removes that self-only document so the shared family becomes its single view. A personal family with actual relationships is preserved as a separate view.

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
