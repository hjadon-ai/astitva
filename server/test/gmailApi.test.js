const assert = require('node:assert/strict');
const test = require('node:test');
const { sendWithGmailApi } = require('../src/services/gmailApi');

const credentials = { clientId: 'client-id', clientSecret: 'client-secret', refreshToken: 'refresh-token' };
const message = { from: 'Astitva <sender@gmail.com>', to: 'recipient@example.com', subject: 'Verify', text: 'A verification link' };

test('Gmail API refreshes access and sends an encoded MIME message over HTTPS', async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url, options });
    return url.endsWith('/token')
      ? { ok: true, json: async () => ({ access_token: 'access-token' }) }
      : { ok: true };
  };
  await sendWithGmailApi(message, credentials, fakeFetch);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.body.get('grant_type'), 'refresh_token');
  assert.equal(requests[0].options.body.get('refresh_token'), credentials.refreshToken);
  assert.equal(requests[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer access-token');
  const mime = Buffer.from(JSON.parse(requests[1].options.body).raw, 'base64url').toString();
  assert.match(mime, /To: recipient@example.com/);
  assert.match(mime, /A verification link/);
});

test('Gmail API reports provider errors without exposing credentials', async () => {
  await assert.rejects(
    sendWithGmailApi(message, credentials, async () => ({ ok: false, status: 401 })),
    /^Error: Gmail access token request failed \(HTTP 401\)\.$/
  );
});
