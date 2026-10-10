# F041 Diet MCP design

The existing backend serves stateless Streamable HTTP at `/mcp` using the official MCP SDK. OAuth endpoints are installed by the SDK, with a persistent Astitva provider. Public clients use dynamic registration, authorization code + S256 PKCE, and `diet:read` only. No third-party identity provider or new hosting service is introduced.

## Collections

- `mcpClients`: random client ID, public client name, validated redirect URI allowlist, SDK-compatible public metadata, created/updated timestamps. Only public clients (`none`) with loopback HTTP or HTTPS redirects; no outbound URL fetching. Registration records expire after 90 days; reconnect/register after expiry.
- `mcpAuthorizations`: SHA-256 request-ticket hash, client ID/name, redirect URI, state, challenge, resource, optional owner ID and authorization-code hash, expiry. Ten-minute consent tickets; approved codes expire after one minute. Atomic code consumption; TTL cleanup. Never stores plaintext tickets/codes.
- `mcpGrants`: owner ID, client ID/name, scope, resource, access/refresh hashes, access expiry (one hour), grant expiry (30 days), revocation time, timestamps. Refresh tokens rotate atomically; revocation invalidates access and refresh immediately. Only token hashes are persisted. Index access/refresh hashes uniquely and owner for connection listing; TTL on grant expiry. Grant metadata is not a Diet record.
- `mcpRateLimits`: hashed bucket key, count, expiry; atomic per-user 30 tool calls/minute, shared across instances, TTL cleanup. OAuth endpoints additionally have SDK per-process IP limits.

All MongoDB expiry checks are explicit; TTL cleanup delay never extends access. Routine logs include correlation ID, tool name, outcome and duration only.

## Boundaries

`MCP_PUBLIC_URL` is the exact public `/mcp` URL: HTTPS in production, loopback HTTP allowed locally. Empty means disabled; existing deployments continue unchanged until explicitly configured. Metadata uses the configured origin, never untrusted request Host. MCP/OAuth protocol requests are cookie-free and validate Origin when present; application consent/revocation endpoints keep existing browser origin/session protections. Shared/managed selectors are rejected.

Consent is shown in Settings → Connected assistants after Astitva login, with explicit account, client name (unverified label), callback destination, read-only scope, Allow and Deny. Request details are retrieved via authenticated APIs; no session token enters a URL. Own-workspace access and feature verification are checked at consent and each MCP request.

History accepts explicit start/end dates, at most 31 inclusive days, within the existing three-calendar-month window in the supplied IANA timezone. Shared read services supply REST and MCP totals, history and recent meals. Personal search includes owned active named libraries and unmigrated legacy personal meals, excludes shared/saved references, and never triggers migration; at most 50 results plus `hasMore`.

Protocol body limit: 16 KiB. MCP responses are bounded to 256 KiB; an oversized day fails explicitly rather than returning incorrect partial totals. Library search max 120 characters. No relative dates are accepted; assistants must obtain the user's local date/timezone context or ask.

## Per-user MCP access

Owner requested selective MCP access through Admin on October 10, 2026. Admin → Users (or Invitees) → Feature access includes **MCP access (requires Diet)**. The `mcp` flag defaults to false, including existing records where absent. Enable both Diet and MCP for selected accounts. Verification and server-level `MCP_PUBLIC_URL` are also required. Consent, code exchange, refresh and each MCP request recheck access. Disabling MCP blocks subsequent requests from existing connections without disabling ordinary Diet use. Re-enabling can restore unexpired connections; use Disconnect for permanent grant revocation. Settings is shown only with both permissions. Existing users, including the owner, must be explicitly enabled; no automatic migration grants access.
