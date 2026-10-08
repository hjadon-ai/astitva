const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, enum: ['web'], required: true, unique: true },
  enabled: { type: Boolean, required: true },
  version: { type: String, required: true }
}, { timestamps: true, collection: 'notificationSettings' });
module.exports = mongoose.model('NotificationSetting', schema);
