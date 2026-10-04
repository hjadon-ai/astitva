const crypto = require('node:crypto');
const express = require('express');
const User = require('../models/User');
const InvitedEmail = require('../models/InvitedEmail');
const { requireAdmin } = require('../middleware/adminAccess');
const { defaultFeatures } = require('../middleware/featureAccess');
const { createRateLimit } = require('../middleware/security');
const { revokeFirebaseGrants } = require('../services/firebaseAdmin');

const { sendAdminInvitationEmail } = require('../services/email');
const router = express.Router();
const invitationRateLimit = createRateLimit({ max: 10, windowMs: 60 * 1000 });
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = (value) => /^[a-f\d]{24}$/i.test(value || '');
const emailValue = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const featureKeys = Object.keys(defaultFeatures);
const validFeatures = (value) => object(value) && Object.keys(value).length > 0 &&
  Object.keys(value).every((key) => featureKeys.includes(key) && typeof value[key] === 'boolean');
const features = (record) => Object.fromEntries(featureKeys.map((key) => [key, record?.[key] ?? defaultFeatures[key]]));
// Compare the fields themselves as well as timestamps: legacy documents need no migration.
const version = (record, keys) => record ? crypto.createHash('sha256').update(JSON.stringify([
  String(record._id), record.updatedAt, ...keys.map((key) => record[key])
])).digest('hex') : null;
const userVersion = (user) => version(user, ['name']);
const inviteVersion = (record) => version(record, featureKeys);
const safeUser = (user, invitee) => ({ id: String(user._id), name: user.name, email: user.email,
  emailVerified: Boolean(user.emailVerifiedAt), createdAt: user.createdAt, features: features(invitee),
  expectedVersion: { user: userVersion(user), invitee: inviteVersion(invitee) } });
const safeInvitee = (record, registered) => ({ id: String(record._id), email: record.email,
  features: features(record), registered, expectedVersion: inviteVersion(record) });
const fail = (response, status, error) => response.status(status).json({ error });
const conflict = (response) => fail(response, 409, 'This record changed. Reload it before saving again.');
const userFields = '_id name email emailVerifiedAt createdAt updatedAt';

router.use(requireAdmin);
router.use(createRateLimit({ max: 120, windowMs: 60 * 1000 }));

router.get('/users', async (request, response) => {
  const q = request.query.q;
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 25);
  if (typeof q !== 'string' || q.trim().length < 1 || q.length > 100 ||
      !Number.isSafeInteger(page) || page < 1 || page > 10000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 50) {
    return fail(response, 400, 'Enter 1–100 search characters and valid pagination (limit 1–50).');
  }
  const literal = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = { $regex: literal, $options: 'i' };
  const users = await User.find({ $or: [{ email: match }, { name: match }] }).select(userFields)
    .sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit + 1).maxTimeMS(5000).lean();
  const selected = users.slice(0, limit);
  const records = await InvitedEmail.find({ email: { $in: selected.map((user) => user.email) } }).lean();
  const byEmail = new Map(records.map((record) => [record.email, record]));
  return response.json({ users: selected.map((user) => safeUser(user, byEmail.get(user.email))),
    page, hasMore: users.length > limit });
});

router.get('/users/:id', async (request, response) => {
  if (!validId(request.params.id)) return fail(response, 404, 'User not found.');
  const user = await User.findById(request.params.id).select(userFields).lean();
  if (!user) return fail(response, 404, 'User not found.');
  return response.json({ user: safeUser(user, await InvitedEmail.findOne({ email: user.email }).lean()) });
});

async function changeFeatures(email, input, expected, response) {
  const current = await InvitedEmail.findOne({ email }).lean();
  if (inviteVersion(current) !== expected) { conflict(response); return null; }
  let saved;
  try {
    if (!current) saved = await InvitedEmail.create({ email, ...input });
    else saved = await InvitedEmail.findOneAndUpdate({ _id: current._id, updatedAt: current.updatedAt,
      ...Object.fromEntries(featureKeys.map((key) => [key,
        Object.hasOwn(current, key) ? current[key] : { $exists: false }]))
    }, { $set: input }, { returnDocument: 'after', runValidators: true }).lean();
  } catch (error) {
    if (error.code === 11000) { conflict(response); return null; }
    throw error;
  }
  if (!saved) { conflict(response); return null; }
  if (!saved.chat) {
    const user = await User.findOne({ email }).select('_id').lean();
    if (user) {
      try { await revokeFirebaseGrants({ userId: user._id }); }
      catch (error) {
        console.error('Admin Chat revocation failed:', error.message);
        response.status(503).json({ error: 'Feature access was saved, but Chat session cleanup failed. Reload and save disabled Chat again to retry.',
          code: 'CHAT_REVOCATION_PENDING' });
        return null;
      }
    }
  }
  return saved;
}

