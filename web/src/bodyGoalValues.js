export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const defaults = () => ({ heightCm: '', weightKg: '', measuredOn: today(), units: 'metric', age: '', sex: '', activity: '', eligible: false, goal: 'maintain', targetWeightKg: '', planMode: 'pace', paceKgWeek: 0.25, targetDate: '' });
export const shownDate = date => new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const displayNumber = n => Number(Number(n).toFixed(2));
export const toDisplayWeight = (kg, units) => units === 'imperial' ? kg / 0.45359237 : kg;
export const bodyInput = f => ({ ...f, heightCm: Number(f.heightCm), weightKg: Number(f.weightKg), age: f.age === '' ? null : Number(f.age), sex: f.sex || null, activity: f.activity || null,
  targetWeightKg: f.targetWeightKg === '' ? null : Number(f.targetWeightKg), paceKgWeek: f.paceKgWeek === '' ? null : Number(f.paceKgWeek), targetDate: f.targetDate || null });
export const editable = p => Object.fromEntries(Object.keys(defaults()).map(k => [k, p[k] ?? defaults()[k]]));


export function requireBodyGoalsResponse(result) {
  if (!result || !Array.isArray(result.weights) || !Number.isSafeInteger(result.revision) || result.revision < 0 || !Object.hasOwn(result, 'profile') || !Object.hasOwn(result, 'estimate')) {
    throw new Error('Weight records need the updated server. Restart the local server, then retry.');
  }
  return result;
}
