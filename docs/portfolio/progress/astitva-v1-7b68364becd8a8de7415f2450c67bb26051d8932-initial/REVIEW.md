# Portfolio review packet: astitva-v1-7b68364becd8a8de7415f2450c67bb26051d8932-initial

Generated: 2026-10-04T22:09:01-07:00
Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Previous reviewed commit: `None — initial baseline`

## Boundaries

Deterministic collection is separate from Codex interpretation below. All claims begin Pending. Feature status, test declarations, and hosting configuration are not proof of verification or deployment. No application code/tests were executed; no network/deployment probe was made. iOS and Portfolio are not collected by this script.

Historical context: ASTITVA_ENGINEERING_REPORT.md is the October 4 working-tree audit, including uncommitted F032/iOS work. It is not this committed baseline or current deployment evidence.

## Measurements

- Source files: 64; physical lines: 8138.
- Registered REST operations: 74 (may include retired compatibility routes).
- Mongoose model definitions: 20.
- Static test declarations: 44; execution: Not run by collector.
- Feature-index status counts: {"Approved": 3, "Done": 19, "Proposed": 6}.

Allowlisted tracked source/test files; physical lines include blanks/comments. No generated output, dependencies, assets, locks, credentials, environment files, or local tooling. Static counts do not prove execution or deployment.

Full language/area breakdown, route inventory, and feature rows are in packet.json.

## Changed evidence files

