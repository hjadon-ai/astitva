# F018: Family members

- **Status:** Done
- **Branch:** `feature/F018-family-members`
- **Pull request:** Not created

## Goal

Add a **Family** tab beside Diet and Finance. A signed-in person sees their own family perspective, and verified family members who have Astitva accounts can see the connected family from their perspectives.

## Proposed scope

- Show two groups: **Born in family** (parents and siblings) and **Spouse family** (partner and children).
- Show the signed-in person as **Self**.
- Add and manage people who may or may not have Astitva accounts.
- Invite a family person by email. Connect their Astitva account only after email verification and invitation acceptance, so the person is not duplicated when they sign in.
- Apply ADMIN, EDITOR, and READONLY access to the shared family view.
- Derive relationship labels from the viewer's perspective. A parent sees a child in Spouse family; that child sees the parent in Born in family.
- Let a member explicitly share their Diet or Finance information with selected accepted family members as read only.

The approved relationship, invitation, permission, and data-sharing rules are in [Family relationship and account-linking rules](F018-family-rules.md).

## Out of scope for this proposal

- Editing another member's Diet or Finance information, and sharing priorities or other private feature data.
- Photos, dates, and contact information beyond the email used for invitations.
- Multiple partners, inferred/shared parentage, and complex sibling rules.
- Moving existing application code into feature folders.

## Stage manual review

1. Run `./scripts/start-local.sh stage` from the repository root and open `http://localhost:3000/#family`.
2. Sign in with a verified account and create a family. Set your label, then add a parent, sibling, partner, and child. Confirm the partner shares the child's Spouse view after accepting.
3. Add an email to a NON_USER person and send an invitation as ADMIN. Sign in under the invited verified account and accept from the Family tab's invitation inbox or the emailed link. Confirm the same person record shows as Self, with reciprocal relationship labels. An email match without acceptance must not show the family. If that account had created an empty family while waiting, it should be replaced by the accepted shared family.
4. As the spouse, confirm the original partner and all children appear under Spouse family. As an invited son or daughter, confirm both accepted parents appear under Born in family with Father/Mother or Parent labels chosen by each account.
5. Confirm an invited member starts READONLY. The creator can promote to EDITOR or ADMIN; READONLY cannot add or edit, EDITOR cannot remove, and only an ADMIN can remove a relationship. Only the creator can change roles.
6. Confirm Diet and Finance start unshared. Choose an accepted recipient for each independently, open the shared read-only view as that recipient, then revoke and confirm access ends. Existing Diet and Finance write actions remain limited to the owner's account.

The API contract is in `server/design/family.openapi.json`, the Postman folder is **Family (F018)**, and the collection design is in `server/design/mongodb-collections.md`. Integration coverage runs with `ASTITVA_TEST_FAMILY=1 node --test test/family.integration.test.js` from `server/` against local Dev MongoDB.
