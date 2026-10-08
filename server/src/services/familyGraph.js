const labels = {
 father:['parent','male'],mother:['parent','female'],parent:['parent','neutral'],
 brother:['sibling','male'],sister:['sibling','female'],sibling:['sibling','neutral'],
 husband:['partner','male'],wife:['partner','female'],partner:['partner','neutral'],
 son:['child','male'],daughter:['child','female'],child:['child','neutral']
};
const same=(a,b)=>String(a)===String(b);
const contextFor=label=>['parent','sibling'].includes(labels[label]?.[0])?'bornIn':'formed';
function edge(from,to,label) {
 const kind=labels[label]?.[0]; if(!kind)throw new Error('Unknown relationship.');
 let type=kind==='child'?'parent':kind;
 if(kind==='parent')[from,to]=[to,from];
 if(type!=='parent' && String(from)>String(to))[from,to]=[to,from];
 return {fromPersonId:from,toPersonId:to,type};
}
function validateGraph(edges) {
 const adjacency=new Map(),partners=new Map(),seen=new Set(),pairKinds=new Map();
 for(const e of edges){
  const a=String(e.fromPersonId),b=String(e.toPersonId);
  if(a===b)return 'A person cannot be related to themselves.';
  const pair=e.type==='parent'?`${a}:${b}`:[a,b].sort().join(':');
  const undirected=[a,b].sort().join(':');const kinds=pairKinds.get(undirected)||new Set();kinds.add(e.type);pairKinds.set(undirected,kinds);
  if(kinds.has('partner')&&kinds.has('sibling'))return 'Partner and sibling relationships conflict.';
  if(seen.has(`${pair}:${e.type}`))continue; seen.add(`${pair}:${e.type}`);
  if(e.type==='partner')for(const [x,y]of[[a,b],[b,a]]){
   if(partners.has(x)&&partners.get(x)!==y)return 'A person can have only one current partner.';
   partners.set(x,y);
  }
  if(e.type==='parent'){if(!adjacency.has(a))adjacency.set(a,[]);adjacency.get(a).push(b);}
 }
 const visiting=new Set(),done=new Set();
 function visit(x){if(visiting.has(x))return true;if(done.has(x))return false;visiting.add(x);
  for(const y of adjacency.get(x)||[])if(visit(y))return true;
  visiting.delete(x);done.add(x);return false;}
 for(const x of adjacency.keys())if(visit(x))return 'Parent relationships cannot contain a cycle.';
 for(const e of edges)if(e.type==='partner'||e.type==='sibling'){
  function reaches(a,b,visited=new Set()){if(a===b)return true;if(visited.has(a))return false;visited.add(a);return(adjacency.get(a)||[]).some(y=>reaches(y,b,visited));}
  if(reaches(String(e.fromPersonId),String(e.toPersonId))||reaches(String(e.toPersonId),String(e.fromPersonId)))return 'A partner or sibling cannot also be an ancestor.';
 }
 return null;
}
function sharedChildren(edges){
 const result=[...edges];
 for(const p of edges.filter(e=>e.type==='partner'))for(const e of edges.filter(e=>e.type==='parent')){
  const other=same(e.fromPersonId,p.fromPersonId)?p.toPersonId:same(e.fromPersonId,p.toPersonId)?p.fromPersonId:null;
  if(other&&!result.some(x=>x.type==='parent'&&same(x.fromPersonId,other)&&same(x.toPersonId,e.toPersonId)))result.push({...e,fromPersonId:other});
 }
 return result;
}
const higherRole=(a,b)=>({READONLY:0,EDITOR:1,ADMIN:2}[a]>={READONLY:0,EDITOR:1,ADMIN:2}[b]?a:b);
function contexts(personId,edges,anchors=[]){
 const found=new Set();
 for(const e of edges){if(e.type==='parent'){if(same(e.toPersonId,personId))found.add('bornIn');if(same(e.fromPersonId,personId))found.add('formed');}
 else if(same(e.fromPersonId,personId)||same(e.toPersonId,personId))found.add(e.type==='sibling'?'bornIn':'formed');}
 if(!found.size)for(const a of anchors)if(same(a.personId,personId))found.add(contextFor(a.relationship));
 return [...found];
}
module.exports={labels,same,contextFor,edge,validateGraph,sharedChildren,higherRole,contexts};
