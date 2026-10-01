# F007: Local Stage environment

- **Status:** Review
- **Branch:** `feature/F007-local-stage-environment`
- **Pull request:** Not created

## Goal

Add a second local Astitva runtime profile named **Stage** for testing F006 with real financial accounts through Plaid's Production API under Trial, legacy Limited Production, or full Production access. Keep the existing **Dev** profile on Plaid Sandbox and isolate every Stage database record, credential, token, session, and configuration value from Dev.

Plaid does not provide a separate Stage API environment. In this feature, **Stage** is an Astitva environment that still runs entirely on localhost but intentionally calls `https://production.plaid.com`.

## User flow

1. The user obtains or confirms Plaid Trial/Production access in the Plaid Dashboard and copies the Production secret into an ignored local Stage environment file.
2. From the repository root, the user runs one command to start either Dev or Stage.
3. The startup script validates the selected profile before starting Astitva:
   - Dev must use the `astitva` MongoDB database and Plaid Sandbox.
   - Stage must use the `astitva_stage` MongoDB database and Plaid Production.
4. The browser opens the same localhost application and displays a persistent environment indicator.
5. In Stage, the user creates or logs in to a separate Stage Astitva account because users and sessions are stored in `astitva_stage`.
6. The Stage Finance page clearly says **Real financial data** before the user opens Plaid Link.
7. The user connects one supported real institution through Plaid Production/Trial, then F006 synchronizes balances, accounts, holdings, and transactions into `astitva_stage` only.
8. To return to fake data, the user stops Stage and starts Dev. Dev loads the existing Sandbox credentials and `astitva` data without seeing any Stage records.

## In scope

- Define two explicit local runtime profiles: `dev` and `stage`.
- Keep both profiles on localhost ports `3000` and `3001`, with only one profile running at a time.
- Add one repository-root command for each profile:
  - `./scripts/start-local.sh dev`
  - `./scripts/start-local.sh stage`
- Keep the existing Dev behavior on Plaid Sandbox and MongoDB database `astitva`.
- Configure Stage for Plaid Production and MongoDB database `astitva_stage`.
- Add ignored `server/.env.dev` and `server/.env.stage` files with tracked placeholder examples.
- Preserve the current Sandbox values by moving the existing ignored `server/.env` configuration to `server/.env.dev` during implementation without printing or committing its contents.
- Require a separate Production secret in `server/.env.stage`.
- Require independent Dev and Stage finance-token encryption keys.
- Validate environment, database name, Plaid host, required credentials, and encryption key before the server starts.
- Refuse unsafe combinations such as Stage with `astitva`, Dev with `astitva_stage`, or Stage with a Sandbox Plaid host.
- Map `PLAID_ENV=sandbox|production` to an internal allowlist of Plaid hosts; never accept an arbitrary provider URL.
- Give Dev and Stage different HTTP-only session-cookie names so both cookies can coexist in the same local browser.
- Show a persistent **DEV · SANDBOX DATA** or **STAGE · REAL FINANCIAL DATA** indicator in the authenticated interface.
- Change the Stage connect action to **Connect real account** and show a short confirmation before opening Plaid Link.
- Include the active Astitva and Plaid environments in safe health/API metadata without returning secrets.
- Store the provider environment on new Finance connection records for audit and validation.
- Add Dev and Stage startup instructions and separate Postman environment files that contain no Plaid credentials or access tokens.
- Keep Stage local; only browser Plaid Link and server-to-Plaid API calls communicate outside localhost.

## Out of scope

- Deploying or hosting Stage on a remote server
- Running Dev and Stage simultaneously
- Copying users, sessions, diet data, Finance data, or tokens between databases
- Converting Sandbox Items or tokens into Production Items
- Automating the Plaid Trial, Production, compliance, or institution-access application
- Circumventing Plaid institution, OAuth, product, Item, or usage limits
- A cloud secret manager or shared team credentials
- Database backup, export, restore, or cloud synchronization
- Application-level encryption of every synchronized balance, holding, and transaction field unless added after review
- Public Plaid webhooks or background synchronization
- Changes to the F006 calculations, transaction categories, or Finance layout beyond environment labeling and the real-data confirmation
- Payments, transfers, trading, or any other movement of money
- Production deployment of Astitva

## Wireframe or UI changes

Dev keeps its current appearance with a small environment label:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ DEV · PLAID SANDBOX · FAKE FINANCIAL DATA                           │
├──────────────┬───────────────────────────────────────────────────────┤
│ Astitva.     │ Finance                     [ Refresh ] [ Connect ]   │
│ Overview     │ Net worth · Cash · Investments · Debt                │
│ Diet         │                                                       │
│ Finance      │ Existing Sandbox accounts and transactions           │
└──────────────┴───────────────────────────────────────────────────────┘
```

Stage uses a visually distinct persistent banner and clearer action text:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ STAGE · PLAID PRODUCTION · REAL FINANCIAL DATA                      │
├──────────────┬───────────────────────────────────────────────────────┤
│ Astitva.     │ Finance              [ Refresh ] [ Connect real account ]
│ Overview     │                                                       │
│ Diet         │ Data stays in local MongoDB: astitva_stage           │
│ Finance      │ Last synced values from real connected institutions   │
└──────────────┴───────────────────────────────────────────────────────┘
```

