# Web application

## Context

This folder contains the single-page frontend for the Astitva personal workspace.

## Instructions

- Preserve the approved public-page wireframe while adding reviewed behavior.
- Keep the first version small and easy to understand.
- Use React with Vite for the local single-page application.
- The frontend may call backend APIs, but it must not contain backend or database code.
- Work on one reviewed change at a time.

## Current step

Review F009 Daily Priorities in the authenticated application shell.

## Run locally

1. Start MongoDB and Mailpit.
2. Install dependencies once in this folder and `server/`.
3. From the repository root, run `./scripts/start-local.sh dev` or `./scripts/start-local.sh stage`.
4. Open `http://localhost:3000`.

Vite sends relative `/api` requests to the Express server at `http://127.0.0.1:3001` during local development.

F005 is ready for manual review: Diet is accessible from the verified profile, with meal entry, daily totals, fiber, and editable targets. See `../docs/features/F005-daily-diet-tracking.md` for manual checks.

F006 is ready for manual review: Finance is accessible from the verified profile and uses Plaid Link only for Sandbox account connection. Summary and account pages read synchronized local data. See `../docs/features/F006-personal-finance.md`.

F007 is ready for manual review: authenticated pages show the active profile, and Stage confirms before opening Plaid Production Link. See `../docs/features/F007-local-stage-environment.md`.

F011 is ready for manual review: the React application uses semantic visual tokens, the shared presentation components under `src/ui/`, Lucide icons, and a responsive application shell. Existing feature behavior and API contracts remain unchanged. See `../docs/features/F011-application-visual-system.md`.

F009 is ready for manual review: the sidebar opens a per-day list with up to three priorities, progress, inline add/edit/delete, completion controls, and past-date navigation. See `../docs/features/F009-daily-priorities.md`.

F012 uses `VITE_API_BASE_URL` only for the Production build. Never place server credentials in a `VITE_` variable. Firebase serves the generated `dist/` files; deployment remains manual. See `../docs/infra/production.md`.