router.patch('/users/:id', async (request, response) => {
  const body = request.body;
  if (!object(body) || !object(body.expectedVersion) ||
      Object.keys(body).some((key) => !['features', 'expectedVersion'].includes(key)) ||
      Object.keys(body.expectedVersion).some((key) => !['user', 'invitee'].includes(key)) ||
      !validFeatures(body.features)) {
    return fail(response, 400, 'Save supported feature flags with the loaded expectedVersion.');
  }
  if (!validId(request.params.id)) return fail(response, 404, 'User not found.');
  const user = await User.findById(request.params.id).select(userFields).lean();
  if (!user) return fail(response, 404, 'User not found.');
  if (!await changeFeatures(user.email, body.features, body.expectedVersion.invitee, response)) return;
  return response.json({ user: safeUser(user, await InvitedEmail.findOne({ email: user.email }).lean()) });
});

router.post('/invitees', invitationRateLimit, async (request, response) => {
  const body = request.body;
  const email = emailValue(body?.email);
  if (!object(body) || Object.keys(body).some((key) => !['email', 'features'].includes(key)) ||
      !validEmail(email) || !validFeatures(body.features)) return fail(response, 400, 'A valid email and supported boolean feature flags are required.');
  try {
    const record = await InvitedEmail.create({ email, ...body.features });
    const registered = Boolean(await User.exists({ email }));
    const delivery = await deliverInvitation(email, registered);
    return response.status(201).json({ invitee: safeInvitee(record, registered), ...delivery });
  } catch (error) {
    if (error.code === 11000) return fail(response, 409, 'This invitee already exists. Find the email to edit its access.');
    throw error;
  }
});

async function deliverInvitation(email, registered) {
  try {
    await sendAdminInvitationEmail(email, registered);
    return { invitationSent: true };
  } catch (error) {
    console.error('Admin invitation delivery failed:', error.message);
    return { invitationSent: false, warning: 'Invitee access saved, but the invitation email could not be sent. Use Send invitation email to retry.' };
  }
}

router.post('/invitees/:id/send-invitation', invitationRateLimit, async (request, response) => {
  if (!validId(request.params.id)) return fail(response, 404, 'Invitee not found.');
  const record = await InvitedEmail.findById(request.params.id).lean();
  if (!record) return fail(response, 404, 'Invitee not found.');
  const delivery = await deliverInvitation(record.email, Boolean(await User.exists({ email: record.email })));
  return response.status(delivery.invitationSent ? 200 : 503).json(delivery.invitationSent
    ? delivery : { ...delivery, error: delivery.warning });
});

router.get('/invitees', async (request, response) => {
  const email = emailValue(request.query.email);
  if (!validEmail(email)) return fail(response, 400, 'Enter a valid email address.');
  const record = await InvitedEmail.findOne({ email }).lean();
  const registered = Boolean(await User.exists({ email }));
  if (!record) return response.status(404).json({ error: 'No invitee access record exists for this email.', registered });
  return response.json({ invitee: safeInvitee(record, registered) });
});

router.patch('/invitees/:id', async (request, response) => {
  const body = request.body;
  if (!object(body) || Object.keys(body).some((key) => !['features', 'expectedVersion'].includes(key)) ||
      !validFeatures(body.features) || typeof body.expectedVersion !== 'string') return fail(response, 400, 'Supported feature flags and the loaded expectedVersion are required.');
  if (!validId(request.params.id)) return fail(response, 404, 'Invitee not found.');
  const current = await InvitedEmail.findById(request.params.id).lean();
  if (!current) return fail(response, 404, 'Invitee not found.');
  const saved = await changeFeatures(current.email, body.features, body.expectedVersion, response);
  if (saved) return response.json({ invitee: safeInvitee(saved, Boolean(await User.exists({ email: saved.email }))) });
});

module.exports = router;
