(()=>{
const SUITS=['♠','♥','♣','♦'];
function evaluate(cards){const r=cards.map(c=>c.rank).sort((a,b)=>b-a),u=new Set(r).size,f=cards.every(c=>c.suit===cards[0].suit),s=u===3&&(r[0]-r[2]===2||r.join(',')==='14,3,2'),h=r.join(',')==='14,3,2'?3:r[0];if(u===1)return {score:[5,r[0]],name:'豹子'};if(f&&s)return {score:[4,h],name:'顺金'};if(f)return {score:[3,...r],name:'金花'};if(s)return {score:[2,h],name:'顺子'};if(u===2){const p=r.find((n,i)=>r.indexOf(n)!==i);return {score:[1,p,r.find(n=>n!==p)],name:'对子'};}return {score:[0,...r],name:'单张'};}
function compare(a,b){const x=evaluate(a).score,y=evaluate(b).score;for(let i=0;i<x.length;i++){const d=x[i]-y[i];if(d)return Math.sign(d);}return 0;}
function deck(){const d=SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit})));for(let i=51;i>0;i--){const cap=4294967296-(4294967296%(i+1));let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=cap);const j=n%(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
function initial(token){return {rulesVersion:2,players:[token,null],banks:[0,0],hands:[[],[]],seen:[false,false],looked:[0,0],dealer:0,round:0,turn:1,base:10,pot:0,lastPot:0,lastBets:[0,0],steps:0,active:false,revealed:false,winner:null,stats:[0,0,0],message:'房间已创建，等待好友加入',logs:[],resetRequests:[]};}
const log=(s,t)=>{s.logs.unshift(t);s.logs=s.logs.slice(0,35);};
const name=i=>'玩家'+(i===0?'一':'二');
function pay(s,i,n){s.banks[i]+=n;s.pot+=n;return n;}
function finish(s,w,txt){const p=s.pot;s.lastPot=p;s.lastBets=[...s.banks];if(w===null)s.stats[2]++;else{s.stats[w]++;s.dealer=w;}s.active=false;s.winner=w;s.revealed=true;s.message=txt+' · 本局投入 '+p+'，下一局发牌时清零';log(s,s.message);}
function settle(s,opener,txt){log(s,txt);const c=compare(...s.hands);let w=c>0?0:c<0?1:null;if(w===null&&opener!==null)w=1-opener;finish(s,w,w===null?'同牌力，平局':name(w)+'获胜 · '+evaluate(s.hands[w]).name+(c===0?'（同牌力，开牌方负）':''));}
function action(s,i,a){
 if(i!==0&&i!==1)throw Error('无效的玩家身份');
 if(a==='deal'){
  if(i!==s.dealer)throw Error('请等待上局赢家发牌（第一局由房主发牌）');if(!s.players[1])throw Error('等待好友加入');if(s.active)throw Error('本局尚未结束');
  const d=deck();s.hands=[d.slice(0,3),d.slice(3,6)];s.round++;s.seen=[false,false];s.looked=[0,0];s.active=true;s.revealed=false;s.winner=null;s.turn=1-s.dealer;s.steps=0;s.base=10;s.pot=0;s.banks=[0,0];s.lastPot=0;s.lastBets=[0,0];s.resetRequests=[];s.message='新一局开始，'+name(s.turn)+'先手';log(s,'第 '+s.round+' 局 · '+name(s.dealer)+'发牌，无底注，对方先手');return;
 }
 if(a==='reset'){
  if(s.active)throw Error('请先结束本局');if(!s.players[1])throw Error('等待好友加入');s.resetRequests??=[];if(!s.resetRequests.includes(i))s.resetRequests.push(i);
  if(s.resetRequests.length===2){const players=s.players;Object.assign(s,initial(players[0]),{players,message:'双方已重置战绩，第一局由房主发牌'});log(s,s.message);}else{s.message=name(i)+'请求重置战绩，等待对方同意';}return;
 }
 if(!s.active)throw Error('请先发牌');if(s.turn!==i)throw Error('还未轮到你');
 if(a==='look'||/^look[123]$/.test(a)){
  const n=a==='look'?3:Number(a.slice(4));if(n<=s.looked[i])throw Error('这些牌已经翻开了');s.looked[i]=n;s.seen[i]=true;log(s,name(i)+'翻开了 '+n+' 张牌');s.message=name(i)+'已翻 '+n+' / 3 张，下注不翻倍';return;
 }
 if(a==='fold'){finish(s,1-i,name(i)+'弃牌，'+name(1-i)+'获胜，双方亮牌');return;}
 if(a==='open'){const n=pay(s,i,s.base);settle(s,i,name(i)+'投入 '+n+' 开牌');return;}
 if(!['raise','follow'].includes(a))throw Error('操作无效');
 if(a==='raise'){if(s.base>=100)throw Error('底分最高 100');s.base+=10;}
 const n=pay(s,i,s.base);s.message=name(i)+(a==='raise'?'加注 ':s.seen[i]?'跟注 ':'闷牌 ')+n;log(s,s.message);s.steps++;
 if(s.steps>=20){settle(s,null,'达到本局上限，自动比牌');return;}
 s.turn=1-i;
}
function view(s,i,revision,code){return {rulesVersion:2,code,revision,you:i,joined:!!s.players[1],dealer:s.dealer,banks:s.banks,lastPot:s.lastPot,lastBets:s.lastBets,hands:s.hands.map((h,j)=>h.map((c,k)=>s.revealed||(j===i&&k<s.looked[i])?c:null)),types:s.hands.map((h,j)=>h.length&&(s.revealed||(j===i&&s.looked[i]===3))?evaluate(h).name:''),seen:s.seen,looked:s.looked,round:s.round,turn:s.turn,base:s.base,pot:s.pot,steps:s.steps,active:s.active,winner:s.winner,stats:s.stats,message:s.message,logs:s.logs,resetRequests:s.resetRequests||[]};}

window.CardEngine={initial,action,view};
})();
