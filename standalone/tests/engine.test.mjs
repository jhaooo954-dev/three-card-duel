import {test} from 'node:test';import assert from 'node:assert/strict';import {initial,action,view} from '../shared/engine.mjs';
const setup=()=>{const s=initial('host');s.players[1]='friend';action(s,0,'deal');return s;};
test('any ending reveals both hands, resets points, and gives winner the deal',()=>{
 for(const how of ['fold','open','limit'])for(const dealer of [0,1]){
  const s=initial('host');s.players[1]='friend';s.dealer=dealer;action(s,dealer,'deal');assert.equal(s.turn,1-dealer);
  if(how==='limit'){while(s.active)action(s,s.turn,'follow');}else action(s,s.turn,how);
  assert(!s.active);assert.deepEqual(s.banks,[0,0]);assert.equal(s.pot,0);for(const i of [0,1])assert(view(s,i,0,'ABCDEF').hands.flat().every(Boolean));
  const next=s.winner===null?dealer:s.winner;assert.equal(s.dealer,next);assert.throws(()=>action(s,1-next,'deal'));action(s,next,'deal');assert.equal(s.turn,1-next);assert.equal(s.pot,0);assert.deepEqual(s.looked,[0,0]);
 }
});
test('look jumps reveal only requested cards; hidden card identities and type stay private',()=>{
 for(const n of [1,2,3]){const s=setup();action(s,1,'look'+n);const me=view(s,1,1,'ABCDEF'),other=view(s,0,1,'ABCDEF');assert.equal(me.hands[1].filter(Boolean).length,n);assert.equal(me.types[1]!=="",n===3);assert(other.hands.flat().every(x=>x===null));assert.equal(s.pot,0);assert.equal(s.turn,1);assert.throws(()=>action(s,1,'look'+n));}
 const s=setup();action(s,1,'look');assert.equal(s.looked[1],3);
});
test('equal fees for blind, partially seen, fully seen and showdown; tied auto-showdown keeps dealer',()=>{
 for(const n of [0,1,2,3]){const s=setup();if(n)action(s,1,'look'+n);action(s,1,'follow');assert.equal(s.pot,10);action(s,0,'follow');action(s,1,'open');assert.equal(s.lastPot,30);assert.deepEqual(s.banks,[0,0]);}
 const s=setup();s.hands=[[{rank:14,suit:'♠'},{rank:12,suit:'♥'},{rank:8,suit:'♣'}],[{rank:14,suit:'♥'},{rank:12,suit:'♣'},{rank:8,suit:'♦'}]];while(s.active)action(s,s.turn,'follow');assert.equal(s.winner,null);assert.equal(s.dealer,0);assert.equal(s.stats[2],1);
});
test('1000 rounds: point reset, dealer transition, unique cards and amount conservation',()=>{
 const s=setup();let finished=0;
 while(finished<1000){assert.equal(new Set(s.hands.flat().map(c=>c.rank+c.suit)).size,6);let ticks=0;while(s.active){const i=s.turn;if(!s.looked[i])action(s,i,'look'+(finished%3+1));assert.equal(s.pot,s.banks[0]+s.banks[1]);action(s,i,ticks++===3?'open':finished%2?'follow':s.base<100?'raise':'follow');}assert.equal(s.lastPot,s.lastBets[0]+s.lastBets[1]);assert.deepEqual(s.banks,[0,0]);assert.equal(s.pot,0);const dealer=s.dealer;action(s,dealer,'deal');assert.equal(s.turn,1-dealer);finished++;}
});
