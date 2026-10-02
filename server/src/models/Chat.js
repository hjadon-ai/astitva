const mongoose = require('mongoose');
const { Schema } = mongoose;

const invitationSchema = new Schema({
  creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  creatorAlias: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, { timestamps: true });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const participantSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  alias: { type: String, required: true },
  pinHash: String,
  failedAttempts: { type: Number, default: 0 },
  lockouts: { type: Number, default: 0 },
  lockedUntil: Date,
  unlockTokenHash: String,
  unlockExpiresAt: Date
}, { _id: false });

const messageSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const conversationSchema = new Schema({
  invitationId: { type: Schema.Types.ObjectId, ref: 'ChatInvitation', required: true, unique: true },
  participants: { type: [participantSchema], validate: (value) => value.length === 2 },
  messages: [messageSchema]
}, { timestamps: true });
conversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });

const deletionSchema = new Schema({
  emailIds: { type: [String], required: true },
  messageCount: { type: Number, required: true },
  bytesDeleted: { type: Number, required: true },
  deletedAt: { type: Date, default: Date.now, expires: 30 * 86400 }
});

module.exports = {
  ChatInvitation: mongoose.model('ChatInvitation', invitationSchema),
  ChatConversation: mongoose.model('ChatConversation', conversationSchema),
  ChatDeletion: mongoose.model('ChatDeletion', deletionSchema)
};
