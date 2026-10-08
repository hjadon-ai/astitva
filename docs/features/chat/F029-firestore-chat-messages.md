# F029: Firestore storage and live delivery for anonymous chat messages

- **Status:** Done
- **Branch:** `feature/changes_03-Oct-2026`
- **Pull request:** Not created

## F032 architecture amendment

F032 changes the current web send path to `client → Express → Firestore → FCM`, with validated PIN unlock, durable send identifiers, and generic iOS notifications. Message history, pagination, and live listeners remain direct Firestore reads. Legacy clients that write directly to Firestore remain compatible but do not generate push. The original F029 implementation and owner decisions below describe the initial direct-write design; this amendment supersedes their requirement that sends bypass Express. No Cloud Functions are introduced. See [F032](F032-private-chat-push-notifications.md) for current send contracts and verification.

## Goal

Let participants in an existing F027 anonymous chat receive new messages live and read/send message history directly through Cloud Firestore. Once access is established, the web application must skip Render/Express chat API calls for message reads, writes, refreshes, pagination, and real-time delivery. Keep invitation, conversation, PIN, alias, deletion, and other Astitva data under the existing server's control.

## User flow

1. A signed-in user opens Anonymous Chat and unlocks one accepted conversation with its PIN as today.
2. The page connects to that conversation's Firestore messages and shows new messages as they arrive. The user can send text without a message REST call.
3. Locking the chat immediately closes the listener and revokes access. Reopening requires the PIN again. A page refresh or inactive Astitva session also locks the chat and requires a new manual PIN unlock. History loads in small pages when the user requests older messages.

## In scope

- Move **F027 message bodies and live message delivery only** from MongoDB/Express to Firestore. After the web client receives Firestore access, message reads, sends, refreshes, pagination, and listeners go directly from the browser to Firestore and do not call Render, Express, or any other chat REST endpoint. Preserve F027's invitation and PIN behavior, participant aliases, existing Chat tab, lock button, and delete controls.
- Use bounded message queries, a live listener for the newest page, and cursor pagination for older messages. Show loading, offline/reconnecting, permission-expired, and send-failure states.
- Establish Firebase Authentication and the conversation grant through the minimum required authentication boundary. The server alone decides whether the account is verified, Chat is enabled, and the PIN is valid. Firebase UID must be the stable Astitva user ID, never an email or browser-supplied ID. This boundary is used only to establish or revoke access; it is not a message proxy.
- After a successful per-conversation PIN unlock, have the server issue a short-lived Firestore access grant for that participant, conversation, and Astitva session. Revoke it on Lock, logout, deletion, or session expiry. Firestore Security Rules must check the current grant on each message read/write, plus accepted conversation state and participant identity.
- Migrate existing F027 messages once, preserving sender, text, and chronology. Confirm migration and rollback behavior before cutover; avoid duplicate messages during the transition.
- Use the current Firebase project and local Firebase emulators for Stage verification. Keep Firestore and Auth configuration isolated by environment.

## Out of scope

- Moving users, sessions, families, diet, finance, priorities, or other application data from MongoDB; changing Family Chat F024 or Family Social.
- Group chat, attachments, typing indicators, read receipts, push notifications, offline message composition, and new invitation or PIN policies.
- Unrestricted Firestore client access, a new framework, or a separate chat service.

## Wireframe or UI changes

Keep the current Anonymous Chat layout: conversation list, PIN gate, message thread, composer, **Lock**, and delete actions. In an unlocked thread, new messages appear automatically; provide **Load older messages** above the bounded history. Show a small connection status and a retry action when Firestore access or connectivity fails. The existing **Refresh messages** control may remain as a manual reconnect/reload action; it must not bypass the PIN gate.

## API changes

Existing invitation, conversation listing, PIN, alias, lock, and delete APIs remain. Proposed additions/changes:

- `POST /api/chat/firebase-session` (Astitva session required): return `{ "customToken": "<short-lived Firebase sign-in token>" }`. Server verifies email, Chat feature access, and active session; `401` for no/expired Astitva session, `403` for unverified or disabled Chat. Never accept a caller-provided UID. This is an access-bootstrap call only; it must not read or write messages.
- `POST /api/chat/conversations/{id}/unlock` (existing): after PIN validation, create a Firestore grant tied to the caller's UID and current session; return existing unlock information plus `{ "firestoreAccessExpiresAt": "<ISO time>" }`. Wrong PIN/lockout retain F027 errors; unrelated conversation returns `404`.
- `POST /api/chat/conversations/{id}/lock` (existing): revoke this session's Firestore grant before responding `{ "locked": true }`; inaccessible conversation returns `404`.
- `GET /api/chat/conversations/{id}/messages` and `POST /api/chat/conversations/{id}/messages` (existing): retire after migration and web client cutover. The web client must not call these endpoints. Return an explicit upgrade/error response to stale clients after cutover; document its exact status during implementation. Do not maintain two writable message stores.
- Existing logout and delete endpoints also revoke grants and, for deletion, remove Firestore messages for both participants. Server/Admin SDK operations are privileged; browser message operations remain governed by Security Rules.

## Firestore collections and documents

- `chats/{chatId}`: server-owned authorization metadata only: accepted/active state, exactly two participant UIDs, creation time, and optional deletion state. Browser cannot create or modify it. The ID maps to the existing F027 conversation ID; alias/PIN data remain in MongoDB.
- `chats/{chatId}/messages/{messageId}`: `senderUid`, `text` (trimmed, 1–2000 characters), and `createdAt` (server timestamp). Browser may create only with its own UID and exactly these fields; no client update/delete. Rules reject extra fields and invalid data.
- `chats/{chatId}/grants/{grantId}`: server-owned per-UID, per-Astitva-session access grant with expiry. Browser cannot list or write grants. Rules look up only the caller's grant. Grant IDs must not expose raw session tokens.
- Newest messages: `orderBy(createdAt, desc)` with a fixed small limit, then display in chronological order. Older pages use a document cursor; stable ordering uses document ID as a tie-breaker. Restrict list queries in Rules to the authorized chat path and bounded page size. A live listener watches the newest page only, and is detached on Lock, sign-out, conversation switch, or component unmount.

