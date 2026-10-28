'use strict';
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {initial,act,view}=require('./engine.cjs');
const {handleClub}=require('./club-server.cjs');
function shuffle(){const d=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=crypto.randomInt(0,i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
const rooms=new Map(),limits=new Map();
function clientView(r,i,code){const v=view(r.s,i,code,r.last);if(r.event){const {at,...event}=r.event;v.dealerEvent={...event,remaining:Math.max(0,event.duration-(Date.now()-at))};}return v;}
function recordDeal(r,shuffle,recipients){r.sequence=(r.sequence||0)+1;r.event={id:r.sequence,at:Date.now(),shuffle,recipients,duration:(shuffle?1000:0)+recipients.length*240+300};}const valid=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
function buildServer(){return http.createServer(async(req,res)=>{
const url=new URL(req.url,'http://localhost');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
function json(status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
try{
if(await handleClub(req,res))return;
if(url.pathname==='/health')return json(200,{ok:true,version:'2.1.0',apk:fs.existsSync(path.join(__dirname,'public/TenHalf-v1.0.apk'))});
if(!url.pathname.startsWith('/api/')){const routes={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/download.apk':'TenHalf-v1.0.apk','/download.zip':'TenHalf-v1.0.zip','/club.apk':'FriendsClub-v2.0.apk','/club.zip':'FriendsClub-v2.0.zip'};const file=routes[url.pathname];if(!file)return json(404,{error:'页面不存在'});const target=path.join(__dirname,'public',file);if(!fs.existsSync(target))return json(404,{error:'安装包尚未生成'});const mime=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.apk')?'application/vnd.android.package-archive':'application/zip';res.setHeader('Content-Type',mime);res.setHeader('Cache-Control',file.endsWith('.apk')||file.endsWith('.zip')?'public,max-age=300':'no-cache');if(file.endsWith('.apk')||file.endsWith('.zip'))res.setHeader('Content-Disposition','attachment; filename="'+file+'"');res.setHeader('Content-Length',fs.statSync(target).size);if(file.endsWith('.html'))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");if(req.method==='HEAD')return res.end();return fs.createReadStream(target).pipe(res);}
if(req.method!=='POST'&&req.method!=='GET')return json(405,{error:'请求方法错误'});
let body={};if(req.method==='POST'){const origin=req.headers.origin;if(origin&&origin!==url.origin&&origin!=='https://'+req.headers.host&&origin!=='http://'+req.headers.host)return json(403,{error:'来源无效'});let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return json(413,{error:'请求过大'});}try{body=JSON.parse(raw||'{}');}catch{return json(400,{error:'数据格式错误'});}}
const token=req.headers.authorization?.replace(/^Bearer /,'')||body.token;
if(!valid(token))return json(401,{error:'身份已失效，请重新加入'});
const now=Date.now(),ip=req.socket.remoteAddress;let bucket=limits.get(ip);if(!bucket||now-bucket.at>60000){bucket={at:now,count:0};limits.set(ip,bucket);}if(++bucket.count>600)return json(429,{error:'操作太频繁，请稍后'});
const code=String(body.code||url.searchParams.get('code')||'');
const cleanName=n=>typeof n==='string'&&n.trim()?n.trim().slice(0,12):'好友';
if(url.pathname==='/api/create'&&req.method==='POST'){for(const [c,r]of rooms){const i=r.s.tokens.indexOf(token);if(i>=0){r.last[i]=now;return json(200,clientView(r,i,c));}}if(rooms.size>=2000)return json(503,{error:'房间已满，请稍后'});let c;do{c=String(crypto.randomInt(100000,1000000));}while(rooms.has(c));const s=initial([token,null],[typeof body.name==='string'&&body.name.trim()?cleanName(body.name):'房主','好友']);const r={s,last:[now,0],at:now,ids:[new Set(),new Set()]};rooms.set(c,r);return json(200,clientView(r,0,c));}
const r=rooms.get(code);if(!r)return json(404,{error:'房间不存在或已过期，请重新创建',expired:true});
let i=r.s.tokens.indexOf(token);
if(url.pathname==='/api/join'&&req.method==='POST'){if(i<0){if(r.s.tokens[1])return json(409,{error:'房间已有两人'});i=1;r.s.tokens[1]=token;r.s.names[1]=cleanName(body.name);r.s.rev++;}r.last[i]=now;r.at=now;return json(200,clientView(r,i,code));}
if(i<0)return json(403,{error:'你不在这个房间'});r.last[i]=now;r.at=now;
if(url.pathname==='/api/state'&&req.method==='GET')return json(200,clientView(r,i,code));
if(url.pathname==='/api/action'&&req.method==='POST'){if(typeof body.id!=='string'||body.id.length>80)return json(400,{error:'请求编号无效'});if(r.ids[i].has(body.id))return json(200,clientView(r,i,code));if(body.rev!==r.s.rev)return json(409,{error:'对局已更新，请重试',state:clientView(r,i,code)});const type=body.action?.type,fresh=r.s.round===0||r.s.deck.length<2;act(r.s,i,body.action||{},shuffle);if(type==='start')recordDeal(r,fresh,[0,1]);else if(type==='deal'||type==='draw')recordDeal(r,false,[type==='deal'?1-r.s.dealer:r.s.dealer]);r.ids[i].add(body.id);if(r.ids[i].size>1000)r.ids[i].delete(r.ids[i].values().next().value);return json(200,clientView(r,i,code));}
return json(404,{error:'接口不存在'});
}catch(e){json(400,{error:e.message||'操作失败'});}});}
setInterval(()=>{const now=Date.now();for(const[c,r]of rooms)if(now-r.at>12*3600000)rooms.delete(c);for(const[k,v]of limits)if(now-v.at>120000)limits.delete(k);},60000).unref();
module.exports={buildServer};
if(require.main===module){const server=buildServer();server.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('Friends Club v2.0 unified-room listening'));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}
