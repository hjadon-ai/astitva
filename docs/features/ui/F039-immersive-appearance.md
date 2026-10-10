# F039: Optional Immersive appearance

- **Status:** Review
- **Branch:** `feature/F039-immersive-appearance`
- **Pull request:** Not created

## Goal

Offer a premium scenic Immersive layout with distinct Day and Night themes while preserving the current Original layout. Users can change appearance immediately without losing their page, drafts, data, or active workspace.

## User flow

1. Open Appearance from the application shell. The default for existing and new browsers is Original; the initial remembered Immersive theme is Day, with Night available as the second choice.
2. Choose Original or Immersive. Apply immediately without navigation, reload, or remounting the current feature.
3. In Immersive, choose Day or Night. Remember both preferences in browser localStorage.
4. In Original, disable the theme controls with an explanation that themes apply only to Immersive. Retain the remembered theme for the next switch.
5. Refresh or reopen the application to restore appearance. Preferences are browser-local, independent of account and workspace permissions.

## In scope

- Two independent preferences: layout and remembered Immersive theme.
- Scoped design tokens, reusable presentation components, scenic assets, responsive shell, and gradual adaptation of existing pages.
- Real existing content, navigation destinations, permissions, forms, charts, and interactions.
- Local implementation and review only, in separately approved phases below.

## Out of scope

- New product workflows, family relationships, charts, or functionality merely depicted in the references.
- Sample people, names, photographs, relationships, and reference-image text.
- Original Day/Night themes, account-synced preferences, automatic system-theme selection, new frameworks, external services, or server changes.
- Deployment, branch creation, commits, pushes, or pull requests at this proposal stage.

## Wireframe or UI changes

```text
Application shell                 [Appearance]
                                  ┌─────────────────────────┐
                                  │ Appearance              │
                                  │ Layout                  │
                                  │ (●) Original ( ) Immersive
                                  │ Immersive theme         │
                                  │ ( ) Day      (●) Night  │
                                  │ Available in Immersive  │
                                  └─────────────────────────┘

Immersive desktop
┌───────────────┬────────────────────────────────────────────┐
│ Brand         │ Current page / workspace     [Appearance] │
│ Existing      ├────────────────────────────────────────────┤
│ navigation    │ Existing page content in readable panels  │
│               │ Scenic background visible around content │
│ Account       │ Existing dialogs and actions              │
└───────────────┴────────────────────────────────────────────┘

Mobile
┌──────────────────────────────────────┐
│ Menu  Page title        Appearance   │
│ Existing content, stacked as needed  │
│ Navigation opens existing drawer     │
└──────────────────────────────────────┘
```

### Original and Immersive behavior

Original retains current navigation, spacing, colors, layout, and workflows. The proposed small Appearance entry point is the sole intentional addition to its UI and requires approval. Immersive changes presentation using the same mounted feature components, route, selected workspace, and business state. Switching must preserve unsaved fields, selected tabs, dialogs, and in-flight operations; normal layout reflow must keep the user's active control visible.

Unadapted pages remain in readable compatibility surfaces until their page adaptation is approved. No dark scenery may leave legacy text or forms unreadable. Feature permission gates and the existing expanded desktop sidebar/mobile drawer behavior remain intact.

### Visual direction

The three supplied October 9 images are visual references only. Use the bright lake/mountain/garden image for Day and the midnight landscape/glowing-tree images for Night. Do not use a dashboard screenshot as a background or reproduce its invented features.

- **Day:** blue sky, natural greens, gentle lavender/pink atmosphere, translucent light panels, soft shadows, and restrained colorful accents. Use a separate daytime scenic asset rather than whitening the Night image.
- **Night:** midnight blue scenery, lavender/pink atmospheric highlights, dark glass panels, subtle illuminated borders and shadows. Keep glow away from dense text and data.
- Use existing typography initially with consistent hierarchy; avoid remote fonts. Retain Lucide icons with semantic color accents and visible labels for important actions.
- Render real available profile photos in circular frames; use existing initials when no photo exists. Decorative rings must not imply roles or permissions unless those meanings already exist.
- Family may expose more scenery; Finance uses quieter opaque chart/table surfaces; Diet uses legible progress summaries; Profile uses calm form panels. Preserve all existing workflows and supported views.

