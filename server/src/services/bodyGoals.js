const { validDate } = require('./diet');
const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
const round = (n, places = 1) => Number(n.toFixed(places));
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const dayDifference = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000;
const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

function validateBodyGoals(body, now = new Date(), previous = null) {
  const keys = ['heightCm', 'weightKg', 'measuredOn', 'units', 'age', 'sex', 'activity', 'eligible', 'goal', 'targetWeightKg', 'planMode', 'paceKgWeek', 'targetDate', 'expectedRevision'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !keys.includes(k))) return { error: 'Only body measurements, optional answers and goal fields are accepted.' };
  const fields = {};
  if (!number(body.heightCm, 100, 250)) fields.heightCm = 'Enter a height from 100 to 250 cm.';
  if (!number(body.weightKg, 25, 350)) fields.weightKg = 'Enter a weight from 25 to 350 kg.';
  // Allow the next UTC date for users ahead of UTC; no further future measurements.
  if (!validDate(body.measuredOn) || body.measuredOn > addDays(now.toISOString().slice(0, 10), 1)) fields.measuredOn = 'Choose a valid measurement date, not a future date.';
  if (!['metric', 'imperial'].includes(body.units)) fields.units = 'Choose metric or imperial.';
  if (body.age != null && (!number(body.age, 1, 120) || !Number.isInteger(body.age))) fields.age = 'Enter a whole age from 1 to 120, or leave blank.';
  if (body.sex != null && !['female', 'male'].includes(body.sex)) fields.sex = 'Choose a calculation sex or leave blank.';
  if (body.activity != null && !Object.hasOwn(activityFactors, body.activity)) fields.activity = 'Choose an activity level or leave blank.';
  if (typeof body.eligible !== 'boolean') fields.eligible = 'Confirm whether adult estimates apply.';
  if (!['maintain', 'lose', 'gain'].includes(body.goal)) fields.goal = 'Choose maintain, lose or gain.';
  if (!['pace', 'date'].includes(body.planMode)) fields.planMode = 'Choose a pace or a date.';
  const continuing = previous?.heightCm === body.heightCm && previous?.goal === body.goal && previous?.targetWeightKg === body.targetWeightKg && previous?.planMode === body.planMode && (body.planMode === 'pace' ? previous?.paceKgWeek === body.paceKgWeek : previous?.targetDate === body.targetDate);
  const referenceWeight = continuing ? previous.baseline?.weightKg ?? previous.weightKg : body.weightKg;
  const referenceDate = continuing ? previous.baseline?.date ?? previous.measuredOn : body.measuredOn;
  if (body.goal !== 'maintain') {
    if (!number(body.targetWeightKg, 25, 350)) fields.targetWeightKg = 'Enter a target weight from 25 to 350 kg.';
    else if ((body.goal === 'lose' && body.targetWeightKg >= referenceWeight) || (body.goal === 'gain' && body.targetWeightKg <= referenceWeight)) fields.targetWeightKg = 'Target weight must match your chosen goal direction.';
    if (body.planMode === 'pace' && !number(body.paceKgWeek, 0.1, 0.5)) fields.paceKgWeek = 'Choose a pace from 0.1 to 0.5 kg per week.';
    if (body.planMode === 'date') {
      const days = validDate(body.targetDate) && validDate(referenceDate) ? dayDifference(referenceDate, body.targetDate) : 0;
      const pace = Math.abs(body.targetWeightKg - referenceWeight) * 7 / days;
      if (days <= 0 || days > 3650 || !number(pace, 0.1, 0.5)) fields.targetDate = 'Choose a later date corresponding to 0.1–0.5 kg per week (within 10 years).';
    }
  }
  if (Object.keys(fields).length) return { error: Object.values(fields).join(' '), fields };
  return { value: {
    heightCm: round(body.heightCm, 4), weightKg: round(body.weightKg, 4), measuredOn: body.measuredOn, units: body.units,
    age: body.age ?? null, sex: body.sex ?? null, activity: body.activity ?? null, eligible: body.eligible,
    goal: body.goal, targetWeightKg: body.goal === 'maintain' ? round(body.weightKg, 4) : round(body.targetWeightKg, 4),
    planMode: body.planMode, paceKgWeek: body.goal === 'maintain' || body.planMode === 'date' ? null : body.paceKgWeek,
    targetDate: body.goal === 'maintain' || body.planMode === 'pace' ? null : body.targetDate
  } };
}

function paceProjection(weight, date, target, pace) {
  const delta = target - weight;
  const days = delta === 0 ? 84 : Math.ceil(Math.abs(delta) / pace * 7);
  if (!Number.isFinite(days) || days > 3650 || days < 1) return null;
  const sign = Math.sign(delta);
  const points = Array.from({ length: 13 }, (_, i) => {
    const elapsed = Math.round(days * i / 12);
    const weightAt = multiplier => weight + sign * Math.min(Math.abs(delta), pace * multiplier * elapsed / 7);
    const weights = [weightAt(0.75), weightAt(1.25)];
    return { date: addDays(date, elapsed), weightKg: round(weightAt(1)), lowKg: round(Math.min(...weights)), highKg: round(Math.max(...weights)) };
  });
  return { startDate: date, targetDate: addDays(date, days), weeks: round(days / 7), paceKgWeek: round(pace, 3), points,
    earliestDate: delta === 0 ? null : addDays(date, Math.ceil(days / 1.25)),
    latestDate: delta === 0 ? null : addDays(date, Math.ceil(days / 0.75)) };
}

