# F035: Shared family units and consent-based linking

- **Status:** Review
- **Priority:** High
- **Depends on:** F018
- **Branch:** `feature/F035-shared-family-units`
- **Pull request:** Not created
- **Related bug:** [B001](../../bugs/family/B001-family-and-member-management.md)
- **Reference:** [Owner discussion context](../../context/ASTITVA_FAMILY_MODEL_BRAINSTORM.md)

## Goal

Let relatives share the same family unit from their own perspectives, while retaining separate Born-in and Formed units where appropriate. Connect existing users and combine matching units through explicit consent without losing relationships, member details, authority or related data.

The owner reviewed the resulting schema and merge flow and authorized implementation. F035 is implemented locally and in Review; only the owner may mark Done. Existing legacy family records are not converted automatically.

## User flow

1. A chooses a relationship first. Father/mother/sibling targets A's Born-in context; partner/child targets A's Formed context. A child can establish a Formed unit before a spouse exists. If placement is ambiguous, show choices and require confirmation rather than guess.
2. A either adds an explicit NON_USER or requests a relationship with an account holder. Invite-to-register requires an explicit invite action and email; NON_USER creation alone sends nothing.
3. For an existing user, an in-app request and email notification appear. After sign-in, the email link or browser refresh loads the request with Accept/Decline. Registration, verified email and link opening never imply acceptance.
4. If the recipient has no corresponding unit, accepted linking joins the existing unit. If both sides have units representing the same family, preview combination of those units only.
5. One ADMIN from each unit explicitly accepts the merge. Relationship consent is separate if the recipient is not an ADMIN. Show the approvals still required. The initiating ADMIN must explicitly accept too; merely sending a request is not approval.
6. After consent and validation, combine units. ADMIN/EDITOR reviews possible duplicate people; only ADMIN deletes unwanted NON_USER records after data/reference handling.

Example: X contains A and daughter D; Y contains B and son C. A requests B as wife. After required consent, A/B/C/D share one Formed unit. A's parents E/F and siblings G/H, and B's Born-in relatives, remain in separate units. For C, the shared A/B/C/D unit is Born-in; C may later participate in another Formed unit.

## In scope

- Multiple family units per person, stable person identity and viewer-relative relationship/context labels.
- Explicit parent → child edges and reciprocal partner/sibling presentation. Retain the existing single-current-partner boundary; no automatic sibling or complex parentage inference.
- Verified, explicit relationship consent, invitations to register, later account linking to an explicitly reviewed existing NON_USER record.
- Owner-confirmed merge consent: one ADMIN per source unit, preserving all existing ADMINs.
- Owner-confirmed decline: original NON_USER remains unchanged; no account link/merge. Persist decline on the request separately.
- Separate possible-person-duplicate review from family-unit combination. No automatic person-data merge, name-based identity or account merging.
- ADMIN-only NON_USER deletion with dependency checks and explicit reference resolution.
- Preserve memberships, relationship direction, permitted family details, existing valid sharing grants, social references and activity attribution. Membership never grants private feature access.
- Refresh-based request discovery and existing email delivery. No live subscription required.

## Out of scope

- New hosting/services, graph database, scheduled agents or AI execution.
- Automatic migration of ambiguous historical family placement, production data reset, autonomous person deduplication.
- Step-family, custody, multiple/former partners, broad genealogical inference.
- Editing another account's private Diet/Finance data, new sharing types, automatic access through relationships.
- Implementing all F019 resend/cancel features or F017 corrections implicitly; reconcile interfaces without silently absorbing their full scope.

## Wireframe or UI changes

Reuse the existing Family UI, cards and accessible controls:

```text
Family                     [Requests (2)]
Born-in family             [Open]
Formed family              [Open]
[Add relationship]
Relationship [Wife v]   Person [Existing user / NON_USER / Invite]
Placement: Formed family X     [Review request]

Request: A ↔ B — partner
Combine X (2 members) + Y (2 members)
Existing ADMINs retain ADMIN. Born-in units remain separate.
Relationship: accepted / pending
X ADMIN: pending        Y ADMIN: accepted
[Accept] [Decline]       (authorized action only)

Review members: C1 and C2 may be duplicates
[Edit details] [Review references] [Remove NON_USER] (ADMIN only)
```

Show pending, declined, expired, blocked, completed and delivery-failed states distinctly. Email links open an authenticated request page without exposing private data before authorization. Mobile controls stack; labels, focus restoration, loading/error states and keyboard navigation follow the existing UI system.

