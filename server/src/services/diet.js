const { TextDecoder } = require('util');
const { parse } = require('csv-parse/sync');
const { categories, fields } = require('../models/Diet');

const csvHeaders = [
  'name', 'category', 'servingDescription', 'calories', 'proteinGrams',
  'carbohydrateGrams', 'fatGrams', 'fiberGrams', 'ingredients', 'notes'
];
const libraryFields = ['name', 'category', 'servingDescription', 'nutrition', 'ingredients', 'notes'];

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnly = (value, allowed) => object(value) && Object.keys(value).every((key) => allowed.includes(key));
const oneDecimal = (value) => Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
const twoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function nutritionValues(record) {
  return Object.fromEntries(fields.map((key) => [key, record[key]]));
}

function nutritionErrors(value, { positive = false, partial = false } = {}) {
  const errors = {};
  if (!object(value)) return { nutrition: 'Nutrition must be an object.' };
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) errors[key] = 'This nutrition field is not supported.';
  }
  for (const key of fields) {
    if (!(key in value)) {
      if (!partial) errors[key] = 'This value is required.';
      continue;
    }
    const number = value[key];
    if (!finiteNumber(number)) errors[key] = 'Use a JSON number.';
    else if (positive ? number <= 0 : number < 0) errors[key] = positive ? 'Use a value greater than zero.' : 'Use zero or a positive value.';
    else if (key === 'calories' ? !Number.isInteger(number) : !oneDecimal(number)) {
      errors[key] = key === 'calories' ? 'Use a whole number.' : 'Use at most one decimal place.';
    }
  }
  if (partial && Object.keys(value).length === 0) errors.nutrition = 'Provide at least one nutrition value.';
  return errors;
}

function macroCalories(targets) {
  if (!targets) return null;
  const protein = Math.round(targets.proteinGrams * 4 * 10) / 10;
  const carbohydrates = Math.round(targets.carbohydrateGrams * 4 * 10) / 10;
  const fat = Math.round(targets.fatGrams * 9 * 10) / 10;
  const total = Math.round((protein + carbohydrates + fat) * 10) / 10;
  return { protein, carbohydrates, fat, total,
    differenceFromCalorieTarget: Math.round((total - targets.calories) * 10) / 10 };
}

function validateTargets(body) {
  const allowed = [...fields, 'waterMilliliters'];
  if (!hasOnly(body, allowed)) return { fields: { request: 'Only the six target fields are accepted.' } };
  const targetNutrition = Object.fromEntries(fields.filter((key) => key in body).map((key) => [key, body[key]]));
  const errors = nutritionErrors(targetNutrition, { positive: true });
  if (!('waterMilliliters' in body)) errors.waterMilliliters = 'This value is required.';
  else if (!finiteNumber(body.waterMilliliters)) errors.waterMilliliters = 'Use a JSON number.';
  else if (!Number.isInteger(body.waterMilliliters) || body.waterMilliliters <= 0) errors.waterMilliliters = 'Use a positive whole number.';
  if (Object.keys(errors).length) return { fields: errors };
  return { value: { ...nutritionValues(body), waterMilliliters: body.waterMilliliters } };
}

function validateWaterEntry(body) {
  if (!hasOnly(body, ['date', 'amountMilliliters'])) return { fields: { request: 'Only date and amountMilliliters are accepted.' } };
  const errors = {};
  if (!validDate(body.date)) errors.date = 'Use a valid YYYY-MM-DD date.';
  if (!finiteNumber(body.amountMilliliters) || !Number.isInteger(body.amountMilliliters) || body.amountMilliliters < 1 || body.amountMilliliters > 5000) {
    errors.amountMilliliters = 'Use a whole number from 1 to 5000.';
  }
  return Object.keys(errors).length ? { fields: errors } : { value: { consumedOn: body.date, amountMilliliters: body.amountMilliliters } };
}

function validateQuantity(body) {
  if (!hasOnly(body, ['date', 'mealType', 'quantity'])) return { fields: { request: 'Only date, mealType, and quantity are accepted.' } };
  const errors = {};
  if (!validDate(body.date)) errors.date = 'Use a valid YYYY-MM-DD date.';
  if (!categories.includes(body.mealType)) errors.mealType = 'Use breakfast, lunch, dinner, or snack.';
  if (!finiteNumber(body.quantity) || body.quantity <= 0 || body.quantity > 100 || !twoDecimals(body.quantity)) {
    errors.quantity = 'Use a number greater than zero and no more than 100, with at most two decimal places.';
  }
  return Object.keys(errors).length ? { fields: errors } : { value: body };
}

function libraryMealErrors(body, partial = false) {
  const errors = {};
  if (!hasOnly(body, libraryFields)) return { request: 'The request contains unsupported fields.' };
  const required = ['name', 'category', 'servingDescription', 'nutrition'];
  for (const key of required) if (!partial && !(key in body)) errors[key] = 'This value is required.';
  if (partial && Object.keys(body).length === 0) errors.request = 'Provide at least one field.';
  if ('name' in body && (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().replace(/\s+/g, ' ').length > 120)) errors.name = 'Use a name from 1 to 120 characters.';
  if ('category' in body && !categories.includes(body.category)) errors.category = 'Use breakfast, lunch, dinner, or snack.';
  if ('servingDescription' in body && (typeof body.servingDescription !== 'string' || !body.servingDescription.trim() || body.servingDescription.trim().length > 80)) errors.servingDescription = 'Use a serving description from 1 to 80 characters.';
  if ('ingredients' in body && (typeof body.ingredients !== 'string' || body.ingredients.trim().length > 1000)) errors.ingredients = 'Use no more than 1000 characters.';
  if ('notes' in body && (typeof body.notes !== 'string' || body.notes.trim().length > 1000)) errors.notes = 'Use no more than 1000 characters.';
  if ('nutrition' in body) Object.assign(errors, nutritionErrors(body.nutrition, { partial }));
  return errors;
}

