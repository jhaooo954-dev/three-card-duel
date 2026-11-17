'use strict';
(function(root){
const rank=c=>c<52?c%13+3:c===52?16:17;
const sort=cards=>cards.slice().sort((a,b)=>rank(b)-rank(a)||b-a);
const consecutive=rs=>rs.every((r,i)=>r<15&&(i===0||r===rs[i-1]+1));
function classify(cards){
 if(!Array.isArray(cards)||!cards.length||cards.length>20||new Set(cards).size!==cards.length||cards.some(c=>!Number.isInteger(c)||c<0||c>53))return null;
 const n=cards.length,counts=new Map();for(const c of cards)counts.set(rank(c),(counts.get(rank(c))||0)+1);
 const rs=[...counts.keys()].sort((a,b)=>a-b),ns=[...counts.values()],make=(type,high,chain=1)=>({type,high,chain,size:n});
 if(n===2&&counts.has(16)&&counts.has(17))return make('rocket',17);
 if(rs.length===1){if(n===1)return make('single',rs[0]);if(n===2)return make('pair',rs[0]);if(n===3)return make('triple',rs[0]);if(n===4)return make('bomb',rs[0]);}
 if(n===4&&ns.includes(3))return make('tripleSingle',rs.find(r=>counts.get(r)===3));
 if(n===5&&ns.includes(3)&&ns.includes(2))return make('triplePair',rs.find(r=>counts.get(r)===3));
 if(n>=5&&rs.length===n&&consecutive(rs))return make('straight',rs.at(-1),n);
 if(n>=6&&n%2===0&&rs.length===n/2&&ns.every(v=>v===2)&&consecutive(rs))return make('pairStraight',rs.at(-1),n/2);
 if(n>=6&&n%3===0&&rs.length===n/3&&ns.every(v=>v===3)&&consecutive(rs))return make('plane',rs.at(-1),n/3);
 for(const [type,unit]of [['planeSingle',4],['planePair',5]]){
  const k=n/unit;if(!Number.isInteger(k)||k<2)continue;
  for(let start=3;start+k-1<=14;start++){
   const core=Array.from({length:k},(_,j)=>start+j);if(!core.every(r=>counts.get(r)===3))continue;
   const wing=rs.filter(r=>!core.includes(r));
   if(type==='planeSingle'&&wing.reduce((sum,r)=>sum+counts.get(r),0)===k&&wing.every(r=>counts.get(r)<=2)&&!(counts.has(16)&&counts.has(17)))return make(type,start+k-1,k);
   if(type==='planePair'&&wing.length===k&&wing.every(r=>counts.get(r)===2))return make(type,start+k-1,k);
  }
 }
 const four=rs.find(r=>counts.get(r)===4);
 if(four!==undefined){const rest=rs.filter(r=>r!==four);if(n===6&&!(counts.has(16)&&counts.has(17)))return make('fourSingle',four);if(n===8&&rest.length===2&&rest.every(r=>counts.get(r)===2))return make('fourPair',four);}
 return null;
}
function beats(play,target){if(!play)return false;if(!target)return true;if(target.type==='rocket')return false;if(play.type==='rocket')return true;if(play.type==='bomb'&&target.type!=='bomb')return true;return play.type===target.type&&play.size===target.size&&play.chain===target.chain&&play.high>target.high;}
const labels={single:'单张',pair:'对子',triple:'三张',tripleSingle:'三带一',triplePair:'三带一对',straight:'顺子',pairStraight:'连对',plane:'飞机',planeSingle:'飞机带单',planePair:'飞机带对',fourSingle:'四带二',fourPair:'四带两对',bomb:'炸弹',rocket:'王炸'};
// Generate legal moves by rank groups rather than enumerating every hand subset.
function moves(hand,target=null){
 const groups=new Map();for(const c of sort(hand).reverse()){const r=rank(c);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(c);}
 const rs=[...groups.keys()].sort((a,b)=>a-b),out=[],seen=new Set();
 function add(cs){const p=classify(cs);if(!beats(p,target))return;const key=sort(cs).join(',');if(seen.has(key))return;seen.add(key);out.push({cards:sort(cs),...p,label:labels[p.type]});}
 const choose=(items,k,emit,start=0,picked=[])=>{if(!k){emit(picked);return;}for(let j=start;j<=items.length-k;j++)choose(items,k-1,emit,j+1,[...picked,items[j]]);};
 for(const r of rs){const g=groups.get(r);for(let n=1;n<=g.length;n++)add(g.slice(0,n));if(g.length>=3){for(const q of rs)if(q!==r){add([...g.slice(0,3),groups.get(q)[0]]);if(groups.get(q).length>=2)add([...g.slice(0,3),...groups.get(q).slice(0,2)]);}}
  if(g.length===4){const extras=rs.filter(q=>q!==r).flatMap(q=>groups.get(q));choose(extras,2,cs=>add([...g,...cs]));choose(rs.filter(q=>q!==r&&groups.get(q).length>=2),2,qs=>add([...g,...qs.flatMap(q=>groups.get(q).slice(0,2))]));}}
 if(groups.has(16)&&groups.has(17))add([52,53]);
 for(const [width,min,type]of [[1,5,'straight'],[2,3,'pairStraight'],[3,2,'plane']]){
  if(target&&![type,'planeSingle','planePair'].includes(target.type))continue;
  for(let start=3;start<=14;start++)for(let k=min;start+k-1<=14&&k*width<=hand.length;k++){
   const core=Array.from({length:k},(_,j)=>start+j);if(!core.every(r=>(groups.get(r)?.length||0)>=width))break;
   const cs=core.flatMap(r=>groups.get(r).slice(0,width));add(cs);
   if(width===3){const wing=rs.filter(r=>!core.includes(r));if(k*4<=hand.length)choose(wing.flatMap(r=>groups.get(r)),k,extras=>add([...cs,...extras]));if(k*5<=hand.length)choose(wing.filter(r=>groups.get(r).length>=2),k,qs=>add([...cs,...qs.flatMap(r=>groups.get(r).slice(0,2))]));}
  }
 }
 out.sort((a,b)=>(a.type==='rocket'?2:a.type==='bomb'?1:0)-(b.type==='rocket'?2:b.type==='bomb'?1:0)||(target?a.high-b.high:b.size-a.size)||a.high-b.high);
 const rankSeen=new Set();return out.filter(m=>{const k=m.cards.map(rank).sort((a,b)=>a-b).join(',');if(rankSeen.has(k))return false;rankSeen.add(k);return true;});
}

const api={rank,sort,classify,beats,moves,labels};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LandlordRules=api;
})(globalThis);
