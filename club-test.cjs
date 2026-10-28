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

test('room modes preserve both identities when expanding or shrinking before play; three seats require all three and reject a fourth',async()=>fixture(async api=>{
 let r=(await api('/club-api/create',{token:A,name:'甲'})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code,name:'乙'})).v;
 assert.equal(r.playerCount,2);assert.equal(r.joined,true);
 assert.equal((await api('/club-api/mode',{code,rev:r.rev,playerCount:3},B)).status,403);
 r=(await api('/club-api/mode',{code,rev:r.rev,playerCount:3},A)).v;assert.equal(r.playerCount,3);assert.equal(r.memberCount,2);assert.equal(r.joined,false);assert.deepEqual(r.names,['甲','乙','好友二']);
 assert.equal((await api('/club-api/select',{code,rev:r.rev,id:'not-full',game:'card'},A)).status,400);
 r=(await api('/club-api/mode',{code,rev:r.rev,playerCount:2},A)).v;assert.equal(r.joined,true);assert.equal((await api('/club-api/state?code='+code,null,B)).v.you,1);
 r=(await api('/club-api/mode',{code,rev:r.rev,playerCount:3},A)).v;r=(await api('/club-api/join',{token:C,code,name:'丙'})).v;assert.equal(r.you,2);assert.equal(r.joined,true);
 assert.equal((await api('/club-api/mode',{code,rev:r.rev,playerCount:2},A)).status,400);
 assert.equal((await api('/club-api/join',{token:'1'.repeat(64),code})).status,409);
 for(const game of ['card','dice','tenhalf','gomoku']){r=(await api('/club-api/select',{code,rev:r.rev,id:'three-'+game,game},C)).v;for(const [i,token]of [A,B,C].entries()){const v=(await api('/club-api/game/'+game+'/state?code='+code,null,token)).v;assert.equal(v.you,i);assert.deepEqual(v.names,['甲','乙','丙']);}}
 const s=(await api('/club-api/game/gomoku/state?code='+code,null,C)).v;assert.equal((await api('/club-api/game/gomoku/action',{code,rev:s.rev,epoch:r.epoch,id:'spectator-start',action:{type:'start',round:0}},C)).status,400);
}));

test('three-card turn order, privacy for third seat, folded seat skipping, winner first, no ante and retained pot',async()=>fixture(async api=>{
 let r=(await api('/club-api/create',{token:A,playerCount:3})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code})).v;r=(await api('/club-api/join',{token:C,code})).v;r=(await api('/club-api/select',{code,id:'3c',rev:r.rev,game:'card'},A)).v;let s=(await api('/club-api/game/card/state?code='+code,null,A)).v,id=0;
 async function act(token,action){const body={code,epoch:r.epoch,rev:s.revision,id:'3card-'+(++id),action};const v=await api('/club-api/game/card/action',body,token);assert.equal(v.status,200,JSON.stringify(v.v));s=v.v;return body;}
 await act(A,'deal');assert.equal(s.pot,0);assert.equal(s.hands.length,3);assert.equal(s.turn,1);assert.ok(s.hands.flat().every(c=>c===null));assert.deepEqual(s.dealerEvent.recipients,[0,1,2,0,1,2,0,1,2]);
 await act(B,'follow');assert.equal(s.turn,2);assert.equal(s.pot,10);await act(C,'look2');assert.equal(s.callCost,20);assert.equal(s.hands[2].filter(Boolean).length,2);assert.ok(s.hands[0].every(c=>c===null));
 const a=(await api('/club-api/game/card/state?code='+code,null,A)).v;assert.ok(a.hands[2].every(c=>c===null));assert.ok(!JSON.stringify(a).includes(C));
 await act(C,'follow');assert.equal(s.pot,30);await act(A,'fold');assert.equal(s.active,true);assert.equal(s.turn,1);assert.equal(s.folded[0],true);const body=await act(B,'fold');assert.equal(s.active,false);assert.equal(s.winner,2);assert.equal(s.dealer,2);assert.equal(s.pot,30);assert.deepEqual(s.banks,[0,10,20]);assert.ok(s.hands.flat().every(Boolean));assert.equal(new Set(s.hands.flat().map(c=>c.suit+c.rank)).size,9);
 assert.equal((await api('/club-api/game/card/action',body,B)).v.pot,30);await act(C,'deal');assert.equal(s.turn,0);assert.equal(s.pot,0);assert.deepEqual(s.banks,[0,0,0]);
 r=(await api('/club-api/state?code='+code,null,A)).v;r=(await api('/club-api/select',{code,rev:r.rev,id:'lobby3',game:null},A)).v;assert.equal((await api('/club-api/mode',{code,rev:r.rev,playerCount:2},A)).status,400);
}));

