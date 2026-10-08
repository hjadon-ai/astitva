# F034: Shared family-member workspace

- **Status:** Review
- **Approved at:** 2026-10-07T02:44:10Z
- **Branch:** `feature/F034-shared-family-member-workspace`
- **Pull request:** Not created
- **Depends on:** F018, F035
- **Related features:** F015, F020, F005, F008, F006, F023

## Goal / User outcome

Let a logged-in user consume information explicitly shared with them by another family member through the familiar workspace and normal module layouts. The selected member becomes the data-owner viewing context; the signed-in user remains themselves. No impersonation, new session or editing capability is introduced.

This replaces the earlier Family-tab-only profile proposal. Selection moves to the application's top-right header and filters the workspace navigation. **Back to my profile** is always available, including loading, empty, revoked-access and error states.

Example: A is signed in; B explicitly shares Diet and Family with A, but not Finance. Selecting B shows **Viewing B's shared data · Read only** and only Diet and Family navigation. Diet uses its normal presentation with B's authorized data. Selecting Self or Back to my profile immediately restores A's normal personal workspace.

## Existing behavior and gaps

- `web/src/App.jsx` mounts personal modules through `Profile`; navigation is presented by the existing AppShell. Personal feature eligibility currently drives hash navigation. There is no global shared-owner context.
- F018/F015 grants in `families.shares` address an owner, recipient and feature. The schema and routes currently allow only `diet` and `finance`. Existing shared reads are read-only; family roles do not bypass grants.
- Family visibility currently comes from accepted membership. There is **no existing explicit owner-to-recipient Family grant**. Adding one is a proposed permission extension requiring owner approval, not a claim that Family is already explicitly shareable.
- F035 introduces normalized people/units and compatibility family projections. Its Review status and legacy-conversion boundary must be respected; this feature neither converts records nor resolves identity ambiguities.
- F008 adds private Diet capabilities beyond the existing shared meal/target response. The normal layout must not imply that private water, Meal Library, import or upload data is shared.
- Priorities and Notes have no approved sharing contracts. F023 post audiences are separate permissions, not an owner-to-viewer workspace grant.

## User flow

1. User logs in and sees their own workspace and normal eligible navigation.
2. A labelled top-right member selector offers **Self** and distinct accepted, linked family members already visible to the viewer. No unrelated-user search; NON_USER and pending invitations are not selectable workspace owners.
3. User selects B. Apply existing unsaved-change guards before leaving the personal module; cancelling leaves Self and its draft unchanged. Clear old module data immediately after a confirmed switch.
4. Client requests B's server-authorized shared context. Show loading with Back to my profile; do not temporarily render personal data under B's name.
5. Navigation contains only explicitly granted, supported modules enabled for the actual viewer, owner and runtime. Select the first available module in the stable normal navigation order.
6. Opening an allowed module loads its shared endpoint and reuses normal display components in read-only mode with B as owner.
7. Selecting another member clears the previous context/data and ignores late responses.
8. Selecting Self or Back to my profile clears shared data and restores the viewer's personal navigation and prior valid personal page immediately, without waiting for a network request.

Additional states:

- **Nothing shared:** keep B selected, show “B has not shared any available modules with you”, no private module tabs, and the persistent return action.
- **Grant revoked/module disabled:** every read rechecks authorization. On denial clear affected data/tab, refresh context and show an access-changed message. Revalidate on module navigation, browser focus, explicit refresh and a 60-second interval while shared viewing is active. No instantaneous live-revocation guarantee; cached display ends when revocation is discovered.
- **Selected member removed, no longer accepted or account unavailable:** clear all shared data and return to Self with an explanatory message.
- **Several shared units/ambiguous mapping:** use explicit unit IDs and authorized choices. Do not union all units, choose by name or expose the owner's separate Born-in relatives. Unsafe mapping blocks the context with a readable reason and a return action.
- **Network failure:** hide failed/stale data, offer Retry and return; never fall back to personal APIs under the selected owner's label.
- **Session expires/logout:** discard shared context and follow existing authentication behavior. Refresh starts in Self; selection is not persisted as a login identity.

## In scope

- Global top-right selector, persistent owner/read-only indicator, filtered navigation and always-visible Back to my profile.
- Read-only Diet and Finance using existing explicit grants and bounded shared payloads.
- Approved explicit Family sharing grant and read-only family module contract described below.
- Existing owners grant/revoke Family in their personal Family sharing controls, following their existing own-data grant authority; no grant controls in shared viewing.
- Reuse normal layouts/cards/date-month controls wherever their data is authorized; hide unsupported subpanels and all mutations rather than invent values or call private APIs.
- Keyboard operation, meaningful focus, mobile stacking, loading/empty/error states, stale-response protection and authorization refresh.
- During approved implementation, update affected OpenAPI/Postman, collection documentation and proportionate tests.

