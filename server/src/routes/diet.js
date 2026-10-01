const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const Session = require('../models/Session');
const { getRuntimeConfig } = require('../config/runtime');
const { LibraryMeal, Meal, Targets, WaterEntry, categories, fields } = require('../models/Diet');
const {
  macroCalories,
  nutritionValues,
  previewCsv,
  scaleNutrition,
  validDate,
  validateImportRows,
  validateLibraryMeal,
  validateQuantity,
  validateTargets,
  validateWaterEntry
} = require('../services/diet');

const router = express.Router();
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const objectId = (value) => /^[a-f0-9]{24}$/i.test(value);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024, files: 1 } });

function errorResponse(response, status, code, message, details = {}) {
  return response.status(status).json({ error: { code, message, ...details } });
}

function publicTargets(targets) {
  return targets ? { ...nutritionValues(targets), waterMilliliters: targets.waterMilliliters ?? null } : null;
}

function publicMeal(meal) {
  return {
    id: String(meal._id),
    date: meal.consumedOn,
    name: meal.name,
    mealType: meal.mealType,
    servingDescription: meal.servingDescription,
    source: meal.source || 'manual',
    sourceLibraryMealId: meal.sourceLibraryMealId ? String(meal.sourceLibraryMealId) : null,
    quantity: meal.quantity || 1,
    nutrition: nutritionValues(meal)
  };
}

function publicLibraryMeal(meal) {
  return {
    id: String(meal._id),
    name: meal.name,
    category: meal.category,
    servingDescription: meal.servingDescription,
    nutrition: nutritionValues(meal),
    ingredients: meal.ingredients || '',
    notes: meal.notes || '',
    createdAt: meal.createdAt,
    updatedAt: meal.updatedAt
  };
}

function nutritionValid(value, targets = false, partial = false) {
  return object(value) && Object.keys(value).every((key) => fields.includes(key)) &&
    (partial ? Object.keys(value).length > 0 : fields.every((key) => key in value)) &&
    Object.entries(value).every(([key, number]) => {
      const scaled = number * (key === 'calories' ? 1 : 10);
      return typeof number === 'number' && Number.isFinite(number) &&
        (targets ? number > 0 : number >= 0) && Math.abs(scaled) <= Number.MAX_SAFE_INTEGER / 1000 &&
        Math.abs(scaled - Math.round(scaled)) < 1e-8;
    });
}

function manualMealInput(body, partial = false) {
  if (!object(body) || !Object.keys(body).length || Object.keys(body).some((key) =>
    !['date', 'name', 'mealType', 'servingDescription', 'nutrition'].includes(key))) return null;
  const result = {};
  for (const key of ['date', 'name', 'mealType', 'nutrition']) if (!partial && !(key in body)) return null;
  if ('date' in body) { if (!validDate(body.date)) return null; result.consumedOn = body.date; }
  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) return null;
    result.name = body.name.trim();
  }
  if ('mealType' in body) {
    if (!categories.includes(body.mealType)) return null;
    result.mealType = body.mealType;
  }
  if ('servingDescription' in body) {
    if (typeof body.servingDescription !== 'string' || body.servingDescription.trim().length > 80) return null;
    result.servingDescription = body.servingDescription.trim();
  }
  if ('nutrition' in body) {
    if (!nutritionValid(body.nutrition, false, partial)) return null;
    Object.assign(result, body.nutrition);
  }
  return result;
}

function csvUpload(request, response, next) {
  upload.single('file')(request, response, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return errorResponse(response, 413, 'CSV_TOO_LARGE', 'CSV files are limited to 1 MB.');
    if (error) return errorResponse(response, 400, 'INVALID_CSV_UPLOAD', 'Upload one file in the file field.');
    next();
  });
}

async function insertImportAllOrNothing(userId, rows) {
  const normalizedNames = rows.map((row) => row.normalizedName);
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    const error = new Error('The import contains duplicate meal names.');
    error.code = 'DUPLICATE_LIBRARY_MEAL';
    throw error;
  }
  if (await LibraryMeal.exists({ userId, normalizedName: { $in: normalizedNames } })) {
    const error = new Error('A meal with this name already exists.');
    error.code = 'DUPLICATE_LIBRARY_MEAL';
    throw error;
  }

  const created = [];
  try {
    for (const row of rows) created.push(await LibraryMeal.create({ ...row, userId }));
    return created;
  } catch (error) {
    if (created.length) await LibraryMeal.deleteMany({ _id: { $in: created.map((meal) => meal._id) }, userId });
    throw error;
  }
}

router.use(async (request, response, next) => {
  const token = request.cookies[getRuntimeConfig().sessionCookieName];
  if (typeof token !== 'string') return response.status(401).json({ error: 'Authentication required.' });
  const session = await Session.findOne({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  }).populate('userId');
  if (!session?.userId) return response.status(401).json({ error: 'Authentication required.' });
  if (!session.userId.emailVerifiedAt) return response.status(403).json({ error: 'Email verification required.' });
  request.dietUserId = session.userId._id;
  next();
});

