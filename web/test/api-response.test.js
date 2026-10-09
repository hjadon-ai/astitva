import test from 'node:test';
import assert from 'node:assert/strict';
import { readApiJson } from '../src/apiResponse.js';

test('missing Body & Goals route explains the server update instead of exposing HTML parsing errors', async () => {
  const response = new Response('<!doctype html><html>Cannot GET /api/diet/body-goals</html>', { status: 404, headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(readApiJson(response, '/api/diet/body-goals'), error => {
    assert.equal(error.status, 404);
    assert.equal(error.code, 'INVALID_API_RESPONSE');
    assert.match(error.message, /updated server/);
    assert.doesNotMatch(error.message, /Unexpected token/);
    return true;
  });
});
test('unreadable API responses retain HTTP status and give a retry instruction', async () => {
  await assert.rejects(readApiJson(new Response('<html>Proxy failure</html>', { status: 502 }), '/api/diet/body-goals'), error => {
    assert.equal(error.status, 502);
    assert.match(error.message, /server is running/);
    return true;
  });
});
test('valid JSON responses are preserved for normal API error handling', async () => {
  const body = { error: 'Authentication required.' };
  assert.deepEqual(await readApiJson(new Response(JSON.stringify(body), { status: 401 }), '/api/diet/body-goals'), body);
  assert.deepEqual(await readApiJson(new Response('{"profile":null,"estimate":null}'), '/api/diet/body-goals'), { profile: null, estimate: null });
});
