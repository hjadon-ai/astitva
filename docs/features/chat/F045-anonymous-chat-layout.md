# F045: Anonymous Chat workspace and unread messages

- **Status:** In Progress
- **Branch:** `feature/F045-anonymous-chat-layout`
- **Pull request:** Not created

## Goal and approval

Owner approved implementation of a conversation-first workspace, guided invitations, mobile list-to-thread navigation, numeric unread indicators before unlocking, and scrolling to the latest messages after unlocking.

## User flow and layout

A compact header offers New conversation and About privacy. One panel contains the conversation list and selected thread. Mobile opens a dedicated thread with Back to conversations. The thread keeps its header and multiline composer outside the scrolling message area. Date separators, short timestamps and grouped sender labels improve reading. Lock remains visible; Options contains alias, notifications and deletion. Pending invitations and bulk management sit in the conversation list. Invitation creation progresses from choosing an alias to copying a private, expiring link.

## Unread and scrolling behavior

- The signed-in participant sees received-message counts while locked, without previews. Metadata refreshes every 30 seconds while visible and when returning to the tab. Selecting a locked conversation does not acknowledge messages.
- Unlocking loads the latest history and scrolls the message area to the bottom. A visible, loaded, unlocked conversation acknowledges through the latest received message when at the bottom. Background tabs and hidden mobile threads do not acknowledge messages.
- Read cursors are monotonic and private to each participant, including across browsers. Timestamp plus document ID resolves equal-time ties. Concurrent newer messages remain unread.
- Outgoing messages and incoming messages near the bottom scroll to latest. Incoming messages while reading history show New messages ↓. Loading older history preserves reading position.
- If unread metadata is unavailable, chat access remains usable and the list explicitly says Unread count unavailable.

## API and storage changes

GET `/api/chat/conversations` adds participant-private `unreadCount` (null when unavailable). POST `/api/chat/conversations/:id/read` requires a valid session, Chat access, membership and X-Chat-Unlock, with a received `messageId`. It revalidates the unlock before writing. It never accepts another participant's read position or exposes receipts.

Server-only Firestore subcollection `chats/{id}/readStates/{userId}` stores `createdAt` timestamp and `messageId` cursor. Existing default-deny rules protect it, and recursive conversation deletion removes it. Counts use aggregate queries over Firestore messages rather than outdated MongoDB message counts. No MongoDB schema changes. PIN policy, message delivery and deletion confirmation remain intact.

## Local verification

- All 31 web tests passed, including opening/unlocking, incoming/outgoing scrolling and history-preservation decisions.
- Read-state and existing send service tests passed: own-message exclusion, participant isolation, equal timestamps, concurrent/stale acknowledgement, unlock revocation and deleted-chat protection.
- Stage MongoDB chat HTTP integration passed with the Firestore fake, covering locked unread counts, PIN-gated acknowledgements, nonmember isolation, own-message rejection and lock invalidation.
- Production build and diff whitespace checks passed; existing large-bundle warning remains.
- Local Chrome desktop and 390×844 mobile review confirmed workspace sizing, readable PIN gate, mobile list/thread navigation and header wrapping. No live messages were sent or account settings changed.
- Live Firestore unread aggregation was confirmed in Chrome. Authenticated unlock/scroll rendering and a physical mobile keyboard remain owner review checks. The local Stage apps were restarted to load the new routes; Chrome now shows the real unread badge.

## Rollout

Deploy the composite index in `firestore.indexes.json` and wait for it to be ready before backend/frontend rollout. Locally restart `./scripts/start-local.sh stage` after stopping the existing launcher. Existing received messages initially count as unread until acknowledged; there is no trustworthy historical read position to migrate. No commits, pushes or deployment performed; earlier unrelated changes preserved.

### Follow-up: endpoint mismatch and latest-message clipping

The local backend was still running the prior version without the read endpoint; restarted the Stage launcher and confirmed a real 5-unread badge. A notice banner could shrink the message area after the initial scroll, leaving the latest bubble clipped. ResizeObserver now watches the viewport and message content, retaining bottom position across banner/composer/keyboard changes while preserving a history reader's position. Resize-generated scroll events do not count as user navigation. Read acknowledgements require reaching the actual bottom. Added a regression test for shrinking viewports and hidden mobile threads; all 31 web tests and the build pass.

### Approved browser notification configuration

Owner requested implementation and configuration assistance for browser notifications. Show explicit off/blocked/open-chat-only/background-ready status and a reconnect action. Configure the local public VAPID key after Firebase Web Push key creation; preserve privacy-safe payloads and existing notification permission/admin gates. No deployment is authorized.

Notification setup progress: local Stage Admin → Notifications is enabled and saved through the UI. Firebase Console confirms FCM HTTP v1 is enabled; no Web Push certificate exists. Local Firebase frontend and backend credentials are present, but VITE_FIREBASE_VAPID_KEY is absent. Awaiting owner action-time approval to generate the persistent Web Push credential pair. Added explicit notification readiness status and reconnect action; registration is reported ready only after backend device registration succeeds. All 32 web tests and build passed.

To finish: generate Web Push key in Firebase Console → Project settings → Cloud Messaging; copy only the public key to ignored web/.env.local as VITE_FIREBASE_VAPID_KEY, restart Vite, reload Astitva, then choose Enable notifications and allow the browser prompt. Enable Chrome notifications in macOS settings if blocked. For Production, configure the same public build variable in the existing frontend build environment and enable web notifications separately in Production Admin; do not copy server credentials into VITE variables. Background delivery must be verified using a message from the other participant, with the receiving chat locked or its tab closed. No real test message or notification was sent by the agent.

### Notification submission diagnosis

Owner reported message-saved/notification-failed warning after enabling browser push. Public VAPID key is now present. Firebase validation-only checks succeeded for both registered web devices and both recipient-selection paths. No live notifications were sent during diagnostics, so actual delivery failure is not yet reproduced. Added allowlisted failure-code/platform logging (no provider text, tokens, user IDs or message content); diagnostic privacy and send tests plus mocked-FCM Stage integration passed. Local Stage restarted with diagnostics; awaiting one owner-sent new test message to capture any actual rejection. Existing saved-message retries intentionally do not redispatch notifications.
