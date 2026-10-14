# F051: MCP meal logging

- **Status:** Review
- **Branch:** `feature/F051-mcp-meal-logging`
- **Pull request:** Not created

## Approved scope

Owner approved one MCP tool to create meals in the personal daily log. No editing, deletion, library changes, targets, water writes, or shared/managed workspace writes. Explicit nutrition values; automatic estimates are not included.

## Delivery

`diet_post_meal` requires `diet:meals:create`. Existing read-only grants remain read-only; reconnect and consent to obtain write access. Consent displays requested permissions. Refresh cannot expand permissions. Creation shares the HTTP meal validator and writer. A per-user idempotency key prevents duplicate retry inserts and rejects different payloads using the same key. Keys remain with the meal; deleting a meal also removes its retry protection.

## Connection

Keep Stage running. Revoke/disconnect the old connection if replacing it, then run `codex mcp login astitva-stage --scopes diet:read,diet:meals:create` and approve the displayed permissions. Current clients typically request advertised scopes; explicitly request `diet:read diet:meals:create` if needed. No new environment variable is needed. Startup creates the new partial unique meal index.

## Verification

Server suite: 67 passed, 12 opt-in tests skipped. Focused MCP unit/integration suite: 4 passed against disposable MongoDB, including write consent, read-only rejection, refresh escalation rejection, write refresh, owner-only persistence, invalid input, repeated/concurrent retry keys, conflicts and revocation. Web tests: 32 passed. Web production build passed with the existing chunk-size warning. Git whitespace check passed. Stage is running from `/private/tmp/astitva-f051`; authenticated owner review remains. No commit, push or deployment performed.