### Proposed tokens

These are starting values, subject to measured contrast and local visual review, not a claim of verified contrast.

| Semantic token | Immersive Day | Immersive Night |
| --- | --- | --- |
| Canvas fallback | `#EAF3FC` | `#071126` |
| Strong surface | `#F8FBFF` | `#101B35` |
| Glass surface | `rgba(248,251,255,.90)` | `rgba(12,22,48,.90)` |
| Primary text | `#13213B` | `#F3F1FF` |
| Secondary text | `#425574` | `#B8C3DF` |
| Primary action | `#5A46C8` | `#B9A4FF` |
| Text on primary | `#FFFFFF` | `#12162C` |
| Decorative pink | `#DB72B7` | `#ED9BDF` |
| Focus ring | `#4836A8` | `#C5B7FF` |

Add semantic border, scrim, hover, selected, disabled, success, warning, and error tokens; retain textual/status cues alongside color. Use a 4/8px spacing scale, approximately 12px control and 20px panel radii, restrained elevation, and 120–180ms interaction transitions. Dense forms and tables favor strong surfaces over glass. Decorative accent colors are not automatically suitable for text.

## API changes

None. Existing REST paths, payloads, authentication, authorization, and server behavior remain unchanged.

## MongoDB changes

None. Appearance is browser-local and introduces no collections, fields, migrations, or stored user data.

## Architecture decisions

Proposed for owner approval:

1. Keep React/Vite, Express, MongoDB, existing routing, and dependencies. Add a small AppearanceProvider above App in `web/src/main.jsx`; feature components continue owning their business state and API calls.
2. Use a versioned localStorage key, proposed `astitva.appearance.v1`, containing only validated `layout: original|immersive` and `theme: day|night`. Invalid/missing values fall back safely. Storage failures retain functional in-memory switching.
3. Apply appearance attributes to `document.documentElement` so body-mounted dialog portals inherit the same theme. Scope new rules to Immersive attributes; keep legacy root tokens and Original selectors unchanged. Load a dedicated Immersive stylesheet after existing styles and bridge existing semantic variables only within that scope. Audit hardcoded feature colors rather than assuming token replacement covers every component.
4. Extend `AppShell` and existing shared UI in `web/src/ui/index.jsx`, retaining DOM/component identity wherever possible. Do not key trees by appearance or render separate copies of feature pages. Presentation components accept content/state/callbacks and contain no business API logic.
5. Reuse primitives for AppearanceControl, scenic decoration, surfaces, page headings, buttons, fields, navigation states, and avatar frames. Extend current components before introducing duplicate variants. Keep existing page-specific layouts and chart behavior.
6. Prefer a shell Appearance popover over introducing a new Settings workflow. Desktop placement should fit existing shell/workspace controls; mobile placement must leave room for navigation and page titles. Original gains only the approved entry point.

Scoped overrides reduce risk to Original but require explicit coverage of legacy hardcoded colors and portal layers. A single mounted tree protects drafts but constrains structural differences between layouts. Bounded translucency sacrifices some reference-image transparency to protect contrast and performance.

### Asset strategy

- Create or select clean decorative landscapes with no interface, text, people, or controls. Use newly generated clean landscapes as the recommended asset approach, approved by the owner. Review the actual assets locally during the relevant phase; no asset generation occurs during proposal approval.
- Store optimized assets locally; use separate Day/Night and suitable mobile crops, AVIF/WebP with a CSS gradient fallback. Scenery is decorative, noninteractive, and hidden from assistive technology.
- Fetch only the selected Immersive scenery; Original must not download it. Use a stable fallback and avoid background-driven layout shifts.
- Proposed budgets: at most 300KB per desktop scenic asset, 150KB per mobile asset, and 400KB of initial selected-theme decoration. Verify actual transfer sizes during implementation and revise only through review.
- Avoid video, canvas scenery, animated particles, parallax, and full-screen continuously animated blur. Limit static blur to bounded panels; use stronger surfaces when backdrop filtering is unavailable.

### Responsive, accessibility, and performance requirements

