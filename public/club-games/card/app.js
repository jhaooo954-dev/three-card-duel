'use strict';
(()=>{
const $=id=>document.getElementById(id);let session=null,state=null,busy=false,poll=null,failures=0,sound=false,ctx=null,requestSequence=0,lookExpanded=false;
const money=n=>Number(n).toLocaleString('en-US');
const resetButton=document.createElement('button');resetButton.className='btn secondary online-reset';resetButton.id='requestReset';resetButton.textContent='请求双方重置战绩';resetButton.hidden=true;document.querySelector('.control-panel').append(resetButton);
function remember(){if(session?.transport==='peer')return;try{if(session){localStorage.setItem('three-card-online',JSON.stringify(session));localStorage.setItem('three-card-seat-'+session.code,session.token);}else localStorage.removeItem('three-card-online');}catch{}}
function tone(){if(!sound)return;try{ctx??=new(window.AudioContext||window.webkitAudioContext)();ctx.resume();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=520;g.gain.setValueAtTime(.04,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.15);o.start();o.stop(ctx.currentTime+.16);}catch{}}
function card(c){const node=document.createElement('div');node.className='card'+(!c?' back':['♥','♦'].includes(c.suit)?' red':'');if(!c){node.setAttribute('aria-label','未展示的牌');return node;}const r={11:'J',12:'Q',13:'K',14:'A'}[c.rank]||c.rank;node.setAttribute('aria-label',c.suit+r);node.innerHTML='<span class="rank">'+r+'</span><span class="suit">'+c.suit+'</span><span class="big-suit">'+c.suit+'</span><span class="bottom">'+r+'</span>';return node;}
const lookChoices=document.createElement('div');lookChoices.className='look-choices';lookChoices.id='lookChoices';lookChoices.hidden=true;
for(let n=1;n<=3;n++){const b=document.createElement('button');b.className='btn secondary';b.id='look'+n;b.textContent='翻 '+n+' 张';b.addEventListener('click',()=>send('look'+n));lookChoices.append(b);}
$('actions').after(lookChoices);
function render(){
 const s=state,joined=!!session&&!!s;
 $('roomPanel').hidden=joined;$('roomBar').hidden=!joined;
 if(!joined){
  $('name1').textContent='好友';$('name0').textContent='你';$('actions').classList.remove('active');document.querySelector('.control-panel').classList.remove('playing');$('message').textContent='创建房间，邀请朋友来一局';$('deal').disabled=true;$('deal').innerHTML='先创建或加入房间 <span>↗</span>';
  ['cards0','cards1'].forEach(id=>{const n=$(id);n.replaceChildren();delete n.dataset.signature;for(let k=0;k<3;k++)n.append(card(null));});resetButton.hidden=true;lookChoices.hidden=true;return;
 }
 const dealer=s.dealer,myTurn=s.active&&s.turn===s.you&&!busy,looked=s.looked[s.you];
 $('deal').disabled=!s.joined||busy||s.you!==dealer||s.active;
 $('codeDisplay').textContent=session.code;$('round').textContent='第 '+String(s.round||1).padStart(2,'0')+' 局';$('betLabel').textContent='无底注 · 底分 '+s.base;$('pot').textContent=money(s.pot);$('message').textContent=s.message;
 $('turnMeta').textContent=s.active?'第 '+(s.steps+1)+' / 20 次行动 · '+(s.turn===s.you?'你的回合':'好友的回合'):!s.joined?'房间已就绪 · 等待好友加入':(s.round?'上局赢家请荷官开局':'第一局房主请荷官开局')+' · 对方先手';
 for(let slot=0;slot<2;slot++){
  const i=slot===0?s.you:1-s.you;$('name'+slot).textContent=(slot===0?'你':'好友')+(i===dealer?' · 开局方':'');$('bank'+slot).textContent=money(s.banks[i]);
  $('status'+slot).textContent=i===1&&!s.joined?'等待加入':s.active?(s.looked[i]?'已翻 '+s.looked[i]+' / 3 张':'闷牌中'):s.round?'本局结束 · 双方亮牌':'等待发牌';
  $('type'+slot).textContent=s.types[i];const h=s.hands[i].length?s.hands[i]:[null,null,null],cards=$('cards'+slot),signature=JSON.stringify(h);
  if(cards.dataset.signature!==signature){const previous=JSON.parse(cards.dataset.signature||'[]');cards.replaceChildren();h.forEach((c,k)=>{const node=card(c);if(c&&!previous[k])node.classList.add('turn-card');cards.append(node);});cards.dataset.signature=signature;}
  $('player'+slot).classList.toggle('active',s.active&&s.turn===i);$('player'+slot).classList.toggle('winner',!s.active&&s.winner===i);
 }
 $('player0').querySelector('.avatar').textContent='你';$('player1').querySelector('.avatar').textContent='友';
 $('wins').innerHTML=s.stats[s.you]+'<small>胜</small>';$('losses').innerHTML=s.stats[1-s.you]+'<small>负</small>';$('ties').innerHTML=s.stats[2]+'<small>平</small>';
 $('actions').classList.toggle('active',s.active);document.querySelector('.control-panel').classList.toggle('playing',s.active);
 ['fold','look','follow','raise','open'].forEach(id=>$(id).disabled=!myTurn);
 $('look').disabled=!myTurn||looked===3;$('look').innerHTML=looked===3?'已全翻<span>3 / 3 张</span>':'看牌<span>已翻 '+looked+' / 3 张</span>';$('look').setAttribute('aria-expanded',String(lookExpanded));$('look').setAttribute('aria-controls','lookChoices');
 if(!s.active||s.turn!==s.you)lookExpanded=false;lookChoices.hidden=!lookExpanded||!s.active||looked===3;
 for(let n=1;n<=3;n++)$('look'+n).disabled=!myTurn||n<=looked;
 $('follow').innerHTML=(looked?'跟注':'闷牌')+'<span>投入 '+s.callCost+'</span>';
 $('raise').innerHTML='加注<span>投入 '+s.raiseCost+'</span>';$('raise').disabled=!myTurn||s.base>=100;
 $('open').innerHTML='开牌<span>投入 '+s.openCost+'</span>';
 $('actionTitle').textContent=s.active?(busy?'正在同步…':myTurn?'轮到你了':'等待好友操作'):!s.joined?'分享房间码，等待好友':s.you===dealer?'请荷官发牌，对方先手':'等好友请荷官发牌，你将先手';
 $('actionHint').textContent=s.active?'可翻 1 / 2 / 3 张 · 看牌按闷牌 2 倍 · 开牌不额外翻倍':'无底注 · 下局发牌清零 · 胜者请荷官开局，对方先手';
 $('deal').innerHTML=(!s.joined?'等待好友加入':s.you!==dealer?'等好友请荷官发牌':s.round?'请荷官发下一局':'请荷官洗牌、发牌')+' <span>↗</span>';
 resetButton.hidden=s.active||!s.joined;const requested=s.resetRequests.includes(s.you),other=s.resetRequests.includes(1-s.you);resetButton.disabled=busy||requested;resetButton.textContent=requested?'已请求重置战绩，等待好友同意':other?'好友请求重置战绩 · 点击同意':'请求双方重置战绩';
 const l=$('log');l.replaceChildren();s.logs.forEach(t=>{const e=document.createElement('div');e.className='log-item';e.textContent=t;l.append(e);});
}

async function api(method,body){if(method==='POST'&&body?.type!=='action')throw Error('请从统一大厅创建或加入房间');const headers={'Content-Type':'application/json'};if(session?.token)headers.Authorization='Bearer '+session.token;const url='/club-api/game/card/'+(method==='GET'?'state?code='+encodeURIComponent(session.code):'action');const payload=method==='POST'?{code:session.code,id:crypto.randomUUID(),rev:body.revision,action:body.action,epoch:Number(new URLSearchParams(location.search).get('epoch')||0)}:undefined;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(url,{method,headers,body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:controller.signal});const data=await r.json();if(!r.ok){const e=Error(data.error||'请求失败');e.state=data.state;throw e;}return method==='POST'?{state:data}:data;}finally{clearTimeout(timer);}}
let lastLiveUpdate=0;
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='club-live-state'||e.data.game!=='card'||e.data.epoch!==Number(new URLSearchParams(location.search).get('epoch')||0)||e.data.code!==session?.code||!e.data.state)return;lastLiveUpdate=Date.now();accept(e.data.state);});
if(window.parent!==window)parent.postMessage({type:'club-live-ready'},location.origin);
function accept(s){if(s.rulesVersion!==3)throw Error('玩法已更新，请刷新网页或更新至 v1.2 App');if(!state||s.code!==state.code||s.revision>=state.revision){if(state&&s.revision>state.revision){tone();s.banks.forEach((n,i)=>{if(n>state.banks[i])window.TableDealer?.bet?.(i===s.you?0:1,n-state.banks[i]);});if(state.active&&!s.active&&s.winner!==null)window.TableDealer?.collect?.(s.winner===s.you?0:1);}state=s;}window.TableDealer?.update(state.dealerEvent,state.you);failures=0;$('connection').textContent=session?.transport==='peer'?'直连对战':'实时同步';render();}
function beginPoll(){clearTimeout(poll);const tick=async()=>{if(!session)return;if(!busy&&Date.now()-lastLiveUpdate>12000&&document.visibilityState!=='hidden'){const seq=requestSequence;try{const s=await api('GET');if(seq===requestSequence&&session)accept(s);}catch(e){failures++;$('connection').textContent=failures>2?'网络中断 · 重连中':'正在重连…';}}poll=setTimeout(tick,1500);};poll=setTimeout(tick,900);}
async function enter(type){if(busy)return;const code=$('roomCodeInput').value.trim().toUpperCase();if(type==='join'&&!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){$('roomError').textContent='请输入 6 位房间码（字母和数字）';return;}busy=true;$('createRoom').disabled=true;$('joinRoom').disabled=true;$('roomError').textContent='';const previousSession=session;try{if(type==='join'){const saved=localStorage.getItem('three-card-seat-'+code);if(saved)session={code,token:saved};}const d=await api('POST',{type,code});session={code:d.state.code,token:d.token||session?.token};requestSequence++;state=null;remember();accept(d.state);history.replaceState(null,'',location.pathname+'?room='+session.code);beginPoll();}catch(e){session=previousSession;$('roomError').textContent=e.message;}finally{busy=false;$('createRoom').disabled=false;$('joinRoom').disabled=false;render();}}
async function send(action){if(busy||!session||!state)return;let errorMessage='';busy=true;requestSequence++;render();const clicked={follow:'闷牌 / 跟注',raise:'加注',open:'开牌',fold:'弃牌',deal:'发牌',reset:'重置战绩'}[action]||'看牌';$('actionTitle').textContent=clicked+'已提交…';document.querySelector('.control-panel').setAttribute('aria-busy','true');try{const d=await api('POST',{type:'action',code:session.code,revision:state.revision,action});accept(d.state);}catch(e){errorMessage=e.message;$('message').textContent=e.message;try{accept(await api('GET'));}catch{}$('actionHint').textContent=e.message;}finally{busy=false;document.querySelector('.control-panel').setAttribute('aria-busy','false');render();if(errorMessage)$('actionHint').textContent=errorMessage;}}
$('createRoom').addEventListener('click',()=>enter('create'));$('joinRoom').addEventListener('click',()=>enter('join'));$('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')enter('join');});
['fold','follow','raise','open'].forEach(a=>$(a).addEventListener('click',()=>send(a)));$('look').addEventListener('click',()=>{lookExpanded=!lookExpanded;render();});$('deal').addEventListener('click',()=>send('deal'));resetButton.addEventListener('click',()=>send('reset'));
$('shareRoom').addEventListener('click',async()=>{if(session?.transport==='peer'){window.PeerDuel.info();return;}const url=window.Android?'threecard://join?room='+session.code:location.origin+'/?room='+session.code;const data={title:'来玩一局双人炸金花',text:'房间码：'+session.code,url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText('来玩一局三张牌，房间码 '+session.code+'\n'+url);$('shareRoom').textContent='已复制';setTimeout(()=>$('shareRoom').textContent='分享房间',2200);}}catch(e){if(e.name!=='AbortError'){$('actionHint').textContent='房间码 '+session.code+'，可直接发给好友';}}});
window.addEventListener('peer-connected',e=>{clearTimeout(poll);session={...e.detail,transport:'peer'};state=null;requestSequence++;busy=false;accept(e.detail.state);beginPoll();});window.addEventListener('peer-state',e=>{if(session?.transport==='peer')accept(e.detail);});
$('leaveRoom').addEventListener('click',()=>{if(!confirm('退出当前房间？此设备会保留身份，可用房间码重新加入。'))return;clearTimeout(poll);requestSequence++;if(session?.transport==='peer')window.PeerDuel.close();session=null;state=null;remember();history.replaceState(null,'',location.pathname);location.reload();});
$('rulesBtn').addEventListener('click',()=>$('rules').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));$('sound').addEventListener('click',()=>{sound=!sound;$('soundMark').textContent=sound?'开':'关';tone();});
const invite=new URLSearchParams(location.search).get('room');if(invite)$('roomCodeInput').value=invite.toUpperCase();
(async()=>{try{const old=JSON.parse(localStorage.getItem('club-session'));if(old?.token&&old.code&&(!invite||old.code===invite.toUpperCase())){session=old;busy=true;render();const s=await api('GET');accept(s);beginPoll();}}catch(e){session=null;state=null;remember();$('roomError').textContent='上次房间无法恢复，请创建或加入房间';}finally{busy=false;render();}})();
})();