## API changes

Draft contracts, subject to approval. All mutations require verified sessions, enabled Family access, origin protection and server-side roles. IDs are opaque; revision conflicts return 409. Out-of-scope records return 404, not private metadata.

| Method / path | Input | Result |
| --- | --- | --- |
| GET /api/family/units | None | Authorized units with viewer-relative context, person IDs, roles and revisions |
| POST /api/family/units/:unitId/people | `{name, relationship, kind:"NON_USER", expectedRevision}` | Member and updated unit; no invitation/account |
| POST /api/family/requests | `{sourceUnitId, relationship, targetEmail, existingPersonId?, inviteToRegister, expectedRevision}` | 202 generic request receipt; not account-existence confirmation |
| GET /api/family/requests | None | Pending/history summaries only for recipient or authorized source/target ADMIN |
| GET /api/family/requests/:id | None | Safe impact preview, consent state, authorized available actions |
| POST /api/family/requests/:id/relationship-decision | `{decision:"accept" or "decline", expectedRevision}` | Updated request; verified addressed recipient only |
| POST /api/family/requests/:id/merge-decision | `{unitId, decision:"accept" or "decline", expectedRevision}` | Updated approvals; current ADMIN of specified unit only |
| GET /api/family/units/:unitId/people/:personId/removal-preview | None | Authorized reference/dependency summary; ADMIN only |
| DELETE /api/family/units/:unitId/people/:personId | `{expectedRevision, confirmation:true}` | 204 only for removable NON_USER; 409 unresolved references |

Example request state: `{id:"request-id", status:"AWAITING_MERGE", relationshipConsent:"ACCEPTED", approvals:[{unitId:"X",state:"ACCEPTED"},{unitId:"Y",state:"PENDING"}], availableActions:["ACCEPT_MERGE"], warnings:["POSSIBLE_DUPLICATE"]}`. Available actions are server-derived and never authorization by themselves.

Errors: 400 invalid relationship/placement; 401 no session; 403 insufficient role/unverified identity; 404 unauthorized/absent record; 409 stale preview, conflicting partner/ancestry, unsafe references or terminal request; 410 expired invitation; 429 rate limit. Delivery failure is visible to the authorized sender and does not accept/link anyone. No public name-search endpoint is proposed; exact-email request entry is the recommended first version, avoiding an unrelated-user directory.

## MongoDB changes

Proposed design, not an approved schema:

- `familyPeople`: stable ID, permitted family details, nullable unique linked `userId`, revision. Account credentials stay in `users`. NON_USER identities remain distinct until explicit linking; names are not unique keys.
- `familyUnits`: memberships `{personId, role}`, unit-scoped relationship edges `{fromPersonId,toPersonId,type}`, explicit placement anchors needed to derive viewer context, sharing grants, historical creator attribution, revision and active/combined state. Born-in/Formed are not immutable unit types.
- `familyRequests`: initiator, addressed verified identity/email, relationship, candidate unit IDs, existing member to link, relationship decision, per-unit ADMIN decisions with actor/time, preview revisions, request status, expiry, delivery status and idempotency key. Store invitation token hashes only.
- Existing invitation/activity/post references require a documented identity mapping to people/units. Preserve original attribution and resolve retired unit IDs safely. Preserve all posts; multiple pinned posts must be explicitly resolved in the merge preview, never silently dropped.

Request lifecycle recommendation: PENDING_RELATIONSHIP → AWAITING_MERGE → COMPLETED, with DECLINED/EXPIRED/CANCELLED and BLOCKED states. Delivery is separate from consent. NON_USER member state does not become accepted merely because a request is sent.

## Architecture decisions

### Confirmed owner behavior

Multiple contextual units; relationship-first placement; explicit in-app consent notified by email; one ADMIN approval from each merging unit; retained ADMIN authority; decline leaves NON_USER unchanged; ADMIN-only deletion; no automatic person deduplication.

### Proposed implementation choices

