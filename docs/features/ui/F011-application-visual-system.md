# F011: Application visual system

- **Status:** Done
- **Branch:** `feature/F011-application-visual-system`
- **Pull request:** Not created

## Goal

Give Astitva a consistent, modern personal-workspace appearance across the public site, authentication flows, and authenticated pages. Improve layout, color, typography, spacing, icons, and reusable presentation components without changing the behavior or data of Profile, Diet, Finance, authentication, or any other feature.

## User flow

1. A visitor opens Astitva and sees a cleaner public page and authentication panel using the same visual language as the private workspace.
2. After login, the user enters a stable application shell with clear navigation, a spacious content area, and an obvious current section.
3. The user moves among Overview, Diet, Finance, and other available sections without the shell shifting or page controls changing style unexpectedly.
4. Page titles, actions, cards, forms, loading states, empty states, warnings, and destructive actions follow consistent patterns.
5. On a narrow screen, the sidebar becomes an accessible navigation drawer while the primary content remains readable and usable.

## Visual direction

Astitva should feel calm, useful, and personal rather than corporate or decorative. Most of the interface uses light neutral surfaces. Blue identifies primary navigation and actions; purple and pink add small, meaningful highlights; red is reserved for destructive actions, errors, and exceptional states.

The intended qualities are:

- **Clear:** strong hierarchy, readable labels, and one obvious primary action per area.
- **Spacious:** consistent padding and breathing room without wasting screen space.
- **Colorful with restraint:** color helps identify state or subject; it does not fill every card.
- **Personal:** friendly language, soft corners, and a small amount of visual warmth.
- **Scalable:** new sections can use the same shell, page header, navigation, cards, and forms.
- **Accessible:** sufficient contrast, visible keyboard focus, semantic controls, and color-independent state cues.

## Application shell and layout

### Desktop

- Use a persistent left sidebar approximately `248px` wide.
- Keep the Astitva wordmark at the top, followed by grouped navigation.
- Put account/profile and logout controls in the sidebar footer.
- Give the main content a light gray-blue page background and a centered content column with a maximum width around `1400px`.
- Use page padding of `32px` on standard desktop screens and `40px` on wide screens.
- Every feature page begins with the same `PageHeader`: eyebrow or breadcrumb, title, optional description, and right-aligned actions.
- Use responsive grids for summaries, cards, and details rather than fixed-width rows.
- Allow long pages to scroll in the main document while the desktop sidebar remains visually stable.

### Navigation organization

Show only sections that exist in the application. The layout supports future groups without displaying unavailable features.

```text
Astitva

WORKSPACE
  [Home icon]       Overview
  [Check-list icon] Daily Priorities   (when implemented)
  [Notebook icon]   Notes              (when implemented)

PERSONAL
  [Utensils icon]   Diet
  [Wallet icon]     Finance

ACCOUNT
  [User icon]       Profile            (when implemented)
  [Settings icon]   Settings           (when implemented)

[Avatar] Astitva user
         Local account
[Logout icon] Log out
```

Until later features are implemented, existing placeholders retain their existing behavior and are not presented as newly functional pages.

### Medium and mobile widths

- At widths below approximately `1024px`, reduce outer gutters and allow card grids to use fewer columns.
- At widths below approximately `768px`, replace the persistent sidebar with a compact top bar containing the wordmark, current page label, and a labelled menu button.
- The menu button opens a left-side drawer with the same grouped navigation and account footer.
- The drawer supports keyboard focus, Escape to close, an overlay click to close, and focus return to the menu button.
- Stack page-header actions beneath the title when they do not fit.
- Make primary mobile actions full-width only when that improves clarity; compact secondary actions may remain inline.
- Avoid horizontal page scrolling at `320px` viewport width. Tables become stacked rows or horizontally contained regions with clear labels.

## Color palette

Use semantic CSS variables so components refer to purpose rather than hard-coded feature colors.

