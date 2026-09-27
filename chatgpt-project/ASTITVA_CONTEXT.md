# Astitva project context

Updated: 2026-09-21

## Product

Astitva is a personal workspace. It began as a simple single-page application and is growing through small, reviewed features. The public page contains placeholder content and local authentication. A verified user can enter a private profile area.

The project owner is a technical developer and designer. He prefers to understand and approve the user flow, wireframe, API contract, database changes, and architecture before implementation. Early work should proceed slowly; speed may increase after scope and decisions are approved.

## Technical baseline

- Web: React with Vite in `web/`, running locally on `http://localhost:3000`.
- Server: Node.js with Express in `server/`, running locally on `http://localhost:3001`.
- Database: MongoDB only, running locally at `mongodb://127.0.0.1:27017/astitva`.
- Email testing: Mailpit on local SMTP port `1025`, inbox at `http://localhost:8025`.
- API style: JSON REST endpoints under `/api`.
- API documentation: `server/design/openapi.yaml` plus related definitions and a Postman collection/environment in `server/design/`.
- Authentication: HTTP-only `astitva_session` cookie backed by hashed session tokens in MongoDB.
- Runtime and development remain local. Do not propose deployment unless the owner asks.

## Repository structure

- `README.md`: project-wide rules, current status, and Git workflow.
- `docs/INSTRUCTIONS.md`: documentation rules.
- `docs/features/README.md`: feature index and statuses.
- `docs/features/F###-*.md`: scope, wireframe, API, MongoDB, decisions, acceptance criteria, and verification notes for each feature.
- `server/src/models/`: Mongoose models.
- `server/src/routes/`: Express REST routes.
- `server/src/services/`: local integrations such as Mailpit email.
- `server/design/`: OpenAPI, Postman, and MongoDB collection documentation.
- `web/src/`: React interface and styles.

## Current feature history

- F001 — Local authentication: signup, login, current user, logout, MongoDB sessions.
- F002 — Local profile page: authenticated sample profile layout.
- F003 — Signup email verification: Mailpit delivery, hashed one-hour tokens, resend, verification-required page.
- F004 — Forgot password: generic request response, verified accounts only, two requests per rolling 24 hours, hashed one-hour token, session invalidation after reset.
- F005 — Daily diet tracking: locally implemented and awaiting manual review as of this context update. It covers meals by date, calories, protein, carbohydrates, fat, fiber, editable daily targets, totals, and over-target indicators.

Always confirm current feature statuses from `docs/features/README.md` when the repository or refreshed project sources are available.

## Product and architecture rules

- Keep the web application and server application separate.
- The browser calls REST APIs; it does not contain backend or database code.
- Use MongoDB on localhost and document every new collection.
- Protect private endpoints with authentication. Features that require a verified account must return `403` for unverified users.
- Keep data private to the authenticated user by including user ownership in database queries.
- Validate input and document important status codes.
- Update OpenAPI and Postman whenever APIs change.
- Prefer a simple first version; explicitly put adjacent capabilities out of scope.
- Agree on a simple wireframe before implementing a page.

## Feature lifecycle

Statuses are:

`Proposed → Approved → In Progress → Review → Done`

Workflow:

1. Create a feature proposal in `docs/features/` and add it to the feature index.
2. Review its goal, flow, scope, wireframe, APIs, MongoDB changes, architecture, acceptance criteria, and open questions.
3. The project owner explicitly approves the feature and resolves open questions.
4. Codex creates `feature/F###-short-name` and implements only the approved scope.
5. Codex performs proportionate local checks and leaves a manual review checklist.
6. The owner reviews locally.
7. Codex commits and pushes only when explicitly requested.
8. The owner always creates the pull request manually.
9. After merge, record the pull-request link and mark the feature Done.

## Git rules

- Preserve unrelated and user-authored worktree changes.
- One implementation feature per branch.
- Do not push without explicit permission.
- Never create a pull request for the owner.
- Never merge without an explicit request.

## What the ChatGPT Project should do

Use this project for idea exploration, product decisions, wireframes, API and data design, and creating copy-ready implementation prompts for Codex. Keep brainstorming separate from repository implementation. When current code details matter, consult the connected repository or ask for an updated project source rather than inventing them.
