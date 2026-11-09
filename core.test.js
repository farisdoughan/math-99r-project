import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responses,neighborhood} from './core.js';
test('constant images have zero response, including padded boundaries',()=>{for(const a of Object.values(responses(new Uint8Array(20).fill(90),5,4)))assert.ok(a.every(v=>v===0));});
test('vertical boundary has horizontal response and zero vertical response',()=>{const a=responses([0,0,255,0,0,255,0,0,255],3,3);assert.equal(a.x[4],1020);assert.equal(a.y[4],0);assert.equal(a.central[4],127.5);assert.equal(a.magnitude[4],1020);});
test('horizontal boundary has vertical response and zero horizontal response',()=>{const a=responses([0,0,0,0,0,0,255,255,255],3,3);assert.equal(a.x[4],0);assert.equal(a.y[4],1020);});
test('replicate padding repeats corner values',()=>assert.deepEqual(neighborhood([1,2,3,4],2,2,0,0),[1,1,2,1,1,2,3,3,4]));
test('reversing contrast reverses signed responses but preserves magnitude',()=>{const data=[0,20,40,60,80,100,120,140,160],a=responses(data,3,3),b=responses(data.map(v=>255-v),3,3);for(let i=0;i<9;i++){assert.equal(a.x[i],-b.x[i]);assert.equal(a.y[i],-b.y[i]);assert.equal(a.magnitude[i],b.magnitude[i]);}});
