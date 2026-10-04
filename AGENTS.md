# Repository instructions

## Git delivery

- Never push commits directly to `main` or merge a pull request on the user's behalf.
- This is a single-engineer project. Use one active work branch for all pending changes, including multiple features and fixes. On the first work of each new day (America/Los_Angeles), and after every successful branch push, fetch origin, update local `main` by fast-forwarding to `origin/main`, and create the next work branch from updated `main`.
- Name work branches `feature/changes_DD-Mmm-YYYY` (for example, `feature/changes_03-Oct-2026`) using the America/Los_Angeles date and English month abbreviations. If that name already exists, append `_2`, `_3`, etc. Reuse the active branch within the day until it is pushed; do not create a branch for each task or feature.
- Preserve all uncommitted work when rotating branches. If the previous branch contains commits not yet in `main`, carry those commits onto the new branch without losing them. Use an extra worktree only when needed to protect unrelated uncommitted changes.
- Push only the active work branch when the user requests a push.
- After pushing, give the user the branch name and ask them to create and review a pull request. The user merges the pull request manually.
- Preserve unrelated uncommitted work when creating branches or preparing changes.

## Efficient work

- Read the smallest relevant set of files and instructions; search for exact symbols before opening broad directories.
- Batch independent reads and checks. Avoid repeating completed investigation or tests unless a change affects them.
- Make focused edits and run only checks that address a real risk or a required project gate.
- Keep updates and final reports concise. Avoid extra artifacts, duplicate documentation, and unnecessary tool calls.

## Feature status

- When implementing an approved FXX feature at the user's request, finish the implementation and mark both its feature document and `docs/features/README.md` row **Done** in the same work. Do not mark a proposal Done before its implementation exists.