- Keep React/Express/Mongoose/MongoDB. Use adjacency lists; DFS checks parent-edge cycles, bounded authorized traversal computes views. Do not use connected components or Union-Find to decide family placement/consent.
- Use normalized stable people with unit memberships rather than repeating embedded identities. Shared identity does not grant cross-unit visibility or expose all global family details; define authorized fields at each read.
- Retain the older unit ID by createdAt (ID order breaks equal timestamps); mark the other MERGED with mergedIntoId and record the merge mapping. Preserve all source ADMIN memberships and make role administration available to unit ADMINs rather than one historical creator, as accepted in the owner decisions. Resolve overlapping memberships using ADMIN > EDITOR > READONLY, retaining every existing ADMIN.
- Complete merge/link atomically with revalidated consent, current ADMIN roles, source revisions and idempotency. A changed preview invalidates approvals and requires fresh review. A revoked role invalidates its approval. Concurrent accept/retry must not apply twice.
- Multi-document transactions require a transaction-capable MongoDB deployment. Verify capability locally; block completion if unavailable. Do not emulate atomic safety with uncontrolled sequential writes.
- Possible name duplicates remain separate and flagged. Invalid parent cycles, self-edges, incompatible partners, unresolved authorization/data/reference conflicts block completion. ADMIN cleanup previews incident edges, invitations, memberships and other references; refuse deletion until these are explicitly handled. EDITOR cannot delete.
- Existing populated records need an owner-reviewed local conversion plan and reversible backup/mapping before writes. Greenfield preference is not permission to discard existing data or infer ambiguous unit boundaries.

### Existing feature reconciliation

F018's one-family creation/empty-family replacement assumption is superseded by multiple units and consent-based combination if F035 is approved. Its reciprocal labels, verified linking, role separation and explicit sharing boundaries remain. Creator-only role management needs explicit revision to support retained ADMIN authority. F014 directory filtering stays within authorized views; exact-email relationship requests are new. F020 family details survive stable identity conversion. F015/F016/F023 require safe grant/activity/post references. F017/F019/F034 remain independently tracked; their documents/statuses are not changed by this proposal.

## Schema and merge flow — Reviewed by owner

This concrete design incorporates Owner decisions 1–6. The owner reviewed this section before implementation; conversion of existing real records still requires a reviewed mapping.

### Proposed schema

| Collection | Main fields and constraints |
| --- | --- |
| familyPeople | `_id`, nullable `userId` (partial unique index for linked ObjectIds), `name`, optional existing detail fields, timestamps, revision. No credentials; names are not identity keys. |
| familyUnits | `_id`, `createdAt`, historical `creatorId`, `state: ACTIVE or MERGED`, nullable `mergedIntoId`, revision, placement anchors and existing unit settings. No permanent Born-in/Formed type. |
| familyMemberships | `unitId`, `personId`, `role`, membership state, revision; unique `(unitId,personId)`. Roles are unit-scoped; higher role wins only for the same established person ID. |
| familyRelationships | `unitId`, `fromPersonId`, `toPersonId`, `type: parent or partner or sibling`, timestamps; unique canonical edge per unit. Parent direction is preserved; symmetric edges use canonical endpoint order. Distinct NON_USER IDs remain distinct. |
| familyRequests | Relationship parties, exact recipient email, source/target units, optional selected NON_USER ID, relationship decision, ADMIN approvals with actor/time/unit revisions, expiry, delivery status, request revision/idempotency key. Decline never changes the original NON_USER. |
| familyMerges | Request ID (unique), survivor/source IDs, consenting ADMIN IDs, before/after revisions, identity/reference mapping and completion time. Auditable transactional record; no person deduplication. |

Private account data remains owner-scoped. Shared person identity must not expose details from another unit: existing details are preserved, and unit-visible detail fields/overrides need explicit authorization. Existing grants, invitations, activity and social posts must retain their ownership/audience meaning through reference mapping.

### Merge flow

1. Exact-email relationship request identifies two relevant units; recipient accepts the relationship in-app. No discovery by name and no merge on email verification.
2. Generate a preview showing both units, the older survivor, member roles, relationship effects, duplicate warnings and reference conflicts. Unrelated Born-in units are excluded.
3. One current ADMIN from each unit explicitly accepts that preview. Sending a request is not acceptance. The same person may not supply both sides' approval without explicit review of that overlapping-authority case.
4. Revalidate consent, roles, revisions, relationship constraints and all reference mappings. Changed graphs or revoked approvals require a refreshed preview and acceptance; unsafe conditions block completion.
5. In one MongoDB transaction, preserve stable person IDs, combine memberships/relationships into the older unit, select the higher overlapping role, preserve valid grants and related references, mark the other unit MERGED with mergedIntoId, complete the request and write familyMerges. Do not delete source history or merge people.
6. Commit exposes the completed shared unit once. Transaction failure leaves both active units unchanged; repeated accepts/retries return the recorded result. Duplicate NON_USER records may remain for manual review.
7. ADMIN-only unit-scoped removal requires a dependency preview and safe handling of incident relationships/requests/references. Delete a global NON_USER identity only when unused everywhere; never delete a linked user account.

