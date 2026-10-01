# F002: Local profile page

- **Status:** Done
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Connect the local React application to authentication and show a sample profile layout after login.

## User flow

1. A visitor opens the public landing page.
2. The visitor signs up or logs in.
3. A logged-in user sees the local profile layout.
4. Refreshing restores the active session.
5. Logout returns the user to the public page.

## In scope

- React and Vite local application
- Signup and login forms
- Authentication API integration
- Session restoration
- Sample authenticated profile layout
- Logout
- Responsive layout

## Out of scope

- Editing profile information
- Real projects and notes
- Public-content APIs
- Profile image uploads

## Wireframe or UI changes

- Public landing-page header, introduction, project placeholders, and about section
- Login and signup panel on the public page
- Authenticated sidebar, account card, summary cards, and workspace placeholder

## API changes

No new API endpoints. This feature consumes the F001 authentication endpoints.

## MongoDB changes

None.

## Architecture decisions

- React with Vite
- Express remains a separate backend application
- Vite proxies relative `/api` requests to the Express server on port 3001

## Acceptance criteria

- Signup creates a local account.
- Login opens the profile layout.
- Refreshing preserves an active session.
- Logout returns to the public page.
- The page works at desktop and mobile widths.

## Local verification

The production build completed successfully. Signup, login, current-user lookup, logout, and post-logout rejection were verified through the Vite proxy. The temporary verification account was removed afterward.

## Open questions

- Does the public-page layout meet the intended visual direction?
- Which real information should appear in the authenticated profile?
