const { Targets } = require('../models/Diet');
const { validateTargets, macroCalories } = require('./diet');
const { publicTargets } = require('./dietRead');
async function saveTargets(userId, body) {
  const input = validateTargets(body);
  if (input.fields) throw Object.assign(new Error('Enter positive protein, carbohydrate, fat and fiber targets (grams to one decimal) and positive whole water milliliters. Calories are calculated from macros.'), { code: 'TARGETS_INVALID', fields: input.fields });
  let target;
  try {
    target = await Targets.findOneAndUpdate({ userId }, { $set: input.value }, { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    target = await Targets.findOneAndUpdate({ userId }, { $set: input.value }, { returnDocument: 'after', runValidators: true });
  }
  return { targets: publicTargets(target), macroCalories: macroCalories(target) };
}
module.exports = { saveTargets };
