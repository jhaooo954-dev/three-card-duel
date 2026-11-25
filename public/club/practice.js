(()=>{'use strict';
const modules = {"card.cjs": function(module, require){
'use strict';
const crypto=require('node:crypto').webcrypto;
const ACTION_LIMIT=20;
const SUITS=['♠','♥','♣','♦'];
function evaluate(cards){const r=cards.map(c=>c.rank).sort((a,b)=>b-a),u=new Set(r).size,f=cards.every(c=>c.suit===cards[0].suit),s=u===3&&(r[0]-r[2]===2||r.join(',')==='14,3,2'),h=r.join(',')==='14,3,2'?3:r[0];if(u===1)return {score:[5,r[0]],name:'豹子'};if(f&&s)return {score:[4,h],name:'顺金'};if(f)return {score:[3,...r],name:'金花'};if(s)return {score:[2,h],name:'顺子'};if(u===2){const p=r.find((n,i)=>r.indexOf(n)!==i);return {score:[1,p,r.find(n=>n!==p)],name:'对子'};}return {score:[0,...r],name:'单张'};}
function compare(a,b){const x=evaluate(a).score,y=evaluate(b).score;for(let i=0;i<x.length;i++){const d=x[i]-y[i];if(d)return Math.sign(d);}return 0;}
function deck(){const d=SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit})));for(let i=51;i>0;i--){const cap=4294967296-(4294967296%(i+1));let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=cap);const j=n%(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
function initial(token,count=2){const zeros=()=>Array(count).fill(0);return {rulesVersion:3,players:[token,...Array(count-1).fill(null)],banks:zeros(),hands:Array.from({length:count},()=>[]),seen:Array(count).fill(false),looked:zeros(),folded:Array(count).fill(false),dealer:0,round:0,turn:1,base:10,pot:0,lastPot:0,lastBets:zeros(),steps:0,active:false,revealed:false,winner:null,stats:Array(count+1).fill(0),message:'房间已创建，等待好友加入',logs:[],resetRequests:[]};}
const log=(s,t)=>{s.logs.unshift(t);s.logs=s.logs.slice(0,35);};
const name=i=>'玩家'+['一','二','三'][i];
const alive=s=>s.players.map((_,i)=>i).filter(i=>!s.folded[i]);
const next=(s,i)=>{for(let n=1;n<=s.players.length;n++){const j=(i+n)%s.players.length;if(!s.folded[j])return j;}};
const cost=(s,i)=>s.base*(s.looked[i]>0?2:1);
function pay(s,i,n){s.banks[i]+=n;s.pot+=n;return n;}
function finish(s,w,txt){const p=s.pot;s.lastPot=p;s.lastBets=[...s.banks];if(w===null)s.stats[s.players.length]++;else{s.stats[w]++;s.dealer=w;}s.active=false;s.winner=w;s.revealed=true;s.message=txt+' · 本局投入 '+p+'，下一局发牌时清零';log(s,s.message);}
function settle(s,opener,txt){log(s,txt);const seats=alive(s);let best=[seats[0]];for(const i of seats.slice(1)){const c=compare(s.hands[i],s.hands[best[0]]);if(c>0)best=[i];else if(c===0)best.push(i);}const tied=best.length>1;if(tied&&opener!==null)best=best.filter(i=>i!==opener);const w=best.length===1?best[0]:null;finish(s,w,w===null?'同牌力，平局':name(w)+'获胜 · '+evaluate(s.hands[w]).name+(tied&&opener!==null?'（同牌力，开牌方负）':''));}
function action(s,i,input){
 const a=typeof input==='string'?input:input?.type,target=typeof input==='object'&&input!==null?input.target:undefined;
 if(!Number.isInteger(i)||i<0||i>=s.players.length)throw Error('无效的玩家身份');
 if(a==='deal'){
  if(i!==s.dealer)throw Error('请等待上局赢家发牌（第一局由房主发牌）');if(!s.players.every(Boolean))throw Error('等待好友加入');if(s.active)throw Error('本局尚未结束');
  const d=deck();s.hands=s.players.map((_,j)=>d.slice(j*3,j*3+3));s.round++;s.seen=s.players.map(()=>false);s.looked=s.players.map(()=>0);s.folded=s.players.map(()=>false);s.active=true;s.revealed=false;s.winner=null;s.turn=next(s,s.dealer);s.steps=0;s.base=10;s.pot=0;s.banks=s.players.map(()=>0);s.lastPot=0;s.lastBets=s.players.map(()=>0);s.resetRequests=[];s.message='新一局开始，'+name(s.turn)+'先手';log(s,'第 '+s.round+' 局 · '+name(s.dealer)+'发牌，无底注，下家先手');return;
 }
 if(a==='reset'){
  if(s.active)throw Error('请先结束本局');if(!s.players.every(Boolean))throw Error('等待好友加入');s.resetRequests??=[];if(!s.resetRequests.includes(i))s.resetRequests.push(i);
  if(s.resetRequests.length===s.players.length){const players=s.players;Object.assign(s,initial(players[0],players.length),{players,message:'全员已重置战绩，第一局由房主发牌'});log(s,s.message);}else{s.message=name(i)+'请求重置战绩，等待对方同意';}return;
 }
 if(!s.active)throw Error('请先发牌');if(s.turn!==i)throw Error('还未轮到你');
 if(a==='look'||/^look[123]$/.test(a)){
  const n=a==='look'?3:Number(a.slice(4));if(n<=s.looked[i])throw Error('这些牌已经翻开了');s.looked[i]=n;s.seen[i]=true;log(s,name(i)+'翻开了 '+n+' 张牌');s.message=name(i)+'已翻 '+n+' / 3 张，看牌按闷牌的 2 倍下注';return;
 }
 if(a==='fold'){s.folded[i]=true;log(s,name(i)+'弃牌');const remaining=alive(s);if(remaining.length===1)finish(s,remaining[0],name(i)+'弃牌，'+name(remaining[0])+'获胜，全员亮牌');else{s.message=name(i)+'弃牌，牌局继续';s.turn=next(s,i);}return;}
 if(a==='open'){
  const remaining=alive(s),targeted=target!==undefined;
  if(targeted&&(!Number.isInteger(target)||target===i||!remaining.includes(target)))throw Error('请选择仍在本局的一位对手');
  if(remaining.length>2&&s.looked[i]>0&&!targeted)throw Error('请先选择要开牌的一家');
  if(targeted&&remaining.length>2&&s.looked[i]===0)throw Error('请先看牌，再选择一家开牌');
  if(!targeted){const n=pay(s,i,cost(s,i));settle(s,i,name(i)+'投入 '+n+' 开牌');return;}
  const n=pay(s,i,cost(s,i)),loser=compare(s.hands[i],s.hands[target])>0?target:i;
  s.folded[loser]=true;log(s,name(i)+'投入 '+n+'，向'+name(target)+'开牌');
  const left=alive(s),result=name(loser)+'比牌落败';
  if(left.length===1)finish(s,left[0],result+'，'+name(left[0])+'获胜，全员亮牌');
  else{s.message=result+'，剩余两家继续';log(s,s.message);s.steps++;s.turn=next(s,i);}
  return;
 }
 if(!['raise','follow'].includes(a))throw Error('操作无效');
 if(a==='raise'){if(s.base>=100)throw Error('底分最高 100');s.base+=10;}
 const n=pay(s,i,cost(s,i));s.message=name(i)+(a==='raise'?'加注 ':s.seen[i]?'跟注 ':'闷牌 ')+n;log(s,s.message);s.steps++;
 if(s.players.length===2&&s.steps>=ACTION_LIMIT){settle(s,null,'达到本局上限，自动比牌');return;}
 s.turn=next(s,i);
}
function view(s,i,revision,code){return {rulesVersion:3,targetedOpen:true,code,revision,you:i,joined:s.players.every(Boolean),playerCount:s.players.length,folded:s.folded,callCost:cost(s,i),openCost:cost(s,i),raiseCost:(s.base+10)*(s.looked[i]>0?2:1),dealer:s.dealer,banks:s.banks,lastPot:s.lastPot,lastBets:s.lastBets,hands:s.hands.map((h,j)=>h.map((c,k)=>s.revealed||(j===i&&k<s.looked[i])?c:null)),types:s.hands.map((h,j)=>h.length&&(s.revealed||(j===i&&s.looked[i]===3))?evaluate(h).name:''),seen:s.seen,looked:s.looked,round:s.round,turn:s.turn,base:s.base,pot:s.pot,steps:s.steps,actionLimit:s.players.length===2?ACTION_LIMIT:null,active:s.active,winner:s.winner,stats:s.stats,message:s.message,logs:s.logs,resetRequests:s.resetRequests||[]};}

module.exports={initial,action,view,evaluate,compare};

},
"dice.cjs": function(module, require){
'use strict';
const assert=(b,m)=>{if(!b)throw Error(m);};
const SHAKE_MS=1800;
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,dice:tokens.map(()=>[]),ready:tokens.map(()=>false),rollUntil:0,openedBy:null,logs:[],rev:0};}
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,20);}
function act(s,i,a,roll,now=Date.now()){assert(Number.isInteger(i)&&i>=0&&i<s.tokens.length,'玩家无效');assert(s.tokens.every(Boolean),'等待好友加入');assert(a.round===s.round,'对局已更新，请重新操作');
if(a.type==='ready'){assert(s.phase!=='playing','本局还没开盅，不能重新摇骰');if(s.ready[i])return;s.ready[i]=true;if(s.ready.every(Boolean)){const hands=s.tokens.map(()=>roll());assert(hands.every(h=>Array.isArray(h)&&h.length===5&&h.every(v=>Number.isInteger(v)&&v>=1&&v<=6)),'摇骰失败，请重试');s.dice=hands;s.phase='playing';s.round++;s.rollUntil=now+SHAKE_MS;s.openedBy=null;s.ready=s.tokens.map(()=>false);log(s,'第 '+s.round+' 盅 · 全员一起摇骰');}else log(s,s.names[i]+'已准备摇骰');s.rev++;return;}
assert(s.phase==='playing','请全员先准备摇骰');
assert(a.type==='open','请自己口头喊骰，想看结果时点开盅');
assert(now>=s.rollUntil,'正在摇骰，请稍等');
s.phase='ended';s.openedBy=i;s.ready=s.tokens.map(()=>false);log(s,s.names[i]+'开盅 · 全员骰子已公开');s.rev++;}
function view(s,i,code,lastSeen,now=Date.now()){return {apiVersion:2,code,you:i,names:s.names,joined:!!s.tokens.every(Boolean),phase:s.phase,round:s.round,ready:s.ready,rollRemaining:Math.max(0,s.rollUntil-now),openedBy:s.openedBy,logs:s.logs,rev:s.rev,online:lastSeen?lastSeen.map((v,j)=>!!s.tokens[j]&&now-v<15000):s.tokens.map(()=>true),dice:s.dice.map((h,j)=>s.phase==='ended'||j===i?h:h.map(()=>null))};}
module.exports={initial,act,view,SHAKE_MS};

},
"engine.cjs": function(module, require){
'use strict';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const LIMIT=21,BASE=10;
const value=c=>{const rank=c%13+1;return rank<=10?rank*2:1;};
const total=cards=>cards.reduce((n,c)=>n+value(c),0);
const points=n=>n%2?(n-1)/2+'.5':String(n/2);
function special(hand){const n=total(hand);return n>LIMIT?0:hand.length===5?3:n===LIMIT?2:0;}
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,shoe:0,handInShoe:0,dealer:0,hands:[[],[]],deck:[],request:false,scores:[0,0],result:null,logs:[],rev:0};}
const shoeEnded=s=>s.phase==='ended'&&s.deck.length<2;
const nextDealer=s=>shoeEnded(s)?1-s.dealer:s.dealer;
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,30);}
function clearShoeScore(s){const scores=s.scores.slice();s.scores=[0,0];log(s,'本铺坐庄结束 · '+s.names.map((n,i)=>n+' '+(scores[i]>0?'+':'')+scores[i]).join(' / ')+' · 双方积分已清零');return scores;}
function finish(s,winner,multiplier,reason){const amount=BASE*multiplier,delta=[0,0];delta[winner]=amount;delta[1-winner]=-amount;s.scores=s.scores.map((v,i)=>v+delta[i]);s.result={winner,loser:1-winner,dealer:s.dealer,multiplier,amount,delta,reason,totals:s.hands.map(total)};s.phase='ended';s.request=false;if(shoeEnded(s))s.result.shoeScores=clearShoeScore(s);log(s,s.names[winner]+'赢 '+amount+'分 · '+reason+(shoeEnded(s)?' · 整铺结束，下一铺换庄':' · 庄家继续，余'+s.deck.length+'张'));}
function compare(s){const d=s.dealer,g=1-d,dt=total(s.hands[d]),gt=total(s.hands[g]),ds=special(s.hands[d]),gs=special(s.hands[g]);if(dt>LIMIT)return finish(s,g,gs||1,'庄家爆牌');if(ds)return finish(s,d,ds,ds===3?'庄家五张未爆，庄家优先赢':'庄家十点半，庄家优先赢');if(gs)return finish(s,g,gs,gs===3?'闲家五张未爆':'闲家十点半');if(dt>=gt)return finish(s,d,1,dt===gt?'同点，庄家赢':'庄家点数大');finish(s,g,1,'闲家点数大');}
function take(s,i){check(s.deck.length>0,'本铺牌已发完');check(s.hands[i].length<5,'最多五张牌');const c=s.deck.pop();s.hands[i].push(c);}
function act(s,i,a,makeDeck){check(i===0||i===1,'玩家无效');check(s.tokens[1],'等待好友加入');check(a.round===s.round,'这一局已经更新，请重新操作');
if(a.type==='start'){check(s.phase==='waiting'||s.phase==='ended','这一局还没结束');check(i===nextDealer(s),'当前应由对方坐庄发牌');const fresh=s.round===0||s.deck.length<2,dealer=nextDealer(s);if(fresh){const deck=makeDeck();check(Array.isArray(deck)&&deck.length===52&&new Set(deck).size===52&&deck.every(c=>Number.isInteger(c)&&c>=0&&c<52),'洗牌失败');if(s.round>0&&s.scores.some(n=>n!==0))clearShoeScore(s);if(s.deck.length===1)log(s,'余1张不足双方起手，尾牌弃置，本铺结束');s.deck=deck.slice();s.shoe++;s.handInShoe=0;}s.dealer=dealer;s.round++;s.handInShoe++;s.hands=[[],[]];s.request=false;s.result=null;take(s,0);take(s,1);s.phase='guest';log(s,'第 '+s.shoe+' 铺 · 第 '+s.handInShoe+' 局 · '+s.names[dealer]+'坐庄，余'+s.deck.length+'张');if(s.deck.length===0){log(s,'本铺牌已发完，按当前牌结算');compare(s);}s.rev++;return;}
check(s.phase==='guest'||s.phase==='dealer','请庄家先发牌');const d=s.dealer,g=1-d;
if(a.type==='request'){check(s.phase==='guest'&&i===g,'只有闲家要牌时可以操作');check(!s.request,'已要牌，等待庄家发牌');s.request=true;log(s,s.names[g]+'要一张，等待庄家发牌');}
else if(a.type==='deal'){check(s.phase==='guest'&&i===d&&s.request,'闲家要牌后，庄家才能发一张');take(s,g);s.request=false;log(s,'庄家给闲家发一张');const t=total(s.hands[g]);if(t>LIMIT)finish(s,d,1,'闲家爆牌');else if(s.deck.length===0){log(s,'本铺牌已发完，按当前牌结算');compare(s);}else if(special(s.hands[g])){s.phase='dealer';log(s,'闲家特殊牌型，双方翻牌，轮到庄家补牌');}}
else if(a.type==='draw'){check(s.phase==='dealer'&&i===d,'请先等闲家要牌结束');take(s,d);log(s,'庄家给自己补一张');if(total(s.hands[d])>LIMIT||special(s.hands[d])||s.deck.length===0){if(!s.deck.length)log(s,'本铺牌已发完，按当前牌结算');compare(s);}}
else if(a.type==='stand'){if(s.phase==='guest'){check(i===g&&!s.request,'请等待庄家发牌，或由闲家停牌');s.phase='dealer';log(s,'闲家停牌，庄家翻开底牌，轮到庄家补牌');}else{check(i===d,'只有庄家可以停牌比牌');compare(s);}}
else throw Error('操作无效');s.rev++;}
function view(s,i,code,lastSeen,now=Date.now()){const ended=s.phase==='ended',revealed=s.hands.map((_,j)=>ended||(s.phase==='dealer'&&(j===s.dealer||special(s.hands[1-s.dealer])>0)));return {apiVersion:3,code,you:i,names:s.names,joined:!!s.tokens[1],phase:s.phase,round:s.round,shoe:s.shoe,handInShoe:s.handInShoe,remaining:s.deck.length,shoeEnded:shoeEnded(s),dealer:s.dealer,nextDealer:nextDealer(s),revealed,base:BASE,request:s.request,scores:s.scores,result:s.result,logs:s.logs,rev:s.rev,online:lastSeen?lastSeen.map((v,j)=>!!s.tokens[j]&&now-v<15000):[true,true],hands:s.hands.map((h,j)=>h.map((c,k)=>revealed[j]||j===i||k>0?c:null)),totals:s.hands.map((h,j)=>h.length&&(revealed[j]||j===i)?total(h):null)};}
module.exports={initial,act,view,value,total,points,special,nextDealer,shoeEnded,LIMIT,BASE};

},
"tenhalf3.cjs": function(module, require){
'use strict';
// Three seats use the same card values, banker priority and payout rules as the two-seat engine.
const rules=require('engine.cjs'),{total,special,LIMIT,BASE}=rules;
const check=(ok,m)=>{if(!ok)throw Error(m);};
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,shoe:0,handInShoe:0,dealer:0,guest:1,guestsDone:[],hands:tokens.map(()=>[]),deck:[],request:false,scores:tokens.map(()=>0),result:null,logs:[],rev:0};}
const shoeEnded=s=>s.phase==='ended'&&s.deck.length<s.tokens.length;
const nextDealer=s=>shoeEnded(s)?(s.dealer+1)%s.tokens.length:s.dealer;
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,30);}
function clearScore(s){const scores=s.scores.slice();s.scores=s.tokens.map(()=>0);log(s,'本铺坐庄结束 · '+s.names.map((n,i)=>n+' '+(scores[i]>0?'+':'')+scores[i]).join(' / ')+' · 全员积分已清零');return scores;}
function versus(s,g){const d=s.dealer,dt=total(s.hands[d]),gt=total(s.hands[g]),ds=special(s.hands[d]),gs=special(s.hands[g]);if(gt>LIMIT)return {winner:d,multiplier:1,reason:'闲家爆牌'};if(dt>LIMIT)return {winner:g,multiplier:gs||1,reason:'庄家爆牌'};if(ds)return {winner:d,multiplier:ds,reason:ds===3?'庄家五张未爆，庄家优先赢':'庄家十点半，庄家优先赢'};if(gs)return {winner:g,multiplier:gs,reason:gs===3?'闲家五张未爆':'闲家十点半'};return dt>=gt?{winner:d,multiplier:1,reason:dt===gt?'同点，庄家赢':'庄家点数大'}:{winner:g,multiplier:1,reason:'闲家点数大'};}
function finish(s){const delta=s.tokens.map(()=>0),outcomes=[];for(let g=0;g<s.tokens.length;g++){if(g===s.dealer)continue;const r=versus(s,g),amount=BASE*r.multiplier,loser=r.winner===g?s.dealer:g;delta[r.winner]+=amount;delta[loser]-=amount;outcomes.push({...r,guest:g,loser,amount});}s.scores=s.scores.map((n,i)=>n+delta[i]);s.result={dealer:s.dealer,delta,outcomes,totals:s.hands.map(total)};s.phase='ended';s.request=false;if(shoeEnded(s))s.result.shoeScores=clearScore(s);for(const r of outcomes)log(s,s.names[r.winner]+'赢'+s.names[r.loser]+' '+r.amount+'分 · '+r.reason);log(s,shoeEnded(s)?'整铺结束，下一铺顺序换庄':'庄家继续，余'+s.deck.length+'张');}
function take(s,i){check(s.deck.length>0,'本铺牌已发完');check(s.hands[i].length<5,'最多五张牌');s.hands[i].push(s.deck.pop());}
function nextGuest(s){if(!s.guestsDone.includes(s.guest))s.guestsDone.push(s.guest);s.request=false;const order=Array.from({length:s.tokens.length-1},(_,j)=>(s.dealer+j+1)%s.tokens.length),next=order.find(i=>!s.guestsDone.includes(i));if(next!==undefined){s.guest=next;log(s,'轮到'+s.names[next]+'要牌或停牌');}else if(order.every(i=>total(s.hands[i])>LIMIT)){finish(s);}else{s.phase='dealer';log(s,'闲家均已停牌，庄家翻牌后补牌');}}
function act(s,i,a,makeDeck){check(Number.isInteger(i)&&i>=0&&i<s.tokens.length,'玩家无效');check(s.tokens.every(Boolean),'等待全员加入');check(a.round===s.round,'这一局已经更新，请重新操作');
 if(a.type==='start'){check(s.phase==='waiting'||s.phase==='ended','这一局还没结束');check(i===nextDealer(s),'请等待当前庄家发牌');const fresh=s.round===0||s.deck.length<s.tokens.length,dealer=nextDealer(s);if(fresh){const deck=makeDeck();check(Array.isArray(deck)&&deck.length===52&&new Set(deck).size===52&&deck.every(c=>Number.isInteger(c)&&c>=0&&c<52),'洗牌失败');if(s.round>0&&s.scores.some(n=>n!==0))clearScore(s);if(s.deck.length)log(s,'余'+s.deck.length+'张不足全员起手，尾牌弃置，本铺结束');s.deck=deck.slice();s.shoe++;s.handInShoe=0;}s.dealer=dealer;s.guest=(dealer+1)%s.tokens.length;s.guestsDone=[];s.round++;s.handInShoe++;s.hands=s.tokens.map(()=>[]);s.request=false;s.result=null;for(let j=0;j<s.tokens.length;j++)take(s,j);s.phase='guest';log(s,'第'+s.shoe+'铺 · 第'+s.handInShoe+'局 · '+s.names[dealer]+'坐庄，'+s.names[s.guest]+'先要牌');if(!s.deck.length)finish(s);s.rev++;return;}
 check(s.phase==='guest'||s.phase==='dealer','请庄家先发牌');const d=s.dealer,g=s.guest;
 if(a.type==='request'){check(s.phase==='guest'&&i===g,'请等待当前闲家要牌');check(!s.request,'已要牌，等待庄家发牌');s.request=true;log(s,s.names[g]+'要一张，等待庄家发牌');}
 else if(a.type==='deal'){check(s.phase==='guest'&&i===d&&s.request,'当前闲家要牌后庄家才能发牌');take(s,g);s.request=false;log(s,'庄家给'+s.names[g]+'发一张');if(!s.deck.length)finish(s);else if(total(s.hands[g])>LIMIT||special(s.hands[g]))nextGuest(s);}
 else if(a.type==='draw'){check(s.phase==='dealer'&&i===d,'请等所有闲家要牌结束');take(s,d);log(s,'庄家给自己补一张');if(total(s.hands[d])>LIMIT||special(s.hands[d])||!s.deck.length)finish(s);}
 else if(a.type==='stand'){if(s.phase==='guest'){check(i===g&&!s.request,'请由当前闲家停牌，或等待庄家发牌');nextGuest(s);}else{check(i===d,'只有庄家可以停牌比牌');finish(s);}}
 else throw Error('操作无效');s.rev++;
}
function view(s,i,code,last,now=Date.now()){const ended=s.phase==='ended',revealed=s.hands.map((h,j)=>ended||s.phase==='dealer'&&(j===s.dealer||special(h)>0)||total(h)>LIMIT);return {apiVersion:3,code,you:i,names:s.names,joined:s.tokens.every(Boolean),playerCount:s.tokens.length,phase:s.phase,round:s.round,shoe:s.shoe,handInShoe:s.handInShoe,remaining:s.deck.length,shoeEnded:shoeEnded(s),dealer:s.dealer,guest:s.guest,guestsDone:s.guestsDone,nextDealer:nextDealer(s),revealed,base:BASE,request:s.request,scores:s.scores,result:s.result,logs:s.logs,rev:s.rev,online:last?last.map((v,j)=>!!s.tokens[j]&&now-v<15000):s.tokens.map(()=>true),hands:s.hands.map((h,j)=>h.map((c,k)=>revealed[j]||j===i||k>0?c:null)),totals:s.hands.map((h,j)=>h.length&&(revealed[j]||j===i)?total(h):null)};}
module.exports={initial,act,view,nextDealer,shoeEnded,versus};

}};
const cache = {};
function require(name) {
  if (name === 'node:crypto') return {webcrypto: window.crypto};
  if (cache[name]) return cache[name].exports;
  const module = {exports: {}};
  cache[name] = module;
  modules[name](module, require);
  return module.exports;
}
const card = require('card.cjs');
const dice = require('dice.cjs');
const twoHand = require('engine.cjs');
const threeHand = require('tenhalf3.cjs');
const games = ['card', 'dice', 'tenhalf'];
const code = '练习';
let room, table, botTimer, actionCounter, dealerEvent, commandIds;
const randomInt = max => {
  const values = new Uint32Array(1);
  const limit = 4294967296 - 4294967296 % max;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % max;
};
function shuffle() {
  const deck = Array.from({length: 52}, (_, index) => index);
  for (let index = 51; index > 0; index--) {
    const other = randomInt(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}
const roll = () => Array.from({length: 5}, () => randomInt(6) + 1);
const ten = () => room.playerCount === 3 ? threeHand : twoHand;
const copy = value => JSON.parse(JSON.stringify(value));
function create(count, name) {
  clearTimeout(botTimer);
  const names = [name || '你', '机器人·阿岚', '机器人·小满'].slice(0, count);
  const tokens = names.map((_, seat) => String(seat + 1));
  const poker = card.initial(tokens[0], count);
  poker.players = tokens;
  poker.message = '机器人已入座，请荷官发牌';
  room = {
    code, you: 0, names, playerCount: count, memberCount: count, joined: true,
    selected: null, online: tokens.map(() => true), epoch: 0, rev: 0,
    canChangeMode: false, games: {}
  };
  table = {
    card: poker, dice: dice.initial(tokens, names), tenhalf: ten().initial(tokens, names)
  };
  actionCounter = 0;
  dealerEvent = {};
  commandIds = new Set();
  return roomView();
}
function roomView() {
  const status = Object.fromEntries(games.map(game => [game, {round: table[game].round}]));
  return copy({...room, games: {...status, gomoku: {round: 0}, landlord: {round: 0}}});
}
function view(game) {
  const state = table[game];
  const data = game === 'card' ? card.view(state, 0, actionCounter, code) :
    game === 'dice' ? dice.view(state, 0, code) : ten().view(state, 0, code);
  data.names = room.names;
  if (dealerEvent[game]) {
    const {at, ...event} = dealerEvent[game];
    data.dealerEvent = {...event, remaining: Math.max(0, event.duration - (Date.now() - at))};
  }
  return copy(data);
}
function record(game, shuffleCards, recipients) {
  dealerEvent[game] = {
    id: actionCounter, at: Date.now(), shuffle: shuffleCards, recipients,
    duration: (shuffleCards ? 1000 : 0) + recipients.length * 240 + 300
  };
}
function apply(game, seat, action) {
  const state = table[game];
  actionCounter++;
  if (game === 'card') {
    card.action(state, seat, action);
    if (action === 'deal') record(game, true, Array.from({length: 3}, () => room.names.map((_, i) => i)).flat());
    if (action === 'reset' && seat === 0) {
      for (let i = 1; i < room.playerCount; i++) card.action(state, i, 'reset');
    }
  }
  if (game === 'dice') dice.act(state, seat, action, roll);
  if (game === 'tenhalf') {
    const kind = action.type;
    const fresh = state.round === 0 || state.deck.length < room.playerCount;
    const recipient = kind === 'deal' ? (state.guest ?? 1 - state.dealer) : state.dealer;
    ten().act(state, seat, action, shuffle);
    if (kind === 'start') record(game, fresh, room.names.map((_, i) => i));
    if (kind === 'deal' || kind === 'draw') record(game, false, [recipient]);
  }
}
function nextBot(game) {
  const state = table[game];
  if (game === 'card') {
    if (!state.active) return state.round > 0 && state.dealer > 0 ? [state.dealer, 'deal', 2000] : null;
    const seat = state.turn;
    if (seat === 0) return null;
    if (!state.looked[seat] && (state.steps >= 5 || randomInt(3) === 0)) return [seat, 'look3'];
    const rank = state.looked[seat] ? card.evaluate(state.hands[seat]).score[0] : null;
    const target = state.players.map((_, i) => i).find(i => i !== seat && !state.folded[i]);
    if (rank === 0 && state.steps >= 3 && randomInt(4) === 0) return [seat, 'fold'];
    const count = state.folded.filter(folded => !folded).length;
    if (state.steps >= 7 && (state.steps >= 12 || rank >= 2 || randomInt(4) === 0)) {
      return [seat, count > 2 && state.looked[seat] ? {type: 'open', target} : 'open'];
    }
    return [seat, rank >= 2 && state.base < 60 && randomInt(3) === 0 ? 'raise' : 'follow'];
  }
  if (game === 'dice') {
    if (state.phase === 'playing') return null; // Let the user peek and choose when to open.
    const seat = state.ready.findIndex((ready, i) => i > 0 && !ready);
    return state.ready[0] && seat > 0 ? [seat, {type: 'ready', round: state.round}, 330] : null;
  }
  const action = type => ({type, round: state.round});
  if (state.phase === 'waiting' || state.phase === 'ended') {
    const dealer = ten().nextDealer(state);
    return dealer > 0 ? [dealer, action('start'), 1900] : null;
  }
  if (state.phase === 'guest') {
    const guest = state.guest ?? 1 - state.dealer;
    if (state.request) return state.dealer > 0 ? [state.dealer, action('deal')] : null;
    if (guest === 0) return null;
    const hand = state.hands[guest];
    const points = require('engine.cjs').total(hand);
    return [guest, action(points < 14 && hand.length < 5 ? 'request' : 'stand')];
  }
  const dealer = state.dealer;
  if (dealer === 0) return null;
  return [dealer, action(require('engine.cjs').total(state.hands[dealer]) < 15 ? 'draw' : 'stand')];
}
function notify() {
  if (!room?.selected) return;
  document.getElementById('game-frame').contentWindow?.postMessage({
    type: 'club-live-state', game: room.selected, epoch: room.epoch, code, state: view(room.selected)
  }, location.origin);
}
function schedule() {
  clearTimeout(botTimer);
  const game = room?.selected;
  if (!game || document.hidden) return;
  const turn = nextBot(game);
  if (!turn) return;
  const [seat, action, delay = 500 + randomInt(380)] = turn;
  botTimer = setTimeout(() => {
    if (room?.selected !== game || document.hidden) return;
    try { apply(game, seat, action); notify(); schedule(); }
    catch (error) { console.error('Practice action failed:', error.message); }
  }, delay);
}
function fetchLocal(path, options = {}) {
  const url = new URL(path, location.origin);
  const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {status}));
  const body = options.body ? JSON.parse(options.body) : {};
  if (!room) return json({error: '请重新开始单人练习'}, 404);
  const game = url.pathname.match(/^\/club-api\/game\/(card|dice|tenhalf)\/(state|action)$/);
  try {
    if (url.pathname === '/club-api/state') return json(roomView());
    if (url.pathname === '/club-api/leave') { clearTimeout(botTimer); room = null; return json({ok:true}); }
    if (url.pathname === '/club-api/select') {
      if (body.game !== null && !games.includes(body.game)) return json({error: '此玩法请使用好友房'}, 400);
      room.selected = body.game;
      room.epoch++;
      room.rev++;
      schedule();
      return json(roomView());
    }
    if (!game) return json({error: '练习模式不支持此操作'}, 404);
    const [, name, method] = game;
    if (name !== room.selected) return json({error: '游戏已切换'}, 409);
    if (method === 'state') return json(view(name));
    if (body.epoch !== room.epoch) return json({error: '牌桌已切换'}, 409);
    if (commandIds.has(body.id)) return json(view(name));
    const current = view(name);
    if (body.rev !== (current.revision ?? current.rev)) return json({error: '轮次已更新，请重试', state: current}, 409);
    apply(name, 0, body.action);
    commandIds.add(body.id);
    schedule();
    return json(view(name));
  } catch (error) { return json({error: error.message}, 400); }
}
window.clubPractice = {create, fetch: fetchLocal, schedule, notify};
document.addEventListener('visibilitychange', schedule);

})();
