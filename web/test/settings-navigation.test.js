import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsSections, settingsSection, settingsHref } from '../src/settingsNavigation.js';

test('Appearance is available without MCP; Connections and Admin require existing permissions', () => {
  assert.deepEqual(settingsSections({}).map(s => s.id), ['appearance']);
  assert.deepEqual(settingsSections({ features: { diet: true, mcp: false }, isAdmin: true }).map(s => s.id), ['appearance','admin']);
  assert.deepEqual(settingsSections({ features: { diet: true, mcp: true }, isAdmin: true }).map(s => s.id), ['appearance','connections','admin']);
});
test('legacy MCP consent and Admin links select the correct permitted section', () => {
  const user = { features: { diet: true, mcp: true }, isAdmin: true };
  assert.equal(settingsSection('#settings?mcp_request=ticket', user), 'connections');
  assert.equal(settingsSection('#admin', user), 'admin');
  assert.equal(settingsSection('#settings?section=admin', user), 'admin');
  assert.equal(settingsSection('#settings', user), 'appearance');
  assert.equal(settingsSection('#settings?section=appearance&mcp_request=ticket', user), 'appearance');
});
test('forged or revoked section access falls back to Appearance', () => {
  for (const hash of ['#settings?section=admin','#settings?section=connections','#settings?mcp_request=ticket','#settings?section=unknown']) {
    assert.equal(settingsSection(hash, {}), 'appearance');
  }
});
test('section links preserve the pending MCP ticket', () => {
  const href = settingsHref('connections','#settings?mcp_request=pending');
  assert.equal(new URL(href,'http://localhost').hash, '#settings?mcp_request=pending&section=connections');
});
