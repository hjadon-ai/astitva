const test = require('node:test');
const assert = require('node:assert/strict');
const { mcpHistoryRange } = require('../src/services/dietMcp');
const { dayResult } = require('../src/services/dietRead');
const { validRedirect } = require('../src/services/mcpAuth');
const now = new Date('2026-10-10T02:00:00Z');
test('MCP history enforces inclusive bounds and the user timezone', () => {
  assert.equal(mcpHistoryRange({ start: '2026-09-09', end: '2026-10-09', timezone: 'America/Los_Angeles' }, now).latest, '2026-10-09');
  for (const input of [{ start: '2026-09-08', end: '2026-10-09', timezone: 'UTC' }, { start: '2026-10-10', end: '2026-10-10', timezone: 'America/Los_Angeles' }, { start: '2026-06-01', end: '2026-06-02', timezone: 'UTC' }, { start: '2026-10-09', end: '2026-10-09', timezone: 'invalid' }]) assert.throws(() => mcpHistoryRange(input, now));
});
test('OAuth callbacks reject insecure non-loopback URLs and embedded credentials', () => {
  for (const uri of ['https://example.test/callback', 'http://127.0.0.1:4389/callback/x', 'http://localhost/callback']) assert.equal(validRedirect(uri), true);
  for (const uri of ['http://example.test/callback', 'https://user:pass@example.test/callback', 'javascript:alert(1)', 'https://example.test/#token']) assert.equal(validRedirect(uri), false);
});
test('shared Diet day calculation preserves snapshots, missing targets and rounding', () => {
  const meal = {_id:'meal', name:'Rice', consumedOn:'2026-10-09', mealType:'lunch', calories:301, proteinGrams:7.3, carbohydrateGrams:63.1, fatGrams:1.3, fiberGrams:2.1, quantity:2};
  const data = dayResult('2026-10-09', [meal,meal], null, [{_id:'water',amountMilliliters:250}]);
  assert.equal(data.totals.proteinGrams,14.6); assert.equal(data.totals.calories,602);
  assert.equal(data.targets,null); assert.equal(data.water.remainingMilliliters,null); assert.equal(data.water.consumedMilliliters,250);
  assert.equal(data.meals[0].nutrition.calories,301);
});
