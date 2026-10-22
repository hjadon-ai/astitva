const crypto = require('node:crypto');
const { WaterEntry, Meal } = require('../models/Diet');
const { validateWaterEntry } = require('./diet');
async function addWater(userId, { idempotencyKey, ...body }) {
  const parsed = validateWaterEntry(body);
  if (parsed.fields) throw Object.assign(new Error('Use a valid date and 1–5000 whole milliliters.'), { code: 'INVALID_WATER' });
  const input = parsed.value;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  let entry;
  try {
    entry = await WaterEntry.findOneAndUpdate({ userId, mcpIdempotencyKey: idempotencyKey },
      { $setOnInsert: { ...input, userId, mcpRequestHash: requestHash } },
      { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    entry = await WaterEntry.findOne({ userId, mcpIdempotencyKey: idempotencyKey });
    if (!entry) throw error;
  }
  if (entry.mcpRequestHash !== requestHash) throw Object.assign(new Error('This idempotency key was used for a different water entry. Use a new key for a new drink.'), { code: 'IDEMPOTENCY_CONFLICT' });
  return { entry: { id: String(entry._id), date: entry.consumedOn, amountMilliliters: entry.amountMilliliters, createdAt: entry.createdAt } };
}
async function deleteMeal(userId, { mealId }) {
  const deleted = await Meal.findOneAndDelete({ _id: mealId, userId });
  // Nonexistent, previously deleted and other-owner IDs have the same response.
  return { mealId, deleted: Boolean(deleted), status: deleted ? 'deleted' : 'not_found' };
}
module.exports = { addWater, deleteMeal };
