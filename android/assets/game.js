'use strict';
const $=id=>document.getElementById(id);
const SUITS=['♠','♥','♣','♦'];
// Ranking is independent of UI and never examines the opponent for a decision.
function evaluate(cards){
 const ranks=cards.map(c=>c.rank).sort((a,b)=>b-a);
 const flush=cards.every(c=>c.suit===cards[0].suit);
 const unique=new Set(ranks).size;
 const straight=unique===3&&((ranks[0]-ranks[2]===2)||(ranks.join(',')==='14,3,2'));
 const high=ranks.join(',')==='14,3,2'?3:ranks[0];
 if(unique===1)return {score:[5,ranks[0]],name:'豹子'};
 if(straight&&flush)return {score:[4,high],name:'顺金'};
 if(flush)return {score:[3,...ranks],name:'金花'};
 if(straight)return {score:[2,high],name:'顺子'};
 if(unique===2){const pair=ranks.find((n,i)=>ranks.indexOf(n)!==i);return {score:[1,pair,ranks.find(n=>n!==pair)],name:'对子'};}
 return {score:[0,...ranks],name:'单张'};
}
function compare(a,b){const x=evaluate(a).score,y=evaluate(b).score;for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return Math.sign(d);}return 0;}
function randomIndex(n){const top=4294967296-(4294967296%n);let a;do{a=crypto.getRandomValues(new Uint32Array(1))[0];}while(a>=top);return a%n;}
function shuffledDeck(){const d=SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit})));for(let i=d.length-1;i>0;i--){const j=randomIndex(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
let mode='ai',round=0,banks=[1000,1000],hands=[[],[]],seen=[false,false],turn=0,base=10,pot=0,steps=0,active=false,revealed=false,covered=false,winner=null,stats=[0,0,0],timer=null,logs=[],sound=false,audioContext=null,pendingMode=null,matchToken=0;
const names=()=>mode==='ai'?['你','电脑']:['玩家一','玩家二'];
function money(n){return n.toLocaleString('en-US');}
function callCost(i){return base*(seen[i]?2:1);}
function playSound(kind='tap'){if(!sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.connect(g);g.connect(audioContext.destination);o.type='sine';o.frequency.setValueAtTime(kind==='win'?660:420,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(kind==='win'?880:280,audioContext.currentTime+.1);g.gain.setValueAtTime(.055,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.16);o.start();o.stop(audioContext.currentTime+.18);}catch{}}
function addLog(text){logs.unshift({round,text});logs=logs.slice(0,70);const holder=$('log');holder.replaceChildren();logs.forEach(item=>{const row=document.createElement('div');row.className='log-item';const tag=document.createElement('span');tag.className='log-round';tag.textContent=String(item.round).padStart(2,'0');row.append(tag,document.createTextNode(item.text));holder.append(row);});}
function saveStats(){try{localStorage.setItem('three-card-session-v1',JSON.stringify({mode,banks,stats,round}));}catch{}}
function loadStats(){try{const x=JSON.parse(localStorage.getItem('three-card-session-v1'));if(x&&['ai','local'].includes(x.mode)&&Array.isArray(x.banks)&&x.banks.length===2&&x.banks.every(n=>Number.isSafeInteger(n)&&n>=0)&&x.banks[0]+x.banks[1]===2000&&Array.isArray(x.stats)&&x.stats.length===3&&x.stats.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(x.round)&&x.round>=0){mode=x.mode;banks=x.banks;stats=x.stats;round=x.round;$('mode').value=mode;}}catch{}}
function cardNode(card,show){const node=document.createElement('div');node.className='card'+(show?(['♥','♦'].includes(card.suit)?' red':''):' back');if(show){const label={11:'J',12:'Q',13:'K',14:'A'}[card.rank]||card.rank;node.setAttribute('aria-label',card.suit+label);node.innerHTML='<span class="rank">'+label+'</span><span class="suit">'+card.suit+'</span><span class="big-suit">'+card.suit+'</span><span class="bottom">'+label+'</span>';}else node.setAttribute('aria-label','未展示的牌');return node;}
function render(){
 const ns=names();$('round').textContent='第 '+String(round||1).padStart(2,'0')+' 局';$('betLabel').textContent='底分 '+base;$('pot').textContent=money(pot);
 for(let i=0;i<2;i++){
  const show=revealed||(active&&!covered&&seen[i]&&(mode==='ai'?i===0:turn===i));
  $('name'+i).textContent=ns[i];$('bank'+i).textContent=money(banks[i]);$('status'+i).textContent=!hands[i].length?'等待发牌':!active?'本局结束':seen[i]?'已看牌 · 双倍下注':'闷牌中';
  $('type'+i).textContent=show?evaluate(hands[i]).name:'';
  const cards=$('cards'+i);cards.replaceChildren();const list=hands[i].length?hands[i]:[null,null,null];list.forEach(c=>cards.append(cardNode(c,show&&!!c)));
  $('player'+i).classList.toggle('active',active&&turn===i);$('player'+i).classList.toggle('winner',!active&&winner===i);
 }
 $('player0').querySelector('.avatar').textContent=mode==='ai'?'你':'一';$('player1').querySelector('.avatar').textContent=mode==='ai'?'♟':'二';
 $('wins').textContent=stats[0];$('losses').textContent=stats[1];$('ties').textContent=stats[2];
 const humanTurn=active&&!covered&&(mode==='local'||turn===0);
 const cost=callCost(turn);
 $('actions').classList.toggle('active',active);document.querySelector('.control-panel').classList.toggle('playing',active);
 ['fold','look','follow','raise','open'].forEach(id=>$(id).disabled=!humanTurn);
 $('look').disabled=!humanTurn||seen[turn];$('look').innerHTML=seen[turn]?'已看牌<span>按双倍金额下注</span>':'看牌<span>揭开我的底牌</span>';
 $('follow').innerHTML=(seen[turn]?'跟注':'闷牌')+'<span>投入 '+money(cost)+'</span>';
 $('follow').disabled=!humanTurn||banks[turn]<cost;
 $('raise').innerHTML='加注<span>投入 '+money((base+10)*(seen[turn]?2:1))+'</span>';
 $('raise').disabled=!humanTurn||base>=100||banks[turn]<(base+10)*(seen[turn]?2:1);
 $('open').innerHTML='开牌<span>投入 '+money(Math.min(banks[turn],cost*2))+'</span>';
 if(active){$('actionTitle').textContent=covered?'等待接过手机':ns[turn]+(mode==='ai'&&turn===1?'正在思考…':'的回合');$('actionHint').textContent=seen[turn]?'已看牌 · 跟注按底分 2 倍计费':'保持闷牌，或先看看自己的三张牌';$('turnMeta').textContent='第 '+(steps+1)+' / 20 次行动 · '+(covered?'等待交接':ns[turn]+'的回合');}
 else{$('actionTitle').textContent=round?'这一局已结束':'轮到你来开局';$('actionHint').textContent='底注 10 · 闷牌 1 倍 / 看牌 2 倍';$('deal').innerHTML=(banks.some(n=>n<10)?'积分不足 · 重新开始':round?'再来一局':'发牌，开始第一局')+' <span>↗</span>';$('turnMeta').textContent=round?'牌局已结算 · 下一局交换先手':'每人 1,000 积分 · 底注 10';}
}
function message(text){$('message').textContent=text;}
function pay(i,n){const amount=Math.min(n,banks[i]);banks[i]-=amount;pot+=amount;return amount;}
function showHandoff(){covered=true;render();$('handoffTitle').textContent='请将手机交给'+names()[turn];if(!$('handoff').open)$('handoff').showModal();}
function deal(){
 if(active)return;if(banks.some(n=>n<10)){requestReset();return;}
 clearTimeout(timer);matchToken++;round++;base=10;steps=0;seen=[false,false];revealed=false;covered=false;winner=null;pot=0;
 const d=shuffledDeck();hands=[d.slice(0,3),d.slice(3,6)];pay(0,10);pay(1,10);active=true;turn=(round-1)%2;
 addLog('双方各下底注 10，新一局开始');message('三张到手，好戏开场');playSound();render();
 if(mode==='local')showHandoff();else if(turn===1)scheduleAI();
}
function look(){if(!active||covered||seen[turn])return;seen[turn]=true;addLog(names()[turn]+'看了牌');message(names()[turn]+'已看牌，下注翻倍');playSound();render();}
function nextTurn(){
 steps++;
 if(steps>=20){settle(null,'已满 20 次行动，自动比牌');return;}
 turn=1-turn;
 if(banks[turn]<callCost(turn)){settle(null,'积分不足以跟注，自动比牌');return;}
 render();if(mode==='local')showHandoff();else if(turn===1)scheduleAI();
}
function act(action){
 if(!active||covered)return;
 const i=turn,ns=names();
 if(action==='look'){look();return;}
 if(action==='fold'){revealed=false;finish(1-i,ns[i]+'弃牌，'+ns[1-i]+'获胜',false);return;}
 if(action==='open'){const n=pay(i,callCost(i)*2);addLog(ns[i]+'投入 '+n+'，开牌比大小');settle(i,ns[i]+'发起开牌');return;}
 if(action==='raise'){
  if(base>=100||banks[i]<(base+10)*(seen[i]?2:1))return;
  base+=10;const n=pay(i,callCost(i));addLog(ns[i]+'加注 '+n+' · 底分升至 '+base);message(ns[i]+'加注，底分 '+base);
 }else if(action==='follow'){
  const cost=callCost(i);if(banks[i]<cost){settle(null,'积分不足，自动比牌');return;}
  pay(i,cost);addLog(ns[i]+(seen[i]?'跟注 ':'闷牌 ')+cost);message(ns[i]+(seen[i]?'跟注 ':'闷牌 ')+cost);
 }else return;
 playSound();if(banks[i]===0){settle(null,'积分已用完，自动比牌');return;}nextTurn();
}
function settle(opener,reason){const c=compare(hands[0],hands[1]);let w=c>0?0:c<0?1:null;if(w===null&&opener!==null)w=1-opener;let text=w===null?'双方牌力相同，平分底池':names()[w]+'赢了 · '+evaluate(hands[w]).name;if(c===0&&opener!==null)text+='（同牌力，开牌方负）';addLog(reason);finish(w,text,true);}
function finish(w,text,show){
 clearTimeout(timer);active=false;covered=false;revealed=show;winner=w;const awarded=pot;
 if(w===null){banks[0]+=Math.floor(pot/2);banks[1]+=pot-Math.floor(pot/2);stats[2]++;}else{banks[w]+=pot;stats[w===0?0:1]++;}
 addLog(text+(w===null?'':'，收获底池 '+awarded));pot=0;message(text);if($('handoff').open)$('handoff').close();playSound('win');saveStats();render();
}
function scheduleAI(){const token=matchToken;timer=setTimeout(()=>{if(token!==matchToken||!active||turn!==1)return;
 if(!seen[1]&&(steps>=3||Math.random()<.3))look();
 const strength=seen[1]?evaluate(hands[1]).score:null;
 const roll=Math.random();let choice='follow';
 if(strength){if(strength[0]===0&&strength[1]<12&&steps>2&&roll<.32)choice='fold';else if(steps>=5&&roll<.55)choice='open';else if(strength[0]>=1&&roll<.4)choice='raise';}
 else{if(steps>=5&&roll<.28)choice='open';else if(roll<.16)choice='raise';}
 if(choice==='raise'&&(base>=100||banks[1]<(base+10)*(seen[1]?2:1)))choice='follow';
 act(choice);
 },900+Math.random()*650);}
function requestReset(newMode=null){pendingMode=newMode;$('resetDialog').showModal();}
function cancelReset(){pendingMode=null;$('mode').value=mode;$('resetDialog').close();}
function reset(){clearTimeout(timer);matchToken++;if(pendingMode)mode=pendingMode;pendingMode=null;round=0;banks=[1000,1000];hands=[[],[]];seen=[false,false];turn=0;base=10;pot=0;steps=0;active=false;revealed=false;covered=false;winner=null;stats=[0,0,0];logs=[];$('log').innerHTML='<div class="empty-log">好牌需要运气，<br>好局需要一点胆量。<span>准备好，开始第一局。</span></div>';$('mode').value=mode;$('resetDialog').close();if($('handoff').open)$('handoff').close();message('坐上牌桌，试试你的手气');saveStats();render();}
['fold','look','follow','raise','open'].forEach(id=>$(id).addEventListener('click',()=>{if(active&&(mode==='local'||turn===0)&&!covered)act(id);}));
$('deal').addEventListener('click',deal);$('rulesBtn').addEventListener('click',()=>$('rules').showModal());document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.dataset.close==='resetDialog'?cancelReset():$(b.dataset.close).close()));
$('reset').addEventListener('click',()=>requestReset());$('cancelReset').addEventListener('click',cancelReset);$('confirmReset').addEventListener('click',reset);
$('resetDialog').addEventListener('cancel',e=>{e.preventDefault();cancelReset();});
$('mode').addEventListener('change',()=>{const selected=$('mode').value;if(selected!==mode)requestReset(selected);});
$('ready').addEventListener('click',()=>{$('handoff').close();covered=false;render();message(names()[turn]+'，轮到你了');});$('handoff').addEventListener('cancel',e=>e.preventDefault());
$('sound').addEventListener('click',()=>{sound=!sound;$('soundMark').textContent=sound?'开':'关';$('sound').setAttribute('aria-label',sound?'关闭音效':'开启音效');playSound();});
loadStats();render();
