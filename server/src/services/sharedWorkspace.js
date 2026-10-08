const {Family}=require('../models/Family');
const {Unit,Person,Membership,Relationship}=require('../models/FamilyUnit');
const User=require('../models/User');
const G=require('./familyGraph');
const {featuresForEmail}=require('../middleware/featureAccess');
const same=(a,b)=>String(a)===String(b);
const accepted=(f,u)=>f.people.find(p=>p.status==='ACCEPTED'&&p.userId&&same(p.userId,u));
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
async function validateFamily(f,viewer){
 if(!f||!accepted(f,viewer._id))fail(404,'Family not found.');
 const unit=await Unit.findById(f._id);
 if(f.normalizedUnit||unit){
  if(!unit||!f.normalizedUnit||unit.state!=='ACTIVE')fail(409,'Family mapping changed; refresh.');
  const people=await Person.find({_id:{$in:f.people.map(p=>p._id)}}).lean();
  const members=await Membership.find({unitId:f._id}).lean();
  const edges=await Relationship.find({unitId:f._id}).lean();
  if(members.length!==f.people.length||f.people.some(p=>!members.some(m=>same(m.personId,p._id))||!people.some(n=>same(n._id,p._id)&&same(n.userId,p.userId)))||
   edges.length!==f.relations.length||edges.some(e=>!f.relations.some(r=>same(r.from,e.fromPersonId)&&same(r.to,e.toPersonId)&&r.type===e.type)))fail(409,'Family mapping requires review.');
 }
 return f;
}
async function contextFamily(familyId,viewer){
 if(!/^[a-f0-9]{24}$/i.test(familyId||''))fail(404,'Family not found.');
 return validateFamily(await Family.findById(familyId),viewer);
}
async function available(f,owner,viewer,runtime){
 const user=await User.findById(owner.userId);
 if(!user?.emailVerifiedAt)fail(404,'Member is no longer available.');
 const [of,vf]=await Promise.all([featuresForEmail(user.email),featuresForEmail(viewer.email)]);
 if(!of.family||!vf.family)fail(404,'Member is no longer available.');
 return ['diet','finance','family'].filter(feature=>of[feature]&&vf[feature]&&(feature!=='finance'||runtime.financeEnabled!==false)&&
  f.shares.some(g=>same(g.ownerId,owner.userId)&&same(g.recipientId,viewer._id)&&g.feature===feature&&(feature!=='family'||g.visiblePersonIds?.length)));
}
async function members(viewer){
 const fs=await Family.find({'people.userId':viewer._id});const result=[];
 for(const f of fs){if(!accepted(f,viewer._id))continue;await validateFamily(f,viewer);
  for(const p of f.people){if(p.status!=='ACCEPTED'||!p.userId||same(p.userId,viewer._id))continue;
   const u=await User.findById(p.userId);if(!u?.emailVerifiedAt||!(await featuresForEmail(u.email)).family)continue;
   const viewerPerson=accepted(f,viewer._id);
   const edges=f.relations.map(e=>({fromPersonId:e.from,toPersonId:e.to,type:e.type}));
   result.push({familyId:String(f._id),personId:String(p._id),name:p.name,contexts:G.contexts(viewerPerson._id,edges.filter(e=>same(e.fromPersonId,viewerPerson._id)&&same(e.toPersonId,p._id)||same(e.toPersonId,viewerPerson._id)&&same(e.fromPersonId,p._id)),[])});
  }
 }
 return {members:result};
}
async function context(viewer,familyId,personId,runtime){
 const f=await contextFamily(familyId,viewer);
 const owner=f.people.find(p=>same(p._id,personId)&&p.status==='ACCEPTED'&&p.userId&&!same(p.userId,viewer._id));
 if(!owner)fail(404,'Member not found.');
 return {owner:{personId:String(owner._id),userId:String(owner.userId),name:owner.name},familyId:String(f._id),readOnly:true,modules:await available(f,owner,viewer,runtime)};
}
const label=(kind,gender)=>({parent:{male:'Father',female:'Mother',neutral:'Parent'},child:{male:'Son',female:'Daughter',neutral:'Child'},partner:{male:'Husband',female:'Wife',neutral:'Partner'},sibling:{male:'Brother',female:'Sister',neutral:'Sibling'}})[kind]?.[gender]||'Family member';
function familyData(f,owner,viewer){
 const grant=f.shares.find(g=>g.feature==='family'&&same(g.ownerId,owner.userId)&&same(g.recipientId,viewer._id));
 if(!grant?.visiblePersonIds?.length)fail(403,'Family information is not shared with you.');
 const scope=new Set(grant.visiblePersonIds.map(String));
 const scoped=f.people.filter(p=>scope.has(String(p._id)));
 const edgeScope=new Set([...scoped.map(p=>String(p._id)),String(owner._id)]);
 const edges=f.relations.filter(r=>edgeScope.has(String(r.from))&&edgeScope.has(String(r.to))).map(r=>({fromPersonId:r.from,toPersonId:r.to,type:r.type}));
 const people=require('./familyPerspective').perspective(scoped.map(p=>p.toObject?p.toObject():p),edges,owner._id).map(p=>({id:p.id,name:p.name,status:p.status,gender:p.gender,relationship:p.relationship,group:p.group,preferredName:p.preferredName??null,birthDate:p.birthDate??null,note:p.note??null}));
 const contexts=[...new Set(people.filter(p=>p.relationship!=='Self').map(p=>p.group).filter(Boolean))];
 return {owner:{name:owner.name},feature:'family',unitId:String(f._id),perspectivePersonId:String(owner._id),readOnly:true,contexts,people};
}
module.exports={members,context,contextFamily,available,familyData};
