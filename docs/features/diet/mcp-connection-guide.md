# Connect Codex to Astitva Diet

F041 is read-only: personal meals, totals, targets, water, history, recent meals and owned libraries. Shared/managed workspaces and writes are excluded.

## Server configuration

Set `MCP_PUBLIC_URL` to the exact public backend URL ending in `/mcp`. Use the existing Render backend HTTPS origin for production. Locally, for example:

```sh
MCP_PUBLIC_URL=http://127.0.0.1:3001/mcp npm run start:dev
```

Run from `server/`. `WEB_URL` must point at the Astitva frontend used for login/consent. Empty `MCP_PUBLIC_URL` disables MCP without changing REST. Configuration must go through runtime validation. A new production configuration/deployment is not performed by this feature implementation.

## Codex setup

After the backend is running, replace the example URL with your actual server:

```sh
codex mcp add astitva-diet --url https://YOUR-BACKEND/mcp
codex mcp login astitva-diet --scopes diet:read --oauth-client-registration dcr
```

Sign in to Astitva in the browser opened by Codex. Check the account, assistant-supplied client name, callback and read-only access on Settings → Connected assistants, then choose Allow or Deny. Codex receives a separate scoped token; never paste your password or browser session token into Codex configuration.

Ask: “Read my Diet totals for 2026-10-10.” For relative dates, provide your local date/timezone. History requires an explicit start/end and IANA timezone; at most 31 inclusive days within the existing three-calendar-month window. Calls are limited to 30 per minute per user across connections. Personal search returns at most 50 meals and reports `hasMore`.

Disconnect from Astitva Settings → Connected assistants to revoke server access immediately. `codex mcp logout astitva-diet` removes local credentials; use Astitva Disconnect to ensure server-side revocation. Grants expire after 30 days; access tokens last one hour and refresh tokens rotate. Reconnect if authorization expires.

## Verification and compatibility

Official Codex documentation confirms remote HTTP, OAuth, S256 PKCE and dynamic registration support: https://developers.openai.com/codex/mcp . OpenAI authentication guidance: https://developers.openai.com/plugins/build/auth . Checked October 10, 2026; installed CLI reports `0.162.0-alpha.17.2`. SDK `1.32.1` handles transport, discovery, registration, PKCE verification and token/revocation routing.

The automated disposable-MongoDB fixture verifies discovery, PKCE code exchange, tool discovery/invocation, owner isolation, feature denial, refresh rotation, rate limiting and revocation. Browser review uses synthetic data only. The installed Codex CLI successfully discovered metadata, registered dynamically, and produced the correct S256/resource-bound authorization URL; the login was cancelled before storing fixture credentials. A full Codex browser-login session and a Render deployment smoke test remain owner checks; no production connection or user records were used.

Operational limits: stateless POST request/response only; 16 KiB requests and 256 KiB structured results. Oversized results fail explicitly. No server-side AI inference or new paid hosting service is required. Existing Render availability applies; monitor latency, errors, CPU and memory after an authorized rollout.

## Per-user MCP access

Owner requested selective MCP access through Admin on October 10, 2026. Admin → Users (or Invitees) → Feature access includes **MCP access (requires Diet)**. The `mcp` flag defaults to false, including existing records where absent. Enable both Diet and MCP for selected accounts. Verification and server-level `MCP_PUBLIC_URL` are also required. Consent, code exchange, refresh and each MCP request recheck access. Disabling MCP blocks subsequent requests from existing connections without disabling ordinary Diet use. Re-enabling can restore unexpired connections; use Disconnect for permanent grant revocation. Settings is shown only with both permissions. Existing users, including the owner, must be explicitly enabled; no automatic migration grants access.
