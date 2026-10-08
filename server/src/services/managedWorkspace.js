const mongoose=require('mongoose');
const {Person,Unit,Membership,Relationship}=require('../models/FamilyUnit');
const {featuresForEmail}=require('../middleware/featureAccess');
const {generalModules,categories}=require('./featureCategories');
const S=require('./familyUnits');
const same=(a,b)=>String(a)===String(b);
async function authorize(actor,unitId,personId,session){
 if(!S.id(unitId)||!S.id(personId))S.fail(404,'Managed member not found.');
 const a=await S.access(unitId,actor,session,'WRITE');
 const member=await Membership.findOne({unitId,personId}).session(session);
 const person=member&&await Person.findOne({_id:personId,userId:null}).session(session);
 if(!person)S.fail(403,'Managed access ended. Return to your own workspace.');
 return {...a,target:person};
}
async function members(actor){
 const person=await Person.findOne({userId:actor._id});if(!person)return {members:[]};
 const memberships=await Membership.find({personId:person._id,role:{$in:['ADMIN','EDITOR']}}).lean();const result=[];
 for(const membership of memberships){const unit=await Unit.findOne({_id:membership.unitId,state:'ACTIVE'});if(!unit)continue;
 const edges=await Relationship.find({unitId:unit._id}).lean();const G=require('./familyGraph');
 const rows=await Membership.find({unitId:unit._id}).lean();const people=await Person.find({_id:{$in:rows.map(row=>row.personId)},userId:null}).lean();
 for(const p of people)result.push({familyId:String(unit._id),personId:String(p._id),name:p.name,managed:true,contexts:G.contexts(person._id,edges.filter(e=>same(e.fromPersonId,person._id)&&same(e.toPersonId,p._id)||same(e.toPersonId,person._id)&&same(e.fromPersonId,p._id)),unit.anchors)});}
 return {members:result};
}
async function context(actor,unitId,personId){
 const a=await authorize(actor,unitId,personId);const features=await featuresForEmail(actor.email);if(!features.family)S.fail(403,'Family is not enabled.');
 const s=await S.state(unitId);
 const family=require('./familyPerspective').perspective(s.people,s.edges,personId).map(p=>{const membership=s.memberships.find(m=>same(m.personId,p._id));return {id:p.id,name:p.name,gender:p.gender,relationship:p.relationship,group:p.group,details:{...membership.details,...(p.birthDate!==undefined?{birthDate:p.birthDate}:{})}};});
 return {owner:{personId:String(a.target._id),name:a.target.name},familyId:unitId,managed:true,revision:s.unit.revision,readOnly:false,modules:generalModules(features),people:family};
}
async function updateDetails(actor,unitId,personId,body){return S.transaction(async session=>{
 const a=await authorize(actor,unitId,personId,session);if(a.unit.revision!==S.revision(body.expectedRevision))S.fail(409,'Family changed; refresh before editing.');
 const details=require('./familyDetails').parseDetails(body.details);if(!details)S.fail(400,'Invalid family details.');
 await Membership.updateOne({unitId,personId},{$set:Object.fromEntries(Object.entries(details).map(([key,value])=>[`details.${key}`,value]))},{session});
 await Person.updateOne({_id:personId,userId:null},{$inc:{__v:1}},{session});a.unit.revision++;await a.unit.save({session});await S.project(unitId,session);
 return {saved:true,revision:a.unit.revision};
});}
async function resolveRequest(req,feature){
 const personId=req.get('X-Astitva-Member'),unitId=req.get('X-Astitva-Family');if(!personId&&!unitId)return;
 if(!personId||!unitId||categories[feature]!=='general'||!['diet','priorities'].includes(feature))S.fail(403,'This operation is unavailable in a managed workspace.');
 if(!(await featuresForEmail(req.featureUser.email)).family)S.fail(403,'Family is not enabled.');
 await authorize(req.featureUser,unitId,personId);
 req.managedWorkspace={personId,unitId,feature};if(feature==='diet')req.dietUserId=personId;if(feature==='priorities')req.priorityOwner=personId;
}
function wrap(router){
 mongoose.set('transactionAsyncLocalStorage',true);
 for(const layer of router.stack)if(layer.route)for(const entry of layer.route.stack){const handler=entry.handle;if(handler.constructor.name!=='AsyncFunction')continue;
 entry.handle=async(req,res,next)=>{if(!req.managedWorkspace)return handler(req,res,next);
 const c=req.managedWorkspace;
 try{if(['GET','HEAD'].includes(req.method)){await authorize(req.featureUser,c.unitId,c.personId);return await handler(req,res,next);}
 let body,code=200,ended=false;const proxy=Object.create(res);proxy.status=n=>{code=n;return proxy;};proxy.json=value=>{body=value;ended=true;return proxy;};proxy.end=()=>{ended=true;return proxy;};
 await mongoose.connection.transaction(async session=>{await authorize(req.featureUser,c.unitId,c.personId,session);await Person.updateOne({_id:c.personId,userId:null},{$inc:{__v:1}},{session});await Unit.updateOne({_id:c.unitId,state:'ACTIVE'},{$inc:{__v:1}},{session});await handler(req,proxy,next);if(!ended)throw Error('Managed handler did not finish.');if(code>=400)S.fail(code,body?.error||'Managed operation rejected.');});
 if(body===undefined)return res.status(code).end();return res.status(code).json(body);
 }catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}};}
}
async function hasData(personId,session){if(await mongoose.connection.db.collection('mealLibraries').findOne({ownerId:personId},{session,projection:{_id:1}}))return true;for(const name of ['dietMeals','dietNutritionTargets','dietWaterEntries','dietLibraryMeals','dailyPriorityDays'])if(await mongoose.connection.db.collection(name).findOne({userId:personId},{session,projection:{_id:1}}))return true;return false;}
async function transfer(personId,userId,session){
 const names=['dietMeals','dietNutritionTargets','dietWaterEntries','dietLibraryMeals','dailyPriorityDays'];
 for(const name of names){const collection=mongoose.connection.db.collection(name);if(await collection.findOne({userId:personId},{session})&&await collection.findOne({userId},{session}))S.fail(409,'Existing account data requires an explicit transfer review before linking.');}
 for(const name of names)await mongoose.connection.db.collection(name).updateMany({userId:personId},{$set:{userId}},{session});
 await mongoose.connection.db.collection('mealLibraries').updateMany({ownerId:personId},{$set:{ownerId:userId},$unset:{legacyOwnerId:''}},{session});
 const refs=await mongoose.connection.db.collection('mealLibraryReferences').find({userId:personId},{session}).toArray();
 for(const ref of refs)if(await mongoose.connection.db.collection('mealLibraryReferences').findOne({libraryId:ref.libraryId,userId},{session}))S.fail(409,'Existing account library access requires transfer review.');
 await mongoose.connection.db.collection('mealLibraryReferences').updateMany({userId:personId},{$set:{userId}},{session});
}
module.exports={authorize,members,context,updateDetails,resolveRequest,wrap,transfer,hasData};
