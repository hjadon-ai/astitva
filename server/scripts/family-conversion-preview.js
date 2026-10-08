// Read-only offline planning. No MongoDB connection, writes or automatic conversion.
const fs=require('node:fs');
const G=require('../src/services/familyGraph');
function preview(input){
 if(!input||!Array.isArray(input.families))throw Error('Provide {families:[]} using an owner-approved sanitized export.');
 return {readOnly:true,applySupported:false,families:input.families.map(f=>{
  const people=f.people||[],relations=f.relations||[],self=people.find(p=>String(p.userId)===String(f.creatorId));
  const edges=relations.map(r=>({fromPersonId:r.from,toPersonId:r.to,type:r.type}));
  const issues=[];const bad=G.validateGraph(edges);if(bad)issues.push(bad);
  if(!self)issues.push('Creator identity is missing.');
  if(relations.some(r=>!people.some(p=>String(p._id)===String(r.from))||!people.some(p=>String(p._id)===String(r.to))))issues.push('Dangling relationship reference.');
  const contexts=self?G.contexts(self._id,edges):[];
  if(contexts.length>1)issues.push('Mixed Born-in/Formed graph requires explicit unit partition and reference placement.');
  issues.push('Owner must approve placement of sharing grants, invitations, activity and social references before conversion.');
  return {legacyFamilyId:String(f._id),personMappings:people.map(p=>({legacyPersonId:String(p._id),preserveIdentity:true,linked:!!p.userId})),memberCount:people.length,relationshipCount:relations.length,creatorContexts:contexts,requiresOwnerReview:true,issues};
 })};
}
if(require.main===module){const path=process.argv[2];if(!path){console.error('Usage: node server/scripts/family-conversion-preview.js <sanitized-export.json>');process.exitCode=1;}else console.log(JSON.stringify(preview(JSON.parse(fs.readFileSync(path,'utf8'))),null,2));}
module.exports={preview};
