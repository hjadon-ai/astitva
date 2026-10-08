import test from 'node:test';
import assert from 'node:assert/strict';
import {homeFeatures} from '../src/homeFeatures.js';
test('Home exposes only explicitly enabled destinations, never Chat',()=>{
  assert.deepEqual(homeFeatures(undefined,undefined),{family:false,tools:[]});
  const result=homeFeatures({family:true,diet:true,priorities:false,finance:true,chat:true},{financeProvider:{enabled:true}});
  assert.equal(result.family,true);assert.deepEqual(result.tools.map(t=>t.id),['diet','finance']);assert.ok(result.tools.every(t=>t.available));
  assert.equal(homeFeatures({family:false},{}).family,false);
});
test('Finance permission does not invent runtime availability',()=>{
  for(const runtime of [undefined,{}, {financeProvider:{enabled:false}}])assert.equal(homeFeatures({finance:true},runtime).tools[0].available,false);
  assert.equal(homeFeatures({finance:false},{financeProvider:{enabled:true}}).tools.length,0);
});