router.get('/days/:date', async (request, response) => {
  if (!validDate(request.params.date)) return response.status(400).json({ error: 'Use a valid YYYY-MM-DD date.' });
  const [meals, targets, waterEntries] = await Promise.all([
    Meal.find({ userId: request.dietUserId, consumedOn: request.params.date }).sort({ createdAt: 1 }).lean(),
    Targets.findOne({ userId: request.dietUserId }).lean(),
    WaterEntry.find({ userId: request.dietUserId, consumedOn: request.params.date }).sort({ createdAt: 1 }).lean()
  ]);
  const totals = Object.fromEntries(fields.map((key) => [key,
    meals.reduce((sum, meal) => sum + Math.round(meal[key] * 10), 0) / 10]));
  const consumedMilliliters = waterEntries.reduce((sum, entry) => sum + entry.amountMilliliters, 0);
  const targetMilliliters = targets?.waterMilliliters ?? null;
  response.json({
    date: request.params.date,
    totals,
    targets: publicTargets(targets),
    macroCalories: targets ? macroCalories(targets) : null,
    overTarget: targets ? Object.fromEntries(fields.map((key) => [key,
      Math.max(0, Math.round((totals[key] - targets[key]) * 10) / 10)])) : null,
    water: {
      consumedMilliliters,
      targetMilliliters,
      remainingMilliliters: targetMilliliters === null ? null : Math.max(0, targetMilliliters - consumedMilliliters),
      overTargetMilliliters: targetMilliliters === null ? null : Math.max(0, consumedMilliliters - targetMilliliters),
      entries: waterEntries.map((entry) => ({ id: String(entry._id), amountMilliliters: entry.amountMilliliters, createdAt: entry.createdAt }))
    },
    meals: meals.map(publicMeal)
  });
});

router.post('/meals', async (request, response) => {
  const input = manualMealInput(request.body);
  if (!input) return response.status(400).json({ error: 'Invalid meal. Enter a date, name, meal type and all five non-negative nutrition values (whole calories; grams to one decimal).' });
  response.status(201).json({ meal: publicMeal(await Meal.create({ ...input, userId: request.dietUserId, source: 'manual', quantity: 1 })) });
});

