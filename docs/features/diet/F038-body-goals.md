# F038: Body & Goals

- **Status:** Review
- **Branch:** `feature/F038-body-goals`
- **Pull request:** Not created
- **Approval:** Owner approved the discussed Body & Goals scope and requested web/server implementation in chat. Proposed → Approved → In Progress.

## Goal
Let users record height and weight, estimate adult daily calorie needs from optional answers, and explore a weight goal before saving or applying a daily calorie target.

## User flow
Diet → Body & Goals → height/weight and measurement date → optional age, calculation sex and activity; adult eligibility for estimates → maintain/lose/gain with target weight and pace or date → preview → save. Applying the calorie estimate requires a separate confirmation.

## In scope
Metric/imperial inputs; BMI; optional daily weights before or after BMI setup; optional adult Mifflin–St Jeor estimate; bounded goal pace/date scenarios; transparent illustrative projection range; persistent dated weight records; actual-versus-planned comparison; recalculation from latest measurements; refreshing predictions from the latest weight without automatic calorie-target changes; explicit application to existing nutrition targets.

## Out of scope
Medical diagnosis, pediatric or pregnancy calorie plans, clinical metabolic modelling, automatic target changes, external integrations, deployment.

## Wireframe or UI changes
A responsive Body & Goals tab inside the daily workspace, hidden until selected and using the same directional flip, using existing surfaces, form fields, buttons and colors. Two-column form/results on desktop, stacked on mobile. Measurements, optional calorie questions and goal settings use consistent fields with inline errors. Results give a compact summary and links to Daily Record and Trends. Trends switches between Nutrition and Weight & prediction, including recorded weights, an updated prediction and exact values. Daily Record has an optional dated weight check-in. Confirmation dialogs render outside the flip faces, and inactive panels do not reserve blank height. Shared read-only Diet does not expose body records.

## API changes
GET /api/diet/body-goals returns complete profile (or null for weight-only setup), estimate, revision, latestWeight and weights. GET/PUT /weights/:date read/update optional weight with units and expectedRevision, without requiring height or calorie answers. Historical entries preserve the latest measurement; same-date edits replace one entry. POST /preview validates and calculates without persistence. PUT accepts canonical metric measurements, optional answers, goal and expectedRevision; returns saved profile and estimate. POST /apply-target accepts expectedRevision and applies the saved estimate with confirmation in the UI. Errors: 400 invalid input/ineligible projection, 409 stale revision or missing existing nutrition targets. All routes inherit Diet authentication, feature gates and managed ownership.

## MongoDB changes
dietBodyGoals: unique userId, revision, optional heightCm until BMI setup, canonical weightKg, measuredOn, preferred units, optional answers, goal fields, bounded 180 dated weight records. Managed records transfer on account claiming.

## Architecture decisions
Server is authoritative for calculations. Weight-only records use the same owner-scoped document and revision protection. Predictions need adult eligibility but do not require the optional calorie questions. Reaching a goal switches the proposed calorie estimate to maintenance; changes still require explicit application. BMI is a screening number, not a diagnosis. Activity factors are explicit assumptions. Projection uses selected weekly pace with an illustrative ±25% pace range, not a clinical prediction/confidence interval. Calorie adjustment uses a moderate percentage of estimated maintenance, separate from the pace scenario. Applying calories proportionally scales existing protein/carbohydrate/fat targets to preserve the current macro-derived calorie convention; fiber and water remain as configured. No new automatic defaults for missing macro targets.

Calculation reference: [original Mifflin–St Jeor study](https://pubmed.ncbi.nlm.nih.gov/2305711/). Adult/pregnancy eligibility follows the scope described by [NIDDK](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner); this app uses an illustrative pace scenario, not NIDDK’s clinical model. Product bounds are 0.1–0.5 kg/week and 1,200–6,000 proposed kcal/day; they do not imply suitability for each individual.

## Acceptance criteria
- Optional daily weights can be recorded before BMI setup, edited on the same day, and backdated without replacing the latest weight.
- Weight predictions in Trends refresh from the latest record, stop at the chosen target, and keep calorie changes explicit.
- Height/weight alone can be saved and produce BMI; optional fields can be omitted.
- Metric/imperial inputs describe the same canonical measurements.
- Preview never saves; saved fields and weight records survive reload.
- Invalid goal directions, excessive pace, stale saves, or ineligible calorie plans cannot apply targets.
- Applying a target requires confirmation and updates the Diet overview.
- Body data is scoped to the authorized Diet owner and managed claiming preserves it.

Owner-requested layout refinement: Daily Record / Overview / Trends / Body & Goals use a directional flip on click or keyboard selection. Panels stay mounted; initial load does not flip; reduced-motion preferences disable animation.

## Local verification
Passed: `node --test server/test/body-goals.test.js server/test/diet.test.js server/test/diet-history.test.js` (22 service/Diet checks; plus 5 focused web API/units checks); F038 integration test against a disposable replica-set fixture (persistence, authentication/feature denial, preview without writes, revision conflicts, target application, owner isolation, managed authorization and claiming transfer; standalone weights, same-date corrections, historical dates and goal completion); `npm --prefix web run build`; `git diff --check`. Existing bundle-size warning remains. API response tests cover HTML/malformed responses; missing API routes return JSON, and the Body & Goals form waits for a successful load before allowing preview/save. No browser surface was available for visual verification.

Owner local review: record or update an optional weight in Daily Record, switch to Trends → Weight & prediction, verify updated predictions and historical entries; open Diet → Body & Goals; preview/save height and weight; add optional answers; compare lose/maintain/gain and pace/date scenarios; switch units; reload to confirm persistence; apply a saved estimate with confirmation and check Overview. Daily nutrition targets must exist before application. New weights preserve the saved planned path for comparison; changing goal settings resets the path. No commit, push or deployment.

## Open questions
None for this implementation. Estimates remain approximate and owner-reviewable.
