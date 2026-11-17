'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./club-engines/landlord.cjs'),{buildServer}=require('./server.cjs');
const tokens=['a','b','c'].map(c=>c.repeat(64)),names=['甲','乙','丙'];
const cards=rs=>{const counts={};return rs.map(r=>r>=16?r+36:r-3+13*((counts[r]=(counts[r]||0)+1)-1));};
const pattern=rs=>G.classify(cards(rs));
function initial(){return G.initial(tokens.slice(),names.slice());}
const act=(s,i,a)=>G.act(s,i,{...a,round:s.round});
function playing(){const s=initial();act(s,0,{type:'start'});act(s,s.turn,{type:'call',yes:true});while(s.phase==='grabbing')act(s,s.turn,{type:'grab',yes:false});for(let i=0;i<3;i++)act(s,i,{type:'double',yes:false});return s;}
test('all classic card types are recognized; malformed and disallowed sequences are rejected',()=>{
 const cases=[[[3],'single'],[[15,15],'pair'],[[6,6,6],'triple'],[[7,7,7,4],'tripleSingle'],[[7,7,7,4,4],'triplePair'],[[3,4,5,6,7],'straight'],[[12,13,14,10,11],'straight'],[[3,3,4,4,5,5],'pairStraight'],[[3,3,3,4,4,4],'plane'],[[3,3,3,4,4,4,8,9],'planeSingle'],[[3,3,3,4,4,4,8,8],'planeSingle'],[[3,3,3,4,4,4,8,8,9,9],'planePair'],[[7,7,7,7,3,4],'fourSingle'],[[7,7,7,7,3,3],'fourSingle'],[[7,7,7,7,3,3,4,4],'fourPair'],[[7,7,7,7],'bomb'],[[16,17],'rocket']];
 for(const [rs,type]of cases)assert.equal(pattern(rs)?.type,type,rs.join(','));
 for(const rs of [[],[3,4,5,6],[11,12,13,14,15],[3,3,4,4],[14,14,14,15,15,15],[3,3,3,4,4,4,16,17],[3,3,3,3,4,4,4,7],[7,7,7,7,16,17],[7,7,7,7,3,3,3,3]])assert.equal(pattern(rs),null,rs.join(','));
 for(const bad of [[0,0],[-1],[54],['3'],null])assert.equal(G.classify(bad),null);
});
test('comparison respects type, length, main rank, bombs and the unbeatable rocket',()=>{
 assert.ok(G.beats(pattern([5]),pattern([4])));assert.ok(!G.beats(pattern([5,5]),pattern([4])));assert.ok(!G.beats(pattern([3,4,5,6,7,8]),pattern([3,4,5,6,7])));
 assert.ok(G.beats(pattern([6,6,6,3,3]),pattern([5,5,5,14,14])));assert.ok(G.beats(pattern([3,3,3,3]),pattern([17])));assert.ok(G.beats(pattern([4,4,4,4]),pattern([3,3,3,3])));assert.ok(G.beats(pattern([16,17]),pattern([15,15,15,15])));assert.ok(!G.beats(pattern([15,15,15,15]),pattern([16,17])));
});
test('hints find every legal rank combination on representative hands and always obey comparisons',()=>{
 const hands=[[3,3,3,3,4,4,4,5,5,6,7,8],[3,3,4,4,5,5,6,6,7,7,8,8],[10,10,10,11,11,11,12,12,13,13,16,17]];
 const key=cs=>cs.map(G.rank).sort((a,b)=>a-b).join(',');
 for(const rs of hands){const hand=cards(rs);for(const target of [null,pattern([3]),pattern([3,3]),pattern([3,3,3,4,4,4,8,9]),pattern([3,4,5,6,7]),pattern([4,4,4,4])]){
  const expected=new Set();for(let mask=1;mask<1<<hand.length;mask++){const cs=hand.filter((_,i)=>mask&(1<<i)),p=G.classify(cs);if(G.beats(p,target))expected.add(key(cs));}
  const actual=G.moves(hand,target);assert.deepEqual(new Set(actual.map(m=>key(m.cards))),expected);for(const m of actual)assert.ok(G.beats(G.classify(m.cards),target));
 }}
});
test('deal is private and complete, all-pass redeals, caller has final grab and skipped callers cannot grab',()=>{
 const s=initial();assert.throws(()=>act(s,1,{type:'start'}));act(s,0,{type:'start'});assert.deepEqual(s.hands.map(cs=>cs.length),[17,17,17]);assert.equal(new Set([...s.hands.flat(),...s.bottom]).size,54);
 const v=G.view(s,1,'123456',[Date.now(),Date.now(),Date.now()]);assert.ok(v.hands[1].every(Number.isInteger));assert.ok(v.hands[0].every(c=>c===null));assert.ok(v.bottom.every(c=>c===null));assert.ok(!JSON.stringify(v).includes(tokens[0]));
 const original=s.hands.flat().join();for(let i=0;i<3;i++)act(s,s.turn,{type:'call',yes:false});assert.equal(s.phase,'calling');assert.equal(s.redeals,1);assert.notEqual(s.hands.flat().join(),original);assert.equal(s.turn,1);
 act(s,1,{type:'call',yes:false});act(s,2,{type:'call',yes:true});assert.equal(s.turn,0);act(s,0,{type:'grab',yes:true});assert.equal(s.turn,2);act(s,2,{type:'grab',yes:true});assert.equal(s.phase,'doubling');assert.equal(s.landlord,2);assert.equal(s.multiplier,4);assert.deepEqual(s.hands.map(cs=>cs.length),[17,17,20]);assert.ok(G.view(s,0,'x',[0,0,0]).bottom.every(Number.isInteger));assert.ok(G.view(s,0,'x',[0,0,0]).hands[2].every(c=>c===null));
});
test('doubling is per player, landlord may reveal, illegal actions do not change the state',()=>{
 const s=initial();act(s,0,{type:'start'});act(s,0,{type:'call',yes:true});act(s,1,{type:'grab',yes:false});act(s,2,{type:'grab',yes:false});assert.equal(s.phase,'doubling');
 const snapshot=JSON.stringify(s);assert.throws(()=>act(s,1,{type:'double',yes:false,open:true}));assert.equal(JSON.stringify(s),snapshot);act(s,0,{type:'double',yes:true,open:true});assert.equal(s.multiplier,2);assert.ok(G.view(s,1,'x',[0,0,0]).hands[0].every(Number.isInteger));assert.throws(()=>act(s,0,{type:'double',yes:true}));act(s,1,{type:'double',yes:false});act(s,2,{type:'double',yes:true});assert.equal(s.phase,'playing');assert.deepEqual(s.doubles,[2,1,2]);assert.equal(s.turn,0);
});
test('two passes restore the lead; ownership, turn, bad patterns and underplays are enforced without mutation',()=>{
 const s=playing();s.hands=[cards([3,4,5]),cards([4,6]),cards([7,8])];const noMutation=fn=>{const before=JSON.stringify(s);assert.throws(fn);assert.equal(JSON.stringify(s),before);};
 noMutation(()=>act(s,0,{type:'pass'}));noMutation(()=>act(s,1,{type:'play',cards:[s.hands[1][0]]}));noMutation(()=>act(s,0,{type:'play',cards:[53]}));noMutation(()=>act(s,0,{type:'play',cards:s.hands[0].slice(0,2)}));
 act(s,0,{type:'play',cards:[s.hands[0][1]]});noMutation(()=>act(s,1,{type:'play',cards:[s.hands[1][0]]}));act(s,1,{type:'pass'});act(s,2,{type:'pass'});assert.equal(s.turn,0);assert.equal(s.lastPlay,null);assert.equal(s.phase,'playing');assert.ok(s.table.every(v=>v===null));
});
test('bombs, rockets, spring and reverse spring multiply exactly once and settlement is zero-sum',()=>{
 const s=playing();s.hands=[cards([3,3,3,3]),cards([4]),cards([5])];s.doubles=[2,1,2];act(s,0,{type:'play',cards:s.hands[0].slice()});assert.equal(s.spring,'春天');assert.equal(s.multiplier,4);assert.deepEqual(s.delta,[24,-8,-16]);const saved=JSON.stringify(s);assert.throws(()=>act(s,0,{type:'play',cards:[0]}));assert.equal(JSON.stringify(s),saved);
 const t=playing();t.hands=[cards([3,4]),cards([5]),cards([6])];act(t,0,{type:'play',cards:[t.hands[0][0]]});act(t,1,{type:'play',cards:t.hands[1].slice()});assert.equal(t.spring,'反春天');assert.deepEqual(t.delta,[-4,2,2]);assert.equal(t.delta.reduce((a,b)=>a+b),0);
 const u=playing();u.hands=[cards([16,17,3]),cards([4]),cards([5])];act(u,0,{type:'play',cards:[52,53]});assert.equal(u.multiplier,2);act(u,1,{type:'pass'});act(u,2,{type:'pass'});act(u,0,{type:'play',cards:u.hands[0].slice()});assert.equal(u.multiplier,4);
});
test('randomized full games finish and conserve cards, hand privacy, legal hints and score totals',()=>{
 for(let n=0;n<15;n++){
  const s=playing();let steps=0;while(s.phase==='playing'&&steps++<500){const i=s.turn,hints=G.moves(s.hands[i],s.lastPlay?.pattern);if(s.lastPlay&&(!hints.length||Math.random()<.3))act(s,i,{type:'pass'});else{assert.ok(hints.length);const h=hints[Math.floor(Math.random()*Math.min(5,hints.length))];act(s,i,{type:'play',cards:h.cards});}
   assert.equal(new Set(s.hands.flat()).size,s.hands.flat().length);if(s.phase==='playing'){const v=G.view(s,i,'x',[0,0,0]);for(let j=0;j<3;j++)if(j!==i)assert.ok(v.hands[j].every(c=>c===null));}
  }assert.ok(steps<500);assert.equal(s.phase,'ended');assert.equal(s.hands[s.winner].length,0);assert.equal(s.scores.reduce((a,b)=>a+b),0);assert.ok(G.view(s,0,'x',[0,0,0]).hands.flat().every(Number.isInteger));
 }
});
test('three-client HTTP integration covers private state, retries, stale revisions, switching, SSE and score persistence',async()=>{
 const server=buildServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let code,room,id=0;const controllers=[];
 async function api(route,body,seat=0){const response=await fetch(base+'/club-api/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+tokens[seat],...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,v:await response.json()};}
 const get=async i=>(await api('game/landlord/state?code='+code,null,i)).v;
 const send=async(i,a,overrides={})=>{const s=await get(i);return api('game/landlord/action',{code,epoch:room.epoch,id:'ddz-'+(++id),rev:s.rev,action:{...a,round:s.round},...overrides},i);};
 const select=async game=>{const r=await api('select',{code,rev:room.rev,id:'pick-'+(++id),game});assert.equal(r.status,200,JSON.stringify(r.v));room=r.v;};
 try{
  room=(await api('create',{token:tokens[0],playerCount:3})).v;code=room.code;room=(await api('join',{code,token:tokens[1]},1)).v;assert.equal((await api('select',{code,rev:room.rev,id:'early',game:'landlord'})).status,400);room=(await api('join',{code,token:tokens[2]},2)).v;await select('landlord');assert.equal((await send(1,{type:'start'})).status,400);
  const before=await get(0),body={code,epoch:room.epoch,id:'start-once',rev:before.rev,action:{type:'start',round:0}};let r=await api('game/landlord/action',body);assert.equal(r.status,200);const first=r.v;assert.deepEqual((await api('game/landlord/action',body)).v.hands,first.hands);assert.equal((await send(0,{type:'call',yes:true},{rev:before.rev})).status,409);
  for(let i=0;i<3;i++){const s=await get(i);assert.equal(s.you,i);assert.ok(s.hands[i].every(Number.isInteger));assert.ok(s.hands[(i+1)%3].every(c=>c===null));}
  const ctl=new AbortController();controllers.push(ctl);const stream=await fetch(base+'/club-api/events?code='+code,{headers:{Authorization:'Bearer '+tokens[2]},signal:ctl.signal});const reader=stream.body.getReader();let buffer='';async function next(){for(;;){const k=buffer.indexOf('\n\n');if(k>=0){const part=buffer.slice(0,k);buffer=buffer.slice(k+2);const line=part.split('\n').find(l=>l.startsWith('data: '));if(line)return JSON.parse(line.slice(6));}else{const chunk=await reader.read();buffer+=new TextDecoder().decode(chunk.value);}}}await next();
  assert.equal((await send(0,{type:'call',yes:true})).status,200);const pushed=await next();assert.equal(pushed.game,'landlord');assert.equal(pushed.state.you,2);assert.ok(pushed.state.hands[0].every(c=>c===null));ctl.abort();await reader.cancel().catch(()=>{});
  while((await get(0)).phase==='grabbing'){const s=await get(0);assert.equal((await send(s.turn,{type:'grab',yes:false})).status,200);}for(let i=0;i<3;i++)assert.equal((await send(i,{type:'double',yes:false})).status,200);
  const saved=await get(0),oldEpoch=room.epoch;await select('card');await select('landlord');assert.deepEqual((await get(0)).hands,saved.hands);assert.equal((await send(saved.turn,{type:'pass'},{epoch:oldEpoch})).status,409);
  let steps=0;while((await get(0)).phase==='playing'&&steps++<300){const publicState=await get(0),i=publicState.turn,s=await get(i),hints=G.moves(s.hands[i],s.lastPlay?.pattern),a=hints.length?{type:'play',cards:hints[0].cards}:{type:'pass'};r=await send(i,a);assert.equal(r.status,200,JSON.stringify(r.v));}const end=await get(0);assert.equal(end.phase,'ended');assert.equal(end.scores.reduce((a,b)=>a+b),0);await select(null);await select('landlord');assert.deepEqual((await get(2)).scores,end.scores);
  for(const asset of ['','app.js','rules.js','style.css'])assert.equal((await fetch(base+'/club-game/landlord/'+asset)).status,200);
  await api('leave',{code});code=null;
  room=(await api('create',{token:tokens[0],playerCount:2})).v;code=room.code;room=(await api('join',{token:tokens[1],code},1)).v;assert.equal((await api('select',{code,rev:room.rev,id:'wrong-mode',game:'landlord'})).status,400);
 }finally{for(const ctl of controllers)ctl.abort();if(code)await api('leave',{code});server.closeAllConnections();await new Promise(r=>server.close(r));}
});
