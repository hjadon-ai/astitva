import test from 'node:test';
import assert from 'node:assert/strict';
import { familyAge } from '../src/familyAge.js';
test('age uses local birthday boundaries and never displays negative age', () => {
  assert.equal(familyAge('2000-10-06', new Date(2026,9,5)),25);
  assert.equal(familyAge('2000-10-06', new Date(2026,9,6)),26);
  assert.equal(familyAge(null),null);
  assert.equal(familyAge('2030-01-01',new Date(2026,9,6)),null);
  assert.equal(familyAge('2000-02-29',new Date(2025,1,28)),24);
  assert.equal(familyAge('2000-02-29',new Date(2025,2,1)),25);
});