- Desktop preserves expanded navigation. Tablet adjusts panel density; mobile retains the drawer, stacks cards, and keeps dense tables scrollable without page-level overflow. Preserve useful chart labels and touch targets of at least 44px for primary controls.
- Use labeled radio groups and keyboard-operable Appearance controls; preserve focus through changes, support Escape and return focus when closing popovers/drawers. Do not trap keyboard users behind decorative layers.
- Measure WCAG AA contrast: 4.5:1 normal text, 3:1 large text and essential UI boundaries. Check glass against the actual scenic image, with opaque fallback/scrims as needed.
- Honor `prefers-reduced-motion` for new transitions and existing motion encountered during adaptation. No automatic scenic motion or flashing glow.
- Keep UI functional before images finish loading and with images blocked. Check local build output and image/network costs; add no external runtime requests or unnecessary dependencies.

## Incremental implementation plan

Approval of this proposal does not automatically authorize all phases. Record explicitly approved phase scope before code changes; implement one approved phase at a time, review locally, then obtain approval for the next phase. Use the required F039 feature branch only after implementation authorization; preserve other feature work.

| Phase | Deliverables | Dependency / review gate |
| --- | --- | --- |
| 1 — Foundation | Preference provider/persistence, appearance controls, scoped Day/Night tokens, reusable visual primitives, fallback and compatibility surfaces | Approve architecture, defaults, entry point, and asset approach. Review both themes and Original isolation locally; this is not a completed application-wide redesign. |
| 2 — Common shell | Immersive sidebar/header/drawer, scenic background, shared actions/forms/dialog styling, responsive and keyboard behavior | Phase 1 reviewed; separately approve shell scope. Verify every reachable existing page remains readable even before page-specific adaptation. |
| 3 — Feature adaptation | Suggested order: Family, Profile, Diet & Nutrition, Finances, then remaining enabled pages; adapt presentation only | Phase 2 reviewed; approve each page or explicit page batch before implementation. Review real-data states, permissions, forms, charts, empty/error/loading states, and Original parity for each. |

The order is a proposal, not authorization. Mark the feature In Progress when approved implementation begins, Review when approved work is ready for owner review, and never mark Done without owner confirmation. Track remaining phase scope in this document so partial review cannot imply the full feature is complete.

## Acceptance criteria

- Original matches its pre-change baseline apart from the approved Appearance entry point, regardless of remembered theme.
- Layout and theme switches apply immediately without reload, route/workspace changes, or loss of drafts, tabs, open dialogs, and active operations.
- Original → Immersive restores the remembered Day/Night choice; refresh/reopen restores valid preferences. Missing, invalid, and unavailable storage do not break the app.
- Both themes have distinct scenic treatment and consistent readable components; all interactive UI remains real React/HTML rather than a screenshot.
- No reference sample content enters the application. Actual photos/initials, permissions, and user data remain authoritative.
- Approved surfaces work at desktop, tablet, and mobile widths, with keyboard navigation, focus visibility, measured contrast, and reduced motion.
- Body-mounted dialogs and shared/managed workspaces use the selected appearance correctly without changing access or data behavior.
- Unadapted pages remain usable; adapted pages cover loading, empty, error, populated, editable, and read-only states where applicable.
- Original fetches no scenic assets; selected-theme assets meet approved budgets and require no external service.
- No REST, authentication, MongoDB, framework, or feature workflow changes occur.
- Each phase meets its local review gate before subsequent implementation begins.

## Local verification

### GPT-6 review and refinement

At the owner's explicit request, a GPT-6 agent performed a read-only code review and a follow-up review of the fixes. Findings: repeated shell/page headings, excessive stacked panel chrome, loss of focus when the Appearance opener becomes hidden in Original, hardcoded light Family danger styles in Night, translucent Finance data sections, residual Diet focus/icon styling, tall Family cards, and weak Home composition.

Implemented a compact utility rail, one shell title on mobile, larger scenic gutters, clearer page-heading hierarchy and a Lucide floral brand accent. Home now gives the existing Family card prominence beside a compact account summary when Family access exists; tools adapt to the number of enabled destinations and stack on smaller screens. Family cards use compact horizontal circular-initial frames with space for existing menus/forms, including narrower mobile spacing. Finance data sections are opaque. Night danger styling uses semantic tokens, Diet focus/markers are themed consistently, and Appearance close restores focus to a visible shell control when its opener was hidden by a layout switch.

