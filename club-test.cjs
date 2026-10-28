'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {buildServer}=require('./server.cjs');
const A='d'.repeat(64),B='e'.repeat(64),C='f'.repeat(64);
async function fixture(run){const server=buildServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,owned=new Map();async function api(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(route==='/club-api/create'&&r.ok)owned.set(v.code,body.token);return {status:r.status,v};}try{await run(api,base);}finally{for(const[code,token]of owned)await api('/club-api/leave',{code},token);server.closeAllConnections();await new Promise(r=>server.close(r));}}
test('one create and one join allow all four games; same room, identities, states and scores persist across switches',async()=>fixture(async(api)=>{
let room=(await api('/club-api/create',{token:A,name:'甲'})).v;const code=room.code;room=(await api('/club-api/join',{token:B,code,name:'乙'})).v;assert.equal(room.you,1);assert.deepEqual(room.names,['甲','乙']);let id=0;
async function choose(g,t=A){const r=await api('/club-api/select',{code,id:'pick-'+(++id),rev:room.rev,game:g},t);assert.equal(r.status,200,JSON.stringify(r.v));room=r.v;const other=(await api('/club-api/state?code='+code,null,t===A?B:A)).v;assert.equal(other.selected,g);assert.equal(other.code,code);assert.equal(other.epoch,room.epoch);}
async function state(g,t=A){const r=await api('/club-api/game/'+g+'/state?code='+code,null,t);assert.equal(r.status,200);return r.v;}
async function act(g,t,a,s){const r=await api('/club-api/game/'+g+'/action',{code,id:'act-'+(++id),rev:g==='card'?s.revision:s.rev,epoch:room.epoch,action:typeof a==='string'?a:{...a,round:s.round}},t);assert.equal(r.status,200,JSON.stringify(r.v));return r.v;}
await choose('card');let c=await state('card');c=await act('card',A,'deal',c);assert.equal(c.you,0);assert.deepEqual(c.hands[1],[null,null,null]);c=await act('card',B,'follow',c);assert.equal(c.callCost,10);c=await act('card',A,'look3',c);assert.equal(c.callCost,20);assert.ok(c.hands[0].every(x=>x!==null));assert.deepEqual(c.hands[1],[null,null,null]);c=await act('card',A,'fold',c);assert.equal(c.pot,10);assert.ok(c.hands.flat().every(Boolean));const savedCard=JSON.stringify(c.hands);
await choose('tenhalf',B);let t=await state('tenhalf');t=await act('tenhalf',A,{type:'start'},t);assert.equal(t.hands[1][0],null);t=await act('tenhalf',B,{type:'stand'},t);assert.notEqual(t.hands[0][0],null);t=await act('tenhalf',A,{type:'stand'},t);const scores=t.scores.slice(),shoe=t.shoe,remaining=t.remaining;
await choose('dice');let d=await state('dice');d=await act('dice',A,{type:'ready'},d);d=await act('dice',B,{type:'ready'},d);assert.equal(d.phase,'playing');assert.deepEqual(d.dice[0],[null,null,null,null,null]);await new Promise(r=>setTimeout(r,1850));d=await act('dice',A,{type:'open'},d);assert.equal(d.openedBy,0);assert.ok(d.dice.flat().every(Number.isInteger));
await choose(null,B);assert.equal(room.code,code);await choose('card',B);c=await state('card');assert.equal(JSON.stringify(c.hands),savedCard);assert.equal(c.pot,10);assert.equal(c.round,1);
await choose('tenhalf');t=await state('tenhalf');assert.deepEqual(t.scores,scores);assert.equal(t.shoe,shoe);assert.equal(t.remaining,remaining);assert.equal(t.nextDealer,0);
await choose('dice',B);d=await state('dice',B);assert.equal(d.phase,'ended');assert.equal(d.round,1);assert.equal(d.code,code);assert.equal(d.you,1);
}));
test('outsider cannot select, read any game, act or leave; third player cannot join',async()=>fixture(async(api)=>{const room=(await api('/club-api/create',{token:A})).v,code=room.code;const joined=await api('/club-api/join',{token:B,code});assert.equal((await api('/club-api/join',{token:C,code})).status,409);for(const g of ['card','dice','tenhalf','gomoku'])assert.equal((await api('/club-api/game/'+g+'/state?code='+code,null,C)).status,403);assert.equal((await api('/club-api/select',{code,id:'x',rev:joined.v.rev,game:'dice'},C)).status,403);assert.equal((await api('/club-api/leave',{code},C)).status,403);assert.equal((await api('/club-api/state?code='+code,null,A)).status,200);}));
test('stale iframe actions after switching away and back cannot mutate game; simultaneous selections conflict safely',async()=>fixture(async(api)=>{let room=(await api('/club-api/create',{token:A})).v,code=room.code;room=(await api('/club-api/join',{token:B,code})).v;let p=await api('/club-api/select',{code,id:'1',rev:room.rev,game:'tenhalf'},A);room=p.v;const epoch=room.epoch,s=(await api('/club-api/game/tenhalf/state?code='+code,null,A)).v;const a=await api('/club-api/select',{code,id:'2',rev:room.rev,game:'dice'},B);assert.equal(a.status,200);const conflict=await api('/club-api/select',{code,id:'3',rev:room.rev,game:'card'},A);assert.equal(conflict.status,409);assert.equal(conflict.v.state.selected,'dice');room=(await api('/club-api/select',{code,id:'4',rev:a.v.rev,game:'tenhalf'},A)).v;const late=await api('/club-api/game/tenhalf/action',{code,id:'late',rev:s.rev,epoch,action:{type:'start',round:0}},A);assert.equal(late.status,409);const fresh=await api('/club-api/game/tenhalf/state?code='+code,null,A);assert.equal(fresh.v.round,0);assert.equal(fresh.v.rev,s.rev);assert.ok(room.epoch>epoch);}));
test('duplicate game actions never double-deal, and shared identities reconnect without joining again',async()=>fixture(async(api)=>{let r=(await api('/club-api/create',{token:A})).v,code=r.code;r=(await api('/club-api/join',{token:B,code})).v;r=(await api('/club-api/select',{code,id:'sel',rev:r.rev,game:'tenhalf'},A)).v;const s=(await api('/club-api/game/tenhalf/state?code='+code,null,A)).v;const body={code,id:'once',rev:s.rev,epoch:r.epoch,action:{type:'start',round:0}};const first=await api('/club-api/game/tenhalf/action',body,A),second=await api('/club-api/game/tenhalf/action',body,A);assert.equal(first.status,200);assert.deepEqual(second.v.hands,first.v.hands);assert.equal(second.v.round,1);assert.equal(second.v.remaining,50);const reconnect=(await api('/club-api/state?code='+code,null,B)).v;assert.equal(reconnect.you,1);assert.equal(reconnect.selected,'tenhalf');assert.equal(reconnect.epoch,r.epoch);}));
test('parent lobby authenticates once, swaps iframe in same room and returns to lobby without clearing identity',async()=>fixture(async(api,base)=>{const html=fs.readFileSync('public/club/index.html','utf8'),ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);class El{constructor(){this.value='';this.classes=new Set();this.classList={toggle:(c,b)=>b?this.classes.add(c):this.classes.delete(c)};}setAttribute(){}}
const els=new Map(ids.map(id=>[id,new El()])),storage=new Map();let creates=0;const document={body:new El(),hidden:false,getElementById:id=>{assert.ok(els.has(id),id);return els.get(id);},addEventListener(){}};const context=vm.createContext({document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},crypto:crypto.webcrypto,AbortController,setTimeout,clearTimeout,setInterval(){},console,navigator:{},fetch:async(url,opt)=>{if(url==='/club-api/create')creates++;return fetch(base+url,opt);}});
context.window=context;vm.runInContext(fs.readFileSync('public/club/app.js','utf8'),context);els.get('nickname').value='甲';await vm.runInContext('enter(true)',context);const session=JSON.parse(storage.get('club-session'));assert.match(session.code,/^\d{6}$/);await api('/club-api/join',{token:B,code:session.code,name:'乙'});await vm.runInContext('poll()',context);
for(const g of ['card','dice','tenhalf','gomoku']){await vm.runInContext("select('"+g+"')",context);assert.match(els.get('game-frame').src,new RegExp('/club-game/'+g+'/'));assert.equal(els.get('entry').hidden,true);assert.equal(JSON.parse(storage.get('club-session')).code,session.code);assert.equal(JSON.parse(storage.get('club-session')).token,session.token);}
await vm.runInContext('select(null)',context);assert.equal(els.get('lobby').hidden,false);assert.equal(els.get('entry').hidden,true);assert.equal(els.get('game-frame').src,'about:blank');assert.equal(creates,1);await api('/club-api/leave',{code:session.code},session.token);
}));
test('trusted game frames allow same-origin embedding, assets and central auth, with no second visible room form',async()=>fixture(async(_api,base)=>{const main=await fetch(base+'/club/');assert.equal(main.status,200);assert.match(main.headers.get('content-security-policy'),/frame-src 'self'/);for(const g of ['card','dice','tenhalf','gomoku']){const frame=await fetch(base+'/club-game/'+g+'/');assert.equal(frame.status,200);assert.match(frame.headers.get('content-security-policy'),/frame-ancestors 'self'/);const js=await(await fetch(base+'/club-game/'+g+'/app.js')).text();assert.ok(js.includes('club-session'));assert.ok(js.includes('/club-api/game/'+g+'/'));const css=await(await fetch(base+'/club-game/'+g+'/style.css')).text();assert.ok(css.includes('display:none!important'));}assert.equal((await fetch(base+'/club-game/../secret')).status,404);}));
test('both seats see one shared dealer event; retries do not redeal or replay; event never contains cards',async()=>fixture(async(api,base)=>{
 let r=(await api('/club-api/create',{token:A})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code})).v;
 r=(await api('/club-api/select',{code,id:'dealer-card',rev:r.rev,game:'card'},A)).v;
 let s=(await api('/club-api/game/card/state?code='+code,null,A)).v;
 assert.equal(s.dealerEvent,undefined);
 const body={code,id:'dealer-once',rev:s.revision,epoch:r.epoch,action:'deal'};
 s=(await api('/club-api/game/card/action',body,A)).v;
 const other=(await api('/club-api/game/card/state?code='+code,null,B)).v;
 assert.equal(s.dealerEvent.id,other.dealerEvent.id);assert.equal(s.dealerEvent.shuffle,true);
 assert.deepEqual(s.dealerEvent.recipients,other.dealerEvent.recipients);
 assert.deepEqual(Object.keys(s.dealerEvent).sort(),['duration','id','recipients','remaining','shuffle']);
 assert.deepEqual(s.hands.flat(),Array(6).fill(null));assert.deepEqual(other.hands.flat(),Array(6).fill(null));
 const retry=(await api('/club-api/game/card/action',body,A)).v;
 assert.equal(retry.dealerEvent.id,s.dealerEvent.id);assert.equal(retry.round,1);
 for(const file of ['table-dealer.js','table-dealer.css'])assert.equal((await fetch(base+'/club/'+file)).status,200);
}));
test('tenhalf dealer shuffles once per shoe and continues the same deck for draws and next hands',async()=>fixture(async(api)=>{
 let r=(await api('/club-api/create',{token:A})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code})).v;
 r=(await api('/club-api/select',{code,id:'dealer-ten',rev:r.rev,game:'tenhalf'},A)).v;
 let s=(await api('/club-api/game/tenhalf/state?code='+code,null,A)).v,id=0;
 async function action(t,type){const resp=await api('/club-api/game/tenhalf/action',{code,id:'td-'+(++id),rev:s.rev,epoch:r.epoch,action:{type,round:s.round}},t);assert.equal(resp.status,200,JSON.stringify(resp.v));s=resp.v;}
 await action(A,'start');assert.equal(s.dealerEvent.shuffle,true);const first=s.dealerEvent.id;
 await action(B,'request');assert.equal(s.dealerEvent.id,first);
 await action(A,'deal');assert.equal(s.dealerEvent.shuffle,false);assert.deepEqual(s.dealerEvent.recipients,[1]);assert.equal(s.remaining,49);
 if(s.phase==='guest')await action(B,'stand');if(s.phase==='dealer')await action(A,'stand');
 const left=s.remaining,shoe=s.shoe,scores=s.scores.slice();await action(A,'start');
 assert.equal(s.dealerEvent.shuffle,false);assert.equal(s.shoe,shoe);assert.equal(s.remaining,left-2);assert.deepEqual(s.scores,scores);assert.equal(s.dealer,0);
}));
test('live stream pushes both seats immediately with private views and rejects outsiders',async()=>fixture(async(api,base)=>{
 let room=(await api('/club-api/create',{token:A,name:'甲'})).v;const code=room.code;room=(await api('/club-api/join',{token:B,code,name:'乙'})).v;
 assert.equal((await fetch(base+'/club-api/events?code='+code)).status,401);
 assert.equal((await fetch(base+'/club-api/events?code='+code,{headers:{Authorization:'Bearer '+C}})).status,403);
 const readers=[];const aborts=[];
 async function open(token){const controller=new AbortController();aborts.push(controller);const response=await fetch(base+'/club-api/events?code='+code,{headers:{Authorization:'Bearer '+token},signal:controller.signal});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);const reader=response.body.getReader();readers.push(reader);let buffer='';return async()=>{for(;;){const k=buffer.indexOf('\n\n');if(k>=0){const packet=buffer.slice(0,k);buffer=buffer.slice(k+2);const line=packet.split('\n').find(x=>x.startsWith('data: '));if(line)return JSON.parse(line.slice(6));}else{const v=await reader.read();assert.equal(v.done,false);buffer+=new TextDecoder().decode(v.value);}}};}
 try{const nextA=await open(A),nextB=await open(B);assert.equal((await nextA()).room.you,0);assert.equal((await nextB()).room.you,1);
 room=(await api('/club-api/select',{code,id:'live-card',rev:room.rev,game:'card'},A)).v;assert.equal((await nextA()).game,'card');assert.equal((await nextB()).room.epoch,room.epoch);
 let s=(await api('/club-api/game/card/state?code='+code,null,A)).v;const send=async(token,action)=>{const started=performance.now();const result=await api('/club-api/game/card/action',{code,id:'live-'+action,rev:s.revision,epoch:room.epoch,action},token);assert.equal(result.status,200);s=result.v;const [a,b]=await Promise.all([nextA(),nextB()]);assert.ok(performance.now()-started<1000,'push must not wait for a polling interval');assert.equal(a.state.revision,s.revision);assert.equal(b.state.revision,s.revision);return [a,b];};
 await send(A,'deal');let [a,b]=await send(B,'look3');assert.deepEqual(a.state.hands[1],[null,null,null]);assert.ok(b.state.hands[1].every(Boolean));assert.deepEqual(b.state.hands[0],[null,null,null]);assert.ok(!JSON.stringify(a).includes(B));assert.ok(!JSON.stringify(b).includes(A));
 [a,b]=await send(B,'follow');assert.equal(a.state.banks[1],20);assert.equal(b.state.banks[1],20);
 }finally{for(const a of aborts)a.abort();for(const r of readers)try{await r.cancel();}catch{}}
}));
test('gomoku validates turns and coordinates, winner starts next game, retry and switching preserve the board',async()=>fixture(async(api)=>{
 let room=(await api('/club-api/create',{token:A,name:'甲'})).v;const code=room.code;room=(await api('/club-api/join',{token:B,code,name:'乙'})).v;let id=0;
 async function select(g){const r=await api('/club-api/select',{code,id:'gsel-'+(++id),rev:room.rev,game:g},A);assert.equal(r.status,200);room=r.v;}
 await select('gomoku');let s=(await api('/club-api/game/gomoku/state?code='+code,null,A)).v;
 const send=(token,action,overrides={})=>api('/club-api/game/gomoku/action',{code,id:'gm-'+(++id),rev:s.rev,epoch:room.epoch,action:{...action,round:s.round},...overrides},token);
 async function act(token,a){const r=await send(token,a);assert.equal(r.status,200,JSON.stringify(r.v));s=r.v;}
 assert.equal((await send(B,{type:'start'})).status,400);await act(A,{type:'start'});
 assert.equal((await send(B,{type:'move',row:0,col:0})).status,400);
 for(const [row,col]of [[-1,0],[15,0],[0,15],[0.5,1],['1',2]])assert.equal((await send(A,{type:'move',row,col})).status,400);
 for(let col=0;col<4;col++){await act(A,{type:'move',row:0,col});if(col===0)assert.equal((await send(B,{type:'move',row:0,col})).status,400);await act(B,{type:'move',row:2,col});}
 await act(A,{type:'move',row:1,col:10});
 const once={code,id:'winning-once',rev:s.rev,epoch:room.epoch,action:{type:'move',row:2,col:4,round:s.round}};
 let r=await api('/club-api/game/gomoku/action',once,B);assert.equal(r.status,200);s=r.v;assert.equal(s.winner,1);assert.equal(s.nextStarter,1);assert.equal(s.winningLine.length,5);assert.deepEqual(s.scores,[0,1]);
 r=await api('/club-api/game/gomoku/action',once,B);assert.deepEqual(r.v.scores,[0,1]);
 assert.equal((await send(A,{type:'start'})).status,400);
 await select('tenhalf');await select('gomoku');r=await api('/club-api/game/gomoku/state?code='+code,null,B);assert.deepEqual(r.v.board,s.board);assert.equal(r.v.you,1);
 await act(B,{type:'start'});assert.equal(s.starter,1);assert.equal(s.turn,1);assert.equal(s.round,2);assert.equal(s.moves,0);assert.ok(s.board.every(x=>x===null));assert.deepEqual(s.scores,[0,1]);
 await act(B,{type:'move',row:7,col:7});const other=(await api('/club-api/game/gomoku/state?code='+code,null,A)).v;assert.equal(other.board[112],1);assert.equal(other.turn,0);
}));
test('gomoku finds vertical and both diagonal wins at edges and handles a full-board draw',()=>{
 const g=require('./club-engines/gomoku.cjs');
 for(const [dr,dc,r,c]of [[1,0,0,14],[1,1,0,0],[1,-1,0,14],[0,1,14,0]]){const s=g.initial([A,B],['甲','乙']);g.act(s,0,{type:'start',round:0});for(let j=0;j<4;j++)s.board[(r+j*dr)*15+c+j*dc]=0;g.act(s,0,{type:'move',round:1,row:r+4*dr,col:c+4*dc});assert.equal(s.winner,0);assert.equal(s.winningLine.length,5);}
 const s=g.initial([A,B],['甲','乙']);g.act(s,0,{type:'start',round:0});s.board.fill(1);s.board[0]=null;s.moves=224;g.act(s,0,{type:'move',row:0,col:0,round:1});assert.equal(s.phase,'ended');assert.equal(s.winner,null);assert.equal(s.nextStarter,0);
});
