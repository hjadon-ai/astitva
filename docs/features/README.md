# Feature index

This file is the current list of Astitva features.

For copyable prompts and the review-to-merge cycle, see [Efficient feature workflow](WORKFLOW.md).

## Status flow

`Proposed → Approved → In Progress → Review → Done`

## Features

| ID | Feature | Status | Branch | Pull request |
| --- | --- | --- | --- | --- |
| F001 | [Local authentication](auth/F001-local-authentication.md) | Done | Not created | Not created |
| F002 | [Local profile page](profile/F002-local-profile-page.md) | Done | Not created | Not created |
| F003 | [Signup email verification](auth/F003-signup-email-verification.md) | Done | `feature/F003-signup-email-verification` | Not created |
| F004 | [Forgot password](auth/F004-forgot-password.md) | Done | `feature/F004-forgot-password` | Not created |
| F005 | [Daily diet tracking](diet/F005-daily-diet-tracking.md) | Done | `feature/F005-daily-diet-tracking` | Not created |
| F006 | [Personal finance](finance/F006-personal-finance.md) | Done | `feature/F006-personal-finance` | Not created |
| F007 | [Local Stage environment](infra/F007-local-stage-environment.md) | Done | `feature/F007-local-stage-environment` | Not created |
| F008 | [Diet targets and Meal Library](diet/F008-diet-targets-and-meal-library.md) | Done | `feature/F008-diet-targets-meal-library` | Not created |
| F009 | [Daily Priorities](priorities/F009-daily-priorities.md) | Done | `feature/F009-daily-priorities` | Not created |
| F010 | [Quick Notes](notes/F010-quick-notes.md) | Approved | Not created | Not created |
| F011 | [Application visual system](ui/F011-application-visual-system.md) | Done | `feature/F011-application-visual-system` | Not created |
| F012 | [Cloud production environment](infra/F012-cloud-production-environment.md) | Done | `feature/F012-cloud-production-environment` | Not created |
| F014 | [Family directory search](family/F014-family-directory.md) | Done | `feature/consolidate-pending-changes` | Not created |
| F015 | [Family sharing overview](family/F015-family-sharing-overview.md) | Done | `feature/consolidate-pending-changes` | Not created |
| F016 | [Family activity history](family/F016-family-activity-history.md) | Done | `feature/consolidate-pending-changes` | Not created |
| F017 | [Family relationship corrections](family/F017-family-relationship-corrections.md) | Proposed | Not created | Not created |
| F018 | [Family members](family/F018-family-members.md) | Done | Not created | Not created |
| F019 | [Manage family invitations](family/F019-family-invitation-management.md) | Approved | Not created | Not created |
| F020 | [Family member profiles](family/F020-family-member-profiles.md) | Proposed | Not created | Not created |
| F021 | [Leave an accepted family](family/F021-leave-family.md) | Proposed | Not created | Not created |
| F022 | [Export the family directory](family/F022-export-family-directory.md) | Proposed | Not created | Not created |
| F023 | [Family Social feed](familysocial/F023.md) | Proposed | Not created | Not created |
| F024 | [Family chat and notifications](familysocial/F024.md) | Proposed | Not created | Not created |
| F027 | [Anonymous chat with PIN protection](chat/F027.md) | Done | Not created | Not created |
| F028 | [Relevant home pages](ui/F028-relevant-home-pages.md) | Approved | Not created | Not created |
| F029 | [Firestore storage and live delivery for anonymous chat messages](chat/F029-firestore-chat-messages.md) | Done | `feature/changes_03-Oct-2026` | Not created |
| F030 | [Compact Anonymous Chat layout](ui/F030-compact-anonymous-chat-layout.md) | Done | `feature/changes_03-Oct-2026` | Not created |

## Rules

- Create a feature document from `FEATURE_TEMPLATE.md` before implementation.
- Store infrastructure and deployment feature documents in `infra/`.
- The project owner approves scope and architecture decisions.
- When the owner asks to implement a feature, complete the implementation and mark its document and index row **Done** in the same work. Keep approved but unimplemented features **Approved**.
- Record the same active work branch for features implemented together. Create the next branch only after the current branch is merged into `main`.
- Keep feature branch name as feature/{date}-A, keep commit message with Fxx implemented 
- Update this table when a status, branch, or pull request changes.
- Do not push or create a pull request without explicit approval.
