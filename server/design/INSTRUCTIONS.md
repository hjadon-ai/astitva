# Server design

## Context

This folder will hold the design documents for the Astitva backend.

## Instructions

- Keep REST API definitions in this folder.
- Keep the Postman collection and its local environment definition here.
- Update the API definition and Postman collection when an API is approved and implemented.
- Document approved groups of related APIs together.
- Keep MongoDB collection designs here only after they are discussed and approved.

## Current step

Review the F009 Daily Priorities OpenAPI, Postman requests, and `dailyPriorityDays` collection design.

F005 is ready for manual review: Diet is accessible from the verified profile, with meal entry, daily totals, fiber, and editable targets. See `../../docs/features/diet/F005-daily-diet-tracking.md` for manual checks.

Use `Astitva.production.postman_environment.json` only after replacing its provider-domain placeholders. Production unsafe requests must include the exact `Origin` header, and Finance remains disabled during the core rollout.

F006 is ready for manual review. `finance.openapi.json` defines the Finance endpoints and the Postman collection contains matching local requests.

F007 is ready for manual review. Use `Astitva.dev.postman_environment.json` for Dev and `Astitva.stage.postman_environment.json` for Stage; neither contains provider credentials or access tokens.

F009 is ready for manual review. `priorities.openapi.json` defines its date, timezone, ownership, validation, and three-slot capacity behavior; both Postman environments include its local variables.
