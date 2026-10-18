import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server.mjs';

test('two clients: partial card privacy, equal prices, fold reveal, retained settlement, next-deal reset, guest dealer, CAS and recovery',async()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'three-card-test-'));let app=createApp({dataDir}),base;
 async function listen(){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base='http://127.0.0.1:'+app.server.address().port;}
 async function post(body,token){const r=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 async function get(code,token){return await(await fetch(base+'/api/room?code='+code,{headers:{'X-Player-Token':token}})).json();}
 try{
  await listen();assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/server.mjs')).status,404);assert.equal((await fetch(base+'/healthz')).status,200);
  let r=await post({type:'create'});assert.equal(r.status,200);const code=r.data.state.code,host=r.data.token;
  assert.deepEqual(r.data.state.banks,[0,0]);assert.equal(r.data.state.pot,0);
  assert.equal((await fetch(base+'/api/room?code='+code)).status,403);
  r=await post({type:'join',code});assert.equal(r.status,200);const friend=r.data.token;let state=r.data.state;
  assert.equal((await post({type:'join',code})).status,409);
  const act=async(a,t)=>{const r=await post({type:'action',code,revision:state.revision,action:a},t);assert.equal(r.status,200,JSON.stringify(r.data));state=r.data.state;return state;};
  await act('deal',host);assert.equal(state.turn,1);assert.equal(state.dealer,0);assert.equal(state.pot,0);assert.deepEqual(state.banks,[0,0]);assert(state.hands.flat().every(x=>x===null));
  assert.equal((await post({type:'action',code,revision:state.revision,action:'look1'},host)).status,400);
  const pair=await Promise.all([post({type:'action',code,revision:state.revision,action:'look1'},friend),post({type:'action',code,revision:state.revision,action:'look1'},friend)]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,409]);
  state=pair.find(x=>x.status===200).data.state;
  assert.equal(state.hands[1].filter(Boolean).length,1);assert.equal(state.types[1],'');assert(state.hands[0].every(x=>x===null));assert.equal(state.turn,1);assert.equal(state.pot,0);
  let v=await get(code,host);assert(v.hands.flat().every(x=>x===null));assert(!JSON.stringify(v).includes(friend));
  const first=state.hands[1][0];await app.close();app=createApp({dataDir});await listen();v=await get(code,friend);assert.equal(v.revision,state.revision);assert.deepEqual(v.hands[1][0],first);assert.equal(v.hands[1].filter(Boolean).length,1);
  await act('look2',friend);assert.equal(state.hands[1].filter(Boolean).length,2);assert.equal(state.types[1],'');assert.deepEqual(state.hands[1][0],first);
  await act('look3',friend);assert.equal(state.hands[1].filter(Boolean).length,3);assert(state.types[1]);await act('follow',friend);assert.equal(state.pot,10);assert.deepEqual(state.banks,[0,10]);
  await act('fold',host);assert.equal(state.winner,1);assert.equal(state.dealer,1);assert.equal(state.active,false);assert(state.hands.flat().every(Boolean));assert.deepEqual(state.banks,[0,10]);assert.equal(state.pot,10);assert.equal(state.lastPot,10);assert((await get(code,host)).hands.flat().every(Boolean));
  await app.close();app=createApp({dataDir});await listen();
  for(const token of [host,friend]){const v=await get(code,token);assert.deepEqual(v.banks,[0,10]);assert.equal(v.pot,10);assert(v.hands.flat().every(Boolean));}
  assert.equal((await post({type:'action',code,revision:state.revision,action:'deal'},host)).status,400);
  await act('deal',friend);assert.equal(state.turn,0);assert.equal(state.pot,0);assert.deepEqual(state.banks,[0,0]);assert(state.hands.flat().every(x=>x===null));
  await act('follow',host);assert.equal(state.pot,10);
  await act('look2',friend);assert(state.hands[0].every(x=>x===null));await act('follow',friend);assert.equal(state.pot,20);assert.deepEqual(state.banks,[10,10]);
  await act('raise',host);assert.equal(state.base,20);assert.equal(state.pot,40);
  await act('open',friend);assert.equal(state.lastPot,60);assert.deepEqual(state.lastBets,[30,30]);assert.equal(state.active,false);assert(state.hands.flat().every(Boolean));assert.deepEqual(state.banks,[30,30]);assert.equal(state.pot,60);
  const wins=[...state.stats];await act('reset',host);assert.deepEqual(state.stats,wins);await act('reset',friend);assert.deepEqual(state.banks,[0,0]);assert.deepEqual(state.stats,[0,0,0]);assert.equal(state.dealer,0);
 }finally{await app.close();rmSync(dataDir,{recursive:true,force:true});}
});
