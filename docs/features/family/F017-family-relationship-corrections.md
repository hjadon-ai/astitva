# F017: Correct family relationships without replacing members

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Let an authorized family member correct an incorrectly entered relationship while keeping the same person record, accepted account link, invitation state, and sharing choices. Every accepted member should immediately see the corrected relationship from their own perspective.

## User flow

1. An ADMIN or EDITOR opens a person in the Family tab and selects **Change relationship**.
2. The app shows the current relationship and the allowed replacement labels for that person's Born in or Spouse family context.
3. The editor previews how the relationship will appear to both people and confirms the change. The person retains their identity and account link.

## In scope

- Correct parent, sibling, partner, and child relationship types and labels without deleting and recreating the member.
- Keep reciprocal views consistent: parent/child changes group correctly, sibling labels remain symmetric, and a partner pair shares children.
- Enforce F018's single-partner rule and reject a change that would create unsupported shared-parent or step-family structures.
- Permit ADMIN and EDITOR to correct a relationship; keep relationship removal ADMIN-only.
- Show a clear conflict message if an existing relationship prevents the requested correction.

## Out of scope

- Multiple or former partners, half-siblings, stepchildren, custody, and inferred siblings.
- Merging two populated family graphs or combining two distinct Astitva user accounts.
- Changing another person's Diet or Finance data or sharing permissions.

## Wireframe or UI changes

Add **Change relationship** beside **Edit** in each family member row. A compact form shows the current label, replacement label, and a reciprocal preview such as “You see Mother; she sees Son.” Preserve the member row and invitation status after saving.

## API changes

- Proposed `PATCH /api/family/{familyId}/relations/{relationId}` with `{ relationship: "mother" }` or another F018 label. Return the updated family perspective. Return 403 for READONLY, 404 for a relationship outside the caller's family view, and 409 when a single-partner or parentage rule would be violated.
- Existing `GET /api/family/{familyId}` continues to return the corrected reciprocal labels; no new public read endpoint is proposed.

## MongoDB changes

Keep the existing `families.people` person ID and `userId`. Update the relevant `families.relations` edges atomically within the family document. No new collection is proposed.

## Architecture decisions

- Treat a relationship correction as an edit to the existing person and graph edges; never create a replacement person.
- A child shared by two partners must remain visible to both after a valid correction, or the API must reject the change before writing.

## Acceptance criteria

- A creator changes an invited son's relationship label without making him accept a new invitation or losing his existing link.
- A spouse sees corrected partner and child relationships after refresh, and a child sees the corresponding Born in view.
- READONLY cannot correct; EDITOR can correct; only ADMIN can remove.
- Invalid corrections return a conflict and leave all people, edges, invitations, and share grants unchanged.

## Local verification

After approval and implementation, run the Family integration test and manually review the same family as creator, partner, and child in Stage. Confirm record IDs and accepted links remain stable before and after correction.

## Open questions

1. Should changing a partner to another relationship require an extra confirmation because it changes the shared child view?
2. Should a correction to one person's gendered label update every relationship label for that person, or only the selected edge?
