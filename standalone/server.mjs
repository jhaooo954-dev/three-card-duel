import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {initial,action,view} from './shared/engine.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const validCode=c=>typeof c==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(c);
const assets=new Map([['/','index.html'],['/index.html','index.html'],['/style.css','style.css'],['/online.js','online.js'],['/icon.svg','icon.svg'],['/manifest.webmanifest','manifest.webmanifest'],['/offline.html','offline.html'],['/game.js','game.js']]);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
export function createApp({dataDir=process.env.DATA_DIR||path.join(root,'data'),databasePath}={}){
 if(!databasePath)mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(databasePath||path.join(dataDir,'rooms.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL);');
 const select=db.prepare('SELECT state,revision FROM rooms WHERE code=? AND updated_at>?');
 const insert=db.prepare('INSERT OR IGNORE INTO rooms(code,state,revision,updated_at) VALUES(?,?,0,?)');
 const update=db.prepare('UPDATE rooms SET state=?,revision=revision+1,updated_at=? WHERE code=? AND revision=?');
 const cleanup=db.prepare('DELETE FROM rooms WHERE updated_at<?');
 const creationRates=new Map();let lastCleanup=0;
 function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
 function load(code){if(!validCode(code))throw Error('请输入正确的 6 位房间码');const row=select.get(code,Date.now()-86400000);if(!row)throw Error('房间不存在或已过期');const s=JSON.parse(row.state);if(s.rulesVersion!==3)throw Error('玩法已更新，请刷新页面并创建新房间');return {s,revision:row.revision};}
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/healthz'){json(res,{ok:true});return;}
   if(url.pathname!=='/api/room'){
    if(req.method!=='GET'&&req.method!=='HEAD'){json(res,{error:'方法不支持'},405);return;}
    const file=assets.get(url.pathname);if(!file){json(res,{error:'页面不存在'},404);return;}
    const bytes=readFileSync(path.join(root,'public',file));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});res.end(req.method==='HEAD'?undefined:bytes);return;
   }
   const token=typeof req.headers['x-player-token']==='string'?req.headers['x-player-token']:null;
   if(req.method==='GET'){
    const code=url.searchParams.get('code')||'';const {s,revision}=load(code);const i=token?s.players.indexOf(token):-1;if(i<0){json(res,{error:'请先加入房间'},403);return;}json(res,view(s,i,revision,code));return;
   }
   if(req.method!=='POST'){json(res,{error:'方法不支持'},405);return;}
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){json(res,{error:'请求来源无效'},403);return;}
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>4096){json(res,{error:'请求过长'},413);return;}}
   let b;try{b=JSON.parse(raw);}catch{json(res,{error:'请求格式无效'},400);return;}
   if(!b||typeof b!=='object'){json(res,{error:'请求格式无效'},400);return;}
   const now=Date.now();
   if(now-lastCleanup>600000){cleanup.run(now-86400000);for(const [ip,r]of creationRates)if(r.until<now)creationRates.delete(ip);lastCleanup=now;}
   if(b.type==='create'){
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];let rate=creationRates.get(ip);if(!rate||rate.until<now){rate={count:0,until:now+600000};creationRates.set(ip,rate);}if(++rate.count>20){json(res,{error:'创建房间较频繁，请稍后重试'},429);return;}
    const token=crypto.randomUUID(),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for(let tries=0;tries<5;tries++){
     const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%32]).join('');const s=initial(token);
     if(insert.run(code,JSON.stringify(s),now).changes){json(res,{token,state:view(s,0,0,code)});return;}
    }json(res,{error:'房间创建繁忙，请重试'},409);return;
   }
   const code=String(b.code||'').toUpperCase(),{s,revision}=load(code);let i=token?s.players.indexOf(token):-1,issued;
   if(b.type==='join'){
    if(i>=0){json(res,{state:view(s,i,revision,code)});return;}
    if(s.players[1]){json(res,{error:'房间已满，只能容纳两人'},409);return;}
    issued=crypto.randomUUID();s.players[1]=issued;i=1;s.message='好友已加入，第一局由房主发牌，对方先手';s.logs.unshift(s.message);
   }else if(b.type==='action'){
    if(i<0){json(res,{error:'无效的玩家身份'},403);return;}
    if(b.revision!==revision){json(res,{error:'牌局已更新，请再操作一次'},409);return;}
    action(s,i,b.action);
   }else{json(res,{error:'操作无效'},400);return;}
   const changed=update.run(JSON.stringify(s),now,code,revision).changes;
   if(!changed){json(res,{error:'牌局已更新，请重试'},409);return;}
   json(res,{...(issued?{token:issued}:{}),state:view(s,i,revision+1,code)});
  }catch(e){if(!res.headersSent)json(res,{error:e.message||'请求失败，请重试'},400);else res.end();}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,close:()=>new Promise(resolve=>server.close(()=>{db.close();resolve();}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const app=createApp();const port=Number(process.env.PORT||3000);app.server.listen(port,'0.0.0.0',()=>console.log('Three Card server listening on port '+port));
 for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{app.close().then(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
