const test=require('node:test'),assert=require('node:assert/strict');
const {historyRange,historyDays}=require('../src/services/dietHistory');
test('history bounds cover ten days, calendar-month clamp and timezone today',()=>{
 const now=new Date('2026-05-31T01:00:00Z');const range=historyRange(undefined,'UTC',now);
 assert.equal(range.earliest,'2026-02-28');assert.equal(range.start,'2026-05-22');
 assert.equal(historyRange(undefined,'America/Los_Angeles',now).latest,'2026-05-30');
 assert.equal(historyRange('2026-02-28','UTC',now).start,'2026-02-28');
 for(const end of ['2026-02-27','2026-06-01','2026-02-30',[]])assert.ok(historyRange(end,'UTC',now).error);
 assert.ok(historyRange(undefined,'Not/AZone',now).error);
});
test('history fills missing dates without losing recorded zero or water-only entries',()=>{
 const days=historyDays({start:'2026-10-01',end:'2026-10-03'},[{_id:'2026-10-01',calories:123,proteinGrams:1.25,count:1}],[{_id:'2026-10-03',waterMilliliters:500,count:2}]);
 assert.equal(days.length,3);assert.equal(days[0].totals.proteinGrams,1.3);assert.equal(days[1].mealCount,0);assert.equal(days[1].totals.calories,0);assert.equal(days[2].waterEntryCount,2);assert.equal(days[2].totals.waterMilliliters,500);
});