Before opening Plaid Link in Stage:

```text
Connect a real financial account?

Plaid Production will connect to the selected institution. Astitva will
store synchronized balances, transactions, and holdings in the local
astitva_stage database. This uses one Production Item under your Plaid plan.

[ Cancel ]  [ Continue to Plaid ]
```

No Plaid client ID, secret, access token, encryption key, full account number, or routing number is shown in the UI.

## API changes

The F006 Finance endpoints remain the same and continue to require a verified user. Their provider adapter uses the server's validated runtime profile.

### Extend server health metadata

`GET /api/health`

Response `200`:

```json
{
  "status": "ok",
  "message": "Astitva server is running",
  "environment": "stage",
  "financeProvider": {
    "name": "plaid",
    "environment": "production",
    "configured": true
  }
}
```

The response does not include the MongoDB URL, database credentials, Plaid client ID, Plaid secret, encryption key, access tokens, or provider response bodies.

### Finance response metadata

Add `providerEnvironment` with value `sandbox` or `production` to connection responses from:

- `GET /api/finance/connections`
- `POST /api/finance/connections`

The server rejects a stored connection whose provider environment does not match the active runtime profile and does not attempt to use its token.

### Startup validation

Startup configuration errors occur before the HTTP server listens. They are written as safe local messages such as:

```text
Stage requires MONGODB_URL to select the astitva_stage database.
Stage requires PLAID_ENV=production.
```

Validation messages never echo configured secrets, tokens, encryption keys, or the complete MongoDB connection string.

## MongoDB changes

### Separate databases

- Dev uses `mongodb://127.0.0.1:27017/astitva`.
- Stage uses `mongodb://127.0.0.1:27017/astitva_stage`.
- Both databases use the existing Astitva collection schemas.
- No automatic migration, copy, lookup, or aggregation crosses the two databases.
- Stage signup, verification, login sessions, diet data, Finance connections, accounts, holdings, and transactions all exist only in `astitva_stage`.

### `financeConnections`

Add:

- `providerEnvironment`: required enum `sandbox` or `production`.

Existing Dev F006 connections are recorded as `sandbox` during the implementation migration. New Stage connections are always recorded as `production`. Add `providerEnvironment` to the existing unique connection index so a provider Item is identified within its provider environment.

No other collections or fields are added.

## Architecture decisions

These decisions were approved by the project owner:

- Treat Stage as a local Astitva runtime profile, not as a Plaid environment. Plaid Trial and legacy Limited Production both use Plaid's Production API and Production secret.
- Run only one profile at a time on the existing ports. Reusing the ports keeps browser and Postman behavior simple and prevents the user from accidentally interacting with the wrong open tab.
- Select the environment only when starting Astitva. Do not offer a browser toggle that could switch the server between fake and real financial data while it is running.
- Use `ASTITVA_ENV=dev|stage` and `PLAID_ENV=sandbox|production`. Resolve Plaid hosts from code-owned constants: `https://sandbox.plaid.com` and `https://production.plaid.com`.
- Fail closed on missing, placeholder, or conflicting configuration. The server must not silently fall back from Stage to Dev, from Production to Sandbox, or from `astitva_stage` to `astitva`.
- Keep real environment files ignored by Git. Track only examples with blank placeholders. Set the Stage file to owner-readable permissions where the operating system supports it.
- Use a different AES-256-GCM encryption key for each database. A token copied into the other database should not decrypt under that environment's key.
- Continue encrypting durable Plaid access tokens at the application layer. Synchronized account names, masks, balances, holdings, and transactions remain ordinary MongoDB fields in the first proposal; the local machine and MongoDB access therefore form part of the security boundary.
- Bind MongoDB to localhost and do not expose its port to other machines. F007 does not manage Docker or operating-system firewall settings.
- Use environment-specific session-cookie names such as `astitva_dev_session` and `astitva_stage_session`. Keep them HTTP-only and SameSite Lax. Localhost remains HTTP for this feature.
- Add a persistent Stage banner and confirmation because the same application screens otherwise look similar while handling materially different data.
- Store `providerEnvironment` with every Finance connection and compare it with the active server configuration before decrypting or using its access token.
- Do not log Plaid request headers, request bodies containing tokens, production responses, MongoDB documents, or environment-file contents.
- Keep the existing provider/service abstraction. Environment selection changes the Plaid adapter's allowlisted base host; routes and UI data models remain provider-neutral.
- Treat each successful real institution connection as a limited Plaid Production Item. Avoid repeated connection experiments because Trial Item usage may not be restored by disconnecting an Item.
- Use the same F006 manual refresh behavior in Stage. Public webhooks remain unavailable to a localhost-only server.