No previous reviewed snapshot: inventory of baseline files.
- Added: `.github/workflows/deploy-server-render.yml`
- Added: `.github/workflows/deploy-web-firebase.yml`
- Added: `AGENTS.md`
- Added: `README.md`
- Added: `chatgpt-project/ASTITVA_CONTEXT.md`
- Added: `chatgpt-project/PROJECT_INSTRUCTIONS.md`
- Added: `chatgpt-project/START_HERE.md`
- Added: `docs/INSTRUCTIONS.md`
- Added: `docs/features/FEATURE_TEMPLATE.md`
- Added: `docs/features/README.md`
- Added: `docs/features/WORKFLOW.md`
- Added: `docs/features/admin/F031-admin-panel.md`
- Added: `docs/features/auth/F001-local-authentication.md`
- Added: `docs/features/auth/F003-signup-email-verification.md`
- Added: `docs/features/auth/F004-forgot-password.md`
- Added: `docs/features/chat/F027.md`
- Added: `docs/features/chat/F029-firestore-chat-messages.md`
- Added: `docs/features/diet/F005-daily-diet-tracking.md`
- Added: `docs/features/diet/F008-diet-targets-and-meal-library.md`
- Added: `docs/features/family/F014-family-directory.md`
- Added: `docs/features/family/F015-family-sharing-overview.md`
- Added: `docs/features/family/F016-family-activity-history.md`
- Added: `docs/features/family/F017-family-relationship-corrections.md`
- Added: `docs/features/family/F018-family-members.md`
- Added: `docs/features/family/F018-family-rules.md`
- Added: `docs/features/family/F019-family-invitation-management.md`
- Added: `docs/features/family/F020-family-member-profiles.md`
- Added: `docs/features/family/F021-leave-family.md`
- Added: `docs/features/family/F022-export-family-directory.md`
- Added: `docs/features/familysocial/F023.md`
- Added: `docs/features/familysocial/F024.md`
- Added: `docs/features/familysocial/README.md`
- Added: `docs/features/finance/F006-personal-finance.md`
- Added: `docs/features/infra/F007-local-stage-environment.md`
- Added: `docs/features/infra/F012-cloud-production-environment.md`
- Added: `docs/features/infra/README.md`
- Added: `docs/features/notes/F010-quick-notes.md`
- Added: `docs/features/priorities/F009-daily-priorities.md`
- Added: `docs/features/profile/F002-local-profile-page.md`
- Added: `docs/features/ui/F011-application-visual-system.md`
- Added: `docs/features/ui/F028-relevant-home-pages.md`
- Added: `docs/features/ui/F030-compact-anonymous-chat-layout.md`
- Added: `docs/infra/production.md`
- Added: `firebase.json`
- Added: `firestore.rules`
- Added: `render.yaml`
- Added: `scripts/check-deploy-version.js`
- Added: `scripts/start-local.sh`
- Added: `server/INSTRUCTIONS.md`
- Added: `server/design/INSTRUCTIONS.md`
- Added: `server/design/admin.openapi.json`
- Added: `server/design/chat.openapi.json`
- Added: `server/design/diet.openapi.json`
- Added: `server/design/family.openapi.json`
- Added: `server/design/finance.openapi.json`
- Added: `server/design/mongodb-collections.md`
- Added: `server/design/openapi.yaml`
- Added: `server/design/priorities.openapi.json`
- Added: `server/package.json`
- Added: `server/src/INSTRUCTIONS.md`
- Added: `server/src/app.js`
- Added: `server/src/config/INSTRUCTIONS.md`
- Added: `server/src/config/database.js`
- Added: `server/src/config/runtime.js`
- Added: `server/src/middleware/adminAccess.js`
- Added: `server/src/middleware/featureAccess.js`
- Added: `server/src/middleware/security.js`
- Added: `server/src/middleware/sessionToken.js`
- Added: `server/src/models/Chat.js`
- Added: `server/src/models/DailyPriorityDay.js`
- Added: `server/src/models/Diet.js`
- Added: `server/src/models/EmailVerificationToken.js`
- Added: `server/src/models/Family.js`
- Added: `server/src/models/Finance.js`
- Added: `server/src/models/INSTRUCTIONS.md`
- Added: `server/src/models/InvitedEmail.js`
- Added: `server/src/models/PasswordResetToken.js`
- Added: `server/src/models/Session.js`
- Added: `server/src/models/User.js`
- Added: `server/src/routes/INSTRUCTIONS.md`
- Added: `server/src/routes/admin.js`
- Added: `server/src/routes/auth.js`
- Added: `server/src/routes/chat.js`
- Added: `server/src/routes/diet.js`
- Added: `server/src/routes/family.js`
- Added: `server/src/routes/finance.js`
- Added: `server/src/routes/priorities.js`
- Added: `server/src/server.js`
- Added: `server/src/services/INSTRUCTIONS.md`
- Added: `server/src/services/diet.js`
- Added: `server/src/services/email.js`
- Added: `server/src/services/finance/PlaidFinanceProvider.js`
- Added: `server/src/services/finance/index.js`
- Added: `server/src/services/finance/syncFinance.js`
- Added: `server/src/services/finance/tokenEncryption.js`
- Added: `server/src/services/firebaseAdmin.js`
- Added: `server/src/services/gmailApi.js`
- Added: `server/src/services/priorities.js`
- Added: `server/test/admin.integration.test.js`
- Added: `server/test/app.test.js`
- Added: `server/test/chat.integration.test.js`
- Added: `server/test/cross-site-session.test.js`
- Added: `server/test/diet.test.js`
- Added: `server/test/family.integration.test.js`
- Added: `server/test/feature-access.test.js`
- Added: `server/test/finance.test.js`
- Added: `server/test/gmailApi.test.js`
- Added: `server/test/invited-email.integration.test.js`
- Added: `server/test/priorities.integration.test.js`
- Added: `server/test/priorities.test.js`
- Added: `server/test/runtime.test.js`
- Added: `server/test/security.test.js`
- Added: `web/INSTRUCTIONS.md`
- Added: `web/package.json`
- Added: `web/src/Admin.jsx`
- Added: `web/src/App.jsx`
- Added: `web/src/Chat.jsx`
- Added: `web/src/Diet.jsx`
- Added: `web/src/Family.jsx`
- Added: `web/src/Finance.jsx`
- Added: `web/src/INSTRUCTIONS.md`
- Added: `web/src/Priorities.jsx`
- Added: `web/src/firestoreChat.js`
- Added: `web/src/main.jsx`
- Added: `web/src/priorities-calendar.js`
- Added: `web/src/styles.css`
- Added: `web/src/ui/INSTRUCTIONS.md`
- Added: `web/src/ui/index.jsx`
- Added: `web/vite.config.js`