test('three-card ties retain active opener-loses rule and reset requires every seat',()=>{
 const c=require('./club-engines/card.cjs'),s=c.initial(A,3);s.players=[A,B,C];c.action(s,0,'deal');const h=[{rank:14,suit:'♠'},{rank:13,suit:'♥'},{rank:11,suit:'♣'}];s.hands=[h.map(v=>({...v})),h.map(v=>({...v})),[{rank:9,suit:'♠'},{rank:7,suit:'♥'},{rank:2,suit:'♣'}]];s.turn=1;c.action(s,1,'open');assert.equal(s.winner,0);assert.equal(s.pot,10);assert.deepEqual(s.stats,[1,0,0,0]);c.action(s,0,'reset');c.action(s,1,'reset');assert.equal(s.round,1);c.action(s,2,'reset');assert.equal(s.round,0);assert.equal(s.hands.length,3);assert.deepEqual(s.stats,[0,0,0,0]);
});

test('three dice require all ready, independently hide hands, allow any seat to open and retain dice until all ready again',()=>{
 const d=require('./club-engines/dice.cjs'),s=d.initial([A,B,C],['甲','乙','丙']);let n=0;const roll=()=>Array(5).fill(++n);
 d.act(s,0,{type:'ready',round:0},roll,0);d.act(s,1,{type:'ready',round:0},roll,0);assert.equal(s.round,0);d.act(s,2,{type:'ready',round:0},roll,0);assert.equal(s.round,1);assert.equal(n,3);
 for(let i=0;i<3;i++){const v=d.view(s,i,'123456',null,2000);assert.ok(v.dice[i].every(Boolean));assert.ok(v.dice.filter((_,j)=>i!==j).flat().every(x=>x===null));}
 assert.throws(()=>d.act(s,2,{type:'open',round:1},roll,100));d.act(s,2,{type:'open',round:1},roll,2000);assert.ok(d.view(s,0,'123456',null,2000).dice.flat().every(Number.isInteger));
 const old=JSON.stringify(s.dice);d.act(s,2,{type:'ready',round:1},roll,2000);d.act(s,0,{type:'ready',round:1},roll,2000);assert.equal(JSON.stringify(s.dice),old);assert.equal(s.phase,'ended');d.act(s,1,{type:'ready',round:1},roll,2000);assert.equal(s.round,2);
});

test('three tenhalf keeps explicit request/deal, private holes, sequential guests and separate zero-sum settlements',async()=>fixture(async api=>{
 let r=(await api('/club-api/create',{token:A,playerCount:3})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code})).v;r=(await api('/club-api/join',{token:C,code})).v;r=(await api('/club-api/select',{code,id:'3t',rev:r.rev,game:'tenhalf'},A)).v;let s=(await api('/club-api/game/tenhalf/state?code='+code,null,A)).v,id=0;
 async function send(token,type){return api('/club-api/game/tenhalf/action',{code,id:'3t-'+(++id),rev:s.rev,epoch:r.epoch,action:{type,round:s.round}},token);}
 async function act(token,type){const v=await send(token,type);assert.equal(v.status,200,JSON.stringify(v.v));s=v.v;}
 await act(A,'start');assert.equal(s.remaining,49);assert.equal(s.guest,1);assert.deepEqual(s.hands.map(h=>h[0]===null),[false,true,true]);assert.equal((await send(C,'request')).status,400);assert.equal((await send(A,'draw')).status,400);
 await act(B,'request');assert.equal(s.remaining,49);assert.equal((await send(B,'stand')).status,400);await act(A,'deal');assert.equal(s.remaining,48);assert.deepEqual(s.dealerEvent.recipients,[1]);assert.equal(s.dealerEvent.shuffle,false);
 if(s.guest===1)await act(B,'stand');assert.equal(s.guest,2);const third=(await api('/club-api/game/tenhalf/state?code='+code,null,C)).v;assert.notEqual(third.hands[2][0],null);assert.equal(third.hands[0][0],null);await act(C,'stand');assert.equal(s.phase,'dealer');assert.notEqual(s.hands[0][0],null);await act(A,'stand');assert.equal(s.phase,'ended');assert.equal(s.result.outcomes.length,2);assert.equal(s.result.delta.reduce((a,b)=>a+b),0);assert.equal(s.scores.reduce((a,b)=>a+b),0);assert.ok(s.hands.flat().every(Number.isInteger));const remain=s.remaining,scores=s.scores.slice();await act(A,'start');assert.equal(s.remaining,remain-3);assert.equal(s.dealer,0);assert.deepEqual(s.scores,scores);assert.equal(s.dealerEvent.shuffle,false);
}));

test('three tenhalf uses original banker priority and all payout multipliers against each guest',()=>{
 const t=require('./club-engines/tenhalf3.cjs'),old=require('./engine.cjs');
 const hands=[[0],[8],[9],[0,9,10],[0,10,11,12,23],[9,22],[8,9],[0,1,2,3,10]];
 for(const dh of hands)for(const gh of hands){const s=t.initial([A,B,C],['甲','乙','丙']);s.hands=[dh,gh,[1]];const actual=t.versus(s,1);if(old.total(gh)>21){assert.equal(actual.winner,0);assert.equal(actual.multiplier,1);continue;}
 const ref=old.initial([A,B],['甲','乙']);Object.assign(ref,{hands:[dh,gh],phase:'dealer',round:1,deck:Array(10).fill(0)});old.act(ref,0,{type:'stand',round:1},()=>[]);assert.equal(actual.winner,ref.result.winner);assert.equal(actual.multiplier,ref.result.multiplier);}
});

