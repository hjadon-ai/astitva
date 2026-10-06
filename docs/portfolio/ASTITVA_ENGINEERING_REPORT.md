# Astitva: Engineering and AI-Assisted Development Report

Audit date: October 4, 2026. Prepared for portfolio and resume updates.

Astitva is a substantial full-stack personal workspace with financial-account integration, family access controls, and protected real-time chat. A separate native iOS client is partially implemented. Its strongest engineering story combines architecture, security-sensitive integration, data modeling, concurrency handling, and a documented workflow for directing AI coding agents.

This report describes inspected source, feature documents, configuration, and Git history. It does not claim AI independently built the application. The audit was read-only: no builds, tests, production mutations, or deployments were performed. These report artifacts were created afterward at the owner's request.

## 1. Project scale and statistics

### Counting methodology

Measurements describe working files as of the audit, including uncommitted F032 code. Physical lines include comments and blank lines. Source extensions counted were JavaScript, JSX, TypeScript/TSX where present, Swift, CSS, HTML, shell, and Firestore rules. Dependencies, generated output, lock files, documentation, assets, Git metadata, and ignored local agent/tooling directories were excluded. No application TypeScript/TSX was found in Astitva; the separate Portfolio application does use TypeScript.

Counts establish repository size, not development effort, production usage, or engineering quality. A physical-line count is exact under these rules; “lines of code” is an approximate description of that measure.

### Code size

| Area | Files | Physical lines | Measurement |
| --- | --- | --- | --- |
| Main web/backend repository | 82 | 9,162 | Exact under the counting rules |
| Web source, configuration, scripts, and tests | 22 | 3,129 | Exact |
| Server source and tests | 57 | 5,858 | Exact |
| Root scripts and Firestore rules | 3 | 175 | Exact |
| Adjacent iOS repository | 29 Swift files | 4,518 | Exact |
| Combined application workspaces | 111 | 13,680 | Exact physical-line total |

Application source directory measurements:

| Source directory | Files | Lines |
| --- | --- | --- |
| web/src | 17 | 3,006 |
| server/src | 40 | 4,163 |
| Native iOS application, excluding tests | 27 | 4,150 |

Resume wording: “Approximately 13,700 lines across web, backend, and native iOS source and tests.” Do not imply those lines are all deployed or all business logic.

### Language breakdown

| Language/file type | Files | Lines | Workspace |
| --- | --- | --- | --- |
| JavaScript | 69 | 6,280 | Astitva |
| JSX | 9 | 2,287 | Astitva |
| CSS | 1 | 462 | Astitva |
| Firestore Security Rules | 1 | 63 | Astitva |
| Shell | 1 | 56 | Astitva |
| HTML | 1 | 14 | Astitva |
| Swift | 29 | 4,518 | Astitva-IOS |

### Functional and engineering inventory

| Item | Finding | Interpretation |
| --- | --- | --- |
| REST operations | 78 registered method/path combinations | Includes one legacy GET message route returning 410 |
| Active/non-retired REST operations | 77 | Excludes that intentionally retired read route |
| REST route groups | 8 domain groups plus health | Auth, Admin, Diet, Finance, Priorities, Family, Chat, Notifications |
| MongoDB models | 22 Mongoose models in 12 files | Collection definitions, not a live database inventory |
| React components | 44 named component definitions | Static inspection; includes shared UI and nested feature components |
| Main feature screens | 7 | Overview, Priorities, Diet, Finance, Family, Chat, Admin |
| Feature IDs | 29 | IDs are not contiguous |
| Feature status | 20 Done, 3 Approved, 6 Proposed | Done includes infrastructure and presentation features |
| Server tests | 16 test files; 46 test() declarations | One additional helper file; execution not repeated |
| Web tests | 2 test files; 4 test declarations | Includes unfinished notification-extension tests |
| iOS tests | 2 files; 11 test declarations | Documentation records execution/configuration gaps |
| Main Git history | 65 commits reachable from HEAD | Includes 26 merge commits |
| All local Git refs | 71 reachable commits | Not a measure of unique engineering changes |
| Main development timeline | September 16–October 4, 2026 | Recorded commit dates; not hours of effort |
| iOS Git history | One initial commit, October 3, 2026 | Working code exceeds what this minimal history explains |

