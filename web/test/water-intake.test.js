import test from 'node:test';
import assert from 'node:assert/strict';
import {updateWaterIntake} from '../src/waterIntake.js';
test('water additions and deletions recalculate intake without changing the input',()=>{
 const water={entries:[{id:'a',amountMilliliters:250}],consumedMilliliters:250,targetMilliliters:500};
 const added=updateWaterIntake(water,{entry:{id:'b',amountMilliliters:500}});
 assert.equal(added.consumedMilliliters,750);assert.equal(added.overTargetMilliliters,250);assert.equal(added.remainingMilliliters,0);assert.equal(water.entries.length,1);
 const removed=updateWaterIntake(added,{deletedId:'b'});assert.equal(removed.consumedMilliliters,250);assert.equal(removed.remainingMilliliters,250);
 assert.equal(updateWaterIntake({...water,targetMilliliters:null},{deletedId:'a'}).remainingMilliliters,null);
});
