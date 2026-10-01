# F021: Leave an accepted family

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Let an accepted member end their own access to a shared family without deleting their Astitva account or requiring the creator to act. Make the effect on family records and existing sharing clear before they confirm.

## User flow

1. An accepted member opens Family settings and chooses **Leave family**.
2. A confirmation shows that their family view and access to relatives' shared Diet and Finance data will end.
3. After confirmation, the member can no longer open that family. Other members see the same family person record with a clear former-member state, subject to the owner's decision below.

## In scope

- A self-service exit for an accepted member who is not the family creator.
- Confirm the action and explain the effects on accepted membership, family roles, and read-only Diet/Finance grants in both directions.
- Recheck membership on every family and shared-feature read after exit; stale sessions cannot retain access.
- Keep F018's relationship labels, reciprocal perspectives, shared children, and accountless person records intact for remaining accepted members.
- Allow remaining ADMINs to see that the person no longer has account access without revealing private account details.

## Out of scope

- Deleting an Astitva account or automatically deleting the family person or relationships.
- Creator departure, family ownership transfer, removing another member, or merging families.
- Changing another person's Diet or Finance data.
- Rejoining automatically from a prior email match or old invitation.

## Wireframe or UI changes

Add **Leave family** to the signed-in member's Family settings, with a confirmation that names the family and lists the access that will end. After success, show a neutral exit confirmation. Remaining members see **No account access** on that person's row; their relationship label remains based on the viewer.

## API changes

- Proposed `POST /api/family/{familyId}/leave` requires the caller's verified, accepted membership and confirmation in the UI. Return `204` after access ends, `401` without a session, `403` for an unverified account or creator, and `404` for a family outside the caller's accepted membership.
- Existing family, shared Diet, and shared Finance reads must deny access after exit. No new data-read endpoint is proposed.

## MongoDB changes

Proposed: clear the exiting person's accepted account link and role activation on the existing family person record, while retaining its person ID and relationship edges. Revoke Diet and Finance grants involving that account for this family. The exact representation of former membership and whether grant records are deleted or marked revoked require owner review.

## Architecture decisions

Owner review is required before implementation for the membership transition, grant-retention choice, and creator behavior listed below. This proposal does not change F018's approved invitation acceptance, roles, reciprocal perspectives, accountless members, or separate read-only Diet/Finance sharing by default.

## Acceptance criteria

- A non-creator accepted member can leave after explicit confirmation; an unrelated or pending account cannot invoke the action.
- The former member immediately loses the family view and all relatives' shared Diet/Finance access, including through an existing session.
- The former member's Diet and Finance data are no longer available to recipients through grants associated with that family.
- Remaining members retain their own access and see the same person and valid relationship edges without a duplicate.
- Old invitation links and matching email alone cannot restore membership; re-entry requires a new verified invitation and acceptance.
- A creator cannot leave through this flow until the creator-departure rule is separately approved.

## Local verification

After approval and implementation, use creator, spouse, child, and unrelated accounts in local Stage. Grant Diet and Finance separately, have the child leave, and verify both directions of access end immediately while the spouse's reciprocal view and person IDs remain stable. Exercise stale sessions, old links, and creator rejection.

## Open questions

1. Should the departing member's account link be cleared entirely, or retained as an inactive historical link visible only to authorized members?
2. Should grants involving the departing member be deleted or retained as revoked records for F016 activity/history, and what member details may remain visible?
3. Is a separate creator ownership-transfer flow needed before a creator can leave?
