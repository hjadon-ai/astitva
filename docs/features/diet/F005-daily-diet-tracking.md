# F005: Daily diet tracking

- **Status:** Review
- **Branch:** `feature/F005-daily-diet-tracking`
- **Pull request:** Not created

## Goal

Add a private diet page where a logged-in, verified user can record meals, see daily nutrition totals, and compare intake with personal daily targets. Keep the first version focused on manual entry and a clear daily summary.

## User flow

1. The user opens **Diet** from the profile navigation.
2. The page opens on the user's local calendar date.
3. The user can set daily targets for calories, protein, carbohydrates, fat, and fiber.
4. The user adds a meal with its name, meal type, serving description, and nutrition values.
5. The page lists the day's meals, recalculates the nutrition summary, and highlights values above their targets.
6. The user can move to another date and can edit or delete an incorrect meal.

## In scope

- Add **Diet** to the authenticated profile navigation.
- Show one day at a time with previous-day, next-day, and today controls.
- Add meals manually.
- Use the meal types Breakfast, Lunch, Dinner, and Snack.
- Record calories, protein, carbohydrates, fat, and fiber for each meal.
- Allow an optional serving description such as `1 bowl` or `250 g`.
- Allow the user to set daily targets for calories, protein, carbohydrates, fat, and fiber.
- Show consumed amounts against daily targets.
- Clearly identify values that exceed their targets and show the amount over target.
- List meals grouped by meal type.
- Edit and delete meals.
- Keep all data private to the authenticated user.
- Update OpenAPI and Postman documentation when implemented.

## Out of scope

- Food search or an external nutrition provider
- Barcode scanning
- Automatic nutrition calculation from ingredients
- Meal photographs
- Micronutrients such as vitamins and minerals
- Suggested nutrition targets, medical warnings, or medical advice
- Weekly and monthly reports
- Data export

## Wireframe or UI changes

Add **Diet** to the existing profile sidebar below **Overview**.

```text
┌──────────────┬────────────────────────────────────────────────────┐
│ Astitva.     │ Daily diet                                        │
│              │ ‹ Previous   [ Sep 21, 2026 ]   Today   Next ›    │
│ Overview     │                                                    │
│ Diet         │ [ Calories ] [ Protein ] [ Carbs ] [ Fat ]       │
│ Projects     │ [1840/2000]  [92/100 g]  [210/240] [58/65]       │
│ Notes        │                                                    │
│              │ Fiber 34/30 g · 4 g over target                  │
│              │              [ Edit targets ] [ + Add meal ]      │
│              │                                                    │
│              │ Breakfast                                         │
│              │ Oatmeal · 1 bowl        420 kcal · P 18 · C 62   │
│              │                                      Edit  Delete │
│              │                                                    │
│              │ Lunch                                             │
│              │ Rice and vegetables     610 kcal · P 24 · C 88   │
└──────────────┴────────────────────────────────────────────────────┘
```

The **Add meal** action opens a small inline form containing:

- Meal name
- Meal type
- Serving description (optional)
- Calories
- Protein in grams
- Carbohydrates in grams
- Fat in grams
- Fiber in grams
- Save and Cancel actions

When no meals exist, show an empty state explaining that the daily totals will appear after the first meal is added. If targets have not been configured, show a small prompt to set them.

## API changes

All endpoints require an authenticated, verified user. Dates use `YYYY-MM-DD` in the user's local calendar.

### Get one day's diet

`GET /api/diet/days/{date}`

Response `200`:

```json
{
  "date": "2026-09-21",
  "totals": {
    "calories": 420,
    "proteinGrams": 18,
    "carbohydrateGrams": 62,
    "fatGrams": 12,
    "fiberGrams": 8.5
  },
  "targets": {
    "calories": 2000,
    "proteinGrams": 100,
    "carbohydrateGrams": 240,
    "fatGrams": 65,
    "fiberGrams": 30
  },
  "overTarget": {
    "calories": 0,
    "proteinGrams": 0,
    "carbohydrateGrams": 0,
    "fatGrams": 0,
    "fiberGrams": 0
  },
  "meals": [
    {
      "id": "meal-id",
      "name": "Oatmeal",
      "mealType": "breakfast",
      "servingDescription": "1 bowl",
      "nutrition": {
        "calories": 420,
        "proteinGrams": 18,
        "carbohydrateGrams": 62,
        "fatGrams": 12,
        "fiberGrams": 8.5
      }
    }
  ]
}
```

Responses:

- `200`: Return meals and calculated totals. An empty day returns zero totals and an empty list.
- `400`: The date is invalid.
- `401`: Authentication is required.
- `403`: Email verification is required.

If targets have not been configured, `targets` is `null` and `overTarget` is `null`.

### Add a meal

`POST /api/diet/meals`

Request:

```json
{
  "date": "2026-09-21",
  "name": "Oatmeal",
  "mealType": "breakfast",
  "servingDescription": "1 bowl",
  "nutrition": {
    "calories": 420,
    "proteinGrams": 18,
    "carbohydrateGrams": 62,
    "fatGrams": 12,
    "fiberGrams": 8.5
  }
}
```

