'use strict';
const $=id=>document.getElementById(id);
const standaloneAndroid=typeof location!=='undefined' && location.hostname==='appassets.androidplatform.net';
let solo=false;
let session=null,room=null,busy=false,polling=false,frameKey='',lastOk=0;
try{session=JSON.parse(localStorage.getItem('club-session')||'null');$('nickname').value=localStorage.getItem('club-name')||'';}catch{}
const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const names={card:'炸金花',dice:'大话骰',tenhalf:'十点半',gomoku:'五子棋',landlord:'不洗牌斗地主'};
function note(s){$('notice').textContent=s||'';}
function remember(){if(solo)return;try{if(session)localStorage.setItem('club-session',JSON.stringify(session));else localStorage.removeItem('club-session');localStorage.setItem('club-name',$('nickname').value.trim());}catch{}}
async function api(path,body,token){if(solo){const response=await window.clubPractice.fetch('/club-api/'+path,{body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error),{state:value.state,status:response.status});return value;}const c=new AbortController(),timer=setTimeout(()=>c.abort(),/^(create|join)$/.test(path)?65000:8000);try{const r=await fetch('/club-api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:c.signal,cache:'no-store'});const data=await r.json();if(!r.ok){const e=Error(data.error||'请求失败');Object.assign(e,{status:r.status,state:data.state,expired:data.expired});throw e;}lastOk=Date.now();return data;}catch(e){if(e.name==='AbortError')throw Error('连接超时，请重试');throw e;}finally{clearTimeout(timer);}}
let liveAbort=null,liveSession=null,liveRetry=null,liveTimeout=null,liveConnected=false,liveGame=null;
function frameMatches(game){return game?.game&&room?.code===game.code&&room.selected===game.game&&room.epoch===game.epoch;}
function postToGame(message){$('game-frame').contentWindow?.postMessage(message,location.origin);}
function forwardGame(actionId){
 if(!frameMatches(liveGame))return;
 const {receivedAt,state, ...game}=liveGame,age=Date.now()-receivedAt;
 const current={...state};
 if(current.dealerEvent)current.dealerEvent={...current.dealerEvent,remaining:Math.max(0,current.dealerEvent.remaining-age)};
 if(current.rollRemaining)current.rollRemaining=Math.max(0,current.rollRemaining-age);
 postToGame({type:'club-live-state',...game,state:current,actionId});
}
function forwardStatus(){
 if(room?.selected)postToGame({type:'club-live-status',game:room.selected,epoch:room.epoch,code:room.code,connected:liveConnected&&!!frameMatches(liveGame)});
}
function stopLive(){
 liveAbort?.abort();liveAbort=null;liveSession=null;liveConnected=false;liveGame=null;
 clearTimeout(liveRetry);clearTimeout(liveTimeout);
}
async function connectLive(){
 if(document.hidden||solo)return;
 if(typeof TextDecoder==='undefined'||typeof ReadableStream==='undefined'||!session||liveSession===session)return;
 clearTimeout(liveRetry);
 const saved=session,controller=new AbortController();liveSession=saved;liveAbort=controller;
 function watchStream(){clearTimeout(liveTimeout);liveTimeout=setTimeout(()=>controller.abort(),20000);}
 watchStream();
 try{
  const response=await fetch('/club-api/events?code='+encodeURIComponent(saved.code),{headers:{Authorization:'Bearer '+saved.token},signal:controller.signal,cache:'no-store'});
  if(!response.ok||!response.body)throw Error('stream unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  while(session===saved&&!controller.signal.aborted){
   const chunk=await reader.read();if(chunk.done||session!==saved||controller.signal.aborted)break;
   buffer+=decoder.decode(chunk.value,{stream:true});let end;
   while((end=buffer.indexOf('\n\n'))>=0){
    const packet=buffer.slice(0,end);buffer=buffer.slice(end+2);
    const line=packet.split('\n').find(v=>v.startsWith('data: '));
    if(line){
     const v=JSON.parse(line.slice(6));
     const previous=liveGame;
     const becameLive=!liveConnected;
     liveConnected=true;lastOk=Date.now();watchStream();
     accept(v.room);
     if(room.code!==v.room.code||room.epoch!==v.room.epoch||room.selected!==v.game)continue;
     liveGame={game:v.game,state:v.state,epoch:v.room.epoch,code:v.room.code,receivedAt:Date.now()};
     forwardGame(v.actionId);
     if(becameLive||!frameMatches(previous))forwardStatus();
    }else if(packet.startsWith(': heartbeat')){lastOk=Date.now();watchStream();}
   }
  }
 }catch{}finally{
  if(liveAbort===controller){
   clearTimeout(liveTimeout);liveSession=null;liveAbort=null;liveConnected=false;liveGame=null;
   forwardStatus();if(!document.hidden)liveRetry=setTimeout(connectLive,1200);
  }
 }
}
window.addEventListener?.('message',e=>{
 if(e.origin===location.origin&&e.source===$('game-frame').contentWindow&&e.data?.type==='club-live-ready'){if(solo){window.clubPractice.notify();return;}forwardGame();forwardStatus();}
});
function render(){document.body.classList.toggle('practice-room',solo);const inside=!!session&&!!room;
$('copy').hidden=solo;$('share').hidden=solo;$('entry').hidden=inside;$('room-bar').hidden=!inside;$('lobby').hidden=!inside||!!room?.selected;$('play').hidden=!inside||!room?.selected;$('back').hidden=!inside||!room?.selected;document.body.classList.toggle('in-game',inside&&!!room?.selected);
if(!inside){if(frameKey){$('game-frame').src='about:blank';frameKey='';syncMusic();}return;}
const count=room.playerCount||2,members=room.memberCount??(room.joined?2:1),others=room.names.map((_,i)=>i).filter(i=>i!==room.you&&room.online[i]);
$('roomcode').textContent=room.code;$('connection').textContent=solo?'单人练习 · '+(count-1)+' 位机器人':room.joined?'已连接 · '+members+'人已入座 · '+others.length+'位好友在线':'已入座 '+members+' / '+count+' 人 · 等待好友';$('players').textContent=room.names.map((n,i)=>i<members?n:'等待好友').join(' / ');$('lobby-hint').textContent=solo?'选择游戏，机器人会和你一起换桌。':room.joined?'选一个游戏，全员一起进入；之后不用再输入房间码。':'把上面的房间码发给好友，等待'+count+'人到齐。';
$('room-mode').value=String(count);$('room-mode').disabled=busy||room.you!==0||!room.canChangeMode||members>2;$('mode-hint').textContent=members>2?'三人已入座':room.canChangeMode?'开局前房主可选择双人或三人；三人模式需等三人到齐。':'本房间已开局，人数保持不变';
for(const g of Object.keys(names)){$('pick-'+g).disabled=busy||!room.joined||(g==='landlord'&&count!==3);const info=room.games[g];$('summary-'+g).textContent=g==='landlord'&&count!==3?'请创建三人房间':info.round?'继续第 '+info.round+(g==='dice'?' 盅':' 局'):'进入游戏';}
const key=room.selected?room.selected+':'+room.epoch:'';if(key!==frameKey){frameKey=key;$('game-frame').src=key?'/club-game/'+room.selected+'/?epoch='+room.epoch+(solo?'&practice=1':''):'about:blank';$('game-frame').title=room.selected?names[room.selected]:'游戏';syncMusic();}
}
function accept(v){
 if(room&&v.rev<room.rev)return;
 const changed=JSON.stringify(room)!==JSON.stringify(v);
 room=v;if(changed)render();
 connectLive();
}
async function enter(create){if(busy)return;
 if(standaloneAndroid){
  const params=new URLSearchParams({mode:create?'create':'join',name:$('nickname').value.trim(),players:$('player-count').value});
  if(!create)params.set('room',$('code').value.trim());
  location.href='https://ten-half-duel-jh.onrender.com/club/?'+params;return;
 }busy=true;$('create').disabled=$('join').disabled=true;note('正在连接，首次打开可能需要约1分钟…');const token=uid();try{const v=await api(create?'create':'join',{token,name:$('nickname').value,code:$('code').value.trim(),playerCount:Number($('player-count').value||2)});session={code:v.code,token};room=null;remember();accept(v);note('');}catch(e){note(e.message);}finally{busy=false;$('create').disabled=$('join').disabled=false;render();}}
async function select(game){if(busy||!session||!room)return;if(game)syncMusic(game);busy=true;render();const s=session;try{const v=await api('select',{code:s.code,id:uid().slice(0,24),rev:room.rev,game},s.token);if(session===s){accept(v);note('');}}catch(e){if(session===s){if(e.state)accept(e.state);note(e.message);}}finally{busy=false;render();syncMusic();}}
async function changeMode(){if(busy||!session||!room)return;busy=true;const count=Number($('room-mode').value),s=session;render();try{const v=await api('mode',{code:s.code,rev:room.rev,playerCount:count},s.token);if(session===s){accept(v);note('');}}catch(e){if(e.state)accept(e.state);note(e.message);}finally{busy=false;render();}}
$('room-mode').onchange=changeMode;
function forget(){stopLive();if(solo){solo=false;session=null;room=null;render();return;}session=null;room=null;remember();render();}
async function poll(){if(liveConnected||solo)return;if(polling||busy||!session||document.hidden)return;polling=true;const s=session;try{const v=await api('state?code='+encodeURIComponent(s.code),null,s.token);if(session===s){accept(v);note('');}}catch(e){if(session===s){if(e.expired||[401,403,404].includes(e.status)){forget();note(e.message);}else{note('正在重连统一房间…');if(room&&Date.now()-lastOk>5000)$('connection').textContent='网络中断 · 重连中';}}}finally{polling=false;}}
$('create').onclick=()=>enter(true);$('join').onclick=()=>enter(false);for(const g of Object.keys(names))$('pick-'+g).onclick=()=>select(g);$('back').onclick=()=>select(null);$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(session.code);note('统一房间码已复制：'+session.code);}catch{note('统一房间码：'+session.code);}};
$('leave').onclick=async()=>{if(!session||!confirm(solo?'结束这次单人练习？':'退出会结束这个统一房间，好友也需要重新进房。确定退出？'))return;const s=session;try{await api('leave',{code:s.code},s.token);forget();note('已退出房间。');}catch(e){note(e.message);}};
window.showClubLobby=()=>{if(room?.selected){select(null);return true;}return false;};window.clubBack=window.showClubLobby;
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLive();else{connectLive();poll();}});
window.addEventListener?.('online',()=>{connectLive();poll();});
window.addEventListener?.('offline',()=>{stopLive();if(room)$('connection').textContent='已断网 · 保留房间，联网后自动恢复';});setInterval(poll,900);

