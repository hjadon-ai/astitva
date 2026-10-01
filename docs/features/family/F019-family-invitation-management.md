# F019: Manage family invitations

- **Status:** Proposed
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Let an ADMIN see whether each family invitation is pending, accepted, expired, or cancelled, and recover from an invitation that did not reach the intended person. Keep account linking dependent on verified email and explicit acceptance, as required by F018.

## User flow

1. An ADMIN opens a person's invitation details in the Family tab.
2. For a pending or expired invitation, the ADMIN can resend it to the same email or cancel it. A corrected email requires cancelling the old invitation before sending a new one.
3. The invitee opens the newest valid invitation, verifies their account email, and accepts or declines. The family view is available only after acceptance.

## In scope

- Show invitation status, recipient email, sent time, and expiration in the family member row.
- Resend to the same email using a new single-use token that invalidates the previous token.
- Let an ADMIN cancel a pending invitation or replace an incorrect recipient email through a new invitation.
- Let a verified recipient decline without linking their account; the family person remains a NON_USER.
- Rate-limit resends and show a clear delivery failure while preserving the person record.
- Record acceptance, decline, expiry, cancellation, and resend as separate states without treating an email match as consent.

## Out of scope

- Automatic account linking, bulk invitations, invitation reminders, and SMS delivery.
- Changing an already accepted person's account email or unlinking an accepted member.
- Granting roles or Diet/Finance access merely because an invitation was sent.

## Wireframe or UI changes

Each unlinked person shows an invitation badge and a short detail panel: recipient, sent date, expiry, and the available **Resend** or **Cancel invitation** action. The invitee's inbox shows **Accept** and **Decline**. Confirmation explains that declining leaves the inviter's family person record intact.

## API changes

- Proposed `GET /api/family/invitations/{invitationId}` returns a safe invitation summary only to an ADMIN of the family or its authenticated recipient.
- Proposed `POST /api/family/invitations/{invitationId}/resend` and `POST /api/family/invitations/{invitationId}/cancel` require ADMIN. Resend issues a replacement token; cancellation invalidates the active token.
- Proposed `POST /api/family/invitations/{invitationId}/decline` requires the verified recipient. Acceptance keeps the F018 endpoint and rules.
- Return `401` without a session, `403` for a non-ADMIN mutation or unverified recipient, `404` outside the caller's family or inbox, and `409` for a terminal invitation or conflicting active invitation. A delivery failure is explicit and does not link the account.

## MongoDB changes

Extend the existing family invitation record with status, `sentAt`, `expiresAt`, `declinedAt`, and `cancelledAt` as needed. Store only token hashes. Enforce at most one active invitation per family person; replacement invalidates the prior token before the new one is usable. Do not copy invited users' private feature data.

## Architecture decisions

- Keep sending on the existing server and email provider; no new service is proposed.
- Only an ADMIN can send, resend, or cancel, matching F018. A recipient's decline is their own consent decision.
- Invitation state changes never delete the family person. An accepted account link remains unaffected by later stale links.

## Acceptance criteria

- A pending invitation can be resent; the old link fails and the new link can be accepted once by a verified matching account.
- A cancelled, expired, or declined invitation cannot link an account. The person remains visible to authorized family members as a NON_USER.
- READONLY and EDITOR cannot resend or cancel, and an unrelated account cannot inspect invitation details.
- Replacing an incorrect email sends no usable invitation to the old address and does not duplicate the family person.
- Delivery failure and resend limits are visible without exposing the token or another account's existence.

## Local verification

After approval and implementation, test pending, expired, cancelled, declined, and accepted states with two verified accounts and one unrelated account. Use the local inbox to confirm only the latest link works; verify ADMIN-only mutations and the unchanged person ID.

## Open questions

1. What expiration and resend limit should family invitations use?
2. Should a declined invitation be resendable to the same email, or require the ADMIN to start a new invitation?
