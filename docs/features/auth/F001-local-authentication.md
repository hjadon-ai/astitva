# F001: Local authentication

- **Status:** Done
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Allow a user to create a local account, log in, restore their session, and log out.

## User flow

1. The user signs up with a name, email, and password.
2. The user logs in with their email and password.
3. The server creates an HTTP-only session cookie.
4. The application restores the user from the session.
5. Logout deletes the server session and clears the cookie.

## In scope

- Signup
- Login
- Current-user lookup
- Logout
- Local MongoDB persistence
- OpenAPI and Postman definitions

## Out of scope

- Password recovery
- Email verification
- External identity providers
- User roles and permissions

## API changes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create a local account |
| POST | `/api/auth/login` | Create a login session |
| GET | `/api/auth/me` | Return the logged-in user |
| POST | `/api/auth/logout` | Delete the login session |

## MongoDB changes

- `users` stores the name, normalized email, and password hash.
- `sessions` stores hashed session tokens, user references, and expiration dates.

## Architecture decisions

- Express.js backend
- MongoDB on localhost
- MongoDB-backed sessions using an HTTP-only cookie
- Passwords hashed with bcrypt

## Acceptance criteria

- Signup creates a user without storing the plain password.
- Login creates a session and returns the user.
- Current-user lookup requires a valid session.
- Logout invalidates the session.
- All endpoints can be run from Postman.

## Local verification

The signup, login, current-user, and logout sequence was verified locally. The temporary verification account was removed afterward.

## Open questions

None for the current local version.