### Local conversion boundary

Build and test against synthetic transaction-capable local fixtures first. Produce a read-only conversion report for existing embedded people/relations, detail fields, grants, invitations, activity and social references. Preserve distinct unlinked identities; ambiguous placements remain blocked for owner review. No automatic conversion, data reset or modification of real family records is authorized by this design. Owner-reviewed backup/mapping and conversion execution remain separate steps.

### Settings and remaining narrow decisions

Requests expire after seven days; at most two sends per day under the accepted F019-aligned limits. A new request after decline must remain explicit and rate-limited. Two conflicting pinned posts require an explicit keeper choice without deleting either post. Notification history presentation, cross-unit detail field rules and overlapping ADMIN authority must be settled in the preview/UI design rather than guessed.

## Acceptance criteria

- A creates a Formed unit with a NON_USER child before adding a spouse; no account or email is created for that child.
- Relationship-first placement produces separate appropriate units; ambiguous placement requires human choice. B's parents never appear in A's shared Formed unit merely through marriage.
- X(A,D) and Y(B,C) combine only after relationship consent and one explicit ADMIN acceptance per unit. Pending/rejected requests leave memberships and graphs unchanged. Both original ADMINs retain ADMIN.
- Opening email links or refreshing loads authorized Accept actions without applying consent. Wrong/unverified users and non-ADMIN merge attempts are denied.
- C sees the shared A/B/C/D unit as Born-in while A/B see Formed. Parent direction remains correct; unsupported structures/cycles are blocked.
- C1/C2 with matching names remain distinct with a review warning after an otherwise safe merge. Only ADMIN can remove a confirmed unwanted NON_USER after dependency handling; linked accounts/private data are never deleted.
- Later explicit verified linking retains the selected NON_USER identity/details where valid. Decline changes only request state and leaves that member unchanged.
- Merge retains relationships, details, posts, activity attribution and valid existing grants; it creates no new private feature access. No dangling source references or silent pinned-post loss.
- Repeated/concurrent accepts produce one completion; stale previews and changed ADMIN roles require review. Failures do not expose a partial merge. Retry remains safe.
- Existing Family/Home/sharing/social views continue to enforce unit roles and owner grants; keyboard and 320px mobile layouts remain usable.

## Local verification

Proposal only: no implementation, runtime tests or deployment performed. After approval, use disposable local fixtures for X/Y, distinct Born-in units, same-name NON_USER children, READONLY/EDITOR/ADMIN, verified/unverified recipients and independent grants. Test request refresh, decline, linking, duplicate reference checks, parent cycles, stale previews, revoked roles, concurrent accepts, failure rollback and preserved social/sharing data. Run proportionate server integration tests, web tests/build and browser keyboard/mobile checks. Update OpenAPI, Postman and collection design during approved implementation.

## Phased implementation path

1. Review/approve schema, wireframe and local existing-data conversion plan; establish stable people/unit placement with roles and regression tests.
2. Add relationship-first request UI, explicit invitation/linking and refresh-based inbox with consent/decline tests.
3. Add two-sided ADMIN previews and atomic unit combination with reference preservation and failure tests.
4. Add ADMIN-only manual cleanup, complete compatibility checks and owner review before any commit/push or release.

Each stage remains within approved scope; do not deploy, reset production or broaden permissions without explicit authorization.

## Owner decisions

### 1. Approve normalized people/unit collections, survivor-ID mapping and transaction-capable local MongoDB requirement, or request a different persistence design?

> Approve normalized people, family-unit, membership and relationship persistence. Born-in/Formed context should be derived relative to the person rather than stored as a permanent family type. For family-unit merges, retain the older family ID as the survivor, mark the other family MERGED with mergedIntoId, and never automatically merge person records. Use a MongoDB transaction for the family-unit merge and maintain an auditable merge record. It is acceptable to configure local MongoDB as a replica set to support transactions. Please incorporate this into the proposed design, but show me the resulting schema and merge flow for review before implementation.

### 2. Approve exact-email requests instead of global name search for the first version?

> yes, approve exact-email. Search for existing member should be allowed only with email.