test('three tenhalf continuous 52-card shoes rotate banker through all seats, never refill mid-hand and clear only at shoe end',()=>{
 const t=require('./club-engines/tenhalf3.cjs'),s=t.initial([A,B,C],['甲','乙','丙']);let shuffles=0,previousDealer=0,seen=new Set(),shoe=0;const deck=()=>{shuffles++;return Array.from({length:52},(_,i)=>i);};
 for(let k=0;k<300;k++){const d=t.nextDealer(s);t.act(s,d,{type:'start',round:s.round},deck);if(s.shoe!==shoe){if(shoe)assert.equal(d,(previousDealer+1)%3);previousDealer=d;shoe=s.shoe;seen=new Set();assert.deepEqual(s.scores,[0,0,0]);}else assert.equal(d,previousDealer);
 for(const h of s.hands){assert.equal(seen.has(h[0]),false);seen.add(h[0]);}
 while(s.phase==='guest')t.act(s,s.guest,{type:'stand',round:s.round},deck);if(s.phase==='dealer')t.act(s,s.dealer,{type:'stand',round:s.round},deck);assert.equal(s.phase,'ended');assert.equal(s.result.delta.reduce((a,b)=>a+b),0);if(t.shoeEnded(s)){assert.ok(s.deck.length<3);assert.deepEqual(s.scores,[0,0,0]);assert.ok(s.result.shoeScores);}}
 assert.equal(shuffles,Math.ceil(300/17));assert.equal(s.shoe,shuffles);
});

test('three tenhalf deck exhaustion and guest busts cannot deadlock and pay each guest independently',()=>{
 const t=require('./club-engines/tenhalf3.cjs'),s=t.initial([A,B,C],['甲','乙','丙']);Object.assign(s,{round:1,shoe:1,phase:'guest',dealer:0,guest:1,hands:[[9],[9],[0]],deck:[9],request:true});t.act(s,0,{type:'deal',round:1},()=>{throw Error('must not shuffle');});assert.equal(s.phase,'ended');assert.equal(s.result.outcomes[0].winner,0);assert.equal(s.result.outcomes[0].multiplier,1);assert.equal(s.result.delta.reduce((a,b)=>a+b),0);assert.deepEqual(s.scores,[0,0,0]);assert.equal(t.nextDealer(s),1);
 const b=t.initial([A,B,C],['甲','乙','丙']);Object.assign(b,{round:1,phase:'guest',hands:[[0],[9],[9]],deck:[9,9,1,2],request:true});t.act(b,0,{type:'deal',round:1},()=>[]);assert.equal(b.guest,2);assert.equal(b.phase,'guest');t.act(b,2,{type:'request',round:1},()=>[]);t.act(b,0,{type:'deal',round:1},()=>[]);assert.equal(b.phase,'ended');assert.deepEqual(b.result.delta,[20,-10,-10]);
});

test('three-seat live streams receive third-player actions immediately without leaking private cards or tokens',async()=>fixture(async(api,base)=>{
 let r=(await api('/club-api/create',{token:A,playerCount:3})).v;const code=r.code;r=(await api('/club-api/join',{token:B,code})).v;r=(await api('/club-api/join',{token:C,code})).v;const aborts=[];
 async function stream(token){const controller=new AbortController();aborts.push(controller);const response=await fetch(base+'/club-api/events?code='+code,{headers:{Authorization:'Bearer '+token},signal:controller.signal});const reader=response.body.getReader();let buffer='';return async()=>{for(;;){let k=buffer.indexOf('\n\n');if(k<0){const v=await reader.read();assert.equal(v.done,false);buffer+=new TextDecoder().decode(v.value);continue;}const p=buffer.slice(0,k);buffer=buffer.slice(k+2);const line=p.split('\n').find(x=>x.startsWith('data: '));if(line)return JSON.parse(line.slice(6));}};}
 try{const next=await Promise.all([A,B,C].map(stream));let snapshots=await Promise.all(next.map(f=>f()));assert.deepEqual(snapshots.map(s=>s.room.you),[0,1,2]);
 r=(await api('/club-api/select',{code,id:'3s-select',rev:r.rev,game:'card'},C)).v;await Promise.all(next.map(f=>f()));let s=(await api('/club-api/game/card/state?code='+code,null,A)).v,id=0;
 async function act(token,action){const v=await api('/club-api/game/card/action',{code,id:'3s-'+(++id),rev:s.revision,epoch:r.epoch,action},token);assert.equal(v.status,200);s=v.v;return Promise.all(next.map(f=>f()));}
 await act(A,'deal');await act(B,'follow');snapshots=await act(C,'look3');assert.ok(snapshots[0].state.hands[2].every(c=>c===null));assert.ok(snapshots[1].state.hands[2].every(c=>c===null));assert.ok(snapshots[2].state.hands[2].every(Boolean));for(const snap of snapshots){assert.equal(snap.state.revision,s.revision);for(const token of [A,B,C])assert.ok(!JSON.stringify(snap).includes(token));}
 }finally{for(const a of aborts)a.abort();}
}));
