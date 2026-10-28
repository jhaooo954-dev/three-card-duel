'use strict';
// Presentation only: the server owns the deck and sends no private card values here.
(()=>{
 if(document.body.classList.contains('casino-round')){roundDealer();return;}
 const panel=document.createElement('section');
 panel.className='table-dealer';
 panel.setAttribute('aria-label','写实虚拟荷官席');
 panel.innerHTML=`<div class="td-avatar"><img src="/club-game/card/dealer.webp" alt="酒红马甲写实虚拟荷官" width="640" height="680" draggable="false"></div><div class="td-copy"><strong>荷官 <small>DEALER</small></strong><span class="td-status" role="status" aria-live="polite">同一副牌 · 等待发牌</span></div><div class="td-shoe" aria-hidden="true"><i></i><i></i><i></i><b>♠</b></div><div class="td-flight" aria-hidden="true">♠</div>`;
 const anchor=document.querySelector('.arena .table-top')||document.querySelector('.table .table-top');
 anchor.after(panel);
 const status=panel.querySelector('.td-status');let lastId=0,timer=null,flightTimer=null,locked=false,previousFocus=null,flights=[];
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function finish(){for(const n of flights)n.remove();flights=[];clearTimeout(timer);clearTimeout(flightTimer);panel.classList.remove('td-shuffling','td-dealing','td-to-self','td-to-other');document.body.classList.remove('td-running');locked=false;status.textContent='发牌完成 · 祝双方好运';if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
 function update(event,you){
  if(!event||event.id<=lastId)return;lastId=event.id;
  if(event.remaining<=0)return;
  finish();previousFocus=document.activeElement;locked=true;document.body.classList.add('td-running');
  const elapsed=event.duration-event.remaining,shuffleEnd=event.shuffle?1000:0;
  function animate(){
   const t=elapsed+performance.now()-started;
   if(t<shuffleEnd){panel.classList.add('td-shuffling');status.textContent='荷官正在洗牌…';}
   else{panel.classList.remove('td-shuffling');panel.classList.add('td-dealing');const step=Math.min(event.recipients.length-1,Math.floor((t-shuffleEnd)/240)),recipient=event.recipients[Math.max(0,step)];status.textContent=event.shuffle?'洗牌完成 · 荷官正在发牌…':'荷官从原牌堆发牌…';panel.classList.toggle('td-to-self',recipient===you);panel.classList.toggle('td-to-other',recipient!==you);}
   flightTimer=setTimeout(animate,80);
  }
  const started=performance.now();
  if(!motion){
   const counts=event.recipients.reduce((a,i)=>(a[i]++,a),[0,0]),sent=[0,0];
   event.recipients.forEach((recipient,j)=>{
    const el=document.getElementById(recipient===you?'my-cards':'op-cards');
    const offset=sent[recipient]++;
    const delay=shuffleEnd+j*240-elapsed;
    if(delay < -340)return;
    const n=document.createElement('i');n.className='td-real-flight';n.textContent='♠';n.setAttribute('aria-hidden','true');document.body.append(n);flights.push(n);
    requestAnimationFrame(()=>{const k=(el?.children.length||0)-counts[recipient]+offset;const target=el?.children[k];if(!target)return n.remove();const from=panel.querySelector('.td-shoe').getBoundingClientRect(),to=target.getBoundingClientRect();n.style.width=to.width+'px';n.style.height=to.height+'px';const a=n.animate([{transform:`translate(${from.left}px,${from.top}px) rotate(-12deg) scale(.65)`,opacity:1},{transform:`translate(${to.left}px,${to.top}px) rotate(0) scale(1)`,opacity:1}],{duration:340,delay:Math.max(0,delay),easing:'ease-out',fill:'both'});if(delay<0)a.currentTime=-delay;a.onfinish=()=>n.remove();});
   });
  }
  if(motion){status.textContent=event.shuffle?'荷官洗牌、发牌中…':'荷官发牌中…';}else animate();
  timer=setTimeout(finish,event.remaining);
 }
 // Presentation never intercepts gameplay clicks; the server validates every action.
 window.TableDealer={update};
function roundDealer(){
 const arena=document.querySelector('.arena'),panel=document.createElement('section');panel.className='casino-dealer';panel.setAttribute('aria-label','荷官席');
 panel.innerHTML='<div class="dealer-figure"><img src="/club-game/card/dealer.webp" alt="身着酒红马甲的专业虚拟荷官" width="640" height="680" fetchpriority="high" draggable="false"></div><div class="dealer-name">荷官 <span>DEALER</span></div><div class="casino-shoe" aria-hidden="true"><i></i><i></i><i></i><b>♠</b></div><div class="casino-tray" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="casino-status" role="status" aria-live="polite">双方独立入座 · 等待发牌</span>';
 arena.append(panel);const status=panel.querySelector('.casino-status'),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let lastId=0,raf=0,animations=[],flights=[],marks=[],eventStart=0,current=null,viewer=0;
 function cancel(){cancelAnimationFrame(raf);animations.forEach(a=>a.cancel());animations=[];flights.forEach(n=>n.remove());flights=[];marks.forEach(n=>n.classList.remove('card-in-flight'));marks=[];panel.classList.remove('is-shuffling','is-dealing');}
 function finish(){marks.forEach(n=>n.classList.remove('card-in-flight'));marks=[];panel.classList.remove('is-shuffling','is-dealing');status.textContent='发牌完成 · 请按回合操作';}
 function flyCard(recipient,k,at){
  const target=document.querySelector('#cards'+(recipient===viewer?0:1))?.children[k];if(!target)return;
  const rect=arena.getBoundingClientRect(),shoe=panel.querySelector('.casino-shoe').getBoundingClientRect(),to=target.getBoundingClientRect();
  target.classList.add('card-in-flight');marks.push(target);const n=document.createElement('i');n.className='casino-flight';n.textContent='♠';n.setAttribute('aria-hidden','true');n.style.width=to.width+'px';n.style.height=to.height+'px';arena.append(n);flights.push(n);
  const dx=to.left-rect.left,dy=to.top-rect.top,sx=shoe.left-rect.left,sy=shoe.top-rect.top;
  const a=n.animate([{transform:`translate(${sx}px,${sy}px) rotate(-8deg) scale(.56)`,opacity:1,filter:'drop-shadow(0 9px 4px #0006)'},{offset:.6,transform:`translate(${sx+(dx-sx)*.72}px,${sy+(dy-sy)*.68-14}px) rotate(${recipient===viewer?9:-9}deg) scale(.95)`,opacity:1},{transform:`translate(${dx}px,${dy}px) rotate(${k===0?-6:k===2?6:0}deg) scale(1)`,opacity:1,filter:'drop-shadow(0 2px 1px #0004)'}],{duration:360,easing:'cubic-bezier(.15,.65,.25,1)',fill:'both'});
  animations.push(a);a.currentTime=Math.max(0,at);a.onfinish=()=>{target.classList.remove('card-in-flight');n.remove();};
 }
 function update(e,you){
  if(!e||e.id<=lastId)return;lastId=e.id;cancel();if(e.remaining<=0)return;current=e;viewer=you;eventStart=performance.now()-(e.duration-e.remaining);const sent=new Set(),shuffleEnd=e.shuffle?1000:0;
  if(reduced){status.textContent='荷官发牌完成 · 请按回合操作';return;}
  // Hide only undealt cards. Gameplay buttons remain responsive throughout.
  for(const id of ['cards0','cards1'])for(const n of document.getElementById(id).children){n.classList.add('card-in-flight');marks.push(n);}
  function tick(){const t=performance.now()-eventStart;
   if(t<shuffleEnd){panel.classList.add('is-shuffling');status.textContent='荷官切牌、交错洗牌…';}
   else{panel.classList.remove('is-shuffling');panel.classList.add('is-dealing');status.textContent='荷官依次向双方发牌…';}
   const counts=[0,0];e.recipients.forEach((recipient,j)=>{const k=counts[recipient]++,start=shuffleEnd+j*240;if(t>=start&&!sent.has(j)){sent.add(j);if(t-start<360)flyCard(recipient,k,t-start);else document.getElementById('cards'+(recipient===you?0:1)).children[k]?.classList.remove('card-in-flight');}});
   if(t<e.duration)raf=requestAnimationFrame(tick);else finish();
  }
  // accept() renders cards immediately after update; begin on the next paint.
  raf=requestAnimationFrame(tick);
 }
 function chip(slot,amount,collect=false){if(reduced)return;const target=document.querySelector('#player'+slot+' .balance'),pot=document.querySelector('.center-pot .chips');if(!target||!pot)return;const r=arena.getBoundingClientRect(),a=(collect?pot:target).getBoundingClientRect(),b=(collect?target:pot).getBoundingClientRect();for(let j=0;j<3;j++){const n=document.createElement('i');n.className='casino-chip';n.textContent=amount||'♠';n.setAttribute('aria-hidden','true');arena.append(n);const x=a.left+a.width/2-r.left,y=a.top+a.height/2-r.top,dx=b.left+b.width/2-r.left,dy=b.top+b.height/2-r.top;const anim=n.animate([{transform:`translate(${x}px,${y}px) rotate(0)`,opacity:1},{offset:.65,transform:`translate(${x+(dx-x)*.7}px,${y+(dy-y)*.7-25}px) rotate(170deg)`,opacity:1},{transform:`translate(${dx+j*6}px,${dy-j*3}px) rotate(250deg)`,opacity:0}],{duration:460,delay:j*55,easing:'ease-out',fill:'both'});anim.onfinish=()=>n.remove();}}
 window.TableDealer={update,bet:(s,n)=>chip(s,n),collect:s=>chip(s,0,true)};
}
})();