### 3. Approve ADMIN role administration replacing creator-only grants; how should conflicting EDITOR/READONLY memberships be resolved?

> go for higher role in case of conflict. Choose EDITOR if conflicts with READONLY.

### 4. Define family-detail visibility across units and explicit UI/reference actions needed before NON_USER deletion, including a person belonging to multiple units. Recommend unit-scoped removal; global identity removal only when unused everywhere.

> Yes

### 5. Approve seven-day request expiry and two sends per day consistent with F019's owner decisions, and whether a new request after decline needs any additional restriction?

> Yes

### 6. Review the existing-data conversion strategy and incompatible pin/reference handling before implementation. F020 is not a dependency under owner decision 6; preserve any existing optional member details without implementing additional F020 scope.

> Yes do what is easier without depending upon F020



## Local implementation and validation

Implemented on `feature/F035-shared-family-units` without commit, push, PR or deployment. The normalized schema, unit/request APIs, graph checks, in-app decisions, ADMIN roles/cleanup, transactional older-unit merge/audit, request quotas and compatibility projections are present. Unit-scoped family details preserve privacy across units; existing linked account profiles/private feature data remain separate. The API also implements POST /api/family/units and PATCH /api/family/units/:unitId/people/:personId for explicit establishment and authorized edits. Invite-to-register without a selected NON_USER requires `name` and creates the unlinked member before sending; requests remain separate from member/account state.

Current tests: three graph tests and the isolated transactional HTTP integration test pass, including explicit consent, same-name preservation, shared child direction, decline/claim, wrong origin/session/roles, stale approval invalidation, revoked reviewer handling, audit-failure rollback, concurrent retries, persistent quota, expiry, old audience preservation and legacy-conversion blocking. Default server suite: 48 passed, 8 intentionally opted-out integrations skipped. Existing F018 and F023 integration suites pass against disposable local fixtures. Web tests: 7 passed; production bundle build passes with the existing size warning. JSON contracts and changed JavaScript syntax are checked.

Browser review used the actual component with synthetic data at desktop 1440×900 and mobile 320×844: request preview, exact-email form and keyboard focus progression were reviewed with no horizontal overflow. This is layout validation, not a real-account login/merge or email-delivery test. Local Stage restarted successfully; health returned OK and unauthenticated F035 access returned 401.

The approved local replica-set configuration retains the original data directory and Dev/Stage database names. No environment file was read/edited by the agent and no production configuration changed. Existing legacy families remain available separately. The read-only conversion preview is implemented; actual conversion remains pending a reviewed identity/unit/reference mapping. Accounts with unconverted legacy records are blocked from normalized creation/linking instead of producing parallel duplicate families.

Remaining limitations: real email delivery and owner browser acceptance remain unverified; interrupted email delivery claims are visible but not automatically retried; overlapping same-actor approvals are blocked for human review; conflicting unit details and unresolved multiple-pin choices block merge. Deletion is unit-scoped and explicitly detaches relationships; it never automatically copies person data. Historical/complex family placement is not inferred or automatically migrated. Review these local behaviors before marking Done.

## Owner-requested display terminology

Display the two contextual categories as Born-In Family (parents/siblings) and Spouse Family (partner/children). Internal formed/bornIn keys and stable unit IDs remain unchanged. Family X/Y are example labels only, not user-visible family types. Single-parent partner/children context remains supported under the Spouse Family display label.

## Final display names — owner decision

Use **Family Roots** for the Born-In context (parents and siblings), and **Family Blossoms** for the Spouse/Formed context (partner and children, including single-parent families). These supersede earlier display names; internal IDs, relationship rules and permissions remain unchanged.

## Owner-requested Family layout refinement

Group flows in Members, Feed, Sharing, Requests and Add relationship. Family Roots uses teal; Family Blossoms uses violet, always paired with names/icons. Use large category cards, consistent touch targets, member search, and progressive disclosure for member management and existing family records. Retain existing authorization, sharing and explicit consent semantics. No additional tests under the owner’s manual-review instruction.

Owner UI refinement: Your family circle shows read-only member cards within Family Roots and Family Blossoms, using a person icon placeholder, authorized name, viewer-relative relationship and age derived from an available birth date. Missing ages are labelled, never inferred. Existing authorized family records contribute summaries without being converted. No photograph upload or account access changes are introduced.

