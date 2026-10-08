# F028: Family-focused home pages

- **Status:** Review
- **Priority:** Medium
- **Depends on:** F005, F006, F009, F011, F018
- **Branch:** `feature/F028-family-focused-home-pages`
- **Pull request:** Not created

## Goal

Present Astitva as a private family application and make Home a clear starting point for family connection and everyday management. Replace portfolio placeholders and invented metrics with accurate, permission-aware navigation. This revised proposal excludes Anonymous Chat entirely.

## User flow

1. A visitor sees a concise family-focused introduction, existing Login/Signup/Forgot password controls, and an explanation of membership and explicit sharing.
2. An authenticated verified member lands on Home with their name, a prominent Family entry and shortcuts only to enabled existing features.
3. They open Family to manage members and invitations, or open an enabled personal feature. They can return Home through existing navigation.
4. Someone with Family disabled sees permitted personal destinations rather than a misleading family-access action. A member with no enabled destinations sees a useful account/access explanation.

## In scope

- Public positioning: “A private space for your family” with honest descriptions of family relationships, invitation acceptance, and optional sharing; no claims that a social feed is already available.
- Preserve existing authentication, verification, password-reset and invitation-aware signup flows. Explain Production invitation requirements using supported runtime information; do not assume all environments require invitations.
- Signed-in Home: greeting and existing account information; Family is the primary destination when enabled. Use “Open Family” rather than inventing family names, member counts or invitations without a data source.
- Secondary shortcuts for enabled Priorities, Diet and Finance. Show Finance availability honestly using runtime capability information; never link to a disabled feature.
- Remove “Projects will live here”, sample project cards, biography placeholders, “2 projects”, “25% profile” and the sample workspace card.
- Keep existing shell, semantic UI tokens, session/account controls and web/server version display. Cards stack on mobile and use accessible labels/focus.
- No feed/composer placeholder controls. Home establishes a family-social visual direction without presenting unimplemented functionality.

## Out of scope

- Anonymous Chat promotion, cards, summaries, links or implementation changes. Existing Chat functionality elsewhere is untouched.
- Posts, photos, reactions, comments, announcements, moderation and feed APIs: owned by F023.
- Family member selection/profile viewing: owned by F034; family-detail editing remains F020.
- New personal-feature behavior, Notes, fabricated counts, analytics or live summaries.
- Changes to authentication, feature grants, family roles, invitation rules, sharing permissions or Finance/provider behavior.
- Public family/member data, public profiles, a portfolio or a separate dashboard service.

## Wireframe or UI changes

```text
PUBLIC
Astitva                              [About families] [Login]
A private space for your family      [Existing auth panel]
Manage relationships and choose      Login / Signup / Forgot password
what you share.
[Family connections] [Everyday management] [Your privacy]
Invitation explanation where applicable
Web/server versions

SIGNED IN
Home                                 [Existing account control]
Welcome, <name>
[Your family                         Open Family]  (if enabled)
Your everyday tools
[Priorities*] [Diet*] [Finance*]
* Only enabled features; Finance unavailable state when appropriate.
Web/server versions
```

Keep the existing profile card/template where useful, with real account information only. Replace global public Work/About portfolio anchors with family-oriented anchors whose targets exist. Do not change existing sidebar navigation or remove Chat access elsewhere. When Family is disabled, omit its card; when no tools are enabled, explain that access is managed by the application administrator without promising a new request-access workflow.

## API changes

None. Reuse existing session `user.features`, account fields and safe `/api/health` runtime metadata. This phase fetches no family records or private summaries solely to populate Home. A future embedded F023 feed requires a separately reviewed integration step; it is not an implicit part of this proposal.

## MongoDB changes

None.

## Architecture decisions

- Keep React/Vite, existing AppShell and shared UI components; limit implementation to home-page presentation and permitted navigation.
- Family is the primary product direction, but actual access derives from existing server-provided feature eligibility. UI filtering grants no permissions; destination APIs retain authorization.
- F023 owns social behavior. F028 does not duplicate its scope and does not depend on F023 because it does not render a feed.
- F020/F034 are linked product direction, not dependencies for these static home pages. Do not imply those capabilities are released before their own review.
- Priorities, Diet and Finance remain personal unless explicitly shared through existing Family rules. Membership or an ADMIN/EDITOR role never automatically exposes another member's data.

