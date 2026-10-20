'use strict';
const games=[
{name:'炸金花',url:'https://three-card-duel-jh.onrender.com',marker:'炸金花'},
{name:'大话骰',url:'https://dice-duel-jh.onrender.com',marker:'大话骰'},
{name:'十点半',url:'https://ten-half-duel-jh.onrender.com',marker:'十点半'}
];
async function verify(game){let error;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(game.url+'/?club-check=1',{signal:AbortSignal.timeout(90000)});const body=await r.text();if(!r.ok||!body.includes(game.marker)||!/<main[\s>]/i.test(body))throw Error('game page not ready, HTTP '+r.status);console.log('Verified live game: '+game.name+' (HTTP '+r.status+')');return;}catch(e){error=e;if(!attempt)await new Promise(r=>setTimeout(r,2000));}}throw Error(game.name+': '+error.message);}
Promise.all(games.map(verify)).catch(e=>{console.error(e.message);process.exitCode=1;});
