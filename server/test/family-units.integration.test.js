const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
test('F035 transactional consent, contextual units, private audiences, cleanup and stale approval protection',{
 skip:process.env.ASTITVA_TEST_FAMILY_UNITS!=='1',timeout:90000
},async t=>{
 const uri=process.env.F035_TEST_MONGODB_URL;
 if(!/^mongodb:\/\/127\.0\.0\.1:27135\/f035_fixture_[a-z0-9_]+\?replicaSet=f035test$/.test(uri||''))throw Error('Use an isolated f035_fixture_* database on the disposable port 27135 replica set.');
 Object.assign(process.env,{ASTITVA_ENV:'dev',MONGODB_URL:'mongodb://127.0.0.1:27017/astitva',PLAID_ENV:'sandbox',PLAID_CLIENT_ID:'fixture',PLAID_SECRET:'fixture',FINANCE_TOKEN_ENCRYPTION_KEY:'11'.repeat(32)});
 const m=require('mongoose');await m.connect(uri,{serverSelectionTimeoutMS:10000});
 const models=require('../src/models/FamilyUnit'),{Person,Unit,Membership,Relationship,Request,Merge}=models;
 const User=require('../src/models/User'),Session=require('../src/models/Session'),{Family,FamilyActivity}=require('../src/models/Family'),{FamilyPost,FamilyPostComment}=require('../src/models/FamilyPost');
 await Promise.all(Object.values(models).map(model=>model.createIndexes()));
 const sent=[];t.mock.method(require('../src/services/email'),'sendFamilyRequestEmail',async(u,r)=>{if(r.targetEmail.startsWith('fail'))throw Error('mock delivery failure');sent.push(r.targetEmail);});
 const users=await User.create(['Alex','Blair','Casey','Other'].map((name,i)=>({name,email:`f035-${i}@example.invalid`,passwordHash:'fixture',emailVerifiedAt:new Date()})));
 const tokens=users.map(()=>crypto.randomBytes(32).toString('hex'));await Session.create(users.map((u,i)=>({userId:u._id,tokenHash:crypto.createHash('sha256').update(tokens[i]).digest('hex'),expiresAt:new Date(Date.now()+3600000)})));
 const express=require('express'),app=express();app.locals.runtime=require('../src/config/runtime').getRuntimeConfig();app.use(require('../src/middleware/security').unsafeOriginGuard(app.locals.runtime));app.use(require('cookie-parser')());app.use(express.json());app.use('/api/family',require('../src/routes/family'));app.use((e,req,res,next)=>res.status(500).json({error:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(async()=>{await new Promise(r=>server.close(r));await m.connection.dropDatabase();await m.disconnect();});
 async function api(method,path,body,who=0,origin='http://localhost:3000'){
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/family${path}`,{method,headers:{'Content-Type':'application/json',Origin:origin,...(who===null?{}:{Cookie:`astitva_dev_session=${tokens[who]}`})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:response.status===204?null:await response.json()};
 }
 async function ok(method,path,body,who=0,status=200){const r=await api(method,path,body,who);assert.equal(r.status,status,JSON.stringify(r.body));return r.body;}
 const create=async(who,relationship)=>(await ok('POST','/units',{relationship},who,201)).unit;
 const add=async(u,name,relationship,who)=>(await ok('POST',`/units/${u.id}/people`,{kind:'NON_USER',name,relationship,expectedRevision:u.revision},who,201)).unit;
 assert.equal((await api('GET','/units',undefined,null)).status,401);
 assert.equal((await api('POST','/units',{relationship:'son'},0,'https://bad.example')).status,403);
 let x=await create(0,'son');x=await add(x,'Casey','son',0);const c1=x.people.find(p=>p.name==='Casey');
 let y=await create(1,'son');y=await add(y,'Casey','son',1);const c2=y.people.find(p=>p.name==='Casey');
 assert.notEqual(c1.id,c2.id);assert.equal(sent.length,0);assert.equal(await User.countDocuments(),4);
 let born=await create(0,'father');born=await add(born,'Parent','father',0);
 assert.equal((await api('POST',`/units/${x.id}/people`,{kind:'NON_USER',name:'Wrong','relationship':'father',expectedRevision:x.revision})).status,409);
 assert.equal((await api('GET',`/units/${x.id}`,undefined,3)).status,404);
 const post=await FamilyPost.create({familyId:x.id,authorId:users[0]._id,authorName:'Alex',type:'update',text:'Original audience',audience:'family'});
 await FamilyActivity.create({familyId:y.id,actorName:'Blair',action:'PERSON_ADDED',summary:'Added Casey',subjectPersonId:c2.id,subjectName:'Casey'});
 const receipt=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:users[1].email,relationship:'wife',expectedRevision:x.revision,idempotencyKey:'merge'},0,202);
 const before=await Unit.find().lean();
 let r=(await ok('GET',`/requests/${receipt.id}`,undefined,1)).request;
 assert.ok(r.availableActions.includes('ACCEPT_RELATIONSHIP'));assert.equal((await api('POST',`/requests/${r.id}/relationship-decision`,{decision:'accept',expectedRevision:r.revision},3)).status,404);
 r=(await ok('POST',`/requests/${r.id}/relationship-decision`,{decision:'accept',expectedRevision:r.revision},1)).request;
 assert.equal(r.status,'AWAITING_MERGE');assert.deepEqual((await Unit.find().lean()).map(u=>u.revision),before.map(u=>u.revision));
 assert.ok(r.warnings.includes('POSSIBLE_DUPLICATE'));
 r=(await ok('POST',`/requests/${r.id}/merge-decision`,{unitId:x.id,decision:'accept',expectedRevision:r.revision,previewRevisions:r.previewRevisions})).request;
 assert.equal(await Merge.countDocuments(),0);
 r=(await ok('POST',`/requests/${r.id}/merge-decision`,{unitId:y.id,decision:'accept',expectedRevision:r.revision,previewRevisions:r.previewRevisions},1)).request;
 assert.equal(r.status,'COMPLETED');assert.equal(await Merge.countDocuments(),1);
 const audit=await Merge.findOne();assert.equal(String(audit.survivorId),x.id);
 assert.equal((await Unit.findById(y.id)).state,'MERGED');assert.equal(String((await Unit.findById(y.id)).mergedIntoId),x.id);
 const xview=(await ok('GET',`/units/${x.id}`,undefined,1)).unit;
 assert.equal(xview.role,'ADMIN');assert.equal(xview.people.filter(p=>p.name==='Casey').length,2);
 assert.equal(xview.connections.filter(c=>c.kind==='child').length,2);assert.equal((await Unit.findById(born.id)).state,'ACTIVE');
 assert.equal(xview.people.some(p=>p.name==='Parent'),false);
 const preserved=await FamilyPost.findById(post._id);assert.equal(preserved.audience,'selected');assert.deepEqual(preserved.recipientIds.map(String),[String(users[0]._id)]);
 assert.equal((await api('GET',`/${x.id}/posts`,undefined,1)).body.posts.length,0);
 assert.equal((await api('POST',`/${x.id}/people`,{name:'Bypass',relationship:'son'})).status,409);
 assert.equal((await api('POST',`/requests/${r.id}/merge-decision`,{unitId:x.id,decision:'accept',expectedRevision:0},0)).body.request.status,'COMPLETED');assert.equal(await Merge.countDocuments(),1);
 // Decline preserves an existing NON_USER and both units.
 const decline=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:users[2].email,relationship:'son',existingPersonId:c1.id,expectedRevision:xview.revision,idempotencyKey:'decline'},0,202);
 let d=(await ok('GET',`/requests/${decline.id}`,undefined,2)).request;
 d=(await ok('POST',`/requests/${d.id}/relationship-decision`,{decision:'decline',expectedRevision:d.revision},2)).request;
 assert.equal(d.status,'DECLINED');assert.equal((await Person.findById(c1.id)).userId,null);
 // Explicit linking keeps the selected identity. READONLY has no write access.
 const claim=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:users[2].email,relationship:'son',existingPersonId:c1.id,expectedRevision:xview.revision,idempotencyKey:'claim'},0,202);
 let cl=(await ok('GET',`/requests/${claim.id}`,undefined,2)).request;
 cl=(await ok('POST',`/requests/${cl.id}/relationship-decision`,{decision:'accept',expectedRevision:cl.revision},2)).request;
 assert.equal(cl.status,'COMPLETED');assert.equal(String((await Person.findById(c1.id)).userId),String(users[2]._id));
 const child=(await ok('GET',`/units/${x.id}`,undefined,2)).unit;assert.deepEqual(child.contexts,['bornIn']);assert.equal(child.selfId,c1.id);
 assert.equal((await api('PATCH',`/units/${x.id}/people/${c2.id}`,{expectedRevision:child.revision,details:{note:'Forbidden'}},2)).status,403);
 assert.equal((await api('GET',`/units/${x.id}/people/${c2.id}/removal-preview`,undefined,2)).status,403);
 const removal=await ok('GET',`/units/${x.id}/people/${c2.id}/removal-preview`);
 assert.equal((await api('DELETE',`/units/${x.id}/people/${c2.id}`,{expectedRevision:removal.expectedRevision,confirmation:true})).status,400);
 await ok('DELETE',`/units/${x.id}/people/${c2.id}`,{expectedRevision:removal.expectedRevision,confirmation:true,confirmDetachRelationships:true},0,204);
 assert.equal(await Membership.exists({unitId:x.id,personId:c2.id}),null);assert.equal((await FamilyActivity.findOne({subjectName:'Casey'})).subjectPersonId,null);
 assert.equal(await User.countDocuments(),4);
 // A stale revision cannot modify details, and EDITOR cannot delete.
 const current=(await ok('GET',`/units/${x.id}`)).unit;
 assert.equal((await api('PATCH',`/units/${x.id}/people/${c1.id}`,{expectedRevision:current.revision-1,details:{note:'Stale'}})).status,409);
 await ok('PATCH',`/units/${x.id}/people/${c1.id}`,{expectedRevision:current.revision,role:'EDITOR'});
 assert.equal((await api('GET',`/units/${born.id}`,undefined,2)).status,404);
 // Sender delivery failure remains visible without linking an account.
 const fresh=(await ok('GET',`/units/${x.id}`)).unit;
 const failed=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:'fail@example.invalid',relationship:'son',expectedRevision:fresh.revision,idempotencyKey:'mailfail'},0,202);
 assert.equal((await ok('GET',`/requests/${failed.id}`)).request.delivery,'FAILED');
 // Stale graph approvals reset, a failed merge rolls back, and concurrent retry completes once.
 let other=await create(3,'son');other=await add(other,'Second child','daughter',3);
 let source=(await ok('GET',`/units/${x.id}`)).unit;
 const second=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:users[3].email,relationship:'brother',expectedRevision:source.revision,idempotencyKey:'wrongcontext'},0,409).catch(()=>null);
 // Use a separate Born-in source to avoid the established single-partner relation.
 let origin=born;
 const merge2=await ok('POST','/requests',{sourceUnitId:origin.id,targetEmail:users[3].email,relationship:'father',expectedRevision:origin.revision,idempotencyKey:'secondmerge'},0,202);
 let rr=(await ok('GET',`/requests/${merge2.id}`,undefined,3)).request;
 rr=(await ok('POST',`/requests/${rr.id}/relationship-decision`,{decision:'accept',expectedRevision:rr.revision},3)).request;
 rr=(await ok('POST',`/requests/${rr.id}/merge-decision`,{unitId:origin.id,decision:'accept',expectedRevision:rr.revision,previewRevisions:rr.previewRevisions})).request;
 origin=(await ok('GET',`/units/${origin.id}`)).unit;
 origin=await add(origin,'Sibling','sister',0);
 rr=(await ok('POST',`/requests/${rr.id}/merge-decision`,{unitId:other.id,decision:'accept',expectedRevision:rr.revision,previewRevisions:rr.previewRevisions},3)).request;
 assert.equal(rr.status,'BLOCKED');assert.equal(rr.approvals.length,0);
 rr=(await ok('POST',`/requests/${rr.id}/merge-decision`,{unitId:origin.id,decision:'accept',expectedRevision:rr.revision,previewRevisions:rr.previewRevisions})).request;
 const injected=t.mock.method(Merge,'create',async()=>{throw Error('Injected audit failure');});
 assert.equal((await api('POST',`/requests/${rr.id}/merge-decision`,{unitId:other.id,decision:'accept',expectedRevision:rr.revision,previewRevisions:rr.previewRevisions},3)).status,500);
 injected.mock.restore();
 assert.equal((await Unit.findById(other.id)).state,'ACTIVE');assert.equal((await Unit.findById(origin.id)).state,'ACTIVE');assert.equal(await Merge.countDocuments(),1);
 const retryBody={unitId:other.id,decision:'accept',expectedRevision:rr.revision,previewRevisions:rr.previewRevisions};
 const concurrent=await Promise.all([api('POST',`/requests/${rr.id}/merge-decision`,retryBody,3),api('POST',`/requests/${rr.id}/merge-decision`,retryBody,3)]);
 assert.ok(concurrent.every(result=>result.status===200||result.status===409));
 assert.equal((await Request.findById(rr.id)).status,'COMPLETED');assert.equal(await Merge.countDocuments(),2);

 // Persistent quota, expiry and active-request references cannot be bypassed.
 const quotaRequest=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:'quota@example.invalid',relationship:'son',expectedRevision:fresh.revision,idempotencyKey:'quota1'},0,202);
 await Request.updateOne({_id:quotaRequest.id},{$set:{status:'DECLINED'}});
 const q2=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:'quota@example.invalid',relationship:'son',expectedRevision:fresh.revision,idempotencyKey:'quota2'},0,202);
 await Request.updateOne({_id:q2.id},{$set:{status:'DECLINED'}});
 assert.equal((await api('POST','/requests',{sourceUnitId:x.id,targetEmail:'quota@example.invalid',relationship:'son',expectedRevision:fresh.revision,idempotencyKey:'quota3'})).status,429);
 await Request.updateOne({_id:failed.id},{$set:{expiresAt:new Date(0)}});
 const expired=(await ok('GET',`/requests/${failed.id}`)).request;assert.equal(expired.status,'EXPIRED');assert.equal(expired.availableActions.length,0);
 // Revoking a reviewer after approval prevents completion even without a revised preview.
 const formerAdmin=await User.create({name:'Former reviewer',email:'former-reviewer@example.invalid',passwordHash:'fixture',emailVerifiedAt:new Date()});
 const aPerson=await Person.create({name:'Former reviewer',userId:formerAdmin._id});
 const overlapSource=await Unit.create({creatorId:formerAdmin._id,anchors:[{personId:aPerson._id,relationship:'sister'}]});
 const bPerson=await Person.findOne({userId:users[1]._id});
 const overlapTarget=await Unit.create({creatorId:users[1]._id,anchors:[{personId:bPerson._id,relationship:'sister'}]});
 await Membership.create([{unitId:overlapSource._id,personId:aPerson._id,role:'ADMIN'},{unitId:overlapTarget._id,personId:bPerson._id,role:'ADMIN'}]);
 const service=require('../src/services/familyUnits');await service.transaction(async session=>{await service.project(overlapSource._id,session);await service.project(overlapTarget._id,session);});
 const rrDoc=await Request.create({initiatorId:formerAdmin._id,sourcePersonId:aPerson._id,sourceUnitId:overlapSource._id,targetPersonId:bPerson._id,targetUnitId:overlapTarget._id,targetEmail:users[1].email,relationship:'sister',relationshipConsent:'ACCEPTED',status:'AWAITING_MERGE',expiresAt:new Date(Date.now()+86400000),idempotencyKey:'revoke',previewRevisions:{[overlapSource._id]:0,[overlapTarget._id]:0},approvals:[{unitId:overlapSource._id,actorId:formerAdmin._id,revision:0,acceptedAt:new Date()}]});
 await Membership.updateOne({unitId:overlapSource._id,personId:aPerson._id},{$set:{role:'READONLY'}});
 const rev=(await ok('GET',`/requests/${rrDoc._id}`,undefined,1)).request;
 const reviewed=(await ok('POST',`/requests/${rrDoc._id}/merge-decision`,{unitId:String(overlapTarget._id),decision:'accept',expectedRevision:rev.revision,previewRevisions:rev.previewRevisions},1)).request;
 assert.equal(reviewed.status,'AWAITING_MERGE');assert.equal(reviewed.approvals.length,1);assert.equal(await Merge.countDocuments(),2);

 // Invite-to-register explicitly creates an unlinked member; decline preserves it.
 const inviteUnit=(await ok('GET',`/units/${x.id}`)).unit;
 const beforeUsers=await User.countDocuments();
 const newInvite=await ok('POST','/requests',{sourceUnitId:x.id,targetEmail:'new-invite@example.invalid',name:'New child',relationship:'daughter',inviteToRegister:true,expectedRevision:inviteUnit.revision,idempotencyKey:'newinvite'},0,202);
 const inviteRecord=await Request.findById(newInvite.id);const placeholder=await Person.findById(inviteRecord.existingPersonId);
 assert.equal(placeholder.userId,null);assert.equal(placeholder.name,'New child');assert.equal(await User.countDocuments(),beforeUsers);
 const newlyRegistered=await User.create({name:'New child',email:'new-invite@example.invalid',passwordHash:'fixture',emailVerifiedAt:new Date()});
 const decided=await require('../src/services/familyUnits').relationshipDecision(newlyRegistered,String(inviteRecord._id),{decision:'decline',expectedRevision:inviteRecord.revision});
 assert.equal(decided.status,'DECLINED');assert.equal((await Person.findById(placeholder._id)).userId,null);
 // Legacy units are not silently converted or duplicated.
 await Family.create({creatorId:newlyRegistered._id,people:[{name:'New child',userId:newlyRegistered._id,status:'ACCEPTED',role:'ADMIN'}]});
 await assert.rejects(()=>require('../src/services/familyUnits').create(newlyRegistered,{relationship:'son'}),/Review conversion/);

});
