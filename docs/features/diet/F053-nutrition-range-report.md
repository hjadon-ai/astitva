# F053: Nutrition report by date range

- **Status:** Review
- **Branch:** `feature/F053-nutrition-range-report`
- **Pull request:** Not created

## Approved scope

Owner approved GET `/api/diet/reports/nutrition` with required inclusive `start`/`end` calendar dates (YYYY-MM-DD), optional `mealType` (breakfast/lunch/dinner/snack) and optional comma-separated `nutrients` (calories, proteinGrams, carbohydrateGrams, fatGrams, fiberGrams). Omission selects all meal types/nutrients. Maximum 366 inclusive days. Returns range totals, meal count and chronological daily totals, including zero days. Invalid/unknown/repeated parameters and duplicate nutrient selections return 400. No user ID input, UI or MCP tool added.

## Authorization and calculation

Uses existing Diet session, verified-email, feature and managed-workspace authorization. The authenticated/authorized `dietUserId` constrains MongoDB aggregation. Personal calls return only the logged-in account; authorized managed calls use the existing resolved member context. Calendar dates need no timezone conversion. Sum recorded portion nutrition without multiplying quantity. Integer scaled sums preserve one-decimal grams and whole calories. Response uses no-store. No schema/index or provider configuration change.

## Try in Postman

GET `{{baseUrl}}/api/diet/reports/nutrition?start=2026-10-01&end=2026-10-31&mealType=lunch&nutrients=proteinGrams,fiberGrams`

Use Authorization: Bearer `{{sessionToken}}` from the normal application login, or the existing session cookie. This is an application API, not MCP OAuth. Omit mealType/nutrients for all recorded meals and all five fields. Totals describe recorded intake, not estimated or target values.

## Verification

Focused report tests: 3 passed, including isolated MongoDB/HTTP tests for session expiry, verification, feature denial, forged workspace denial, owner isolation, date boundaries, filtered/all totals and quantity handling. Full server suite: 69 passed, 13 opt-in tests skipped. Whitespace check passed. Initial focused run exceeded the startup timeout under machine load; it passed with a larger timeout. Local Stage runs from `/Users/harendrakumar/Developer/Astitva`; F052 architecture work remains separate. No commit, push or deployment performed. Only the owner may mark Done after review/merge.

## Postman authentication follow-up

The report collection request now uses the saved login cookie by default, matching Get day. Removed its forced Bearer variable header: missing/expired variables override a valid cookie and cause 401. Cookie-free callers can explicitly configure a valid application bearer session in Postman. Server authentication is unchanged.
