# Server application

## Context

This folder contains the Node.js backend for the Astitva personal workspace.

## Instructions

- Keep REST APIs, MongoDB connection code, and MongoDB models in this folder.
- MongoDB runs on localhost. Dev uses `astitva`; Stage uses `astitva_stage`.
- Use Express.js, as approved.
- Keep approved authentication APIs together; add later feature APIs and collections in small reviewed groups.
- Keep the backend separate from the web application.
- Keep a folder for design and keep api definition 
- Keep a postman collection for the ready api with local environment variables

## Current step

Review F009 Daily Priorities with the private per-day REST API and local MongoDB persistence.

## Run locally

1. Start MongoDB on `localhost:27017`.
2. Start Mailpit with SMTP on `localhost:1025` and its inbox on `http://localhost:8025`.
3. From this folder, run `npm install` once.
4. From the repository root, run `./scripts/start-local.sh dev` or `./scripts/start-local.sh stage`.
5. The API is available at `http://localhost:3001`.

Copy `.env.dev.example` or `.env.stage.example` to the corresponding ignored environment file. Add the matching Plaid secret and a different 32-byte `FINANCE_TOKEN_ENCRYPTION_KEY` to each profile. Startup rejects missing, placeholder, remote, or crossed-profile configuration.

Import the collection and matching Dev or Stage environment from `design/` into Postman. Postman keeps the profile-specific HTTP-only login session cookie. Copy tokens from Mailpit links into `verificationToken` or `resetToken` when testing those endpoints directly.

F005 is ready for manual review: Diet is accessible from the verified profile, with meal entry, daily totals, fiber, and editable targets. See `../docs/features/F005-daily-diet-tracking.md` for manual checks.

F006 is ready for manual review: Finance uses Plaid Sandbox for connect/sync and stores the normalized result in local MongoDB. See `../docs/features/F006-personal-finance.md`.

F007 is ready for manual review: the two profiles have isolated configuration, databases, cookies, and finance-provider environments. See `../docs/features/F007-local-stage-environment.md`.

F009 is ready for manual review: verified users can manage up to three private priorities for today or a past date. See `../docs/features/F009-daily-priorities.md`.

F012 adds a strict Production runtime for Render and MongoDB Atlas. Production secrets belong only in Render, Finance starts disabled, and unsafe writes require the exact configured web origin. See `../docs/infra/production.md`.
