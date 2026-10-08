const express = require('express');
const multer = require('multer');
const { Family } = require('../models/Family');
const { FamilyPost: Post, FamilyPostComment: Comment } = require('../models/FamilyPost');
const {objectId,same,accepted,canSee,audienceFilter,parsePost,validPhoto,pagination,cursor} = require('../services/familySocial');
const router=express.Router({mergeParams:true});
require('../services/familyUnitCompatibility').wrapMutations(router);
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:1,fieldSize:16384}});
const fail=(res,status,error)=>res.status(status).json({error});
router.use(async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  const family=objectId(req.params.familyId) && await Family.findById(req.params.familyId);
  if (!family || !accepted(family,req.familyUser._id)) return fail(res,404,'Family not found.');
  req.socialFamily=family;next();
});
function summary(post,req) {
  return {id:String(post._id),authorId:String(post.authorId),authorName:post.authorName,type:post.type,text:post.text,
    audience:post.audience,recipientIds:post.recipientIds.map(String),createdAt:post.createdAt,updatedAt:post.updatedAt,version:post.version,
    photoUrl:post.photo?.mime ? `/api/family/${req.params.familyId}/posts/${post._id}/photo` : null,
    reactionCount:post.reactions.length,reacted:post.reactions.some(id=>same(id,req.familyUser._id)),
    canEdit:same(post.authorId,req.familyUser._id),canRemove:true,canPin:post.type==='announcement',
    pinned:post.type==='announcement' && same(req.socialFamily.pinnedPostId,post._id)};
}
async function visible(req,res) {
  const post=objectId(req.params.postId) && await Post.findOne({_id:req.params.postId,familyId:req.params.familyId,deleted:false}).select('-photo.data');
  if (!post || !canSee(post,req.familyUser._id)) { fail(res,404,'Post removed or unavailable.');return null; }
  return post;
}
router.get('/',async(req,res)=>{
  const page=pagination(req.query);if(!page)return fail(res,400,'Invalid pagination.');
  const rows=await Post.find({$and:[{familyId:req.params.familyId,deleted:false},audienceFilter(req.familyUser._id),page.filter]}).select('-photo.data').sort({createdAt:-1,_id:-1}).limit(page.limit+1);
  let pinned=null;
  if(req.socialFamily.pinnedPostId){const p=await Post.findOne({_id:req.socialFamily.pinnedPostId,familyId:req.params.familyId,deleted:false,type:'announcement',...audienceFilter(req.familyUser._id)}).select('-photo.data');if(p)pinned=summary(p,req);}
  res.json({posts:rows.slice(0,page.limit).map(p=>summary(p,req)),pinned,nextCursor:rows.length>page.limit?cursor(rows[page.limit-1]):null});
});
router.post('/',(req,res,next)=>{
  if(!req.is('multipart/form-data'))return next();
  upload.single('photo')(req,res,error=>{
    if(error)return fail(res,error.code==='LIMIT_FILE_SIZE'?413:400,'Upload failed: one JPEG/PNG photo up to 2 MiB and one payload field are allowed.');
    if(Object.keys(req.body).some(k=>k!=='payload'))return fail(res,400,'Unexpected upload fields.');
    try{req.body=JSON.parse(req.body.payload);}catch{return fail(res,400,'Invalid upload payload.');}
    next();
  });
},async(req,res)=>{
  if(!req.is('application/json') && !req.is('multipart/form-data'))return fail(res,415,'JSON or multipart form required.');
  const fields=parsePost(req.body,req.socialFamily,req.familyUser._id);
  if(!fields || (!fields.text && !req.file))return fail(res,400,'Invalid post, audience or empty content.');
  if(req.file && !validPhoto(req.file))return fail(res,400,'Use a JPEG/PNG photo up to 2 MiB.');
  const post=await Post.create({...fields,familyId:req.params.familyId,authorId:req.familyUser._id,authorName:req.familyUser.name,...(req.file?{photo:{data:req.file.buffer,mime:req.file.mimetype}}:{})});
  res.status(201).json({post:summary(post,req)});
});
router.get('/:postId/photo',async(req,res)=>{
  if(!await visible(req,res))return;
  const p=await Post.findOne({_id:req.params.postId,familyId:req.params.familyId,deleted:false,...audienceFilter(req.familyUser._id)}).select('photo');
  if(!p?.photo?.data)return fail(res,404,'Photo unavailable.');
  res.set('X-Content-Type-Options','nosniff').set('Content-Type',p.photo.mime).set('Content-Disposition','inline').send(p.photo.data);
});
router.patch('/:postId',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  if(!same(p.authorId,req.familyUser._id))return fail(res,403,'Only the author may edit.');
  const body=req.body;if(!body || !Number.isSafeInteger(body.version) || body.version<1)return fail(res,400,'Post version required.');
  const {version,...fields}=body;const parsed=parsePost(fields,req.socialFamily,req.familyUser._id);
  if(!parsed || (!parsed.text && !p.photo?.mime))return fail(res,400,'Invalid post.');
  const updated=await Post.findOneAndUpdate({_id:p._id,deleted:false,version},{$set:parsed,$inc:{version:1}},{returnDocument:'after',runValidators:true}).select('-photo.data');
  if(!updated)return fail(res,409,'Post changed; refresh before editing.');
  if(updated.type!=='announcement')await Family.updateOne({_id:req.params.familyId,pinnedPostId:p._id},{$set:{pinnedPostId:null}});
  res.json({post:summary(updated,req)});
});
router.delete('/:postId',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  await Post.updateOne({_id:p._id,deleted:false},{$set:{deleted:true,text:'',reactions:[],recipientIds:[]},$unset:{photo:1},$inc:{version:1}});
  await Family.updateOne({_id:req.params.familyId,pinnedPostId:p._id},{$set:{pinnedPostId:null}});
  await Comment.deleteMany({postId:p._id});res.status(204).end();
});
router.put('/:postId/pin',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  if(p.type!=='announcement')return fail(res,400,'Only announcements may be pinned.');
  if(!req.body || typeof req.body.pinned!=='boolean' || Object.keys(req.body).length!==1)return fail(res,400,'pinned must be a boolean.');
  if(req.body.pinned)await Family.updateOne({_id:req.params.familyId},{$set:{pinnedPostId:p._id}});
  else await Family.updateOne({_id:req.params.familyId,pinnedPostId:p._id},{$set:{pinnedPostId:null}});
  res.json({pinned:req.body.pinned});
});
router.post('/:postId/reactions',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  const updated=await Post.updateOne({_id:p._id,deleted:false,$or:[{'reactions.999':{$exists:false}},{reactions:req.familyUser._id}]},{$addToSet:{reactions:req.familyUser._id}});
  if(!updated.matchedCount)return fail(res,409,'Reaction limit reached or post removed.');res.status(204).end();
});
router.delete('/:postId/reactions',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  await Post.updateOne({_id:p._id,deleted:false},{$pull:{reactions:req.familyUser._id}});res.status(204).end();
});
router.get('/:postId/comments',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  const page=pagination(req.query);if(!page)return fail(res,400,'Invalid pagination.');
  const rows=await Comment.find({$and:[{postId:p._id},page.filter]}).sort({createdAt:-1,_id:-1}).limit(page.limit+1);
  res.json({comments:rows.slice(0,page.limit).map(c=>({id:String(c._id),authorName:c.authorName,text:c.text,createdAt:c.createdAt})),nextCursor:rows.length>page.limit?cursor(rows[page.limit-1]):null});
});
router.post('/:postId/comments',async(req,res)=>{
  const p=await visible(req,res);if(!p)return;
  if(!req.body || Object.keys(req.body).length!==1 || typeof req.body.text!=='string' || !req.body.text.trim() || req.body.text.length>500)return fail(res,400,'Comment must contain 1–500 plain-text characters.');
  const c=await Comment.create({postId:p._id,familyId:req.params.familyId,authorId:req.familyUser._id,authorName:req.familyUser.name,text:req.body.text.trim()});
  res.status(201).json({comment:{id:String(c._id),authorName:c.authorName,text:c.text,createdAt:c.createdAt}});
});
module.exports=router;
