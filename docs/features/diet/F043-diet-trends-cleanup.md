# F043: Diet Trends cleanup

- **Status:** Review
- **Branch:** `feature/F043-diet-trends-cleanup`
- **Pull request:** Not created

## Goal and approval

Owner approved the discussed duplicate nutrient-label and navigation cleanup with “go.” Keep one colored nutrient toggle/legend row and use the existing Diet workspace tabs for Daily Record and Your Plan navigation.

## Scope

Combine selected-day nutrient amounts into the top controls, preserving values, units, color indicators, pressed state and target-disabled behavior. Keep the selected date and entry counts. Remove the repeated lower nutrient row and redundant navigation buttons inside Nutrition Trends. No API, data, calculation or Weight Trends changes.

## Verification

Web production build and `git diff --check` passed. Existing large-bundle warning remains. Owner visual review: open Diet → Trends → Nutrition, select a day, toggle metrics and confirm one nutrient row with values and no repeated Daily Record/Review Your Plan buttons. No commits, pushes or deployment.

Owner-approved compact toolbar follow-up: remove the explanatory intake sentence and personal workspace heading row; place Manage Library beside the Diet tabs, outside the tablist, with mobile wrapping. Preserve shared-view heading and keyboard tab navigation.
