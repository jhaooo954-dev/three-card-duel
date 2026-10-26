'use strict';
// Presentation only: the server owns the deck and sends no private card values here.
(()=>{
 const panel=document.createElement('section');
 panel.className='table-dealer';
 panel.setAttribute('aria-label','系统荷官');
 panel.innerHTML=`<div class="td-avatar" aria-hidden="true"><svg viewBox="0 0 120 100"><path d="M18 100V82Q20 65 43 63L60 78 77 63Q100 65 102 82V100" fill="#1a302e"/><path d="M43 63L60 78 77 63 69 100H51Z" fill="#faf0db"/><path d="M50 70L60 74 70 70V82L60 78 50 82Z" fill="#bf9454"/><rect x="52" y="52" width="16" height="17" rx="5" fill="#d4a886"/><ellipse cx="60" cy="34" rx="23" ry="27" fill="#e4bb98"/><path d="M37 33Q27 4 57 3Q86 0 84 34L76 23Q57 29 46 17Z" fill="#253633"/><path d="M48 35h3m18 0h3" stroke="#253633" stroke-width="3" stroke-linecap="round"/><path d="M54 48q6 5 12 0" fill="none" stroke="#906753" stroke-width="2"/><path class="td-hand left" d="M21 87L43 94" stroke="#e4bb98" stroke-width="12" stroke-linecap="round"/><path class="td-hand right" d="M99 87L77 94" stroke="#e4bb98" stroke-width="12" stroke-linecap="round"/></svg></div><div class="td-copy"><strong>系统荷官</strong><span class="td-status" role="status" aria-live="polite">服务器随机洗牌 · 双方同等发牌</span></div><div class="td-shoe" aria-hidden="true"><i></i><i></i><i></i><b>♠</b></div><div class="td-flight" aria-hidden="true">♠</div>`;
 const anchor=document.querySelector('.arena .table-top')||document.querySelector('.table .table-top');
 anchor.after(panel);
 const status=panel.querySelector('.td-status');let lastId=0,timer=null,flightTimer=null,locked=false,previousFocus=null;
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function finish(){clearTimeout(timer);clearTimeout(flightTimer);panel.classList.remove('td-shuffling','td-dealing','td-to-self','td-to-other');document.body.classList.remove('td-running');locked=false;status.textContent='发牌完成 · 祝双方好运';if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
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
  const started=performance.now();if(motion){status.textContent=event.shuffle?'荷官洗牌、发牌中…':'荷官发牌中…';}else animate();
  timer=setTimeout(finish,event.remaining);
 }
 // Keep clicks/keyboard actions from overtaking the visible deal. Gameplay permissions stay unchanged.
 for(const kind of ['click','keydown'])document.addEventListener(kind,e=>{if(locked&&e.target.closest('button')&&!panel.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.TableDealer={update};
})();
