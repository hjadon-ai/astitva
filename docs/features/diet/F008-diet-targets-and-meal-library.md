# F008: Diet targets and Meal Library

- **Status:** Approved
- **Branch:** Not created
- **Pull request:** Not created

## Goal

Enhance the existing F005 Diet page with clearer nutrition targets, daily water tracking, and a personal library of reusable meals. Keep F005 manual meal entry and daily history intact while making repeated meals faster to record.

## User flow

1. The verified user opens **Diet** and sees the existing selected-day summary and meals.
2. The user reviews or edits daily targets for calories, protein, carbohydrates, fat, fiber, and water.
3. While editing targets, a deterministic calculator shows the calorie contribution of the three macros: protein at 4 kcal/g, carbohydrates at 4 kcal/g, and fat at 9 kcal/g.
4. The user records water with a quick-add amount or a custom amount and sees progress against the daily water target.
5. The user can continue adding a one-off meal manually with the existing F005 form.
6. The user opens **Meal Library** to create, view, update, or delete a reusable one-serving meal.
7. The user can upload a CSV file, review valid and invalid rows, and explicitly confirm which valid rows to import before any meals are saved.
8. From the library, the user selects **Add to today**, adjusts the quantity, and confirms the meal type and date.
9. A scaled copy of the library meal is stored in that day's diet record. Later library edits or deletion do not alter the historical daily record.

## In scope

- Preserve all F005 functionality, including manual meal entry, editing, deletion, date navigation, daily totals, and target comparisons.
- Extend personal daily targets to include water in milliliters.
- Show targets for calories, protein, carbohydrates, fat, fiber, and water.
- Calculate target macro calories as:
  - `proteinGrams × 4`
  - `carbohydrateGrams × 4`
  - `fatGrams × 9`
  - `macroCalories = proteinCalories + carbohydrateCalories + fatCalories`
- Show the difference between `macroCalories` and the calorie target without silently changing either value.
- Define `differenceFromCalorieTarget` as macro-calorie total minus calorie target: negative means below target and positive means above target.
- Explain that fiber is displayed separately and is not included in this first calculator, and that food-label calories can differ because of rounding and other nutrients.
- Add daily water intake using quick amounts of 250 ml and 500 ml plus a custom positive amount.
- Allow an incorrect water entry to be deleted.
- Add a private Meal Library for each authenticated, verified user.
- Create, list, view, update, and delete library meals.
- Store one defined serving per library meal.
- Store name, category, serving description, calories, protein, carbohydrates, fat, fiber, optional ingredients, and optional notes.
- Use the categories `breakfast`, `lunch`, `dinner`, and `snack`.
- Search library meals by name and filter by category.
- Add a library meal to the selected day, defaulting to today when launched through **Add to today**.
- Allow a quantity greater than zero with up to two decimal places when adding a library meal to a day.
- Copy and scale the library meal's nutrition into the daily diet record at the time it is added.
- Round scaled calories to the nearest whole calorie and scaled macro/fiber grams to one decimal place.
- Import library meals from a UTF-8 CSV file after a preview and explicit confirmation.
- Validate every CSV row and show normalized valid rows separately from invalid rows and their errors.
- Import only the valid rows selected by the user; never save data during preview.
- Limit a CSV file to 1 MB and 500 data rows for the first version.
- Keep all data in local MongoDB and all APIs on the local Express server.
- Update OpenAPI and Postman definitions when this feature is later implemented.

## Out of scope

- Replacing or removing F005 manual meal entry
- Suggested nutrition targets, meal plans, medical guidance, or medical warnings
- Automatically adjusting macros to force an exact calorie match
- Including fiber in the deterministic calorie formula
- Ounces, cups, or automatic unit conversion for water
- Weekly or monthly nutrition reports
- Shared, public, or household Meal Libraries
- Multiple serving definitions for one library meal
- Recipes with independently calculated ingredient nutrition
- Excel, PDF, image, barcode, or scanned-document import
- AI-based meal or nutrition extraction
- External food or nutrition APIs
- Automatic duplicate merging
- Exporting the Meal Library
- Remote hosting, deployment, or cloud storage

