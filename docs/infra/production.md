# Production deployment guide

This guide prepares the F012 Firebase Hosting, Render, and MongoDB Atlas environment. It does not authorize a deployment. Keep every secret in the provider dashboard and never in Git or Firebase Hosting.

## Architecture

```text
astitva-live.web.app -> portfolio-84ul.onrender.com -> MongoDB Atlas / SMTP
```

Firebase serves the static `web/dist` build. Render runs Express. Atlas stores only Production data in `astitva_prod`. Finance uses Plaid Production when it is enabled in Render.

## 1. Prepare the application

1. Run the server tests and normal web build.
2. Build the Production web bundle with the final Render origin:

   ```sh
   cd web
   VITE_API_BASE_URL=https://SERVICE_NAME.onrender.com npm run build:production
   ```

3. Confirm `web/dist` contains no Atlas, SMTP, Plaid, session, or encryption secret.

## 2. Prepare MongoDB Atlas

1. Create an empty Atlas deployment and use database `astitva_prod`.
2. Create an application database user with `readWrite` access only to `astitva_prod`.
3. After the Render service exists, copy its outbound CIDR ranges into the Atlas IP access list.
4. Store the `mongodb+srv://` URI as Render's `MONGODB_URL`. Keep TLS enabled. Do not keep `0.0.0.0/0` as the steady-state access rule.

## 3. Prepare email

Render Free blocks outbound SMTP on ports 25, 465, and 587. Production therefore sends Gmail messages through the Gmail HTTPS API. Local Dev and Stage continue to use SMTP.