The Done count includes F032 in uncommitted working files. It is not a deployed-feature count. Test declarations are not assertion counts, scenario counts, or passing-test counts.

### API documentation coverage

After matching methods and normalizing route parameter names, OpenAPI definitions collectively describe 76 of 78 operations, approximately 97%. The missing operations are the new Admin notification-setting GET/PATCH routes.

Postman contains 86 request entries. These represent 75 of 78 registered operations, approximately 96%, after accounting for duplicate examples and concrete diet/finance variants of parameterized Family routes. Missing operations are Firebase chat-session bootstrap and the two Admin notification-setting routes.

Admin OpenAPI definitions are separate from the root index. Several root reference strings contain trailing spaces. These are operation-presence measurements, not proof that a fully resolved and validated OpenAPI document covers every operation.

### Major frameworks and integrations

- Frontend: React 19, Vite 7, plain CSS, Lucide.
- Backend: Node.js, Express 5, Mongoose 9.
- Persistence: MongoDB locally; MongoDB Atlas production configuration.
- Authentication: bcrypt, opaque database-backed sessions, cookies and bearer transport.
- Messaging: Firebase Authentication custom tokens, Cloud Firestore, Firebase Admin SDK.
- Notifications: Firebase Cloud Messaging server integration; unfinished browser service-worker integration.
- Finance: Plaid Link and a server-side Plaid adapter.
- Email: Mailpit, Nodemailer/SMTP, Gmail API with OAuth credentials.
- Delivery: Firebase Hosting, Render, manually triggered GitHub Actions.
- iOS: Swift, SwiftUI, URLSession, async/await, Keychain, Firebase Auth/Firestore, Swift Testing.

Versions describe declared major dependency families, not a claim about the latest available releases.

## 2. What has actually been built

### Authentication and account lifecycle

Users can sign up, log in, restore a session, log out, verify/resend email verification, and recover a password. Production signup requires invitation eligibility.

Frontend work includes forms, verification/reset states, authenticated navigation, errors, and session-expiry handling. Backend work includes account lookup, credential validation, email delivery, recovery controls, and browser/native session transport.

Four MongoDB models cover User, Session, EmailVerificationToken, and PasswordResetToken. Sessions last 24 hours; verification/reset tokens expire after one hour. Token values are stored as hashes, and passwords use bcrypt.

Security includes verified-user gates, generic recovery responses, production rate limits, exact-origin checks for browser writes, and session invalidation after reset. Mailpit supports local testing; configured SMTP or Gmail API supports email delivery.

Engineering significance: an account lifecycle with recovery and revocation, shared across browser and native clients. Firebase Auth authorizes chat; it does not replace the primary account system.

### Public portfolio and authenticated profile

The public page has a portfolio-style layout, but project and biography content remain placeholders. The authenticated profile displays account information and sample statistics.

Frontend work includes a responsive public page and private application shell. Backend support is account/session retrieval. There is no dedicated portfolio-content data model.

There is no complete portfolio CMS, project-management system, profile editor, or image-upload workflow. Describe an authenticated application shell and account overview. F028, which addresses more relevant home-page content, remains Approved.

### Diet tracking and reusable meals

Users can record, edit, and delete meals by day; inspect calories/macros/fiber and targets; track water; manage reusable meals; scale portions; and preview/confirm CSV imports.

Frontend work includes local date navigation, grouped meal lists, forms, macro summaries, target comparisons, water controls, library search/filtering, and import review. Backend services share validation and nutrition scaling across individual and bulk paths.

Four models store daily meals, targets, water entries, and reusable meal templates. Daily meal snapshots remain independent from later template edits. APIs enforce verified sessions, feature access, and owner-scoped queries.

External integration is CSV upload/parsing, not a food database or medical recommendation provider. Architectural complexity includes reversible water entries, consistent calculations, and preview-before-import behavior.

### Financial-account aggregation

Users can connect institutions through web Plaid Link, synchronize accounts, inspect balances/transactions/holdings, review net worth/monthly spending, stop tracking an account, and disconnect an institution.

