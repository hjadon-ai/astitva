import test from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_KEY, normalizeAppearance, readAppearance, writeAppearance } from '../src/ui/appearancePreferences.js';

test('appearance defaults and invalid persisted values use Original and Day', () => {
  for (const value of [null, undefined, [], 'night', { layout: 'unknown', theme: 'auto' }]) {
    assert.deepEqual(normalizeAppearance(value), { layout: 'original', theme: 'day' });
  }
  assert.deepEqual(readAppearance({ getItem: () => '{invalid' }), { layout: 'original', theme: 'day' });
});

test('storage round trip preserves Night while Original is selected', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  writeAppearance(storage, { layout: 'immersive', theme: 'night' });
  const immersive = readAppearance(storage);
  writeAppearance(storage, { ...immersive, layout: 'original' });
  assert.deepEqual(readAppearance(storage), { layout: 'original', theme: 'night' });
  assert.equal(values.size, 1);
  assert.ok(values.has(APPEARANCE_KEY));
});

test('denied browser storage does not throw', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(readAppearance(blocked), { layout: 'original', theme: 'day' });
  assert.doesNotThrow(() => writeAppearance(blocked, { layout: 'immersive', theme: 'night' }));
});
