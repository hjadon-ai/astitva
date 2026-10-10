# Feature index

This file is the current list of Astitva features.

For copyable prompts and the review-to-merge workflow, see [Efficient feature workflow](WORKFLOW.md).

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
| F020 | [Family member profiles](family/F020-family-member-profiles.md) | Review | `feature/F020-family-member-profiles` | Not created |
| F021 | [Leave an accepted family](family/F021-leave-family.md) | Proposed | Not created | Not created |
| F022 | [Export the family directory](family/F022-export-family-directory.md) | Proposed | Not created | Not created |
| F023 | [Family Social feed](familysocial/F023.md) | Done | `feature/F023-family-social-feed` | Not created |
| F024 | [Family chat and notifications](familysocial/F024.md) | Proposed | Not created | Not created |
| F027 | [Anonymous chat with PIN protection](chat/F027.md) | Done | Not created | Not created |
| F028 | [Family-focused home pages](ui/F028-relevant-home-pages.md) | Review | `feature/F028-family-focused-home-pages` | Not created |
| F029 | [Firestore storage and live delivery for anonymous chat messages](chat/F029-firestore-chat-messages.md) | Done | `feature/changes_03-Oct-2026` | Not created |
| F030 | [Compact Anonymous Chat layout](ui/F030-compact-anonymous-chat-layout.md) | Done | `feature/changes_03-Oct-2026` | Not created |
| F031 | [Admin Panel](admin/F031-admin-panel.md) | Done | `feature/changes_04-Oct-2026` | Not created |
| F032 | [Private Anonymous Chat push notifications](chat/F032-private-chat-push-notifications.md) | Done | `feature/changes_04-Oct-2026_2` | Not created |
| F033 | [AI-assisted development foundation and Development Control Center](infra/F033-ai-assisted-development-foundation.md) | Done | `feature/F033-ai-assisted-development-foundation` | Not created |

| F034 | [Shared family-member workspace](family/F034-family-member-profile-view.md) | Review | `feature/F034-shared-family-member-workspace` | Not created |

| F035 | [Shared family units and consent-based linking](family/F035-shared-family-units.md) | Review | `feature/F035-shared-family-units` | Not created |

| F036 | [Managed NON_USER workspaces](family/F036-managed-non-user-workspaces.md) | Review | `feature/F036-managed-non-user-workspaces` | Not created |

| F037 | [Named shared meal libraries](diet/F037-shared-meal-libraries.md) | Review | `feature/F037-shared-meal-libraries` | Not created |

| F038 | [Body & Goals](diet/F038-body-goals.md) | Review | `feature/F038-body-goals` | Not created |

| F039 | [Optional Immersive appearance](ui/F039-immersive-appearance.md) | Review | `feature/F039-immersive-appearance` | Not created |

## Rules

- Create a feature document from `FEATURE_TEMPLATE.md` before implementation.
- Store infrastructure and deployment feature documents in `infra/`.
- The project owner approves scope and architecture decisions.
- Implement only explicitly Approved scope. Mark work In Progress while implementing and Review when ready for owner review. Only the owner may move Review to Done by confirmation after manual review/merge. Preserve historical Done records.
- Implement one feature at a time on `feature/F###-short-name`; resume interrupted work on its existing feature branch. Preserve historical branch names.
- No shared daily or cycle implementation branches.
- Update this table when a status, branch, or pull request changes.
- Do not push or create a pull request without explicit approval.
