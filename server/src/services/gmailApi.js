const nodemailer = require('nodemailer');

async function sendWithGmailApi(message, credentials, fetchImpl = fetch) {
  const tokenResponse = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!tokenResponse.ok) {
    throw new Error(`Gmail access token request failed (HTTP ${tokenResponse.status}).`);
  }
  const { access_token: accessToken } = await tokenResponse.json();
  if (!accessToken) throw new Error('Gmail access token response was incomplete.');

  const mime = await nodemailer.createTransport({ streamTransport: true, buffer: true })
    .sendMail(message);
  const sendResponse = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: mime.message.toString('base64url') }),
    signal: AbortSignal.timeout(15000)
  });
  if (!sendResponse.ok) {
    throw new Error(`Gmail message send failed (HTTP ${sendResponse.status}).`);
  }
}

module.exports = { sendWithGmailApi };
