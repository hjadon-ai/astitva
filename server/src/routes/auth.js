const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const { FamilyInvitation } = require('../models/Family');
const InvitedEmail = require('../models/InvitedEmail');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/email');
const { getRuntimeConfig } = require('../config/runtime');
const { createRateLimit } = require('../middleware/security');
const { sessionToken } = require('../middleware/sessionToken');
const { featuresForEmail } = require('../middleware/featureAccess');

const router = express.Router();
const cookieName = () => getRuntimeConfig().sessionCookieName;
const sessionDuration = 24 * 60 * 60 * 1000;
const verificationDuration = 60 * 60 * 1000;
const passwordResetDuration = 60 * 60 * 1000;
const passwordResetWindow = 24 * 60 * 60 * 1000;
const passwordResetLimit = 2;
const forgotPasswordMessage = 'If an eligible account exists, a reset email has been sent.';
const signupRateLimit = createRateLimit({ max: 5, windowMs: 60 * 60 * 1000 });
const loginRateLimit = createRateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const emailRateLimit = createRateLimit({ max: 5, windowMs: 60 * 60 * 1000 });

async function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    features: await featuresForEmail(user.email)
  };
}

async function createVerificationToken(user) {
  const token = crypto.randomBytes(32).toString('hex');

  await EmailVerificationToken.deleteMany({ userId: user._id });
  await EmailVerificationToken.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + verificationDuration)
  });

  return token;
}

async function reservePasswordResetRequest(userId) {
  const requestedAt = new Date();
  const windowStart = new Date(requestedAt.getTime() - passwordResetWindow);
  const recentRequests = {
    $filter: {
      input: { $ifNull: ['$passwordResetRequestTimestamps', []] },
      as: 'requestTime',
      cond: { $gte: ['$$requestTime', windowStart] }
    }
  };

  const user = await User.findOneAndUpdate({
    _id: userId,
    $expr: { $lt: [{ $size: recentRequests }, passwordResetLimit] }
  }, [{
    $set: {
      passwordResetRequestTimestamps: {
        $concatArrays: [recentRequests, [requestedAt]]
      }
    }
  }], { new: true, updatePipeline: true });

  return { requestedAt, user };
}

async function createPasswordResetToken(user) {
  const token = crypto.randomBytes(32).toString('hex');

  await PasswordResetToken.deleteMany({ userId: user._id });
  await PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + passwordResetDuration)
  });

  return token;
}

async function authenticatedUser(request, response) {
  const token = sessionToken(request);
  if (!token) return null;

  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() }
  }).populate('userId');

  if (!session || !session.userId) {
    clearSessionCookie(response);
    return null;
  }

  return session.userId;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function clearSessionCookie(response) {
  response.clearCookie(cookieName(), getRuntimeConfig().sessionCookieOptions);
}

router.post('/signup', signupRateLimit, async (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';

  if (!name || !email || password.length < 8) {
    return response.status(400).json({
      error: 'Name, email, and a password of at least 8 characters are required.'
    });
  }

  const runtime = getRuntimeConfig();
  const familyInviteToken = typeof request.body.familyInviteToken === 'string' ? request.body.familyInviteToken.trim() : '';
  let invited = !runtime.isProduction;
  if (runtime.isProduction) invited = Boolean(await InvitedEmail.exists({ email }));
  if (runtime.isProduction && !invited && /^[a-f0-9]{64}$/i.test(familyInviteToken)) {
    invited = Boolean(await FamilyInvitation.exists({
      email,
      tokenHash: hashToken(familyInviteToken),
      expiresAt: { $gt: new Date() }
    }));
  }
  if (!invited) {
    return response.status(403).json({
      error: 'This email address is not invited to Astitva.',
      code: 'INVITATION_REQUIRED'
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = await createVerificationToken(user);
    let emailDelivered = true;

    try {
      await sendVerificationEmail(user, token);
    } catch (error) {
      emailDelivered = false;
      console.error('Unable to send verification email:', error.message);
    }

    return response.status(201).json({
      user: await publicUser(user),
      message: emailDelivered
        ? 'Account created. Check your email to verify your address.'
        : 'Account created, but the verification email could not be sent.',
      emailDelivered
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ error: 'An account with this email already exists.' });
    }
    return response.status(500).json({ error: 'Unable to create the account.' });
  }
});

router.post('/login', loginRateLimit, async (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return response.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({
    tokenHash: hashToken(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + sessionDuration)
  });

  response.cookie(cookieName(), token, {
    ...getRuntimeConfig().sessionCookieOptions,
    maxAge: sessionDuration
  });
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ user: await publicUser(user),
    ...(getRuntimeConfig().isProduction ? { sessionToken: token } : {}) });
});