Original styling, product content, feature gates, callbacks, API contracts and business state remain unchanged. The follow-up review identified a Diet selector-order conflict, which was corrected, and a narrow Family layout edge, addressed with smaller frames/gaps while retaining 44px action targets. Build and all 23 web tests passed; `git diff --check` passed. Review was based on code evidence, not browser screenshots. Actual visual, focus and responsive verification remains for owner local review because browser UI access was unavailable. No commits, pushes or deployments.

### Phase 3 — Remaining pages / final implementation review

On October 10, 2026, the owner explicitly authorized completing the remaining Phase 3 pages. Implemented scoped Immersive semantic-token bridges and page styling for Profile/Home, Diet & Nutrition (Daily Record, Trends, Body & Goals), Finances, Priorities, Chat, Admin, shared/managed workspaces, and their shared dialogs. All routes now leave the earlier light compatibility backdrop in Immersive. Day/Night panels, fields, buttons, status messages, empty/loading states and menus share the same palette; Finance emphasizes readable data surfaces, Diet retains colorful progress indicators, and Chat distinguishes sent/received messages without changing its privacy behavior.

Diet-specific coverage includes the meal browser, meal library drawer/wizard/review states, history inspection, daily weight controls, Body & Goals results and weight predictions. Chart labels/series use scoped theme variables with their original color values as fallbacks. Original and unauthenticated/public flows retain existing styling. Existing callbacks, feature permissions, route selection, drafts and API/data contracts are unchanged. No new dependencies, server changes, external asset services or feature workflows were added.

Final automated validation: `npm --prefix web run build` passed with the existing large-chunk warning; `npm --prefix web test` passed all 23 tests, including preference storage, scenic asset budgets, Day/Night contrast for text/status/metric colors, Family labels, and existing feature logic checks. `git diff --check` passed. Browser UI access was attempted again and returned no browsers/native startup failure. Automated tests do not establish browser layout, keyboard behavior, image request selection or draft retention; these remain explicit owner review items.

Implementation of the approved three phases is ready for owner review. Test Original, Immersive Day and Immersive Night across enabled pages at desktop/tablet/mobile widths; open portal dialogs and drawers; inspect charts, tables, errors and empty states; retain drafts while switching; refresh; and verify sign-out restores the public Original appearance. No commits, pushes or deployments. The feature remains Review until the owner confirms completion.

### Phase 3 — Family review

Owner authorized Phase 3 beginning with the proposed Family page adaptation. The Family compatibility backdrop is now transparent in Immersive, exposing the existing scenic shell around readable Day/Night surfaces. Existing Roots/Blossoms trees use themed category headings, circular initials with illuminated frames, readable relationship/age labels, and colored connectors. Personal, shared read-only, and managed Family trees reuse a presentation-only MemberPortrait component. Family payloads do not expose portrait URLs; no invented people or photos are introduced.

Themed member menus, inline details/correction forms, add-member controls, relationship picker, requests, sharing and feed surfaces retain existing state, callbacks, permissions and API behavior. Original retains its existing icon portraits and styling. Only the Family route leaves the compatibility treatment; other feature pages remain unchanged pending their own adaptation.

Validation: web build passed with the existing large-chunk warning. Nine existing focused appearance/family-age/shared-workspace checks passed; an additional Family label/initial contrast check passed. `git diff --check` passed. No browser visual verification is claimed: the browser UI tool was unavailable during shell work. Local owner review must inspect both themes, long names, empty/loading/error states, member menus, inline editing, requests, sharing/feed, shared/managed views, mobile stacking, keyboard focus, and switching to Original with a draft open. No server changes, commits, pushes or deployments.

This review is the Family portion of Phase 3. Profile, Diet, Finances and other pages remain pending; owner review/approval determines the next page.

### Phase 2 review

Implemented the scenic shell with distinct generated Day/Night backgrounds, glass-style desktop navigation and shell header, header Appearance access, themed mobile navigation, shared workspace controls and confirmation dialogs, and a stable compatibility wrapper around existing feature pages. Original uses the same mounted component tree and keeps its baseline styling. Mobile Immersive navigation traps focus, makes the background inert, and restores scrolling/focus when closed. Reduced-motion preferences disable Immersive transitions/animations.

