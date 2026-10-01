const mongoose = require('mongoose');

const fields = ['calories', 'proteinGrams', 'carbohydrateGrams', 'fatGrams', 'fiberGrams'];
const categories = ['breakfast', 'lunch', 'dinner', 'snack'];
const nutrition = Object.fromEntries(fields.map((key) => [key, { type: Number, required: true, min: 0 }]));
const owner = { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true };
const mealSchema = new mongoose.Schema({
  userId: owner,
  consumedOn: { type: String, required: true },
  name: { type: String, required: true, maxlength: 120 },
  mealType: { type: String, enum: categories, required: true },
  servingDescription: { type: String, default: '', maxlength: 80 },
  source: { type: String, enum: ['manual', 'library'], default: 'manual' },
  sourceLibraryMealId: { type: mongoose.Schema.Types.ObjectId, ref: 'DietLibraryMeal', default: null },
  quantity: { type: Number, min: 0.01, max: 100, default: 1 },
  ...nutrition
}, { timestamps: true, collection: 'dietMeals' });
mealSchema.index({ userId: 1, consumedOn: 1 });
const targetSchema = new mongoose.Schema({
  userId: { ...owner, unique: true },
  waterMilliliters: { type: Number, min: 1, default: undefined },
  ...nutrition
}, { timestamps: true, collection: 'dietNutritionTargets' });

const waterEntrySchema = new mongoose.Schema({
  userId: owner,
  consumedOn: { type: String, required: true },
  amountMilliliters: { type: Number, required: true, min: 1, max: 5000 }
}, { timestamps: true, collection: 'dietWaterEntries' });
waterEntrySchema.index({ userId: 1, consumedOn: 1 });

const libraryMealSchema = new mongoose.Schema({
  userId: owner,
  name: { type: String, required: true, maxlength: 120 },
  normalizedName: { type: String, required: true, maxlength: 120 },
  category: { type: String, enum: categories, required: true },
  servingDescription: { type: String, required: true, maxlength: 80 },
  ...nutrition,
  ingredients: { type: String, default: '', maxlength: 1000 },
  notes: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true, collection: 'dietLibraryMeals' });
libraryMealSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });
libraryMealSchema.index({ userId: 1, category: 1, name: 1 });

module.exports = {
  Meal: mongoose.model('DietMeal', mealSchema),
  Targets: mongoose.model('DietTargets', targetSchema),
  WaterEntry: mongoose.model('DietWaterEntry', waterEntrySchema),
  LibraryMeal: mongoose.model('DietLibraryMeal', libraryMealSchema),
  categories,
  fields
};
