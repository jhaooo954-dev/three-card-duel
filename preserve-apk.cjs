'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{for(const [route,name,sha] of [
['download.apk','DiceDuel-v1.0.apk','c5b7d1a57428d859e0037477484e474583987effbabac4bda7de9b226e499e4d'],
['download.zip','DiceDuel-v1.0.zip','edb7c3f2f51faad97913ba5064709fcf1baf69492c04751f542382e6fb9a8e97']]){
const response=await fetch('https://dice-duel-jh.onrender.com/'+route,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Cannot preserve signed package: '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(crypto.createHash('sha256').update(bytes).digest('hex')!==sha)throw Error('Signed package checksum mismatch');fs.writeFileSync('public/'+name,bytes);console.log('Preserved signed '+name+' ('+bytes.length+' bytes)');}})().catch(e=>{console.error(e.message);process.exit(1);});
