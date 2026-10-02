# F015: Family sharing overview

- **Status:** Review
- **Branch:** `feature/family-approved-f014-f016`
- **Pull request:** Not created

## Goal

Help a member see, in one place, which accepted relatives can view their Diet and Finance data and which relatives have shared those features with them.

## User flow

1. A signed-in member opens **Sharing** in the Family tab.
2. They review Diet and Finance separately, with named recipients for their own data and owners who share with them.
3. They remove an unwanted recipient and see access end immediately.

## In scope

- Summarize only F018's existing, read-only Diet and Finance grants for the signed-in owner and recipient.
- Show **Not shared** when a feature has no recipients, and distinguish accepted members from NON_USER or pending members who cannot receive access.
- Let an owner revoke their own grant from the overview using F018's existing permission check; refresh the summary after a change.
- Keep family ADMIN, EDITOR, and READONLY roles separate from feature sharing.

## Out of scope

- New share types, bulk grants, delegated sharing, or access to another person's credentials or connection controls.
- Editing another member's Diet or Finance data.

## Wireframe or UI changes

Add a **Sharing** panel with separate Diet and Finance rows. Each row shows **Shared with** and **Shared by** lists, an empty state, and **Stop sharing** beside the signed-in owner's recipients.

## API changes

Proposed `GET /api/family/sharing/summary` returns only the caller's own grants and grants addressed to the caller, with display names and feature names. Return `401` without a session. Revocation uses the existing F018 share endpoint and authorization; no new mutation endpoint is proposed.

## MongoDB changes

None. Read existing family people, accepted links, and Diet/Finance share grants.

## Architecture decisions

- Recheck accepted membership and grant status on every summary read; a stale grant must not appear as usable access.
- The overview exposes no balances, meals, tokens, or private feature content.

## Acceptance criteria

- An owner sees separate Diet and Finance recipient lists; both start empty under F018 defaults.
- An accepted recipient sees a sharing owner only for the granted feature and can open that feature read-only.
- Revoking a grant removes it from both views and blocks the recipient's next data request.
- Pending, NON_USER, removed, and unrelated people gain no access through the overview.

## Local verification

After approval and implementation, grant Diet to one accepted member and Finance to another, compare both views, revoke each grant, and confirm the existing read-only endpoints deny access afterward.

## Open questions

None.