## Out of scope

- Impersonation, session/account switching, writes to selected-member data, delegated sharing or automatic grants.
- Sharing Notes, Priorities, Chat, Admin, credentials, account email, provider tokens, connection/sync controls or private account profile.
- F023 social feed/photos/comments in shared context; selecting an owner must not reinterpret post audience permissions.
- New private Diet subfeature grants, exports, real-time subscriptions, public profiles, migration, family merges or duplicate resolution.
- Implementation, branches, deployment or changes to other feature statuses during this proposal update.

## Wireframe or UI changes

```text
Astitva                         Signed in: A   [Viewing: Self v]
Normal personal navigation                    Personal workspace

Astitva                         Signed in: A   [Viewing: B v]
Viewing B's shared data · Read only            [Back to my profile]
Diet | Family                                 Normal module layout
                                              B's authorized data

B has not shared any available modules with you.
                                              [Back to my profile]
```

Retain the existing application shell and normal module look; this is not a separate sharing screen. Do not show personal Overview, private account cards or unshared tabs while B is selected. Family relationship labels use B as presentation perspective only; permissions remain those of A. Mobile header controls stack without overflow at 320px. After selection focus the shared-context heading; after exit restore selector focus. Use visible labels and polite announcements. Hide all Add/Edit/Delete/Save/Import/Upload/Connect/Sync/Disconnect/Invite/role/share-management actions in shared modules, including for ADMIN/EDITOR viewers.

## API changes — draft REST contract

All reads require the actual viewer's verified session, Family eligibility and current accepted membership. Server resolves owner identity from a family person; client IDs and `readOnly` are never authorization. Return only authorized safe fields, `Cache-Control: no-store`, and existing human-readable errors.

### GET /api/family/shared-workspace/members

No body. Example `200`:

```json
{"members":[{"familyId":"unit-x","personId":"person-b","name":"B"}]}
```

Self is client presentation of the authenticated viewer. Include accepted linked owners within the viewer's authorized family scope even if nothing is shared, so the empty state is meaningful. Keep unit/person mappings explicit; do not expose email or unrelated accounts.

### GET /api/family/:familyId/people/:personId/shared-workspace

No body. Example `200`:

```json
{"owner":{"personId":"person-b","name":"B"},"familyId":"unit-x","readOnly":true,"modules":["diet","family"]}
```

`modules: []` is valid. Intersect grants with supported contracts, owner/viewer eligibility and runtime policy. Every module data request repeats these checks. Family selection is limited to the specified authorized unit, never all of B's units.

### Existing GET /api/family/:familyId/shared/:ownerId/:feature

Reuse for `diet?date=2026-10-06` and `finance?month=2026-10`. Existing `ownerId` denotes a linked user ID; context resolves it safely, rather than treating a person ID as a user ID. Preserve the current meal/target and account/transaction/holding contracts and limits. Do not report truncated Finance transactions as complete month totals. Normal presentation may need read-only adapters; an absent shared field stays absent.

Proposed extension: `feature=family` returns only the explicitly granted unit's members/relationships/details that A is already authorized to view, presented relative to B:

```json
{"feature":"family","unitId":"unit-x","perspectivePersonId":"person-b","readOnly":true,"people":[{"id":"person-c","name":"C","relationship":"Son"}]}
```

Whitelist authorized family details; exclude invitation emails/tokens, request inbox, grants, admin actions and unrelated units. The grant does not expand membership visibility or grant access to third-party private features. If a safe perspective cannot be derived, block rather than fetch B's unrestricted family view.

### Existing PUT /api/family/:familyId/shares/:feature/:recipientId

Propose allowing `feature=family` as well as existing Diet/Finance. No body; existing response `{family: ...}`. Only the authenticated owner grants, only to another accepted linked member of that unit. This unit-scoped Family grant shares a permitted perspective, not ownership of other relatives' data. Requires existing mutation-origin protections.

### Existing DELETE /api/family/:familyId/shares/:feature/:recipientId

Propose corresponding Family revocation with the same existing response and owner authority. Shared viewing never invokes these write routes.

Important errors: `400` malformed ID/date/month or invalid recipient; `401` missing/expired session; `403` unverified/disabled feature or revoked/ungranted module; `404` absent/out-of-scope family/person or unsupported module; `409` unsafe/ambiguous legacy-normalized mapping. Unauthorized IDs must not reveal private records. Existing personal write endpoints remain scoped to the real authenticated owner; changing client context cannot authorize selected-owner writes.