1. In a Google Cloud project, enable the Gmail API. Configure the OAuth consent screen with the `https://www.googleapis.com/auth/gmail.send` scope and create a **Web application** OAuth client with `https://developers.google.com/oauthplayground` as an authorized redirect URI. In [Google's OAuth Playground](https://developers.google.com/oauthplayground/), select **Use your own OAuth credentials**, enter that client ID and secret, authorize only `https://www.googleapis.com/auth/gmail.send` while signed in as the sending Gmail account, and exchange the authorization code for a refresh token. For an external OAuth app, leave Testing status before relying on it for ongoing production mail: Testing refresh tokens for this scope expire after seven days.
2. In Render's `astitva-api` **Environment**, set `EMAIL_PROVIDER=gmail-api`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `EMAIL_FROM=Astitva <your-address@gmail.com>`. The address must be the authorized Gmail account or a configured send-as alias. Keep the OAuth client secret and refresh token only in Render; never put them in GitHub, Firebase Hosting, or a checked-in `.env` file.
3. Save the environment changes and manually deploy server version `1.0.2`. Confirm `/api/health` reports `1.0.2`, then test signup or resend for an invited address and confirm delivery. Keep `WEB_URL` set to the production web origin. Do not copy the local `.env.stage` file into Render; its MongoDB, Plaid, and web settings belong to Stage.

## 4. Create the Render service

Use `render.yaml` and keep automatic deployment disabled. Enter these values in Render:

- `MONGODB_URL`: Atlas URI for `astitva_prod`
- `WEB_URL`: `https://astitva-live.web.app`
- `CORS_ORIGINS`: `https://astitva-live.web.app`
- `INVITED_EMAILS`: comma-separated normalized email addresses
- Gmail API OAuth values and `EMAIL_FROM` from the sending account

The Blueprint fixes `ASTITVA_ENV=production`, `PLAID_ENV=production`, and the Production cookie name. For Finance, configure `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_REDIRECT_URI`, and a unique `FINANCE_TOKEN_ENCRYPTION_KEY`, then set `PLAID_ENABLED=true`. Add the exact HTTPS redirect URI to the Plaid Dashboard allowlist before deploying that change.

After Render assigns its URL, add all listed Render outbound CIDRs to Atlas, deploy the service manually, and verify `GET /api/health` reports `production`, `cloud`, and Finance disabled.

## 5. Configure Firebase Hosting

From the repository root:

```sh
firebase login
firebase use --add
firebase hosting:channel:deploy review
```

Select the prepared Firebase project. The checked-in `firebase.json` serves `web/dist`, rewrites application routes to `index.html`, and applies cache headers. Preview URLs are separate origins; add the exact active preview origin to Render's `CORS_ORIGINS` only while testing it.

Deploy the live channel only after explicit approval:

```sh
firebase deploy --only hosting
```

## 6. Configure manual GitHub Actions deployments

The repository contains two manually triggered production workflows:

- `.github/workflows/deploy-server-render.yml` tests the Express server, asks Render to deploy the selected `main` commit, and waits for the requested version to appear at `/api/health`.
- `.github/workflows/deploy-web-firebase.yml` builds the React application with the Production API origin and deploys `web/dist` to Firebase Hosting's live channel. The deployed `/version.json` contains its version and commit.

In GitHub, open **Settings → Secrets and variables → Actions** and configure:

| Type | Name | Value |
| --- | --- | --- |
| Repository or `production` environment variable | `FIREBASE_PROJECT_ID` | `astitva-live` |
| Repository or `production` environment variable | `VITE_API_BASE_URL` | Exact HTTPS Render service origin |
| Repository or `production` environment secret | `FIREBASE_SERVICE_ACCOUNT` | Complete Firebase deployment service-account JSON |
| Repository or `production` environment secret | `RENDER_DEPLOY_HOOK_URL` | Render service deploy hook URL from **Settings → Deploy Hook** |

The deploy hook is a credential. Never put it in `render.yaml`, a workflow file, logs, or source control. Keep Render automatic deploys disabled because the workflow triggers a specific commit explicitly.

Each workflow shows the current `package.json` version beside its optional **New version** field. GitHub cannot fill this description dynamically from a file, so update the displayed version in the workflow when changing the package and lockfile version; the workflow validates they match. For a versioned release, enter that new package version and leave **Deploy without a version bump** unchecked. Merge the version change to `main` before running the action. Versions increase independently for server and web; a repeated or lower version is rejected in this mode. Successful versioned deployments are recorded as Git tags such as `server/v1.0.1` and `web/v1.0.1`.

For a deployment that does not change the product version, leave **New version** empty and check **Deploy without a version bump**. The package version must match the latest deployed tag for that component. Leaving both fields empty, or entering a version while checking the box, fails before deployment. The workflow still deploys and verifies the selected commit, but creates no new version tag. The run summary displays the package version and chosen mode. Use a version bump for changes that should be identified by a new product version; the Git commit distinguishes deployments that reuse one version. Server `/api/health` and web `/version.json` report the deployed commit for this verification.

Run a deployment from **GitHub → Actions** while viewing the `main` branch:

1. Run **Deploy server to Render** and confirm the resulting deploy becomes healthy in Render. The action checks that `/api/health` reports the package version and selected commit before tagging it.
2. Run **Deploy web to Firebase Hosting** so the bundle receives the Render origin. Check `/version.json` at the Firebase web origin for its package version and commit.
3. Complete the smoke test below.

Both workflows use the GitHub `production` environment. Add required reviewers to that environment if deployment approval should be enforced in GitHub. A successful Render workflow response means the deploy was accepted or queued; confirm completion and health in the Render dashboard.

## Smoke test

1. `GET /api/health` returns Production and cloud metadata.
2. An email outside `INVITED_EMAILS` cannot create an account or trigger email.
3. An invited email can sign up, verify, log in, reload the page, reset its password, and log out.
4. Profile and Diet read and write only Atlas Production data.
5. Finance explains that it is disabled, and every Finance API returns `503 FINANCE_DISABLED`.
6. A request from an unapproved or missing `Origin` cannot perform `POST`, `PUT`, `PATCH`, or `DELETE` operations.
7. Dev and Stage still start locally and use their original databases and cookies.

Provider domains make the session cookie third-party state. Test login persistence in the intended browser. If the browser blocks it, use sibling custom web and API domains in a separately reviewed infrastructure change.

## Rollback

1. Roll Render back to the last healthy deploy from its deployment history.
2. Roll Firebase Hosting back to the preceding release from the Firebase Hosting release history.
3. Do not delete or overwrite Atlas data during an application rollback.
4. If credentials may have been exposed, rotate them in the owning provider and update Render before redeploying.
