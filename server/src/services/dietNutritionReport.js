const mongoose = require('mongoose');
const { Meal, fields, categories } = require('../models/Diet');
const { validDate } = require('./diet');
const dayMs = 86400000;
function invalid(message) { return { error: message, code: 'INVALID_NUTRITION_REPORT' }; }
function parseNutritionReport(query) {
  if (Object.keys(query).some(key => !['start', 'end', 'mealType', 'nutrients'].includes(key)) ||
      Object.values(query).some(value => typeof value !== 'string')) return invalid('Use only start, end, mealType and nutrients as single query parameters.');
  const { start, end, mealType } = query;
  if (!validDate(start) || !validDate(end)) return invalid('Supply valid start and end dates in YYYY-MM-DD format.');
  const count = (Date.parse(end) - Date.parse(start)) / dayMs + 1;
  if (count < 1 || count > 366) return invalid('Use an inclusive date range of 1–366 days with start before or equal to end.');
  if (mealType !== undefined && !categories.includes(mealType)) return invalid('mealType must be breakfast, lunch, dinner or snack; omit it for all meals.');
  const nutrients = query.nutrients === undefined ? [...fields] : query.nutrients.split(',').map(field => field.trim());
  if (!nutrients.length || nutrients.some(field => !fields.includes(field)) || new Set(nutrients).size !== nutrients.length) return invalid('Select distinct nutrients from calories, proteinGrams, carbohydrateGrams, fatGrams and fiberGrams.');
  return { value: { start, end, mealType: mealType ?? null, nutrients } };
}
function reportResult(range, rows) {
  const byDate = new Map(rows.map(row => [row._id, row]));
  const totalUnits = Object.fromEntries(range.nutrients.map(field => [field, 0]));
  let mealCount = 0;
  const days = [];
  for (let time = Date.parse(range.start); time <= Date.parse(range.end); time += dayMs) {
    const date = new Date(time).toISOString().slice(0, 10), row = byDate.get(date);
    const count = row?.mealCount || 0;
    mealCount += count;
    const totals = Object.fromEntries(range.nutrients.map(field => {
      const units = row?.[field] || 0;
      totalUnits[field] += units;
      return [field, units / (field === 'calories' ? 1 : 10)];
    }));
    days.push({ date, mealCount: count, totals });
  }
  return { ...range, mealCount, totals: Object.fromEntries(range.nutrients.map(field => [field, totalUnits[field] / (field === 'calories' ? 1 : 10)])), days };
}
async function getNutritionReport(userId, range) {
  const match = { userId: new mongoose.Types.ObjectId(String(userId)), consumedOn: { $gte: range.start, $lte: range.end }, ...(range.mealType ? { mealType: range.mealType } : {}) };
  // Meal nutrition already describes the recorded portion. Never scale by quantity again.
  const sums = Object.fromEntries(range.nutrients.map(field => [field, { $sum: { $round: [{ $multiply: ['$' + field, field === 'calories' ? 1 : 10] }, 0] } }]));
  const rows = await Meal.aggregate([{ $match: match }, { $group: { _id: '$consumedOn', mealCount: { $sum: 1 }, ...sums } }]);
  return reportResult(range, rows);
}
module.exports = { parseNutritionReport, reportResult, getNutritionReport };
