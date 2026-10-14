# F047: Remove Daily Priorities

- **Status:** Review
- **Branch:** `feature/F047-remove-daily-priorities`
- **Pull request:** Not created

## Approved scope

Owner requested removing Daily Priorities everywhere in the product and listing its MongoDB collections for manual Production cleanup. Remove UI, navigation, home shortcuts, Admin flags, managed-workspace access, backend routes/model/services, feature-specific tests and API tooling. Preserve historical Done feature records. No database deletion, push or deployment authorized.

## Production cleanup after deployment

Only dedicated collection retired: `dailyPriorityDays`. Owner may manually drop it after deploying the removal. Optional cleanup: unset the obsolete `priorities` Boolean field in `invitedEmails` documents; retain that collection and its other feature flags. No database data is deleted by this implementation.

## Verification

Web tests: 32 passed. Production web build passed. Server tests: 67 passed, 12 opt-in integration tests skipped. Regression checks cover retired-route 404 responses and ignoring/rejecting legacy permission flags. Git diff whitespace check passed.
