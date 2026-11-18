'use strict';
(()=>{
const $=id=>document.getElementById(id);let session=null,state=null,busy=false,poll=null,failures=0,sound=false,ctx=null,lookExpanded=false,openExpanded=false,polling=false,pendingAction=null,actionError='',renderedLogs='';
const epoch=Number(new URLSearchParams(location.search).get('epoch')||0);
function seats(s){return [s.you,...s.hands.map((_,i)=>i).filter(i=>i!==s.you)];}
const money=n=>Number(n).toLocaleString('en-US');
const resetButton=document.createElement('button');resetButton.className='btn secondary online-reset';resetButton.id='requestReset';resetButton.textContent='请求全员重置战绩';resetButton.hidden=true;document.querySelector('.control-panel').append(resetButton);
function remember(){if(session?.transport==='peer')return;try{if(session){localStorage.setItem('three-card-online',JSON.stringify(session));localStorage.setItem('three-card-seat-'+session.code,session.token);}else localStorage.removeItem('three-card-online');}catch{}}
function tone(){if(!sound)return;try{ctx??=new(window.AudioContext||window.webkitAudioContext)();ctx.resume();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=520;g.gain.setValueAtTime(.04,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.15);o.start();o.stop(ctx.currentTime+.16);}catch{}}
function card(c){const node=document.createElement('div');node.className='card'+(!c?' back':['♥','♦'].includes(c.suit)?' red':'');if(!c){node.setAttribute('aria-label','未展示的牌');return node;}const r={11:'J',12:'Q',13:'K',14:'A'}[c.rank]||c.rank;node.setAttribute('aria-label',c.suit+r);node.innerHTML='<span class="rank">'+r+'</span><span class="suit">'+c.suit+'</span><span class="big-suit">'+c.suit+'</span><span class="bottom">'+r+'</span>';return node;}
const lookChoices=document.createElement('div');lookChoices.className='look-choices';lookChoices.id='lookChoices';lookChoices.hidden=true;
for(let n=1;n<=3;n++){const b=document.createElement('button');b.className='btn secondary';b.id='look'+n;b.textContent='翻 '+n+' 张';b.addEventListener('click',()=>send('look'+n));lookChoices.append(b);}
$('actions').after(lookChoices);
const openChoices=document.createElement('div');openChoices.className='look-choices';openChoices.id='openChoices';openChoices.hidden=true;openChoices.setAttribute('aria-label','选择要开牌的一家');lookChoices.after(openChoices);
const openButtons=[0,1,2].map(target=>{
 const button=document.createElement('button');
 button.className='btn gold';button.hidden=true;
 button.addEventListener('click',()=>send({type:'open',target}));
 openChoices.append(button);return button;
});
function openTargets(s){return s.hands.map((_,i)=>i).filter(i=>i!==s.you&&!s.folded?.[i]);}
function chooseOpen(){
 if(busy||!state?.active||state.turn!==state.you)return;
 const targets=openTargets(state);
 if(state.targetedOpen&&state.looked[state.you]>0&&targets.length>1){actionError='';openExpanded=!openExpanded;lookExpanded=false;render();}
 else send('open');
}

function render(){
 const s=state,joined=!!session&&!!s;
 $('roomPanel').hidden=joined;$('roomBar').hidden=!joined;
 if(!joined){
  $('name1').textContent='好友';$('name0').textContent='你';$('actions').classList.remove('active');document.querySelector('.control-panel').classList.remove('playing');$('message').textContent='创建房间，邀请朋友来一局';$('deal').disabled=true;$('deal').innerHTML='先创建或加入房间 <span>↗</span>';
  ['cards0','cards1'].forEach(id=>{const n=$(id);n.replaceChildren();delete n.dataset.signature;for(let k=0;k<3;k++)n.append(card(null));});resetButton.hidden=true;lookChoices.hidden=true;openChoices.hidden=true;return;
 }
 const order=seats(s);if(s.hands.length===3&&!$('player2')){const extra=$('player1').cloneNode(true);extra.id='player2';for(const el of extra.querySelectorAll('[id]'))el.id=el.id.replace(/1$/,'2');extra.classList.add('third');$('player1').after(extra);}document.body.classList.toggle('three-player',s.hands.length===3);document.title=s.hands.length===3?'三张 · 三人炸金花':'三张 · 双人炸金花';
 const dealer=s.dealer,first=(dealer+1)%s.hands.length,canAct=s.active&&s.turn===s.you,myTurn=canAct&&!busy,looked=s.looked[s.you];
 $('deal').disabled=!s.joined||busy||s.you!==dealer||s.active;
 $('codeDisplay').textContent=session.code;$('round').textContent='第 '+String(s.round||1).padStart(2,'0')+' 局';$('betLabel').textContent='无底注 · 底分 '+s.base;$('pot').textContent=money(s.pot);$('message').textContent=s.message;
 $('turnMeta').textContent=s.active?'第 '+(s.steps+1)+(s.actionLimit?' / '+s.actionLimit:'')+' 次行动 · '+(s.turn===s.you?'你的回合':'好友的回合'):!s.joined?'房间已就绪 · 等待好友加入':(s.round?'上局赢家请荷官开局':'第一局房主请荷官开局')+' · '+(s.hands.length===2?'对方':s.names?.[first]||'下家')+'先手';
 for(let slot=0;slot<s.hands.length;slot++){
  const i=order[slot];$('player'+slot).dataset.seat=i;$('name'+slot).textContent=(i===s.you?'你':s.names?.[i]||'玩家'+(i+1))+(i===dealer?' · 开局方':'');$('bank'+slot).textContent=money(s.banks[i]);
  $('status'+slot).textContent=i===1&&!s.joined?'等待加入':s.active?(s.folded?.[i]?'已弃牌':s.looked[i]?'已翻 '+s.looked[i]+' / 3 张':'闷牌中'):s.round?'本局结束 · 全员亮牌':'等待发牌';
  $('type'+slot).textContent=s.types[i];const h=s.hands[i].length?s.hands[i]:[null,null,null],cards=$('cards'+slot),signature=JSON.stringify(h);
  if(cards.dataset.signature!==signature){const previous=JSON.parse(cards.dataset.signature||'[]');cards.replaceChildren();h.forEach((c,k)=>{const node=card(c);if(c&&!previous[k])node.classList.add('turn-card');cards.append(node);});cards.dataset.signature=signature;}
  $('player'+slot).classList.toggle('active',s.active&&s.turn===i);$('player'+slot).classList.toggle('winner',!s.active&&s.winner===i);
 }
 $('player0').querySelector('.avatar').textContent='你';$('player1').querySelector('.avatar').textContent='友';
 $('wins').innerHTML=s.stats[s.you]+'<small>胜</small>';$('losses').innerHTML=s.stats.slice(0,s.hands.length).reduce((n,v,i)=>n+(i===s.you?0:v),0)+'<small>负</small>';$('ties').innerHTML=s.stats[s.hands.length]+'<small>平</small>';
 $('actions').classList.toggle('active',s.active);document.querySelector('.control-panel').classList.toggle('playing',s.active);
 ['fold','look','follow','raise','open'].forEach(id=>$(id).disabled=!myTurn);
 $('look').disabled=!myTurn||looked===3;$('look').innerHTML=looked===3?'已全翻<span>3 / 3 张</span>':'看牌<span>已翻 '+looked+' / 3 张</span>';if(!canAct||looked===3)lookExpanded=false;
 $('look').setAttribute('aria-expanded',String(lookExpanded));$('look').setAttribute('aria-controls','lookChoices');lookChoices.hidden=!lookExpanded;
 for(let n=1;n<=3;n++)$('look'+n).disabled=!myTurn||n<=looked;
 $('follow').innerHTML=(looked?'跟注':'闷牌')+'<span>投入 '+s.callCost+'</span>';
 $('raise').innerHTML='加注<span>投入 '+s.raiseCost+'</span>';$('raise').disabled=!myTurn||s.base>=100;
 const canChoose=s.targetedOpen&&looked>0&&openTargets(s).length>1;
 if(!canAct||!canChoose)openExpanded=false;
 $('open').innerHTML=(canChoose?'选择一家开牌':'开牌')+'<span>投入 '+s.openCost+'</span>';
 $('open').setAttribute('aria-expanded',String(openExpanded));$('open').setAttribute('aria-controls','openChoices');
 openChoices.hidden=!openExpanded;
 const targets=openTargets(s);
 openButtons.forEach((button,target)=>{
  button.hidden=!targets.includes(target);button.disabled=!myTurn||button.hidden;
  const label='开 '+(s.names?.[target]||'玩家'+(target+1));
  if(button.textContent!==label)button.textContent=label;
 });

 $('actionTitle').textContent=pendingAction?pendingAction.label+'已提交，等待确认…':s.active?(myTurn?'轮到你了':'等待好友操作'):!s.joined?'分享房间码，等待好友':s.you===dealer?'请荷官发牌，下家先手':s.you===first?'等好友请荷官发牌，你将先手':'等好友请荷官发牌，按座次行动';
 $('actionHint').textContent=actionError||(s.active?(s.hands.length===3?'看牌后可选择一家开牌 · 输家退出，其余继续':'可翻 1 / 2 / 3 张 · 看牌按闷牌 2 倍 · 开牌不额外翻倍'):'无底注 · 下局发牌清零 · 胜者请荷官开局，下家先手');
 $('deal').innerHTML=(!s.joined?'等待好友加入':s.you!==dealer?'等好友请荷官发牌':s.round?'请荷官发下一局':'请荷官洗牌、发牌')+' <span>↗</span>';
 resetButton.hidden=s.active||!s.joined;const requested=s.resetRequests.includes(s.you),other=s.resetRequests.some(i=>i!==s.you);resetButton.disabled=busy||requested;resetButton.textContent=requested?'已请求重置战绩，等待好友同意':other?'好友请求重置战绩 · 点击同意':'请求全员重置战绩';
 const logKey=JSON.stringify(s.logs);
 if(logKey!==renderedLogs){
  renderedLogs=logKey;
  $('log').replaceChildren(...s.logs.map(text=>{const item=document.createElement('div');item.className='log-item';item.textContent=text;return item;}));
 }
}

async function api(method,body){
 if(method==='POST'&&body?.type!=='action')throw Error('请从统一大厅创建或加入房间');
 const headers={Authorization:'Bearer '+session.token};
 if(method==='POST')headers['Content-Type']='application/json';
 const url='/club-api/game/card/'+(method==='GET'?'state?code='+encodeURIComponent(session.code):'action');
 const payload=method==='POST'?{code:session.code,id:body.id,rev:body.revision,action:body.action,epoch}:undefined;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),method==='POST'?6000:5000);
 try{
  const response=await fetch(url,{method,headers,body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:controller.signal});
  const data=await response.json();
  if(!response.ok){
   const error=Error(data.error||'请求失败');
   Object.assign(error,{state:data.state,status:response.status});
   throw error;
  }
  return method==='POST'?{state:data}:data;
 }finally{clearTimeout(timer);}
}
function accept(s){
 if(s.rulesVersion!==3)throw Error('玩法已更新，请重新打开游戏');
 if(state&&s.code===state.code&&s.revision<state.revision)return false;
 if(failures||!state)$('connection').textContent=session?.transport==='peer'?'直连对战':'实时同步';
 failures=0;
 if(state&&s.code===state.code&&s.revision===state.revision)return false;
 const previous=state;state=s;
 if(previous&&s.code===previous.code&&s.revision>previous.revision){
  if(actionError)actionError='';
  if(!document.hidden){
   tone();
   s.banks.forEach((n,i)=>{if(n>previous.banks[i])window.TableDealer?.bet?.(seats(s).indexOf(i),n-previous.banks[i]);});
   if(previous.active&&!s.active&&s.winner!==null)window.TableDealer?.collect?.(seats(s).indexOf(s.winner));
  }
 }
 render();
 window.TableDealer?.update(s.dealerEvent,s.you);
 return true;
}
const isLive=window.watchClubGame('card',()=>session,(snapshot,actionId)=>{
 accept(snapshot);
 if(pendingAction?.id===actionId&&pendingAction)finishAction(pendingAction);
});
async function pollState(force=false){
 if(!session||polling||document.hidden||(!force&&(busy||isLive())))return;
 const saved=session;polling=true;
 try{const s=await api('GET');if(session===saved)accept(s);}
 catch(error){
  if(session!==saved||isLive())return;
  failures++;
  if([401,403,404].includes(error.status)&&!state)$('roomError').textContent=error.message;
  else $('connection').textContent=failures>2?'网络中断 · 重连中':'正在重连…';
 }finally{polling=false;}
}
function beginPoll(){
 clearTimeout(poll);
 const tick=async()=>{if(!session)return;await pollState();poll=setTimeout(tick,1000);};
 poll=setTimeout(tick,350);
}
async function enter(type){if(busy)return;const code=$('roomCodeInput').value.trim().toUpperCase();if(type==='join'&&!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){$('roomError').textContent='请输入 6 位房间码（字母和数字）';return;}busy=true;$('createRoom').disabled=true;$('joinRoom').disabled=true;$('roomError').textContent='';const previousSession=session;try{if(type==='join'){const saved=localStorage.getItem('three-card-seat-'+code);if(saved)session={code,token:saved};}const d=await api('POST',{type,code});session={code:d.state.code,token:d.token||session?.token};state=null;remember();accept(d.state);history.replaceState(null,'',location.pathname+'?room='+session.code);beginPoll();}catch(e){session=previousSession;$('roomError').textContent=e.message;}finally{busy=false;$('createRoom').disabled=false;$('joinRoom').disabled=false;render();}}
function finishAction(request,error=''){
 if(pendingAction!==request)return;
 pendingAction=null;busy=false;actionError=error;
 document.querySelector('.control-panel').setAttribute('aria-busy','false');
 render();
}
async function send(action){
 if(busy||!session||!state)return;
 const type=typeof action==='string'?action:action.type;
 const labels={follow:state.looked[state.you]?'跟注':'闷牌',raise:'加注',open:'开牌',fold:'弃牌',deal:'发牌',reset:'重置战绩'};
 const request={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),label:labels[type]||'看牌'};
 const revision=state.revision,saved=session;
 pendingAction=request;busy=true;actionError='';
 document.querySelector('.control-panel').setAttribute('aria-busy','true');
 render();
 try{
  const {state:updated}=await api('POST',{type:'action',revision,id:request.id,action});
  if(session===saved)accept(updated);
  finishAction(request);
 }catch(error){
  if(pendingAction!==request)return;
  if(error.state)accept(error.state);
  finishAction(request,error.status?error.message:'暂未收到操作确认，正在刷新牌局。');
  if(!error.state)void pollState(true);
 }
}
$('createRoom').addEventListener('click',()=>enter('create'));$('joinRoom').addEventListener('click',()=>enter('join'));$('roomCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')enter('join');});
['fold','follow','raise'].forEach(a=>$(a).addEventListener('click',()=>send(a)));$('open').addEventListener('click',chooseOpen);$('look').addEventListener('click',()=>{actionError='';lookExpanded=!lookExpanded;openExpanded=false;render();});$('deal').addEventListener('click',()=>send('deal'));resetButton.addEventListener('click',()=>send('reset'));
$('shareRoom').addEventListener('click',async()=>{if(session?.transport==='peer'){window.PeerDuel.info();return;}const url=window.Android?'threecard://join?room='+session.code:location.origin+'/?room='+session.code;const data={title:'来玩一局双人炸金花',text:'房间码：'+session.code,url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText('来玩一局三张牌，房间码 '+session.code+'\n'+url);$('shareRoom').textContent='已复制';setTimeout(()=>$('shareRoom').textContent='分享房间',2200);}}catch(e){if(e.name!=='AbortError'){$('actionHint').textContent='房间码 '+session.code+'，可直接发给好友';}}});
window.addEventListener('peer-connected',e=>{clearTimeout(poll);session={...e.detail,transport:'peer'};state=null;busy=false;accept(e.detail.state);beginPoll();});window.addEventListener('peer-state',e=>{if(session?.transport==='peer')accept(e.detail);});
$('leaveRoom').addEventListener('click',()=>{if(!confirm('退出当前房间？此设备会保留身份，可用房间码重新加入。'))return;clearTimeout(poll);if(session?.transport==='peer')window.PeerDuel.close();session=null;state=null;remember();history.replaceState(null,'',location.pathname);location.reload();});
$('rulesBtn').addEventListener('click',()=>$('rules').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));$('sound').addEventListener('click',()=>{sound=!sound;$('soundMark').textContent=sound?'开':'关';tone();});
const invite=new URLSearchParams(location.search).get('room');if(invite)$('roomCodeInput').value=invite.toUpperCase();
try{
 const old=JSON.parse(localStorage.getItem('club-session'));
 if(old?.token&&old.code&&(!invite||old.code===invite.toUpperCase())){session=old;beginPoll();}
}catch{}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollState();});
render();
})();
