# F032: Private Anonymous Chat push notifications

- **Status:** Done
- **Branch:** `feature/changes_04-Oct-2026_2`
- **Pull request:** Not created

## Goal

Prepare the server and web client to send privacy-safe iOS Anonymous Chat notifications through Firebase Cloud Messaging (FCM), without Cloud Functions. Deliver a generic notification after a message is saved; preserve direct Firestore history and live reads.

## User flow

1. A future iOS client registers its FCM device token while signed in with a verified Astitva account. Multiple devices are supported; account switches reassign a token to only the current account.
2. An accepted, Chat-enabled participant unlocks a conversation with their existing PIN and sends a message from web or a future iOS client.
3. Express validates the session, conversation participation, effective feature access, and `X-Chat-Unlock`, then saves the message in Firestore.
4. The existing Firestore listener displays the saved message. The server submits a generic notification to the other participant's registered iOS devices, never the sender's devices.
5. The notification displays exactly **Daily Check** and **You have a new chat message.** Navigation data contains only a notification type and conversation ID; opening it never unlocks a conversation or reveals a message without normal authentication and PIN access.
6. If notification submission fails, the message remains saved. The sender sees a non-blocking warning and does not resend the saved message automatically.

## In scope

- Authenticated, verified device registration and deletion with conservative FCM-token validation, idempotent registration, account-switch reassignment, timestamps, indexes, and rate limits.
- Treat device tokens as sensitive data: no token logs, cross-user responses, normal profile fields, or admin exposure.
- Server-mediated sending to the existing Firestore message collection with server-derived sender UID/alias, existing unlock checks, rate limits, and 1–2,000-character text validation. No message-body logs.
- A stable client-generated send identifier scoped to the authenticated user and conversation; concurrent/repeated submissions must not create duplicate messages or notification dispatches. A reused identifier with different content returns a conflict.
- Submit notifications only after durable message persistence; derive recipients from current accepted/active conversation state and registered devices. Target tokens privately, without public or predictable conversation topics.
- Permanently invalid/unregistered FCM tokens are removed or disabled; transient failures retain tokens. Cleanup must conditionally target the registration used for the send so an account-switch registration is not accidentally removed.
- Notification payload contains no message text, aliases, emails, account names, PINs, unlock tokens, Firestore grant IDs, raw sessions, or other private information.
- Partial-success reporting distinguishes message persistence from notification submission; FCM acceptance does not prove device display.
- Web sends use Express while reads, older-message pagination, and live delivery remain direct Firestore operations.
- Keep a send identifier and draft through recoverable failures, prevent duplicate submissions, and clear the draft only after confirmed persistence. The listener supplies the displayed message; do not insert an optimistic duplicate.
- Preserve existing invitations, PIN lockouts, aliases, locks, grants, custom tokens, deletion, and historical Firestore messages.
- Document contracts, runtime dependencies, migration behavior, APNs/iOS follow-up, and the amended F029 architecture.

## Out of scope

- Editing the Astitva-IOS repository or implementing native FCM registration, permission requests, notification presentation, or tap handling in this feature.
- Browser push notifications, Cloud Functions, Family chat/notifications (F024), public topics, attachments, message previews, and PIN bypass/recovery.
- Reading environment files or credentials, inspecting private production records, sending real messages/invitations/notifications during verification, and deployment/push/publishing.
- Automatically guaranteeing display or exactly-once delivery by Apple/FCM, or a separate general-purpose notification system.

## Wireframe or UI changes

Keep the current compact Anonymous Chat layout. Sending shows a busy state and disables duplicate submission. Recoverable failures retain the draft and retry identifier. A confirmed saved message clears the draft and appears through the existing listener. A notification-submission failure shows a non-blocking “Message saved; notification could not be submitted.” warning. Locking or switching chats must prevent stale send responses from restoring private content.

## API changes

Inspect actual source contracts during implementation; update `server/design/chat.openapi.json`, `server/design/openapi.yaml`, and relevant Postman definitions.

### `PUT /api/notifications/devices`

