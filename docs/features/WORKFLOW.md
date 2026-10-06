# Feature workflow

Implement one explicitly Approved feature at a time on `feature/F###-short-name`. Resume interrupted work on its existing branch before selecting another feature. No shared daily or cycle implementation branches. Preserve unrelated work and historical Done/branch records.

Feature documents live in `docs/features/<category>/`; [README.md](README.md) tracks IDs and status. The [local Control Center](../../tools/control-center/README.md) supports proposal review and manual dry-run planning at `http://127.0.0.1:4318`. Approval authorizes scope; it does not start implementation.

## 1. Propose and approve

> Propose an F### feature for <goal>. Read existing features, use the next available ID and the template, and update the index. Do not implement, commit or push.

The owner explicitly approves scope and supplies High, Medium or Low priority, a timezone-qualified approval timestamp and explicit dependencies. Planning metadata may change without changing scope. Never infer approval dates. Proposed work is ineligible.

## 2. Implement approved scope

> Implement the approved F019 document. Reuse or create `feature/F019-family-invitation-management`. Mark the document and index In Progress while working. Run appropriate checks and mark Review when ready for me. Preserve unrelated changes. Do not commit or push.

This example does not authorize starting F019. Interrupted In Progress work reserves the implementation slot. Unsafe or ambiguous conditions require a visible blocker and owner action.

## 3. Owner review and publication

Review means implementation and validation are ready for the owner, not Done or deployed. Commit and push only when explicitly requested, limited to the feature. Never push main, create a PR without authorization, or merge on the owner's behalf. The owner creates/reviews the PR and merges manually.

Only the owner may move Review to Done by confirmation after manual review/merge; update both document and index on that confirmation. Historical Done records remain valid dependencies.

## 4. Next feature

After owner confirmation, the next approved feature uses its own `feature/F###-short-name` branch. Preserve unrelated work and verify the intended base. F033 remains manual dry-run only: no scheduled implementation, Codex execution, commits, pushes, PRs, merges or automatic fixes are authorized by evaluation.