## MongoDB changes

- Extend the existing `families.shares.feature` enum with `family` for proposed unit-scoped owner-to-recipient grants. Preserve existing Diet/Finance records and default no grants. Update relevant grant validation/activity feature enum consistently during implementation.
- F035 compatibility projections must retain the authoritative unit ID and valid memberships for these grants; merges must preserve grant scope without silently broadening visibility. Review this interaction before implementation; block unsupported legacy mappings.
- No selected-owner session, duplicate profiles or new data collection. Shared viewing context is transient browser state. Never copy data between owners.

## Architecture decisions

- Keep React/Express/MongoDB and existing authentication; no additional infrastructure.
- Separate immutable authenticated viewer from transient `{familyId, personId, ownerId, mode: shared}` context at Profile/AppShell level.
- Use explicit per-module shared adapters and a supported-module allowlist. Never globally rewrite personal API URLs or replace authenticated user state.
- Reuse presentational module components with read-only data/actions separated from personal fetching and mutations. Abort/ignore stale requests; key mounted data by viewer/unit/owner/module/query.
- Family grants are an intentional new permission type approved within this feature. Current membership access alone cannot satisfy the explicit-sharing example.
- F035 must be owner-confirmed Done before implementation starts because identity/unit mapping and safe family perspective depend on it. Optional F020 detail reuse must not expand or implicitly approve F020; fields without an approved visibility contract remain absent.
- Future modules require separately approved grants, payload and read-only adapters; adding a navigation entry never makes a module shareable.

## Acceptance criteria

- A selecting B with Diet + Family grants sees only Diet and Family; Finance and every unshared module are absent and direct requests are denied.
- Normal Diet/Finance/Family presentation is reused with authorized owner data; no sample, private or guessed fields fill unavailable sections.
- Family requires an explicit grant plus existing accepted unit access, stays within that unit and never reveals B's separate relatives.
- Selector excludes unrelated, pending and NON_USER owners; duplicate names do not confuse identity. Empty grants display a useful empty state.
- Signed-in identity/session remains A. No selected-member write controls appear and no shared-view interaction performs mutations, including for ADMIN/EDITOR.
- Back to my profile and Self work during loading, errors and empty states, immediately clear shared data and restore normal personal navigation.
- Revocation/disabled features remove data and tabs upon discovery; membership loss clears the entire context. No late response repopulates cleared data.
- Rapid switching never displays the previous owner's response. Refresh/logout clear selection; personal drafts use existing navigation guards before switching.
- Date/month navigation uses only shared APIs. Finance limits and missing Diet subfeatures are accurately presented.
- Keyboard selector/exit, visible focus, screen-reader labels and desktop/320px mobile layouts are usable without horizontal overflow.
- Existing personal features and Diet/Finance sharing continue to work unchanged in Self mode.

## Local verification

Proposal only: no code implemented, tests run or deployment performed for this rewrite. On approval, use synthetic A/B/C fixtures for per-module grants, empty grants, family-unit boundaries, ADMIN/EDITOR/READONLY, pending/unlinked/unrelated owners, unsupported modules, forged IDs, revocation, membership loss, stale responses and attempted writes. Run proportionate server/web tests and web build; inspect desktop/mobile, keyboard, date/month controls, hash navigation and return-to-Self. Update API/schema documentation only during approved implementation.

## Owner approval decisions

The owner explicitly approved F034 with these conditions:

1. Only explicitly shared features can be viewed. If B has Diet and Finance but shares only Diet with A, A sees only Diet, in read-only mode. Feature availability alone never grants access.
2. Hide all operation-related sections and controls in shared context. Only authorized information is displayed; no operations, editing or mutations are allowed. This applies to Diet, Finance and Family, regardless of the viewer’s role.
3. Only existing accepted, linked family members can consume data, and only when the respective feature is already explicitly shared with them. Pending invitations, NON_USER records and unrelated users gain no access.

Approval covers the documented first-version scope and architecture: Diet, Finance and unit-scoped Family grants; existing family visibility remains the ceiling; unsupported private subfeatures and Social remain excluded. Selection is transient, refresh returns to Self, and authorization is revalidated on navigation, focus, refresh and the documented interval. Back to my profile remains available in every state.

## Open questions

None for the approved scope. Local implementation is ready for owner review. F035 must be owner-confirmed Done before implementation, as documented above. Planning priority has not been assigned; approval does not make this feature eligible for automated selection without required planning metadata.

## Implementation authorization

The owner requested implementation with F035 in place. Proceed against its local Review implementation; F035 is not marked Done by this request. Preserve the original personal grant/revoke controls.

