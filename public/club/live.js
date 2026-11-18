'use strict';
window.watchClubGame=function(game,readSession,accept){
 const epoch=Number(new URLSearchParams(location.search).get('epoch')||0);
 let connected=false;
 window.addEventListener('message',event=>{
  const data=event.data;
  if(event.source!==parent||event.origin!==location.origin||!data||
     data.game!==game||data.epoch!==epoch||data.code!==readSession()?.code)return;
  if(data.type==='club-live-state'&&data.state)accept(data.state,data.actionId);
  else if(data.type==='club-live-status')connected=data.connected===true;
 });
 if(parent!==window)parent.postMessage({type:'club-live-ready'},location.origin);
 return ()=>connected;
};
