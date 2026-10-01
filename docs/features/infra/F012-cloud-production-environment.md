# F012: Cloud production environment

- **Status:** Done
- **Branch:** `feature/F012-cloud-production-environment`
- **Pull request:** Not created

## Goal

Add a production environment in which Firebase Hosting serves the React/Vite application, Render runs the Express API, and MongoDB Atlas stores production data. Keep the existing local Dev and Stage environments available and isolated.

## User flow

1. A visitor opens the HTTPS Firebase Hosting address or approved custom web domain.
2. The browser loads the static Vite build and sends API requests only to the configured HTTPS Render service.
3. Render validates the exact web origin, authenticates the user, and reads or writes only the production Atlas database.
4. Production signup succeeds only when the normalized email is in a server-side invitation allowlist.
5. Verification and password-reset links return to the production web address.
6. Finance remains disabled during the initial core rollout and is enabled with Plaid Production only after core smoke tests pass.
7. A deployment is promoted manually after local validation and owner approval.

## Deployment layout

```text
Browser
  |
  | HTTPS static files
  v
Firebase Hosting                         public configuration only
  |
  | HTTPS /api requests with credentials
  v
Render Web Service (Express)             application secrets stay here
  |             |              |
  | TLS         | HTTPS        | SMTP/TLS
  v             v              v
MongoDB Atlas   Plaid Prod     Production email provider
astitva_prod
```