## Wireframe or UI changes

Keep Diet within the existing authenticated profile layout. The selected day and existing daily meal groups remain the primary content.

```text
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Astitva.     │ Daily diet                                              │
│              │ ‹ Previous   [ Sep 22, 2026 ]   Today   Next ›          │
│ Overview     │                                                          │
│ Diet         │ Daily Targets                         [ Edit targets ]    │
│ Finance      │ Calories 1840 / 2000 kcal                                │
│              │ Protein 92 / 100 g · Carbs 210 / 240 g · Fat 58 / 65 g │
│              │ Fiber 28 / 30 g                                         │
│              │ Macro target: 400 + 960 + 585 = 1945 kcal               │
│              │ Calorie target difference: 55 kcal                      │
│              │                                                          │
│              │ Water                                     1250 / 2000 ml │
│              │ [ +250 ml ] [ +500 ml ] [ Custom ]   750 ml remaining  │
│              │                                                          │
│              │ [ + Add meal ] [ Meal Library ] [ Import meals ]        │
│              │                                                          │
│              │ Breakfast                                                │
│              │ Oatmeal · 1 bowl               420 kcal · P18 C62 F12  │
│              │                                             Edit  Delete │
└──────────────┴──────────────────────────────────────────────────────────┘
```

**Edit targets** keeps six explicit inputs and displays the formula while the user types:

```text
Daily targets
Calories [ 2000 ] kcal       Fiber [ 30 ] g
Protein  [ 100  ] g × 4 = 400 kcal
Carbs    [ 240  ] g × 4 = 960 kcal
Fat      [ 65   ] g × 9 = 585 kcal
Macro target total: 1945 kcal · 55 kcal below calorie target
Water    [ 2000 ] ml

[ Cancel ] [ Save targets ]
```

**Meal Library** opens as a section on the Diet page rather than a new profile route:

```text
Meal Library
[ Search meals... ] [ All categories ▾ ] [ Add meal ] [ Import CSV ]

Oatmeal bowl · Breakfast · 1 bowl
420 kcal · Protein 18 g · Carbs 62 g · Fat 12 g · Fiber 8.5 g
[ Add to today ] [ Edit ] [ Delete ]
```

**Add meal** offers the existing one-off manual form and a library choice:

```text
Add meal
[ Enter manually ] [ Choose from Meal Library ]

Selected: Oatmeal bowl · one serving = 1 bowl
Quantity [ 1.5 ]     Meal type [ Breakfast ▾ ]
For date [ 2026-09-22 ]
Result: 630 kcal · P27 g · C93 g · F18 g · Fiber 12.8 g

[ Cancel ] [ Add to day ]
```

**Import Meals** previews the CSV before saving:

```text
Import Meal Library CSV
[ Choose CSV file ]

Valid rows (18)                         Invalid rows (2)
✓ Row 2 · Oatmeal bowl                  Row 7 · category is invalid
✓ Row 3 · Chicken and rice              Row 11 · calories is required

Nothing has been saved yet.
[ Cancel ] [ Import 18 valid meals ]
```

## API changes

All endpoints require an authenticated, verified user. Ownership is enforced using the authenticated user ID. Dates continue to use `YYYY-MM-DD` in the user's local calendar.

### Extend daily targets

`PUT /api/diet/targets`

Extend the F005 request with `waterMilliliters`:

```json
{
  "calories": 2000,
  "proteinGrams": 100,
  "carbohydrateGrams": 240,
  "fatGrams": 65,
  "fiberGrams": 30,
  "waterMilliliters": 2000
}
```

Response `200` includes the saved targets and a calculated, non-persisted breakdown:

```json
{
  "targets": {
    "calories": 2000,
    "proteinGrams": 100,
    "carbohydrateGrams": 240,
    "fatGrams": 65,
    "fiberGrams": 30,
    "waterMilliliters": 2000
  },
  "macroCalories": {
    "protein": 400,
    "carbohydrates": 960,
    "fat": 585,
    "total": 1945,
    "differenceFromCalorieTarget": -55
  }
}
```

The macro/calorie difference is informational and does not make an otherwise valid target request fail.

