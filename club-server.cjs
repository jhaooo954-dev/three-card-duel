'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const card=require('./club-engines/card.cjs'),dice=require('./club-engines/dice.cjs'),tenhalf=require('./engine.cjs'),gomoku=require('./club-engines/gomoku.cjs'),tenhalf3=require('./club-engines/tenhalf3.cjs');
const tenEngine=r=>r.tokens.length===3?tenhalf3:tenhalf;
const rooms=new Map(),GAMES=['card','dice','tenhalf','gomoku'],valid=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t),name=(v,fallback)=>typeof v==='string'&&v.trim()?v.trim().slice(0,12):fallback;
function shuffle(){const d=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=crypto.randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
function create(token,playerName,count=2){const tokens=[token,...Array(count-1).fill(null)],names=[name(playerName,'房主'),...Array.from({length:count-1},(_,i)=>i?'好友二':'好友')],sets=()=>tokens.map(()=>new Set());const cs=card.initial(token,count);cs.players=tokens;return {tokens,names,selected:null,epoch:0,rev:0,dealSequence:0,dealerEvents:{},at:Date.now(),last:tokens.map((_,i)=>i?0:Date.now()),games:{card:cs,dice:dice.initial(tokens,names),tenhalf:(count===3?tenhalf3:tenhalf).initial(tokens,names),gomoku:gomoku.initial(tokens,names)},versions:{card:0,dice:0,tenhalf:0},seen:{card:sets(),dice:sets(),tenhalf:sets(),gomoku:sets()},streams:new Set(),switches:sets()};}
function canChangeMode(r){return !Object.values(r.games).some(s=>s.round>0);}
function roomView(r,i,code){return {code,you:i,names:r.names,joined:r.tokens.every(Boolean),playerCount:r.tokens.length,memberCount:r.tokens.filter(Boolean).length,canChangeMode:canChangeMode(r),selected:r.selected,epoch:r.epoch,rev:r.rev,online:r.last.map((v,j)=>!!r.tokens[j]&&Date.now()-v<15000),games:{card:{round:r.games.card.round,active:r.games.card.active},dice:{round:r.games.dice.round,phase:r.games.dice.phase},tenhalf:{round:r.games.tenhalf.round,shoe:r.games.tenhalf.shoe,phase:r.games.tenhalf.phase},gomoku:{round:r.games.gomoku.round,phase:r.games.gomoku.phase}}};}
function gameView(r,g,i,code){const v=g==='card'?card.view(r.games.card,i,r.versions.card,code):(g==='dice'?dice:g==='gomoku'?gomoku:tenEngine(r)).view(r.games[g],i,code,r.last);v.names=r.names;const e=r.dealerEvents[g];if(e){const {at,...event}=e;v.dealerEvent={...event,remaining:Math.max(0,e.duration-(Date.now()-at))};}return v;}
// Each stream receives only its authenticated seat's redacted game view.
function snapshot(r,i,code){return {room:roomView(r,i,code),game:r.selected,state:r.selected?gameView(r,r.selected,i,code):null};}
function broadcast(r,code){for(const c of r.streams){if(c.res.destroyed){r.streams.delete(c);continue;}if(!c.res.write('data: '+JSON.stringify(snapshot(r,c.i,code))+'\n\n'))c.res.destroy();}}
function closeStreams(r){for(const c of r.streams)c.res.end();r.streams.clear();}
function recordDeal(r,g,shuffle,recipients){r.dealerEvents[g]={id:++r.dealSequence,at:Date.now(),shuffle,recipients,duration:(shuffle?1000:0)+recipients.length*240+300};}
function headers(res,child){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors "+(child?"'self'":"'none'"));}
const assets=new Map([['/club/','club/index.html'],['/club','club/index.html'],['/club/index.html','club/index.html'],['/club/app.js','club/app.js'],['/club/style.css','club/style.css']]);
for(const g of GAMES){for(const file of ['index.html','app.js','style.css'])assets.set('/club-game/'+g+'/'+file,'club-games/'+g+'/'+file);assets.set('/club-game/'+g+'/','club-games/'+g+'/index.html');}
assets.set('/club-game/card/icon.svg','club-games/card/icon.svg');
assets.set('/club-game/card/dealer.webp','club-games/card/dealer.webp');
assets.set('/club/table-dealer.js','table-dealer.js');assets.set('/club/table-dealer.css','table-dealer.css');
async function handleClub(req,res){const url=new URL(req.url,'http://localhost');if(assets.has(url.pathname)){const file=assets.get(url.pathname),target=path.join(__dirname,'public',file);headers(res,url.pathname.startsWith('/club-game/'));if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return true;}const bytes=fs.readFileSync(target),ext=path.extname(file);res.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'}[ext]);res.setHeader('Content-Length',bytes.length);res.end(req.method==='HEAD'?undefined:bytes);return true;}
if(!url.pathname.startsWith('/club-api/'))return false;
function send(status,data){headers(res,false);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
try{let b={};if(req.method==='POST'){const origin=req.headers.origin;if(origin&&new URL(origin).host!==req.headers.host){send(403,{error:'请求来源无效'});return true;}let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){send(413,{error:'请求过大'});return true;}}try{b=JSON.parse(raw||'{}');}catch{send(400,{error:'请求格式错误'});return true;}}else if(req.method!=='GET'){send(405,{error:'方法不支持'});return true;}
const token=req.headers.authorization?.replace(/^Bearer /,'')||b.token;if(!valid(token)){send(401,{error:'身份失效，请重新进房'});return true;}
if(url.pathname==='/club-api/create'&&req.method==='POST'){for(const[c,r]of rooms){const i=r.tokens.indexOf(token);if(i>=0){r.last[i]=Date.now();r.at=Date.now();send(200,roomView(r,i,c));return true;}}if(rooms.size>=2000){send(503,{error:'房间暂时已满'});return true;}let code;do{code=String(crypto.randomInt(100000,1000000));}while(rooms.has(code));const count=b.playerCount??2;if(count!==2&&count!==3){send(400,{error:'请选择双人或三人'});return true;}const r=create(token,b.name,count);rooms.set(code,r);send(200,roomView(r,0,code));return true;}
const code=String(b.code||url.searchParams.get('code')||''),r=rooms.get(code);if(!r){send(404,{error:'房间不存在或已过期，请重新建房',expired:true});return true;}let i=r.tokens.indexOf(token);
if(url.pathname==='/club-api/join'&&req.method==='POST'){if(i<0){i=r.tokens.indexOf(null);if(i<0){send(409,{error:'房间已满（'+r.tokens.length+'人模式）'});return true;}r.tokens[i]=token;r.names[i]=name(b.name,i===1?'好友':'好友二');r.rev++;r.games.dice.rev++;r.games.tenhalf.rev++;r.games.gomoku.rev++;r.versions.card++;r.games.card.message='好友已加入，房主先发牌';}r.last[i]=Date.now();r.at=Date.now();broadcast(r,code);send(200,roomView(r,i,code));return true;}
if(i<0){send(403,{error:'你不在这个房间'});return true;}r.last[i]=Date.now();r.at=Date.now();
if(url.pathname==='/club-api/events'&&req.method==='GET'){
 headers(res,false);res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();req.socket.setNoDelay(true);
 const previous=[...r.streams].filter(c=>c.i===i);while(previous.length>=3)previous.shift().res.end();
 const client={res,i};r.streams.add(client);res.write('retry: 1000\n\ndata: '+JSON.stringify(snapshot(r,i,code))+'\n\n');
 const heartbeat=setInterval(()=>{const current=rooms.get(code);if(current){current.last[i]=Date.now();current.at=Date.now();}if(!res.write(': heartbeat\n\n'))res.destroy();},10000);heartbeat.unref();
 res.on('close',()=>{clearInterval(heartbeat);r.streams.delete(client);});return true;
}
if(url.pathname==='/club-api/state'&&req.method==='GET'){send(200,roomView(r,i,code));return true;}
if(url.pathname==='/club-api/leave'&&req.method==='POST'){closeStreams(r);rooms.delete(code);send(200,{ok:true});return true;}
if(url.pathname==='/club-api/mode'&&req.method==='POST'){
 if(i!==0){send(403,{error:'请房主选择双人或三人'});return true;}
 if(b.playerCount!==2&&b.playerCount!==3){send(400,{error:'请选择双人或三人'});return true;}
 if(b.rev!==r.rev){send(409,{error:'房间已更新，请重试',state:roomView(r,i,code)});return true;}
 if(b.playerCount===r.tokens.length){send(200,roomView(r,i,code));return true;}
 if(r.selected||!canChangeMode(r)){send(400,{error:'请在开局前的大厅选择人数'});return true;}
 if(r.tokens.filter(Boolean).length>b.playerCount){send(400,{error:'三人已入座，不能切换双人模式'});return true;}
 const n=create(r.tokens[0],r.names[0],b.playerCount);for(let j=0;j<Math.min(r.tokens.length,n.tokens.length);j++){n.tokens[j]=r.tokens[j];n.names[j]=r.names[j];n.last[j]=r.last[j];}n.rev=r.rev+1;n.epoch=r.epoch+1;n.streams=r.streams;rooms.set(code,n);broadcast(n,code);send(200,roomView(n,i,code));return true;
}
if(url.pathname==='/club-api/select'&&req.method==='POST'){if(b.game!==null&&!r.tokens.every(Boolean)){send(400,{error:'等待'+r.tokens.length+'人到齐后再选游戏'});return true;}if(b.game!==null&&!GAMES.includes(b.game)){send(400,{error:'请选择大厅里的游戏'});return true;}if(typeof b.id!=='string'||b.id.length>80){send(400,{error:'请求编号无效'});return true;}if(r.switches[i].has(b.id)){send(200,roomView(r,i,code));return true;}if(b.rev!==r.rev){send(409,{error:'好友已切换，请重试',state:roomView(r,i,code)});return true;}if(r.selected!==b.game){r.selected=b.game;r.epoch++;r.rev++;}broadcast(r,code);r.switches[i].add(b.id);if(r.switches[i].size>1000)r.switches[i].delete(r.switches[i].values().next().value);send(200,roomView(r,i,code));return true;}
const m=url.pathname.match(/^\/club-api\/game\/(card|dice|tenhalf|gomoku)\/(state|action)$/);
if(m){const g=m[1];if(m[2]==='state'&&req.method==='GET'){send(200,gameView(r,g,i,code));return true;}if(m[2]!=='action'||req.method!=='POST'){send(405,{error:'方法不支持'});return true;}if(r.selected!==g||b.epoch!==r.epoch){send(409,{error:'游戏已切换，请从房间大厅进入'});return true;}if(typeof b.id!=='string'||b.id.length>80){send(400,{error:'请求编号无效'});return true;}const seen=r.seen[g][i];if(seen.has(b.id)){send(200,gameView(r,g,i,code));return true;}const revision=g==='card'?r.versions.card:r.games[g].rev;if(b.rev!==revision){send(409,{error:'牌局已更新，请重试',state:gameView(r,g,i,code)});return true;}
if(g==='card'){card.action(r.games.card,i,b.action);r.versions.card++;if(b.action==='deal')recordDeal(r,g,true,Array.from({length:3},()=>r.tokens.map((_,j)=>j)).flat());}else if(g==='gomoku')gomoku.act(r.games.gomoku,i,b.action||{});else if(g==='dice')dice.act(r.games.dice,i,b.action||{},()=>Array.from({length:5},()=>crypto.randomInt(1,7)));else{const s=r.games.tenhalf,type=b.action?.type,fresh=s.round===0||s.deck.length<r.tokens.length,recipient=type==='deal'?(r.tokens.length===3?s.guest:1-s.dealer):s.dealer;tenEngine(r).act(s,i,b.action||{},shuffle);if(type==='start')recordDeal(r,g,fresh,r.tokens.map((_,j)=>j));else if(type==='deal'||type==='draw')recordDeal(r,g,false,[recipient]);}
broadcast(r,code);seen.add(b.id);if(seen.size>1000)seen.delete(seen.values().next().value);send(200,gameView(r,g,i,code));return true;}
send(404,{error:'接口不存在'});return true;
}catch(e){if(!res.headersSent)send(400,{error:e.message||'操作失败'});else res.end();return true;}}
setInterval(()=>{for(const[c,r]of rooms)if(Date.now()-r.at>12*3600000){closeStreams(r);rooms.delete(c);}},60000).unref();
module.exports={handleClub};
