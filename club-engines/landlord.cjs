'use strict';
const crypto=require('node:crypto');
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const {rank,sort,classify,beats,moves,labels}=require('../public/club-games/landlord/rules.js');
function shuffled(){const d=Array.from({length:54},(_,i)=>i);for(let i=53;i>0;i--){const j=crypto.randomInt(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
function initial(tokens,names){return {tokens,names,round:0,rev:0,phase:'waiting',hands:tokens.map(()=>[]),bottom:[],turn:0,landlord:null,caller:null,callPassed:[],grabQueue:[],multiplier:1,doubles:tokens.map(()=>null),open:tokens.map(()=>false),played:tokens.map(()=>0),scores:tokens.map(()=>0),lastPlay:null,table:tokens.map(()=>null),passes:0,history:[],winner:null,delta:tokens.map(()=>0),spring:null,redeals:0};}
function log(s,i,text){s.history.push({seat:i,text});if(s.history.length>36)s.history.shift();}
function deal(s,deck){check(Array.isArray(deck)&&deck.length===54&&new Set(deck).size===54&&deck.every(c=>Number.isInteger(c)&&c>=0&&c<54),'牌组无效');s.hands=[0,1,2].map(i=>sort(deck.slice(i*17,i*17+17)));s.bottom=deck.slice(51);Object.assign(s,{phase:'calling',turn:(s.round-1+s.redeals)%3,landlord:null,caller:null,callPassed:[],grabQueue:[],multiplier:1,doubles:[null,null,null],open:[false,false,false],played:[0,0,0],lastPlay:null,table:[null,null,null],passes:0,winner:null,delta:[0,0,0],spring:null,history:[]});log(s,null,s.redeals?'三家不叫，已重新发牌':'发牌完成，开始叫地主');}
function settleLandlord(s){s.landlord=s.candidate;s.hands[s.landlord]=sort([...s.hands[s.landlord],...s.bottom]);s.phase='doubling';s.turn=s.landlord;log(s,s.landlord,'成为地主，获得3张底牌');}
function nextGrab(s){while(s.grabQueue.length){const next=s.grabQueue.shift();if(next===s.caller&&s.candidate===s.caller)continue;s.turn=next;return;}settleLandlord(s);}
function finish(s,winner){s.phase='ended';s.winner=winner;const landlordWins=winner===s.landlord;s.spring=landlordWins&&s.played.every((v,i)=>i===s.landlord||v===0)?'春天':!landlordWins&&s.played[s.landlord]===1?'反春天':null;if(s.spring){s.multiplier*=2;log(s,null,s.spring+'，倍数×2');}s.delta=[0,0,0];for(let i=0;i<3;i++)if(i!==s.landlord){const amount=s.multiplier*s.doubles[s.landlord]*s.doubles[i],d=landlordWins?-amount:amount;s.delta[i]=d;s.delta[s.landlord]-=d;}s.scores=s.scores.map((v,i)=>v+s.delta[i]);log(s,winner,(landlordWins?'地主':'农民')+'获胜');}
function act(s,i,a,deckFn=shuffled){
 check(s.tokens.length===3&&s.tokens.every(Boolean),'斗地主需要三人到齐，请创建三人房间');check(i>=0&&i<3&&Number.isInteger(i),'玩家无效');check(a.round===s.round,'本局已更新，请重试');
 if(a.type==='start'){check(i===0,'请房主开始新一局');check(['waiting','ended'].includes(s.phase),'本局尚未结束');const deck=deckFn();check(deck.length===54,'牌组无效');s.round++;s.redeals=0;deal(s,deck);s.rev++;return;}
 if(a.type==='call'){
  check(s.phase==='calling'&&s.turn===i,'还没轮到你叫地主');check(typeof a.yes==='boolean','请选择叫地主或不叫');
  if(a.yes){s.caller=i;s.candidate=i;s.phase='grabbing';s.grabQueue=[(i+1)%3,(i+2)%3,i].filter(j=>!s.callPassed.includes(j));log(s,i,'叫地主');nextGrab(s);}else{s.callPassed.push(i);log(s,i,'不叫');if(s.callPassed.length===3){s.redeals++;deal(s,deckFn());}else s.turn=(i+1)%3;}
 }else if(a.type==='grab'){
  check(s.phase==='grabbing'&&s.turn===i,'还没轮到你抢地主');check(typeof a.yes==='boolean','请选择抢地主或不抢');if(a.yes){s.candidate=i;s.multiplier*=2;log(s,i,'抢地主，倍数×2');}else log(s,i,'不抢');nextGrab(s);
 }else if(a.type==='double'){
  check(s.phase==='doubling','当前不是加倍阶段');check(s.doubles[i]===null,'你已经选择过加倍');check(typeof a.yes==='boolean','请选择加倍或不加倍');check(a.open===undefined||typeof a.open==='boolean','明牌选项无效');check(!a.open||i===s.landlord,'仅地主可选择明牌');s.doubles[i]=a.yes?2:1;if(a.open){s.open[i]=true;s.multiplier*=2;}log(s,i,(a.yes?'加倍':'不加倍')+(a.open?'，明牌×2':''));if(s.doubles.every(v=>v!==null)){s.phase='playing';s.turn=s.landlord;log(s,null,'地主先出牌');}
 }else if(a.type==='play'){
  check(s.phase==='playing'&&s.turn===i,'还没轮到你出牌');const cs=a.cards;check(Array.isArray(cs)&&cs.length>0&&new Set(cs).size===cs.length&&cs.every(c=>s.hands[i].includes(c)),'请选择自己手里的牌');const p=classify(cs);check(p,'所选牌不能组成合法牌型');check(beats(p,s.lastPlay?.pattern),'请出相同牌型且更大的牌，或使用炸弹');s.hands[i]=s.hands[i].filter(c=>!cs.includes(c));s.played[i]++;s.lastPlay={seat:i,cards:sort(cs),pattern:p,label:labels[p.type]};s.table[i]={cards:sort(cs),label:labels[p.type]};s.passes=0;if(['bomb','rocket'].includes(p.type))s.multiplier*=2;log(s,i,labels[p.type]+(['bomb','rocket'].includes(p.type)?'，倍数×2':''));if(!s.hands[i].length)finish(s,i);else{s.turn=(i+1)%3;s.table[s.turn]=null;}
 }else if(a.type==='pass'){
  check(s.phase==='playing'&&s.turn===i,'还没轮到你出牌');check(s.lastPlay&&s.lastPlay.seat!==i,'新一轮必须出牌');s.table[i]={pass:true};s.passes++;log(s,i,'不出');s.turn=(i+1)%3;if(s.passes===2){s.turn=s.lastPlay.seat;s.lastPlay=null;s.passes=0;s.table=[null,null,null];log(s,null,'两家不出，重新领出');}else s.table[s.turn]=null;
 }else throw Error('操作无效');s.rev++;
}
function view(s,i,code,last){const reveal=s.phase==='ended';return {code,you:i,names:s.names,joined:s.tokens.length===3&&s.tokens.every(Boolean),online:last.map((v,j)=>!!s.tokens[j]&&Date.now()-v<15000),round:s.round,rev:s.rev,phase:s.phase,turn:s.turn,landlord:s.landlord,caller:s.caller,multiplier:s.multiplier,doubles:s.doubles,open:s.open,played:s.played,scores:s.scores,lastPlay:s.lastPlay,table:s.table,history:s.history,winner:s.winner,delta:s.delta,spring:s.spring,redeals:s.redeals,bottom:s.bottom.map(c=>s.landlord===null?null:c),hands:s.hands.map((cs,j)=>cs.map(c=>reveal||j===i||s.open[j]?c:null)),counts:s.hands.map(cs=>cs.length)};}
module.exports={initial,act,view,rank,sort,classify,beats,moves,labels,shuffled};
