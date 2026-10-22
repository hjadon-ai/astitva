const { validDate } = require('./diet');
const { estimateBodyGoals } = require('./bodyGoals');
const BodyGoals = require('../models/BodyGoals');
const { getNutritionReport } = require('./dietNutritionReport');
const shift = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
function localDate(timezone, now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
function parseDeficitReport(query, now = new Date()) {
  const fail = error => ({ error, code: 'INVALID_CALORIE_DEFICIT_REPORT' });
  if (Object.keys(query).some(key => !['period', 'date', 'timezone'].includes(key)) || Object.values(query).some(value => typeof value !== 'string')) return fail('Supply only single period, date and timezone parameters.');
  const { period, date, timezone } = query;
  if (!['daily', 'weekly', 'monthly'].includes(period) || !validDate(date)) return fail('Use period daily, weekly or monthly and a valid YYYY-MM-DD date.');
  if (!timezone || timezone.length > 100 || /^[+-]/.test(timezone)) return fail('Supply a valid IANA timezone.');
  let asOfDate;
  try { asOfDate = localDate(timezone, now); } catch { return fail('Supply a valid IANA timezone.'); }
  let start = date, end = date;
  if (period === 'weekly') {
    const weekday = new Date(date).getUTCDay();
    start = shift(date, -((weekday + 6) % 7));
    if (!validDate(start)) return fail('The resolved period is outside supported calendar dates.');
    end = shift(start, 6);
  } else if (period === 'monthly') {
    start = date.slice(0, 7) + '-01';
    const next = new Date(start); next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(0);
    end = next.toISOString().slice(0, 10);
  }
  if (!validDate(start) || !validDate(end) || start > end) return fail('The resolved period is outside supported calendar dates.');
  return { value: { period, date, timezone, start, end, asOfDate } };
}
function deficitResult(range, nutrition, profile) {
  const estimate = estimateBodyGoals(profile);
  const value = estimate?.maintenanceCalories;
  const maintenance = Number.isFinite(value) && value > 0 ? value : null;
  const coverage = { totalDays: nutrition.days.length, pastRecordedDays: 0, unloggedPastDays: 0, partialDays: 0, futureDays: 0 };
  let consumed = 0, netDeficit = 0;
  const days = nutrition.days.map(day => {
    const status = day.date > range.asOfDate ? 'future' : day.date === range.asOfDate ? 'partial' : day.mealCount ? 'recorded' : 'unlogged';
    const hasIntake = status !== 'future' && day.mealCount > 0;
    const consumedCalories = hasIntake ? day.totals.calories : null;
    const estimatedDeficitCalories = hasIntake && maintenance !== null ? maintenance - consumedCalories : null;
    if (status === 'recorded') { coverage.pastRecordedDays++; consumed += consumedCalories; if (estimatedDeficitCalories !== null) netDeficit += estimatedDeficitCalories; }
    else if (status === 'unlogged') coverage.unloggedPastDays++;
    else if (status === 'future') coverage.futureDays++;
    else coverage.partialDays++;
    return { date: day.date, status, mealCount: status === 'future' ? 0 : day.mealCount, consumedCalories, estimatedDeficitCalories };
  });
  const available = maintenance !== null && coverage.pastRecordedDays > 0;
  return {
    ...range, label: 'Estimated deficit from recorded meals',
    status: available ? 'available' : 'unavailable', reason: maintenance === null ? 'MAINTENANCE_UNAVAILABLE' : coverage.pastRecordedDays === 0 ? 'NO_RECORDED_PAST_DAYS' : null,
    maintenanceCaloriesPerDay: maintenance, maintenanceBasis: 'current-body-goals-estimate', maintenanceReason: maintenance === null ? estimate?.reason || 'Set up eligible Body & Goals measurements and calorie-estimate answers.' : null,
    totalBasis: 'past-days-with-recorded-meals-only', coverage,
    totals: { recordedDays: coverage.pastRecordedDays, consumedCalories: coverage.pastRecordedDays ? consumed : null, estimatedNetDeficitCalories: available ? netDeficit : null },
    todayPartial: days.find(day => day.status === 'partial') || null, days,
    limitations: ['Recorded past days may be incomplete; logging completeness is not certified.', 'Current maintenance is an estimate applied across the period, not a historical maintenance snapshot.', 'Today, future days and unlogged past days are excluded from period totals. Negative deficit values represent surplus.']
  };
}
async function getCalorieDeficitReport(userId, range) {
  const [nutrition, profile] = await Promise.all([
    getNutritionReport(userId, { start: range.start, end: range.end, mealType: null, nutrients: ['calories'] }),
    BodyGoals.findOne({ userId }).lean()
  ]);
  return deficitResult(range, nutrition, profile);
}
module.exports = { parseDeficitReport, deficitResult, getCalorieDeficitReport };
