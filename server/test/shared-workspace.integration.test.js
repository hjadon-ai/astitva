const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
test('F034 explicit shared context, safe scopes, revocation and unchanged personal sharing', {skip:process.env.ASTITVA_TEST_SHARED_WORKSPACE!=='1',timeout:60000},async t=>{
 const uri=process.env.F034_TEST_MONGODB_URL;
 if(!/^mongodb:\/\/127\.0\.0\.1:27135\/f034_fixture_[a-z0-9_]+\?replicaSet=f035test$/.test(uri||''))throw Error('Use disposable f034_fixture_* on port 27135 f035test only.');
 Object.assign(process.env,{ASTITVA_ENV:'dev',MONGODB_URL:'mongodb://127.0.0.1:27017/astitva',PLAID_ENV:'sandbox',PLAID_CLIENT_ID:'fixture',PLAID_SECRET:'fixture',FINANCE_TOKEN_ENCRYPTION_KEY:'11'.repeat(32)});
 const m=require('mongoose');await m.connect(uri);t.after(async()=>{await m.connection.dropDatabase();await m.disconnect();});
 const User=require('../src/models/User'),Session=require('../src/models/Session'),InvitedEmail=require('../src/models/InvitedEmail'),{Family}=require('../src/models/Family'),{Meal}=require('../src/models/Diet'),{Unit,Person,Membership,Relationship}=require('../src/models/FamilyUnit');
 const users=await User.create(['A','B','C'].map((name,i)=>({name,email:`f034-${i}@example.invalid`,passwordHash:'fixture',emailVerifiedAt:new Date()})));
 await InvitedEmail.create(users.map(u=>({email:u.email,diet:true,finance:true,family:true})));
 const tokens=users.map(()=>crypto.randomBytes(32).toString('hex'));await Session.create(users.map((u,i)=>({userId:u._id,tokenHash:crypto.createHash('sha256').update(tokens[i]).digest('hex'),expiresAt:new Date(Date.now()+3600000)})));
 const people=await Person.create(users.slice(0,2).map(u=>({name:u.name,userId:u._id})));
 const child=await Person.create({name:'Child',gender:'male'});
 const unit=await Unit.create({creatorId:users[0]._id,anchors:[{personId:people[0]._id,relationship:'wife'}]});
 await Membership.create([{unitId:unit._id,personId:people[0]._id,role:'ADMIN'},{unitId:unit._id,personId:people[1]._id,role:'READONLY'},{unitId:unit._id,personId:child._id,role:'READONLY'}]);
 await Relationship.create([{unitId:unit._id,type:'partner',fromPersonId:people[0]._id,toPersonId:people[1]._id},{unitId:unit._id,type:'parent',fromPersonId:people[1]._id,toPersonId:child._id}]);
 await require('../src/services/familyUnits').project(unit._id);
 const express=require('express'),app=express();app.locals.runtime=require('../src/config/runtime').getRuntimeConfig();app.use(require('cookie-parser')());app.use(express.json());app.use(require('../src/middleware/security').unsafeOriginGuard(app.locals.runtime));app.use('/api/family',require('../src/routes/family'));app.use((e,req,res,next)=>res.status(500).json({error:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(r=>server.close(r)));
 async function api(method,path,who=0){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/family${path}`,{method,headers:{Origin:'http://localhost:3000',...(who===null?{}:{Cookie:`astitva_dev_session=${tokens[who]}`})}});return {status:r.status,body:await r.json()};}
 const root=`/${unit._id}`,ctx=`${root}/people/${people[1]._id}/shared-workspace`;
 assert.equal((await api('GET','/shared-workspace/members',null)).status,401);
 assert.deepEqual((await api('GET','/shared-workspace/members')).body.members,[{familyId:String(unit._id),personId:String(people[1]._id),name:'B',contexts:['formed']}]);
 assert.deepEqual((await api('GET',ctx)).body.modules,[]);
 assert.equal((await api('GET',ctx,2)).status,404);
 assert.equal((await api('GET',`${root}/people/${child._id}/shared-workspace`)).status,404);
 assert.equal((await api('GET',`${root}/shared/${users[1]._id}/finance`)).status,403);
 // READONLY member controls their own grants. ADMIN cannot read without them.
 assert.equal((await api('PUT',`${root}/shares/diet/${users[0]._id}`,1)).status,200);
 let c=(await api('GET',ctx)).body;assert.deepEqual(c.modules,['diet']);assert.equal(c.readOnly,true);assert.equal(c.owner.userId,String(users[1]._id));assert.equal('email' in c.owner,false);
 const values={calories:10,proteinGrams:1,carbohydrateGrams:1,fatGrams:0,fiberGrams:0};
 await Meal.create({userId:users[1]._id,consumedOn:'2026-10-06',name:'B meal',mealType:'breakfast',...values});
 await Meal.create({userId:users[0]._id,consumedOn:'2026-10-06',name:'A private meal',mealType:'breakfast',...values});
 const diet=await api('GET',`${root}/shared/${users[1]._id}/diet?date=2026-10-06`);assert.equal(diet.status,200);assert.deepEqual(diet.body.meals.map(x=>x.name),['B meal']);
 assert.equal((await api('GET',`${root}/shared/${users[1]._id}/diet?date=2026-02-30`)).status,400);
 assert.equal((await api('PUT',`${root}/shares/family/${users[0]._id}`,1)).status,200);
 const f=(await api('GET',`${root}/shared/${users[1]._id}/family`)).body;assert.equal(f.readOnly,true);assert.ok(f.people.some(p=>p.name==='Child'&&p.relationship==='Son'));assert.ok(f.people.every(p=>!('email' in p)&&!('userId'in p)&&!('role'in p)));
 // New members do not silently enter a Family grant's original scope.
 const extra=await Person.create({name:'Not originally shared'});await Membership.create({unitId:unit._id,personId:extra._id});await require('../src/services/familyUnits').project(unit._id);
 assert.equal((await api('GET',`${root}/shared/${users[1]._id}/family`)).body.people.some(p=>p.name==='Not originally shared'),false);
 assert.equal((await api('GET',`${root}/shared/${users[1]._id}/notes`)).status,403);
 assert.equal((await api('DELETE',`${root}/shares/diet/${users[0]._id}`,1)).status,200);
 assert.deepEqual((await api('GET',ctx)).body.modules,['family']);assert.equal((await api('GET',`${root}/shared/${users[1]._id}/diet`)).status,403);
 assert.equal((await api('PUT',`${root}/shares/finance/${users[0]._id}`,1)).status,200);
 app.locals.runtime={...app.locals.runtime,financeEnabled:false};assert.equal((await api('GET',`${root}/shared/${users[1]._id}/finance`)).status,403);assert.deepEqual((await api('GET',ctx)).body.modules,['family']);app.locals.runtime={...app.locals.runtime,financeEnabled:true};
 await InvitedEmail.updateOne({email:users[1].email},{$set:{finance:false}});assert.equal((await api('GET',`${root}/shared/${users[1]._id}/finance`)).status,403);
 // Mapping errors fail closed, never grant broad access from a stale projection.
 await Membership.deleteOne({unitId:unit._id,personId:people[1]._id});assert.equal((await api('GET',ctx)).status,409);await require('../src/services/familyUnits').project(unit._id);assert.equal((await api('GET',ctx)).status,404);
 assert.equal((await api('POST',ctx)).status,409); // No context write API.
 const legacy=await Family.create({creatorId:users[0]._id,people:[{name:'A',userId:users[0]._id,status:'ACCEPTED',role:'ADMIN'},{name:'B',userId:users[1]._id,status:'ACCEPTED',role:'READONLY'}]});
 assert.equal((await api('PUT',`/${legacy._id}/shares/diet/${users[0]._id}`,1)).status,200);assert.deepEqual((await api('GET',`/${legacy._id}/people/${legacy.people[1]._id}/shared-workspace`)).body.modules,['diet']);
});
