const express = require('express');
const BodyGoals = require('../models/BodyGoals');
const { Targets } = require('../models/Diet');
const { validateBodyGoals, estimateBodyGoals, targetValues, withBaseline, validateWeight, recordWeight } = require('../services/bodyGoals');
const router = express.Router();
const publicProfile = p => p?.heightCm ? Object.fromEntries(['revision', 'heightCm', 'weightKg', 'measuredOn', 'units', 'age', 'sex', 'activity', 'eligible', 'goal', 'targetWeightKg', 'planMode', 'paceKgWeek', 'targetDate', 'weights', 'baseline'].map(k => [k, p[k]])) : null;
const payload = p => ({ profile: publicProfile(p), estimate: estimateBodyGoals(p), revision: p?.revision ?? 0, weights: p?.weights || [], latestWeight: p ? { weightKg: p.weightKg, date: p.measuredOn, units: p.units } : null });
const revisionValid = n => Number.isSafeInteger(n) && n >= 0;
router.get('/', async (req, res) => res.json(payload(await BodyGoals.findOne({ userId: req.dietUserId }).lean())));
router.post('/preview', async (req, res) => {
  const previous = await BodyGoals.findOne({ userId: req.dietUserId }).lean();
  const input = validateBodyGoals(req.body, new Date(), previous);
  if (input.error) return res.status(400).json({ error: input.error, fields: input.fields });
  res.json({ estimate: estimateBodyGoals(withBaseline(input.value, previous)) });
});
router.put('/', async (req, res) => {
  const previous = await BodyGoals.findOne({ userId: req.dietUserId }).lean();
  const input = validateBodyGoals(req.body, new Date(), previous);
  if (input.error) return res.status(400).json({ error: input.error, fields: input.fields });
  if (!revisionValid(req.body.expectedRevision)) return res.status(400).json({ error: 'Provide the saved revision.' });
  if ((previous?.revision ?? 0) !== req.body.expectedRevision) return res.status(409).json({ error: 'Body & Goals changed. Reload before saving.' });
  // Keep current weight chronologically current, while allowing correction of the latest measurement.
  if (previous && input.value.measuredOn < previous.measuredOn) return res.status(400).json({ error: 'Use the latest measurement date or a later date when updating current weight.' });
  input.value = withBaseline(input.value, previous);
  const weights = [...(previous?.weights || []).filter(w => w.date !== input.value.measuredOn), { date: input.value.measuredOn, weightKg: input.value.weightKg }].sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
  let saved;
  try {
    if (!previous) saved = await BodyGoals.create({ ...input.value, userId: req.dietUserId, revision: 1, weights });
    else saved = await BodyGoals.findOneAndUpdate({ userId: req.dietUserId, revision: req.body.expectedRevision }, { $set: { ...input.value, weights }, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  if (!saved) return res.status(409).json({ error: 'Body & Goals changed. Reload before saving.' });
  res.json(payload(saved));
});
router.get('/weights/:date', async (req, res) => {
  const { validDate } = require('../services/diet');
  if (!validDate(req.params.date)) return res.status(400).json({ error: 'Choose a valid YYYY-MM-DD date.' });
  const previous = await BodyGoals.findOne({ userId: req.dietUserId }).lean();
  res.json({ ...payload(previous), entry: previous?.weights?.find(w => w.date === req.params.date) || null });
});
router.put('/weights/:date', async (req, res) => {
  const input = validateWeight(req.body, req.params.date);
  if (input.error) return res.status(400).json({ error: input.error });
  const previous = await BodyGoals.findOne({ userId: req.dietUserId }).lean();
  if ((previous?.revision ?? 0) !== req.body.expectedRevision) return res.status(409).json({ error: 'Weight records changed. Reload before saving.' });
  if (previous?.weights?.length >= 180 && input.value.date < previous.weights[0].date) return res.status(400).json({ error: 'This date is outside the retained weight history.' });
  const update = recordWeight(previous, input.value, req.body.units);
  let saved;
  try {
    if (!previous) saved = await BodyGoals.create({ ...update, userId: req.dietUserId, revision: 1, goal: 'maintain', targetWeightKg: update.weightKg, planMode: 'pace', paceKgWeek: null });
    else saved = await BodyGoals.findOneAndUpdate({ userId: req.dietUserId, revision: req.body.expectedRevision }, { $set: update, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  if (!saved) return res.status(409).json({ error: 'Weight records changed. Reload before saving.' });
  res.json({ ...payload(saved), entry: input.value });
});
router.post('/apply-target', async (req, res) => {
  if (!req.body || Object.keys(req.body).some(k => k !== 'expectedRevision') || !revisionValid(req.body.expectedRevision)) return res.status(400).json({ error: 'Provide only the saved revision.' });
  const profile = await BodyGoals.findOne({ userId: req.dietUserId }).lean();
  if (!profile || profile.revision !== req.body.expectedRevision) return res.status(409).json({ error: 'Body & Goals changed. Reload and review the saved estimate.' });
  const estimate = estimateBodyGoals(profile);
  if (!estimate?.proposedCalories) return res.status(400).json({ error: estimate?.reason || 'Set up Body & Goals before applying a calorie target.' });
  const targets = await Targets.findOne({ userId: req.dietUserId }).lean();
  if (!targets || !(targets.waterMilliliters > 0)) return res.status(409).json({ error: 'Set your daily nutrition and water targets first, then apply this estimate.' });
  const values = targetValues(targets, estimate.proposedCalories);
  if (!values) return res.status(409).json({ error: 'Set valid macro targets before applying this estimate.' });
  // Claim the exact reviewed profile revision before changing targets.
  const claimed = await BodyGoals.findOneAndUpdate({ userId: req.dietUserId, revision: profile.revision }, { $inc: { revision: 1 } }, { returnDocument: 'after' });
  if (!claimed) return res.status(409).json({ error: 'Body & Goals changed. Reload and review before applying.' });
  const updated = await Targets.findOneAndUpdate({ _id: targets._id, userId: req.dietUserId, updatedAt: targets.updatedAt }, { $set: values }, { returnDocument: 'after', runValidators: true });
  if (!updated) return res.status(409).json({ error: 'Daily targets changed. Reload and review before applying.' });
  res.json({ ...payload(claimed), appliedCalories: updated.calories });
});
require('../services/managedWorkspace').wrap(router);
module.exports = router;
