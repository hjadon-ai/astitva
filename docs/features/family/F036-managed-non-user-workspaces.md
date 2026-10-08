# F036: Managed NON_USER workspaces

- **Status:** Review
- **Branch:** feature/F036-managed-non-user-workspaces
- **Pull request:** Not created

## Goal
ADMIN and EDITOR members co-manage one NON_USER's data without a separate account or login. The owner approved implementation and general/premium boundaries in this conversation.

## User flow
Select a Non User in the family-member selector, manage enabled general modules, and return to Self. Account members continue using explicitly shared read-only data.

## Scope and decisions
General: Diet, Daily Priorities, Family information. Premium: Finance, Anonymous Chat, Admin; always excluded. A central category registry governs future modules; unknown modules default to unavailable. Each manager's feature flags are evaluated independently. Family membership/merge consent remains an authenticated-account action; the managed Family screen provides information and family-detail editing only.

Stable family-person IDs own managed Diet/Priority records in the existing owner key, never the manager's account ID. No User, Session, credentials or Firebase identities are created. ADMIN/EDITOR membership in an active normalized unit is required on every request. Legacy records require reviewed conversion first. Mutation authorization and the data write share a MongoDB transaction.

## APIs
GET /api/family/units/managed-members lists eligible people.
GET /api/family/units/:unitId/people/:personId/managed-workspace returns general modules and family information.
Existing Diet/Priorities routes accept X-Astitva-Member and X-Astitva-Family headers. Both headers are required together; unauthorized, linked, unknown or premium contexts fail closed. Existing session and feature checks remain.

## Linking
Accepted account linking transfers the managed records transactionally from person ID to account ID. Existing recipient records cause a visible conflict instead of silent overwrite. Once linked, managed requests stop; future access requires fresh explicit consent through the sharing flow. Existing sharing currently grants read-only access, not continued co-editing.

## Acceptance criteria
Two authorized managers edit the same NON_USER Diet data; each sees only their enabled general features. READONLY, unrelated, removed and disabled managers are denied. Personal data remains separate. Premium/unknown routes cannot fall back to personal data. Return to Self restores normal modules. Linking preserves record IDs, transfers ownership and revokes automatic management.

## Local verification
Frontend build passed. The isolated F036 integration fixture passed: co-editing, personal ownership separation, READONLY/disabled-feature denial, premium-route rejection, managed family edits, account claim/data transfer and revoked management. Fixture data was removed after the check. No browser review or production changes.

Existing account data or a previously established family identity blocks claiming for manual conflict review. Existing sharing is read-only; continued editing-consent permissions are not implemented. General Family management exposes member information/details; relationship/merge actions remain in Self. Future general modules need category registration and a managed data adapter. Managed data is preserved when a member record loses its last membership.

## Open questions
None for the approved general-feature scope.

Selector metadata correction: managed NON_USER entries now include viewer-relative family context from their direct relationship, matching account entries. Family Roots/Family Blossoms names render separately from member-type badges. No family type is inferred from a person's name.

Managed Family now reuses the selected-member tree template and existing card colors instead of a separate information list. The selected NON_USER is Self; parent/child directions and family branches use their perspective. Full sibling display may be derived only when both people have exactly the same two explicitly recorded parents; no name-based or half-sibling inference. Only eligible unit members appear. Self family-detail editing remains available to authorized managers; account-shared views remain read-only.

Relative-view consistency: all selected-member views share the same perspective calculation. Explicit full-sibling components propagate their recorded parents and sibling links for display only, with ambiguous/conflicting parent sets left unchanged. No half/step-family or partner relationship is inferred, and no stored graph is modified. Shared views calculate within their explicit scope. Unplaced people use consistent member cards; switching managed people resets component state.

### Family perspective consistency review

Personal, shared and managed normalized family views use the same relationship perspective calculation. Synthetic coverage checks each parent and child, both sibling directions, full-sibling generation placement and the explicit sharing boundary. Co-parenthood alone does not establish a partner relationship. Missing relationships remain unclassified rather than inventing a spouse. Managed detail saves return the new revision so another save does not reuse an obsolete revision. No family data or sharing grants are changed by this display correction. Browser review and exhaustive validation of historical family graphs remain pending owner review.

Co-parents with a common recorded child appear together in Family Blossoms, labelled Co-parent unless an explicit partner relationship exists. This is a display derivation; it does not record marriage or broaden a sharing grant.
