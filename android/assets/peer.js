(()=>{
 const $=id=>document.getElementById(id);let pc=null,dc=null,role=null,model=null,revision=0,code='',hostToken='',guestToken='',cached=null,enabled=false,rpcId=0,phase='choose',generation=0;const pending=new Map();
 const status=text=>$('pairStatus').textContent=text;
 const event=(type,detail)=>window.dispatchEvent(new CustomEvent(type,{detail}));
 function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
 function localView(i){return CardEngine.view(model,i,revision,code);}
 function send(message){if(dc?.readyState!=='open')throw Error('好友直连已断开，请重新配对');dc.send(JSON.stringify(message));}
 function publish(){cached=localView(0);event('peer-state',cached);send({type:'state',state:localView(1)});}
 function apply(body,i){
  if(!model||!model.players[1])throw Error('等待直连成功');if(body.code!==code)throw Error('房间不匹配');if(body.revision!==revision)throw Error('牌局已更新，请再操作一次');
  if(body.type!=='action')throw Error('直连不支持此操作');
  const next=JSON.parse(JSON.stringify(model));CardEngine.action(next,i,body.action);model=next;revision++;publish();return {state:localView(i)};
 }
 function bind(channel){dc=channel;dc.onopen=()=>{
  enabled=true;$('peerHost').disabled=true;$('peerGuest').disabled=true;status('直连已建立，开始对战！');
  if(role==='host'){model.players[1]=guestToken;model.message='好友已直连，第一局房主发牌，对方先手';model.logs.unshift(model.message);cached=localView(0);send({type:'welcome',token:guestToken,state:localView(1)});event('peer-connected',{token:hostToken,code,state:cached});$('peerDialog').close();}
 };
 dc.onmessage=e=>{
  try{
   if(typeof e.data!=='string'||e.data.length>50000)return;const msg=JSON.parse(e.data);
   if(role==='guest'){
    if(msg.type==='welcome'){cached=msg.state;code=msg.state.code;guestToken=msg.token;event('peer-connected',{token:guestToken,code,state:cached});$('peerDialog').close();}
    else if(msg.type==='state'){if(!cached||msg.state.revision>=cached.revision){cached=msg.state;event('peer-state',cached);}}
    else if(msg.type==='reply'){const p=pending.get(msg.id);if(p){clearTimeout(p.timer);pending.delete(msg.id);p.resolve(response(msg.data,msg.status));}}
   }else if(role==='host'&&msg.type==='rpc'){
    try{const data=apply(msg.body,1);send({type:'reply',id:msg.id,data,status:200});}catch(error){send({type:'reply',id:msg.id,data:{error:error.message},status:409});}
   }
  }catch{status('收到无效配对数据，请重新连接');}
 };
 dc.onclose=()=>{if(enabled){status('好友直连已断开。请保持 App 前台并重新配对。');$('connection').textContent='直连已断开';$('actionHint').textContent='直连已断开，请退出房间并重新配对';}};
 }
 function makePeer(){
  if(!window.RTCPeerConnection)throw Error('系统 WebView 版本较旧，请更新 Android System WebView');
  const x=new RTCPeerConnection({iceServers:[{urls:['stun:stun.cloudflare.com:3478','stun:stun.l.google.com:19302']}],iceCandidatePoolSize:0});
  x.onconnectionstatechange=()=>{if(x!==pc)return;if(x.connectionState==='failed')status('当前网络未能直连。请双方切换 Wi-Fi / 手机流量，重新生成邀请；也可使用备用服务器模式。');};
  return x;
 }
 function gather(x){return new Promise(resolve=>{if(x.iceGatheringState==='complete'){resolve();return;}const check=()=>{if(x.iceGatheringState==='complete')done();};const timer=setTimeout(done,9000);function done(){clearTimeout(timer);x.removeEventListener('icegatheringstatechange',check);resolve();}x.addEventListener('icegatheringstatechange',check);});}
 function encode(type,sdp){return 'SZ1-'+btoa(JSON.stringify({v:1,type,sdp}));}
 function decode(input,type){const match=input.match(/SZ1-([A-Za-z0-9+/=]+)/);if(!match)throw Error('未找到 SZ1- 开头的配对码，请完整复制');const data=JSON.parse(atob(match[1]));if(data.v!==1||data.type!==type||typeof data.sdp!=='string'||data.sdp.length>40000)throw Error(type==='offer'?'这里需要朋友的邀请配对码':'这里需要朋友发回的回执码');return {type:data.type,sdp:data.sdp};}
 function output(text,label){$('pairOutput').value=text;$('pairOutputLabel').textContent=label;$('pairOutputBox').hidden=false;}
 function cleanup(){generation++;enabled=false;$('peerHost').disabled=false;$('peerGuest').disabled=false;for(const p of pending.values()){clearTimeout(p.timer);p.resolve(response({error:'连接已关闭'},409));}pending.clear();if(dc)dc.close();if(pc)pc.close();pc=null;dc=null;model=null;cached=null;role=null;phase='choose';}
 async function host(){
  cleanup();const gen=generation;role='host';phase='working';$('pairOutputBox').hidden=true;$('pairInputBox').hidden=true;status('正在收集连接信息，约需几秒…');
  try{hostToken=crypto.randomUUID();guestToken=crypto.randomUUID();code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');model=CardEngine.initial(hostToken);revision=0;pc=makePeer();const x=pc;bind(x.createDataChannel('three-card-duel',{ordered:true}));await x.setLocalDescription(await x.createOffer());await gather(x);if(gen!==generation)return;output(encode('offer',x.localDescription.sdp),'① 复制或分享邀请配对码给朋友');$('pairInputLabel').textContent='③ 粘贴朋友发回的回执码';$('pairInputBox').hidden=false;$('pairInput').value='';$('pairApply').textContent='导入回执，开始连接';phase='answer';status('先把下方邀请发给朋友，再粘贴朋友发回的回执码。');}catch(e){status(e.message);phase='choose';}
 }
 function guest(){cleanup();role='guest';phase='offer';$('pairOutputBox').hidden=true;$('pairInputBox').hidden=false;$('pairInputLabel').textContent='① 粘贴房主发来的邀请配对码';$('pairInput').value='';$('pairApply').textContent='生成回执';status('粘贴朋友的完整邀请配对码。');}
 async function applyCode(){
  const current=phase;if(!['offer','answer'].includes(current))return;
  try{
   const description=decode($('pairInput').value,current==='offer'?'offer':'answer');$('pairApply').disabled=true;
   if(current==='offer'){
    status('正在生成回执，请保持 App 前台…');pc=makePeer();const x=pc,gen=generation;x.ondatachannel=e=>bind(e.channel);await x.setRemoteDescription(description);await x.setLocalDescription(await x.createAnswer());await gather(x);if(gen!==generation)return;output(encode('answer',x.localDescription.sdp),'② 将回执码发回房主');phase='connecting';status('把回执码发回房主，让房主导入。双方保持 App 前台，连接成功后自动进牌桌。');
   }else{await pc.setRemoteDescription(description);phase='connecting';status('正在连接朋友…双方保持 App 前台。若一直未连接，请切换网络后重新配对。');}
  }catch(e){status(e.message);}finally{$('pairApply').disabled=false;}
 }
 $('peerStart').addEventListener('click',()=>{if(!enabled&&phase==='choose'){$('pairInputBox').hidden=true;$('pairOutputBox').hidden=true;status('选择你的角色。');}$('peerDialog').showModal();});
 $('closePeer').addEventListener('click',()=>$('peerDialog').close());$('peerHost').addEventListener('click',host);$('peerGuest').addEventListener('click',guest);$('pairApply').addEventListener('click',applyCode);
 $('pairCopy').addEventListener('click',async()=>{await navigator.clipboard.writeText($('pairOutput').value);status('配对码已复制。发给朋友后返回此页面继续。');});
 $('pairShare').addEventListener('click',async()=>{try{await navigator.share({title:'三张·双人对战配对码',text:$('pairOutput').value});}catch{status('可使用复制按钮，把配对码发给朋友。');}});
 window.PeerDuel={active:()=>enabled,close:cleanup,info:()=>{status('当前使用好友直连。退出房间后可重新配对。');$('peerDialog').showModal();},request:async(u,options)=>{
  if(dc?.readyState!=='open')return response({error:'好友直连已断开，请重新配对'},409);
  if((options.method||'GET')==='GET')return response(cached);
  const body=JSON.parse(options.body||'{}');
  if(role==='host'){try{return response(apply(body,0));}catch(e){return response({error:e.message},409);}}
  return new Promise(resolve=>{const id=++rpcId;const timer=setTimeout(()=>{pending.delete(id);resolve(response({error:'等待好友响应超时，请检查双方网络'},504));},12000);pending.set(id,{resolve,timer});send({type:'rpc',id,body});});
 }};
})();
