# F055: MCP water, meal deletion, deficit reports and targets

- **Status:** Review
- **Branch:** `feature/F055-mcp-water-meal-delete`
- **Pull request:** Not created

## Approved scope

Owner requested adding MCP tools to log water and delete a meal. Implement these own-workspace tools and the approved extension below; F054 remains the separate calorie-deficit REST feature. Work stays in the main workspace with existing F052/F053/unrelated changes preserved.

## Tools and permissions

- `diet_add_water`: date (YYYY-MM-DD), amountMilliliters (integer 1–5000), idempotencyKey (1–128 letters/digits/underscore/hyphen). Requires `diet:water:create`. Reuses the REST water validator. Per-user unique keys prevent duplicate concurrent retries and reject conflicting payloads. Deleting an entry removes retry protection.
- `diet_delete_meal`: exact mealId and confirmed:true. Requires `diet:meals:delete`; marked destructive. Description requires identifying the specific meal and obtaining explicit user confirmation first. The boolean is a caller assertion, not cryptographic evidence of user confirmation; clients must honor confirmation policy. Owner-constrained deletion is atomic. Missing, already-deleted and foreign IDs produce the same not_found response; no foreign records are disclosed. Deletes only logged meals, not templates. Deleting an MCP-created meal also removes its creation retry key.

Separate scopes, consent descriptions and per-request tool registration preserve existing read-only/create-only grants. Existing current feature/revocation checks and tool rate limits apply. No shared/managed writes. No REST endpoint changes or bulk deletion. No plaintext payload/token logs.

## Connect after deploying

Request only needed permissions; for all Diet tools use `codex mcp login astitva-stage --scopes diet:read,diet:meals:create,diet:water:create,diet:meals:delete`. Reconnect ChatGPT and refresh the tool list; verify fresh consent lists water logging and permanent meal deletion. New index is created at server startup. No new environment secrets. Server and web consent UI require deployment; plugin sharing/identity remain unchanged.

## Verification

Focused MCP tests: 4 passed against disposable MongoDB, covering OAuth scope consent, legacy denial, refresh escalation denial, tool annotations, concurrent water retry protection, conflict/invalid input, foreign-owner preservation, missing confirmation, repeated deletion, workspace denial, revocation and rate limiting. Full server suite: 69 passed, 14 opt-in tests skipped. Web tests: 32 passed; build passed with existing chunk-size warning; whitespace check passed. Postman includes cookie-free OAuth tool examples. ChatGPT/Codex end-to-end reconnection remains for owner review. No commit, push or production deployment performed.

## Owner-approved MCP extension

Owner requested MCP tools for the deficit report and setting/getting targets. `diet_get_calorie_deficit` (period/date/timezone) uses existing `diet:read`, the identical report service and coverage semantics. Existing `diet_get_targets` remains the single target-reading tool under `diet:read`.

`diet_set_targets` requires new `diet:targets:write` scope and confirmed:true. It replaces positive protein/carbohydrate/fat/fiber grams and whole water milliliters, reusing the REST target validator/writer. Calories are derived from macros, not an independently accepted tool field. Read current values, show the full proposed replacement and obtain confirmation before calling. The confirmation flag is a client assertion; annotations/instructions do not independently prove user approval. Like the existing REST endpoint, concurrent updates are last-write-wins. No owner ID input or shared/managed MCP writes. Body & Goals, logged intake and maintenance calculations are unchanged by target saves.

Fresh consent is required for target writing; refresh cannot expand old grants. Read-only connections receive the report and existing targets reader but never the target writer. Reconnect requesting diet:read and diet:targets:write (plus any other desired scopes). Server and web consent deployment required. No new secrets or schema changes. Postman MCP examples use a separate OAuth mcpAccessToken, not the application session cookie/token.

MCP extension verification: focused OAuth/tool suite 4 passed, including deficit read validation, read-only target-write denial, separate consent, refresh escalation denial, target ownership, replacement/confirmation/schema validation, macro-derived calories, REST/MCP result parity, repeated saves, unchanged maintenance and revocation. Web tests: 32 passed; build passed. Full server suite: 75 passed, 15 opt-in tests skipped. Updated Postman OAuth examples and consent copy. No host plugin sharing or Production deployment changed.
