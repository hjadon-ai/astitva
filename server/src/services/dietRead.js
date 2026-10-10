const mongoose = require('mongoose');
const { Meal, Targets, WaterEntry, LibraryMeal, fields } = require('../models/Diet');
const { Library } = require('../models/MealLibrary');
const { nutritionValues, macroCalories, recentMeals } = require('./diet');
const { historyDays } = require('./dietHistory');
const publicTargets = targets => targets ? { ...nutritionValues(targets), waterMilliliters: targets.waterMilliliters ?? null } : null;
const publicMeal = meal => ({ id: String(meal._id), date: meal.consumedOn, name: meal.name, mealType: meal.mealType, servingDescription: meal.servingDescription, source: meal.source || 'manual', sourceLibraryMealId: meal.sourceLibraryMealId ? String(meal.sourceLibraryMealId) : null, quantity: meal.quantity || 1, nutrition: nutritionValues(meal) });
function dayResult(date, meals, targets, waterEntries) {
  const totals = Object.fromEntries(fields.map(key => [key, meals.reduce((sum, meal) => sum + Math.round(meal[key] * 10), 0) / 10]));
  const consumedMilliliters = waterEntries.reduce((sum, entry) => sum + entry.amountMilliliters, 0);
  const targetMilliliters = targets?.waterMilliliters ?? null;
  return { date, totals, targets: publicTargets(targets), macroCalories: targets ? macroCalories(targets) : null,
    overTarget: targets ? Object.fromEntries(fields.map(key => [key, Math.max(0, Math.round((totals[key] - targets[key]) * 10) / 10)])) : null,
    water: { consumedMilliliters, targetMilliliters, remainingMilliliters: targetMilliliters === null ? null : Math.max(0, targetMilliliters - consumedMilliliters), overTargetMilliliters: targetMilliliters === null ? null : Math.max(0, consumedMilliliters - targetMilliliters), entries: waterEntries.map(entry => ({ id: String(entry._id), amountMilliliters: entry.amountMilliliters, createdAt: entry.createdAt })) }, meals: meals.map(publicMeal) };
}
async function getDay(userId, date) {
  const [meals, targets, water] = await Promise.all([Meal.find({ userId, consumedOn: date }).sort({ createdAt: 1 }).lean(), Targets.findOne({ userId }).lean(), WaterEntry.find({ userId, consumedOn: date }).sort({ createdAt: 1 }).lean()]);
  return dayResult(date, meals, targets, water);
}
async function getTargets(userId) { return { targets: publicTargets(await Targets.findOne({ userId }).lean()) }; }
async function getRecent(userId) { return { meals: recentMeals(await Meal.find({ userId }).sort({ consumedOn: -1, createdAt: -1, _id: -1 }).limit(100).lean()).map(publicMeal) }; }
async function getHistory(userId, range) {
  const match = { userId: new mongoose.Types.ObjectId(String(userId)), consumedOn: { $gte: range.start, $lte: range.end } };
  const [meals, water, targets] = await Promise.all([Meal.aggregate([{ $match: match }, { $group: { _id: '$consumedOn', count: { $sum: 1 }, ...Object.fromEntries(fields.map(key => [key, { $sum: '$' + key }])) } }]), WaterEntry.aggregate([{ $match: match }, { $group: { _id: '$consumedOn', count: { $sum: 1 }, waterMilliliters: { $sum: '$amountMilliliters' } } }]), Targets.findOne({ userId }).lean()]);
  return { ...range, targetBasis: 'current', targets: publicTargets(targets), days: historyDays(range, meals, water) };
}
async function searchPersonal(userId, search = '', category = '') {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = { ...(category ? { category } : {}), ...(search ? { name: { $regex: escaped, $options: 'i' } } : {}) };
  const owned = await Library.aggregate([{ $match: { ownerId: new mongoose.Types.ObjectId(String(userId)), archivedAt: null } }, { $unwind: '$items' }, { $match: Object.fromEntries(Object.entries(match).map(([key, value]) => ['items.' + key, value])) }, { $sort: { 'items.name': 1, _id: 1, 'items._id': 1 } }, { $limit: 51 }, { $project: { item: '$items', libraryName: '$name' } }]);
  const migrated = await Library.exists({ legacyOwnerId: userId });
  const legacy = migrated ? [] : await LibraryMeal.find({ userId, ...match }).sort({ name: 1, _id: 1 }).limit(51).lean();
  const combined = [...owned.map(row => ({ ...row.item, libraryId: String(row._id), libraryName: row.libraryName })), ...legacy].sort((a, b) => a.name.localeCompare(b.name));
  return { meals: combined.slice(0, 50).map(item => ({ id: String(item._id), libraryId: item.libraryId || null, libraryName: item.libraryName || 'Personal meals', name: item.name, category: item.category, servingDescription: item.servingDescription, nutrition: nutritionValues(item) })), hasMore: combined.length > 50 };
}
module.exports = { publicTargets, publicMeal, dayResult, getDay, getTargets, getRecent, getHistory, searchPersonal };