router.get('/me', async (request, response) => {
  const user = await authenticatedUser(request, response);
  if (!user) {
    return response.status(401).json({ error: 'Session is invalid or expired.' });
  }

  return response.status(200).json({ user: await publicUser(user) });
});

router.post('/verify-email', async (request, response) => {
  const token = typeof request.body.token === 'string' ? request.body.token.trim() : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return response.status(400).json({ error: 'A valid verification token is required.' });
  }

  const tokenHash = hashToken(token);
  const verification = await EmailVerificationToken.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() }
  }).populate('userId');

  if (!verification || !verification.userId) {
    await EmailVerificationToken.deleteOne({ tokenHash });
    return response.status(410).json({ error: 'This verification link is invalid, expired, or already used.' });
  }

  if (verification.userId.emailVerifiedAt) {
    await EmailVerificationToken.deleteMany({ userId: verification.userId._id });
    return response.status(409).json({ error: 'This email address is already verified.' });
  }

  verification.userId.emailVerifiedAt = new Date();
  await verification.userId.save();
  await EmailVerificationToken.deleteMany({ userId: verification.userId._id });

  return response.status(200).json({
    message: 'Email verified successfully.',
    user: await publicUser(verification.userId)
  });
});

router.post('/resend-verification', emailRateLimit, async (request, response) => {
  const user = await authenticatedUser(request, response);
  if (!user) {
    return response.status(401).json({ error: 'Authentication required.' });
  }

  if (user.emailVerifiedAt) {
    return response.status(409).json({ error: 'This email address is already verified.' });
  }

  const token = await createVerificationToken(user);
  try {
    await sendVerificationEmail(user, token);
  } catch (error) {
    console.error('Unable to resend verification email:', error.message);
    return response.status(503).json({
      error: 'The verification email could not be sent. Your account remains unverified.'
    });
  }

  return response.status(202).json({
    message: 'A new verification email was sent. It expires in one hour.'
  });
});

router.post('/forgot-password', emailRateLimit, async (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'A valid email address is required.' });
  }

  const user = await User.findOne({ email });
  if (!user || !user.emailVerifiedAt) {
    return response.status(202).json({ message: forgotPasswordMessage });
  }

  const reservation = await reservePasswordResetRequest(user._id);
  if (!reservation.user) {
    return response.status(202).json({ message: forgotPasswordMessage });
  }

  const token = await createPasswordResetToken(reservation.user);
  try {
    await sendPasswordResetEmail(reservation.user, token);
  } catch (error) {
    await Promise.all([
      PasswordResetToken.deleteMany({ userId: reservation.user._id }),
      User.updateOne(
        { _id: reservation.user._id },
        { $pull: { passwordResetRequestTimestamps: reservation.requestedAt } }
      )
    ]);
    console.error('Unable to send password reset email:', error.message);
  }

  return response.status(202).json({ message: forgotPasswordMessage });
});

router.post('/reset-password', async (request, response) => {
  const token = typeof request.body.token === 'string' ? request.body.token.trim() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';

  if (!/^[a-f0-9]{64}$/i.test(token) || password.length < 8) {
    return response.status(400).json({
      error: 'A valid reset token and a password of at least 8 characters are required.'
    });
  }

  const tokenHash = hashToken(token);
  const reset = await PasswordResetToken.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() }
  }).populate('userId');

  if (!reset || !reset.userId || !reset.userId.emailVerifiedAt) {
    await PasswordResetToken.deleteOne({ tokenHash });
    return response.status(410).json({ error: 'This reset link is invalid, expired, or already used.' });
  }

  reset.userId.passwordHash = await bcrypt.hash(password, 12);
  await reset.userId.save();
  await Promise.all([
    PasswordResetToken.deleteMany({ userId: reset.userId._id }),
    Session.deleteMany({ userId: reset.userId._id })
  ]);

  return response.status(200).json({ message: 'Password changed successfully. Please log in.' });
});

router.post('/logout', async (request, response) => {
  const token = sessionToken(request);
  if (token) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  clearSessionCookie(response);
  return response.status(204).send();
});

module.exports = router;