Frontend work includes Link integration, summary/detail views, sync feedback, and deletion confirmations. Backend work includes a provider adapter, synchronization orchestration, normalization, summaries, cleanup, and error/status handling.

Four models represent connections, accounts, transactions, and holdings. Connections retain provider environment, sync state, transaction cursors, and encrypted access tokens.

Security includes owner isolation, provider-environment validation, server-only credentials, and AES-256-GCM encryption of Plaid access tokens. Dev uses Sandbox; local Stage intentionally uses Plaid Production. Production use is separately configurable.

Engineering significance: provider abstraction, incremental synchronization, normalized persistence, explicit excluded-currency treatment, and cleanup semantics. This is financial-account aggregation and tracking, not payment processing or a complete accounting platform.

### Daily Priorities

Users maintain up to three priorities per selected day, edit/delete them, and complete or reopen them. The UI shows actual completion progress and supports past-date navigation.

Frontend work includes local-calendar handling, inline editing, drafts, conflict/error feedback, and stale-response protection. Backend work includes strict date/timezone/body validation and atomic owner-scoped writes.

One owner/date MongoDB document embeds bounded items and uses a unique compound index. An atomic update predicate enforces the three-item limit without a count-then-insert race.

Engineering significance: concurrency-safe invariants and calendar-date handling separate from timestamps. No recurring tasks, future planning, or automatic carryover is implemented.

### Family graph, roles, and data sharing

Users create a family, add people/relationships, invite account holders, accept invitations, browse/search the directory, manage permitted roles/relationships, explicitly share Diet/Finance data, and inspect recent activity.

Frontend work includes family perspectives, directory controls, invitation flows, incoming/outgoing sharing views, and paginated activity. Backend work resolves relationships, checks roles/membership, links verified accounts, prunes disconnected graph branches, and authorizes shared reads.

Family documents embed people, graph edges, and share grants. Separate invitation and activity models support linking/history. Permissions include ADMIN, EDITOR, and READONLY; accepted membership and explicit owner-to-recipient sharing remain authoritative.

Email delivers invitations. Architectural complexity includes perspective-dependent relationship labels, accountless versus linked people, optimistic concurrency, graph pruning, and cross-domain permissions.

Family social feeds, Family chat, directory export, leave-family, richer member profiles, and relationship-correction proposals are not complete implemented capabilities. Approved F019 invitation-management scope is not complete.

### Anonymous, PIN-protected real-time chat

Users share a single-use invitation URL, accept under an alias, create a personal six-digit conversation PIN, unlock, exchange messages, page through history, lock, edit aliases, and delete conversations.

Frontend work includes conversation selection, PIN states, live status, message layout, pagination, alias actions, and cleanup. Backend work includes invitation claiming, participant checks, PIN hashing, escalating lockouts, short-lived unlocks, grant issuance/revocation, and deletion coordination.

MongoDB stores invitations, participant/PIN controls, legacy embedded messages, and deletion records. Firestore stores live messages and authorization grants. Firebase Auth custom-token claims and Firestore Security Rules constrain direct access.

Engineering significance: separation of server-controlled authorization from live message delivery, with lifecycle coordination across MongoDB and Firestore. F029 introduced direct Firestore traffic; local F032 changes new web sends to Express-mediated writes while keeping direct reads.

“Anonymous” means alias-based presentation to participants. The service knows account identities. Messages are not end-to-end encrypted. PIN recovery is not implemented.

### Administration and notifications

F031 supplies an email-allowlisted Admin Panel for bounded literal user search, feature-access updates, invitee management, and invitation delivery. Frontend editors preserve conflict drafts and show partial delivery outcomes. Backend authorization checks active sessions and the allowlist; optimistic versions protect updates. InvitedEmail stores effective feature access. Disabling Chat revokes grants.

F032 adds server-mediated message writes, stable client request identifiers, transactional message/receipt creation, session-bound device registration, eligibility rechecks, invalid-token cleanup, and privacy-safe generic FCM payloads. NotificationDevice stores device registrations; the unfinished extension adds NotificationSetting.

