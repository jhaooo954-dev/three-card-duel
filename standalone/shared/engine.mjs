export const SUITS=['♠','♥','♣','♦'];
export function evaluate(cards){const r=cards.map(c=>c.rank).sort((a,b)=>b-a),u=new Set(r).size,f=cards.every(c=>c.suit===cards[0].suit),s=u===3&&(r[0]-r[2]===2||r.join(',')==='14,3,2'),h=r.join(',')==='14,3,2'?3:r[0];if(u===1)return {score:[5,r[0]],name:'豹子'};if(f&&s)return {score:[4,h],name:'顺金'};if(f)return {score:[3,...r],name:'金花'};if(s)return {score:[2,h],name:'顺子'};if(u===2){const p=r.find((n,i)=>r.indexOf(n)!==i);return {score:[1,p,r.find(n=>n!==p)],name:'对子'};}return {score:[0,...r],name:'单张'};}
export function compare(a,b){const x=evaluate(a).score,y=evaluate(b).score;for(let i=0;i<x.length;i++){const d=x[i]-y[i];if(d)return Math.sign(d);}return 0;}
export function deck(){const d=SUITS.flatMap(suit=>Array.from({length:13},(_,i)=>({rank:i+2,suit})));for(let i=51;i>0;i--){const cap=4294967296-(4294967296%(i+1));let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=cap);const j=n%(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
export function initial(token){return {players:[token,null],banks:[1000,1000],hands:[[],[]],seen:[false,false],round:0,turn:0,base:10,pot:0,steps:0,active:false,revealed:false,winner:null,stats:[0,0,0],message:'房间已创建，等待好友加入',logs:[]};}
const log=(s,t)=>{s.logs.unshift(t);s.logs=s.logs.slice(0,35);};
const name=i=>'玩家'+(i===0?'一':'二');
const cost=(s,i)=>s.base*(s.seen[i]?2:1);
function pay(s,i,n){n=Math.min(s.banks[i],n);s.banks[i]-=n;s.pot+=n;return n;}
function finish(s,w,txt,show){const p=s.pot;if(w===null){s.banks[0]+=Math.floor(p/2);s.banks[1]+=p-Math.floor(p/2);s.stats[2]++;}else{s.banks[w]+=p;s.stats[w]++;}s.active=false;s.winner=w;s.revealed=show;s.pot=0;s.message=txt+' · 底池 '+p;log(s,s.message);}
function settle(s,opener,txt){log(s,txt);const c=compare(...s.hands);let w=c>0?0:c<0?1:null;if(w===null&&opener!==null)w=1-opener;finish(s,w,w===null?'同牌力，平分底池':name(w)+'获胜 · '+evaluate(s.hands[w]).name+(c===0?'（同牌力，开牌方负）':''),true);}
export function action(s,i,a){
 if(a==='deal'){
  if(i!==0)throw Error('请等待房主发牌');if(!s.players[1])throw Error('等待好友加入');if(s.active)throw Error('本局尚未结束');if(s.banks.some(n=>n<10))throw Error('积分不足，请双方同意重置');
  const d=deck();s.hands=[d.slice(0,3),d.slice(3,6)];s.round++;s.seen=[false,false];s.active=true;s.revealed=false;s.winner=null;s.turn=(s.round-1)%2;s.steps=0;s.base=10;s.pot=0;s.resetRequests=[];pay(s,0,10);pay(s,1,10);s.message='新一局开始，'+name(s.turn)+'先手';log(s,'第 '+s.round+' 局 · 双方各下底注 10');return;
 }
 if(a==='reset'){
  if(s.active)throw Error('请先结束本局');s.resetRequests??=[];if(!s.resetRequests.includes(i))s.resetRequests.push(i);
  if(s.resetRequests.length===2){s.banks=[1000,1000];s.round=0;s.stats=[0,0,0];s.hands=[[],[]];s.seen=[false,false];s.revealed=false;s.winner=null;s.resetRequests=[];s.message='双方已同意重置，等待房主发牌';log(s,s.message);}else{s.message=name(i)+'请求重置积分，等待对方同意';}return;
 }
 if(!s.active)throw Error('请先发牌');if(s.turn!==i)throw Error('还未轮到你');
 if(a==='look'){if(s.seen[i])throw Error('你已看牌');s.seen[i]=true;log(s,name(i)+'看了牌');s.message=name(i)+'已看牌，下注翻倍';return;}
 if(a==='fold'){finish(s,1-i,name(i)+'弃牌，'+name(1-i)+'获胜',false);return;}
 if(a==='open'){const n=pay(s,i,cost(s,i)*2);settle(s,i,name(i)+'投入 '+n+' 开牌');return;}
 if(!['raise','follow'].includes(a))throw Error('操作无效');
 if(a==='raise'){if(s.base>=100)throw Error('底分最高 100');if(s.banks[i]<(s.base+10)*(s.seen[i]?2:1))throw Error('积分不足以加注');s.base+=10;}
 if(s.banks[i]<cost(s,i)){settle(s,null,'积分不足，自动比牌');return;}
 const n=pay(s,i,cost(s,i));s.message=name(i)+(a==='raise'?'加注 ':s.seen[i]?'跟注 ':'闷牌 ')+n;log(s,s.message);s.steps++;
 if(s.steps>=20||s.banks[i]===0){settle(s,null,'达到本局上限，自动比牌');return;}
 s.turn=1-i;if(s.banks[s.turn]<cost(s,s.turn))settle(s,null,'积分不足，自动比牌');
}
export function view(s,i,revision,code){return {code,revision,you:i,joined:!!s.players[1],banks:s.banks,hands:s.hands.map((h,j)=>s.revealed||(j===i&&s.seen[i])?h:h.map(()=>null)),types:s.hands.map((h,j)=>h.length&&(s.revealed||(j===i&&s.seen[i]))?evaluate(h).name:''),seen:s.seen,round:s.round,turn:s.turn,base:s.base,pot:s.pot,steps:s.steps,active:s.active,winner:s.winner,stats:s.stats,message:s.message,logs:s.logs,resetRequests:s.resetRequests||[]};}