- Require an active authenticated, verified Astitva session; use existing request-origin/native-transport protections.
- Input: `{ "token": "<FCM registration token>", "platform": "ios" }`.
- Validate token type, bounded length, and non-whitespace shape without assuming an undocumented fixed FCM format; reject unknown fields/platforms.
- Success: `200 { "registered": true }`; never echo tokens.
- Registration is an atomic upsert by unique token/token digest. Reassign ownership to the current user/session and refresh update metadata.
- Errors: 400 validation, 401 expired/missing session, 403 verification/security rejection, 429 rate limit.

### `DELETE /api/notifications/devices`

- Input: `{ "token": "<FCM registration token>" }`; require the same authentication and validation.
- Delete only a registration currently owned by the authenticated user. A stale account cannot remove a reassigned token.
- Success: idempotent `204`, whether or not the caller owns a matching registration.
- Same applicable errors as registration.

### `POST /api/chat/conversations/:id/messages`

- Replace the current 410 direct-Firestore-send response.
- Require an active verified Astitva cookie or bearer session, Chat feature access, accepted conversation participation, and valid unexpired `X-Chat-Unlock`; retain request-security controls.
- Input: `{ "text": "<1–2000 trimmed characters>", "clientMessageId": "<UUID>" }`; reject unknown fields and client sender/alias values.
- Derive sender UID and current alias on the server. Write the existing schema (`senderUid`, `senderAlias`, `text`, `createdAt`) at `chats/{conversationId}/messages/{messageId}`, using a stable ID and Firestore server timestamp. Keep idempotency metadata outside the message's existing field allowlist.
- Result: `{ "messageId": "...", "messageSaved": true, "notificationStatus": "submitted|not_requested|failed|pending", "warning": "optional generic warning" }`.
- First persisted send returns 201; a valid replay returns 200 with the original message/result without another write or notification dispatch. A pending dispatch is reported honestly and can be observed through the same identifier.
- No recipient IDs, token values, or device counts in responses. Failure to submit notifications does not turn a durable message into a failed send.
- Errors before persistence: 400 validation, 401 session, 403 authorization/unlock, 404 inaccessible/missing conversation under existing conventions, 409 identifier-content conflict, 429 rate limit, 503 persistence/service unavailable.
- Keep message GET/history endpoints out of the read path; clients continue using Firestore directly.

## MongoDB changes

- Add a narrowly scoped device-registration collection with owner user ID, registering session reference, platform, sensitive token, unique token digest, creation time, and last-registration/update time. Index token digest uniquely and owner ID for recipient lookup; do not authorize by email.
- No notification-preferences/settings feature is introduced.
- Device eligibility requires a live registration-bound session, verified recipient and enabled Chat. Expired/logged-out sessions cannot receive new submissions.
- Use a two-day `updatedAt` TTL index and dispatch-time inactivity filtering, with no polling worker, plus permanent-invalid-token cleanup. Never persist the token in user/admin response models.
- Keep message bodies canonical in Firestore. If dispatch/idempotency bookkeeping is required, store minimal metadata with its retention and deletion behavior defined; do not copy message bodies to MongoDB.

## Architecture decisions

- Amendment to F029: writes become `web/iOS → Express → Firestore`, followed by server-to-FCM submission. Reads, history, pagination, and live listeners remain `web/iOS → Firestore`.
- Reuse existing Firebase Admin initialization for Messaging; no Cloud Function or new credentials in source control.
- F029 now documents this intentional send-path amendment while preserving its original read/privacy design.
- Existing direct-write clients continue to work under unchanged rules but generate no push notifications. Do not weaken rules or silently claim complete push coverage before clients migrate.
- A Firestore transaction creates message/claim and touches the existing active parent. Sender session/feature/unlock state is rechecked inside each transaction callback. Lock touches the parent and deletion tombstones it before cleanup; bootstrap and alias changes respect the tombstone. Never recreate parent metadata from a send. MongoDB checks and Firestore persistence remain separate stores; already submitted APNs notifications cannot be recalled.
- FCM submission and persistence cannot be one atomic transaction. Prefer durable dispatch claims and conservative at-most-once submission attempts per send identifier: persist claim before calling FCM, do not automatically resubmit an ambiguous attempt after a crash, and return an honest pending/unknown status. This avoids duplicate application submissions but can miss a notification after a crash. Owner approved missing notifications in favor of minimum calls; no automatic application retry worker is used.
- Check current session/device eligibility and recipient feature access before dispatch. Do not treat PIN lock as an automatic notification opt-out; notifications reveal no message content and taps require normal unlock.
- Document Firebase Cloud Messaging availability and separate Firestore/Render/provider quotas without implying the whole architecture has no cost.

