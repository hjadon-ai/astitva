import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyInput, editable, defaults, toDisplayWeight, requireBodyGoalsResponse } from '../src/bodyGoalValues.js';

test('preferred units never convert canonical saved measurements a second time', () => {
  const p = { ...defaults(), heightCm: 180, weightKg: 80, targetWeightKg: 75, units: 'imperial', age: 35 };
  const form = editable(p);
  assert.equal(bodyInput(form).weightKg, 80);
  assert.equal(bodyInput({...form, units:'metric'}).weightKg, 80);
  assert.ok(Math.abs(toDisplayWeight(80, 'imperial') * 0.45359237 - 80) < 1e-10);
  assert.equal(bodyInput({...form, age:''}).age, null);
});
test('older server responses explain the update instead of crashing weight charts', () => {
  assert.throws(() => requireBodyGoalsResponse({profile:null,estimate:null}), /updated server/);
  const response = { profile:null, estimate:null, weights:[{date:'2026-10-09',weightKg:80}], revision:1 };
  assert.equal(requireBodyGoalsResponse(response), response);
});
