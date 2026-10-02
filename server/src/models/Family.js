const mongoose = require('mongoose');

const id = mongoose.Schema.Types.ObjectId;
const personSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, default: null, lowercase: true },
  userId: { type: id, ref: 'User', default: null },
  gender: { type: String, enum: ['male', 'female', 'neutral'], default: 'neutral' },
  role: { type: String, enum: ['ADMIN', 'EDITOR', 'READONLY'], default: 'READONLY' },
  status: { type: String, enum: ['ACCEPTED', 'NON_USER', 'PENDING'], required: true }
});
const relationSchema = new mongoose.Schema({
  from: { type: id, required: true },
  to: { type: id, required: true },
  type: { type: String, enum: ['parent', 'sibling', 'partner'], required: true }
});
const shareSchema = new mongoose.Schema({
  ownerId: { type: id, ref: 'User', required: true },
  recipientId: { type: id, ref: 'User', required: true },
  feature: { type: String, enum: ['diet', 'finance'], required: true }
}, { _id: false });
const familySchema = new mongoose.Schema({
  creatorId: { type: id, ref: 'User', required: true },
  people: { type: [personSchema], default: [] },
  relations: { type: [relationSchema], default: [] },
  shares: { type: [shareSchema], default: [] }
}, { timestamps: true, collection: 'families', optimisticConcurrency: true });
familySchema.index({ 'people.userId': 1 });
familySchema.index({ creatorId: 1 });

const invitationSchema = new mongoose.Schema({
  familyId: { type: id, ref: 'Family', required: true },
  personId: { type: id, required: true },
  email: { type: String, required: true, lowercase: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, collection: 'familyInvitations' });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ familyId: 1, personId: 1 });

const activitySchema = new mongoose.Schema({
  familyId: { type: id, ref: 'Family', required: true },
  actorUserId: { type: id, ref: 'User', default: null },
  actorName: { type: String, required: true, maxlength: 80 },
  action: { type: String, required: true, enum: [
    'FAMILY_CREATED', 'PERSON_ADDED', 'PERSON_UPDATED', 'INVITATION_SENT',
    'INVITATION_ACCEPTED', 'ROLE_CHANGED', 'RELATIONSHIP_REMOVED',
    'SHARE_GRANTED', 'SHARE_REVOKED', 'BRANCH_PRUNED', 'SELF_UPDATED'
  ] },
  subjectPersonId: { type: id, default: null },
  subjectName: { type: String, default: null, maxlength: 80 },
  feature: { type: String, enum: ['diet', 'finance'], default: null },
  summary: { type: String, required: true, maxlength: 240 },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { collection: 'familyActivity', versionKey: false });
activitySchema.index({ familyId: 1, createdAt: -1, _id: -1 });
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = {
  Family: mongoose.model('Family', familySchema),
  FamilyInvitation: mongoose.model('FamilyInvitation', invitationSchema),
  FamilyActivity: mongoose.model('FamilyActivity', activitySchema)
};
