# F031: Admin Panel

- **Status:** Done
- **Branch:** `feature/changes_04-Oct-2026`
- **Pull request:** Not created

## Implemented scope

The responsive `/admin` page uses the existing Astitva session and login flow. Signed-out users log in on the same URL; non-admins see the permission message, Return to Home, and Sign out. Admin navigation is shown only for verified administrators.

`ADMIN_EMAILS` is a server-only, comma-separated email allowlist, normalized by trimming and lowercasing. Missing configuration disables access; malformed addresses reject startup. Every admin request rechecks the current configuration, session expiry, and verification. No stored admin role, separate token, or browser secret is used.

Administrators search registered users by literal email/name substring with bounded input, stable name/ID ordering, pagination, and safe profile fields. Existing users have feature access edited only; name, email, verification, and credentials remain read-only, per owner decision. The five supported features use existing defaults, including Family enabled. Feature updates conditionally write the invitation record using a version token, so stale edits return 409 without overwriting changes. No related user-profile write is needed.

The Invitees tab looks up normalized emails and distinguishes registered accounts, existing access records, and new invitees. New invitees gain signup eligibility and selected features without account creation or verification. Creation also sends an invitation through the existing email provider. Delivery failure preserves access and displays a retry action. Send invitation email explicitly retries or resends; creation and delivery are limited in Production to 10 requests per minute per client, within the admin API limit of 120 requests per minute. No audit history or other proposed account controls are included.

Feature changes affect subsequent requests and refresh the existing profile/navigation flow. Disabling Chat revokes existing Firestore grants. If cleanup fails, access remains disabled and a 503 instructs the administrator to reload and save again. Chat token issuance rechecks feature access after creating its grant to handle concurrent revocation.

## API

All endpoints require an active verified cookie or bearer session and allowlisted email; responses use `Cache-Control: no-store`. Missing/expired sessions return 401, non-admins return 403 with `ADMIN_ACCESS_REQUIRED`, and unverified accounts return the existing verification error. Login/profile responses provide a server-computed `isAdmin` navigation hint.

- `GET /api/admin/users?q=...&page=...&limit=...`: literal search, 1–100 characters, default 25 results, maximum 50, bounded pages.
- `GET /api/admin/users/:id`: safe profile, effective features, and version.
- `PATCH /api/admin/users/:id`: `{ features, expectedVersion }`; protected fields are rejected.
- `GET /api/admin/invitees?email=...`: access record, registration indicator, and version; 404 includes registration indicator.
- `POST /api/admin/invitees`: `{ email, features }`; 201 includes invitee and `invitationSent`, with a warning on delivery failure. Duplicate emails return 409 without resending.
- `PATCH /api/admin/invitees/:id`: `{ features, expectedVersion }`; email is read-only.
- `POST /api/admin/invitees/:id/send-invitation`: explicit send/resend; 200 on delivery, 503 on failure.

Input errors return 400, missing records 404, stale saves 409, and rate limits 429. Unknown feature keys and non-boolean values are rejected. API schemas are in `server/design/admin.openapi.json`; Postman requests are included in the existing collection.

## Configuration and local review

Set `ADMIN_EMAILS=admin@example.com,other@example.com` separately in each server environment and restart. Render declares the setting with `sync: false`. Provision each administrator's normal signup eligibility and verify the account; allowlisting does not bypass either. See `docs/infra/production.md` and the environment examples.

Open `/admin` locally as a verified allowlisted account, search for a user and edit access, then look up a new invitee and choose Save and send invitation. Review the confirmation summary before saving. Test a second browser's stale edit and a non-admin's permission page. Use Send invitation email after a delivery error. Real email delivery and an open Firestore chat should be checked with configured Stage providers.

## Verification

- Local Stage integration tests passed for cookie/bearer authorization, unverified and non-admin denial, private safe responses, literal search, input validation, duplicates, stale writes, profile feature refresh, and Chat access denial.
- Allowlist changes, multiple administrators, mocked Chat cleanup failure/retry, and mocked invitation delivery failure/retry passed. Fixtures are removed after testing; email delivery is mocked.
- Server regression suite: 39 passed, 5 opt-in checks skipped (F031 was run separately). Runtime and request-security checks passed; cross-site Production bearer-session regression passed.
- Web production compilation passed. The existing bundle-size warning remains.
- Browser keyboard/mobile review, real email delivery, and live Firestore revocation remain manual review checks; automated revocation coverage uses the service boundary mock.

## Owner decisions

### 1. Approve the proposed single `ADMIN_EMAIL` model, or should the first release support an email allowlist?

> email allowlist

### 2. Is editing name and feature access sufficient, or do you also need email changes? Email changes would require a broader identity and verification design.

> New email can be added, for existing only feature access change is sufficient

### 3. Which recommended additions belong in the first release? Recommendation: audit history first, session revocation next; defer bulk operations.

> none

### 4. Should adding an invitee only save access as proposed, or also offer an explicit **Send invitation email** action?

> Yes should also get an invite email.

### 5. If audit history is included, what retention period should it use?

> No audit history required
