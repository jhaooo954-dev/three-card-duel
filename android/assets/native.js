(()=>{
 if(!window.Android)return;
 let sequence=0;const pending=new Map();
 window.__nativeReply=(id,status,body)=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);p.resolve(new Response(body,{status:status||502,headers:{'Content-Type':'application/json'}}));};
 const originalFetch=window.fetch.bind(window);
 window.fetch=(input,options={})=>{
  const u=new URL(String(input),location.href);
  if(u.pathname!=='/api/room')return originalFetch(input,options);
  if(window.PeerDuel?.active())return window.PeerDuel.request(u,options);
  return new Promise((resolve,reject)=>{
   if(options.signal?.aborted){reject(new DOMException('请求已取消','AbortError'));return;}
   const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('服务唤醒较慢，请稍后重试'));},65000);pending.set(id,{resolve,reject,timer});
   Android.request(id,options.method||'GET',u.pathname+u.search,JSON.stringify(options.headers||{}),options.body||'');
  });
 };
 navigator.share=async data=>Android.share([data.title,data.text,data.url].filter(Boolean).join('\n'));
 try{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>Android.copy(String(text))},configurable:true});}catch{}
 window.addEventListener('DOMContentLoaded',()=>document.getElementById('serverSettings')?.addEventListener('click',()=>Android.configureServer()));
})();
