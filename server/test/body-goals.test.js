const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBodyGoals, estimateBodyGoals, targetValues, withBaseline } = require('../src/services/bodyGoals');
const base = { heightCm: 180, weightKg: 80, measuredOn: '2026-10-08', units: 'metric', age: 35, sex: 'male', activity: 'sedentary', eligible: true, goal: 'lose', targetWeightKg: 75, planMode: 'pace', paceKgWeek: 0.25, targetDate: null };
const validate = input => validateBodyGoals(input, new Date('2026-10-08T12:00:00Z'));
test('height and weight alone support BMI without optional calorie answers', () => {
  const p = validate({ ...base, age: null, sex: null, activity: null, eligible: false }).value;
  const estimate = estimateBodyGoals(p);
  assert.equal(estimate.bmi, 24.7);
  assert.equal(estimate.maintenanceCalories, null);
  assert.equal(estimate.projection, null);
});
test('adult energy equation, percentage target and goal timeline use distinct assumptions', () => {
  const e = estimateBodyGoals(validate(base).value);
  assert.equal(e.restingCalories, 1755);
  assert.equal(e.maintenanceCalories, 2106);
  assert.equal(e.proposedCalories, 1790);
  assert.equal(e.projection.weeks, 20);
  assert.equal(e.projection.targetDate, '2027-02-25');
  assert.equal(e.projection.points.at(-1).weightKg, 75);
  assert.ok(e.projection.points.every(p => p.lowKg <= p.weightKg && p.highKg >= p.weightKg));
  assert.equal(estimateBodyGoals({ ...base, sex: 'female' }).restingCalories, 1589);
});
test('malformed, unsafe or contradictory measurements and goals are rejected', () => {
  for (const patch of [{ heightCm: '180' }, { weightKg: Infinity }, { age: 22.5 }, { eligible: 'true' }, { activity: 'constructor' }, { measuredOn: '2026-02-30' }, { measuredOn: '2026-10-12' }, { targetWeightKg: 90 }, { paceKgWeek: 2 }, { planMode: 'date', targetDate: '2026-10-09' }, { units: 'other' }, { userId: 'forged' }]) assert.ok(validate({ ...base, ...patch }).error, JSON.stringify(patch));
});
test('underage, excluded eligibility and unsupported weight-loss scenarios never offer calorie application', () => {
  for (const patch of [{ age: 17 }, { eligible: false }, { weightKg: 55, targetWeightKg: 50 }, { targetWeightKg: 50 }, { weightKg: 25, heightCm: 100, age: 120, sex: 'female' }]) {
    const e = estimateBodyGoals({ ...base, ...patch });
    assert.equal(e.proposedCalories, null);
    assert.equal(e.projection, null);
  }
});
test('date-based and gain/maintain scenarios calculate valid paths', () => {
  const date = estimateBodyGoals(validate({ ...base, planMode: 'date', targetDate: '2027-02-25' }).value);
  assert.equal(date.projection.paceKgWeek, 0.25);
  const gain = estimateBodyGoals(validate({ ...base, goal: 'gain', targetWeightKg: 85 }).value);
  assert.equal(gain.proposedCalories, 2317);
  assert.equal(gain.projection.points.at(-1).weightKg, 85);
  const maintain = estimateBodyGoals(validate({ ...base, goal: 'maintain', targetWeightKg: null }).value);
  assert.equal(maintain.proposedCalories, 2106);
  assert.ok(maintain.projection.points.every(p => p.weightKg === 80));
});
test('new weights recalibrate calories while preserving the original goal comparison', () => {
  const p = withBaseline(validate(base).value, null);
  const next = withBaseline(validateBodyGoals({ ...base, weightKg: 79, measuredOn: '2026-10-15' }, new Date('2026-10-15T12:00:00Z')).value, p);
  assert.equal(next.baseline.weightKg, 80);
  assert.equal(estimateBodyGoals(next).projection.startDate, '2026-10-08');
  assert.ok(estimateBodyGoals(next).maintenanceCalories < estimateBodyGoals(p).maintenanceCalories);
  assert.equal(withBaseline({ ...next, targetWeightKg: 74 }, p).baseline.weightKg, 79);
});
test('applying calories preserves macro proportions and does not overwrite fiber or water', () => {
  const v = targetValues({ proteinGrams: 100, carbohydrateGrams: 250, fatGrams: 60, fiberGrams: 25, waterMilliliters: 2000 }, 1790);
  assert.equal(v.calories, Math.round(v.proteinGrams * 4 + v.carbohydrateGrams * 4 + v.fatGrams * 9));
  assert.ok(Math.abs(v.calories - 1790) <= 2);
  assert.ok(Math.abs(v.carbohydrateGrams / v.proteinGrams - 2.5) < 0.01);
  assert.equal(v.waterMilliliters, undefined);
  assert.equal(v.fiberGrams, undefined);
});

test('optional calorie questions do not block pace-based predictions for a confirmed adult', () => {
  const e = estimateBodyGoals(validate({ ...base, age: null, sex: null, activity: null }).value);
  assert.equal(e.proposedCalories, null);
  assert.equal(e.prediction.points[0].weightKg, 80);
  assert.equal(e.prediction.points.at(-1).weightKg, 75);
});
test('daily weight logging validates standalone entries, replaces dates and keeps the newest measurement current', () => {
  const { validateWeight, recordWeight } = require('../src/services/bodyGoals');
  const entry = validateWeight({ weightKg: 79.5, units: 'metric', expectedRevision: 0 }, '2026-10-08', new Date('2026-10-08')).value;
  const initial = recordWeight(null, entry, 'metric');
  assert.equal(initial.weightKg, 79.5);
  assert.equal(initial.weights.length, 1);
  const historical = recordWeight(initial, { date: '2026-10-01', weightKg: 80 }, 'imperial');
  assert.equal(historical.weightKg, 79.5);
  assert.equal(historical.measuredOn, '2026-10-08');
  const corrected = recordWeight(historical, { date: '2026-10-08', weightKg: 79 }, 'metric');
  assert.equal(corrected.weights.length, 2);
  assert.equal(corrected.weightKg, 79);
  for (const patch of [{weightKg: '80'}, {weightKg: 0}, {weightKg: Infinity}, {expectedRevision: -1}, {userId: 'forged'}, {units:'other'}]) assert.ok(validateWeight({weightKg:80,units:'metric',expectedRevision:0,...patch}, '2026-10-08', new Date('2026-10-08')).error);
  assert.ok(validateWeight({weightKg:80,units:'metric',expectedRevision:0}, '2026-02-30').error);
});
test('updated weights refresh the prediction while the original plan remains available for comparison', () => {
  const p = withBaseline(validate(base).value, null);
  const e = estimateBodyGoals({ ...p, weightKg: 79, measuredOn: '2026-10-15' });
  assert.equal(e.projection.startDate, '2026-10-08');
  assert.equal(e.prediction.startDate, '2026-10-15');
  assert.equal(e.prediction.points[0].weightKg, 79);
  assert.equal(e.prediction.weeks, 16);
});
test('reaching a saved goal permits measurement updates and switches the calorie proposal to maintenance', () => {
  const previous = withBaseline(validate(base).value, null);
  const input = validateBodyGoals({ ...base, weightKg: 74.5 }, new Date('2026-10-08'), previous);
  assert.ok(input.value);
  const e = estimateBodyGoals(withBaseline(input.value, previous));
  assert.equal(e.goalReached, true);
  assert.equal(e.proposedCalories, e.maintenanceCalories);
  assert.ok(e.prediction.points.every(p => p.weightKg === 74.5));
});
