# Repository instructions

## Git delivery

- Never push commits directly to `main` or merge a pull request on the user's behalf.
- This is a single-engineer project. Use one active work branch created from the latest `main` for all pending changes, including multiple features and fixes. Reuse it until the user merges its pull request into `main`; only then update from `main` and create the next work branch.
- Do not create a new branch for each task or feature. If an active work branch already exists, add authorized work there. Use an extra worktree only when needed to protect unrelated uncommitted changes.
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
