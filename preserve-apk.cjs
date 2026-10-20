'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{for(const[route,name,sha]of[
['download.apk','TenHalf-v1.0.apk','98cf3c46801c87143391d09701cf758d4fa01b78e24c7cf9decc7c4954fd97e5'],
['download.zip','TenHalf-v1.0.zip','fbd76d2ea655f34bbbe139774429ba820b61283d6ac31d679ea031edcd5a2ca7']]){
const r=await fetch('https://ten-half-duel-jh.onrender.com/'+route,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Cannot preserve package: '+r.status);const b=Buffer.from(await r.arrayBuffer());if(crypto.createHash('sha256').update(b).digest('hex')!==sha)throw Error('Package checksum mismatch');fs.writeFileSync('public/'+name,b);console.log('Preserved signed '+name);}})().catch(e=>{console.error(e.message);process.exit(1);});
