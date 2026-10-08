const test=require('node:test'),assert=require('node:assert/strict');
const {familyData}=require('../src/services/sharedWorkspace');
test('shared tree uses selected owner perspective and only granted people',()=>{
 const people=[{_id:'a',userId:'ua',name:'Father',gender:'male'},{_id:'b',userId:'ub',name:'Selected',gender:'female'},{_id:'c',name:'Son',gender:'male'},{_id:'d',name:'Hidden',gender:'female'},{_id:'e',name:'Other'}];
 const f={_id:'unit',people,relations:[{from:'a',to:'b',type:'parent'},{from:'b',to:'c',type:'parent'}],shares:[{ownerId:'ub',recipientId:'ua',feature:'family',visiblePersonIds:['a','b','c','e']}]};
 const data=familyData(f,people[1],{_id:'ua'});assert.equal(data.perspectivePersonId,'b');assert.equal(data.people.find(p=>p.id==='b').relationship,'Self');assert.equal(data.people.find(p=>p.id==='a').relationship,'Father');assert.equal(data.people.find(p=>p.id==='a').group,'bornIn');assert.equal(data.people.find(p=>p.id==='c').relationship,'Son');assert.equal(data.people.find(p=>p.id==='c').group,'formed');assert.equal(data.people.find(p=>p.id==='e').group,null);assert.equal(data.people.some(p=>p.id==='d'),false);assert.deepEqual(data.contexts,['bornIn','formed']);
 f.shares[0].visiblePersonIds=['a','b'];assert.deepEqual(familyData(f,people[1],{_id:'ua'}).contexts,['bornIn']);
});
test('full-sibling and parent selections retain generation layout without inventing partners',()=>{
 const {perspective}=require('../src/services/familyPerspective');const people=[{_id:'father',gender:'male'},{_id:'mother',gender:'female'},{_id:'self',gender:'male'},{_id:'brother',gender:'male'},{_id:'sister',gender:'female'}];const edges=[{fromPersonId:'father',toPersonId:'self',type:'parent'},{fromPersonId:'mother',toPersonId:'self',type:'parent'},{fromPersonId:'self',toPersonId:'brother',type:'sibling'},{fromPersonId:'self',toPersonId:'sister',type:'sibling'}];
 const sibling=perspective(people,edges,'brother');assert.equal(sibling.find(p=>p.id==='father').relationship,'Father');assert.equal(sibling.find(p=>p.id==='mother').relationship,'Mother');assert.equal(sibling.find(p=>p.id==='sister').relationship,'Sister');
 const mother=perspective(people,edges,'mother');assert.equal(mother.find(p=>p.id==='brother').relationship,'Son');assert.equal(mother.find(p=>p.id==='sister').relationship,'Daughter');assert.equal(mother.find(p=>p.id==='father').relationship,'Co-parent');
});

test('every generation has consistent inverse relationships and sibling placement',()=>{
 const {perspective}=require('../src/services/familyPerspective');
 const people=[{_id:'dad',gender:'male'},{_id:'mum',gender:'female'},{_id:'son',gender:'male'},{_id:'daughter',gender:'female'}];
 const edges=[{fromPersonId:'dad',toPersonId:'mum',type:'partner'},...['dad','mum'].flatMap(parent=>['son','daughter'].map(child=>({fromPersonId:parent,toPersonId:child,type:'parent'})))];
 const expected={dad:{mum:'Wife',son:'Son',daughter:'Daughter'},mum:{dad:'Husband',son:'Son',daughter:'Daughter'},son:{dad:'Father',mum:'Mother',daughter:'Sister'},daughter:{dad:'Father',mum:'Mother',son:'Brother'}};
 for(const owner of people){const rows=perspective(people,edges,owner._id);assert.equal(rows.filter(p=>p.relationship==='Self').length,1);for(const [id,label] of Object.entries(expected[owner._id]))assert.equal(rows.find(p=>p.id===id).relationship,label);}
});

test('co-parents appear in Blossoms from both perspectives without inventing marriage',()=>{
 const {perspective}=require('../src/services/familyPerspective');const people=[{_id:'dad',gender:'male'},{_id:'mum',gender:'female'},{_id:'child',gender:'male'}];const edges=['dad','mum'].map(parent=>({fromPersonId:parent,toPersonId:'child',type:'parent'}));
 for(const [owner,other] of [['dad','mum'],['mum','dad']]){const rows=perspective(people,edges,owner);const co=rows.find(p=>p.id===other);assert.equal(co.relationship,'Co-parent');assert.equal(co.group,'formed');assert.equal(rows.find(p=>p.id==='child').relationship,'Son');}
});