The chosen dispatch design minimizes API calls and favors at-most-once application submission rather than guaranteed delivery. Saving a message can succeed even when notification submission fails; no durable retry worker exists.

Browser background notifications and a global Admin switch are unfinished local additions and have not been verified. F032 documentation still excludes browser push. The iOS client currently writes directly to Firestore and lacks native FCM registration, so its sends bypass the new server notification path.

## 3. Architecture

Astitva uses a modular monolith backend with separate web/native clients and a specialized Firebase messaging subsystem.

```text
React/Vite web client                 SwiftUI iOS client
Firebase Hosting                      URLSession + Keychain
         \                              /
          +---------- HTTPS REST ------+
                         |
                 Express API on Render
                 authentication / permissions
                 domain routes / integrations
                         |
               MongoDB / MongoDB Atlas
          accounts, sessions, diet, finance,
          priorities, family, chat controls
                         |
            Firebase Admin SDK
            +-- custom Auth tokens / grants
            +-- Firestore message writes [local F032]
            +-- FCM notification submission [local F032]

Web and iOS -- Firebase Auth -- Firestore
                               live reads / history
                               legacy direct iOS writes

Express -- Plaid
        +-- SMTP / Gmail API
```

### Frontend, backend, and communication

React/Vite is a client-rendered SPA with plain CSS and shared presentation components. Local Vite proxies relative /api requests to Express. Production requests use a configured API base URL. The app uses hash navigation and selected pathname flows rather than a large routing framework.

Express organizes domain routes, middleware, Mongoose models, and services. MongoDB is the primary system of record. Clients never connect directly to MongoDB. REST handles accounts and domain data; Firestore listeners and cursor queries deliver chat history/live updates.

Browser sessions use HTTP-only cookies, with production bearer-token support. Native sessions use opaque bearer tokens in Keychain, not JWTs. Firebase custom tokens grant bounded chat access. Server authorization remains authoritative even when navigation hides unavailable features.

### Environments and deployment

| Environment | Applications/database | Finance provider |
| --- | --- | --- |
| Dev | Local React/Express; MongoDB astitva | Plaid Sandbox |
| Stage | Local applications; MongoDB astitva_stage | Plaid Production with real financial data |
| Production | Firebase Hosting; Render API; MongoDB Atlas astitva_prod | Plaid Production when enabled |
| iOS | Production-only client | Existing finance data; native Link not configured |

Runtime validation rejects crossed-profile databases and unsafe configurations. Cookie names and secrets are isolated. Production uses HTTPS origins and Secure/SameSite=None cookies. Local SMTP may use Mailpit; production supports Gmail API or configured SMTP.

Firebase Hosting serves static web/dist with SPA rewrites and cache policy. Render starts the Node API and exposes health metadata. autoDeploy is false. GitHub Actions provide manually triggered production deployments, version checks, and server test execution.

Repository configuration establishes intended hosting, not proof that every local feature is deployed. This audit did not query current production state.

### Native iOS architecture and completeness

The separate Astitva-IOS workspace uses SwiftUI views, observable feature models, typed Codable contracts, URLSession async networking, Keychain sessions, and Firebase chat. It is not a fully equivalent web client.

Implemented areas include authentication, account views, Priorities, core chat, and Admin. Diet, Finance, and Family remain partial. Missing/dependent work includes native Plaid Link, complete meal/library/target functionality, operational Universal Links, several Family flows, chat management controls, and push notifications. Public account-recovery/verification flows use web fallbacks.

Source currently sends a compatibility Origin on unsafe Production requests. Some instructions say otherwise; source is newer evidence than those conflicting statements. The compatibility header is not authentication.

Status documents record successful builds, blocked test execution, and unavailable Production Admin routes at the time of their checks. The audit did not repeat these checks. Eleven static Swift test declarations were found, whereas older handoff records describe different discovery counts.

### Security boundaries and practical limits

- Clients access MongoDB data only through authorized Express routes.
- Firebase custom tokens and grants constrain chat access; Admin SDK credentials stay server-side.
- Server credentials and financial-provider tokens do not belong in frontend code.
- Exact-origin checking addresses browser request boundaries; it is not identity verification.
- MongoDB and Firestore operations do not share one cross-database transaction.
- Rate limits are process-local; notification dispatch has no durable retry worker.
- Direct-write chat compatibility means notification coverage depends on client migration.