## Acceptance criteria

- Public Home describes a private family application and retains working login, signup and password-reset entry points.
- Copy accurately distinguishes invitations, acceptance and explicit data sharing; no private family data is rendered publicly.
- Verified signed-in Home gives enabled Family a prominent working destination; Family-disabled accounts see no enabled Family action.
- Personal shortcut visibility follows `user.features`; Finance also respects runtime availability. Missing metadata does not invent access.
- Public and signed-in Home contain no portfolio placeholders, invented statistics, dummy posts or nonfunctional social controls.
- No Anonymous Chat entry is introduced on either Home; existing Chat behavior/navigation outside Home is unchanged.
- No new API/database changes or private summary fetches occur. Existing destination authorization remains in effect.
- Authentication, verification, invitation-aware signup, session controls and version display still work.
- Keyboard navigation and 320px mobile layouts work without horizontal overflow; actual empty/unavailable states are readable.

## Local verification

Proposal only; no implementation or tests performed for this revision. After approval, run the web build and proportionate visibility/navigation tests with synthetic sessions (Family enabled/disabled, mixed grants, no grants) and Finance runtime states. Inspect public and signed-in Home in Dev/Stage at desktop/mobile widths and with keyboard navigation. Verify login/signup/reset and version display, with no private records used for visual fixtures.

## Revision and approval history

The previous scope was Approved and reconfirmed at 2026-10-06T07:05:22Z. Its approval does not authorize this changed scope. Priority remains Medium planning metadata; current approvedAt is intentionally absent until the owner explicitly approves this revision. This proposal preserves the earlier owner direction below and changes no implementation.

## Owner decisions

### 1. Should the signed-in Home remain a set of shortcuts, or show small live summaries for Priorities, Diet, Finance, and Family in a later step?

> Going forward will use signed-in Home page as a very basic social media home page.

### 2. Should the public page explain that signup may require an invitation in Production, and where should that message appear?

> Yes, this is going to be family social application for better management

## Approval comment

> Treat Astitva as Social site for family members and will expand gradually.

## Approval reconfirmation

Owner reconfirmed existing approved scope on 2026-10-06T07:05:22Z. Priorities are current planning metadata and may change without changing scope.


## Owner decisions

### 1. Approve this small first milestone: family-focused Home/navigation now, with the actual social feed implemented through F023 separately?

> F023 is implemented and marked as Done.

### 2. Confirm keeping enabled Priorities, Diet and Finance as secondary Home shortcuts, with Family as the primary destination?

> Yes

## Approval comment

> The Home page should have some animated diagrams or images. Visitor should be able to understand purpose of the application and should feel attracted.

## Implementation verification

Implemented locally on `feature/F028-family-focused-home-pages`, following the revised owner-approved scope and animated-illustration comment. Public Home presents family connections, everyday management and explicit sharing. Signed-in Home uses a primary enabled Family card and permitted personal shortcuts; Finance requires confirmed runtime availability to provide an action. Missing feature metadata grants no Home access. Existing authentication components, session transport, global navigation, Chat outside Home and version footer are preserved; no new API/database operations were added.

All seven web tests pass, including enabled/missing/disabled feature and Finance availability cases. Web build and changed-file whitespace checks pass; bundle-size warning remains. Synthetic public and signed-in layouts were inspected at 1440×900 and 320×844, with no horizontal overflow or browser console errors. Keyboard Open Family navigation and no-access/Finance-disabled states were checked. Illustration uses a brief non-looping entrance animation and a reduced-motion CSS fallback. Actual account login/signup/reset submission and production hosting were not retested; authentication components were preserved. Stage health was verified; Vite serves the local changes.

Ready for manual owner review at http://localhost:3000. No commits, pushes, PRs, merges or deployments performed. Only the owner may mark Done.

## Owner-supplied artwork update

Integrated four supplied generated images as descriptively named responsive WebP assets under `web/public/images/home/`, with proportions preserved and originals untouched. Hero: family-together; family cards: family-connections; everyday section: family-everyday; future-vision section: family-vision. Embedded feature claims in the final concept are clearly qualified as future ideas. Responsive intrinsic sizes, image descriptions, eager hero and lazy below-fold images are included. No user uploads, backend or storage architecture changes.