router.put('/targets', async (request, response) => {
  const input = validateTargets(request.body);
  if (input.fields) return errorResponse(response, 400, 'TARGETS_INVALID', 'Enter six valid daily targets.', { fields: input.fields });
  const filter = { userId: request.dietUserId };
  let target;
  try {
    target = await Targets.findOneAndUpdate(filter, { $set: input.value }, { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    target = await Targets.findOneAndUpdate(filter, { $set: input.value }, { new: true, runValidators: true });
  }
  response.json({ targets: publicTargets(target), macroCalories: macroCalories(target) });
});

router.post('/water-entries', async (request, response) => {
  const input = validateWaterEntry(request.body);
  if (input.fields) return errorResponse(response, 400, 'WATER_ENTRY_INVALID', 'Enter a valid date and water amount.', { fields: input.fields });
  const entry = await WaterEntry.create({ ...input.value, userId: request.dietUserId });
  response.status(201).json({ entry: { id: String(entry._id), date: entry.consumedOn, amountMilliliters: entry.amountMilliliters, createdAt: entry.createdAt } });
});

router.delete('/water-entries/:entryId', async (request, response) => {
  if (!objectId(request.params.entryId)) return errorResponse(response, 404, 'WATER_ENTRY_NOT_FOUND', 'Water entry not found.');
  const entry = await WaterEntry.findOneAndDelete({ _id: request.params.entryId, userId: request.dietUserId });
  if (!entry) return errorResponse(response, 404, 'WATER_ENTRY_NOT_FOUND', 'Water entry not found.');
  response.status(204).end();
});

router.patch('/meals/:id', async (request, response) => {
  if (!objectId(request.params.id)) return response.status(404).json({ error: 'Meal not found.' });
  const input = manualMealInput(request.body, true);
  if (!input) return response.status(400).json({ error: 'Invalid meal update.' });
  const meal = await Meal.findOneAndUpdate({ _id: request.params.id, userId: request.dietUserId },
    { $set: input }, { new: true, runValidators: true });
  if (!meal) return response.status(404).json({ error: 'Meal not found.' });
  response.json({ meal: publicMeal(meal) });
});

router.delete('/meals/:id', async (request, response) => {
  if (!objectId(request.params.id)) return response.status(404).json({ error: 'Meal not found.' });
  const meal = await Meal.findOneAndDelete({ _id: request.params.id, userId: request.dietUserId });
  if (!meal) return response.status(404).json({ error: 'Meal not found.' });
  response.status(204).end();
});

router.get('/library-meals', async (request, response) => {
  if (Object.keys(request.query).some((key) => !['search', 'category'].includes(key))) {
    return errorResponse(response, 400, 'LIBRARY_QUERY_INVALID', 'Only search and category filters are supported.');
  }
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
  const category = typeof request.query.category === 'string' ? request.query.category : '';
  if (search.length > 120 || (category && !categories.includes(category))) {
    return errorResponse(response, 400, 'LIBRARY_QUERY_INVALID', 'Use a shorter search and a valid category.');
  }
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = { userId: request.dietUserId, ...(category ? { category } : {}), ...(search ? { name: { $regex: escaped, $options: 'i' } } : {}) };
  const meals = await LibraryMeal.find(query).sort({ name: 1 }).limit(201).lean();
  response.json({ meals: meals.slice(0, 200).map(publicLibraryMeal), hasMore: meals.length > 200 });
});

router.post('/library-meals', async (request, response) => {
  const input = validateLibraryMeal(request.body);
  if (input.fields) return errorResponse(response, 400, 'LIBRARY_MEAL_INVALID', 'Review the library meal fields.', { fields: input.fields });
  try {
    const meal = await LibraryMeal.create({ ...input.value, userId: request.dietUserId });
    response.status(201).json({ meal: publicLibraryMeal(meal) });
  } catch (error) {
    if (error.code === 11000) return errorResponse(response, 409, 'DUPLICATE_LIBRARY_MEAL', 'A meal with this name already exists.');
    throw error;
  }
});

router.post('/library-meals/import-preview', csvUpload, async (request, response) => {
  if (!request.file) return errorResponse(response, 400, 'CSV_FILE_REQUIRED', 'Choose one CSV file.');
  const extensionValid = request.file.originalname.toLowerCase().endsWith('.csv');
  const mimeValid = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'].includes(request.file.mimetype);
  if (!extensionValid || !mimeValid) return errorResponse(response, 415, 'CSV_FILE_TYPE_INVALID', 'Upload a CSV file.');
  const result = previewCsv(request.file.buffer, request.file.originalname);
  if (result.error) return response.status(result.status || 400).json({ error: result.error });
  response.json(result.value);
});

router.post('/library-meals/import', async (request, response) => {
  const input = validateImportRows(request.body);
  if (input.rows) return errorResponse(response, 400, 'CSV_VALIDATION_FAILED', 'Some rows need attention.', { rows: input.rows });
  try {
    const created = await insertImportAllOrNothing(request.dietUserId, input.value);
    response.status(201).json({ importedCount: created.length, meals: created.map(publicLibraryMeal) });
  } catch (error) {
    if (error.code === 11000 || error.code === 'DUPLICATE_LIBRARY_MEAL') {
      return errorResponse(response, 409, 'DUPLICATE_LIBRARY_MEAL', 'A submitted meal name is duplicated or already exists. Nothing was imported.');
    }
    throw error;
  }
});

router.get('/library-meals/:mealId', async (request, response) => {
  if (!objectId(request.params.mealId)) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  const meal = await LibraryMeal.findOne({ _id: request.params.mealId, userId: request.dietUserId }).lean();
  if (!meal) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  response.json({ meal: publicLibraryMeal(meal) });
});

router.patch('/library-meals/:mealId', async (request, response) => {
  if (!objectId(request.params.mealId)) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  const input = validateLibraryMeal(request.body, true);
  if (input.fields) return errorResponse(response, 400, 'LIBRARY_MEAL_INVALID', 'Review the library meal fields.', { fields: input.fields });
  try {
    const meal = await LibraryMeal.findOneAndUpdate({ _id: request.params.mealId, userId: request.dietUserId },
      { $set: input.value }, { new: true, runValidators: true });
    if (!meal) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
    response.json({ meal: publicLibraryMeal(meal) });
  } catch (error) {
    if (error.code === 11000) return errorResponse(response, 409, 'DUPLICATE_LIBRARY_MEAL', 'A meal with this name already exists.');
    throw error;
  }
});

router.delete('/library-meals/:mealId', async (request, response) => {
  if (!objectId(request.params.mealId)) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  const meal = await LibraryMeal.findOneAndDelete({ _id: request.params.mealId, userId: request.dietUserId });
  if (!meal) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  response.status(204).end();
});

router.post('/library-meals/:mealId/add-to-day', async (request, response) => {
  if (!objectId(request.params.mealId)) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  const input = validateQuantity(request.body);
  if (input.fields) return errorResponse(response, 400, 'ADD_TO_DAY_INVALID', 'Review the date, meal type, and quantity.', { fields: input.fields });
  const libraryMeal = await LibraryMeal.findOne({ _id: request.params.mealId, userId: request.dietUserId }).lean();
  if (!libraryMeal) return errorResponse(response, 404, 'LIBRARY_MEAL_NOT_FOUND', 'Library meal not found.');
  const meal = await Meal.create({
    userId: request.dietUserId,
    consumedOn: input.value.date,
    name: libraryMeal.name,
    mealType: input.value.mealType,
    servingDescription: libraryMeal.servingDescription,
    source: 'library',
    sourceLibraryMealId: libraryMeal._id,
    quantity: input.value.quantity,
    ...scaleNutrition(libraryMeal, input.value.quantity)
  });
  response.status(201).json({ meal: publicMeal(meal) });
});

module.exports = router;
