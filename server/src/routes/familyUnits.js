const express=require('express');
const S=require('../services/familyUnits');
const {Request,Person,Unit,Membership,Relationship,Merge,Quota}=require('../models/FamilyUnit');
const {Family}=require('../models/Family');
const InvitedEmail=require('../models/InvitedEmail');
const User=require('../models/User');
const {sendFamilyRequestEmail}=require('../services/email');
const router=express.Router();
router.use((req,res,next)=>{
 if (!/^\/(units|requests)(?:\/|$)/.test(req.path)) return next();
 res.set('Cache-Control','no-store');
 return require('../middleware/security').unsafeOriginGuard({...req.app.locals.runtime,isProduction:true})(req,res,next);
});
const run=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(error){if(error.status)return res.status(error.status).json({error:error.message});if(error.name==='CastError'||error.name==='ValidationError')return res.status(400).json({error:'Invalid family request.'});if(error.code===11000||error.name==='VersionError')return res.status(409).json({error:'Family changed or duplicate request; refresh before retrying.'});next(error);}};
const shape=(req,allowed)=>{if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(k=>!allowed.includes(k)))S.fail(400,'Unexpected request fields.');};
router.post('/units/member-lookup',run(async(req,res)=>{
 shape(req,['email']);const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===req.familyUser.email)S.fail(400,'Enter another member’s valid email.');
 const person=await Person.findOne({userId:req.familyUser._id}).select('_id');
 if(person&&await Membership.exists({personId:person._id})&&!await Membership.exists({personId:person._id,role:'ADMIN'}))S.fail(403,'Only a family ADMIN can find members for invitations.');
 const key={initiatorId:req.familyUser._id,targetEmail:'__member_lookup__',day:new Date().toISOString().slice(0,10)};
 await Quota.updateOne(key,{$setOnInsert:{...key,count:0}},{upsert:true});
 if(!await Quota.findOneAndUpdate({...key,count:{$lt:30}},{$inc:{count:1}}))S.fail(429,'Daily member lookup limit reached.');
 res.json({found:!!await User.exists({email})});
}));
router.get('/units/managed-members',run(async(req,res)=>res.json(await require('../services/managedWorkspace').members(req.familyUser))));
router.patch('/units/:unitId/people/:personId/managed-workspace',run(async(req,res)=>{shape(req,['expectedRevision','details']);res.json(await require('../services/managedWorkspace').updateDetails(req.familyUser,req.params.unitId,req.params.personId,req.body));}));
router.get('/units/:unitId/people/:personId/managed-workspace',run(async(req,res)=>res.json(await require('../services/managedWorkspace').context(req.familyUser,req.params.unitId,req.params.personId))));
router.get('/units',run(async(req,res)=>res.json(await S.list(req.familyUser))));
router.post('/units',run(async(req,res)=>{shape(req,['relationship']);res.status(201).json({unit:await S.create(req.familyUser,req.body)});}));
router.get('/units/:unitId',run(async(req,res)=>res.json({unit:await S.view(req.params.unitId,req.familyUser)})));
router.post('/units/:unitId/people',run(async(req,res)=>{shape(req,['name','relationship','kind','expectedRevision']);res.status(201).json({unit:await S.add(req.familyUser,req.params.unitId,req.body)});}));
router.patch('/units/:unitId/people/:personId',run(async(req,res)=>{shape(req,['expectedRevision','role','details','name','relationship']);if(!req.body.role&&!req.body.details&&!req.body.name&&!req.body.relationship)S.fail(400,'Provide a member change.');if(!S.id(req.params.personId))S.fail(404,'Member not found.');res.json({unit:await S.updateMember(req.familyUser,req.params.unitId,req.params.personId,req.body)});}));
router.get('/units/:unitId/people/:personId/removal-preview',run(async(req,res)=>{
 const x=await S.removal(req.familyUser,req.params.unitId,req.params.personId);
 res.json({name:x.p.name,expectedRevision:x.a.unit.revision,incidentRelationships:x.edges.map(e=>({id:String(e._id),from:String(e.fromPersonId),to:String(e.toPersonId),type:e.type})),activeRequests:x.activeRequests,invitations:x.invitations,activityReferences:x.activities,canRemove:!x.activeRequests&&!x.invitations,action:'Remove from this unit and explicitly detach listed relationships; preserve historical name snapshots.'});
}));
router.delete('/units/:unitId/people/:personId',run(async(req,res)=>{shape(req,['expectedRevision','confirmation','confirmDetachRelationships']);await S.remove(req.familyUser,req.params.unitId,req.params.personId,req.body);res.status(204).end();}));
router.get('/requests',run(async(req,res)=>res.json(await S.requestList(req.familyUser))));
router.get('/requests/:requestId',run(async(req,res)=>res.json({request:await S.summary(await S.authorizedRequest(req.params.requestId,req.familyUser),req.familyUser)})));
router.post('/requests',run(async(req,res)=>{
 shape(req,['name','sourceUnitId','relationship','targetEmail','existingPersonId','inviteToRegister','findMember','requestedRole','expectedRevision','idempotencyKey']);
 if(req.body.inviteToRegister!==undefined&&typeof req.body.inviteToRegister!=='boolean')S.fail(400,'inviteToRegister must be boolean.');
 if(req.body.findMember!==undefined&&typeof req.body.findMember!=='boolean')S.fail(400,'Invalid member lookup.');
 if(req.body.findMember){const email=typeof req.body.targetEmail==='string'?req.body.targetEmail.trim().toLowerCase():'';req.body.inviteToRegister=!await User.exists({email});}
 const r=await S.newRequest(req.familyUser,req.body);
 const claimed=await Request.findOneAndUpdate({_id:r._id,delivery:'PENDING'},{$set:{delivery:'SENDING'}},{returnDocument:'after'});
 if(claimed){
  try{
   // Generic email and response do not disclose account existence. Signup allowance is explicit.
   await sendFamilyRequestEmail(req.familyUser,r);
   if(req.body.inviteToRegister)await InvitedEmail.updateOne({email:r.targetEmail},{$setOnInsert:{email:r.targetEmail}},{upsert:true});
   await Request.updateOne({_id:r._id,delivery:'SENDING'},{$set:{delivery:'SENT'}});
  }catch{await Request.updateOne({_id:r._id,delivery:'SENDING'},{$set:{delivery:'FAILED'}});}
 }
 res.status(202).json({id:String(r._id),message:'Request recorded. The recipient must review it in Astitva.'});
}));
router.post('/requests/:requestId/relationship-decision',run(async(req,res)=>{shape(req,['decision','expectedRevision','targetUnitId']);res.json({request:await S.relationshipDecision(req.familyUser,req.params.requestId,req.body)});}));
router.post('/requests/:requestId/merge-decision',run(async(req,res)=>{shape(req,['unitId','decision','expectedRevision','previewRevisions','pinChoice']);res.json({request:await S.mergeDecision(req.familyUser,req.params.requestId,req.body)});}));
module.exports=router;
