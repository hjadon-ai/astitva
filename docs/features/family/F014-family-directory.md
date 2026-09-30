# F014: Family directory search

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Help accepted members find a person in a growing family without losing the Born in family and Spouse family perspective that F018 defines.

## User flow

1. A member opens the Family tab and enters a name or relationship label in **Find family member**.
2. Matching people remain in their perspective-specific group, with **Self** shown separately.
3. The member clears the search to restore the full view.

## In scope

- Search the family people already returned to the accepted viewer by display name and the viewer's relationship label.
- Keep Born in family and Spouse family group headings and the same reciprocal labels as the unfiltered view.
- Show whether a result is an accepted member or an accountless/pending person, without exposing invitation tokens or private account data.
- Apply the same family role permissions to row actions after filtering; READONLY remains view-only.

## Out of scope

- Searching unrelated accounts, inviting people, changing relationships, or inferring sibling and parent links.
- Searching Diet, Finance, notes, or account email addresses.

## Wireframe or UI changes

Place a compact search field above the two family groups. Show a result count and a **No matching family members** state; keep **Self** visible outside search results.

## API changes

None. Filter the existing F018 family view in the client after its normal authorization check.

## MongoDB changes

None.

## Architecture decisions

- Search only the caller's already authorized family response; do not add a cross-family lookup.
- Match the labels calculated for the viewer, so a parent and child can search using their own relationship terms.

## Acceptance criteria

- A parent can find a child under Spouse family; the child can find the same parent under Born in family.
- An accepted spouse sees shared children; an explicitly linked sibling appears only where F018 permits.
- Searching for a NON_USER person shows the person but grants no sign-in or feature-data access.
- Filtering never enables a row action disallowed by the member's role.

## Local verification

After approval and implementation, search as creator, spouse, child, and READONLY member in local Stage; confirm each view's groups, labels, empty state, and action permissions.

## Open questions

None.