## Git history

Reachable commits: 65. Earliest/latest recorded commit dates: 2026-09-16 / 2026-10-04.
Subjects below are recorded history, not automatic public claims.
- `7b68364becd8` 2026-10-04: Keep agent and Claude configuration local only
- `3a6131d30c96` 2026-10-04: Merge pull request #24 from hjadon-ai/feature/changes_04-Oct-2026
- `5de2f40e99d5` 2026-10-04: F031 implemented: admin panel and native session support
- `a7f11ce10324` 2026-10-03: Merge pull request #23 from hjadon-ai/feature/changes_03-Oct-2026_2
- `41a2e33c5031` 2026-10-03: new firebase configurations
- `64c82561b08f` 2026-10-03: Merge pull request #22 from hjadon-ai/feature/changes_03-Oct-2026_2
- `73ba8ae80626` 2026-10-03: Merge pull request #21 from hjadon-ai/feature/changes_03-Oct-2026
- `cee477780e0f` 2026-10-03: Add Firestore live chat and improve compact chat layout
- `0a99329827d6` 2026-10-03: Add Firestore live chat and improve compact chat layout
- `6aa0e0f4be9d` 2026-10-02: Merge pull request #20 from hjadon-ai/feature/active-work
- `61ac32599f1f` 2026-10-02: adding invitedEmail
- `a5879857c054` 2026-10-02: Merge pull request #19 from hjadon-ai/feature/active-work
- `3b409ef3cada` 2026-10-02: Bulk chang, Chats, intive emails
- `ef61f0c89a51` 2026-10-01: Merge pull request #18 from hjadon-ai/feature/consolidate-pending-changes
- `1f7a66160c6c` 2026-10-01: Mark implemented family features done and add home proposal
- `c5cc36e5cc79` 2026-10-01: Document single work branch and efficient workflow
- `2e55351f0294` 2026-10-01: Add pending feature proposals and local favicon
- `160405c638c2` 2026-10-01: Implement approved Family search sharing overview and activity history
- `378f0f705582` 2026-10-01: Show a clear Diet error for outdated server responses
- `f4a462a6e2fb` 2026-10-01: Merge pull request #17 from hjadon-ai/feature/conditional-deployment-version-input
- `a4245ddfb83c` 2026-10-01: Require explicit mode for deployment version changes
- `803915943842` 2026-10-01: Merge pull request #16 from hjadon-ai/feature/deploy-without-version-bump-v2
- `53185a81a0b7` 2026-10-01: Read deployment versions from package files
- `86993e2eb05d` 2026-10-01: Agents.md added
- `d60d109349e8` 2026-10-01: Allow deployment without a version bump
- `a645e51d60db` 2026-10-01: Merge pull request #15 from hjadon-ai/feature/pending-docs-favicon-git-workflow
- `1ee07dc64b23` 2026-10-01: Merge latest main and preserve completed feature statuses
- `0f734591457f` 2026-10-01: Track completed features and add project workflow and favicons
- `6bc76e62efd0` 2026-10-01: Merge F008 diet targets and meal library
- `f850b358986e` 2026-09-30: Merge pull request #13 from hjadon-ai/feature/F018-family-members
- `6ae49a122c7c` 2026-09-30: Merge remote-tracking branch 'origin/main' into feature/F018-family-members
- `87f2795bd222` 2026-09-30: Organize feature docs and add family proposals
- `49ab86f7f04b` 2026-09-30: Merge pull request #12 from hjadon-ai/hjadon-ai-patch-1
- `c2dc7ec1cbe7` 2026-09-30: Update package.json
- `4130ac62d04c` 2026-09-30: Merge pull request #11 from hjadon-ai/hjadon-ai-patch-1
- `ebc862c66b78` 2026-09-30: Update package.json
- `47193a0bbc09` 2026-09-30: Update package.json
- `f6f02a10fbd8` 2026-09-30: Merge pull request #10 from hjadon-ai/feature/F018-family-members
- `584b48465458` 2026-09-30: Add family invitations and shared perspectives
- `e82616686555` 2026-09-29: Merge remote-tracking branch 'origin/main'
- `52aa236fd0a3` 2026-09-29: Send production Gmail through HTTPS API
- `2f1509746bfb` 2026-09-29: Merge pull request #9 from hjadon-ai/feature/gmail-smtp-email
- `9702274ce195` 2026-09-29: Show web and server versions on public home page
- `9b3fecf5e62c` 2026-09-29: Require versioned web and server deployments
- `097999d66032` 2026-09-29: Merge pull request #8 from hjadon-ai/feature/gmail-smtp-email
- `de1998d37af0` 2026-09-29: Add Gmail SMTP configuration for account emails
- `ed2f87412350` 2026-09-27: Rename project to Astitva
- `7aea6a119e29` 2026-09-23: Add manual production deployment workflows
- `1d277d2c484c` 2026-09-23: Implement F012 cloud production environment
- `5b0c3a0ad73d` 2026-09-23: Merge pull request #6 from hjadon-ai/feature/F009-daily-priorities
- `b6aa567c03d6` 2026-09-23: Implement F009 daily priorities
- `a3b7148358a5` 2026-09-23: Implement F008 diet targets and meal library
- `a62e7579fdc0` 2026-09-23: Merge pull request #5 from hjadon-ai/feature/F011-application-visual-system
- `43c799a9b928` 2026-09-23: Implement F011 application visual system
- `0827abee5eaa` 2026-09-22: addding stage env with plaid
- `d1a99d72dec5` 2026-09-22: Merge pull request #4 from hjadon-ai/feature/F006-personal-finance
- `510e7b237ce8` 2026-09-22: Implement personal finance and document upcoming features
- `81167465621d` 2026-09-22: Merge pull request #3 from hjadon-ai/feature/F005-daily-diet-tracking
- `6327bcb6aaf0` 2026-09-22: Add ChatGPT brainstorming project context
- `af878c718c21` 2026-09-22: Implement daily diet tracking
- `cab02f5f39ec` 2026-09-16: Merge pull request #2 from hjadon-ai/feature/F004-forgot-password
- `1dadd602f8b3` 2026-09-16: Implement forgot password flow
- `1efa3a2e877d` 2026-09-16: Merge pull request #1 from hjadon-ai/feature/F003-signup-email-verification
- `6022cf5dba95` 2026-09-16: Implement signup email verification
- `35844c458c72` 2026-09-16: Initial local project baseline

