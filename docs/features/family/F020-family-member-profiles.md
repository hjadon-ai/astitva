# F020: Family member profiles

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Let a family record hold a small amount of useful personal context, especially for NON_USER children and parents, while keeping F018's account link, relationship graph, and private Diet/Finance permissions separate.

## User flow

1. An ADMIN or EDITOR opens a family person and selects **Edit details**.
2. They add an optional preferred name, birth date, and short note, then save.
3. Accepted members see those details from their own family view. The person's relationship label still comes from F018's perspective rules.

## In scope

- Optional preferred name, birth date, and short plain-text note for a family person.
- Display an age only when a birth date is present, calculated from the viewer's local calendar date.
- Preserve the same person ID and accepted account link when details change.
- Allow ADMIN and EDITOR to edit these family details; READONLY can view them.
- Distinguish family details from the linked user's account profile, which the account owner controls.

## Out of scope

- Photos, addresses, phone numbers, documents, medical information, schools, and legal guardianship.
- Automatically changing access when a child reaches a certain age.
- Editing another user's account name, email, Diet, or Finance data.
- Birthday reminders or calendar integration.

## Wireframe or UI changes

Show preferred name beneath the relationship label when present. **Edit details** opens a compact form with the optional fields and clear Save/Cancel actions. A birth date is displayed only in the family view; no public page or notification is added.

## API changes

- Proposed `PATCH /api/family/{familyId}/people/{personId}/details` accepts only `preferredName`, `birthDate`, and `note`; returns the updated family person summary.
- Existing family reads include these fields for accepted members. Return `401` without a session, `403` for READONLY writes, `404` for a person outside the caller's family view, and `400` for invalid fields or dates.

## MongoDB changes

Add nullable `preferredName`, `birthDate` as a validated `YYYY-MM-DD` date-only value, and `note` to the existing family person subdocument. No new collection. Age is derived for display and is never stored. Do not write these fields to `users`.

## Architecture decisions

- Family details belong to the shared person record, so partner and child perspectives show the same details without copying them.
- Treat the note as plain text. Do not render markup or allow private account data to be copied into the family record automatically.
- Keep role checks on the server and leave F018 invitation, relationship, and feature-sharing rules unchanged.

## Acceptance criteria

- A family creator adds details for a NON_USER child; the spouse sees the same details after invitation acceptance.
- The child later accepts an invitation and retains the details under the same Self record.
- An EDITOR can update details; READONLY cannot. An unrelated or pending account cannot read them.
- A detail edit does not change relationship labels, family roles, invitation state, or Diet/Finance sharing.
- Invalid dates and overlong text are rejected without a partial update.

## Local verification

After approval and implementation, review one family as creator, spouse, and child in local Stage. Confirm the same person ID and details in each view, then test READONLY and unrelated-account access through the API.

## Open questions

1. Should the preferred name be visible to every accepted member or only direct relations?
2. What text limit should the family note use, and should a person linked to an account be able to edit their own family details while READONLY?
