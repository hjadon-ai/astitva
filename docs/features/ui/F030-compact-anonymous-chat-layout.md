# F030: Compact Anonymous Chat layout

- **Status:** Done
- **Branch:** `feature/changes_03-Oct-2026`
- **Pull request:** Not created

## Goal

Make the F027/F029 Anonymous Chat screen compact and easier to use on desktop and mobile. Live Firestore delivery already keeps messages current, so the separate **Refresh messages** button should be removed.

## User flow

1. A signed-in member opens Anonymous Chat and sees invitations, conversations, and the selected conversation in a clear compact layout.
2. The member unlocks a conversation with its PIN and sees a visible Live, Connecting, or Disconnected status.
3. The member reads or sends messages, loads older messages when needed, and uses Lock or Delete without searching through repeated controls.

## In scope

- Remove the **Refresh messages** button and its UI action from Anonymous Chat.
- Place **Create invite link** and its pending invite summary below the conversations and selected thread on desktop and mobile.
- Automatically scroll the message board to the newest message when opening a thread or receiving/sending a new message. Loading older messages preserves the visible reading position.
- Show sent messages in blue, aligned right, and received messages in light gray, aligned left; keep aliases, the “(you)” label, and timestamps visible.
- Group the conversation list and selected thread into a compact responsive layout with clear visual hierarchy.
- Keep the PIN gate, Create invite link, invitation acceptance, Lock, Delete, Save alias, Send, connection status, and Load older messages behavior.
- Reduce repeated explanatory copy while keeping the important privacy, expiry, PIN, and deletion messages visible at the point of use.
- Keep keyboard navigation, visible focus, usable labels, mobile stacking, and existing Astitva visual-system components.
- Preserve direct browser-to-Firestore message delivery and the existing server calls for metadata and access control.

## Out of scope

- Changes to Firestore collections, Security Rules, PIN policy, invitations, aliases, permissions, message ordering, pagination, or retention.
- New chat features, notifications, attachments, typing indicators, read receipts, group chat, or changes to F024 Family Chat.
- Changes to authentication, API contracts, MongoDB, or Firebase configuration.

## Wireframe or UI changes

Desktop:

```text
Anonymous Chat                                      [connection status]

+----------------------+---------------------------------------------+
| Conversations        | Selected alias                 [Lock] [Delete] |
| [conversation]       | PIN gate or message thread                   |
| [conversation]       | [Load older messages]                        |
|                      | message list                                |
|                      | [message composer                         ] [Send] |
+----------------------+---------------------------------------------+
Create invite link | pending invite summary
```

Mobile:

```text
Anonymous Chat                         [status]
Conversations [compact selector/list]
Selected alias                         [Lock]
PIN gate or messages
[Load older messages]
Composer                               [Send]
[Delete]
Create invite link | pending invite summary
```

The selected conversation should remain visually distinct. Lock and Delete should be grouped with the selected conversation header. The live status replaces the removed Refresh action as feedback that messages update automatically.

## API changes

None. The feature is presentation-only and must not add a Render/Express request.

## MongoDB changes

None.

## Architecture decisions

- This is a UI-only change over F027/F029.
- The Refresh button is intentionally removed because Firestore real-time listeners provide current messages. Manual recovery remains available through the existing connection state and lock/unlock flow.
- Existing Astitva browser, Firebase/Firestore, Express, and MongoDB boundaries remain unchanged.

## Acceptance criteria

- The Anonymous Chat page has no visible **Refresh messages** button and no refresh-message action in the UI.
- A member can identify conversations, the selected chat, connection status, Lock, Delete, Load older messages, and Send without excessive scrolling.
- New messages scroll the message board to the bottom without scrolling the whole page; loading older messages preserves the reading position.
- Invite creation appears below the chat area, and sent/received messages have distinct colors and alignment.
- The layout remains usable at the existing desktop and mobile breakpoints.
- PIN, invitation, alias, lock, delete, live message, and pagination behavior is unchanged.
- Browser network inspection still shows no Render/Express request for message reads, sends, refreshes, pagination, or listeners.
- Keyboard users can reach every chat action in a logical order and focused controls remain visible.
- Existing web build and chat integration checks continue to pass.

## Local verification

Implemented locally on the active work branch. The web build and existing server checks pass. The layout uses a compact desktop two-column view, stacks on mobile, removes Refresh messages, and provides Reconnect when the live listener disconnects. Manual inspection should confirm the compact layout, Live/Disconnected status, Load older messages, and Lock behavior.

## Owner decisions

### 1. Should the conversation list stay visible beside the thread on medium-width screens, or collapse into a selector earlier?

> think and do as per your recommendation

### 2. Should the compact layout show the pending invite count inline or keep it inside the invite section?

> yes
