import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {createApp} from '../server.mjs';
test('two remote players: joins, privacy, turns, CAS and restart recovery',async()=>{
 const dataDir=mkdtempSync(path.join(tmpdir(),'three-card-test-'));let app=createApp({dataDir});let base;
 async function listen(){app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base='http://127.0.0.1:'+app.server.address().port;}
 async function post(body,token){const r=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Player-Token':token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
 try{
  await listen();assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/server.mjs')).status,404);assert.equal((await fetch(base+'/healthz')).status,200);
  let r=await post({type:'create'});assert.equal(r.status,200);const code=r.data.state.code,host=r.data.token;
  assert.equal((await fetch(base+'/api/room?code='+code)).status,403);
  r=await post({type:'join',code});assert.equal(r.status,200);const friend=r.data.token;let rev=r.data.state.revision;
  assert.equal((await post({type:'join',code})).status,409);
  r=await post({type:'action',code,revision:rev,action:'deal'},host);assert.equal(r.status,200);rev=r.data.state.revision;assert(r.data.state.hands.flat().every(x=>x===null));
  assert.equal((await post({type:'action',code,revision:rev,action:'look'},friend)).status,400);
  const pair=await Promise.all([post({type:'action',code,revision:rev,action:'look'},host),post({type:'action',code,revision:rev,action:'look'},host)]);assert.deepEqual(pair.map(x=>x.status).sort(),[200,409]);
  r=pair.find(x=>x.status===200);rev=r.data.state.revision;assert(r.data.state.hands[0].every(Boolean));assert(r.data.state.hands[1].every(x=>x===null));
  let v=await(await fetch(base+'/api/room?code='+code,{headers:{'X-Player-Token':friend}})).json();assert(v.hands.flat().every(x=>x===null));assert(!JSON.stringify(v).includes(host));
  await app.close();app=createApp({dataDir});await listen();
  v=await(await fetch(base+'/api/room?code='+code,{headers:{'X-Player-Token':host}})).json();assert.equal(v.revision,rev);assert(v.hands[0].every(Boolean));
  r=await post({type:'action',code,revision:rev,action:'open'},host);assert.equal(r.status,200);assert.equal(r.data.state.active,false);assert.equal(r.data.state.banks[0]+r.data.state.banks[1],2000);assert(r.data.state.hands.flat().every(Boolean));
  rev=r.data.state.revision;const before=r.data.state.banks;r=await post({type:'action',code,revision:rev,action:'reset'},host);assert.deepEqual(r.data.state.banks,before);r=await post({type:'action',code,revision:r.data.state.revision,action:'reset'},friend);assert.deepEqual(r.data.state.banks,[1000,1000]);
 }finally{await app.close();rmSync(dataDir,{recursive:true,force:true});}
});
