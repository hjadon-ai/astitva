# Efficient feature workflow

Use one active work branch for a cycle of features. Propose and approve features first, implement approved features on that branch, review and test them locally, then push the branch once. You create and merge the pull request. Only after the merge do we start a new branch from updated `main`.

Feature documents live in `docs/features/<category>/`; [README.md](README.md) tracks IDs and status. The [local Control Center](../../.local/control-center/README.md) at `http://127.0.0.1:4318` lets you review and approve proposals. Approval changes the documents to **Approved**; it does not start implementation.

## 1. Ask for FXX proposals

Specify a category and the outcome you want. This prompt creates review material only:

> Propose two new FXX features in `docs/features/<category>/` for **<goal>**. Read existing features first, use the next unused IDs, update the feature index, and include user flow, scope, acceptance criteria, and open questions. Mark them Proposed. Do not implement code, commit, or push.

Example: “Propose two new FXX features in `docs/features/ui/` to make the public and signed-in home pages more useful. Do not implement.”

Review each proposal in Control Center, answer its open questions, and click **Approve** for the features you want built. Leave unwanted or undecided proposals as Proposed.

## 2. Implement approved features

After approval, name the exact IDs. This avoids implementing other proposals in the same category:

> Implement the approved features **F019 and F028** on the current active work branch. Follow their approved documents and owner decisions. Run relevant automated checks and local Stage checks. Mark each implemented feature Done in its document and the feature index. Do not push yet; give me local review steps.

Use the IDs you actually approved. If testing reveals a defect, ask: “Fix the issue found while reviewing FXX, retest it, and keep the work on the active branch.” A feature marked Done means its implementation exists and relevant checks passed; it does not mean the PR was merged or deployed.

## 3. Review, extend, and push the cycle

You can request more proposals while reviewing implemented work:

> Propose the next FXX features in `docs/features/<category>/` based on the current feature set. Create proposal documents only; do not implement or push.

When the current batch is ready, request one final check and one push:

> Review all implemented FXX features on the active branch, run the relevant tests and local Stage checks, confirm their documents and index rows say Done, then commit and push **all pending changes** to that same branch. Do not push to `main` or merge. Give me the branch name and PR link for my review.

Open the PR, review it, and merge it into `main` yourself. Keep the current work branch until that merge is confirmed.

## 4. Start the next cycle after merge

> The PR for the active branch is merged into `main`. Verify the merge, update local `main`, clean up obsolete merged branches, and create one new active work branch from the updated `main`. Do not push the empty branch unless I ask.

Repeat steps 1–3 on the new branch. This keeps one review branch per cycle, avoids duplicate worktrees and repeated pushes, and keeps proposal approval separate from implementation.
