# Repository instructions

## Git delivery

- Never push commits directly to `main` or merge a pull request on the user's behalf.
- Implement one explicitly Approved feature at a time on `feature/F###-short-name`. Resume interrupted work on its existing branch before selecting another feature.
- No shared daily or cycle implementation branches. Preserve historical branch names.
- Preserve unrelated work. Use an isolated worktree when needed to protect unrelated changes.
- Push only the active work branch when the user requests a push.
- After pushing, give the user the branch name and ask them to create and review a pull request. The user merges the pull request manually.
- Preserve unrelated uncommitted work when creating branches or preparing changes.

## Efficient work

- Read the smallest relevant set of files and instructions; search for exact symbols before opening broad directories.
- Batch independent reads and checks. Avoid repeating completed investigation or tests unless a change affects them.
- Make focused edits and run only checks that address a real risk or a required project gate.
- Keep updates and final reports concise. Avoid extra artifacts, duplicate documentation, and unnecessary tool calls.

## Feature status

- Follow Proposed → Approved → In Progress → Review → Done. Mark the document and index In Progress while implementing and Review when ready for owner review. Only the owner may move Review to Done by confirmation after manual review/merge. Preserve historical Done records.
