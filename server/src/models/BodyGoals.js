const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  revision: { type: Number, required: true, default: 0 },
  heightCm: { type: Number, min: 100, max: 250 },
  weightKg: { type: Number, required: true, min: 25, max: 350 },
  measuredOn: { type: String, required: true },
  units: { type: String, enum: ['metric', 'imperial'], required: true },
  age: { type: Number, default: null }, sex: { type: String, enum: ['male', 'female', null], default: null },
  activity: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', null], default: null },
  eligible: { type: Boolean, default: false }, goal: { type: String, enum: ['maintain', 'lose', 'gain'], required: true },
  targetWeightKg: Number, planMode: { type: String, enum: ['pace', 'date'] }, paceKgWeek: Number, targetDate: String,
  baseline: { weightKg: Number, date: String },
  weights: [{ _id: false, date: String, weightKg: Number }]
}, { timestamps: true, collection: 'dietBodyGoals' });
module.exports = mongoose.model('DietBodyGoals', schema);