## Local implementation handoff

Implemented on `feature/F034-shared-family-member-workspace`, retaining the existing local F035 implementation and unrelated worktree changes. F035 remains Review; no automatic Done confirmation, conversion, commit, push or deployment occurred.

The top-right Viewing workspace selector offers Self and accepted linked members by explicit family/person IDs. Shared navigation follows server-authorized grants; Diet reuses its normal layout without editing, water/library or mutation controls. Finance reuses display components with bounded transactions; Family displays only the original grant's scoped information. Back to my profile is available throughout. Personal Family grant/revoke controls remain, with Family added to existing Diet/Finance choices. Shared responses omit private account emails and roles. Family grants retain original visiblePersonIds across merges; current membership remains required.

API, Postman and schema documentation have been updated. Selection stays transient and authorization revalidates during shared navigation, focus, refresh and the documented interval. Optional module fields without a shared contract are not synthesized.

Before the owner's no-further-testing instruction, the web build and 10 web tests passed, the isolated F034 permission integration passed, the F035 four-test suite passed, and the default server suite passed 48 with 9 opted-out integrations skipped. These results predate the final safe-owner response and sharing-help text edits. No further tests or browser review were performed after that instruction. A synthetic desktop preview showed filtered Diet/Family navigation and the return control; complete manual browser acceptance is pending.

Manual review: start the existing local profile, grant a feature from your personal Family Sharing controls to an accepted member, sign in as that member and select the owner in Viewing workspace. Confirm only the granted tabs appear, all editing/operation controls are absent, and Back to my profile restores your own workspace. Revoke from the owner's personal view and refresh shared access to confirm removal. Existing legacy families remain usable without automatic conversion; unsafe normalized mappings block selection. Finance displays at most 100 transactions and does not claim a complete monthly spending report. Real-account review remains with the owner.

Member options display authorized Born-In Family / Spouse Family context labels rather than raw unit ID suffixes. Context is relative to the signed-in viewer; shared data ownership and permissions remain unchanged.

## Final display names — owner decision

Use **Family Roots** for the Born-In context (parents and siblings), and **Family Blossoms** for the Spouse/Formed context (partner and children, including single-parent families). These supersede earlier display names; internal IDs, relationship rules and permissions remain unchanged.

## Owner-requested Family layout refinement

Group flows in Members, Feed, Sharing, Requests and Add relationship. Family Roots uses teal; Family Blossoms uses violet, always paired with names/icons. Use large category cards, consistent touch targets, member search, and progressive disclosure for member management and existing family records. Retain existing authorization, sharing and explicit consent semantics. No additional tests under the owner’s manual-review instruction.

## Owner-requested selector placement refinement

In Self mode, show a compact member dropdown only on the Family tab, with “View a family member” as its initial prompt. Hide it and its header from other personal tabs. Once a different member is selected, keep the picker, shared-context indicator and Back to my profile action available across all authorized shared tabs and loading/error/empty states. Returning restores the personal Family view. This supersedes the earlier always-visible Self selector presentation.

Owner UI refinement: remove the standalone Refresh shared access button. Navigation, browser focus and periodic authorization revalidation remain; Retry remains available for failed requests.

Owner UI refinement: render Back to my profile as a 44px return-arrow icon immediately before the member dropdown, with a visible-focus state, tooltip and accessible label. Its exit behavior remains unchanged.

Owner refinement: Add family member asks for name, an explicit relationship selection, then role. No-account records need no email. READONLY/EDITOR/ADMIN reveal email and internally resolve an existing account or invitation. Matching families remain consent-gated; chosen roles activate only after acceptance and required merge approvals, preserving existing higher roles and rechecking initiating ADMIN for elevated grants.

Owner UI refinement: shared-member picker now uses a compact rounded teal surface, family icon and dropdown indicator matching the family cards. Active shared viewing uses violet; the return icon remains before the selector. Native select keyboard behavior and existing access rules are preserved.

Shared Family presentation now matches the Roots/Blossoms tree-card layout and blue/pink/amber colors. Only the explicitly shared person scope is rendered. Member-action indicators are disabled; no management operations or unshared family data are loaded.

Selected-member perspective refinement: shared Family branches derive from direct edges relative to the selected owner, not the logged-in viewer. The selected owner is Self; visible parent/sibling branches are Roots and partner/child branches Blossoms. Only types represented in the explicit sharing scope render; empty Self-only duplicate types are not invented. Other scoped people without a direct relationship remain separately visible without inferred placement. Card styling, age and relationship-color rules match the personal tree; actions remain disabled.