There is no demonstrated Astitva microservices platform, Kubernetes deployment, high-availability design, or product LLM/RAG functionality. Other career projects may demonstrate those skills, but they should not be attributed to Astitva.

## 4. AI-assisted engineering evidence

The strongest evidence is explicit workflow material, not speculation based on code style.

| Skill | Evidence | Demonstrated practice |
| --- | --- | --- |
| Prompt engineering | Copy-ready proposal/implementation prompts | Specify outcomes, scope, constraints, and verification |
| Context engineering | Root/directory instructions, feature index, project context, iOS handoff/status | Supply durable task-relevant context across sessions |
| Requirements decomposition | Feature IDs, user flows, scope exclusions, API/data changes, acceptance criteria | Break product work into reviewable units |
| Architecture-driven prompting | Approved concurrency, finance-adapter, and chat-boundary decisions | Direct implementation through architectural constraints |
| Agent workflow governance | Approval gates; preserve unrelated work; explicit push/deploy limits | Control agent authority and change scope |
| AI-assisted debugging | Diet response fix; iOS PIN transition, timestamp decoding, decoupled requests | Iterative diagnosis and correction with coding agents |
| AI-assisted refactoring | Shared UI, centralized validation, provider abstraction, messaging migration | Improve structure while preserving behavior |
| AI-assisted documentation | Feature specs, OpenAPI/Postman, collection designs, verification records | Maintain contracts and future implementation context |
| Human-directed iteration | Recorded owner decisions and Git merges | Human decisions followed by implementation/review cycles |

### Why the evidence matters

ChatGPT project instructions explicitly separate brainstorming from implementation and require scope/architecture approval. The feature template connects user outcomes, data/API design, acceptance criteria, and verification. WORKFLOW.md provides copy-ready agent prompts and preserves the owner's review/delivery responsibility. Directory instructions narrow context and prevent inappropriate architectural changes. iOS handoff records distinguish implemented behavior, observed verification, and next steps.

Together these demonstrate designing the conditions under which an agent can work effectively, assessing its output, and retaining context for future work. Human engineering judgment remains central: choosing boundaries, approving tradeoffs, reviewing behavior, and deciding when to deliver.

Git history supports iterative evolution: email-provider changes, deployment version controls, family perspectives, stale-response handling, Firestore migration, chat layout, and Admin/native transport. These are concrete engineering iterations, not proof of autonomous AI authorship.

### Attribution and evidence limitations

- No Codex attribution or AI coauthor trailers were found in Git messages.
- Code cannot establish which lines were AI-generated.
- Merge commits establish integration, not the depth of each review.
- Instructions establish intended governance, not universal historical compliance.
- GitHub Copilot certification is owner-supplied information, not repository-verified.
- No supported measurement of AI time savings, productivity multipliers, adoption, or revenue exists in this audit.

Context freshness is an improvement opportunity: some instructions retain obsolete local-only architecture, branch/status rules, chat transport details, or iOS compatibility assumptions. Keeping that material aligned is part of context engineering.

## 5. Resume and portfolio positioning

### Recommended project description

> Astitva — Full-stack personal and family workspace. Designed and developed a React/Node.js/MongoDB application integrating financial-account aggregation, diet tracking, family permissions, and PIN-protected real-time chat, with a native SwiftUI client in development. Used Codex-assisted workflows for feature specification, implementation, debugging, and documentation while retaining architectural decisions and review responsibility.

### Resume bullet options

- Architected a personal workspace spanning React, Express, MongoDB Atlas, Firebase, and a partial SwiftUI client, with 78 registered REST operations and 22 persistence models.
- Integrated Plaid account synchronization with normalized financial data, encrypted provider tokens, and isolated runtime environments.
- Implemented alias-based, PIN-protected chat using server-controlled authorization, Firebase custom tokens, and live Firestore delivery.
- Established a specification-driven Codex workflow using scoped instructions, approved feature designs, acceptance criteria, API contracts, and documented verification.

