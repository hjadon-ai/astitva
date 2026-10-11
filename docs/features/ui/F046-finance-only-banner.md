# F046: Finance-only environment banner

- **Status:** Review
- **Branch:** `feature/F046-finance-only-banner`
- **Pull request:** Not created

Owner approved removing the Plaid environment header outside Finance. Keep the existing Finance banner and its real-data warning; remove it from account verification and other workspace pages. Adjust shell spacing to avoid a blank header row on desktop and mobile. No backend changes.

Production build and diff whitespace checks passed. Local Chrome review confirmed no Plaid banner on Chat, correct mobile header spacing, and the Stage real-data warning retained on Finance. Preserve unrelated local work; no commit, push or deployment requested.
