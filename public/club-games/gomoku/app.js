"use strict";
const $=id=>document.getElementById(id),epoch=Number(new URLSearchParams(location.search).get('epoch')||0);
let session=null,state=null,busy=false,polling=false,lastLive=0;
try{session=JSON.parse(localStorage.getItem('club-session')||'null');}catch{}
const cells=[];
for(let row=0;row<15;row++)for(let col=0;col<15;col++){const b=document.createElement('button');b.type='button';b.className='cell';b.setAttribute('aria-label',`第${row+1}行第${col+1}列，空位`);b.onclick=()=>action({type:'move',row,col});$('board').append(b);cells.push(b);}
function note(m){$('notice').textContent=m||'';}
async function api(body){const c=new AbortController(),timer=setTimeout(()=>c.abort(),65000);try{const r=await fetch('/club-api/game/gomoku/'+(body?'action':'state?code='+encodeURIComponent(session.code)),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:c.signal,cache:'no-store'});const v=await r.json();if(!r.ok){const e=Error(v.error||'连接失败');e.state=v.state;throw e;}return v;}finally{clearTimeout(timer);}}
function accept(v){if(state&&v.rev<state.rev)return;state=v;paint();}
function paint(){const s=state;if(!s)return;const playing=s.phase==='playing',myTurn=playing&&s.turn===s.you;
 $('round').textContent=s.round?'第 '+s.round+' 局 · '+s.moves+' 手':'首局房主先手';
 for(let i=0;i<2;i++){const black=i===s.starter;$('seat'+i).className=(black?'black':'white')+(playing&&s.turn===i?' active':'');$('name'+i).textContent=s.names[i]+(i===s.you?'（我）':'');$('score'+i).textContent=(black?'黑棋':'白棋')+' · '+s.scores[i]+' 胜';}
 const wins=new Set(s.winningLine);s.board.forEach((v,k)=>{const row=Math.floor(k/15),col=k%15,color=v===null?'':v===s.starter?'black':'white';const cls='cell '+color+(k===s.lastMove?' last':'')+(wins.has(k)?' winning':'')+([3,7,11].includes(row)&&[3,7,11].includes(col)?' star':'');if(cells[k].className!==cls)cells[k].className=cls;cells[k].disabled=busy||!myTurn||v!==null;cells[k].setAttribute('aria-label',`第${row+1}行第${col+1}列，${v===null?'空位':color==='black'?'黑棋':'白棋'}${k===s.lastMove?'，最后一手':''}`);});
 $('title').textContent=playing?(myTurn?'轮到你落子':s.names[s.turn]+'正在思考…'):s.phase==='ended'?(s.winner===null?'棋盘已满 · 本局和棋':s.winner===s.you?'你赢了！下一局你先落子':s.names[s.winner]+'获胜 · 下局先落子'):'准备好，开始对弈';
 $('subtitle').textContent=playing?(s.starter===s.you?'你执黑棋':'你执白棋')+' · 横、竖、斜连成五子获胜':s.phase==='ended'?(s.winner===null?'平局保持本局先手':'赢家下一局执黑先走'):'首局房主执黑 · 之后赢家先手';
 $('start').hidden=playing;$('start').disabled=busy||!s.joined||s.you!==s.nextStarter;$('start').textContent=busy?'正在开局…':s.you===s.nextStarter?(s.round?'开始下一局 · 我执黑先走':'开始首局 · 我执黑先走'):'等待'+s.names[s.nextStarter]+'开局';
}
async function action(a){if(busy||!state||!session)return;busy=true;paint();try{accept(await api({code:session.code,epoch,id:Array.from(crypto.getRandomValues(new Uint8Array(12)),v=>v.toString(16).padStart(2,'0')).join(''),rev:state.rev,action:{...a,round:state.round}}));note('');}catch(e){if(e.state)accept(e.state);note(e.message);}finally{busy=false;paint();}}
async function poll(){if(!session){note('请从统一房间大厅进入五子棋');return;}if(polling||busy||document.hidden||Date.now()-lastLive<12000)return;polling=true;try{accept(await api());note('');}catch(e){note(e.message);}finally{polling=false;}}
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='club-live-state'&&e.data.game==='gomoku'&&e.data.epoch===epoch&&e.data.code===session?.code&&e.data.state){lastLive=Date.now();accept(e.data.state);}});
$('start').onclick=()=>action({type:'start'});document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});setInterval(poll,900);poll();if(parent!==window)parent.postMessage({type:'club-live-ready'},location.origin);
