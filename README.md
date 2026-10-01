Context:
I am building a simple single page website
Idea is to build a web application powered by backend
The development sould be very slow
I will take all solution architect based decisions
Do not deploy the application without an explicit deployment request. Local implementation and validation come first.

Task:
Create folder structure for the web application
Create seperate folder strcuture for backend application 
Create/suggest folder structure for mcp tool/server

Constraints:
Do simple small tasks and ask for my input
Increase speed once I allow
Keep first version very simple
Help me learn with you
I am technical developer and designer
I get uncomfortable if I do not understand the wireframe

Working process:
- Suggest one small change at a time and explain its purpose.
- Wait for my approval before creating folders, files, or code.
- Do not choose frameworks or architecture on my behalf.
- Before implementing a page, agree with me on a simple wireframe.
- After each change, explain what changed and pause for my review.

Current status:
- The React web application runs locally on port 3000.
- The Express server runs locally on port 3001.
- MongoDB runs locally. Dev uses `astitva`; Stage uses the isolated `astitva_stage` database.
- Health, signup, email verification, password reset, login, current-user, and logout APIs are implemented and documented for Postman.
- Signup, email verification, password reset, login, profile-session restoration, and logout are connected to the local authentication APIs.
- The authenticated Overview tab currently contains sample layout content.
- Daily diet tracking and Finance are available from the verified profile. Dev uses Plaid Sandbox; Stage uses Plaid Production for real accounts.
- Finance reads synchronized data from local MongoDB; Plaid credentials and encrypted access tokens remain on the server.

Feature tracking:
- Keep the feature index in `docs/features/README.md`.
- Give every feature an ID such as `F001`.
- Write and review the feature document before implementation.
- Use these statuses: Proposed, Approved, In Progress, Review, Done.
- Record the Git branch and pull request in the feature document when they exist.

Git workflow:
1. Approve the feature document.
2. Create a branch named `feature/F###-short-name`.
3. Implement only the approved scope.
4. Run and review the feature locally.
5. Commit the reviewed changes.
6. Push only the feature branch when requested; never push directly to `main`.
7. Give the user the branch name and ask them to create and review a pull request. Record its link in the feature index when it exists.
8. The user merges the pull request manually; then mark the feature Done.

Remote rule:
- Do not initialize a remote, push a branch, or create a pull request without an explicit request. Never merge a pull request on the user's behalf or push directly to `main`.
- A request to build, proceed, or test authorizes local work only.

ChatGPT brainstorming project:
- Setup files are in `chatgpt-project/`.
- Use that ChatGPT Project to brainstorm and produce copy-ready Codex feature prompts.
- Keep repository implementation and Git actions in Codex under the workflow above.

F005 is ready for manual review: Diet is accessible from the verified profile, with meal entry, daily totals, fiber, and editable targets. See `docs/features/diet/F005-daily-diet-tracking.md` for manual checks.

## Local environments

Install dependencies once in `server/` and `web/`, then start MongoDB and Mailpit. Configure one or both ignored profile files from their tracked examples:

- `server/.env.dev.example` → `server/.env.dev` for Plaid Sandbox and `astitva`
- `server/.env.stage.example` → `server/.env.stage` for Plaid Production/Trial and `astitva_stage`

Use independent 32-byte finance encryption keys. Then run one profile from the repository root:

```sh
./scripts/start-local.sh dev
./scripts/start-local.sh stage
```

Only one profile runs at a time on ports `3000` and `3001`. Stage remains local; browser Plaid Link and server requests to Plaid are its only external communication. Import the matching Dev or Stage Postman environment from `server/design/`.

F006 is ready for manual review. F007 adds the isolated local Stage profile and environment banner. See their feature documents in `docs/features/` for manual checks.

F011 is ready for manual review on `feature/F011-application-visual-system`. It adds the shared light visual system, responsive application shell, Lucide icons, reusable presentation components, and consistent styling without changing API behavior.

F009 Daily Priorities is ready for manual review on `feature/F009-daily-priorities`.
The private page supports up to three priorities per day, completion progress,
past-date navigation, inline editing and deletion, and local MongoDB persistence.
The automated MongoDB ownership and concurrency suite and the web build pass. See
`docs/features/priorities/F009-daily-priorities.md` for the manual browser checklist.

F012 adds a locally reviewable Production profile and deployment configuration for Firebase Hosting, Render, MongoDB Atlas, invite-only signup, and provider-neutral SMTP. It does not deploy anything. See `docs/infra/production.md`.

F008 Diet targets and Meal Library is implemented on `feature/F008-diet-targets-meal-library` and merged into main. It adds six daily targets, water tracking, a personal Meal Library, and CSV preview/import.
