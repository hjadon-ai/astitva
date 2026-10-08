# B001 — Family and member management bug / gap

Status: Draft
Type: Gap
Environment: Local
Priority: High

Documentation only. This report does not approve implementation or change existing feature statuses.

## Summary

Astitva should use a relationship graph containing multiple shared family units. A person may participate in multiple units; Born-in and Formed describe the viewer's context. Combine only units confirmed to represent the same family, with consent, preserving people, relationships and data. Do not collapse a person's entire extended family into one unit.

## Starting situation — Family X + Family Y

- A and B are husband and wife; C is their son and D is their daughter.
- A belongs to Family X and has already added D as his daughter.
- B belongs to Family Y and has already added C as her son.
- A and B are existing Astitva users; C and D may be NON_USER members.
- A searches for B and selects that B is his wife.
- E and F are A's parents; G and H are A's siblings. They remain in A's separate Born-in unit. B's parents and siblings also remain separate; neither side is pulled into the couple's Formed unit.
- Duplicate variant: both families contain separate member records representing C. Matching names alone do not prove these records represent the same person.

## Steps to reproduce / review

These are the intended local review scenarios; no browser reproduction was performed for this documentation update.

1. Prepare Family X with A and D and Family Y with B and C.
2. As A, search for B and select Wife. Record whether the current UI supports this cross-family lookup/request.
3. Send the relationship request to B. Check whether it is identified as a merge of two existing families.
4. Obtain relationship acceptance and explicit merge acceptance from one ADMIN in X and one ADMIN in Y. Until both ADMIN approvals exist, verify the units remain separate. Then inspect the shared unit from A, B, C and D's perspectives.
5. Repeat with C1 and C2 as separate NON_USER records. Verify they remain distinct for manual review; unsafe relationship/reference conflicts block combination. Only ADMIN may delete an unwanted NON_USER record after references/data are handled.
6. Repeat with B rejecting the request; compare both families with their pre-request state.
7. Separately add a child explicitly as NON_USER, then review a later verified account-linking flow for that same member.

## Current behavior / actual result

Source inspection confirms:

- `families` embeds people, relationship edges and sharing grants. A person may be linked to a `users` account through `userId`; family details and user account profiles are separate.
- Current invitation acceptance links the invited person in the requesting family to the recipient's account. It removes the recipient's own family only if that family contains just Self, with no relationships or sharing grants.
- A populated Family Y is not combined with Family X. Thus the current flow does not preserve and unify both populated graphs as required by this example.
- F014 directory search is limited to people already visible in the caller's family; cross-family user discovery is outside its scope.
- F019 describes decline and invitation management but remains Approved in the index. Its documented expected behavior must not be assumed to be fully implemented.

The exact visible UI outcome, error messages and frequency remain unrecorded. No live family records were inspected or modified. NON_USER creation without an account and later explicit linking are existing F018 concepts; this report does not claim those flows are broken without reproduction evidence.

## Expected result

### Relationship requests and family merge

- Existing Astitva users receive relationship/family invitations and explicitly approve before account linking or family merging.
- In the example, A sends B a relationship request clearly identified as a Family X + Family Y merge request. It must not simply add B to X or create a third family.
- After relationship consent, one ADMIN acceptance from each unit and validation, X and Y become one shared Formed unit containing A, B, C and D. Both existing ADMINs remain ADMIN. Separate Born-in units remain separate.
- Rejected requests leave both family units unchanged. If an invited person registers and declines, the original NON_USER record remains unchanged and unlinked; only request history records the decline. Pending requests do not authorize combination.
- Email notifies the reviewer. Opening its link or refreshing the signed-in app loads the pending request and Accept button; neither action itself supplies consent.
- Existing family details, account links and related data/references must not be lost or orphaned. Preserve valid sharing choices without granting new private-data access merely because the family merged.
- Relationship direction remains consistent: parent edges run parent → child; spouses and siblings remain reciprocal in their displayed views. A and B see C and D as children; C and D see A and B as parents under the existing shared-spouse rules. A's parents must not become B's parents, and sibling links must not be inferred solely from shared names or parentage.

### Duplicates and conflicting relationships

- Detect possible duplicate members and incompatible relationship structures before completing the merge, including conflicts with the existing single-partner rule.
- Surface possible duplicates for manual review; C1 and C2 may temporarily remain after a safe unit combination. Do not automatically merge people by name or relationship similarity. Invalid relationships or unsafe reference handling block combination; possible name duplicates alone do not.
- ADMIN/EDITOR may review and edit permitted details; only ADMIN may delete unwanted NON_USER members. An ADMIN can confirm identity and resolve duplicates safely. Related references and data must be reconciled before a duplicate member is removed; removal must not delete a linked user's account or unrelated private data.
- Keep distinct people with identical names distinct. If identity or the appropriate resolution is uncertain, require human action.

### NON_USER members and later account linking

- Explicit NON_USER creation adds a family member without sending an invitation or creating a user account/profile.
- NON_USER members belong to the same shared graph. Authorized family members can manage their family details under existing role permissions.
- A person intended to register, rather than explicitly designated NON_USER, may receive an invitation to join Astitva through the verified invitation flow.
- If a NON_USER later becomes an Astitva user, eventually link/claim the existing member through verified identity and explicit consent instead of creating a duplicate. Name matching alone is insufficient.
- Family management does not authorize editing another account or accessing all private feature data. Any broader delegated data management needs separately defined scope.

## Impact and evidence

Disconnected populated families can give spouses inconsistent children/relative views and make duplicate resolution risky. Browser evidence and frequency remain to be added using synthetic local fixtures and sanitized screenshots.

## Related documentation and remaining decisions

- [F018 members](../../features/family/F018-family-members.md) and [relationship/account-linking rules](../../features/family/F018-family-rules.md): shared perspectives, NON_USER linking, roles and explicit sharing.
- [F014 directory](../../features/family/F014-family-directory.md): existing-family search only.
- [F017 corrections](../../features/family/F017-family-relationship-corrections.md): Proposed; explicitly excludes merging populated graphs.
- [F019 invitations](../../features/family/F019-family-invitation-management.md): Approved; invitation lifecycle and decline.
- [F020 details](../../features/family/F020-family-member-profiles.md): Review; editable family details separate from user profiles.
- [F015 sharing](../../features/family/F015-family-sharing-overview.md) and [F034 member view](../../features/family/F034-family-member-profile-view.md): no automatic access to private account features.

Implementation is proposed in [F035 — Shared family units and consent-based linking](../../features/family/F035-shared-family-units.md). It specifies proposed architecture and remaining decisions without changing existing approvals. The clarified discussion reference is [Family model context](../../context/ASTITVA_FAMILY_MODEL_BRAINSTORM.md).

## Review and resolution

- Confirmed gap: Current invitation acceptance does not combine populated family graphs.
- Browser reproduction: Pending.
- Implementation scope / approval: Pending owner review.
- Verification of expected behavior: Not yet performed.