### Extend one day's diet

`GET /api/diet/days/{date}`

Extend the F005 response with:

```json
{
  "water": {
    "consumedMilliliters": 1250,
    "targetMilliliters": 2000,
    "remainingMilliliters": 750,
    "overTargetMilliliters": 0,
    "entries": [
      {
        "id": "water-entry-id",
        "amountMilliliters": 250,
        "createdAt": "2026-09-22T15:30:00.000Z"
      }
    ]
  },
  "macroCalories": {
    "protein": 400,
    "carbohydrates": 960,
    "fat": 585,
    "total": 1945,
    "differenceFromCalorieTarget": -55
  }
}
```

If targets have not been saved, target-derived water and macro comparison values are `null`; consumed water and water entries are still returned.

### Record water

`POST /api/diet/water-entries`

```json
{
  "date": "2026-09-22",
  "amountMilliliters": 250
}
```

Responses:

- `201`: Water entry created and returned.
- `400`: Date or amount is invalid.
- `401`: Authentication is required.
- `403`: Email verification is required.

### Delete a water entry

`DELETE /api/diet/water-entries/{entryId}`

Responses: `204`, `401`, `403`, or `404` when the entry does not belong to the user.

### List library meals

`GET /api/diet/library-meals?search=oat&category=breakfast`

Return the user's meals sorted by name. Both query parameters are optional. The first version returns at most 200 matches and includes `hasMore` if the limit is reached.

### Create a library meal

`POST /api/diet/library-meals`

```json
{
  "name": "Oatmeal bowl",
  "category": "breakfast",
  "servingDescription": "1 bowl",
  "nutrition": {
    "calories": 420,
    "proteinGrams": 18,
    "carbohydrateGrams": 62,
    "fatGrams": 12,
    "fiberGrams": 8.5
  },
  "ingredients": "Rolled oats; milk; berries",
  "notes": "Usual weekday serving"
}
```

Responses: `201`, `400`, `401`, `403`, or `409` for a duplicate normalized name owned by the user.

### View, update, and delete one library meal

- `GET /api/diet/library-meals/{mealId}` returns `200` or `404`.
- `PATCH /api/diet/library-meals/{mealId}` accepts the create fields and returns `200`, `400`, `404`, or `409`.
- `DELETE /api/diet/library-meals/{mealId}` returns `204` or `404`.

Deleting a library meal does not delete or update any daily diet meal previously copied from it.

### Add a library meal to a day

`POST /api/diet/library-meals/{mealId}/add-to-day`

```json
{
  "date": "2026-09-22",
  "mealType": "breakfast",
  "quantity": 1.5
}
```

Response `201` returns the new independent daily meal with its copied and scaled nutrition. Responses also include `400`, `401`, `403`, and `404`. The operation reads the library meal and creates the daily snapshot in one server request.

### Preview a CSV import

`POST /api/diet/library-meals/import-preview`

Accept `multipart/form-data` with one `file` field. Required header names are:

```text
name,category,servingDescription,calories,proteinGrams,carbohydrateGrams,fatGrams,fiberGrams,ingredients,notes
```

`ingredients` and `notes` values may be blank. Response `200` includes `fileName`, `totalRows`, normalized `validRows`, and `invalidRows`. Each invalid row contains its original row number and field-level errors. Preview never writes to MongoDB.

Responses also include:

- `400`: Missing file, invalid CSV syntax, missing/duplicate headers, empty file, or no data rows.
- `413`: File exceeds 1 MB or 500 data rows.
- `415`: File is not a CSV upload.

### Confirm a CSV import

`POST /api/diet/library-meals/import`

```json
{
  "rows": [
    {
      "sourceRowNumber": 2,
      "name": "Oatmeal bowl",
      "category": "breakfast",
      "servingDescription": "1 bowl",
      "calories": 420,
      "proteinGrams": 18,
      "carbohydrateGrams": 62,
      "fatGrams": 12,
      "fiberGrams": 8.5,
      "ingredients": "Rolled oats; milk; berries",
      "notes": ""
    }
  ]
}
```