| Role | Proposed value | Use |
| --- | --- | --- |
| Primary blue 50 | `#EFF6FF` | Active-navigation and informational backgrounds |
| Primary blue 100 | `#DBEAFE` | Hover and selected soft surfaces |
| Primary blue 500 | `#3B82F6` | Icons and secondary emphasis |
| Primary blue 600 | `#2563EB` | Primary buttons and links |
| Primary blue 700 | `#1D4ED8` | Primary hover/pressed state |
| Purple 500 | `#8B5CF6` | Finance/investment or secondary highlights |
| Purple 700 | `#6D28D9` | Accessible purple emphasis on light surfaces |
| Pink 500 | `#EC4899` | Diet/wellness or personal highlights |
| Pink 700 | `#BE185D` | Accessible pink emphasis on light surfaces |
| Red 50 | `#FEF2F2` | Error/destructive soft background |
| Red 600 | `#DC2626` | Errors and destructive actions |
| Ink | `#0F172A` | Primary text |
| Muted ink | `#475569` | Secondary text |
| Subtle ink | `#64748B` | Metadata with verified contrast |
| Border | `#E2E8F0` | Default borders and dividers |
| Page | `#F8FAFC` | Application background |
| Surface | `#FFFFFF` | Cards, sidebar, forms, and dialogs |

Color rules:

- Blue remains the only default primary-action color.
- Purple and pink appear in small icon surfaces, chart/category accents, selected metadata, or feature-specific highlights.
- Red is used only for errors, destructive actions, removal confirmation, and current over-limit states that already exist.
- Success may use a restrained green already distinguishable from blue; it is not a primary brand color.
- Text and interactive states must meet WCAG AA contrast. Do not place low-contrast pink, purple, or light blue text on white.
- Every colored state also has a label, icon, border, or other non-color cue.

## Typography

- Use a local system sans-serif stack such as `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` so the local application does not depend on a font CDN.
- Use weight and size for hierarchy instead of mixing several typefaces.
- Suggested scale:
  - Page title: `32–40px`, weight `700`, tight line height.
  - Section title: `20–24px`, weight `650–700`.
  - Card title: `16–18px`, weight `600`.
  - Body: `15–16px`, line height `1.5–1.65`.
  - Labels and metadata: `12–14px`, weight `500–600` where needed.
- Use sentence case for navigation, headings, and buttons.
- Use tabular numbers for financial and nutrition totals where the browser supports them.
- Keep line lengths near `65–80` characters for explanatory content.

## Spacing, borders, shadows, and motion

- Base spacing unit: `4px` with primary steps `4, 8, 12, 16, 24, 32, 40, 48`.
- Page sections: generally `32px` apart on desktop and `24px` on mobile.
- Card padding: `20–24px`; compact rows: `12–16px`.
- Cards and large containers: `12–16px` radius.
- Buttons: `8–10px` radius.
- Inputs, selects, and textareas: `8px` radius.
- Chips and small badges may use a fully rounded pill only when the shape communicates a compact status.
- Use `1px` subtle borders on most surfaces. Add a soft, low-opacity shadow only when elevation helps distinguish a menu, dialog, drawer, or important card.
- Avoid heavy gradients, glass effects, large colored shadows, and constant animation.
- Use brief `120–180ms` transitions for hover, focus, drawer, and disclosure states. Respect `prefers-reduced-motion`.

## Icons

- Recommend `lucide-react` as the single icon source because its SVG icons share a consistent stroke style and can be imported individually.
- Use one leading icon for each navigation item.
- Use icons with text for important actions such as Add, Edit, Delete, Refresh, Connect account, Back, Save, and Log out.
- Icon-only buttons are limited to familiar compact controls and require an accessible name and tooltip.
- Suggested semantic mapping:

| Purpose | Icon concept |
| --- | --- |
| Overview | Home |
| Daily Priorities | List checks |
| Diet/meals | Utensils |
| Water | Droplets |
| Finance | Wallet |
| Bank account | Landmark |
| Credit account | Credit card |
| Investment | Trending up |
| Notes | Notebook with pen |
| Profile/account | Circle user |
| Settings | Gear |
| Add | Plus |
| Edit | Pencil |
| Delete/disconnect | Trash or unlink, colored red only in destructive context |
| Refresh/sync | Rotating arrows |
| Date | Calendar |
| Success/warning/error | Circle check, triangle alert, circle alert |

- Default icon size is `18–20px` in navigation and buttons, `20–24px` in summary-card icon containers.
- Do not add decorative icons to every label, paragraph, metric, or table cell.
- Do not use emoji, mixed icon libraries, remote icon fonts, or unlabeled symbols for application controls.

## Reusable UI components

Create a small presentation layer in `web/src/ui/` during implementation. These components accept content and callbacks; they do not own feature API behavior.

- `AppShell`: responsive sidebar/top bar, main region, navigation groups, and account footer.
- `PageHeader`: page context, title, description, and responsive action area.
- `Surface` or `Card`: consistent background, border, radius, and padding variants.
- `StatCard`: label, value, optional helper text, and one optional semantic icon/accent.
- `SectionHeader`: section title, description, and secondary action slot.
- `Button`: primary, secondary, quiet, and danger variants with loading/disabled states.
- `IconButton`: accessible label, tooltip, focus state, and consistent square target.
- `FormField`: label, control association, hint, required state, and error text.
- `Badge`: restrained status presentation with text and optional icon.
- `StatusBanner`: informational, success, warning, and error messages.
- `EmptyState`: concise heading, explanation, optional icon, and one clear action.
- `LoadingState`: text or skeleton treatment that does not cause major layout shifts.
- `ConfirmDialog`: consistent destructive confirmation using accessible dialog behavior.

Feature components continue to own their state and API calls. Shared UI components must not know about Diet, Finance, authentication, or MongoDB models.

## Wireframe or UI changes

### Authenticated desktop shell

```text
┌──────────────────────┬─────────────────────────────────────────────────────┐
│ Astitva               │ Overview                           [User avatar ▾] │
│                       │ Your local personal workspace                      │
│ WORKSPACE             ├─────────────────────────────────────────────────────┤
│ ● Overview            │                                                     │
│   Daily Priorities*   │  Good morning, Astitva                             │
│   Notes*              │  A clear summary of your private local workspace.  │
│                       │                                                     │
│ PERSONAL              │  ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│   Diet                │  │ Profile    │ │ Diet       │ │ Finance    │      │
│   Finance             │  │ Local      │ │ Today      │ │ Last sync  │      │
│                       │  └────────────┘ └────────────┘ └────────────┘      │
│ ACCOUNT               │                                                     │
│   Profile*            │  ┌───────────────────────────────────────────────┐  │
│   Settings*           │  │ Workspace section                            │  │
│                       │  │ Existing feature content                     │  │
│ [A] Local account     │  └───────────────────────────────────────────────┘  │
│     Log out           │                                                     │
└──────────────────────┴─────────────────────────────────────────────────────┘
*Shown only after that feature exists; current placeholders keep current behavior.
```

### Feature page pattern

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ PERSONAL / FINANCE                                                         │
│ Finance                                      [Refresh] [Connect account]   │
│ A consolidated view from locally synchronized data.                        │
│                                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ Net worth    │ │ Cash         │ │ Investments  │ │ Debt         │        │
│ │ $84,500      │ │ $9,500       │ │ $78,000      │ │ $3,000       │        │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Accounts                                            4 accounts          │ │
│ │ [bank icon] Checking ··1234                  $4,500        [View]       │ │
│ │ [card icon] Credit card ··9876               $3,000 owed   [View]       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

The same page-header, summary-card, section, row, button, and status patterns apply to Diet and future features. Feature-specific data and actions remain unchanged.

