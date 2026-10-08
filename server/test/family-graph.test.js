const test=require('node:test');const assert=require('node:assert/strict');const G=require('../src/services/familyGraph');
test('parent direction and contextual placement are relative to people',()=>{
 assert.deepEqual(G.edge('a','b','father'),{fromPersonId:'b',toPersonId:'a',type:'parent'});
 assert.deepEqual(G.contexts('a',[G.edge('a','c','son')]),['formed']);
 assert.deepEqual(G.contexts('c',[G.edge('a','c','son')]),['bornIn']);
 assert.equal(G.contextFor('sister'),'bornIn');assert.equal(G.higherRole('READONLY','EDITOR'),'EDITOR');assert.equal(G.higherRole('EDITOR','ADMIN'),'ADMIN');
});
test('graph validation blocks cycles, self edges, incompatible partners and ancestral partners',()=>{
 assert.match(G.validateGraph([G.edge('a','b','son'),G.edge('b','a','son')]),/cycle/);
 assert.match(G.validateGraph([G.edge('a','a','sibling')]),/themselves/);
 assert.match(G.validateGraph([G.edge('a','b','wife'),G.edge('a','b','sister')]),/conflict/);
 assert.match(G.validateGraph([G.edge('a','b','wife'),G.edge('a','c','wife')]),/one current partner/);
 assert.match(G.validateGraph([G.edge('a','b','son'),G.edge('b','c','son'),G.edge('a','c','wife')]),/ancestor/);
});
test('explicit partner relation shares child edges without person deduplication or sibling inference',()=>{
 const edges=G.sharedChildren([G.edge('a','c1','son'),G.edge('b','c2','son'),G.edge('a','b','wife')]);
 assert.equal(edges.filter(e=>e.type==='parent').length,4);
 assert.equal(edges.some(e=>e.type==='sibling'),false);assert.equal(G.validateGraph(edges),null);
});
