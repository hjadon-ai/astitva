import test from 'node:test';
import assert from 'node:assert/strict';
import {repeatMealInput} from '../src/repeatMeal.js';
const meal = {name:'Rice', quantity:2, servingDescription:'2 bowls', nutrition:{calories:301, proteinGrams:7.3, carbohydrateGrams:63.1, fatGrams:1.3, fiberGrams:2.1}};
test('repeating a recorded library portion does not multiply its original quantity again',()=>{
 const result=repeatMealInput(meal,{date:'2026-10-10',mealType:'lunch',quantity:'1'});
 assert.deepEqual(result.nutrition,meal.nutrition);
 assert.equal(result.servingDescription,'2 bowls');
 assert.equal(result.date,'2026-10-10');
 assert.equal(result.mealType,'lunch');
 assert.equal(Object.hasOwn(result,'quantity'),false);
});
test('fractional repeats round whole calories and one-decimal macros for manual validation',()=>{
 const result=repeatMealInput(meal,{date:'2026-10-10',mealType:'snack',quantity:'0.5'});
 assert.deepEqual(result.nutrition,{calories:151,proteinGrams:3.7,carbohydrateGrams:31.6,fatGrams:0.7,fiberGrams:1.1});
 assert.equal(result.servingDescription,'0.5 × recorded portion: 2 bowls');
 assert.deepEqual(meal.nutrition,{calories:301,proteinGrams:7.3,carbohydrateGrams:63.1,fatGrams:1.3,fiberGrams:2.1});
});