### Authentication page

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Astitva                                                       About · Work │
│                                                                             │
│ Your private workspace,                                                    │
│ organized around your life.          ┌───────────────────────────────────┐ │
│                                      │ Welcome back                      │ │
│ Projects, health, finance, and       │ Email    [____________________]   │ │
│ notes in one local application.      │ Password [____________________]   │ │
│                                      │ [Forgot password]                 │ │
│                                      │ [ Login ]                         │ │
│                                      └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

Authentication forms keep their current fields, requests, verification rules, and navigation. Only their presentation becomes consistent with the application system.

### Mobile shell

```text
┌──────────────────────────────┐
│ Astitva   Finance     [Menu] │
├──────────────────────────────┤
│ Finance                      │
│ Local synchronized view      │
│                              │
│ [ Connect account ] [Sync]   │
│                              │
│ ┌──────────────────────────┐ │
│ │ Net worth               │ │
│ │ $84,500                 │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Accounts                │ │
│ │ Checking         $4,500 │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

## In scope

- Define and apply shared color, typography, spacing, radius, border, shadow, focus, and motion tokens.
- Restyle the public page, login/signup, email verification, password reset, authenticated shell, Overview, Diet, and Finance.
- Create the responsive application shell and grouped navigation for currently available pages.
- Keep the shell ready for approved future features without implementing or exposing them early.
- Add one consistent SVG icon library and semantic icon mapping.
- Introduce the reusable React presentation components listed above where they replace repeated markup safely.
- Standardize page headers, cards, sections, summary metrics, forms, buttons, badges, banners, loading states, empty states, and confirmation treatments.
- Improve desktop, tablet, and mobile layout behavior.
- Preserve keyboard navigation, accessible names, focus visibility, status/error announcements, and reduced-motion support.
- Update web documentation to explain tokens and reusable components during implementation.

## Out of scope

- Any new feature behavior, API endpoint, MongoDB collection, or data migration
- Changing authentication, verification, session, Diet, or Finance business rules
- Implementing F007, F008, F009, F010, Profile editing, Settings, Projects, or other placeholders
- Adding unavailable navigation destinations merely to fill the sidebar
- Changing Finance calculations, Diet calculations, saved data, API request shapes, or response handling
- Dark mode or a user-selectable theme
- Custom themes, per-feature themes, or user-configurable colors
- Charts, illustrations, photographs, logos, avatars, or new marketing content
- Rich animation, page transitions, glassmorphism, or decorative gradients
- Replacing React/Vite or adding a CSS framework
- Backend, OpenAPI, Postman, or MongoDB changes
- Deployment or hosting

## API changes

None. Existing requests, responses, authentication cookies, error handling, and local proxy behavior remain unchanged.

## MongoDB changes

None.

## Architecture decisions

These decisions were approved by the project owner:

- Keep React with Vite and plain CSS. Do not add Tailwind, a component framework, CSS-in-JS, or a second rendering system.
- Centralize visual tokens as CSS custom properties and make shared components consume semantic variables such as `--color-primary`, `--color-surface`, and `--radius-card`.
- Add a small `web/src/ui/` presentation layer without moving feature API calls or business state into generic components.
- Use one system sans-serif stack and no externally hosted fonts.
- Use `lucide-react` as the only icon package, importing individual icons and pairing important action icons with text.
- Keep a persistent expanded sidebar on desktop and an accessible drawer on mobile. Do not add a user preference for collapsed navigation in this version.
- Use light mode only for this feature. Design tokens should be named semantically so dark mode can be proposed later without rewriting component contracts.
- Use blue for primary actions and navigation, purple/pink for restrained semantic accents, and red only for existing destructive/error/exception states.
- Preserve existing hashes/routes, API helpers, component behavior, displayed data, and confirmation logic while changing presentation.
- Implement the redesign across all existing screens in one feature so the application does not remain half-converted between two visual systems.
- Validate accessibility and responsive behavior as part of the feature rather than treating them as later polish.

## Acceptance criteria

- Public, authentication, verification, reset-password, Overview, Diet, and Finance screens use the same approved visual tokens and component patterns.
- Existing signup, login, session restoration, verification, password reset, logout, Diet, and Finance behavior continues to work without API contract changes.
- Desktop pages use a stable sidebar and spacious main content region; feature pages share the same header alignment and action placement.
- Mobile pages use a labelled navigation control and accessible drawer, with no horizontal page scroll at `320px` width.
- Only currently available navigation destinations are active; F011 does not implement or falsely expose later features.
- Blue is visibly the primary interaction color. Purple and pink appear as limited accents. Red appears only in destructive, error, or existing exceptional contexts.
- Main page and card backgrounds remain light and readable rather than using saturated color fills.
- Cards and larger containers use approximately `12–16px` radii, buttons `8–10px`, and inputs approximately `8px`.
- Borders and shadows are subtle and consistent across cards, forms, menus, dialogs, and drawers.
- Typography uses the approved local system stack and a consistent hierarchy without loading a remote font.
- Navigation and common actions use meaningful icons from one icon family. Important actions retain visible text, and icon-only controls have accessible names and tooltips.
- Shared Button, Card/Surface, PageHeader, FormField, status, empty-state, and confirmation patterns replace visibly inconsistent duplicates where appropriate.
- Keyboard users can reach and operate navigation, forms, dialogs, and actions with a visible focus indicator.
- Color is never the only indication of selection, status, validation, or destructive meaning.
- Text and interactive UI meet WCAG AA color-contrast expectations in normal, hover, focus, disabled, and error states.
- Loading, empty, error, success, disabled, and destructive states remain understandable on desktop and mobile.
- Motion is brief and functional, and reduced-motion preferences are respected.
- The React production build passes, and focused regression checks cover existing authentication, Diet, and Finance flows.
- No server, OpenAPI, Postman, or MongoDB behavior changes are introduced.

## Local verification

Implemented locally on 2026-09-23. Completed checks:

- The React production build passes with the shared UI layer and individually imported Lucide icons.
- All 10 existing server tests pass, confirming F011 did not change server behavior.
- `git diff --check` passes, and no server, OpenAPI, Postman, or MongoDB files changed.
- The application retains the same authentication, Diet, Finance, environment-banner, API request, hash-navigation, and data-handling logic.
- The CSS includes semantic tokens, the approved system font stack, responsive layouts for desktop/tablet/mobile, visible focus treatment, and reduced-motion handling.
- The mobile drawer closes from its labelled close control, overlay, navigation selection, and Escape, then returns focus to the menu control.
- Confirmation dialogs use labelled modal semantics, initial focus, keyboard focus containment, Escape handling, and focus return.

Manual visual review remains:

1. Run the existing local MongoDB, Express, Mailpit, and Vite services.
2. Exercise public, signup, login, verification-required, verification-result, forgot-password, reset-password, authenticated Overview, Diet, and Finance screens.
3. Compare page headers, actions, cards, form controls, messages, empty states, loading states, and confirmations for consistency.
4. Verify layouts around `320px`, `375px`, `768px`, `1024px`, `1280px`, and a wide desktop viewport.
5. Use keyboard-only navigation through the desktop sidebar, mobile drawer, forms, feature actions, and confirmation dialogs; verify focus placement and return.
6. Check normal, hover, focus, active, disabled, error, warning, success, and destructive states for contrast and non-color cues.
7. Enable reduced motion and confirm the interface remains understandable without transitions.
8. Run the React production build and existing server tests.
9. Manually confirm that authentication, Diet calculations and mutations, Finance summaries and actions, hashes, API requests, and stored data behave as before.

## Approved decisions

1. Include the public landing page and all authentication screens alongside the authenticated workspace.
2. Use the local system sans-serif stack throughout the application.
3. Keep desktop navigation expanded and use a drawer on mobile without a collapsed-desktop preference.
4. Use `lucide-react` as the single icon source with text labels for important actions.
5. Keep this visual-system version light-only while retaining semantic tokens for a possible later dark mode.

## Open questions

None.