Feature pages intentionally retain light compatibility surfaces in both Immersive themes until Phase 3; no feature-specific redesign or server changes are included. Shared primary actions and surface radii receive restrained styling. Generated assets and their exact prompts/provenance are recorded in `web/public/images/appearance/README.md`. Desktop assets are 178–293KB and mobile assets 71–109KB; CSS selects only the active theme/viewport and supported format, with no scenic request in Original.

Validation: web build passed with only the existing large-chunk warning; all five focused appearance tests passed (preference validation/persistence/storage failures, shell token contrast including extreme glass backdrops, and asset existence/transfer budgets). `git diff --check` passed. Both generated scenic images were visually inspected. The browser UI tool returned no available browsers and a native startup error, so actual browser screenshots, keyboard/focus, network selection, draft retention, and responsive layout checks remain for local owner review rather than being reported as verified.

Local review: open Appearance, choose Immersive, inspect Day and Night on desktop and mobile, open/close the mobile drawer and confirmation dialogs, refresh, and switch back to Original. Keep an unsaved form active while switching to check state retention. Verify scenery fallback with images blocked and reduced-motion behavior. Phase 3 requires separate owner authorization. No commits, pushes, or deployments performed.

### Phase 1 record

Phase 1 is implemented for local owner review. Added preference validation/persistence, an application-level provider, authenticated document scope (including portals), accessible Appearance dialogs in the desktop sidebar/mobile navigation, scoped Day/Night tokens, and a reusable AppearanceSurface with a live palette preview. Original remains the default, and Day is the initial Immersive choice. Existing feature trees and legacy styling remain intact; full scenic shell and feature-page styling are intentionally pending Phases 2 and 3. No scenery is generated or downloaded in Phase 1.

Validation: `npm --prefix web run build` passed with the existing large-chunk warning. `node --test web/test/appearance-preferences.test.js` passed all three focused tests for defaults/malformed storage, remembered Night while Original is selected, and denied storage. `git diff --check` passed. Browser visual/focus/draft-retention verification remains for local review; it has not been claimed as completed. No server changes, commits, or pushes.

Owner review: open Appearance in the sidebar (mobile: navigation drawer), select Immersive, switch Day/Night, return to Original, refresh, and reopen Immersive. Verify remembered theme, Escape/focus behavior, and preservation of an unsaved form or open feature dialog. The visible theme preview is limited to the Appearance panel in this phase. Review here covers Phase 1 only; Phases 2 and 3 remain unimplemented and require separate approval.

During approved implementation: run the web build and focused tests for preference validation/persistence and switching without remounting. Manually compare Original baseline screenshots and both themes at representative desktop/tablet/mobile widths. Exercise unsaved forms, open portal dialogs, shared workspaces, keyboard/focus, reduced motion, storage failures, and image fallback. Inspect contrast and selected-theme transfer sizes. Existing server checks are needed only if implementation unexpectedly affects server scope, which would require separate approval.

## Phase progress

- Phase 1: owner approved after local review.
- Phase 2: explicitly authorized by the owner; implemented and ready for local owner review on the existing F039 branch.
- Phase 3: Family and all remaining enabled pages implemented after explicit owner authorization; ready for local review. No further phase is planned.

## Owner approval

The owner approved F039 in conversation on October 9, 2026, with these decisions:

- Original remains the default layout. Day is the initial Immersive theme; Night is the second choice.
- Use the recommended small shell Appearance control, including its addition to Original.
- Approve the scoped stylesheet, preference provider, single mounted component tree, and proposed asset budgets.
- Use the recommended newly generated clean scenic assets, with no reference UI or sample content.
- Proceed through separately reviewed phases, beginning with Phase 1. Later phases require their own implementation approval.
- Limit the initial scope to the authenticated application; sign-in/public pages remain Original.

This records feature approval. No implementation, branch creation, commits, or publishing were performed as part of approval.

## Open questions

No implementation scope questions remain. Owner visual/interaction review and completion confirmation remain pending.
