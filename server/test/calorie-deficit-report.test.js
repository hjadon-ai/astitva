const test = require('node:test'), assert = require('node:assert/strict');
const { parseDeficitReport, deficitResult } = require('../src/services/calorieDeficitReport');
const profile = {heightCm:180,weightKg:80,measuredOn:'2026-10-01',units:'metric',age:35,sex:'male',activity:'sedentary',eligible:true,goal:'maintain',targetWeightKg:80,planMode:'pace'};
const now = new Date('2026-10-21T00:30:00Z');
const parse = (period,date,timezone='UTC') => parseDeficitReport({period,date,timezone},now);
test('calendar periods respect Monday weeks, leap years and reference dates',()=>{
 assert.equal(parse('weekly','2026-10-20').value.start,'2026-10-19');assert.equal(parse('weekly','2026-10-20').value.end,'2026-10-25');
 assert.equal(parse('weekly','2027-01-01').value.start,'2026-12-28');assert.equal(parse('weekly','2027-01-01').value.end,'2027-01-03');
 assert.equal(parse('monthly','2024-02-20').value.end,'2024-02-29');assert.equal(parse('monthly','2023-02-20').value.end,'2023-02-28');
 assert.equal(parse('monthly','9999-12-15').value.end,'9999-12-31');
 assert.ok(parse('weekly','0000-01-01').error);assert.ok(parse('weekly','9999-12-31').error);
});
test('timezone determines today across midnight and DST without shifting meal calendar dates',()=>{
 assert.equal(parse('daily','2026-10-20','America/Los_Angeles').value.asOfDate,'2026-10-20');assert.equal(parse('daily','2026-10-20','Asia/Kolkata').value.asOfDate,'2026-10-21');
 const dst=parseDeficitReport({period:'weekly',date:'2026-03-08',timezone:'America/Los_Angeles'},new Date('2026-03-08T09:30:00Z')).value;
 assert.equal(dst.start,'2026-03-02');assert.equal(dst.end,'2026-03-08');assert.equal(dst.asOfDate,'2026-03-08');
});
test('invalid and repeated inputs fail validation',()=>{
 for(const query of [{},{period:'yearly',date:'2026-10-20',timezone:'UTC'},{period:'daily',date:'2026-02-30',timezone:'UTC'},{period:'daily',date:'2026-10-20',timezone:'invalid'},{period:'daily',date:['2026-10-20'],timezone:'UTC'},{period:'daily',date:'2026-10-20',timezone:'UTC',userId:'foreign'}])assert.ok(parseDeficitReport(query,now).error);
});
const day=(date,mealCount,calories)=>({date,mealCount,totals:{calories}});
test('period totals exclude today, unlogged and future days and retain negative deficits',()=>{
 const range=parse('weekly','2026-10-20').value;
 const result=deficitResult(range,{days:[day('2026-10-19',1,1800),day('2026-10-20',2,2500),day('2026-10-21',1,300),day('2026-10-22',1,100),day('2026-10-23',0,0),day('2026-10-24',0,0),day('2026-10-25',0,0)]},profile);
 assert.equal(result.maintenanceCaloriesPerDay,2106);assert.equal(result.totals.consumedCalories,4300);assert.equal(result.totals.estimatedNetDeficitCalories,-88);
 assert.equal(result.todayPartial.estimatedDeficitCalories,1806);assert.equal(result.days[3].consumedCalories,null);assert.equal(result.days[3].mealCount,0);
 assert.equal(result.coverage.pastRecordedDays,2);assert.equal(result.coverage.futureDays,4);
});
test('missing and ineligible maintenance preserve recorded intake but never invent deficit',()=>{
 const range=parse('daily','2026-10-19').value;
 for(const baseline of [null,{...profile,eligible:false},{...profile,age:16},{...profile,activity:null}]){
  const result=deficitResult(range,{days:[day('2026-10-19',1,1500)]},baseline);
  assert.equal(result.status,'unavailable');assert.equal(result.reason,'MAINTENANCE_UNAVAILABLE');assert.equal(result.totals.consumedCalories,1500);assert.equal(result.days[0].estimatedDeficitCalories,null);
 }
});
test('empty, partial-only and future-only reports have null period deficit totals',()=>{
 for(const [date,mealCount] of [['2026-10-19',0],['2026-10-21',1],['2026-10-22',1]]){
  const result=deficitResult(parse('daily',date).value,{days:[day(date,mealCount,200)]},profile);
  assert.equal(result.status,'unavailable');assert.equal(result.totals.estimatedNetDeficitCalories,null);assert.equal(result.totals.consumedCalories,null);
 }
 const zero=deficitResult(parse('daily','2026-10-19').value,{days:[day('2026-10-19',1,0)]},profile);
 assert.equal(zero.status,'available');assert.equal(zero.totals.estimatedNetDeficitCalories,2106);
});