The server revalidates every submitted row. If any submitted row is invalid, nothing is saved and `400` returns the row errors. If all rows are valid, the server inserts them atomically and returns `201` with the imported count and created meals. A duplicate against the existing library or another submitted row returns `409` and saves nothing.

## MongoDB changes

### `dietNutritionTargets`

Add:

- `waterMilliliters`: positive whole-number daily target. Existing F005 target documents may omit it until the user saves the enhanced target form; new and updated F008 target documents require it.

Do not persist macro-calorie calculations; calculate them deterministically from the stored protein, carbohydrate, fat, and calorie targets.

### `dietWaterEntries`

Store one document per intake action:

- `userId`: required owner reference.
- `consumedOn`: required local date as `YYYY-MM-DD`.
- `amountMilliliters`: required positive whole number.
- `createdAt`: creation time.
- `updatedAt`: last update time.

Create an index on `userId` and `consumedOn`. Daily water totals are calculated from these entries.

### `dietLibraryMeals`

Store one document per reusable meal:

- `userId`: required owner reference.
- `name`: required trimmed name, maximum 120 characters.
- `normalizedName`: server-generated lowercase name with collapsed whitespace.
- `category`: `breakfast`, `lunch`, `dinner`, or `snack`.
- `servingDescription`: required text, maximum 80 characters.
- `calories`: non-negative whole number.
- `proteinGrams`: non-negative number with at most one decimal place.
- `carbohydrateGrams`: non-negative number with at most one decimal place.
- `fatGrams`: non-negative number with at most one decimal place.
- `fiberGrams`: non-negative number with at most one decimal place.
- `ingredients`: optional text, maximum 1,000 characters.
- `notes`: optional text, maximum 1,000 characters.
- `createdAt`: creation time.
- `updatedAt`: last update time.

Create a unique index on `userId` and `normalizedName`, plus an index on `userId`, `category`, and `name` for listing and filtering.

### `dietMeals`

Add optional snapshot metadata for meals created from the library:

- `source`: `manual` or `library`; existing F005 meals default to `manual`.
- `sourceLibraryMealId`: the library meal ID at copy time; informational only and not used to populate current values.
- `quantity`: copied quantity, default `1`.

The existing daily meal fields hold the final copied name, serving description, meal type, and scaled nutrition. There is no cascading update or delete from `dietLibraryMeals` to `dietMeals`.

## Validation and error handling

- Apply the same validation rules to individual library creation, updates, CSV preview, CSV import confirmation, and daily snapshot creation.
- Trim text values before validation. Reject blank required strings after trimming.
- Accept only the four defined category/meal-type values.
- Require calories to be a non-negative whole number and nutrition grams to be non-negative with at most one decimal place.
- Require target values to be greater than zero. Water target and water entries are whole milliliters.
- Treat a missing water target on an existing F005 document as `null`; do not invent or silently save a default target for the user.
- Limit each water entry to 5,000 ml to catch accidental input; daily totals may exceed the target.
- Require quantity to be greater than zero, no more than 100, and have at most two decimal places.
- Reject non-finite values, numeric strings where JSON numbers are expected, negative values, and unexpected object fields.
- Treat library names case-insensitively for duplicate checks after trimming and collapsing whitespace.
- CSV row numbers use the original file's one-based line number, including the header line, so the user can locate errors.
- A CSV preview may contain both valid and invalid rows and does not write anything.
- Confirmation is atomic: all submitted valid-preview rows are inserted, or none are inserted if revalidation or duplicate checks fail.
- Use a consistent error body with a stable code, human-readable message, and optional field or row errors:

```json
{
  "error": {
    "code": "CSV_VALIDATION_FAILED",
    "message": "Some rows need attention.",
    "rows": [
      {
        "rowNumber": 7,
        "fields": {
          "category": "Use breakfast, lunch, dinner, or snack."
        }
      }
    ]
  }
}
```

- Return `404` rather than revealing whether another user owns a meal or water entry.
- Never include stack traces, MongoDB details, uploaded file contents, or another user's records in API errors.

## Architecture decisions

These decisions were approved by the project owner:

- Extend F005 rather than replacing its endpoints, collections, or manual-entry workflow.
- Keep calorie and macro targets independently editable. The calculator explains their mathematical relationship but does not make dietary recommendations or force them to match.
- Use 4/4/9 only for protein, carbohydrates, and fat. Fiber remains a tracked gram target and is excluded from the displayed formula in this version.
- Calculate the target macro breakdown on the server and use the same pure calculation in the UI for immediate form feedback. Server output remains authoritative.
- Store water as individual intake entries so quick-add actions can be audited and reversed. Calculate each day's total rather than storing a mutable total.
- Use milliliters only for the first version.
- Keep Meal Library items as one-serving templates. Quantity is applied only when copying a template to a daily meal.
- Copy all display and nutrition values into `dietMeals`. Keep `sourceLibraryMealId` only as informational provenance, with no live dependency on the library document.
- Use a two-step CSV flow: parse and preview without persistence, then send the chosen normalized rows for server revalidation and atomic insertion.
- Do not store uploaded CSV files or preview data on disk or in MongoDB.
- Enforce one case-insensitive normalized library name per user. The user can use a descriptive variant such as `Oatmeal bowl - large` when servings differ.
- Keep CSV parsing, normalization, and validation in an Express service shared with individual library-meal validation; routes remain thin.
- Keep all endpoints under the existing Diet REST area and document them in the project's linked OpenAPI file and Postman collection during implementation.
- Do not derive nutrition from ingredients. Ingredients and notes are private reference text only.

## Acceptance criteria

- All existing F005 manual meal and daily-history behavior continues to work.
- A verified user can save targets for calories, protein, carbohydrates, fat, fiber, and water.
- The UI displays protein × 4, carbohydrates × 4, fat × 9, their total, and the difference from the calorie target.
- A macro/calorie mismatch is shown clearly but does not prevent saving valid targets.
- A user can record water with 250 ml, 500 ml, or a custom amount and can delete an incorrect entry.
- Daily water progress shows consumed, target, remaining, and over-target values.
- A user can create, list, search, filter, view, edit, and delete only their own library meals.
- Each library meal represents one serving and contains all required nutrition values.
- A user can add a library meal to today or another selected date with an adjusted quantity.
- Copied nutrition follows the documented scaling and rounding rules.
- Editing or deleting a library meal does not change an existing daily diet record.
- A valid CSV produces a preview before any record is saved.
- A mixed CSV identifies every valid and invalid row with useful field errors.
- Only explicitly confirmed valid rows are imported.
- Import confirmation is revalidated and atomic; a failure creates no partial import.
- Files over 1 MB or 500 data rows are rejected.
- Duplicate library names are handled consistently for individual and bulk creation.
- One user cannot read or change another user's targets, water, library meals, or daily meals.
- OpenAPI and Postman documentation cover the new endpoints and representative success and error cases.
- The complete feature runs locally with React/Vite, Express, and MongoDB.

## Local verification

Not implemented. After implementation is approved:

1. Run the existing web, server, and local MongoDB services and log in with a verified account.
2. Confirm existing F005 meals and manual add/edit/delete behavior are unchanged.
3. Save all six targets and verify the 4/4/9 calculation with known values, including a target mismatch.
4. Add 250 ml, 500 ml, and a custom water amount; verify totals, remaining/over-target display, deletion, date separation, and reload persistence.
5. Create, inspect, edit, search, filter, and delete a library meal.
6. Add a library meal at quantities `1`, `0.5`, and `1.5`; verify scaled/rounded daily snapshots and totals.
7. Edit and delete the source library meal and confirm previously copied daily meals remain unchanged.
8. Preview one fully valid CSV and one mixed CSV. Confirm preview writes no documents.
9. Import selected valid rows, then test invalid, duplicate, oversized, wrong-type, and over-500-row files. Confirm failures create no partial records.
10. Repeat ownership checks with another verified user and authentication checks with logged-out and unverified users.
11. Run the server tests and web build, then exercise the documented requests in Postman.

## Open questions

None. The project owner approved milliliters-only water tracking, unique normalized meal names per user, valid-row CSV imports after preview, the 1 MB and 500-row CSV limits, and fractional quantities with the documented rounding rules.
