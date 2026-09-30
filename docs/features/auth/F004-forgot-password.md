# F004: Forgot password

- **Status:** Review
- **Branch:** `feature/F004-forgot-password`
- **Pull request:** Not created

## Goal

Allow a user who has forgotten their password to request a secure reset email and choose a new password.

## User flow

1. The user selects **Forgot password** from the login form.
2. The user submits their email address.
3. The server returns the same confirmation response whether or not the account exists.
4. If a verified account exists, the server creates a single-use reset token and sends a local email containing a reset link.
5. The user opens the link in the local web application.
6. The user enters and confirms a new password.
7. The web application sends the reset token and new password to the server.
8. The server updates the password hash and invalidates the reset token.
9. The web application returns the user to login with a success message.

## In scope

- Forgot-password link and email form
- Generic forgot-password response to avoid exposing registered emails
- Local password-reset email
- Single-use, expiring reset token
- New-password form with password confirmation
- Password reset API
- Invalidate the reset token after successful use
- Update OpenAPI and Postman documentation

## Out of scope

- Changing a password while already logged in
- Account recovery without email access
- Production email delivery
- Administrative password resets
- Reusing a password-reset token
- Automatically logging in after password reset

## Wireframe or UI changes

- Add **Forgot password?** below the login password field.
- Add a form that accepts an email address.
- Show the same request-confirmation message for every submitted email.
- Add a reset-password view opened by the email link.
- Show success, invalid-token, expired-token, and validation-error states.

## API changes

### Request a password reset

`POST /api/auth/forgot-password`

Request:

```json
{
  "email": "developer@example.com"
}
```

Responses:

- `202`: Always return a generic message such as: `If an account exists, a reset email has been sent.`
- `400`: Email is missing or malformed.

The response must not reveal whether the email exists.
For an unverified account, return the same generic `202` response but do not create a token or send an email.
For a verified account that has reached two requests in the rolling 24-hour window, return the same generic `202` response but do not create a token or send an email.

### Reset the password

`POST /api/auth/reset-password`

Request:

```json
{
  "token": "token-from-reset-link",
  "password": "new-local-password"
}
```

Responses:

- `200`: Password was changed successfully.
- `400`: Token or password is missing or malformed.
- `410`: Token is invalid, expired, or already used.

## MongoDB changes

### `passwordResetTokens`

Add a collection containing:

- `tokenHash`: unique SHA-256 hash of the reset token.
- `userId`: reference to the user.
- `expiresAt`: expiration date with a MongoDB TTL index.
- `createdAt`: creation date.

Only the token hash is stored. The plain token appears only in the local reset link. Creating a new token should invalidate earlier password-reset tokens for that user.

### `users`

The successful reset replaces `passwordHash` and updates `updatedAt`. The plain password is never stored.
Store only the two most recent eligible reset-request timestamps needed for the rolling 24-hour limit.

### `sessions`

Decide whether all active sessions for the user are deleted after a successful reset.

## Architecture decisions

- Reuse Mailpit, the local email tool selected for F003.
- Password-reset tokens expire after one hour.
- A successful password reset invalidates all active sessions for the user.
- Limit password-reset email requests to two per account per rolling 24-hour period.
- Keep the existing password rule: a minimum of 8 characters.
- Unverified accounts cannot request or complete a password reset.

## Acceptance criteria

- The forgot-password response does not reveal whether an account exists.
- An unverified account receives the generic response but no reset token or email.
- A registered user receives one local reset email.
- The plain reset token is not stored in MongoDB.
- A valid token changes the password once.
- An expired, modified, or used token cannot change the password.
- The old password no longer works after a successful reset.
- The new password works after a successful reset.
- API behavior is documented in OpenAPI and Postman.
- The complete flow runs locally.

## Local verification

Verified locally on 2026-09-16:

- Unknown and unverified accounts received the same generic `202` response without reset email delivery.
- A verified account received two reset emails; a third request returned the same response without another message.
- The second reset request invalidated the first token.
- A valid token changed the password and token reuse returned `410`.
- The old password failed and the new password succeeded after reset.
- Two active sessions were invalidated by the successful reset.
- The React production build completed successfully.

## Open questions

None. The scope and architecture decisions are approved for implementation.
