const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDetails, validBirthDate } = require('../src/services/familyDetails');
test('calendar dates reject normalization and validate leap years', () => {
  for (const d of ['2023-02-29', '2024-02-30', '2024-04-31', '0000-01-01', '2024-13-01', '2024-01-00', '2024-1-01']) assert.equal(validBirthDate(d), false);
  for (const d of [null, '2000-02-29', '2024-02-29', '1900-02-28']) assert.equal(validBirthDate(d), true);
});
test('details enforce exact shapes, limits and partial update semantics', () => {
  for (const b of [{}, [], null, {role:'ADMIN'}, {note:1}, {preferredName:'x'.repeat(81)}, {note:'x'.repeat(1001)}, {birthDate:'bad'}, {preferredName:'a\nb'}]) assert.equal(parseDetails(b), null);
  assert.deepEqual(parseDetails({preferredName:'  Alex ', note:'<script>literal</script>\nnotes'}), {preferredName:'Alex', note:'<script>literal</script>\nnotes'});
  assert.deepEqual(parseDetails({note:null}), {note:null});
});
