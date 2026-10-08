const mongoose=require('mongoose');
const {Unit}=require('../models/FamilyUnit');
const {Family}=require('../models/Family');
// Existing F018/F023 handlers retain their contracts; normalized unit writes run
// inside an ALS-scoped transaction and return a response only after commit.
mongoose.set('transactionAsyncLocalStorage',true);
function atomicUnitHandler(handler){return async(req,res,next)=>{
 if(!req.params.familyId||!['POST','PUT','PATCH','DELETE'].includes(req.method))return handler(req,res,next);
 const unit=await Unit.findOne({_id:req.params.familyId,state:'ACTIVE'});
 if(!unit)return handler(req,res,next);
 let body,code=200,ended=false;
 const proxy=Object.create(res);
 proxy.status=value=>{code=value;return proxy;};
 proxy.json=value=>{body=value;ended=true;return proxy;};
 proxy.end=()=>{ended=true;return proxy;};
 try{
  await mongoose.connection.transaction(async()=>{
   const current=await Unit.findOne({_id:unit._id,state:'ACTIVE'});if(!current)throw Object.assign(Error('Family changed; refresh.'),{status:409});
   current.revision++;await current.save();
   if(req.socialFamily)req.socialFamily=await Family.findById(current._id);
   if(!req.socialFamily&&req.params.familyId)req.unitCompatibility=true;
   await handler(req,proxy,next);
   if(code>=400)throw Object.assign(Error(body?.error||'Family change rejected.'),{status:code});
  });
  if(!ended)return next();
  if(body===undefined)return res.status(code).end();return res.status(code).json(body);
 }catch(error){if(error.status)return res.status(error.status).json({error:error.message});next(error);}
};}
function wrapMutations(router){
 for(const method of ['post','put','patch','delete']){
  const register=router[method].bind(router);
  router[method]=(path,...handlers)=>register(path,...handlers.map(h=>h.constructor.name==='AsyncFunction'?atomicUnitHandler(h):h));
 }
}
module.exports={wrapMutations};
