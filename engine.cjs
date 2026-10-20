'use strict';
const assert=(b,m)=>{if(!b)throw Error(m);};
const name=i=>i===0?'房主':'好友';
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,dice:[[],[]],ready:[false,false],turn:0,first:0,bid:null,wild:true,wins:[0,0],score:[0,0],result:null,logs:[],rev:0};}
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,25);}
function act(s,i,a,roll){assert(i===0||i===1,'玩家无效');assert(s.tokens[1],'等待好友加入');if(a.type==='ready'){assert(s.phase!=='playing','本局还没结束');s.ready[i]=true;if(s.ready.every(Boolean)){s.dice=[roll(),roll()];s.phase='playing';s.round++;s.turn=s.first;s.bid=null;s.wild=true;s.result=null;s.ready=[false,false];log(s,'第 '+s.round+' 局开始，'+s.names[s.turn]+'先叫');}else log(s,s.names[i]+'已准备');s.rev++;return;}
assert(s.phase==='playing','请双方先准备');assert(s.turn===i,'还未轮到你');
if(a.type==='bid'){const n=a.count,p=a.face;assert(Number.isInteger(n)&&n>=1&&n<=10&&Number.isInteger(p)&&p>=1&&p<=6,'请选择1～10个、1～6点');assert(!s.bid||n>s.bid.count||(n===s.bid.count&&p>s.bid.face),'叫数必须提高：加个数，或同个数加点数');if(p===1)s.wild=false;s.bid={count:n,face:p,by:i};s.turn=1-i;log(s,s.names[i]+'叫 '+n+' 个 '+p+' 点'+(s.wild?'':'（1点不万能）'));}
else if(a.type==='open'){assert(s.bid,'还没有人叫数');const b=s.bid;const actual=s.dice.flat().filter(v=>v===b.face||(s.wild&&b.face!==1&&v===1)).length;const winner=actual>=b.count?b.by:i;const loser=1-winner;s.wins[winner]++;s.score[winner]+=10;s.score[loser]-=10;s.phase='ended';s.first=loser;s.ready=[false,false];s.result={winner,opener:i,actual,bid:{...b},delta:s.score.map((_,j)=>j===winner?10:-10),wild:s.wild};log(s,'开盅：'+b.face+'点共 '+actual+' 个，'+s.names[winner]+'获胜');}
else throw Error('操作无效');s.rev++;}
function view(s,i,code,lastSeen){return {code,you:i,names:s.names,joined:!!s.tokens[1],phase:s.phase,round:s.round,turn:s.turn,first:s.first,bid:s.bid,wild:s.wild,ready:s.ready,wins:s.wins,score:s.score,result:s.result,logs:s.logs,rev:s.rev,online:lastSeen?lastSeen.map((v,j)=>!!s.tokens[j]&&Date.now()-v<15000):[true,true],dice:s.dice.map((a,j)=>s.phase==='ended'||j===i?a:a.map(()=>null))};}
module.exports={initial,act,view};