function validateLibraryMeal(body, partial = false) {
  if (!object(body)) return { fields: { request: 'Use a JSON object.' } };
  const errors = libraryMealErrors(body, partial);
  if (Object.keys(errors).length) return { fields: errors };
  const value = {};
  if ('name' in body) {
    value.name = body.name.trim().replace(/\s+/g, ' ');
    value.normalizedName = normalizeName(value.name);
  }
  if ('category' in body) value.category = body.category;
  if ('servingDescription' in body) value.servingDescription = body.servingDescription.trim();
  if ('nutrition' in body) Object.assign(value, body.nutrition);
  if ('ingredients' in body) value.ingredients = body.ingredients.trim();
  if ('notes' in body) value.notes = body.notes.trim();
  if (!partial) {
    if (!('ingredients' in value)) value.ingredients = '';
    if (!('notes' in value)) value.notes = '';
  }
  return { value };
}

function flatCsvMeal(record) {
  const numeric = {};
  for (const key of fields) {
    const raw = typeof record[key] === 'string' ? record[key].trim() : '';
    numeric[key] = raw === '' ? Number.NaN : Number(raw);
  }
  return {
    name: record.name,
    category: record.category?.trim().toLowerCase(),
    servingDescription: record.servingDescription,
    nutrition: numeric,
    ingredients: record.ingredients || '',
    notes: record.notes || ''
  };
}

function previewCsv(buffer, fileName) {
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch (_) { return { error: { code: 'INVALID_CSV', message: 'The file must use UTF-8 encoding.' } }; }
  let headerError;
  let parsed;
  try {
    parsed = parse(text, {
      bom: true,
      columns: (headers) => {
        const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
        const missing = csvHeaders.filter((header) => !headers.includes(header));
        const unexpected = headers.filter((header) => !csvHeaders.includes(header));
        if (duplicates.length || missing.length || unexpected.length) {
          headerError = { duplicates, missing, unexpected };
          throw new Error('CSV_HEADERS_INVALID');
        }
        return headers;
      },
      info: true,
      skip_empty_lines: true,
      relax_column_count: false
    });
  } catch (error) {
    if (headerError) return { error: { code: 'CSV_HEADERS_INVALID', message: 'Use each required CSV header exactly once.', fields: headerError } };
    return { error: { code: 'INVALID_CSV', message: 'The CSV syntax could not be read.' } };
  }
  if (!parsed.length) return { error: { code: 'EMPTY_CSV', message: 'The CSV file has no data rows.' } };
  if (parsed.length > 500) return { error: { code: 'CSV_TOO_LARGE', message: 'CSV files are limited to 500 data rows.' }, status: 413 };
  const validRows = [];
  const invalidRows = [];
  for (const item of parsed) {
    const rowNumber = item.info.lines;
    const result = validateLibraryMeal(flatCsvMeal(item.record));
    if (result.fields) invalidRows.push({ rowNumber, fields: result.fields });
    else {
      const { normalizedName, ...normalized } = result.value;
      validRows.push({ sourceRowNumber: rowNumber, ...normalized });
    }
  }
  return { value: { fileName, totalRows: parsed.length, validRows, invalidRows } };
}

function validateImportRows(body) {
  if (!hasOnly(body, ['rows']) || !Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > 500) {
    return { rows: [{ rowNumber: null, fields: { rows: 'Provide 1 to 500 preview rows.' } }] };
  }
  const rows = [];
  const errors = [];
  for (const row of body.rows) {
    const allowed = ['sourceRowNumber', ...csvHeaders];
    const fieldsError = {};
    if (!hasOnly(row, allowed)) fieldsError.request = 'The row contains unsupported fields.';
    if (!Number.isInteger(row?.sourceRowNumber) || row.sourceRowNumber < 2) fieldsError.sourceRowNumber = 'Use the source row number from preview.';
    const nested = row && { name: row.name, category: row.category, servingDescription: row.servingDescription,
      nutrition: Object.fromEntries(fields.map((key) => [key, row[key]])), ingredients: row.ingredients, notes: row.notes };
    const result = row ? validateLibraryMeal(nested) : { fields: { request: 'Use an object.' } };
    Object.assign(fieldsError, result.fields || {});
    if (Object.keys(fieldsError).length) errors.push({ rowNumber: row?.sourceRowNumber || null, fields: fieldsError });
    else rows.push(result.value);
  }
  return errors.length ? { rows: errors } : { value: rows };
}

function scaleNutrition(meal, quantity) {
  return Object.fromEntries(fields.map((key) => [key, key === 'calories'
    ? Math.round(meal[key] * quantity)
    : Math.round(meal[key] * quantity * 10) / 10]));
}

module.exports = {
  csvHeaders,
  macroCalories,
  normalizeName,
  nutritionValues,
  previewCsv,
  scaleNutrition,
  validDate,
  validateImportRows,
  validateLibraryMeal,
  validateQuantity,
  validateTargets,
  validateWaterEntry
};