Firebase Hosting supports static assets, SPA rewrites, preview channels, and live releases. Render provides the public Node web service and terminates HTTPS before forwarding to the application. Atlas accepts connections only from configured IP ranges and requires a separate database user. References: [Firebase Hosting](https://firebase.google.com/docs/hosting/), [Firebase SPA configuration](https://firebase.google.com/docs/hosting/full-config), [Render Express deployment](https://render.com/docs/deploy-node-express-app), [Render web services](https://render.com/docs/web-services), and [Atlas connection requirements](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

## In scope

- Add an explicit `production` runtime profile without weakening Dev or Stage validation.
- Keep Dev on local `astitva`, Stage on local `astitva_stage`, and Production on Atlas database `astitva_prod`.
- Add a public, non-secret `VITE_API_BASE_URL` used only by production builds; local Vite continues using relative `/api` requests and its local proxy.
- Add Firebase Hosting configuration for `web/dist`, ignored local Firebase state, SPA fallback, sensible cache headers, and manual preview/live commands.
- Add a Render Blueprint or equivalent documented settings with `server/` as the root directory, `npm ci` as the build command, a production start command, `/api/health` health check, and automatic deploy disabled initially.
- Pin a supported Node version with an upper bound so a new major version is not selected silently. Render documents the supported version controls and recommends a bounded version declaration: [Render Node version](https://render.com/docs/node-version).
- Bind Express to Render's `PORT` and public interface, and shut down cleanly on deployment signals.
- Configure exact production CORS origins with credentials; never use `*` with session cookies.
- Use secure production session cookies and reject unsafe-method requests whose `Origin` is not an approved web origin.
- Keep Plaid, Atlas, SMTP, encryption, and session secrets out of Firebase and Git.
- Add production email configuration so verification and password-reset links use the Firebase/custom web origin.
- Add a production-only invited-email allowlist in Render configuration. Keep the existing signup form and endpoint, but reject non-invited normalized emails without creating a user or sending email. Do not add invitation CRUD, invitation tokens, or an administration page in this version.
- Add a Plaid Production redirect URI when required by OAuth institutions and document its Plaid Dashboard allowlist. Plaid requires Production redirect URIs to use HTTPS and appear in the dashboard allowlist: [Plaid Link API](https://plaid.com/docs/api/link/).
- Allow Production to start with Finance explicitly disabled. Disabled Finance endpoints return a stable `503` response and the UI explains that Finance is not enabled; Plaid credentials become mandatory only when the production flag is enabled.
- Add production smoke-test and rollback instructions without automatically deploying.

## Out of scope

- Moving Express to Firebase Functions, Cloud Run, or another backend provider
- Replacing MongoDB with Firestore
- Multi-region failover, Kubernetes, queues, or microservices
- Automated production deployment on every push
- Production analytics, advertising, or tracking
- A new finance feature, AI advice, or changes to existing product behavior
- Automatic migration of local real financial data unless separately approved
- Committing any secret, Atlas URI, Plaid credential, SMTP password, or generated Firebase login token

## UI changes

No feature page or layout changes are proposed. The existing environment banner should display a clear production label without exposing configuration:

```text
PRODUCTION · CLOUD DATA · PLAID PRODUCTION
```

Authentication and feature screens otherwise retain their existing flows. User-facing references to Mailpit must change to neutral wording such as “check your email” in Production while local Dev documentation may still name Mailpit.

## Runtime and API changes

No new business endpoint is required. Existing endpoints retain their contracts.

`GET /api/health` will report safe production metadata:

```json
{
  "status": "ok",
  "message": "Astitva server is running",
  "environment": "production",
  "dataLocation": "cloud",
  "financeProvider": {
    "name": "plaid",
    "environment": "production",
    "enabled": false,
    "configured": false
  }
}
```

Production configuration will include:

| Variable | Location | Purpose |
| --- | --- | --- |
| `ASTITVA_ENV=production` | Render | Select strict production rules |
| `MONGODB_URL` | Render secret | Atlas SRV URI whose database is `astitva_prod` |
| `WEB_URL` | Render | Canonical Firebase/custom HTTPS web origin |
| `CORS_ORIGINS` | Render | Exact comma-separated approved web origins |
| `SESSION_COOKIE_NAME` | Render | Production-only cookie name |
| `INVITED_EMAILS` | Render secret | Normalized email allowlist for Production signup |
| `PLAID_ENABLED=false` | Render | Keep Finance off during the core rollout |
| `PLAID_ENV=production` | Render | Require Plaid Production when Finance is enabled |
| `PLAID_CLIENT_ID` | Render secret | Plaid credential |
| `PLAID_SECRET` | Render secret | Plaid credential |
| `PLAID_REDIRECT_URI` | Render | Approved HTTPS OAuth return URI when enabled |
| `FINANCE_TOKEN_ENCRYPTION_KEY` | Render secret | Unique 32-byte production encryption key |
| SMTP host/port/user/password/from | Render secrets/config | Production verification and reset email |
| `VITE_API_BASE_URL` | Web build environment | Public Render API origin; never contains a secret |

The server must fail startup when production uses localhost MongoDB, a non-TLS web origin, an empty invitation allowlist, the Dev/Stage cookie name, or a MongoDB database other than `astitva_prod`. When `PLAID_ENABLED=true`, it must also reject placeholder credentials or a Plaid environment other than Production. Dev and Stage must continue rejecting remote MongoDB.

## MongoDB Atlas

- Create a separate Atlas cluster or deployment and `astitva_prod` database.
- Create an application database user with read/write access only to `astitva_prod`; Atlas application users and database users are separate identities. See [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/).
- Add the Render service's outbound CIDR ranges from **Connect → Outbound** to the Atlas IP access list. Render documents that a service may use any address in its listed ranges: [Render outbound IPs](https://render.com/docs/outbound-ip-addresses). Do not use `0.0.0.0/0` for the steady-state configuration.
- Use the Atlas `mongodb+srv://` connection string through a Render secret. Atlas requires the connecting address on its access list and enforces TLS for public connections: [Atlas connection](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) and [network security](https://www.mongodb.com/docs/atlas/architecture/current/network-security/).
- Keep production collections and indexes identical to the application models. Startup index creation must finish before readiness succeeds.
- Start with an empty production database. Any future migration is a separate reviewed feature and must omit expired sessions/tokens and define how encrypted Plaid access tokens are re-encrypted with the production key.

## Authentication and browser security

The approved first deployment uses the provider domains:

```text
PROJECT_ID.web.app       -> Firebase Hosting
SERVICE_NAME.onrender.com -> Render
```

These are different sites. The production session cookie therefore uses `SameSite=None`, `Secure`, `HttpOnly`, and `Path=/`, and every browser request continues using `credentials: include`. Express returns credentialed CORS headers only for the exact canonical Firebase origin and validates `Origin` on every unsafe method.

Browsers may still block this cookie as third-party state. MDN documents both the `None; Secure` requirement and third-party-cookie restrictions: [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) and [third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies). The owner accepts this limitation for the initial provider-domain rollout. If the target browser blocks login persistence, sibling custom web/API domains become the next required infrastructure change; the application will not weaken cookie security or move session tokens into browser storage as a workaround.

For all production unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), Express will validate `Origin` against the configured allowlist before route handling. JSON body limits, generic server errors, secure headers, and basic rate limits for signup/login/password-email endpoints are required before making the API public.

## Firebase Hosting

- Build with `npm ci` and `npm run build` in `web/`.
- Serve `web/dist` only.
- Rewrite unmatched application routes to `/index.html`.
- Do not cache `index.html` long-term; allow hashed Vite assets to use immutable caching.
- Use a preview channel for review before a live release. Firebase notes that preview URLs are public and interact with the real configured backend: [preview and live channels](https://firebase.google.com/docs/hosting/test-preview-deploy).
- Deploy live only after the Render health check, Atlas connection, authentication, email, and feature smoke tests pass.

## Render service

- Use a public Node Web Service with repository root directory `server`.
- Build with `npm ci`; start with a production script that reads Render environment variables rather than a local `.env` file.
- Set the health check path to `/api/health`.
- Store secret values through Render environment secrets or `sync: false` Blueprint fields; never place values in `render.yaml`. Render's Blueprint documentation supports secret prompts and generated values: [Blueprint specification](https://render.com/docs/blueprint-spec).
- Disable automatic deploy initially so deployments remain deliberate and match the owner's manual review process.
- Use the Render outbound ranges for Atlas access rather than opening Atlas to the internet.
- Configure a provider-neutral SMTP interface in Express. The owner can use Resend SMTP or another approved provider without changing application code.

## Acceptance criteria

- Dev and Stage continue to run locally with their existing databases, cookies, and Plaid environments.
- A production build contains only the public API origin and no server or database secret.
- Firebase serves the Vite application over HTTPS and direct/reloaded SPA URLs work.
- Render starts with the provided `PORT`, reports healthy, and rejects invalid production configuration at startup.
- Render connects to `astitva_prod` through Atlas TLS using a least-privilege database user and restricted IP access list.
- Only approved Firebase/custom origins receive credentialed CORS responses; another origin cannot perform an authenticated write.
- Production login persists securely across reload, logout clears the same cookie attributes, and Dev/Stage cookies remain separate.
- An invited normalized email can sign up; a non-invited email cannot create a Production account or trigger a verification email. Existing login behavior remains unchanged.
- Signup verification and password-reset email work through the approved production provider and return to the production web URL.
- During the core rollout, Finance clearly reports that it is disabled and no Plaid call is attempted. When enabled later, Plaid credentials and access tokens never reach Firebase or the browser and OAuth redirect configuration works for supported Production institutions.
- Profile, Diet, Finance, and other merged features pass production smoke tests against Atlas without using local MongoDB.
- No local database is automatically copied to Atlas, and no deployment occurs before explicit approval.
- The deployment and rollback steps are documented and repeatable.

## Implementation sequence after approval

1. Add and test the production runtime profile, CORS/origin validation, secure cookies, SMTP configuration, and Atlas URL validation locally.
2. Add Firebase and Render configuration files containing no secrets.
3. Run server tests and web production builds with placeholder-safe configuration validation.
4. Create/configure Atlas, Render, Firebase, provider-domain origins, invited emails, and production email settings in their dashboards. The owner enters all secret values directly.
5. Deploy Render and verify health plus Atlas connectivity.
6. Build and deploy a Firebase preview channel, run end-to-end core tests, then request approval for the live Firebase release.
7. Configure and enable Plaid Production only after the core deployment passes review.

## Local verification

Implementation completed on `feature/F012-cloud-production-environment` without a commit or push.

Completed locally:

- Server test suite: 24 tests passed, including Production runtime validation, exact-origin enforcement, invite-only signup rejection, rate limiting, safe health metadata, and stable disabled-Finance behavior.
- Normal Vite build passed.
- Production Vite build passed with an HTTPS Render origin, and the generated bundle contained no server secret-variable names.
- OpenAPI, Postman, Firebase JSON, Render YAML, package manifests, and Git whitespace checks passed.
- The Production build and runtime reject missing or placeholder provider configuration.

Cloud checks remain manual because no Firebase, Render, Atlas, or SMTP resource or secret was created. Follow `docs/infra/production.md` to configure provider dashboards, deploy only after explicit approval, and run the smoke-test checklist. No database, commit, push, pull request, or deployment was created.

## Open questions

None. The owner selected the default Firebase and Render provider domains with the documented cross-site-cookie limitation, invite-only Production signup, and a core-first rollout with an empty Atlas database. Releases remain manual, production email uses the provider-neutral SMTP configuration, and Plaid stays disabled until core smoke tests pass.
