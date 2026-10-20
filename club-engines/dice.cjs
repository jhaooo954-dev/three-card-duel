'use strict';
const assert=(b,m)=>{if(!b)throw Error(m);};
const SHAKE_MS=1800;
function initial(tokens,names){return {tokens,names,phase:'waiting',round:0,dice:[[],[]],ready:[false,false],rollUntil:0,openedBy:null,logs:[],rev:0};}
function log(s,m){s.logs.unshift(m);s.logs=s.logs.slice(0,20);}
function act(s,i,a,roll,now=Date.now()){assert(i===0||i===1,'玩家无效');assert(s.tokens[1],'等待好友加入');assert(a.round===s.round,'对局已更新，请重新操作');
if(a.type==='ready'){assert(s.phase!=='playing','本局还没开盅，不能重新摇骰');if(s.ready[i])return;s.ready[i]=true;if(s.ready.every(Boolean)){const hands=[roll(),roll()];assert(hands.every(h=>Array.isArray(h)&&h.length===5&&h.every(v=>Number.isInteger(v)&&v>=1&&v<=6)),'摇骰失败，请重试');s.dice=hands;s.phase='playing';s.round++;s.rollUntil=now+SHAKE_MS;s.openedBy=null;s.ready=[false,false];log(s,'第 '+s.round+' 盅 · 双方一起摇骰');}else log(s,s.names[i]+'已准备摇骰');s.rev++;return;}
assert(s.phase==='playing','请双方先准备摇骰');
assert(a.type==='open','请自己口头喊骰，想看结果时点开盅');
assert(now>=s.rollUntil,'正在摇骰，请稍等');
s.phase='ended';s.openedBy=i;s.ready=[false,false];log(s,s.names[i]+'开盅 · 双方骰子已公开');s.rev++;}
function view(s,i,code,lastSeen,now=Date.now()){return {apiVersion:2,code,you:i,names:s.names,joined:!!s.tokens[1],phase:s.phase,round:s.round,ready:s.ready,rollRemaining:Math.max(0,s.rollUntil-now),openedBy:s.openedBy,logs:s.logs,rev:s.rev,online:lastSeen?lastSeen.map((v,j)=>!!s.tokens[j]&&now-v<15000):[true,true],dice:s.dice.map((h,j)=>s.phase==='ended'||j===i?h:h.map(()=>null))};}
module.exports={initial,act,view,SHAKE_MS};
