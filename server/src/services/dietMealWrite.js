const crypto = require('crypto');
const { Meal, fields, categories } = require('../models/Diet');
const { validDate } = require('./diet');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
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


async function createManualMeal(userId, input, idempotencyKey) {
  if (!idempotencyKey) return Meal.create({ ...input, userId, source: 'manual', quantity: 1 });
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  let meal;
  try {
    meal = await Meal.findOneAndUpdate({ userId, mcpIdempotencyKey: idempotencyKey },
      { $setOnInsert: { ...input, userId, source: 'manual', quantity: 1, mcpRequestHash: requestHash } },
      { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    meal = await Meal.findOne({ userId, mcpIdempotencyKey: idempotencyKey });
    if (!meal) throw error;
  }
  if (meal.mcpRequestHash !== requestHash) throw Object.assign(new Error('This idempotency key was already used for a different meal. Use a new key for a new meal.'), { code: 'IDEMPOTENCY_CONFLICT' });
  return meal;
}
module.exports = { manualMealInput, createManualMeal };