Owner UI refinement: rename Add relationship to Add family member with a person-plus icon. Present a focused category-colored form card, relationship placement explanation, native radio cards for without-account/existing-user/invite flows, and a distinct Cancel/submit footer. Existing invitation consent and role checks remain unchanged.

Owner refinement: Add family member asks for name, an explicit relationship selection, then role. No-account records need no email. READONLY/EDITOR/ADMIN reveal email and internally resolve an existing account or invitation. Matching families remain consent-gated; chosen roles activate only after acceptance and required merge approvals, preserving existing higher roles and rechecking initiating ADMIN for elevated grants.

Relationship dropdown groups: Parents (Mother/Father/Parent), Siblings (Brother/Sister/Sibling), Partner (Husband/Wife/Partner), Children (Son/Daughter/Child). Roots groups use teal; Blossoms groups use violet where native select styling supports it. Text labels preserve grouping regardless of platform color rendering.

Owner dropdown refinement: remove the generic Parent, Partner, Sibling and Child choices. Keep Mother/Father, Brother/Sister, Husband/Wife and Son/Daughter. Existing stored generic relationships and backend compatibility remain unchanged.

Owner color refinement: richer teal gradient headers for Family Roots and violet gradient headers for Family Blossoms, pale tinted member areas, stronger icon backgrounds and indigo selected navigation. Category labels/icons remain alongside color; styling changes do not affect permissions.

Relationship menu uses a custom labelled listbox so open options consistently show teal Roots and violet Blossoms. Supports arrow keys, Home/End, Escape, Enter/Space selection, Tab exit and outside-click dismissal.

Compact relationship menu: Roots groups in the left column, Blossoms groups in the right column; paired options within each group and shorter headings remove the menu scrollbar while retaining all eight choices.

Owner relationship tint refinement: Father/Brother/Husband/Son options use blue tints; Mother/Sister/Wife/Daughter options use pink tints. Category headings retain teal Roots and violet Blossoms; selected checkmarks and text labels remain.

Owner option layout refinement: male relationships appear on the left and female relationships on the right within every pair, with richer blue/pink backgrounds and darker text.

Your family circle cards reuse the blue/pink relationship tints for explicitly male/female relationship labels. Generic or unknown relationships retain neutral/category styling; names are never used to infer gender.

Owner count refinement: include a Self card in each applicable normalized circle and in both legacy family perspectives. Counts include Self, deduplicated by its known linked identity within each category, never by name. Self tint uses only recorded gender; missing age remains labelled. Expected owner counts are 5 Roots and 4 Blossoms, pending manual account verification.

Self cards use one distinctive amber treatment in both Roots and Blossoms, overriding relationship/gender tints while retaining the Self text label.

### Owner-requested relationship correction

ADMIN and EDITOR can correct a direct relationship through Member options → Correct relationship. The existing person, membership, relationship ID, account link, data and grants are preserved in a revision-checked transaction. READONLY cannot mutate. Pending requests, cross-circle moves, ambiguous direct relationships, dependent graph changes and inconsistent connected graphs block correction. Gendered labels remain person-wide: only an unlinked person belonging to one unit may have their gender corrected here; linked or multi-unit people require separate review. This limited owner refinement does not implement the broader Proposed F017 scope. Local owner review remains pending.

The Add family member form also offers a New or existing member selector across normalized family circles, including linked and NON_USER people. Selecting an existing member hides creation-only name/role/email fields and submits a relationship correction to that member's original unit with its current revision. It never falls through to creation or invitation. Existing correction safety constraints still apply; Self is excluded. Legacy records remain in their separate existing-record workflow.

Relationship-card refresh correction: refreshed normalized units take precedence over older compatibility views for the same unit ID. Management member cards show gendered relationship labels and matching blue/pink tints, with consistent amber Self cards.

Owner-requested member removal: ADMIN may preview and confirm removal of another linked or NON_USER member from the selected unit. Self removal is rejected. Linked accounts/private data and other unit memberships remain intact. Incident edges and this unit's grants involving the removed account are detached; visibility scopes and anchors remove that person; historical activity keeps name snapshots. Pending invitations/requests still block removal. Add form now displays the single-current-partner rule inline and blocks a second husband/wife; server creation and invitation paths enforce it before producing records or email.

Parent validation refinement: one father and one mother per person. The add form shows an inline error for a known duplicate parent. Server NON_USER creation, invitation, correction and connected-graph validation reject duplicate gendered parent identities. Existing duplicates are not automatically removed.