## Optional working-tree evidence

Not requested; uncommitted work excluded.

## Codex interpretation and claim review

Edit claims in packet.json, then run render. Markdown is a presentation; packet.json is authoritative. Approval requires exact approved wording.

### C01: Full-stack personal workspace

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `server/src/app.js`; `web/src/App.jsx`; `docs/features/README.md`
**What changed:** Initial committed baseline includes authentication, Diet, Finance, Priorities, Family, Chat, and Admin; not a delta from an earlier review.
**Demonstrated skill:** Full-stack delivery; API design; domain decomposition
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Designed and developed Astitva, an independent personal and family workspace spanning React, Express, MongoDB, and Firebase.
**Qualifications:** Overview/public project content is partly placeholder. Feature status is not deployment proof. F032 is excluded. Native iOS is outside this collector.
**Review status:** Approved
**Approved wording:** Designed and developed Astitva, an independent personal and family workspace spanning React, Express, MongoDB, and Firebase.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

### C02: Financial integration and credential boundaries

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `server/src/services/finance/PlaidFinanceProvider.js`; `server/src/services/finance/syncFinance.js`; `server/src/services/finance/tokenEncryption.js`; `server/src/models/Finance.js`
**What changed:** Baseline implements a Plaid adapter, normalized persistence, synchronization, and encrypted provider tokens.
**Demonstrated skill:** Solution architecture; integration engineering; data modeling; security-aware development
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Integrated Plaid account synchronization with normalized financial data, encrypted provider tokens, and isolated runtime environments.
**Qualifications:** No claims about live bank linking, financial accuracy certification, payments, usage, or regulatory compliance. Tokens encrypted at rest by this implementation; not all application data.
**Review status:** Approved
**Approved wording:** Integrated Plaid account synchronization with normalized financial data, encrypted provider tokens, and isolated runtime environments.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

