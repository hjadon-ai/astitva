const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('../models/Session');
const Day = require('../models/DailyPriorityDay');
const { getRuntimeConfig } = require('../config/runtime');
const { sessionToken } = require('../middleware/sessionToken');
const { requireFeature } = require('../middleware/featureAccess');
const { validDate, todayInZone, priorityInput, publicPriority, publicDay } = require('../services/priorities');
const router = express.Router();
const missing = (res) => res.status(404).json({ error: 'Priority not found.' });

router.use(async (req, res, next) => {
  const token = sessionToken(req);
  if (typeof token !== 'string') return res.status(401).json({ error: 'Authentication required.' });
  const session = await Session.findOne({
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: { $gt: new Date() }
  }).populate('userId');
  if (!session?.userId) return res.status(401).json({ error: 'Authentication required.' });
  if (!session.userId.emailVerifiedAt) return res.status(403).json({ error: 'Email verification required.' });
  req.featureUser = session.userId;
  req.priorityOwner = session.userId._id;
  next();
});
router.use(requireFeature('priorities'));
router.use(express.json());
router.use('/days/:date', (req, res, next) => {
  if (!validDate(req.params.date)) return res.status(400).json({ error: 'Use a valid YYYY-MM-DD date.' });
  const today = todayInZone(req.get('X-Time-Zone'));
  if (!today) return res.status(400).json({ error: 'Use a valid IANA X-Time-Zone header.' });
  if (req.params.date > today) return res.status(400).json({ error: 'Future dates are not available.' });
  req.priorityFilter = { userId: req.priorityOwner, date: req.params.date };
  next();
});
router.get('/days/:date', async (req, res) => {
  res.json(publicDay(req.params.date, await Day.findOne(req.priorityFilter).lean()));
});
router.post('/days/:date/priorities', async (req, res) => {
  const input = priorityInput(req.body);
  if (!input) return res.status(400).json({ error: 'Enter only a single-line title of 1–120 characters.' });
  // Initialize independently of capacity; the unique owner/date index resolves first-add races.
  try {
    await Day.updateOne(req.priorityFilter, { $setOnInsert: { priorities: [] } }, { upsert: true, runValidators: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const item = { _id: new mongoose.Types.ObjectId(), ...input, completed: false };
  const day = await Day.findOneAndUpdate({ ...req.priorityFilter, 'priorities.2': { $exists: false } },
    { $push: { priorities: item } }, { returnDocument: 'after', runValidators: true });
  if (!day) return res.status(409).json({ error: 'This date already has three priorities.' });
  res.status(201).json({ priority: publicPriority(item) });
});
router.patch('/days/:date/priorities/:id', async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return missing(res);
  const input = priorityInput(req.body, true);
  if (!input) return res.status(400).json({ error: 'Supply a valid title and/or a boolean completed value only.' });
  const fields = Object.fromEntries(Object.entries(input).map(([key, value]) => [`priorities.$.${key}`, value]));
  const day = await Day.findOneAndUpdate({ ...req.priorityFilter, 'priorities._id': req.params.id },
    { $set: fields }, { returnDocument: 'after', runValidators: true });
  if (!day) return missing(res);
  res.json({ priority: publicPriority(day.priorities.id(req.params.id)) });
});
router.delete('/days/:date/priorities/:id', async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return missing(res);
  const result = await Day.updateOne({ ...req.priorityFilter, 'priorities._id': req.params.id },
    { $pull: { priorities: { _id: req.params.id } } });
  if (!result.matchedCount) return missing(res);
  res.status(204).end();
});
router.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Use a valid JSON request body.' });
  }
  res.status(500).json({ error: 'The server could not complete this request.' });
});
require('../services/managedWorkspace').wrap(router);
module.exports = router;
