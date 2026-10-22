// Static reviewed reference. Never read environment values, credentials or user data here.
module.exports = {
  "title": "Architecture & Security",
  "summary": "A private family workspace, with explicit trust boundaries from browser to data and assistant tools.",
  "basis": "Repository-backed reference \u00b7 F052 \u00b7 Provider dashboard settings are not inspected. This is not a live security audit.",
  "nodes": [
    {
      "id": "browser",
      "title": "Your browser",
      "subtitle": "React \u00b7 Vite",
      "icon": "browser",
      "x": 55,
      "y": 90
    },
    {
      "id": "hosting",
      "title": "Firebase Hosting",
      "subtitle": "Static web application",
      "icon": "firebase",
      "x": 355,
      "y": 90
    },
    {
      "id": "api",
      "title": "Render API",
      "subtitle": "Express \u00b7 authorization",
      "icon": "render",
      "x": 355,
      "y": 305
    },
    {
      "id": "mongo",
      "title": "MongoDB Atlas",
      "subtitle": "Private application records",
      "icon": "mongodb",
      "x": 690,
      "y": 305
    },
    {
      "id": "chat",
      "title": "Firebase Chat",
      "subtitle": "Auth + Firestore rules",
      "icon": "firebase",
      "x": 690,
      "y": 90
    },
    {
      "id": "assistant",
      "title": "ChatGPT / Codex",
      "subtitle": "Consent-based Diet tools",
      "icon": "codex",
      "x": 55,
      "y": 520
    },
    {
      "id": "mcp",
      "title": "MCP server",
      "subtitle": "Runs inside Render API",
      "icon": "mcp",
      "x": 355,
      "y": 520
    },
    {
      "id": "github",
      "title": "GitHub Actions",
      "subtitle": "Manual release workflows",
      "icon": "github",
      "x": 690,
      "y": 520
    }
  ],
  "edges": [
    {
      "source": "browser",
      "target": "hosting",
      "label": "HTTPS \u00b7 download app",
      "flow": "app"
    },
    {
      "source": "browser",
      "target": "api",
      "label": "HTTPS \u00b7 session / bearer",
      "flow": "app"
    },
    {
      "source": "api",
      "target": "mongo",
      "label": "Server-only database connection",
      "flow": "app"
    },
    {
      "source": "browser",
      "target": "chat",
      "label": "Chat token \u00b7 scoped rules",
      "flow": "chat"
    },
    {
      "source": "api",
      "target": "chat",
      "label": "Admin SDK \u00b7 chat grants",
      "flow": "chat"
    },
    {
      "source": "assistant",
      "target": "mcp",
      "label": "OAuth + PKCE \u00b7 scoped bearer",
      "flow": "mcp"
    },
    {
      "source": "mcp",
      "target": "api",
      "label": "Own-user Diet services",
      "flow": "mcp"
    },
    {
      "source": "github",
      "target": "hosting",
      "label": "Service account \u00b7 Hosting deploy",
      "flow": "deploy"
    },
    {
      "source": "github",
      "target": "api",
      "label": "Secret deploy hook \u00b7 commit",
      "flow": "deploy"
    }
  ],
  "sections": [
    {
      "id": "users",
      "title": "Users & sessions",
      "subtitle": "Identity is verified before permissions are evaluated.",
      "points": [
        [
          "Implemented",
          "Invitation-backed signup and verified email",
          "Signup checks invitation eligibility. Passwords are hashed using bcrypt cost 12. Email verification and reset tokens expire after one hour; minimum password length is eight characters.",
          "server/src/routes/auth.js"
        ],
        [
          "Implemented",
          "24-hour sessions with server-side expiry",
          "Random session tokens are stored as SHA-256 hashes in MongoDB. Protected routes look up a live session. Logout removes the session; password reset revokes sessions.",
          "server/src/routes/auth.js; server/src/models/Session.js"
        ],
        [
          "Implemented",
          "Cookie and bearer transports",
          "Production cookies use secure runtime options. The browser also keeps a bearer session in sessionStorage to support cross-site Render/Firebase requests. JavaScript can read that fallback, so XSS can steal it. Closing the tab clears storage, but the server expiry remains authoritative.",
          "web/src/App.jsx; server/src/config/runtime.js"
        ],
        [
          "Implemented",
          "Admin is a server decision",
          "A live session, verified email and a matching normalized ADMIN_EMAILS allowlist entry are required on each Admin request. There is no editable stored Admin role. Architecture responses use Cache-Control: no-store.",
          "server/src/middleware/adminAccess.js"
        ],
        [
          "Recommended",
          "Stronger identity assurance",
          "Consider Admin MFA/passkeys, breached-password screening and explicit session/device management. These are recommendations, not features claimed by this page.",
          ""
        ]
      ]
    },
    {
      "id": "apis",
      "title": "API security",
      "subtitle": "Authentication, authorization and validation are separate checks.",
      "points": [
        [
          "Implemented",
          "Authentication does not imply access",
          "Feature gates check invitation flags. Domain routes constrain records to an authenticated owner or an explicitly authorized family/managed context. Record ownership and sharing must remain enforced on every read and write; a client-supplied ID is not proof of permission.",
          "server/src/middleware/featureAccess.js; server/src/services/managedWorkspace.js"
        ],
        [
          "Implemented",
          "Browser origin controls",
          "CORS reflects only allowlisted origins. Production unsafe methods require an approved Origin, except the narrowly defined cookie-free native/Postman transport. That transport still requires credentials or a bearer session. CORS is a browser control, not an authentication firewall.",
          "server/src/app.js; server/src/middleware/security.js"
        ],
        [
          "Implemented",
          "Bounded input and safe API responses",
          "JSON parsing defaults to 100 KB, with a separate 1 MB library path. Domain validators constrain shapes, types and values. Parser errors return safe responses, unhandled errors return generic 500 messages, and x-powered-by is disabled.",
          "server/src/app.js; server/src/services/dietMealWrite.js"
        ],
        [
          "Implemented",
          "Headers protect API responses",
          "API middleware sets nosniff, frame denial, no-referrer and a restrictive CSP; Production adds HSTS. These headers apply to Render API responses and do not automatically protect the Firebase-hosted HTML.",
          "server/src/middleware/security.js"
        ],
        [
          "Implemented",
          "Rate limits are targeted",
          "Production login: 10 attempts / 15 minutes / IP; signup and email routes: 5 / hour / IP; Admin: 120 / minute / IP. HTTP limits use an in-process Map, reset on restart and are not shared across replicas. Not every API has a global limit.",
          "server/src/middleware/security.js; server/src/routes/auth.js; server/src/routes/admin.js"
        ],
        [
          "Recommended",
          "Extend abuse and regression protection",
          "Use a bounded shared rate-limit store for multi-instance deployments, add API abuse monitoring, and expand ownership/role regression coverage. Validate proxy trust when deployment topology changes.",
          ""
        ]
      ]
    },
    {
      "id": "mcp",
      "title": "MCP & assistant connections",
      "subtitle": "Assistant grants are separate from browser sessions.",
      "points": [
        [
          "Implemented",
          "OAuth consent with PKCE S256",
          "Public clients register approved callback formats. The authorization request is bound to the exact MCP resource URL and PKCE challenge, then redirects to Astitva for account consent. Client names are self-reported, not verified identities. Tickets expire in 10 minutes; approved codes expire in 60 seconds.",
          "server/src/services/mcpAuth.js; server/src/routes/mcp.js"
        ],
        [
          "Implemented",
          "Scoped, revocable credentials",
          "Access tokens last one hour; the connection lasts up to 30 days. Access/refresh tokens are stored as hashes. Refresh rotates both tokens atomically and cannot add permissions. Disconnect revokes the grant. Verified email and current Diet + MCP feature access are rechecked on requests.",
          "server/src/services/mcpAuth.js"
        ],
        [
          "Implemented",
          "Read access and create access remain distinct",
          "diet:read exposes six read tools, including calorie-deficit reports. diet:meals:create exposes diet_post_meal; diet:water:create exposes diet_add_water; diet:meals:delete exposes diet_delete_meal. Requested scopes are persisted for consent; granted scopes control which tools exist for that request. Old read-only connections do not gain writes. Discovery and the authentication challenge advertise both available scopes.",
          "server/src/services/dietMcp.js; server/src/routes/mcp.js"
        ],
        [
          "Implemented",
          "Own workspace only",
          "Protocol calls reject browser cookies and shared/managed context headers; supplied origins must be allowlisted. MCP uses POST-only stateless JSON transport, rejects batches and caps request bodies at 16 KB. MongoDB-backed tool limits allow 30 calls / minute / user.",
          "server/src/routes/mcp.js; server/src/services/mcpAuth.js"
        ],
        [
          "Implemented",
          "Meal creation is narrow and retry-safe",
          "Meal input requires an explicit date, type, name and five valid nutrition totals. Owner comes from the token, not tool input. A per-user unique idempotency key prevents concurrent duplicate inserts and rejects conflicting reuse. Deleting the meal removes its retry protection. Separate scopes allow retry-safe water logging and confirmed, owner-checked meal deletion. diet:targets:write separately permits confirmed replacement of daily nutrition/water targets, with calories derived from macros; it does not change maintenance. No meal-edit or library-write tool exists. Deletion is marked destructive; its confirmed flag is a client assertion, not proof of user interaction.",
          "server/src/services/dietMealWrite.js; server/src/models/Diet.js"
        ],
        [
          "Deployment check",
          "ChatGPT and Codex reach the same protocol differently",
          "Local Codex can reach loopback. Cloud ChatGPT requires a reachable HTTPS endpoint or supported private tunnel. MCP_PUBLIC_URL must exactly match the advertised external resource. After changing permissions, reconnect and approve fresh consent; a tool annotation is not authorization.",
          "server/src/config/runtime.js"
        ],
        [
          "Recommended",
          "Treat assistant input as untrusted",
          "Review the meal before confirming a write. Food names are data, not instructions. Consider write-specific quotas, privacy-safe audit retention and anomaly alerts; never log bearer tokens, OAuth codes or meal payloads. Existing tool logs contain tool/outcome/duration and a correlation ID.",
          "server/src/services/dietMcp.js"
        ]
      ]
    },
    {
      "id": "data",
      "title": "Data & external services",
      "subtitle": "The browser never receives infrastructure credentials.",
      "points": [
        [
          "Implemented",
          "MongoDB is reached through the server",
          "Application users, sessions, Diet, Finance, Family and MCP grants live in MongoDB. Server-side models and authorization determine access. Dev uses astitva; Stage uses astitva_stage; Production expects astitva_prod.",
          "server/src/config/runtime.js; server/src/config/database.js"
        ],
        [
          "Deployment check",
          "Atlas access and recovery",
          "Verify TLS, narrowly scoped database credentials, Render outbound IP allowlisting, backup retention and a tested restore procedure in Atlas. The repository deployment guide recommends them; this page cannot inspect provider dashboards or prove they are enabled.",
          "docs/infra/production.md"
        ],
        [
          "Implemented",
          "Firestore grants bound Chat access",
          "The API issues Firebase chat grants through the Admin SDK. Rules require an authenticated participant, matching chat/grant claims and an unexpired grant. Messages have strict fields and size checks; list queries are capped at 50, updates/deletes are denied, and the fallback rule denies access. Admin SDK operations bypass rules and depend on server authorization.",
          "firestore.rules; server/src/services/firebaseAdmin.js"
        ],
        [
          "Implemented",
          "Optional Finance integration",
          "Render connects to Plaid when enabled. Finance tokens use server-side encryption; browser code must never contain Plaid secrets or encryption keys. Gmail API credentials are server-side for Production email; local email uses Mailpit.",
          "server/src/services/finance; server/src/services/email.js"
        ],
        [
          "Recommended",
          "Reduce consequences of credential loss",
          "Rotate service credentials with an explicit recovery plan, use least-privilege provider roles, verify restore drills and alert on unusual access. Restrict Firebase API keys to intended APIs; public Firebase configuration does not grant database access.",
          ""
        ]
      ]
    },
    {
      "id": "release",
      "title": "Release & environment boundaries",
      "subtitle": "Code describes the intended deployment, not live compliance.",
      "points": [
        [
          "Implemented",
          "Manual releases from main",
          "Separate server/web workflows use workflow_dispatch and require main. Both target the GitHub production environment. Server tests run before the secret Render hook requests the selected commit; health is checked against its version and SHA. Web builds with explicit public variables and deploys Hosting.",
          " .github/workflows/deploy-server-render.yml; .github/workflows/deploy-web-firebase.yml"
        ],
        [
          "Implemented",
          "Secrets and public variables have different jobs",
          "GitHub secrets supply deployment credentials; VITE_* values are compiled into public browser assets. render.yaml marks server credentials/configuration for provider entry and disables automatic deployment. Never copy a local environment file into Production.",
          "render.yaml; docs/infra/production.md"
        ],
        [
          "Deployment check",
          "Approvals and provider policies",
          "Verify branch protection, required PR review, production-environment reviewers, least-privilege service accounts and dashboard MFA. Naming an environment production does not itself require approval.",
          "docs/infra/production.md"
        ],
        [
          "Recommended",
          "Harden the delivery chain",
          "Pin third-party Actions to full commit SHAs, reduce job permissions where possible and evaluate short-lived OIDC deployment identity in place of a long-lived Firebase service-account JSON. Current workflows use version tags and contents:write to create release tags.",
          " .github/workflows/deploy-server-render.yml; .github/workflows/deploy-web-firebase.yml"
        ]
      ]
    }
  ],
  "configuration": [
    [
      "GitHub secret",
      "RENDER_DEPLOY_HOOK_URL",
      "Triggers the selected API release. Treat the entire URL as a credential.",
      "Limit who can run Production workflows; rotate the hook if exposed."
    ],
    [
      "GitHub secret",
      "FIREBASE_SERVICE_ACCOUNT",
      "Private deployment identity used by the Hosting workflow.",
      "Use least-privilege IAM; evaluate OIDC and rotate existing keys."
    ],
    [
      "GitHub variables",
      "VITE_API_BASE_URL; VITE_FIREBASE_*; FIREBASE_PROJECT_ID",
      "Public API origin, Firebase browser/project configuration and public VAPID key. VITE_* becomes downloadable JavaScript.",
      "Restrict Firebase APIs/quotas and enforce rules. Never place server secrets here."
    ],
    [
      "Render secret",
      "MONGODB_URL",
      "Server-only Atlas URI with database credentials.",
      "Limit database role and allowed source IPs; verify TLS and backups."
    ],
    [
      "Render configuration",
      "ASTITVA_ENV; WEB_URL; CORS_ORIGINS; MCP_PUBLIC_URL; ADMIN_EMAILS",
      "Production mode, trusted web origins, exact MCP resource and Admin allowlist. Names/purposes only; no live values are returned.",
      "Use exact HTTPS origins and review the Admin allowlist; configuration controls access."
    ],
    [
      "Render secrets",
      "FIREBASE_SERVICE_ACCOUNT_BASE64; GMAIL_CLIENT_SECRET; GMAIL_REFRESH_TOKEN",
      "Firebase Admin operations and Production email identity. Base64 is encoding, not encryption.",
      "Keep server-side; scope IAM/OAuth permissions and plan rotation."
    ],
    [
      "Render configuration",
      "FIREBASE_PROJECT_ID; GMAIL_CLIENT_ID; EMAIL_PROVIDER; EMAIL_FROM",
      "Provider/project identifiers and email routing. These are not replacements for credentials.",
      "Match the Production projects/accounts; verify provider dashboards."
    ],
    [
      "Render secrets",
      "PLAID_SECRET; FINANCE_TOKEN_ENCRYPTION_KEY",
      "Optional Finance provider access and encrypted token protection.",
      "Keep a secure key recovery process; changing encryption keys requires migration, not blind replacement."
    ],
    [
      "Repository configuration",
      "firebase.json",
      "Hosting serves web/dist, excludes dotfiles/node_modules, rewrites routes to index.html and sets cache policies. Index/version are no-store; fingerprinted assets are immutable.",
      "These are not authorization rules. Add and test browser security headers/CSP; API headers do not cover Hosting."
    ],
    [
      "Repository policy",
      "firestore.rules",
      "Deny-by-default Chat data access with participant/grant checks and message constraints.",
      "Deploy rules separately: the Hosting workflow does not publish rules. Test rules with emulators before changes."
    ],
    [
      "Repository configuration",
      "render.yaml; .github/workflows/*",
      "Render service template plus manually triggered, version-checked release automation.",
      "sync:false is a setup marker, not proof that a secret exists or is safely configured."
    ],
    [
      "Local ignored files",
      ".env.dev; .env.stage; web/.env.local",
      "Local profile configuration; never served as architecture data or committed.",
      "Keep environments isolated and file access restricted. Anything injected into browser code remains public."
    ]
  ],
  "walkthroughs": [
    [
      "Application",
      "Firebase Hosting delivers the React app. Sign-in reaches Render over HTTPS; a live session identifies the user. Feature/owner checks constrain API operations, and only Render connects to MongoDB."
    ],
    [
      "Anonymous Chat",
      "Render authorizes chat membership and mints scoped Firebase identity/grants. The browser connects to Firestore, where deployed rules independently validate each message operation."
    ],
    [
      "Assistant meal logging",
      "ChatGPT or Codex discovers MCP OAuth endpoints, obtains fresh consent and exchanges a PKCE-bound code. A scoped bearer token exposes the create tool; validation and an owner-bound retry key protect the database write."
    ]
  ],
  "sources": [
    {
      "label": "Firebase API-key guidance",
      "url": "https://firebase.google.com/docs/projects/api-keys"
    },
    {
      "label": "GitHub Actions hardening",
      "url": "https://docs.github.com/en/actions/reference/security/secure-use"
    },
    {
      "label": "GitHub OIDC",
      "url": "https://docs.github.com/en/actions/concepts/security/openid-connect"
    }
  ]
};
