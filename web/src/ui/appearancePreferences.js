export const APPEARANCE_KEY = 'astitva.appearance.v1';

export function normalizeAppearance(value) {
  return {
    layout: value?.layout === 'immersive' ? 'immersive' : 'original',
    theme: value?.theme === 'night' ? 'night' : 'day',
  };
}

export function readAppearance(storage) {
  try { return normalizeAppearance(JSON.parse(storage.getItem(APPEARANCE_KEY))); }
  catch { return normalizeAppearance(null); }
}

export function writeAppearance(storage, value) {
  try { storage.setItem(APPEARANCE_KEY, JSON.stringify(normalizeAppearance(value))); }
  catch { /* Browser storage may be blocked; in-memory preferences still work. */ }
}
