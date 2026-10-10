import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui/appearance.css', import.meta.url), 'utf8');
function tokens(selector) {
  const block = css.slice(css.indexOf(selector) + selector.length).split('}')[0];
  return Object.fromEntries([...block.matchAll(/--appearance-([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
}
function rgb(hex) {
  const expanded = hex.length === 4 ? hex.slice(1).split('').map(value => value + value).join('') : hex.slice(1);
  return expanded.match(/../g).map(value => parseInt(value, 16));
}
function luminance(color) {
  const values = color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

test('Day and Night shell text/actions meet contrast requirements, including glass extremes', () => {
  const day = tokens(':root[data-appearance="immersive"] {');
  const night = { ...day, ...tokens(':root[data-appearance="immersive"][data-immersive-theme="night"] {') };
  for (const [name, palette] of Object.entries({ day, night })) {
    for (const text of ['text', 'muted']) {
      for (const surface of ['surface', 'hover']) {
        assert.ok(contrast(rgb(palette[text]), rgb(palette[surface])) >= 4.5, `${name} ${text} on ${surface}`);
      }
      const [r, g, b, alpha] = palette.glass.match(/[\d.]+/g).map(Number);
      for (const backdrop of [0, 255]) {
        const glass = [r, g, b].map(channel => channel * alpha + backdrop * (1 - alpha));
        assert.ok(contrast(rgb(palette[text]), glass) >= 4.5, `${name} ${text} on glass over ${backdrop}`);
      }
    }
    assert.ok(contrast(rgb(palette['on-primary']), rgb(palette.primary)) >= 4.5, `${name} primary action`);
    assert.ok(contrast(rgb(palette.focus), rgb(palette.surface)) >= 3, `${name} focus ring`);
  }
});

test('all scenic CSS references exist and meet the approved per-asset transfer budgets', () => {
  const paths = new Set([...css.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]));
  assert.equal(paths.size, 8);
  for (const path of paths) {
    const bytes = statSync(new URL(`../public${path}`, import.meta.url)).size;
    const budget = path.includes('-768.') ? 150_000 : 300_000;
    assert.ok(bytes > 0 && bytes <= budget, `${path}: ${bytes} bytes, budget ${budget}`);
  }
});

test('Family branch labels remain readable in Day and Night surfaces', () => {
  const familyCss = readFileSync(new URL('../src/ui/appearanceFamily.css', import.meta.url), 'utf8');
  const branches = [...familyCss.matchAll(/--family-branch:\s*(#[0-9a-f]{6});/g)].map(match => match[1]);
  const day = tokens(':root[data-appearance="immersive"] {');
  const night = { ...day, ...tokens(':root[data-appearance="immersive"][data-immersive-theme="night"] {') };
  assert.equal(branches.length, 2);
  for (const [index, palette] of [day, night].entries()) {
    assert.ok(contrast(rgb(branches[index]), rgb(palette.surface)) >= 4.5, `Family branch label in theme ${index}`);
    assert.ok(contrast(rgb(palette.primary), rgb(palette.surface)) >= 4.5, `Family initials in theme ${index}`);
  }
});

test('page status and chart colors remain readable in both Immersive themes', () => {
  const pages = readFileSync(new URL('../src/ui/appearancePages.css', import.meta.url), 'utf8');
  const blocks = [...pages.matchAll(/:root\[data-appearance="immersive"\](?:\[data-immersive-theme="night"\])?\s*\{([^}]+)\}/g)];
  const palettes = blocks.slice(0, 2).map(block => Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/g)].map(match => [match[1], match[2]])));
  const base = tokens(':root[data-appearance="immersive"] {');
  const themes = [base, { ...base, ...tokens(':root[data-appearance="immersive"][data-immersive-theme="night"] {') }];
  assert.equal(palettes.length, 2);
  for (const [index, palette] of palettes.entries()) {
    for (const status of ['danger', 'success', 'warning']) {
      assert.ok(contrast(rgb(palette[`color-${status}`]), rgb(palette[`color-${status}-soft`])) >= 4.5, `${status} text in theme ${index}`);
    }
    for (const [key, color] of Object.entries(palette).filter(([key]) => key.startsWith('metric-'))) {
      assert.ok(contrast(rgb(color), rgb(themes[index].surface)) >= 4.5, `${key} text in theme ${index}`);
      assert.ok(contrast(rgb(color), rgb(themes[index].hover)) >= 3, `${key} indicator in theme ${index}`);
    }
  }
});