Family-circle cards now provide a compact accessible ellipsis Member options disclosure for normalized members. ADMIN/EDITOR can open existing detail/correction forms; ADMIN can preview removal of others. Actions select the card's own unit before opening, preserving unit-specific permissions and revision checks. Self offers details only; legacy records keep their existing controls.

Owner-approved layout simplification: remove the Active family circle dropdown and repeated Members list/navigation. Roots and Blossoms category cards select the context for Feed and Sharing; context changes retain an open Feed/Sharing section. Member detail/correction/removal actions remain on circle cards, with ADMIN role controls moved into their compact options menu. Requests remains a shared inbox. Existing legacy controls are retained.

Legacy disclosure visibility: Existing family records & invitations renders only for family IDs absent from the loaded normalized-unit list, or pending older invitations. Normalized records are excluded from its member view and family selector; normalized membership refresh also refreshes this classification. No API contracts or data are changed.

Owner-requested tree presentation: family-circle cards are grouped into Parents, You and siblings/partner, and Children rows, omitting empty rows. Decorative teal/violet branch lines indicate generation groupings; no inferred family relationships or database mutations are introduced. Existing blue/pink/amber card colors and permission-aware member menus remain. Narrow screens stack cards with branch guides.

Correct relationship now expands a compact form inside the originating family-circle card, with Save/Cancel and inline validation failures. It uses that card's unit ID/revision without changing the active Feed/Sharing context. Existing server safeguards remain. Relationship pickers use unique accessible IDs when multiple forms are present.

Edit family details now expands inside its originating member card, including Self: preferred name, birth date and family note, with Save/Cancel and inline errors. It uses the card's unit/revision and existing permissions without changing the Feed/Sharing context. The former bottom details form is removed.

Self age consistency: explicit Self birth-date edits use a canonical family-person birth date, reflected in all active normalized unit views/projections transactionally. Notes/preferred names remain unit-specific. Self card editing keys include unit ID so opening details in one circle does not open both cards. Existing per-unit dates are retained until an explicit Self save.

Self age compatibility: when only one distinct existing Self birth date is present in loaded family views, both Self cards and their edit forms reuse it for display. Conflicting dates are not reconciled automatically. This read-only fallback covers dates saved before canonical Self birth-date support; an explicit save persists the canonical value.

Member-options menu refinement: icon-led actions, compact heading, separated ADMIN role controls and distinct destructive styling. Mouse pointer exit closes the disclosure unless keyboard focus is active; focus exit and Escape also close it. Touch remains click-operated. Popover is anchored immediately below its trigger without a hover gap.

NON_USER role restriction: unlinked members show a Non User label instead of role assignment controls. The member-update API rejects role assignment until an account has been linked through the consent flow; existing stored roles are not automatically migrated.

Add-family-member simplification: creation chooses Non User versus email invitation, without ADMIN/EDITOR/READONLY role selection. Invited accounts default to READONLY after consent; authorized ADMIN role changes remain in member-card menus after linking. Existing-member relationship correction remains available.

Add form cleanup: remove the existing-member relationship-correction selector and its alternate submit path. Corrections are available only through member-card menus. Retain the optional NON_USER identity match in email invitations because it links an existing record rather than correcting a relationship or creating a duplicate. Validation guidance now points to card menus.

Owner-requested email lookup replaces the generic account-existence response rule for this authenticated flow only. POST /api/family/units/member-lookup accepts {email}, returns {found:boolean}, exposes no profile details, requires ADMIN for existing normalized members, and caps lookups at 30 per caller per UTC day. Add form searches on email blur or Find member, discards stale results, and displays found/not found. Sending remains explicit; the request endpoint rechecks existence before choosing relationship versus signup invitation and reports delivery status in Requests. No email is sent on field blur.

Email lookup layout: Find member is adjacent to the email field with a search icon. Enter triggers lookup and prevents form submission; email blur no longer triggers requests. Native email validity is checked; unchanged successful lookups are reused. Progress uses a subtle spinner/result entrance with reduced-motion support. Found/not-found feedback remains visible below the field; sending invitations remains explicit.

Add-member UX refinement: compact single-column flow, two accessible member-type choices first, name/email grouped together, then relationship and a small Roots/Blossoms badge. Optional linking of an existing NON_USER is collapsed. Lookup feedback and the final consent note are concise; the final footer separates Cancel from the primary action. Existing permissions and invitation semantics remain.
