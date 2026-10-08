const mongoose = require('mongoose');
const id = mongoose.Schema.Types.ObjectId;
const post = new mongoose.Schema({
  familyId: { type: id, required: true }, authorId: { type: id, required: true },
  authorName: { type: String, required: true },
  type: { type: String, enum: ['update', 'milestone', 'announcement'], required: true },
  text: { type: String, maxlength: 2000, default: '' },
  audience: { type: String, enum: ['family', 'selected'], required: true },
  recipientIds: { type: [id], default: [] },
  photo: { data: Buffer, mime: String },
  reactions: { type: [id], default: [] },
  version: { type: Number, default: 1 }, deleted: { type: Boolean, default: false }
}, { timestamps: true, collection: 'familyPosts' });
post.index({ familyId: 1, deleted: 1, createdAt: -1, _id: -1 });
const comment = new mongoose.Schema({
  familyId: { type: id, required: true }, postId: { type: id, required: true },
  authorId: { type: id, required: true }, authorName: { type: String, required: true },
  text: { type: String, required: true, maxlength: 500 }
}, { timestamps: true, collection: 'familyPostComments' });
comment.index({ postId: 1, createdAt: -1, _id: -1 });
module.exports = { FamilyPost: mongoose.model('FamilyPost', post), FamilyPostComment: mongoose.model('FamilyPostComment', comment) };