// Device-local presentation options never modify the room or its rules.
let preferences={reduced:false,night:false,sound:false,music:true};
try {
 const saved=JSON.parse(localStorage.getItem('club-preferences')||'{}');
 Object.assign(preferences,saved,{music:saved.musicChosen ? !!saved.music : true});
} catch {}
function applyPreferences(){
 document.body.classList.toggle('low-motion',preferences.reduced);document.body.classList.toggle('night-theme',preferences.night);
 $('reduce-motion').checked=preferences.reduced;$('night-theme').checked=preferences.night;$('club-sound').checked=preferences.sound;$('club-music').checked=preferences.music;
 try{localStorage.setItem('club-preferences',JSON.stringify(preferences));}catch{}
 if(room?.selected)postToGame({type:'club-preferences',preferences});
}
$('preferences').onclick=()=>$('settings-dialog').showModal();$('close-settings').onclick=()=>$('settings-dialog').close();
for(const [id,key] of [['reduce-motion','reduced'],['night-theme','night'],['club-sound','sound']]) {
 $(id).onchange=e=>{preferences[key]=e.target.checked;applyPreferences();};
}
function setMusic(enabled){
 preferences.music=enabled;
 preferences.musicChosen=true;
 applyPreferences();
 syncMusic();
}
$('club-music').onchange=e=>setMusic(e.target.checked);
$('music-toggle').onclick=()=>setMusic(!preferences.music||musicNeedsTap);
$('share').onclick=async()=>{if(!session)return;const text='来游戏厅玩一局，房间码 '+session.code;const url=location.origin+'/club/?room='+session.code;try{if(navigator.share)await navigator.share({title:'游戏厅',text,url});else{await navigator.clipboard.writeText(text+'\n'+url);note('邀请已复制，发给好友即可');}}catch(e){if(e.name!=='AbortError')note('房间码 '+session.code+'，发给好友即可');}};
$('latency-test').onclick=async()=>{const b=$('latency-test');b.disabled=true;$('latency-result').textContent='正在检测当前服务…';const times=[];try{for(let i=0;i<3;i++){const t=performance.now();const r=await fetch('/health',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('服务暂不可用');await r.json();times.push(Math.round(performance.now()-t));}const sorted=[...times].sort((a,b)=>a-b);$('latency-result').textContent='中位 '+sorted[1]+' ms · '+times.join(' / ')+' ms';}catch(e){$('latency-result').textContent='检测未完成，请检查网络或稍后重试';}finally{b.disabled=false;}};
const musicPlayer=$('room-music');
const musicGames=new Set(['card','dice','tenhalf']);
const musicButton=$('music-toggle');
let musicTrack=null,musicNeedsTap=false,musicAttempt=0;
function musicStatus(text,retry=false){
 musicNeedsTap=retry;
 $('music-status').textContent=text;
 musicButton.textContent=retry?'♫!':preferences.music?'♫':'♫̸';
 musicButton.title=retry?'点击播放音乐':preferences.music?'关闭牌桌音乐':'开启牌桌音乐';
 musicButton.setAttribute('aria-label',musicButton.title);
 musicButton.setAttribute('aria-pressed',String(preferences.music));
}
function syncMusic(game=room?.selected){
 if(!preferences.music||document.hidden||!musicGames.has(game)){
  musicAttempt++;
  musicPlayer.pause();
  musicStatus(preferences.music?'开启后进入牌桌时播放':'音乐已关闭');
  return;
 }
 if(musicTrack!==game){
  musicTrack=game;
  musicPlayer.src='/club/music-'+game+(standaloneAndroid?'.flac':'.mp3');
  musicPlayer.volume=.35;
 }
 if(musicPlayer.error)musicPlayer.load();
 const attempt=++musicAttempt;
 musicPlayer.play().then(()=>{
  if(attempt===musicAttempt)musicStatus('当前配乐正在播放');
 }).catch(error=>{
  if(attempt!==musicAttempt||error.name==='AbortError')return;
  musicStatus(error.name==='NotAllowedError'?'点击顶部音乐按钮开始播放':'配乐暂时无法播放，点击顶部按钮重试',true);
 });
}
musicPlayer.addEventListener('error',()=>{
 if(standaloneAndroid&&musicPlayer.getAttribute('src')?.endsWith('.flac')){
  musicPlayer.src='/club/music-'+musicTrack+'.mp3';
  syncMusic(musicTrack);
 }
});
document.addEventListener('visibilitychange',()=>syncMusic());
$('practice').onclick=()=>{$('practice-choices').hidden=!$('practice-choices').hidden;};
document.querySelectorAll?.('[data-practice]').forEach(button=>button.onclick=async()=>{
 if(busy)return;
 const count=Number($('player-count').value)||2;
 solo=true;stopLive();room=window.clubPractice.create(count,$('nickname').value.trim());
 session={code:room.code,token:'practice'};
 localStorage.setItem('club-practice-session',JSON.stringify(session));
 await select(button.dataset.practice);
});
if(standaloneAndroid)document.body.classList.add('native-offline');
applyPreferences();
syncMusic();
render();
if(session){note('正在恢复统一房间…');poll();}
if(typeof URLSearchParams!=='undefined'&&typeof location!=='undefined'){const invite=new URLSearchParams(location.search).get('room');if(invite&&/^\d{6}$/.test(invite))$('code').value=invite;
 const params=new URLSearchParams(location.search);
 if(!standaloneAndroid&&params.has('mode')&&!session){
  $('nickname').value=params.get('name')||'';
  $('player-count').value=params.get('players')==='3'?'3':'2';
  if(params.get('mode')==='create'||/^\d{6}$/.test(invite||''))void enter(params.get('mode')==='create');
 }
}