Plaid's official API documentation lists only [Sandbox and Production hosts](https://plaid.com/docs/api/). Plaid describes Trial as real data through Production and documents its current [Trial limits and billing behavior](https://plaid.com/docs/account/billing/). Production setup and institution access may also require steps in Plaid's [Launch Center/checklist](https://plaid.com/docs/launch-checklist/).

## Acceptance criteria

- `./scripts/start-local.sh dev` starts the existing web and server applications on localhost using `astitva` and Plaid Sandbox.
- `./scripts/start-local.sh stage` starts the same applications on localhost using `astitva_stage` and Plaid Production.
- The script stops both child processes cleanly when the user exits it.
- Starting either profile while ports `3000` or `3001` are already occupied produces a clear message instead of starting a partial environment.
- Dev startup fails if configured for Plaid Production or the Stage database.
- Stage startup fails if configured for Plaid Sandbox or the Dev database.
- Blank or placeholder Stage credentials and invalid encryption keys prevent startup without exposing their values.
- The authenticated UI always displays the active environment and whether Finance uses fake or real data.
- Dev continues to connect only Sandbox test institutions and reads only the `astitva` database.
- Stage can open Plaid Production Link and connect a supported real institution when the user's Plaid plan and institution access allow it.
- Stage Finance uses F006 to show real synchronized values from `astitva_stage`.
- A Stage connection is stored with `providerEnvironment: production`; a Dev connection is stored with `providerEnvironment: sandbox`.
- A mismatched provider-environment record is rejected before its access token is used.
- Dev and Stage use different encryption keys and different session-cookie names.
- A user created in Dev cannot log in to Stage until a separate Stage account is created, and the reverse is also true.
- Data added in one database never appears when running the other profile.
- Browser responses, logs, Postman files, tracked environment examples, and Git changes contain no real Plaid credentials or durable access tokens.
- Stage remains local on ports `3000`, `3001`, and `27017`; only Plaid Link and Plaid API traffic leave localhost.
- OpenAPI, Postman, README, server, and web instructions explain both profiles and the real-data boundary.

## Local verification

Implemented locally on 2026-09-22. Automated and configuration checks completed:

- Server tests pass: 10/10, including both valid profile mappings, crossed-profile rejection, local MongoDB enforcement, placeholder/key rejection, token encryption, and provider-environment mismatch rejection before token handling.
- The React production build passes.
- JSON parsing passes for the Finance OpenAPI document, Postman collection, and both Postman environments.
- Dev starts through `./scripts/start-local.sh dev`, connects to `astitva`, and reports `dev` / `sandbox` through `/api/health`.
- A second launch is refused while ports `3000` and `3001` are occupied.
- Ctrl+C stops both Dev child processes and releases both ports.
- Stage with placeholder credentials fails before the API listens, reports only the missing variable name, and cleans up the web child process.
- Stage starts with configured Production/Trial credentials, connects to `astitva_stage`, and reports `stage` / `production` through `/api/health`.
- A Plaid Production `link/token/create` configuration check succeeds without creating an Item or printing the short-lived token.
- The ignored Dev and Stage files are owner-readable, use distinct finance encryption keys, and do not appear in Git status.
- `git diff --check` passes, and tracked configuration examples contain placeholders rather than secrets.

Manual review with the user's Plaid Production/Trial credentials remains:

1. Start Dev and verify the banner, `astitva` database, Sandbox Link, and existing fake F006 values.
2. Stop Dev, start Stage, and verify the Stage banner, separate signup/session, and empty `astitva_stage` Finance page.
3. Connect one intentional real institution in Stage and confirm the connection records `providerEnvironment: production`.
4. Compare the displayed accounts and values with the institution, allowing for Plaid update timing and institution-specific availability.
5. Inspect `astitva` and `astitva_stage` separately and confirm no shared user, session, token, or Finance record.
6. Stop Stage and restart Dev; confirm all original Sandbox data remains unchanged and no Stage data appears.
7. Verify both Postman environments report the expected runtime and cannot use a session cookie from the other profile.
8. Search server/browser logs for the Production secret, encryption keys, public tokens, access tokens, and real account identifiers.

Because a Trial plan may count every newly created Production Item against a fixed lifetime limit even after disconnection, use one deliberate real connection for acceptance testing rather than repeatedly creating Items.

## Open questions

None. The project owner approved using the Plaid access currently granted with Transactions and Investments enabled, storing synchronized fields in local MongoDB under the documented local-machine security boundary, running Dev and Stage one at a time on ports `3000` and `3001`, and requiring a separate Stage signup and email verification.