function estimateBodyGoals(profile) {
  if (!profile?.heightCm) return null;
  const bmi = profile.weightKg / (profile.heightCm / 100) ** 2;
  const result = { bmi: round(bmi), maintenanceCalories: null, proposedCalories: null, restingCalories: null, projection: null, prediction: null, reason: null };
  if (!profile.eligible || (profile.age != null && profile.age < 18)) {
    result.reason = 'Confirm adult eligibility to enable estimates. These estimates exclude pregnancy and breastfeeding.';
    return result;
  }
  if (profile.goal === 'lose' && (bmi < 18.5 || profile.targetWeightKg / (profile.heightCm / 100) ** 2 < 18.5)) {
    result.reason = 'This weight-loss scenario is outside the supported planning range. Review the goal with a qualified professional.';
    return result;
  }
  const start = profile.baseline || { weightKg: profile.weightKg, date: profile.measuredOn };
  const delta = profile.targetWeightKg - start.weightKg;
  const pace = profile.goal === 'maintain' ? 0 : profile.planMode === 'date'
    ? Math.abs(delta) * 7 / dayDifference(start.date, profile.targetDate) : profile.paceKgWeek;
  result.goalReached = profile.goal === 'lose' ? profile.weightKg <= profile.targetWeightKg : profile.goal === 'gain' ? profile.weightKg >= profile.targetWeightKg : false;
  result.projection = paceProjection(start.weightKg, start.date, profile.goal === 'maintain' ? start.weightKg : profile.targetWeightKg, pace);
  result.prediction = paceProjection(profile.weightKg, profile.measuredOn, profile.goal === 'maintain' || result.goalReached ? profile.weightKg : profile.targetWeightKg, result.goalReached ? 0 : pace);
  if (!result.projection || !result.prediction) {
    result.reason = 'Choose a goal within a 10-year planning horizon.';
    result.projection = null; result.prediction = null;
    return result;
  }
  if (!(profile.age >= 18) || !profile.sex || !profile.activity) {
    result.reason = 'Add age, calculation sex and activity for a calorie estimate. Your weight prediction uses the chosen pace.';
    return result;
  }
  const resting = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === 'male' ? 5 : -161);
  const maintenance = resting * activityFactors[profile.activity];
  result.restingCalories = Math.round(resting);
  result.maintenanceCalories = Math.round(maintenance);
  result.activityFactor = activityFactors[profile.activity];
  result.adjustmentPercent = result.goalReached ? 0 : profile.goal === 'lose' ? -15 : profile.goal === 'gain' ? 10 : 0;
  const proposed = maintenance * (1 + result.adjustmentPercent / 100);
  if (resting <= 0 || proposed < 1200 || proposed > 6000) {
    if (resting <= 0) { result.restingCalories = null; result.maintenanceCalories = null; }
    result.projection = null; result.prediction = null;
    result.reason = 'This scenario is outside the supported calorie-planning range. Review the goal with a qualified professional.';
    return result;
  }
  result.proposedCalories = Math.round(proposed);
  return result;
}

function validateWeight(body, date, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['weightKg', 'units', 'expectedRevision'].includes(k))) return { error: 'Enter only weight, units and the saved revision.' };
  if (!validDate(date) || date > addDays(now.toISOString().slice(0, 10), 1)) return { error: 'Choose a valid measurement date, not a future date.' };
  if (!number(body.weightKg, 25, 350)) return { error: 'Enter a weight from 25 to 350 kg.' };
  if (!['metric', 'imperial'].includes(body.units)) return { error: 'Choose metric or imperial units.' };
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) return { error: 'Provide the saved revision.' };
  return { value: { date, weightKg: round(body.weightKg, 4) } };
}

function recordWeight(previous, entry, units) {
  const weights = [...(previous?.weights || []).filter(w => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
  const latest = weights.at(-1);
  return { weights, units, weightKg: latest.weightKg, measuredOn: latest.date };
}

function targetValues(targets, calories) {
  const macroTotal = targets.proteinGrams * 4 + targets.carbohydrateGrams * 4 + targets.fatGrams * 9;
  if (!(macroTotal > 0)) return null;
  const result = Object.fromEntries(['proteinGrams', 'carbohydrateGrams', 'fatGrams'].map(key => [key, Math.max(0.1, round(targets[key] * calories / macroTotal))]));
  return { ...result, calories: Math.round(result.proteinGrams * 4 + result.carbohydrateGrams * 4 + result.fatGrams * 9) };
}
function withBaseline(profile, previous) {
  const samePlan = previous && ['heightCm', 'goal', 'targetWeightKg', 'planMode', 'paceKgWeek', 'targetDate'].every(k => profile[k] === previous[k]);
  return { ...profile, baseline: samePlan ? previous.baseline || { weightKg: previous.weightKg, date: previous.measuredOn } : { weightKg: profile.weightKg, date: profile.measuredOn } };
}
module.exports = { validateBodyGoals, estimateBodyGoals, targetValues, activityFactors, withBaseline, validateWeight, recordWeight };
