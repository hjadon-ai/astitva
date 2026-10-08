const mongoose=require('mongoose');
const {Person,Unit,Membership,Relationship,Request,Merge,Quota}=require('../models/FamilyUnit');
const {Family,FamilyInvitation,FamilyActivity}=require('../models/Family');
const {FamilyPost,FamilyPostComment}=require('../models/FamilyPost');
const User=require('../models/User');
const G=require('./familyGraph');
const id=value=>typeof value==='string'&&/^[a-f0-9]{24}$/i.test(value);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
function revision(value){if(!Number.isSafeInteger(value)||value<0)fail(400,'A non-negative expectedRevision is required.');return value;}
async function transaction(work){
 const hello=await mongoose.connection.db.admin().command({hello:1});
 if(!hello.setName&&hello.msg!=='isdbgrid')fail(409,'Family unit changes require transaction-capable MongoDB. Start the local replica set; existing families remain unchanged.');
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{result=await work(session);});return result;}
 finally{await session.endSession();}
}
async function identity(user,session){
 let person=await Person.findOne({userId:user._id}).session(session);
 if(!person){[person]=await Person.create([{userId:user._id,name:user.name}],{session,ordered:true});}
 return person;
}
async function access(unitId,user,session,role=null){
 if(!id(String(unitId)))fail(404,'Family unit not found.');
 const unit=await Unit.findOne({_id:unitId,state:'ACTIVE'}).session(session);
 const person=await Person.findOne({userId:user._id}).session(session);
 const member=unit&&person&&await Membership.findOne({unitId:unit._id,personId:person._id}).session(session);
 if(!member)fail(404,'Family unit not found.');
 if(role==='ADMIN'&&member.role!=='ADMIN'||role==='WRITE'&&!['ADMIN','EDITOR'].includes(member.role))fail(403,'Required family role is missing.');
 return {unit,person,member};
}
async function state(unitId,session){
 const unit=await Unit.findById(unitId).session(session);
 const memberships=await Membership.find({unitId}).session(session).lean();
 const people=await Person.find({_id:{$in:memberships.map(m=>m.personId)}}).session(session).lean();
 const edges=await Relationship.find({unitId}).session(session).lean();
 const projection=await Family.findById(unitId).session(session);
 return {unit,memberships,people,edges,projection};
}
async function touch(unit,session){unit.revision++;await unit.save({session});}
async function project(unitId,session){
 const s=await state(unitId,session);
 const old=s.projection;
 const people=s.memberships.map(m=>{const p=s.people.find(p=>G.same(p._id,m.personId));return {_id:p._id,name:p.name,gender:p.gender,userId:p.userId,status:p.userId?'ACCEPTED':'NON_USER',role:m.role,...m.details,...(p.birthDate!==undefined?{birthDate:p.birthDate}:{})};});
 const relations=s.edges.map(e=>({_id:e._id,from:e.fromPersonId,to:e.toPersonId,type:e.type}));
 if(old){old.normalizedUnit=true;old.people=people;old.relations=relations;await old.save({session});}
 else await Family.create([{_id:s.unit._id,creatorId:s.unit.creatorId,normalizedUnit:true,people,relations}],{session,ordered:true});
}
async function view(unitId,user,session){
 const a=await access(unitId,user,session),s=await state(unitId,session);
 const perspective=require('./familyPerspective').perspective(s.people,s.edges,a.person._id);
 const connections=perspective.filter(p=>p.kind).map(p=>({personId:p.id,kind:p.kind}));
 const contexts=[...new Set([...G.contexts(a.person._id,s.edges,s.unit.anchors),...perspective.map(p=>p.group).filter(Boolean)])];
 return {id:String(s.unit._id),revision:s.unit.revision,contexts,selfId:String(a.person._id),role:a.member.role,
  people:s.memberships.map(m=>{const p=s.people.find(p=>G.same(p._id,m.personId));return {id:String(p._id),name:p.name,gender:p.gender,userId:p.userId?String(p.userId):null,status:p.userId?'ACCEPTED':'NON_USER',role:m.role,details:{...m.details,...(p.birthDate!==undefined?{birthDate:p.birthDate}:{})}};}),connections};
}
async function list(user){
 const p=await Person.findOne({userId:user._id});const memberships=p?await Membership.find({personId:p._id}).lean():[];
 const units=await Unit.find({_id:{$in:memberships.map(m=>m.unitId)},state:'ACTIVE'}).sort({createdAt:1,_id:1});
 const hello=await mongoose.connection.db.admin().command({hello:1});
 return {units:await Promise.all(units.map(u=>view(u._id,user))),transactionsAvailable:!!(hello.setName||hello.msg==='isdbgrid')};
}
async function create(user,body){
 if(!G.labels[body.relationship])fail(400,'Choose a relationship to establish the unit context.');
 return transaction(async session=>{
  if(await Family.exists({'people.userId':user._id,normalizedUnit:{$ne:true}}).session(session))fail(409,'Review conversion of your existing family records before creating normalized units.');
  const person=await identity(user,session);
  const memberships=await Membership.find({personId:person._id}).session(session);
  for(const m of memberships){const s=await state(m.unitId,session);if(s.unit?.state==='ACTIVE'&&G.contexts(person._id,s.edges,s.unit.anchors).includes(G.contextFor(body.relationship)))fail(409,'Use the existing matching unit, or review ambiguous placement before creating another.');}
  const [unit]=await Unit.create([{creatorId:user._id,anchors:[{personId:person._id,relationship:body.relationship}]}],{session,ordered:true});
  await Membership.create([{unitId:unit._id,personId:person._id,role:'ADMIN'}],{session,ordered:true});await project(unit._id,session);return view(unit._id,user,session);
 });
}
async function parentSlot(personId,label,session,exclude=null){
 if(!['father','mother'].includes(label))return;
 const edges=await Relationship.find({type:'parent',toPersonId:personId}).session(session).lean();
 const parents=edges.filter(e=>!exclude||!G.same(e.fromPersonId,exclude)).map(e=>e.fromPersonId);
 if(await Person.exists({_id:{$in:parents},gender:G.labels[label][1]}).session(session))fail(409,`You already have a ${label}. Only one father and one mother are supported. Correct the existing member instead of adding another.`);
}
async function add(user,unitId,body){
 if(body.kind!=='NON_USER'||!G.labels[body.relationship]||typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)fail(400,'Use NON_USER, a name of 1–80 characters and a relationship.');
 return transaction(async session=>{
  const a=await access(unitId,user,session,'WRITE');if(a.unit.revision!==revision(body.expectedRevision))fail(409,'Family changed; refresh.');
  await parentSlot(a.person._id,body.relationship,session);const s=await state(unitId,session);if(G.labels[body.relationship][0]==='partner'&&s.edges.some(e=>e.type==='partner'&&(G.same(e.fromPersonId,a.person._id)||G.same(e.toPersonId,a.person._id))))fail(409,'You already have a partner. Only one current husband or wife is supported. Correct the existing relationship or review member removal first.');if(s.people.length>=200)fail(409,'Unit member limit reached.');
  if(!G.contexts(a.person._id,s.edges,a.unit.anchors).includes(G.contextFor(body.relationship)))fail(409,'Choose the unit matching this relationship context.');
  const [person]=await Person.create([{name:body.name.trim(),gender:G.labels[body.relationship][1]}],{session,ordered:true});
  await Membership.create([{unitId,personId:person._id}],{session,ordered:true});
  const edges=G.sharedChildren([...s.edges,G.edge(a.person._id,person._id,body.relationship)]);const invalid=G.validateGraph(edges);if(invalid)fail(409,invalid);
  await validateConnected(edges,[unitId],session);await replaceEdges(unitId,edges,session);await touch(a.unit,session);await project(unitId,session);return view(unitId,user,session);
 });
}
async function validateConnected(edges,excludedUnits,session){
 const found=new Set(edges.flatMap(e=>[String(e.fromPersonId),String(e.toPersonId)]));
 const external=new Map();let frontier=[...found];
 while(frontier.length){
  const rows=await Relationship.find({unitId:{$nin:excludedUnits},$or:[{fromPersonId:{$in:frontier}},{toPersonId:{$in:frontier}}]}).session(session).lean();
  const next=[];for(const e of rows){external.set(String(e._id),e);for(const p of [e.fromPersonId,e.toPersonId])if(!found.has(String(p))){found.add(String(p));next.push(String(p));}}
  if(found.size>1000)fail(409,'Connected graph exceeds the safe validation limit; human review is required.');frontier=next;
 }
 const invalid=G.validateGraph([...edges,...external.values()]);if(invalid)fail(409,invalid);
 const combined=[...edges,...external.values()].filter(e=>e.type==='parent');
 const parents=await Person.find({_id:{$in:combined.map(e=>e.fromPersonId)}}).select('_id gender').session(session).lean();
 const genders=new Map(parents.map(p=>[String(p._id),p.gender])),slots=new Map();
 for(const e of combined){const gender=genders.get(String(e.fromPersonId));if(!['male','female'].includes(gender))continue;const key=`${e.toPersonId}:${gender}`;const prior=slots.get(key);if(prior&&!G.same(prior,e.fromPersonId))fail(409,'Only one father and one mother are supported. Resolve duplicate parent relationships before continuing.');slots.set(key,e.fromPersonId);}

}
async function replaceEdges(unitId,edges,session){
 const seen=new Set();await Relationship.deleteMany({unitId}).session(session);
 const rows=edges.filter(e=>{const k=`${e.type}:${e.fromPersonId}:${e.toPersonId}`;if(seen.has(k))return false;seen.add(k);return true;}).map(e=>({unitId,fromPersonId:e.fromPersonId,toPersonId:e.toPersonId,type:e.type}));
 if(rows.length)await Relationship.create(rows,{session,ordered:true});
}
async function candidates(personId,relationship,session){
 const ctx=G.labels[relationship][0]==='child'?'bornIn':G.labels[relationship][0]==='parent'?'formed':G.contextFor(relationship);
 const memberships=await Membership.find({personId}).session(session);const result=[];
 for(const m of memberships){const s=await state(m.unitId,session);if(s.unit?.state==='ACTIVE'&&G.contexts(personId,s.edges,s.unit.anchors).includes(ctx))result.push(s.unit);}
 return result;
}
async function authorizedRequest(requestId,user,session){
 if(!id(String(requestId)))fail(404,'Request not found.');const r=await Request.findById(requestId).session(session);if(!r)fail(404,'Request not found.');
 if(r.targetEmail===user.email||G.same(r.initiatorId,user._id))return r;
 const person=await Person.findOne({userId:user._id}).session(session);
 if(person&&await Membership.exists({personId:person._id,unitId:{$in:[r.sourceUnitId,r.targetUnitId].filter(Boolean)},role:'ADMIN'}).session(session))return r;
 fail(404,'Request not found.');
}
async function preview(r,session){
 const source=await state(r.sourceUnitId,session);const target=r.targetUnitId?await state(r.targetUnitId,session):null;
 const edges=[...source.edges,...(target?.edges||[])];
 if(r.targetPersonId)edges.push(G.edge(r.sourcePersonId,r.targetPersonId,r.relationship));
 const combined=G.sharedChildren(edges),invalid=G.validateGraph(combined);
 const people=[...source.people,...(target?.people||[])];
 const names=new Map();const duplicates=[];
 for(const p of people){const n=p.name.toLowerCase();if(names.has(n)&&!G.same(names.get(n),p._id))duplicates.push(n);else names.set(n,p._id);}
 const pins=[source.projection?.pinnedPostId,target?.projection?.pinnedPostId].filter(Boolean);
 let blocker=source.unit?.state!=='ACTIVE'||target&&target.unit?.state!=='ACTIVE'?'A source unit is no longer active.':invalid;
 if(pins.length>1&&!pins.some(p=>G.same(p,r.pinChoice)))blocker='Choose which pinned announcement to retain; both posts remain.';
 if(!blocker){try{await validateConnected(combined,[source.unit._id,...(target?[target.unit._id]:[])],session);}catch(error){if(error.status===409)blocker=error.message;else throw error;}}
 const revisions=Object.fromEntries([source.unit,target?.unit].filter(Boolean).map(u=>[String(u._id),u.revision]));
 return {source,target,edges:combined,revisions,blocker,warnings:duplicates.length?['POSSIBLE_DUPLICATE']:[],pins:pins.map(String)};
}
async function summary(r,user,session){
 const p=await Person.findOne({userId:user._id}).session(session);
 const roleMemberships=p?await Membership.find({personId:p._id,role:'ADMIN',unitId:{$in:[r.sourceUnitId,r.targetUnitId].filter(Boolean)}}).session(session):[];
 const actions=[];const terminal=['COMPLETED','DECLINED','CANCELLED','EXPIRED'].includes(r.status)||r.expiresAt<=new Date();
 if(!terminal&&r.targetEmail===user.email&&r.relationshipConsent==='PENDING')actions.push('ACCEPT_RELATIONSHIP','DECLINE_RELATIONSHIP');
 if(!terminal&&r.relationshipConsent==='ACCEPTED'&&r.targetUnitId&&roleMemberships.length)actions.push('ACCEPT_MERGE','DECLINE_MERGE');
 const source=await Unit.findById(r.sourceUnitId).session(session),target=r.targetUnitId&&await Unit.findById(r.targetUnitId).session(session);
 const pr=!terminal&&source?.state==='ACTIVE'&&r.relationshipConsent==='ACCEPTED'?await preview(r,session):null;
 const options=r.targetEmail===user.email&&p?await candidates(p._id,r.relationship,session):[];
 return {id:String(r._id),revision:r.revision,status:r.expiresAt<=new Date()&&!terminal?'EXPIRED':r.expiresAt<=new Date()&&r.status!=='COMPLETED'&&r.status!=='DECLINED'?'EXPIRED':r.status,
  relationship:r.relationship,requestedRole:r.requestedRole||'READONLY',relationshipConsent:r.relationshipConsent,delivery:r.delivery,expiresAt:r.expiresAt,
  units:[source,target].filter(Boolean).map(u=>({id:String(u._id),revision:u.revision,state:u.state})),
  approvals:r.approvals.map(a=>({unitId:String(a.unitId),actorId:String(a.actorId),revision:a.revision})),
  adminUnitIds:roleMemberships.map(m=>String(m.unitId)),availableActions:actions,warnings:pr?.warnings||[],blockReason:pr?.blocker||r.blockReason,pinOptions:pr?.pins||[],
  targetUnitOptions:options.map(u=>({id:String(u._id),revision:u.revision})),previewRevisions:pr?.revisions||{},
  mergePreview:pr?{survivorId:String([pr.source,pr.target].filter(Boolean).sort((a,b)=>a.unit.createdAt-b.unit.createdAt||String(a.unit._id).localeCompare(String(b.unit._id)))[0].unit._id),
   members:[pr.source,pr.target].filter(Boolean).flatMap(s=>s.memberships.map(m=>({personId:String(m.personId),name:s.people.find(p=>G.same(p._id,m.personId))?.name,role:m.role,unitId:String(s.unit._id)}))),
   relationshipCount:pr.edges.length}:null};
}
async function requestList(user){
 const person=await Person.findOne({userId:user._id});const admin=person?await Membership.find({personId:person._id,role:'ADMIN'}):[];
 const rows=await Request.find({$or:[{initiatorId:user._id},{targetEmail:user.email},{sourceUnitId:{$in:admin.map(m=>m.unitId)}},{targetUnitId:{$in:admin.map(m=>m.unitId)}}]}).sort({createdAt:-1}).limit(100);
 return {requests:await Promise.all(rows.map(r=>summary(r,user)))};
}
async function newRequest(user,body){
 if(body.requestedRole!==undefined&&!['READONLY','EDITOR','ADMIN'].includes(body.requestedRole))fail(400,'Choose a valid family role.');
 const mail=typeof body.targetEmail==='string'?body.targetEmail.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)||mail.length>254||mail===user.email||!G.labels[body.relationship]||typeof body.idempotencyKey!=='string'||body.idempotencyKey.length>100||!body.idempotencyKey)fail(400,'Use another exact email, relationship and idempotency key.');
 return transaction(async session=>{
  const a=await access(body.sourceUnitId,user,session,'ADMIN');const old=await Request.findOne({initiatorId:user._id,idempotencyKey:body.idempotencyKey}).session(session);if(old)return old;
  if(a.unit.revision!==revision(body.expectedRevision))fail(409,'Family changed; refresh.');
  await parentSlot(a.person._id,body.relationship,session);const s=await state(a.unit._id,session);if(G.labels[body.relationship][0]==='partner'&&s.edges.some(e=>e.type==='partner'&&(G.same(e.fromPersonId,a.person._id)||G.same(e.toPersonId,a.person._id))))fail(409,'You already have a partner. Only one current husband or wife is supported. Correct the existing relationship or review member removal first.');if(!G.contexts(a.person._id,s.edges,a.unit.anchors).includes(G.contextFor(body.relationship)))fail(409,'Relationship does not match this unit context.');
  const day=new Date();day.setUTCHours(0,0,0,0);
  let quota=await Quota.findOne({initiatorId:user._id,targetEmail:mail,day:day.toISOString().slice(0,10)}).session(session);
  if(!quota){[quota]=await Quota.create([{initiatorId:user._id,targetEmail:mail,day:day.toISOString().slice(0,10)}],{session,ordered:true});}
  if(quota.count>=2)fail(429,'Two invitations per recipient per UTC day are allowed.');quota.count++;await quota.save({session});
  if(await Request.exists({sourceUnitId:a.unit._id,targetEmail:mail,status:{$in:['PENDING_RELATIONSHIP','AWAITING_MERGE','BLOCKED']},expiresAt:{$gt:new Date()}}).session(session))fail(409,'An active request already exists.');
  if(body.existingPersonId){const m=await Membership.findOne({unitId:a.unit._id,personId:body.existingPersonId}).session(session);const p=m&&await Person.findById(m.personId).session(session);if(!p||p.userId)fail(409,'Select an unlinked member in this unit.');
   const selectedEdge=G.edge(a.person._id,p._id,body.relationship);
   if(!s.edges.some(e=>G.same(e.fromPersonId,selectedEdge.fromPersonId)&&G.same(e.toPersonId,selectedEdge.toPersonId)&&e.type===selectedEdge.type))fail(409,'Selected member relationship does not match.');}
  let existingPersonId=body.existingPersonId||null;
  if(body.inviteToRegister&&!existingPersonId){
   if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)fail(400,'Enter the invited person name, up to 80 characters.');
   const [invitee]=await Person.create([{name:body.name.trim(),gender:G.labels[body.relationship][1]}],{session,ordered:true});
   await Membership.create([{unitId:a.unit._id,personId:invitee._id}],{session,ordered:true});
   const edges=G.sharedChildren([...s.edges,G.edge(a.person._id,invitee._id,body.relationship)]);const invalid=G.validateGraph(edges);if(invalid)fail(409,invalid);
   await validateConnected(edges,[a.unit._id],session);await replaceEdges(a.unit._id,edges,session);await touch(a.unit,session);await project(a.unit._id,session);existingPersonId=invitee._id;
  }
  const [r]=await Request.create([{initiatorId:user._id,sourcePersonId:a.person._id,sourceUnitId:a.unit._id,targetEmail:mail,relationship:body.relationship,requestedRole:body.requestedRole||'READONLY',existingPersonId,idempotencyKey:body.idempotencyKey,expiresAt:new Date(Date.now()+7*86400000)}],{session,ordered:true});return r;
 });
}
async function relationshipDecision(user,requestId,body){
 return transaction(async session=>{
  const r=await authorizedRequest(requestId,user,session);if(r.targetEmail!==user.email)fail(403,'Only the addressed verified recipient may decide.');
  if(r.status==='COMPLETED')return summary(r,user,session);
  if(r.revision!==revision(body.expectedRevision)||r.relationshipConsent!=='PENDING'||r.expiresAt<=new Date())fail(409,'Request changed or expired; refresh.');
  if(!['accept','decline'].includes(body.decision))fail(400,'Choose accept or decline.');
  r.revision++;
  if(body.decision==='decline'){r.relationshipConsent='DECLINED';r.status='DECLINED';await r.save({session});return summary(r,user,session);}
  if(await Family.exists({'people.userId':user._id,normalizedUnit:{$ne:true}}).session(session))fail(409,'Review conversion of your existing family records before linking units.');
  const person=await identity(user,session);
  if(r.existingPersonId&&!G.same(r.existingPersonId,person._id)){
   const existing=await Person.findById(r.existingPersonId).session(session);
   // Never combine established person records. A newly-created identity can link the selected member instead.
   const used=await Membership.exists({personId:person._id}).session(session);
   if(used){fail(409,'This account already has a family identity. Review linking the existing Non User before continuing; no records were combined.');}else{
   if(!existing||existing.userId)fail(409,'The selected NON_USER is no longer linkable.');
   await Person.deleteOne({_id:person._id}).session(session);r.targetPersonId=existing._id;}
  }else r.targetPersonId=person._id;
  const choices=await candidates(r.targetPersonId,r.relationship,session);
  const different=choices.filter(u=>!G.same(u._id,r.sourceUnitId));
  if(body.targetUnitId&&!different.some(u=>G.same(u._id,body.targetUnitId)))fail(404,'Candidate family not found.');
  if(different.length>1&&!body.targetUnitId)fail(409,'Select the relevant target unit; placement is ambiguous.');
  r.targetUnitId=body.targetUnitId||(different[0]?._id)||null;r.relationshipConsent='ACCEPTED';
  const pr=await preview(r,session);r.previewRevisions=pr.revisions;
  if(pr.blocker){r.status='BLOCKED';r.blockReason=pr.blocker;}
  else if(r.targetUnitId)r.status='AWAITING_MERGE';
  else await complete(r,pr,session);
  await r.save({session});return summary(r,user,session);
 });
}
async function complete(r,pr,session){
 if(pr.blocker)fail(409,pr.blocker);
 if(r.existingPersonId&&G.same(r.existingPersonId,r.targetPersonId)){
  const recipient=await User.findOne({email:r.targetEmail,emailVerifiedAt:{$ne:null}}).session(session);
  const selected=await Person.findById(r.targetPersonId).session(session);
  if(!recipient||!selected||selected.userId)fail(409,'Selected NON_USER is no longer linkable.');
  await require('./managedWorkspace').transfer(selected._id,recipient._id,session);
  selected.userId=recipient._id;await selected.save({session});
 }
 const sources=[pr.source,pr.target].filter(Boolean);
 if(sources.some(s=>s.people.length>200)||new Set(sources.flatMap(s=>s.people.map(p=>String(p._id)))).size>200)fail(409,'Unit member limit reached.');
 const survivor=sources.slice().sort((a,b)=>a.unit.createdAt-b.unit.createdAt||String(a.unit._id).localeCompare(String(b.unit._id)))[0];
 const keep=survivor.unit._id,retired=sources.find(s=>!G.same(s.unit._id,keep));
 const members=new Map();for(const s of sources)for(const m of s.memberships){const k=String(m.personId),old=members.get(k);if(old){old.role=G.higherRole(old.role,m.role);
  for(const field of ['preferredName','birthDate','note'])if(old.details?.[field]&&m.details?.[field]&&old.details[field]!==m.details[field])fail(409,'Conflicting family details require explicit review before combining units.');
  old.details={...m.details,...Object.fromEntries(Object.entries(old.details||{}).filter(([,v])=>v!==null))};
 }else members.set(k,{...m});}
 if(!members.has(String(r.targetPersonId)))members.set(String(r.targetPersonId),{personId:r.targetPersonId,role:'READONLY'});
 const requestedRole=r.requestedRole||'READONLY';
 if(requestedRole!=='READONLY'){const initiatingAdmin=await Membership.findOne({unitId:r.sourceUnitId,personId:r.sourcePersonId,role:'ADMIN'}).session(session);if(!initiatingAdmin)fail(409,'The initiating ADMIN must reconfirm the requested role.');}
 const recipientMembership=members.get(String(r.targetPersonId));recipientMembership.role=G.higherRole(recipientMembership.role,requestedRole);
 const units=sources.map(s=>s.unit._id);
 await validateConnected(pr.edges,units,session);
 await Membership.deleteMany({unitId:{$in:units}}).session(session);
 await Membership.create([...members.values()].map(m=>({unitId:keep,personId:m.personId,role:m.role,details:m.details})),{session,ordered:true});
 await Relationship.deleteMany({unitId:{$in:units}}).session(session);await replaceEdges(keep,pr.edges,session);
 survivor.unit.anchors=sources.flatMap(s=>s.unit.anchors);await touch(survivor.unit,session);
 // Preserve audience boundaries: old family-wide posts become explicit original-account audiences.
 for(const s of sources){const users=s.people.filter(p=>p.userId).map(p=>p.userId);
  await FamilyPost.updateMany({familyId:s.unit._id,audience:'family'},{$set:{audience:'selected',recipientIds:users},$inc:{version:1}}).session(session);
 }
 if(retired){
  retired.unit.state='MERGED';retired.unit.mergedIntoId=keep;await touch(retired.unit,session);
  await FamilyPost.updateMany({familyId:retired.unit._id},{$set:{familyId:keep}}).session(session);
  await FamilyPostComment.updateMany({familyId:retired.unit._id},{$set:{familyId:keep}}).session(session);
  await FamilyActivity.updateMany({familyId:retired.unit._id},{$set:{familyId:keep}}).session(session);
  await FamilyInvitation.updateMany({familyId:retired.unit._id},{$set:{familyId:keep}}).session(session);
  // Pending references follow the survivor but lose stale consent/approval previews.
  await Request.updateMany({_id:{$ne:r._id},sourceUnitId:retired.unit._id,status:{$in:['PENDING_RELATIONSHIP','AWAITING_MERGE','BLOCKED']}},{$set:{sourceUnitId:keep,approvals:[],previewRevisions:{},status:'BLOCKED',blockReason:'Family changed; refresh the request before approving.'},$inc:{revision:1}}).session(session);
  await Request.updateMany({_id:{$ne:r._id},targetUnitId:retired.unit._id,status:{$in:['AWAITING_MERGE','BLOCKED']}},{$set:{targetUnitId:keep,approvals:[],previewRevisions:{},status:'BLOCKED',blockReason:'Family changed; refresh the request before approving.'},$inc:{revision:1}}).session(session);
 }
 await project(keep,session);
 const projection=await Family.findById(keep).session(session);
 const grants=sources.flatMap(s=>s.projection?.shares.map(g=>g.toObject())||[]),keys=new Set();
 const combined=new Map();
 for(const g of grants){const k=`${g.ownerId}:${g.recipientId}:${g.feature}`;if(!combined.has(k))combined.set(k,g);
  else if(g.feature==='family'){const prior=combined.get(k);prior.visiblePersonIds=[...new Set([...(prior.visiblePersonIds||[]),...(g.visiblePersonIds||[])].map(String))];}}
 projection.shares=[...combined.values()];
 projection.pinnedPostId=r.pinChoice||sources.map(s=>s.projection?.pinnedPostId).find(Boolean)||null;await projection.save({session});
 if(retired)await Family.deleteOne({_id:retired.unit._id}).session(session); // normalized retired unit and merge audit remain
 if(retired)await Merge.create([{requestId:r._id,survivorId:keep,sourceIds:units,approvals:r.approvals,beforeRevisions:pr.revisions,personIds:[...members.keys()],completedAt:new Date()}],{session,ordered:true});
 if(r.existingPersonId&&G.same(r.existingPersonId,r.targetPersonId)){
  const memberships=await Membership.find({personId:r.targetPersonId}).session(session);
  for(const membership of memberships){if(G.same(membership.unitId,keep))continue;const other=await Unit.findOne({_id:membership.unitId,state:'ACTIVE'}).session(session);if(other){await touch(other,session);await project(other._id,session);}}
 }
 r.status='COMPLETED';r.blockReason=null;
}
async function mergeDecision(user,requestId,body){
 return transaction(async session=>{
  const r=await authorizedRequest(requestId,user,session);if(r.status==='COMPLETED')return summary(r,user,session);
  if(r.revision!==revision(body.expectedRevision)||r.relationshipConsent!=='ACCEPTED'||!r.targetUnitId||r.expiresAt<=new Date())fail(409,'Request changed or is not ready for merge.');
  if(![r.sourceUnitId,r.targetUnitId].some(u=>G.same(u,body.unitId)))fail(404,'Family unit not found.');
  const a=await access(body.unitId,user,session,'ADMIN');
  if(!['accept','decline'].includes(body.decision))fail(400,'Choose accept or decline.');
  r.revision++;
  if(body.decision==='decline'){r.status='DECLINED';r.approvals=[];await r.save({session});return summary(r,user,session);}
  if(body.pinChoice){const pr=await preview(r,session);if(!pr.pins.includes(body.pinChoice))fail(400,'Choose a listed pinned post.');if(r.pinChoice&&!G.same(r.pinChoice,body.pinChoice))r.approvals=[];r.pinChoice=body.pinChoice;}
  const pr=await preview(r,session);
  const changed=JSON.stringify(Object.fromEntries(r.previewRevisions))!==JSON.stringify(pr.revisions);
  if(changed){r.approvals=[];r.previewRevisions=pr.revisions;}
  // Client must have reviewed the current preview revisions.
  if(JSON.stringify(body.previewRevisions)!==JSON.stringify(pr.revisions)){r.approvals=[];r.previewRevisions=pr.revisions;r.status='BLOCKED';r.blockReason='Preview changed; refresh and accept again.';await r.save({session});return summary(r,user,session);}
  const valid=[];for(const approve of r.approvals){const u=await Unit.findById(approve.unitId).session(session);const p=await Person.findOne({userId:approve.actorId}).session(session);const m=p&&await Membership.findOne({unitId:approve.unitId,personId:p._id,role:'ADMIN'}).session(session);if(m&&u?.revision===approve.revision)valid.push(approve);}
  r.approvals=valid.filter(x=>!G.same(x.unitId,a.unit._id));
  if(r.approvals.some(x=>G.same(x.actorId,user._id))){r.status='BLOCKED';r.blockReason='Different ADMIN reviewers are required for the two sides.';await r.save({session});return summary(r,user,session);}
  if(pr.blocker){r.status='BLOCKED';r.blockReason=pr.blocker;await r.save({session});return summary(r,user,session);}
  r.approvals.push({unitId:a.unit._id,actorId:user._id,revision:a.unit.revision,acceptedAt:new Date()});r.status='AWAITING_MERGE';r.blockReason=null;
  if(r.approvals.length===2)await complete(r,pr,session);
  await r.save({session});return summary(r,user,session);
 });
}
async function removal(user,unitId,personId,session){
 const a=await access(unitId,user,session,'ADMIN');const m=id(String(personId))&&await Membership.findOne({unitId,personId}).session(session);
 const p=m&&await Person.findById(personId).session(session);if(!p)fail(404,'Member not found.');if(G.same(personId,a.person._id))fail(409,'You cannot remove yourself through member removal.');
 const edges=await Relationship.find({unitId,$or:[{fromPersonId:personId},{toPersonId:personId}]}).session(session).lean();
 const activeRequests=await Request.countDocuments({$or:[{existingPersonId:personId},{targetPersonId:personId},{sourcePersonId:personId}],status:{$in:['PENDING_RELATIONSHIP','AWAITING_MERGE','BLOCKED']},expiresAt:{$gt:new Date()}}).session(session);
 const invitations=await FamilyInvitation.countDocuments({familyId:unitId,personId}).session(session);
 const activities=await FamilyActivity.countDocuments({familyId:unitId,subjectPersonId:personId}).session(session);
 return {a,p,edges,activeRequests,invitations,activities};
}
async function remove(user,unitId,personId,body){return transaction(async session=>{
 const x=await removal(user,unitId,personId,session);
 if(x.a.unit.revision!==revision(body.expectedRevision))fail(409,'Family changed; refresh.');
 if(body.confirmation!==true||body.confirmDetachRelationships!==true)fail(400,'Confirm member removal and detachment of its displayed relationships.');
 if(x.activeRequests||x.invitations)fail(409,'Resolve active invitations/requests before removing this member.');
 await Relationship.deleteMany({unitId,$or:[{fromPersonId:personId},{toPersonId:personId}]}).session(session);
 await Membership.deleteOne({unitId,personId}).session(session);
 const projection=await Family.findById(unitId).session(session);
 if(projection){projection.shares=projection.shares.filter(grant=>!x.p.userId||!G.same(grant.ownerId,x.p.userId)&&!G.same(grant.recipientId,x.p.userId));for(const grant of projection.shares)if(grant.visiblePersonIds)grant.visiblePersonIds=grant.visiblePersonIds.filter(value=>!G.same(value,personId));await projection.save({session});}
 x.a.unit.anchors=x.a.unit.anchors.filter(anchor=>!G.same(anchor.personId,personId));

 // History retains a name snapshot, not a dangling identity reference.
 await FamilyActivity.updateMany({familyId:unitId,subjectPersonId:personId},{$set:{subjectPersonId:null}}).session(session);
 if(!await require('./managedWorkspace').hasData(personId,session)&&!await Membership.exists({personId}).session(session)&&!await Request.exists({$or:[{existingPersonId:personId},{targetPersonId:personId},{sourcePersonId:personId}]}).session(session))await Person.deleteOne({_id:personId,userId:null}).session(session);
 await touch(x.a.unit,session);await project(unitId,session);
});}
async function updateMember(user,unitId,personId,body){return transaction(async session=>{
 const a=await access(unitId,user,session,body.role?'ADMIN':'WRITE');if(a.unit.revision!==revision(body.expectedRevision))fail(409,'Family changed; refresh.');
 const m=await Membership.findOne({unitId,personId}).session(session);const p=m&&await Person.findById(personId).session(session);if(!p)fail(404,'Member not found.');
 if(body.relationship){
  if(!G.labels[body.relationship])fail(400,'Choose a valid relationship.');
  if(G.same(personId,a.person._id))fail(400,'Choose another family member.');
  const s=await state(unitId,session);
  const direct=s.edges.filter(e=>G.same(e.fromPersonId,a.person._id)&&G.same(e.toPersonId,personId)||G.same(e.toPersonId,a.person._id)&&G.same(e.fromPersonId,personId));
  if(direct.length!==1)fail(409,'A single existing direct relationship is required for correction.');
  const old=direct[0],kind=old.type==='parent'?(G.same(old.fromPersonId,a.person._id)?'child':'parent'):old.type;
  if(G.contextFor(kind)!==G.contextFor(body.relationship))fail(409,'Moving a member between Family Roots and Family Blossoms requires a separate reviewed family change.');
  if(await Request.exists({status:{$in:['PENDING_RELATIONSHIP','AWAITING_MERGE','BLOCKED']},$or:[{sourceUnitId:unitId},{targetUnitId:unitId}]}).session(session))fail(409,'Resolve pending family requests before correcting relationships.');
  await parentSlot(a.person._id,body.relationship,session,p._id);
  const replacement=G.edge(a.person._id,p._id,body.relationship);
  const changed=old.type!==replacement.type||!G.same(old.fromPersonId,replacement.fromPersonId)||!G.same(old.toPersonId,replacement.toPersonId);
  if(changed&&s.edges.some(e=>!G.same(e._id,old._id)&&(G.same(e.fromPersonId,p._id)||G.same(e.toPersonId,p._id))))fail(409,'This member has other relationships. Review those dependencies before changing their relationship type.');
  const edges=s.edges.map(e=>G.same(e._id,old._id)?{...e,...replacement}:e);
  const invalid=G.validateGraph(edges);if(invalid)fail(409,invalid);
  await validateConnected(edges,[unitId],session);
  const gender=G.labels[body.relationship][1];
  if(gender!==p.gender){
   if(p.userId||await Membership.countDocuments({personId}).session(session)>1)fail(409,'A linked or shared member’s gendered label requires review across their relationships.');
   p.gender=gender;await p.save({session});
  }
  await Relationship.updateOne({_id:old._id,unitId},{$set:replacement}).session(session);
 }
 if(body.role){if(!p.userId)fail(409,'Non User members cannot be assigned account roles. Link an account through the invitation flow first.');if(!['ADMIN','EDITOR','READONLY'].includes(body.role))fail(400,'Invalid role.');if(G.same(personId,a.person._id))fail(409,'Change another member role; retain your own ADMIN access.');m.role=body.role;}
 if(body.details){const details=require('./familyDetails').parseDetails(body.details);if(!details)fail(400,'Invalid family details.');Object.assign(m.details,details);
  if(G.same(personId,a.person._id)&&Object.prototype.hasOwnProperty.call(details,'birthDate')){
   p.birthDate=details.birthDate;await p.save({session});
   const memberships=await Membership.find({personId}).session(session);
   for(const membership of memberships){if(G.same(membership.unitId,unitId))continue;const other=await Unit.findOne({_id:membership.unitId,state:'ACTIVE'}).session(session);if(other){await touch(other,session);await project(other._id,session);}}
  }
 }
 if(body.name){if(p.userId)fail(409,'Account holders manage their own name.');if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)fail(400,'Name must contain 1–80 characters.');
  if(await Membership.countDocuments({personId}).session(session)>1)fail(409,'Shared identity name changes require review across its units.');p.name=body.name.trim();await p.save({session});}
 await m.save({session});await touch(a.unit,session);await project(unitId,session);return view(unitId,user,session);
});}
module.exports={id,fail,revision,transaction,identity,access,state,project,view,list,create,add,authorizedRequest,summary,requestList,newRequest,relationshipDecision,mergeDecision,removal,remove,updateMember};
