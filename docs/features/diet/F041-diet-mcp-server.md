# F041: Diet MCP server

- **Status:** Done
- **Branch:** `feature/F041-diet-mcp-server`
- **Pull request:** Merged; owner confirmed in chat on October 10, 2026 (PR number not recorded).
- **Approval:** Owner approved the initial read-only scope and decisions below in chat on October 10, 2026. That initial approval did not authorize implementation or deployment; implementation was subsequently authorized.

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

Verify current Codex/MCP transport and OAuth compatibility before implementation. Record the supported flow and any required authorization endpoints, grant storage, or deployment changes. Raise any required scope or infrastructure changes for owner review. Compatibility was checked against official documentation and the installed Codex CLI: OAuth metadata discovery, dynamic registration, and a PKCE authorization URL succeeded against the disposable local server. Automated tests complete the PKCE exchange and tool flow. A full Codex browser-login session remains an owner review check.

Owner subsequently authorized implementation and an application version increase in chat. Deployment remains unauthorized.

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

Completed locally on October 10, 2026:

- `ASTITVA_TEST_MCP=1 npm test` in `server/`: 72 passed, 12 unrelated opt-in integration tests skipped. F041 ran against a disposable MongoDB instance on port 27141; no application database was used.
- `npm test` in `web/`: 25 passed. `npm run build`: passed with the existing large-bundle warning.
- Deployment version checks passed for server and web 1.1.0; `git diff --check` passed.
- Installed Codex CLI discovered OAuth metadata and dynamically registered a public client, producing a resource-bound S256 authorization URL. Cancelled before saving fixture credentials.
- Desktop browser review verified login, Settings navigation, empty connections and consent account/client/callback/scope display. Corrected same-page hash changes so a new consent request loads while Settings is already open.
- F041 integration covers REST total parity, own-data scope, shared-library exclusion, history, recent meals, library truncation, strict tool inputs, PKCE/replay, refresh rotation, feature denial, request origin/cookie rules, per-user rate limits and revocation. Meal count and application session remain unchanged.
- Dependency audit reports two moderate advisories in the existing gaxios/uuid chain; none attributed to the MCP SDK. No unrelated dependency fixes applied.

Owner review: follow [the connection guide](mcp-connection-guide.md), complete a full Codex OAuth login, invoke all five tools, and disconnect. Mobile and appearance variants remain manual checks. Render smoke testing waits for separately authorized deployment. No commit, push or deployment performed.

## Implementation decisions and review

- Official SDK 1.32.1 supplies stateless Streamable HTTP and OAuth protocol routes; persistent Astitva grants use S256 PKCE, dynamic registration, one-hour access tokens, rotating refresh tokens and 30-day grants.
- `MCP_PUBLIC_URL` explicitly enables the endpoint; unset keeps MCP disabled. Production must use the existing backend HTTPS `/mcp` URL. No Render configuration or deployment was changed.
- Protocol requests are limited to 16 KiB; structured tool results to 256 KiB. Oversized results fail explicitly. Existing 30 calls/minute, 31-day history and 50-meal limits are implemented.
- Personal search includes owned active named libraries and unmigrated legacy meals; shared/saved references are excluded and no migration runs during reads.
- Web and server versions increased from 1.0.3 to 1.1.0, including lockfiles and deployment input descriptions.
- Schema and endpoints: [MCP design](../../../server/design/diet-mcp.md), [OpenAPI](../../../server/design/diet-mcp.openapi.json). [Codex connection guide](mcp-connection-guide.md).
- Branch starts from the existing F040 branch because fetched main still ended at the F039 merge. Preserve/reconcile that base when preparing a PR; F040 completion documentation remains preserved.

## Open questions

None requiring a scope change. Owner review must complete a real Codex login and, after separate deployment authorization, a Render smoke test. Mobile and appearance variants remain manual UI checks.

## Per-user MCP access

Owner requested selective MCP access through Admin on October 10, 2026. Admin → Users (or Invitees) → Feature access includes **MCP access (requires Diet)**. The `mcp` flag defaults to false, including existing records where absent. Enable both Diet and MCP for selected accounts. Verification and server-level `MCP_PUBLIC_URL` are also required. Consent, code exchange, refresh and each MCP request recheck access. Disabling MCP blocks subsequent requests from existing connections without disabling ordinary Diet use. Re-enabling can restore unexpired connections; use Disconnect for permanent grant revocation. Settings is shown only with both permissions. Existing users, including the owner, must be explicitly enabled; no automatic migration grants access.

Per-user access verification: focused MCP tests (4) and Admin integration (1) passed. The MCP fixture covers absent/false permission, existing-token denial, refresh denial, re-enable and unaffected ordinary Diet reads. Admin verifies default-off behavior, saving the switch and profile propagation. Web build passed with the existing large-bundle warning. No account flags, commits, pushes or deployments were changed for this follow-up.

Additional regression checks: all 25 web tests passed; feature-default and cross-site bearer-session checks passed with the new default-off permission. Owner browser review of the new Admin checkbox remains pending.

Owner confirmed the PR was merged and deployed on October 10, 2026. Deployment is owner-reported; no independent production verification was performed in this update.
