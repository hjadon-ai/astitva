const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNutritionReport, reportResult } = require('../src/services/dietNutritionReport');
test('nutrition range validation accepts leap-year boundaries and limits output to 366 days', () => {
  const parse = extra => parseNutritionReport({ start:'2024-01-01', end:'2024-12-31', ...extra });
  assert.ok(parse({}).value);
  assert.equal(reportResult(parse({}).value, []).days.length,366);
  for (const extra of [{end:'2025-01-01'},{start:'2024-02-30'},{start:'2024-12-31',end:'2024-01-01'},{start:''},{start:['2024-01-01','2024-01-02']},{mealType:'brunch'},{nutrients:'proteinGrams,proteinGrams'},{nutrients:''},{nutrients:'userId'},{userId:'foreign'}]) assert.ok(parse(extra).error,JSON.stringify(extra));
  assert.ok(parseNutritionReport({start:'2024-02-29',end:'2024-02-29'}).value);
  assert.ok(parseNutritionReport({start:'2023-02-29',end:'2023-03-01'}).error);
});
test('nutrition report includes zero days and only requested nutrient fields', () => {
  const range = parseNutritionReport({start:'2026-10-01',end:'2026-10-03',mealType:'lunch',nutrients:'proteinGrams, fiberGrams'}).value;
  const report = reportResult(range,[{_id:'2026-10-03',mealCount:2,proteinGrams:103,fiberGrams:12},{_id:'2026-10-01',mealCount:1,proteinGrams:1,fiberGrams:2}]);
  assert.equal(report.mealCount,3);
  assert.deepEqual(report.totals,{proteinGrams:10.4,fiberGrams:1.4});
  assert.deepEqual(report.days.map(day=>day.date),['2026-10-01','2026-10-02','2026-10-03']);
  assert.deepEqual(report.days[1],{date:'2026-10-02',mealCount:0,totals:{proteinGrams:0,fiberGrams:0}});
});