Use the numeric API/model bullet only with its audit date and working-source qualification where readers could infer deployment. A simpler public bullet can omit those numbers.

### Skills supported by the project

AI-assisted software engineering; Codex agent workflows; prompt engineering; context engineering; solution architecture; full-stack development; API design; data modeling; integration engineering; security-aware development; technical documentation; concurrency handling; native client integration.

List the GitHub Copilot certification separately using the credential's exact verified title, issuer, and date. The existing Portfolio content stores “GitHub Copilot Certified,” “Microsoft,” and “Nov 2025”; this report does not independently validate those fields.

### Role-specific emphasis

| Portfolio role | Emphasis |
| --- | --- |
| Master portfolio | Product breadth, hands-on delivery, architecture, responsible AI practice |
| Solution Architect | Domain boundaries, MongoDB/Firestore split, provider abstraction, permissions, environments |
| Principal / Staff Engineer | Atomic invariants, idempotency, stale responses, integration lifecycle, reusable structure |
| Engineering Manager | Requirements decomposition, review discipline, delivery controls, verification transparency |

Astitva is a personal project. Do not infer that its single-engineer workflow involved leading a team. Existing professional leadership achievements should remain attributed to their original career projects.

### Claims to avoid

Do not describe the project as fully production-ready across platforms, completely anonymous or end-to-end encrypted, full iOS feature parity, guaranteed push delivery, an AI-powered product, an autonomous AI build, or a quantified productivity improvement without additional evidence.

The most credible positioning is an experienced engineer and architect applying AI coding agents to a real evolving application through explicit requirements, architectural boundaries, iterative debugging, and human-controlled delivery.

## 6. Evidence map and update notes

Paths below are relative to the Astitva root unless marked as a sibling workspace. They are local source references, not public portfolio links.

| Subject | Source |
| --- | --- |
| Project baseline | README.md |
| Agent delivery rules | AGENTS.md and applicable INSTRUCTIONS.md files |
| Feature status | docs/features/README.md |
| Feature specification structure | docs/features/FEATURE_TEMPLATE.md |
| Implementation/review prompts | docs/features/WORKFLOW.md |
| Brainstorming/context workflow | chatgpt-project/PROJECT_INSTRUCTIONS.md, ASTITVA_CONTEXT.md, START_HERE.md |
| Authentication | server/src/routes/auth.js, models/User.js, models/Session.js |
| Request security | server/src/middleware/security.js, sessionToken.js, featureAccess.js, adminAccess.js |
| Diet | web/src/Diet.jsx, server/src/routes/diet.js, services/diet.js, models/Diet.js |
| Finance | web/src/Finance.jsx, server/src/services/finance/, models/Finance.js |
| Priorities/concurrency | docs/features/priorities/F009-daily-priorities.md, server/src/routes/priorities.js |
| Family | web/src/Family.jsx, server/src/routes/family.js, models/Family.js |
| Chat | web/src/Chat.jsx, firestoreChat.js, server/src/routes/chat.js, firestore.rules |
| F032 send/dispatch | server/src/services/chatMessageSend.js, chatNotifications.js, web/src/chatSender.js |
| Admin | web/src/Admin.jsx, server/src/routes/admin.js |
| API contracts | server/design/openapi.yaml, *.openapi.json, Astitva.postman_collection.json |
| Collection design | server/design/mongodb-collections.md |
| Runtime/hosting | server/src/config/runtime.js, firebase.json, render.yaml, .github/workflows/ |
| iOS source/status | ../Astitva-IOS/Astitva-IOS/README.md, docs/IMPLEMENTATION_STATUS.md, docs/HANDOFF.md |

Before publishing new claims, distinguish working-source implementation, committed/merged implementation, executed verification, and deployed availability. These counts are a dated snapshot, not live badges. New report files themselves were not included in the audit counts.

The portfolio application is the sibling directory ../Portfolio. It uses React/TypeScript/Vite and shared content in src/data/portfolio.json, with role versions referencing stable IDs. Tailored implementation prompts are in PORTFOLIO_UPDATE_PROMPTS.md.
