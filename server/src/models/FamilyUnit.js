const mongoose = require('mongoose');
const id = mongoose.Schema.Types.ObjectId;
const options = collection => ({ collection, timestamps: true, optimisticConcurrency: true });
function model(name, fields, collection, indexes = []) {
  const schema = new mongoose.Schema(fields, options(collection));
  for (const [key, opts] of indexes) schema.index(key, opts);
  return mongoose.model(name, schema);
}
const Person = model('FamilyPerson', {
  userId: { type: id, default: null }, name: { type: String, required: true, maxlength: 80 },
  birthDate: {type:String,validate:require('../services/familyDetails').validBirthDate},
  gender: { type: String, enum: ['male','female','neutral'], default: 'neutral' }
}, 'familyPeople', [[{userId:1},{unique:true,partialFilterExpression:{userId:{$type:'objectId'}}}]]);
const Unit = model('FamilyUnit', {
  creatorId: {type:id,required:true}, state: {type:String,enum:['ACTIVE','MERGED'],default:'ACTIVE'},
  mergedIntoId: {type:id,default:null}, anchors: [{personId:id, relationship:String}], revision:{type:Number,default:0}
}, 'familyUnits');
const Membership = model('FamilyMembership', {
  unitId:{type:id,required:true},personId:{type:id,required:true},
  role:{type:String,enum:['ADMIN','EDITOR','READONLY'],default:'READONLY'},
  details:{preferredName:{type:String,maxlength:80,default:null},birthDate:{type:String,default:null},note:{type:String,maxlength:1000,default:null}}
}, 'familyMemberships', [[{unitId:1,personId:1},{unique:true}]]);
const Relationship = model('FamilyRelationship', {
  unitId:{type:id,required:true},fromPersonId:{type:id,required:true},toPersonId:{type:id,required:true},
  type:{type:String,enum:['parent','partner','sibling'],required:true}
}, 'familyRelationships', [[{unitId:1,type:1,fromPersonId:1,toPersonId:1},{unique:true}]]);
const Request = model('FamilyRelationshipRequest', {
  initiatorId:{type:id,required:true},sourcePersonId:{type:id,required:true},sourceUnitId:{type:id,required:true},
  targetEmail:{type:String,required:true},targetPersonId:{type:id,default:null},targetUnitId:{type:id,default:null},
  requestedRole:{type:String,enum:['READONLY','EDITOR','ADMIN'],default:'READONLY'},
  existingPersonId:{type:id,default:null}, relationship:{type:String,required:true},
  status:{type:String,enum:['PENDING_RELATIONSHIP','AWAITING_MERGE','BLOCKED','COMPLETED','DECLINED','EXPIRED','CANCELLED'],default:'PENDING_RELATIONSHIP'},
  relationshipConsent:{type:String,enum:['PENDING','ACCEPTED','DECLINED'],default:'PENDING'},
  approvals:[{unitId:id,actorId:id,revision:Number,acceptedAt:Date}],
  previewRevisions:{type:Map,of:Number,default:{}},expiresAt:{type:Date,required:true},
  delivery:{type:String,enum:['PENDING','SENDING','SENT','FAILED'],default:'PENDING'},
  revision:{type:Number,default:0},idempotencyKey:{type:String,required:true},
  pinChoice:{type:id,default:null},blockReason:{type:String,default:null}
}, 'familyRequests', [[{initiatorId:1,idempotencyKey:1},{unique:true}],[{targetEmail:1,status:1},{}]]);
const Merge = model('FamilyMerge', {
  requestId:{type:id,required:true},survivorId:{type:id,required:true},sourceIds:[id],
  approvals:[{unitId:id,actorId:id,revision:Number,acceptedAt:Date}],
  beforeRevisions:{type:Map,of:Number},personIds:[id],completedAt:{type:Date,required:true}
}, 'familyMerges', [[{requestId:1},{unique:true}]]);
const Quota = model('FamilyRequestQuota', { initiatorId:id,targetEmail:String,day:String,count:{type:Number,default:0} },
 'familyRequestQuotas', [[{initiatorId:1,targetEmail:1,day:1},{unique:true}]]);
module.exports = { Person, Unit, Membership, Relationship, Request, Merge, Quota };
