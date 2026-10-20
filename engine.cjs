'use strict';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const LIMIT=21,BASE=10;
const value=c=>{const rank=c%13+1;return rank<=10?rank*2:1;};
const total=cards=>cards.reduce((n,c)=>n+value(c),0);
const points=n=>n%2?(n-1)/2+'.5':String(n/2);
function special(hand){const n=total(hand);return n>LIMIT?0:hand.length===5?3:n===LIMIT?2:0;}
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,dealer:0,hands:[[],[]],deck:[],request:false,scores:[0,0],result:null,logs:[],rev:0};}
const nextDealer=s=>s.phase==='ended'?1-s.dealer:s.dealer;
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,30);}
function finish(s,winner,multiplier,reason){const amount=BASE*multiplier,delta=[0,0];delta[winner]=amount;delta[1-winner]=-amount;s.scores=s.scores.map((v,i)=>v+delta[i]);s.result={winner,loser:1-winner,dealer:s.dealer,multiplier,amount,delta,reason,totals:s.hands.map(total)};s.phase='ended';s.request=false;log(s,s.names[winner]+'赢 '+amount+'分 · '+reason+' · 下一铺换庄');}
function compare(s){const d=s.dealer,g=1-d,dt=total(s.hands[d]),gt=total(s.hands[g]),ds=special(s.hands[d]),gs=special(s.hands[g]);if(dt>LIMIT)return finish(s,g,gs||1,'庄家爆牌');if(ds)return finish(s,d,ds,ds===3?'庄家五张未爆，庄家优先赢':'庄家十点半，庄家优先赢');if(gs)return finish(s,g,gs,gs===3?'闲家五张未爆':'闲家十点半');if(dt>=gt)return finish(s,d,1,dt===gt?'同点，庄家赢':'庄家点数大');finish(s,g,1,'闲家点数大');}
function take(s,i){check(s.deck.length>0,'牌堆不足，请重新建房');check(s.hands[i].length<5,'最多五张牌');const c=s.deck.pop();s.hands[i].push(c);}
function act(s,i,a,makeDeck){check(i===0||i===1,'玩家无效');check(s.tokens[1],'等待好友加入');check(a.round===s.round,'这一铺已经更新，请重新操作');
if(a.type==='start'){check(s.phase==='waiting'||s.phase==='ended','这一铺还没结束');check(i===nextDealer(s),'这一铺由对方坐庄发牌');const deck=makeDeck();check(Array.isArray(deck)&&deck.length===52&&new Set(deck).size===52&&deck.every(c=>Number.isInteger(c)&&c>=0&&c<52),'洗牌失败');const dealer=nextDealer(s);s.dealer=dealer;s.round++;s.hands=[[],[]];s.deck=deck.slice();s.request=false;s.result=null;take(s,0);take(s,1);s.phase='guest';log(s,'第 '+s.round+' 铺 · '+s.names[dealer]+'坐庄，各发一张底牌');s.rev++;return;}
check(s.phase==='guest'||s.phase==='dealer','请庄家先发牌');const d=s.dealer,g=1-d;
if(a.type==='request'){check(s.phase==='guest'&&i===g,'只有闲家要牌时可以操作');check(!s.request,'已要牌，等待庄家发牌');s.request=true;log(s,s.names[g]+'要一张，等待庄家发牌');}
else if(a.type==='deal'){check(s.phase==='guest'&&i===d&&s.request,'闲家要牌后，庄家才能发一张');take(s,g);s.request=false;log(s,'庄家给闲家发一张');const t=total(s.hands[g]);if(t>LIMIT)finish(s,d,1,'闲家爆牌');else if(special(s.hands[g])){s.phase='dealer';log(s,'闲家要牌结束，轮到庄家补牌');}}
else if(a.type==='draw'){check(s.phase==='dealer'&&i===d,'请先等闲家要牌结束');take(s,d);log(s,'庄家给自己补一张');if(total(s.hands[d])>LIMIT||special(s.hands[d]))compare(s);}
else if(a.type==='stand'){if(s.phase==='guest'){check(i===g&&!s.request,'请等待庄家发牌，或由闲家停牌');s.phase='dealer';log(s,'闲家停牌，轮到庄家补牌');}else{check(i===d,'只有庄家可以停牌比牌');compare(s);}}
else throw Error('操作无效');s.rev++;}
function view(s,i,code,lastSeen,now=Date.now()){const ended=s.phase==='ended';return {apiVersion:1,code,you:i,names:s.names,joined:!!s.tokens[1],phase:s.phase,round:s.round,dealer:s.dealer,nextDealer:nextDealer(s),base:BASE,request:s.request,scores:s.scores,result:s.result,logs:s.logs,rev:s.rev,online:lastSeen?lastSeen.map((v,j)=>!!s.tokens[j]&&now-v<15000):[true,true],hands:s.hands.map((h,j)=>h.map((c,k)=>ended||j===i||k>0?c:null)),totals:s.hands.map((h,j)=>h.length&&(ended||j===i)?total(h):null)};}
module.exports={initial,act,view,value,total,points,special,nextDealer,LIMIT,BASE};
