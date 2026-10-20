'use strict';
const $=id=>document.getElementById(id);
let session=null,room=null,busy=false,polling=false,frameKey='',lastOk=0;
try{session=JSON.parse(localStorage.getItem('club-session')||'null');$('nickname').value=localStorage.getItem('club-name')||'';}catch{}
const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const names={card:'炸金花',dice:'大话骰',tenhalf:'十点半'};
function note(s){$('notice').textContent=s||'';}
function remember(){try{if(session)localStorage.setItem('club-session',JSON.stringify(session));else localStorage.removeItem('club-session');localStorage.setItem('club-name',$('nickname').value.trim());}catch{}}
async function api(path,body,token){const c=new AbortController(),timer=setTimeout(()=>c.abort(),65000);try{const r=await fetch('/club-api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:c.signal,cache:'no-store'});const data=await r.json();if(!r.ok){const e=Error(data.error||'请求失败');Object.assign(e,{status:r.status,state:data.state,expired:data.expired});throw e;}lastOk=Date.now();return data;}catch(e){if(e.name==='AbortError')throw Error('连接超时，请重试');throw e;}finally{clearTimeout(timer);}}
function render(){const inside=!!session&&!!room;$('entry').hidden=inside;$('room-bar').hidden=!inside;$('lobby').hidden=!inside||!!room?.selected;$('play').hidden=!inside||!room?.selected;$('back').hidden=!inside||!room?.selected;document.body.classList.toggle('in-game',inside&&!!room?.selected);
if(!inside){if(frameKey){$('game-frame').src='about:blank';frameKey='';}return;}
$('roomcode').textContent=room.code;$('connection').textContent=room.joined?(room.online[1-room.you]?'已连接 · 好友在线':'已连接 · 等待好友回来'):'房间已创建 · 等待好友加入';$('players').textContent=room.names[0]+' / '+(room.joined?room.names[1]:'等待好友');$('lobby-hint').textContent=room.joined?'选一个游戏，两个人一起进入；之后不用再输入房间码。':'把上面的房间码发给好友，对方只需输入这一次。';
for(const g of Object.keys(names)){$('pick-'+g).disabled=busy||!room.joined;const info=room.games[g];$('summary-'+g).textContent=info.round?'继续第 '+info.round+(g==='dice'?' 盅':' 局'):'进入游戏';}
const key=room.selected?room.selected+':'+room.epoch:'';if(key!==frameKey){frameKey=key;$('game-frame').src=key?'/club-game/'+room.selected+'/?epoch='+room.epoch:'about:blank';$('game-frame').title=room.selected?names[room.selected]:'游戏';}
}
function accept(v){if(room&&v.rev<room.rev)return;room=v;render();}
async function enter(create){if(busy)return;busy=true;$('create').disabled=$('join').disabled=true;note('正在连接，首次打开可能需要约1分钟…');const token=uid();try{const v=await api(create?'create':'join',{token,name:$('nickname').value,code:$('code').value.trim()});session={code:v.code,token};room=null;remember();accept(v);note('');}catch(e){note(e.message);}finally{busy=false;$('create').disabled=$('join').disabled=false;render();}}
async function select(game){if(busy||!session||!room)return;busy=true;render();const s=session;try{const v=await api('select',{code:s.code,id:uid().slice(0,24),rev:room.rev,game},s.token);if(session===s){accept(v);note('');}}catch(e){if(session===s){if(e.state)accept(e.state);note(e.message);}}finally{busy=false;render();}}
function forget(){session=null;room=null;remember();render();}
async function poll(){if(polling||busy||!session||document.hidden)return;polling=true;const s=session;try{const v=await api('state?code='+encodeURIComponent(s.code),null,s.token);if(session===s){accept(v);note('');}}catch(e){if(session===s){if(e.expired||[401,403,404].includes(e.status)){forget();note(e.message);}else{note('正在重连统一房间…');if(room&&Date.now()-lastOk>5000)$('connection').textContent='网络中断 · 重连中';}}}finally{polling=false;}}
$('create').onclick=()=>enter(true);$('join').onclick=()=>enter(false);for(const g of Object.keys(names))$('pick-'+g).onclick=()=>select(g);$('back').onclick=()=>select(null);$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(session.code);note('统一房间码已复制：'+session.code);}catch{note('统一房间码：'+session.code);}};
$('leave').onclick=async()=>{if(!session||!confirm('退出会结束这个统一房间，好友也需要重新进房。确定退出？'))return;const s=session;try{await api('leave',{code:s.code},s.token);forget();note('已退出房间。');}catch(e){note(e.message);}};
window.showClubLobby=()=>{if(room?.selected){select(null);return true;}return false;};window.clubBack=window.showClubLobby;
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});setInterval(poll,900);render();if(session){note('正在恢复统一房间…');poll();}