## MongoDB changes

- Keep users, Astitva sessions, invited-email Chat flags, chat invitations, conversations, aliases, PIN hashes/lockouts, and the F027 deletion record in MongoDB.
- Existing MongoDB message fields are read for a one-time migration, then no longer written. Define cleanup/retention after migration is verified; do not silently drop old messages.
- If needed, store a minimal migration marker and Firestore grant bookkeeping on the conversation/session. Do not copy message bodies into a second long-term MongoDB store.

## Authentication and security design

- Firebase Hosting login alone does **not** authorize Firestore. The Express server validates the existing Astitva session and mints a Firebase custom token through the Admin SDK. The browser signs in to Firebase Auth with that token; Firebase ID token `uid` matches the Astitva user ID.
- Authentication alone cannot open a chat. After server-side PIN validation and F027 lockout checks, the server creates a short-lived grant for this specific user, conversation, and Astitva session. The Firebase token must carry a session binding that Rules can compare to the grant; never embed raw session credentials. The server owns all grant writes and revocations.
- Rules default-deny all Firestore paths. A message read/query requires `request.auth.uid` to be a participant in the server-owned accepted chat and an unexpired matching grant. Creation additionally requires `senderUid == request.auth.uid`, exact allowed fields, valid text, and `createdAt == request.time`. Deny client edits/deletes of messages and all client writes to chat/grant metadata. No broad collection-group query or public chat listing.
- Revocation must work even while a Firebase Auth token is still valid: Lock/logout/delete removes the grant that Rules read. A page refresh clears the local unlock state and detaches the listener. On Astitva session inactivity or expiry, grant expiry must no longer allow message access; renewed access requires an active Astitva session and manual PIN unlock. Handle multiple devices as separate session grants.
- Chat feature access is checked before token/grant issuance. Server-side revocation of a user's Chat access must also revoke their existing grants; otherwise Firestore could remain accessible until grant expiry. Treat free-tier quotas as operational limits, not security controls.

## Architecture decisions and exceptions

- **Intentional exception:** F027 message reads/writes change from `browser → Express REST API → MongoDB` to `browser → Firestore`. After the access-bootstrap step, the web path is `browser → Firestore`; it does not route message traffic through Render or Express. Live delivery uses Firestore listeners. Express still owns Astitva authentication, authorization decisions, invitations, PIN verification, access bootstrap/revocation, and privileged cleanup/migration.
- **Existing rule retained:** MongoDB remains Astitva's primary database for every other feature and for F027 conversation control data. This proposal does not establish Firestore as the default database for new features.
- **Existing F027 behavior retained:** Being a participant is insufficient until that participant unlocks the specific conversation; a third party or another family member gets no access. PIN lock/unlock remains a manual action, with automatic re-lock on page refresh or inactive Astitva session. Lock and delete still affect access immediately, and F027 deletion semantics and 30-day minimal record continue.
- Keep one canonical message store after cutover. Use Firebase's existing project and emulator tooling; evaluate reads, writes, listeners, indexes, and storage against the current free-tier limits during implementation.

## Acceptance criteria

- Two verified, Chat-enabled F027 participants can unlock and exchange ordered messages live across devices; a new message appears without pressing Refresh, and browser network inspection shows no Render/Express message read, send, refresh, pagination, or listener request after access is established.
- Older messages load in bounded pages without loading the full history; manual locking, page refresh, and inactive session stop the listener and block subsequent Firestore reads/writes, including from a second tab with the same session.
- A signed-in third user, a user without the Chat flag, an expired session, a participant before PIN unlock, and a locked-out participant cannot read or send messages. Rules tests cover forged sender UID, wrong chat path, extra fields, malformed/oversized text, client metadata changes, and unbounded queries.
- Existing MongoDB messages appear exactly once and in order after migration; no message is lost or duplicated at cutover. Delete-one/delete-all remove Firestore messages for both participants and preserve F027's minimal deletion record.
- Invitation, alias, PIN attempts/lockouts, Family, Diet, Finance, and other APIs behave as before. Only message storage/delivery and the strictly necessary chat authentication/grant APIs change. The web client makes no Render/Express calls for message traffic after access is established.
- Local Stage passes Firebase Auth/Firestore emulator Rules tests and manual two-user/two-device checks, including offline/reconnect, logout, lock, expired grant, and deletion.

## Local verification

Implemented locally on the active work branch. The full server test suite and web production build pass. Firestore rules compile successfully against the Standard edition database, logout and password-reset session invalidation revoke Firestore grants, and local Stage runs with the Firestore emulator on port 8080, web on 3000, and API on 3001. Manual two-participant verification remains available through the running Stage app; no deployment is part of this work.

## Owner decisions

1. Migrate all existing F027 messages in one controlled migration before cutover; do not create a read-only archive as the first release path.
2. Keep PIN lock and unlock manual. Automatically lock on page refresh and when the Astitva session becomes inactive or expires; require a new manual PIN unlock afterward.
3. Keep Firebase Auth signed in for other chats. Locking one chat revokes only that chat's grant; Astitva logout and session expiry revoke all grants.

## Open questions

None. The feature is approved for implementation within the scope above.