Responses:

- `201`: Meal created and returned.
- `400`: A required value is missing, invalid, or negative.
- `401`: Authentication is required.
- `403`: Email verification is required.

### Save daily nutrition targets

`PUT /api/diet/targets`

Request:

```json
{
  "calories": 2000,
  "proteinGrams": 100,
  "carbohydrateGrams": 240,
  "fatGrams": 65,
  "fiberGrams": 30
}
```

Responses:

- `200`: Targets created or updated and returned.
- `400`: A target is missing, invalid, or not greater than zero.
- `401`: Authentication is required.
- `403`: Email verification is required.

### Edit a meal

`PATCH /api/diet/meals/{mealId}`

Accept the same editable fields as the add-meal request. The user may change the meal's date.

Responses:

- `200`: Meal updated and returned.
- `400`: A supplied value is invalid.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `404`: The meal does not exist for the authenticated user.

### Delete a meal

`DELETE /api/diet/meals/{mealId}`

Responses:

- `204`: Meal deleted.
- `401`: Authentication is required.
- `403`: Email verification is required.
- `404`: The meal does not exist for the authenticated user.

## MongoDB changes

### `dietMeals`

Store one document per meal:

- `userId`: reference to the user and part of the ownership query.
- `consumedOn`: local calendar date stored as a `YYYY-MM-DD` string.
- `name`: required meal name, maximum 120 characters.
- `mealType`: `breakfast`, `lunch`, `dinner`, or `snack`.
- `servingDescription`: optional text, maximum 80 characters.
- `calories`: non-negative number.
- `proteinGrams`: non-negative number.
- `carbohydrateGrams`: non-negative number.
- `fatGrams`: non-negative number.
- `fiberGrams`: non-negative number.
- `createdAt`: creation time.
- `updatedAt`: last update time.

Create an index on `userId` and `consumedOn`. Daily totals are calculated from meal documents and are not stored separately.

### `dietNutritionTargets`

Store one document per user:

- `userId`: unique reference to the user.
- `calories`: positive whole-number daily target.
- `proteinGrams`: positive daily target with at most one decimal place.
- `carbohydrateGrams`: positive daily target with at most one decimal place.
- `fatGrams`: positive daily target with at most one decimal place.
- `fiberGrams`: positive daily target with at most one decimal place.
- `createdAt`: creation time.
- `updatedAt`: last update time.

## Architecture decisions

- Use manual nutrition entry for the first version.
- Calculate daily totals on the server from the day's meals.
- Calculate target comparisons on the server. Each `overTarget` value is zero until consumption exceeds its target, then contains the amount over target.
- Store the calendar date separately from timestamps so a meal stays on the day selected by the user.
- Query every meal by both its ID and authenticated user ID to enforce ownership.
- Store calories as whole numbers. Allow protein, carbohydrates, fat, and fiber in grams with at most one decimal place.
- Use the same user-configured targets for every day in the first version; historical target changes are not tracked.
- Do not treat the page as a source of medical or dietary guidance.

## Acceptance criteria

- A verified user can open **Diet** from the profile page.
- The page defaults to the user's local calendar date.
- A user can add, edit, and delete a meal.
- Each meal records calories, protein, carbohydrates, fat, and fiber.
- Daily totals equal the sum of the displayed meals.
- A user can create and update personal daily nutrition targets.
- The summary shows consumed values against targets and clearly shows amounts over target.
- Moving between dates shows only meals for the selected date.
- An empty date shows zero totals and a useful empty state.
- One user cannot read or change another user's meals.
- Invalid dates, meal types, and negative nutrition values are rejected.
- The endpoints are documented in OpenAPI and Postman.
- The complete feature runs locally with MongoDB.

## Local verification

Implementation is ready for the project owner's manual testing. Build and syntax checks passed; the complete authenticated diet flow has not been manually tested by the assistant.

1. Open http://localhost:3000, log in with a verified account, then choose **Diet** from profile navigation.
2. Confirm today shows an empty state and zero totals if no meals exist.
3. Save all five targets, add a meal with fiber, and compare totals with the entered values.
4. Add another meal to exceed a target and confirm the over-target amount.
5. Edit a meal, including its date; navigate to both dates and check the totals.
6. Delete a meal using the confirmation and confirm totals refresh.
7. Reload and check persistence; check the Diet link on a narrow screen.
8. In Postman, log in, set `dietDate`, and run requests in the Diet folder. Add meal captures `mealId` automatically.
9. With another verified account, confirm the first account's meal IDs return 404 for edit/delete. Without login expect 401; with an unverified account expect 403.
10. Try negative numbers, invalid calendar dates, fractional calories, and grams with more than one decimal place; expect 400.

The five API operations are linked from `server/design/openapi.yaml` to `server/design/diet.openapi.json`. Keep both files together when importing the API definition. Meal mutation responses use `{ "meal": ... }`; target responses use `{ "targets": ... }`. PATCH merges supplied nutrition fields. Current targets apply to past days too.

## Open questions

None. The scope and architecture decisions are approved for implementation.
