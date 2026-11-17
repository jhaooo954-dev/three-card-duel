'use strict';
const $=id=>document.getElementById(id),R=globalThis.LandlordRules,epoch=Number(new URLSearchParams(location.search).get('epoch')||0);
let session=null,state=null,busy=false,polling=false,lastLive=0,selected=new Set(),hintList=null,hintIndex=0,renderKey='';
try{session=JSON.parse(localStorage.getItem('club-session')||'null');}catch{}
const phases={waiting:'准备开局',calling:'叫地主',grabbing:'抢地主',doubling:'选择加倍',playing:'出牌中',ended:'本局结束'};
const ranks={11:'J',12:'Q',13:'K',14:'A',15:'2',16:'小王',17:'大王'},suits=['♠','♥','♣','♦'];
function note(message){$('notice').textContent=message||'';}
function card(c,mini=false,interactive=false){
 const el=document.createElement(interactive?'button':'span');el.className='card'+(mini?' mini':'');
 if(c===null){el.classList.add('back');el.textContent='♠';return el;}
 const r=R.rank(c),isJoker=c>=52;el.classList.toggle('red',isJoker?c===53:[1,3].includes(Math.floor(c/13)));el.classList.toggle('joker',isJoker);
 const a=document.createElement('span'),b=document.createElement('span');a.className='rank';b.className='suit';a.textContent=isJoker?'★':ranks[r]||r;b.textContent=isJoker?(mini?(c===52?'小':'大'):ranks[r]):suits[Math.floor(c/13)];el.append(a,b);
 if(interactive){el.type='button';el.dataset.card=c;el.setAttribute('aria-label',isJoker?ranks[r]:suits[Math.floor(c/13)]+(ranks[r]||r));el.onclick=()=>{if(busy||state.phase!=='playing'||state.turn!==state.you)return;selected.has(c)?selected.delete(c):selected.add(c);paintSelection();};}
 return el;
}
async function api(body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);try{const response=await fetch('/club-api/game/landlord/'+(body?'action':'state?code='+encodeURIComponent(session.code)),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok){const error=Error(data.error||'连接失败');error.state=data.state;throw error;}return data;}catch(e){if(e.name==='AbortError')throw Error('连接超时，请重试');throw e;}finally{clearTimeout(timer);}}
function accept(s){if(state&&s.rev<state.rev)return;const changed=!state||state.rev!==s.rev;const key=s.round+':'+s.phase+':'+s.turn+':'+s.hands[s.you].join(',');if(key!==renderKey){selected.clear();hintList=null;hintIndex=0;renderKey=key;}state=s;if(changed)paint();}
function addAction(label,run,primary=false,disabled=false,id){const b=document.createElement('button');b.textContent=label;b.className=primary?'primary':'';b.disabled=busy||disabled;b.onclick=run;if(id)b.id=id;$('actions').append(b);return b;}
function opponent(el,i){
 el.replaceChildren();el.classList.toggle('active',['calling','grabbing','playing'].includes(state.phase)&&state.turn===i||state.phase==='doubling'&&state.doubles[i]===null);
 const heading=document.createElement('div');heading.className='seat-heading';const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=state.landlord===i?'👑':'👤';const name=document.createElement('b');name.className='seat-name';name.textContent=state.names[i];heading.append(avatar,name);el.append(heading);
 const info=document.createElement('div');info.className='seat-info';const role=document.createElement('span');role.className='badge';role.textContent=(state.landlord===null?'待定':state.landlord===i?'地主':'农民')+(state.doubles[i]===2?' · 加倍':'')+(state.open[i]?' · 明牌':'');const count=document.createElement('strong');count.textContent=state.counts[i]+' 张';info.append(role,count);el.append(info);
 const status=document.createElement('div');status.className='seat-status';status.textContent='积分 '+state.scores[i]+(state.online[i]?'':' · 离线')+(state.counts[i]>0&&state.counts[i]<=2?' · 报警！':'');el.append(status);
 if(state.hands[i].some(c=>c!==null)){const hand=document.createElement('div');hand.className='revealed';for(const c of state.hands[i]){const t=document.createElement('span');t.textContent=c>=52?ranks[R.rank(c)]:suits[Math.floor(c/13)]+(ranks[R.rank(c)]||R.rank(c));hand.append(t);}el.append(hand);}
}
function paint(){
 const s=state;if(!s)return;const mine=s.turn===s.you,playing=s.phase==='playing',others=[(s.you+2)%3,(s.you+1)%3];
 $('round').textContent=(s.round?'第 '+s.round+' 局 · ':'')+phases[s.phase];$('multiplier').textContent='×'+s.multiplier;
 $('bottom').replaceChildren(...(s.bottom.length?s.bottom:[null,null,null]).map(c=>card(c,true)));
 opponent($('opponent-left'),others[0]);opponent($('opponent-right'),others[1]);
 let title='',subtitle='';
 if(s.phase==='waiting'){title='不洗牌 · 三人到齐，开一局';subtitle='成组收牌 · 切牌发牌 · 17张手牌＋3张底牌';}
 if(s.phase==='calling'||s.phase==='grabbing'){title=mine?'轮到你'+phases[s.phase]:s.names[s.turn]+'正在'+phases[s.phase];subtitle=s.phase==='calling'?'不洗牌模式 · 都不叫将切牌重发':s.names[s.caller]+'叫地主 · 每抢一次倍数×2';}
 if(s.phase==='doubling'){title=s.landlord===s.you?'你是地主！选择是否加倍':'地主是'+s.names[s.landlord];subtitle=s.doubles[s.you]===null?'选择加倍后，等待三人全部确认':'你已确认，等待其余玩家选择';}
 if(playing){title=mine?(s.lastPlay?'轮到你出牌':'由你领出，自由出牌'):s.names[s.turn]+'正在出牌';subtitle=s.lastPlay?s.names[s.lastPlay.seat]+'出了'+s.lastPlay.label+' · '+(s.lastPlay.cards.length)+'张':(s.landlord===s.you?'你是地主':'你与'+s.names[[0,1,2].find(i=>i!==s.you&&i!==s.landlord)]+'是农民队友');}
 if(s.phase==='ended'){const won=(s.winner===s.landlord)===(s.you===s.landlord);title=(won?'你赢了！':'本局失利')+' · '+(s.winner===s.landlord?'地主获胜':'农民获胜');subtitle=(s.spring?s.spring+' · ':'')+'公共倍数 ×'+s.multiplier;}
 $('title').textContent=title;$('subtitle').textContent=subtitle;
 $('last-cards').replaceChildren(...(playing&&s.lastPlay?s.lastPlay.cards:[]).map(c=>card(c,true)));
 const latest=s.history.at(-1);$('event').textContent=latest?(latest.seat===null?'':s.names[latest.seat]+'：')+latest.text:'';
 document.querySelector('.table').classList.toggle('burst',!!latest&&/炸弹|王炸|春天/.test(latest.text));
 $('result').hidden=s.phase!=='ended';$('result').replaceChildren();
 if(s.phase==='ended')for(let i=0;i<3;i++){const row=document.createElement('div');row.className='result-row';const name=document.createElement('span'),score=document.createElement('b');name.textContent=s.names[i]+(i===s.landlord?'（地主）':'（农民）');score.className=s.delta[i]>=0?'win':'loss';score.textContent=(s.delta[i]>=0?'+':'')+s.delta[i]+' 分 · 总分 '+s.scores[i];row.append(name,score);$('result').append(row);}
 $('actions').replaceChildren();
 if(['waiting','ended'].includes(s.phase)){if(s.you===0)addAction(s.round?'再来一局':'开始发牌',()=>action({type:'start'}),true,!s.joined);else{const wait=document.createElement('span');wait.className='waiting';wait.textContent='等待房主'+s.names[0]+'开始'+(s.round?'下一局':'发牌');$('actions').append(wait);}}
 else if((s.phase==='calling'||s.phase==='grabbing')&&mine){const type=s.phase==='calling'?'call':'grab';addAction(type==='call'?'不叫':'不抢',()=>action({type,yes:false}));addAction(type==='call'?'叫地主':'抢地主',()=>action({type,yes:true}),true);}
 else if(s.phase==='doubling'&&s.doubles[s.you]===null){addAction('不加倍',()=>action({type:'double',yes:false}));addAction('加倍 ×2',()=>action({type:'double',yes:true}),true);if(s.landlord===s.you)addAction('明牌 ×2',()=>action({type:'double',yes:false,open:true}));}
 else if(playing&&mine){addAction('不出',()=>action({type:'pass'}),false,!s.lastPlay);addAction('提示',hint);addAction('重选',()=>{selected.clear();paintSelection();});addAction('出牌',()=>action({type:'play',cards:[...selected]}),true,true,'play-selected');}
 else{const wait=document.createElement('span');wait.className='waiting';wait.textContent=s.phase==='doubling'?'等待所有玩家确认加倍…':'等待'+s.names[s.turn]+'操作…';$('actions').append(wait);}
 $('my-name').textContent=(s.landlord===s.you?'👑 地主':s.landlord===null?'我的手牌':'👤 农民')+' · '+s.counts[s.you]+'张';$('my-score').textContent='积分 '+s.scores[s.you]+(s.doubles[s.you]===2?' · 加倍':'');
 const hand=s.hands[s.you];$('hand').replaceChildren();for(let start=0;start<hand.length;start+=10){const row=document.createElement('div');row.className='hand-row';for(const c of hand.slice(start,start+10))row.append(card(c,false,true));$('hand').append(row);}
 $('footer').textContent=playing?(s.table.map((v,i)=>v?.pass?s.names[i]+'：不出':null).filter(Boolean).join(' · ')||'点牌选中，再点取消 · 提示可循环选择合法出牌'):'不洗牌 · 成组收牌再切牌 · 虚拟积分';paintSelection();
}
function paintSelection(){
 if(!state)return;const myTurn=state.phase==='playing'&&state.turn===state.you;for(const el of $('hand').querySelectorAll('button')){const on=selected.has(Number(el.dataset.card));el.classList.toggle('selected',on);el.setAttribute('aria-pressed',String(on));el.disabled=busy||!myTurn;}
 const p=R.classify([...selected]),valid=R.beats(p,state.lastPlay?.pattern);$('selected-label').textContent=selected.size?(p?R.labels[p.type]+(valid?'':' · 压不住上家'):'牌型不合法')+' · '+selected.size+'张':myTurn?'点牌选中，再点取消':'等待轮到你';const b=$('play-selected');if(b)b.disabled=busy||!myTurn||!valid;
}
function hint(){if(!state||busy)return;if(!hintList){hintList=R.moves(state.hands[state.you],state.lastPlay?.pattern);hintIndex=0;}if(!hintList.length){selected.clear();paintSelection();note('没有能压过上家的牌，可以选择“不出”。');return;}const h=hintList[hintIndex++%hintList.length];selected=new Set(h.cards);paintSelection();note('提示 '+((hintIndex-1)%hintList.length+1)+' / '+hintList.length+' · '+h.label+'，再次点提示切换。');}
async function action(a){if(busy||!state||!session)return;busy=true;paint();try{accept(await api({code:session.code,epoch,id:Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>v.toString(16).padStart(2,'0')).join(''),rev:state.rev,action:{...a,round:state.round}}));note('');}catch(e){if(e.state)accept(e.state);note(e.message);}finally{busy=false;paint();}}
async function poll(){if(!session){note('请从统一房间大厅进入斗地主。');return;}if(polling||busy||document.hidden||Date.now()-lastLive<12000)return;polling=true;try{accept(await api());}catch(e){note(e.message);}finally{polling=false;}}
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='club-live-state'&&e.data.game==='landlord'&&e.data.epoch===epoch&&e.data.code===session?.code&&e.data.state){lastLive=Date.now();accept(e.data.state);}});
$('rules-open').onclick=()=>$('rules').showModal();$('rules-close').onclick=()=>$('rules').close();document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});setInterval(poll,1000);poll();if(parent!==window)parent.postMessage({type:'club-live-ready'},location.origin);
