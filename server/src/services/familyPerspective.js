const same=(a,b)=>String(a)===String(b);
const label=(kind,gender)=>kind==='coParent'?'Co-parent':({parent:{male:'Father',female:'Mother',neutral:'Parent'},child:{male:'Son',female:'Daughter',neutral:'Child'},partner:{male:'Husband',female:'Wife',neutral:'Partner'},sibling:{male:'Brother',female:'Sister',neutral:'Sibling'}})[kind]?.[gender]||'Family member';
function expandedEdges(people,edges){
 const parent=new Map(people.map(p=>[String(p._id),String(p._id)]));
 const root=id=>{id=String(id);if(!parent.has(id))return id;while(parent.get(id)!==id)id=parent.get(id);return id;};
 for(const e of edges.filter(e=>e.type==='sibling')){const a=root(e.fromPersonId),b=root(e.toPersonId);if(parent.has(a)&&parent.has(b))parent.set(b,a);}
 const groups=new Map();for(const p of people){const key=root(p._id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p._id);}
 const result=[...edges];const add=e=>{if(!result.some(x=>x.type===e.type&&same(x.fromPersonId,e.fromPersonId)&&same(x.toPersonId,e.toPersonId)))result.push(e);};
 for(const group of groups.values())if(group.length>1){
  const parents=[...new Set(edges.filter(e=>e.type==='parent'&&group.some(id=>same(e.toPersonId,id))).map(e=>String(e.fromPersonId)))];
  if(parents.length>2||parents.some(id=>group.some(member=>same(member,id))))continue;
  const genders=parents.map(id=>people.find(p=>same(p._id,id))?.gender);if(['male','female'].some(g=>genders.filter(value=>value===g).length>1))continue;
  for(const member of group)for(const ancestor of parents)add({fromPersonId:ancestor,toPersonId:member,type:'parent'});
  for(let a=0;a<group.length;a++)for(let b=a+1;b<group.length;b++)add({fromPersonId:group[a],toPersonId:group[b],type:'sibling'});
 }
 return result;
}
function perspective(people,edges,ownerId){
 edges=expandedEdges(people,edges);
 const parents=id=>new Set(edges.filter(e=>e.type==='parent'&&same(e.toPersonId,id)).map(e=>String(e.fromPersonId)));
 const ownerParents=parents(ownerId);
 return people.map(p=>{const self=same(p._id,ownerId);const e=edges.find(e=>same(e.fromPersonId,ownerId)&&same(e.toPersonId,p._id)||same(e.toPersonId,ownerId)&&same(e.fromPersonId,p._id));let kind=e?.type==='parent'?(same(e.fromPersonId,ownerId)?'child':'parent'):e?.type;
 if(!kind&&!self){const other=parents(p._id);if(ownerParents.size===2&&other.size===2&&[...ownerParents].every(id=>other.has(id)))kind='sibling';}
 if(!kind&&!self){const children=new Set(edges.filter(e=>e.type==='parent'&&same(e.fromPersonId,ownerId)).map(e=>String(e.toPersonId)));if(edges.some(e=>e.type==='parent'&&same(e.fromPersonId,p._id)&&children.has(String(e.toPersonId))))kind='coParent';}
 return {...p,id:String(p._id),kind:self?null:kind||null,relationship:self?'Self':label(kind,p.gender),group:['parent','sibling'].includes(kind)?'bornIn':['partner','child','coParent'].includes(kind)?'formed':null};});
}
module.exports={perspective};
