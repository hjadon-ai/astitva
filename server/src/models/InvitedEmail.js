const mongoose = require('mongoose');

const invitedEmailSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  priorities: { type: Boolean, default: false },
  diet: { type: Boolean, default: false },
  finance: { type: Boolean, default: false },
  family: { type: Boolean, default: true },
  chat: { type: Boolean, default: false }
}, { timestamps: true, collection: 'invitedEmails' });

module.exports = mongoose.model('InvitedEmail', invitedEmailSchema);
