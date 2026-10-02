# F016: Family activity history

- **Status:** Done
- **Branch:** `feature/consolidate-pending-changes`
- **Pull request:** Not created

## Goal

Give accepted family members a clear history of who changed the family graph or access rights. This helps members understand new invitations, role changes, relationship corrections, removals, and Diet or Finance sharing changes.

## User flow

1. An accepted member opens **Family activity** from the Family tab.
2. The timeline shows the actor, action, affected member or feature, and time, newest first.
3. The member can inspect recent changes without being able to alter history.

## In scope

- Record family creation, person additions and edits, invitation sends and acceptance, role changes, relationship changes and removals, and share grants or revocations.
- Show the actor and a plain-language summary; mark system actions such as pruning a disconnected branch.
- Enforce family membership on reads. Preserve an event when the actor later leaves the family.
- Do not store passwords, invitation tokens, Gmail credentials, Plaid credentials, account balances, meal content, or other private feature data in activity entries.

## Out of scope

- Notifications by email or push, undo, and restoring removed relationships.
- Auditing every Diet meal or Finance transaction change.
- Exporting activity outside the family.

## Wireframe or UI changes

Add an **Activity** section in the Family tab with a short recent list and **View more**. Each entry includes a timestamp, actor name, action, and affected person or feature. Empty state: “No family changes yet.”

## API changes

- Proposed `GET /api/family/{familyId}/activity?limit=20&before={cursor}` returns paginated, display-safe events. Return 404 when the caller is not an accepted member.
- Existing family mutation endpoints append events after successful changes. The response shape of those endpoints need not change.

## MongoDB changes

Proposed `familyActivity` collection with `familyId`, `actorUserId` or system actor, `action`, `subjectPersonId` when relevant, display-safe snapshot names, `createdAt`, and pagination index on `{ familyId: 1, createdAt: -1, _id: -1 }`. No raw invitation token or private Diet/Finance payload is stored.

## Architecture decisions

- Activity entries are append-only application records; ordinary family roles cannot edit or delete them.
- Record successful writes only. Failed invitation emails and rejected mutations do not appear as completed actions.

## Acceptance criteria

- An accepted member can identify who invited a person and who changed a role or share grant.
- A READONLY member can view activity but cannot mutate the family.
- An unrelated or unverified account cannot read activity.
- Activity entries contain no token, credential, or private Diet/Finance contents.

## Local verification

After approval and implementation, run authenticated API tests for access and pagination, then manually change a role and a share grant in Stage and confirm the timeline names the actor and action.

## Owner decisions

### 1. Should all accepted members see the full family activity timeline, or should invitation, role, and share events be restricted to ADMINs and the people involved?

> All

### 2. How long should activity be retained, and should a member who leaves retain access to their own past entries?

> for a week
