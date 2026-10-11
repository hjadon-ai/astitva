# F044: Unified Settings panel

- **Status:** Review
- **Branch:** `feature/F044-unified-settings`
- **Pull request:** Not created

## Goal and approval

Owner approved implementing a single Settings destination containing Appearance, Connections and Admin, leaving Anonymous Chat separate. Frontend layout/navigation only; backend contracts and authorization remain unchanged.

## Scope

Settings is available to signed-in users. Appearance uses the existing browser preferences/provider. Connections requires both Diet and MCP; Admin requires isAdmin. Reuse existing content without nested application shells or repeated headings. Preserve legacy Admin and MCP consent links, independent section links, keyboard navigation and mobile layout.

## Acceptance and verification

Verify section access and deep-link resolution, existing appearance preferences, web tests/build, and manual responsive/keyboard review. No changes to backend, Chat or access flags. No push or deployment authorized.

Verification: all 29 web tests and the production build passed; existing large-bundle warning remains. `git diff --check` passed. Local Chrome review confirmed legacy /admin opens Settings → Admin, Appearance renders inline with existing saved selections, Connections loads existing grants, and Anonymous Chat remains a separate sidebar entry. The content panel was visually checked in Immersive Day. Mobile and keyboard walkthrough remain owner review checks. No backend files, account permissions or appearance preferences were changed. No commits, pushes or deployment.