## Acceptance criteria

- Unauthenticated/unverified device registration fails; valid registration is idempotent, supports multiple devices, and safely reassigns ownership on account switch.
- Removal affects only the current owner's registration; tokens never appear in normal API responses or logs.
- Message sends reject missing/expired sessions, disabled Chat, non-participants, invalid/expired unlocks, forbidden sender fields, and invalid text.
- Existing Firestore message schema, ordering, history, listeners, and stable IDs remain compatible; sender identity/alias come from the server.
- Notifications target only eligible recipient devices after persistence, with exactly the specified generic title/body and minimal routing data.
- Permanent invalid-token cleanup is scoped correctly; transient failures retain registrations.
- FCM failure returns saved-message partial success. Concurrent/repeated identifiers do not write or dispatch twice; different content with the same identifier conflicts.
- Web retains drafts/identifiers on recoverable failure, prevents duplicate submission, and relies on Firestore for displayed messages.
- Conversation deletion, locking, session expiry, account switching, and feature revocation do not create new unauthorized message access or leave eligible logged-out devices.
- No production changes or real notifications are made during verification; the iOS repository is untouched.

## Local verification and handoff

Implemented on the branch above without iOS changes, deployment, push, environment-file inspection, private production access, or real messages/notifications.

- Server suite with `ASTITVA_TEST_CHAT=1 ASTITVA_TEST_NOTIFICATIONS=1 ASTITVA_TEST_ADMIN=1 npm test`: passes with local random MongoDB fixtures and fake Firestore/FCM. Covers ownership/reassignment, multiple devices, session/inactivity/feature filtering, authorization, payload privacy, permanent/transient failure and conditional cleanup. Existing PIN lockouts, alias snapshots, deletion and grant-related Admin checks pass.
- Durable-send unit tests cover concurrent IDs, schema/identity, differing payload conflicts, persistence before dispatch, failed/pending submission replays, tombstone denial and authorization revalidation failure.
- `cd web && npm test`: retry IDs/drafts, changed-text rejection, duplicate-submit suppression, and partial-success handling pass. No optimistic message insertion; existing history/pagination remain in the Firestore reader.
- `cd web && npm run build`: passes; existing large-bundle warning remains. No lint/type gate is configured in the current packages.
- Physical iOS display/APNs delivery and browser multi-device interaction remain external/manual verification. Local tests cannot prove provider delivery or display; mocks exercise authorization and dispatch boundaries.

Use `server/design/chat.openapi.json` for typed contracts and the Postman Notifications folder for manual fixture requests. No new server variables are needed: reuse `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_BASE64` without exposing values. Enable FCM HTTP v1 and grant the existing service account Messaging permission. Later iOS work must register the bundle/Firebase app, configure APNs credentials in Firebase, enable Push Notifications entitlement, handle permission/token refresh, register after login/on foreground and token changes, and deregister before logout/account switch. Taps must require normal session, Chat access and PIN unlock. No native implementation is included here.

Idempotency receipts (`contentHash`, `createdAt`, `notificationStatus`) live in the server-only `sendRequests` subcollection for the conversation lifetime and are removed by recursive deletion. Keeping receipts prevents old UUID reuse; no background retries or receipt-expiry jobs add API calls. FCM submission is at most once at the application level; the provider/SDK can have its own delivery behavior. Recipient ownership/session checks are point-in-time and cannot recall a notification already in flight when account access changes.

## Owner decisions

### 1. Approve the intentional F029 send-path amendment while retaining direct Firestore reads and legacy direct-write compatibility?

> OK

### 2. Approve conservative at-most-once application submission, which avoids duplicate retries but can miss a push after a crash, or require durable retry delivery with possible duplicate submissions?

> I just want to keep notification at minimum level. I am ok to miss notifications but the cost of api calls should be minimum.

### 3. Approve session-bound device eligibility and a proposed 90-day inactive-registration cleanup policy? A future iOS client would register/refresh on login, token refresh, and foreground entry and deregister before logout.

> 2 days inactive  registration cleanup is good. 90 days if that is less expensive in terms of calls or storage. Objective is to keep calls and storage to minimum levels.
