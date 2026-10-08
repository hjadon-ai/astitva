const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  token: { type: String, required: true, select: false },
  tokenHash: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'web'], required: true },
  revision: { type: String, required: true }
}, { timestamps: true, collection: 'notificationDevices' });
schema.index({ userId: 1 });
// MongoDB's TTL monitor cleans up without an application polling worker.
schema.index({ updatedAt: 1 }, { expireAfterSeconds: 2 * 86400 });
module.exports = mongoose.model('NotificationDevice', schema);
