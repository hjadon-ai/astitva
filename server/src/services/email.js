const nodemailer = require('nodemailer');
const { getRuntimeConfig } = require('../config/runtime');
const { sendWithGmailApi } = require('./gmailApi');

let cachedTransport;
let cachedSmtp;

function emailTransport() {
  const smtp = getRuntimeConfig().smtp;
  if (cachedTransport && cachedSmtp === smtp) return cachedTransport;
  cachedSmtp = smtp;
  cachedTransport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.host.toLowerCase() === 'smtp.gmail.com' && smtp.port === 587 ? { requireTLS: true } : {}),
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password } } : {})
  });
  return cachedTransport;
}

async function sendEmail(message) {
  const runtime = getRuntimeConfig();
  if (runtime.emailProvider === 'gmail-api') {
    return sendWithGmailApi(message, runtime.gmailApi);
  }
  return emailTransport().sendMail(message);
}

async function sendVerificationEmail(user, token) {
  const runtime = getRuntimeConfig();
  const verificationUrl = `${runtime.webUrl}/verify-email?token=${encodeURIComponent(token)}`;

  await sendEmail({
    from: runtime.smtp.from,
    to: user.email,
    subject: 'Verify your Astitva email',
    text: [
      `Hello ${user.name},`,
      '',
      'Verify your email address to finish setting up your Astitva account:',
      verificationUrl,
      '',
      'This link expires in one hour.'
    ].join('\n')
  });
}

async function sendPasswordResetEmail(user, token) {
  const runtime = getRuntimeConfig();
  const resetUrl = `${runtime.webUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    from: runtime.smtp.from,
    to: user.email,
    subject: 'Reset your Astitva password',
    text: [
      `Hello ${user.name},`,
      '',
      'Use this link to choose a new password for your Astitva account:',
      resetUrl,
      '',
      'This link expires in one hour. If you did not request it, you can ignore this message.'
    ].join('\n')
  });
}

async function sendFamilyInvitationEmail(inviter, person, token, accountExists = false) {
  const runtime = getRuntimeConfig();
  const invitationUrl = `${runtime.webUrl}/family-invite?token=${encodeURIComponent(token)}`;
  await sendEmail({
    from: runtime.smtp.from,
    to: person.email,
    subject: `${inviter.name} invited you to their Astitva family`,
    text: [
      `Hello ${person.name},`, '',
      `${inviter.name} invited you to connect as a family member in Astitva.`,
      accountExists
        ? 'Sign in with this email address, verify it if needed, then accept the invitation:'
        : 'Create an account with this email address, verify it, then accept the invitation:',
      invitationUrl, '',
      'This link expires in seven days. Your Diet and Finance information stays private unless you choose to share it.'
    ].join('\n')
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendFamilyInvitationEmail };
