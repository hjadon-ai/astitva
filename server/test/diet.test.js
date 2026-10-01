const assert = require('node:assert/strict');
const test = require('node:test');
const {
  macroCalories,
  normalizeName,
  previewCsv,
  scaleNutrition,
  validateImportRows,
  validateLibraryMeal,
  validateQuantity,
  validateTargets,
  validateWaterEntry
} = require('../src/services/diet');

const nutrition = {
  calories: 420,
  proteinGrams: 18,
  carbohydrateGrams: 62,
  fatGrams: 12,
  fiberGrams: 8.5
};

test('macro target calories use the approved 4/4/9 formula', () => {
  assert.deepEqual(macroCalories({
    calories: 2000,
    proteinGrams: 100,
    carbohydrateGrams: 240,
    fatGrams: 65
  }), {
    protein: 400,
    carbohydrates: 960,
    fat: 585,
    total: 1945,
    differenceFromCalorieTarget: -55
  });
});

test('targets require all nutrition values and a positive whole water target', () => {
  assert.deepEqual(validateTargets({ ...nutrition, waterMilliliters: 2000 }).value,
    { ...nutrition, waterMilliliters: 2000 });
  assert.equal(validateTargets({ ...nutrition }).fields.waterMilliliters, 'This value is required.');
  assert.ok(validateTargets({ ...nutrition, waterMilliliters: 250.5 }).fields.waterMilliliters);
});

test('water entries and quantities reject unsafe values and numeric strings', () => {
  assert.deepEqual(validateWaterEntry({ date: '2026-09-23', amountMilliliters: 500 }).value,
    { consumedOn: '2026-09-23', amountMilliliters: 500 });
  assert.ok(validateWaterEntry({ date: '2026-09-23', amountMilliliters: 5001 }).fields);
  assert.ok(validateWaterEntry({ date: '2026-09-23', amountMilliliters: '250' }).fields);
  assert.deepEqual(validateQuantity({ date: '2026-09-23', mealType: 'snack', quantity: 1.25 }).value,
    { date: '2026-09-23', mealType: 'snack', quantity: 1.25 });
  assert.ok(validateQuantity({ date: '2026-09-23', mealType: 'snack', quantity: 1.234 }).fields);
});

test('library meal validation normalizes names and retains one serving values', () => {
  const result = validateLibraryMeal({
    name: '  Oatmeal   Bowl ',
    category: 'breakfast',
    servingDescription: '1 bowl',
    nutrition,
    ingredients: ' oats; milk ',
    notes: ''
  });
  assert.equal(result.value.name, 'Oatmeal Bowl');
  assert.equal(result.value.normalizedName, 'oatmeal bowl');
  assert.equal(normalizeName(' OATMEAL   bowl '), 'oatmeal bowl');
  assert.equal(result.value.ingredients, 'oats; milk');
  assert.ok(validateLibraryMeal({
    name: 'Oatmeal', category: 'breakfast', servingDescription: '1 bowl',
    nutrition: { ...nutrition, calories: '420' }
  }).fields.calories);
});

test('library nutrition snapshots use approved quantity rounding', () => {
  assert.deepEqual(scaleNutrition(nutrition, 1.5), {
    calories: 630,
    proteinGrams: 27,
    carbohydrateGrams: 93,
    fatGrams: 18,
    fiberGrams: 12.8
  });
});

test('CSV preview separates normalized valid and invalid rows without saving', () => {
  const csv = [
    'name,category,servingDescription,calories,proteinGrams,carbohydrateGrams,fatGrams,fiberGrams,ingredients,notes',
    'Oatmeal bowl,breakfast,1 bowl,420,18,62,12,8.5,oats,weekday',
    'Bad meal,brunch,1 plate,100,2,3,4,5,,'
  ].join('\n');
  const result = previewCsv(Buffer.from(csv), 'meals.csv').value;
  assert.equal(result.totalRows, 2);
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].sourceRowNumber, 2);
  assert.equal(result.validRows[0].name, 'Oatmeal bowl');
  assert.equal(result.invalidRows[0].rowNumber, 3);
  assert.match(result.invalidRows[0].fields.category, /breakfast/);
});

test('CSV preview rejects more than 500 data rows', () => {
  const header = 'name,category,servingDescription,calories,proteinGrams,carbohydrateGrams,fatGrams,fiberGrams,ingredients,notes';
  const rows = Array.from({ length: 501 }, (_, index) => `Meal ${index},snack,1 serving,100,2,3,4,5,,`);
  const result = previewCsv(Buffer.from([header, ...rows].join('\n')), 'meals.csv');
  assert.equal(result.status, 413);
  assert.equal(result.error.code, 'CSV_TOO_LARGE');
});

test('CSV confirmation revalidates flat preview rows', () => {
  const row = {
    sourceRowNumber: 2,
    name: 'Oatmeal bowl',
    category: 'breakfast',
    servingDescription: '1 bowl',
    ...nutrition,
    ingredients: '',
    notes: ''
  };
  assert.equal(validateImportRows({ rows: [row] }).value[0].normalizedName, 'oatmeal bowl');
  assert.ok(validateImportRows({ rows: [{ ...row, calories: -1 }] }).rows);
});
