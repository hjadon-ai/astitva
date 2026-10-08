const test=require('node:test');const assert=require('node:assert/strict');
const {parsePost,validPhoto,pagination,canSee}=require('../src/services/familySocial');
const a='a'.repeat(24), b='b'.repeat(24);
const family={people:[{userId:a,status:'ACCEPTED'},{userId:b,status:'PENDING'}]};
test('audiences reject pending, duplicates, unknown fields and invalid shapes',()=>{
  const base={text:'hello',type:'update',audience:'selected',recipientIds:[b]};
  assert.equal(parsePost(base,family,a),null);
  family.people[1].status='ACCEPTED';assert.ok(parsePost(base,family,a));
  for(const body of [{...base,recipientIds:[b,b]},{...base,type:'bad'},{...base,authorId:b},{...base,text:'x'.repeat(2001)},{...base,recipientIds:[]},{...base,audience:'family'}])assert.equal(parsePost(body,family,a),null);
  assert.equal(canSee({authorId:a,audience:'selected',recipientIds:[b],deleted:false},'c'.repeat(24)),false);
  assert.equal(canSee({authorId:a,audience:'family',recipientIds:[],deleted:true},a),false);
});
test('photo signatures and bounded pagination reject unsafe inputs',()=>{
  assert.equal(validPhoto({size:10,mimetype:'image/png',buffer:Buffer.from('<svg/>')}),false);
  assert.equal(validPhoto({size:3*1024*1024,mimetype:'image/jpeg',buffer:Buffer.from([255,216,255,217])}),false);
  for(const q of [{limit:'0'},{limit:'51'},{before:'broken'},{limit:'1.5'},{path:'/tmp'}])assert.equal(pagination(q),null);
  assert.equal(pagination({}).limit,20);
});
