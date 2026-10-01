# F022: Export the family directory

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Let an accepted member save a simple copy of the family people and relationship labels they can already see. This supports offline reference without exposing invitations, account credentials, or private Diet and Finance information.

## User flow

1. An accepted member opens the Family tab and chooses **Export directory**.
2. The app explains that the file contains their current family perspective and asks them to download it.
3. The member receives a UTF-8 CSV with Self, Born in family, and Spouse family rows using the labels visible to them.

## In scope

- Export only the caller's authorized F018 family view, with person display name, group, reciprocal relationship label, and accepted or accountless/pending state.
- Preserve F018's explicit sibling links and shared-child perspective; do not infer relationships.
- Include a generation date and clear group and column headings.
- Make the export available to accepted members, including READONLY, because it contains only directory fields already visible to them.
- Prevent spreadsheet formula execution by safely encoding text cells beginning with formula trigger characters.

## Out of scope

- Exporting invitation emails or tokens, linked account IDs, F020 profile details, F016 activity, or Diet/Finance data.
- Importing a CSV, synchronizing contacts, producing a full family tree diagram, or exporting another member's perspective.
- Creating a public or permanent download link.

## Wireframe or UI changes

Place **Export directory** beside the Family view actions. A short explanation lists the included fields and states that downloaded files should be kept private. Show a useful error if the member loses access before the export is generated.

## API changes

Proposed `GET /api/family/{familyId}/directory-export` returns a downloadable UTF-8 CSV derived from the caller's authorized family view. Return `401` without a session, `403` for an unverified account, and `404` when the caller is not an accepted member. Set a safe attachment filename and prevent caching of the response. The final route and whether generation belongs on the server require owner review.

## MongoDB changes

None. Generate the file from the current authorized family data without storing an export or adding a collection.

## Architecture decisions

Owner review is required for export eligibility and the exact field set before implementation. The proposed server-generated CSV reuses F018's perspective and authorization rules; it does not broaden family membership or grant Diet/Finance access.

## Acceptance criteria

- Creator, spouse, child, and READONLY member exports show their own Self, Born in family, and Spouse family labels, matching the on-screen F018 view.
- NON_USER and pending people appear only as directory people; they receive no sign-in or export access.
- An unrelated, unverified, removed, or departed account cannot download the family directory.
- The file contains no invitation email/token, account ID, birth date, note, Diet value, Finance value, or provider credential.
- Names with commas, quotes, line breaks, or formula trigger characters remain safe and readable in a spreadsheet.

## Local verification

After approval and implementation, compare exported rows with F018 views for creator, spouse, child, and READONLY accounts in local Stage. Check denied access for unrelated and pending accounts, inspect the CSV fields, and open a file containing punctuation and formula-like names in a spreadsheet.

## Open questions

1. Should READONLY members be allowed to export the directory, or should export require ADMIN or EDITOR despite the same on-screen visibility?
2. Is the proposed minimal field set sufficient, or should any F020 profile details be included only after separate privacy review?
3. Should CSV generation use a dedicated server endpoint or a client download from the already authorized family response?
