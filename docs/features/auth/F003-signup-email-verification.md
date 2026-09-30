# F003: Signup email verification

- **Status:** Review
- **Branch:** `feature/F003-signup-email-verification`
- **Pull request:** Not created

## Goal

Send a verification email when a user signs up and allow the user to confirm ownership of the email address.

## User flow

1. The user submits the existing signup form.
2. The server creates the user as unverified.
3. The server creates a single-use verification token with an expiration time.
4. The server asks Mailpit on localhost to send an email containing a verification link.
5. The user opens the link in the local web application.
6. The web application sends the token to the server.
7. The server marks the user's email as verified and invalidates the token.
8. Until verification succeeds, login opens a verification-required page instead of the profile page.
9. The verification-required page explains why verification matters and allows the user to resend the email.
10. The web application shows a verification success or failure message.

## In scope

- Send one verification email during signup.
- Use Mailpit for local SMTP delivery and inbox review.
- Store only a hash of the verification token.
- Expire and remove unused verification tokens.
- Verify a valid token only once.
- Allow an unverified logged-in user to request a replacement verification email.
- Show a verification-required page before the user can access the profile.
- Show signup, verification-success, expired-token, and invalid-token states.
- Update the OpenAPI definition and Postman collection.

## Out of scope

- Password recovery emails
- Changing an account email
- External login providers
- Production email delivery
- Email templates beyond a simple local-development message

## Wireframe or UI changes

- After signup, replace the form result with a message asking the user to check their email.
- Add a local verification-result view for valid, expired, and invalid links.
- Allow an unverified user to log in, but show a verification-required page instead of the profile layout.
- Explain that verification confirms ownership of the address and protects account recovery.
- Provide a **Resend verification email** action on that page.

## API changes

### Existing endpoint change

`POST /api/auth/signup`

- Continue accepting `name`, `email`, and `password`.
- Create an unverified user and verification token.
- Send the verification email.
- Return `201` with a message indicating that verification is required and whether email delivery succeeded.
- If email delivery fails, keep the user account unverified and return enough information for the web page to explain that the email was not sent.

### New endpoint

`POST /api/auth/verify-email`

Request:

```json
{
  "token": "token-from-verification-link"
}
```

Responses:

- `200`: Email verified.
- `400`: Token is missing or malformed.
- `409`: Email is already verified.
- `410`: Token is invalid, expired, or already used.

### Resend the verification email

`POST /api/auth/resend-verification`

- Requires an authenticated, unverified user.
- Invalidates any earlier verification token for that user.
- Creates a new token that expires after one hour.
- Sends a new email through Mailpit.

Responses:

- `202`: A new verification email was accepted for delivery.
- `401`: Authentication is required.
- `409`: The email is already verified.
- `503`: Local email delivery failed; the account remains unverified.

### Existing login and current-user responses

- Login is allowed for a valid unverified account.
- User responses must include whether the email is verified so the web application can choose between the verification-required page and the profile page.

## MongoDB changes

### `users`

Add:

- `emailVerifiedAt`: nullable Date recording successful verification.

### `emailVerificationTokens`

Add a collection containing:

- `tokenHash`: unique SHA-256 hash of the token sent by email.
- `userId`: reference to the user.
- `expiresAt`: expiration date with a MongoDB TTL index.
- `createdAt`: creation date.

Tokens expire after one hour. Delete the token after successful verification. Creating a replacement token invalidates any earlier token for the same user.

## Architecture decisions

- Use Mailpit locally: SMTP on port `1025` and browser inbox on port `8025`.
- Verification tokens expire after one hour.
- Unverified users may log in but cannot access the profile page.
- Unverified users see a page explaining verification steps and importance.
- If email delivery fails during signup, the account remains created and unverified.
- The verification-required page provides a resend action for recovery.
- Verification links open `http://localhost:3000/verify-email?token=...`.

## Acceptance criteria

- Signup creates an unverified user and sends one local verification email.
- Failed email delivery does not delete the unverified user.
- The plain verification token is not stored in MongoDB.
- A valid token verifies the correct user.
- A used, expired, or modified token cannot verify an account.
- Verification records the time in `emailVerifiedAt`.
- Unverified users see verification guidance instead of the profile page.
- Resending invalidates the earlier token and sends a new one-hour token.
- Verification behavior is documented in OpenAPI and Postman.
- The entire flow runs locally.

## Local verification

1. Start MongoDB on port `27017`.
2. Start Mailpit with SMTP on port `1025` and its inbox on port `8025`.
3. Start the server and web application.
4. Sign up, then open the message at `http://localhost:8025`.
5. Open its verification link and log in to confirm the profile is available.

Verified locally on 2026-09-16:

- Signup delivered one message to Mailpit and returned an unverified user.
- Login and current-user responses preserved the unverified state.
- Resend delivered a replacement token and invalidated the earlier token.
- A valid token verified the user; reuse returned `410`.
- Two simultaneous uses produced one `200` and one `410`.
- With Mailpit stopped, signup kept the account unverified and resend returned `503`.
- The React production build completed successfully.

## Open questions

None. The scope and architecture decisions are approved for implementation.
