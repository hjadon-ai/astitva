# F041: Diet MCP server

- **Status:** Approved
- **Branch:** Not created
- **Pull request:** Not created
- **Approval:** Owner approved the initial read-only scope and decisions below in chat on October 10, 2026. Implementation and deployment are not authorized.

## Goal

Let users connect a compatible AI assistant to Astitva Diet and ask questions about their recorded meals, nutrition totals, water intake, and targets. Reuse the existing Diet services and MongoDB records so assistant responses reflect the same data as the application.

## User flow

1. The user connects their assistant to Astitva's remote MCP endpoint and authorizes access to their own Diet data.
2. The assistant discovers the available Diet tools.
3. The user asks, for example, “How much protein do I have left today?” or “Show my meals from yesterday.”
4. The assistant retrieves structured records and authoritative totals through MCP and explains them, including the requested date, units, and missing targets where relevant.
5. The user can disconnect access without losing any Diet records.

## In scope

### Initial delivery: read-only Diet access

- Authenticated remote MCP endpoint hosted alongside the existing REST API on Render.
- Own-workspace access only, subject to existing account verification and Diet feature-access rules.
- Read daily meals, nutrition totals, water intake, targets, bounded nutrition history, recent meals, and the user's personal Meal Library.
- Explicit dates in `YYYY-MM-DD`; resolve conversational terms such as “today” using the user's date/timezone context, never the Render host's calendar date alone.
- Structured tool results with existing nutrition field names and units: calories in kcal, macro/fiber values in grams, and water in milliliters.
- Connection authorization, revocation, bounded inputs/results, request limits, and operational error handling.
- Tool documentation and one end-to-end connection guide for a selected compatible client.

### Later phase, requiring separate owner approval

- Preview and explicitly confirm meal or water logging using existing validation and nutrition snapshot rules.
- Define server-enforced confirmation and retry/idempotency behavior before enabling write tools.
- Do not treat approval of the initial delivery as approval of these writes.

## Out of scope

- AI-generated nutrition estimates, model training, or replacing Meal Library search inside the app.
- Automatic dietary recommendations or changes to nutrition targets/body goals.
- Meal edits/deletions, library management/imports, and other write tools in the initial delivery.
- Shared family workspaces, managed NON_USER workspaces, and shared meal libraries in the initial delivery.
- Finance, chat, notes, or other application areas.
- A separate database or infrastructure migration.

## Wireframe or UI changes

No Diet layout change. Add Settings → Connected assistants, showing client, granted access, connection date, and a Disconnect action. Finalize exact authorization screens after compatibility verification. Do not ask users to paste an Astitva password into an assistant.

## API changes

Propose a remote MCP endpoint at `/mcp`, alongside the existing `/api/diet/*` REST endpoints. Transport and authorization endpoint details must be finalized against the chosen MCP SDK and client requirements before implementation.

| Proposed tool | Input | Output |
| --- | --- | --- |
| `diet_get_day` | Required `date` | Meals, nutrition totals, water total, configured targets, and remaining/over-target values |
| `diet_get_targets` | None | Current saved nutrition/water targets; explicit missing state where unset |
| `diet_get_history` | Required bounded start/end dates | Existing nutrition history summaries within the supported range |
| `diet_get_recent_meals` | None | Existing bounded recent-meal results with recorded portions and nutrition |
| `diet_search_personal_meals` | Optional search and category | Bounded personal library results with serving descriptions, nutrition, and truncation information |

- No tool accepts an arbitrary owner/user ID or workspace selector. Derive identity from authenticated authorization.
- Preserve existing history limits, rounding, snapshot values, validation, and missing-data semantics.
- Use explicit result/error states for invalid dates, unauthenticated or revoked access, denied feature access, unavailable records, rate limits, and backend failures. Empty results are not backend failures.
- Return safe MCP errors without credentials, stack traces, MongoDB details, or other users' data.
- Keep REST behavior unchanged; MCP tools call shared application services rather than duplicating calculations or bypassing authorization.

## MongoDB changes

No changes to existing Diet collections or nutrition fields are proposed.

Connection authorization/revocation may require dedicated grant/token metadata; its schema, expiration, indexes, and retention depend on the authentication design. Finalize these before implementation. Do not persist plaintext access credentials or duplicate Diet records for MCP.

## Architecture decisions

Owner-approved initial decisions, subject to the compatibility prerequisite below:

- Run the MCP adapter in the existing Express/Render backend and share the application-service layer and MongoDB connection with REST.
- Use a remote HTTP MCP transport supported by the selected SDK/client; validate protocol and deployment requirements during implementation planning.
- Start with read-only own-workspace tools. The adapter must independently enforce authentication, verification, Diet access, and ownership; existing REST middleware alone does not protect a new endpoint.
- Support Codex first, with one documented connection flow. Use scoped, revocable OAuth authorization with Astitva login for user consent, subject to compatibility verification; do not assume existing browser login tokens are sufficient.
- Log tool name, outcome, duration, and a correlation ID while excluding tokens and meal contents from routine logs.
- Start with 30 tool calls per minute per user, at most 31 days per history query, and 50 library results per call. Explicitly report rate limits and truncation. These are starting defaults, not measured capacity claims; finalize request-size limits during implementation planning.
- Review Render plan availability, timeouts, proxy behavior, and any transport/session requirements before production enablement. Deployment is a separate authorized action.
- Use the existing Render backend and plan initially, with tool latency, errors, CPU, and memory monitored before proposing an upgrade. No uptime guarantee for the first release.

### Prerequisite and authorization boundary

Verify current Codex/MCP transport and OAuth compatibility before implementation. Record the supported flow and any required authorization endpoints, grant storage, or deployment changes. Raise any required scope or infrastructure changes for owner review. This verification has not yet been performed; approval does not establish compatibility.

Feature approval does not authorize implementation or deployment. Wait for a separate owner instruction to start implementation, and retain separate authorization for deployment.

## Acceptance criteria

- A selected compatible remote MCP client can connect, discover the tools, and retrieve authorized Diet data.
- Daily totals, saved targets, historical snapshots, recent portions, and personal-library nutrition match the corresponding existing Diet behavior.
- All exposed operations are read-only; tool calls cannot create or modify Diet records.
- Invalid, expired, or revoked credentials are rejected; an authenticated user cannot access another user's data.
- Feature-disabled/unverified accounts are denied consistently with existing application rules.
- Managed/shared workspace selectors are rejected and shared-library data is not exposed by the initial personal-library tool.
- Missing targets, empty days, truncated results, invalid dates, and backend failures are distinguishable.
- Bounded history and timezone-sensitive date cases behave as documented.
- Connection revocation prevents subsequent tool access without affecting existing Diet data or application login.
- Existing REST endpoints continue to operate unchanged.

## Local verification

Approved specification only; no implementation, compatibility verification, or runtime tests performed.

Implementation verification should cover tool discovery/invocation, authenticated MongoDB-backed comparisons with REST, ownership/feature-access denials, revocation, invalid inputs, limits, and read-only guarantees. Verify the selected client locally, then smoke-test an authorized Render deployment. Record actual commands and results here during implementation.

## Open questions

- Confirm current Codex/MCP compatibility with the approved remote HTTP and OAuth approach before implementation.
- Finalize authorization endpoints, grant/token metadata schema and lifetime, consent-screen details, and request-size limits during planning. Raise any required scope or infrastructure changes for owner review.