### C03: Atomic per-day priority limits

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `server/src/routes/priorities.js:42`; `server/src/models/DailyPriorityDay.js`; `server/test/priorities.integration.test.js`
**What changed:** Baseline uses owner/date initialization and an atomic capacity predicate for a maximum of three embedded priorities.
**Demonstrated skill:** Concurrency handling; MongoDB invariants; calendar-aware API design
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Implemented owner-scoped daily priorities with atomic capacity enforcement and calendar-aware validation.
**Qualifications:** Test file presence demonstrates planned coverage, not a current passing result. No cross-database transaction or broad scale claim.
**Review status:** Approved
**Approved wording:** Implemented owner-scoped daily priorities with atomic capacity enforcement and calendar-aware validation.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

### C04: PIN-authorized real-time chat

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `server/src/routes/chat.js:37`; `firestore.rules`; `web/src/firestoreChat.js`; `docs/features/chat/F029-firestore-chat-messages.md`
**What changed:** Baseline separates MongoDB control data and server PIN/grant authorization from direct Firestore message delivery.
**Demonstrated skill:** Solution architecture; security boundaries; real-time client integration
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Implemented alias-based, PIN-protected chat using server-controlled authorization, Firebase custom tokens, and live Firestore delivery.
**Qualifications:** Alias anonymity only; not end-to-end encryption or operator anonymity. Committed baseline retains direct writes and retired REST message routes. Notifications are excluded.
**Review status:** Approved
**Approved wording:** Implemented alias-based, PIN-protected chat using server-controlled authorization, Firebase custom tokens, and live Firestore delivery.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

### C05: Human-directed agent workflow

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `AGENTS.md`; `docs/features/WORKFLOW.md`; `docs/features/FEATURE_TEMPLATE.md`; `chatgpt-project/PROJECT_INSTRUCTIONS.md`
**What changed:** Baseline records proposal/approval instructions, architecture decisions, acceptance criteria, and local review/delivery boundaries.
**Demonstrated skill:** AI-Augmented Engineering; Prompt/Context Engineering; Codex-assisted development
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Established a specification-driven Codex workflow using scoped repository context, approved feature designs, acceptance criteria, API contracts, and human review controls.
**Qualifications:** Explicit instructions support workflow design; they do not prove every change followed it or identify AI-generated lines. Copilot certification/usage is owner-supplied and not inferred from code. No autonomous-build or productivity claims.
**Review status:** Approved
**Approved wording:** Established a specification-driven Codex workflow using scoped repository context, approved feature designs, acceptance criteria, API contracts, and human review controls.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

### C06: Family graph and explicit sharing

Source commit: `7b68364becd8a8de7415f2450c67bb26051d8932`
Evidence: `server/src/routes/family.js`; `server/src/models/Family.js`; `web/src/Family.jsx`; `docs/features/family/F015-family-sharing-overview.md`
**What changed:** Baseline includes relationship modeling, member roles, invitation linking, and explicit Diet/Finance sharing.
**Demonstrated skill:** Permission modeling; domain graph design; cross-domain authorization
**Implementation:** Supported by committed source; source inspection, not runtime verification
**Verification:** Unknown for this snapshot. Historical verification notes are not re-executed results.
**Deployment:** Unknown. Hosting configuration and merges do not establish current production availability.
**Proposed public wording:** Designed family relationship and role models with explicit, owner-controlled sharing of Diet and Finance data.
**Qualifications:** Family social feed/chat and richer profiles remain proposals. Astitva is a personal project; do not attribute team-management experience to it.
**Review status:** Approved
**Approved wording:** Designed family relationship and role models with explicit, owner-controlled sharing of Diet and Finance data.
**Review notes:** Owner approved all Cxx claims with their proposed wording in this conversation.

## Manual review

Approve exact wording, revise, or reject every claim. Complete review explicitly only when every claim is Approved or Rejected. Approval permits portfolio preparation, not publication.
