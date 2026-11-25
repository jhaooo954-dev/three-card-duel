'use strict';
window.watchClubGame=function(game,readSession,accept){
 const epoch=Number(new URLSearchParams(location.search).get('epoch')||0);
 const practicing=new URLSearchParams(location.search).get('practice')==='1';
 let connected=false;
 if(practicing){
  const original=window.fetch.bind(window);
  window.fetch=(input,options)=>typeof input==='string'&&input.startsWith('/club-api/')?
    parent.clubPractice.fetch(input,options):original(input,options);
  document.body.classList.add('practice-table');
 }
 window.addEventListener('message',event=>{
  const data=event.data;
  if(event.source!==parent||event.origin!==location.origin||!data||
     data.game!==game||data.epoch!==epoch||data.code!==readSession()?.code)return;
  if(data.type==='club-live-state'&&data.state){if(practicing)connected=true;accept(data.state,data.actionId);}
  else if(data.type==='club-live-status')connected=data.connected===true;
 });
 if(parent!==window)parent.postMessage({type:'club-live-ready'},location.origin);
 return ()=>connected;
};
