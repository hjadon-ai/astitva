# F052: Admin architecture and security

- **Status:** Review
- **Branch:** `feature/F052-admin-architecture`
- **Pull request:** Not created

## Approved scope

Owner approved a secured Settings > Admin architecture page with an interactive icon diagram, API/user/MCP security details, GitHub/Render/Firebase configuration explanations, benefits, limitations and recommendations. Static server-side reference only; never expose live configuration, secret values or user data. Base includes F051 MCP creation and scope fixes.

## Verification

Server suite: 67 passed, 12 unrelated opt-in tests skipped. Dedicated isolated-database Admin test passed: missing/expired session, unverified/non-Admin denial, successful Admin response, no-store and no live secret/user values. Web tests: 32 passed; production build passed with existing bundle-size warning; whitespace check passed. Native/browser automation is unavailable in this environment, so authenticated visual/mobile review remains for the owner. No provider configuration was changed; recommendations are informational.

## Owner review

Open Settings > Admin > Architecture & Security. Check the five diagram flow filters, text equivalent, expandable controls, configuration table, mobile horizontal scrolling and existing Day/Night appearances. Endpoint is `/api/admin/architecture`, protected by the existing server Admin middleware. Only the owner can mark Done after manual review/merge. No commit, push or deployment performed.

## Scroll preservation follow-up

Stabilized the App session-expiry callback with useCallback. Minute/focus account refreshes previously changed that callback identity, retriggering Architecture loading and collapsing the page. Background account checks now preserve the architecture content, expanded sections, diagram selection and scroll position. Session expiry handling remains active. Web tests and build pass.

## Local consolidation

Owner requested bringing the architecture page alongside F053 in the main workspace on feature/F053-nutrition-range-report. F052 remains Review; its original branch is preserved. Postman uses the saved login cookie by default. No main/PR merge performed.
