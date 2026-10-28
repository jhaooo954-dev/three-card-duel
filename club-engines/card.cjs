'use strict';
const crypto=require('node:crypto').webcrypto;
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
function action(s,i,a){
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
 if(a==='open'){const n=pay(s,i,cost(s,i));settle(s,i,name(i)+'投入 '+n+' 开牌');return;}
 if(!['raise','follow'].includes(a))throw Error('操作无效');
 if(a==='raise'){if(s.base>=100)throw Error('底分最高 100');s.base+=10;}
 const n=pay(s,i,cost(s,i));s.message=name(i)+(a==='raise'?'加注 ':s.seen[i]?'跟注 ':'闷牌 ')+n;log(s,s.message);s.steps++;
 if(s.steps>=20){settle(s,null,'达到本局上限，自动比牌');return;}
 s.turn=next(s,i);
}
function view(s,i,revision,code){return {rulesVersion:3,code,revision,you:i,joined:s.players.every(Boolean),playerCount:s.players.length,folded:s.folded,callCost:cost(s,i),openCost:cost(s,i),raiseCost:(s.base+10)*(s.looked[i]>0?2:1),dealer:s.dealer,banks:s.banks,lastPot:s.lastPot,lastBets:s.lastBets,hands:s.hands.map((h,j)=>h.map((c,k)=>s.revealed||(j===i&&k<s.looked[i])?c:null)),types:s.hands.map((h,j)=>h.length&&(s.revealed||(j===i&&s.looked[i]===3))?evaluate(h).name:''),seen:s.seen,looked:s.looked,round:s.round,turn:s.turn,base:s.base,pot:s.pot,steps:s.steps,active:s.active,winner:s.winner,stats:s.stats,message:s.message,logs:s.logs,resetRequests:s.resetRequests||[]};}

module.exports={initial,action,view,evaluate,compare};
