'use strict';

// Presentation only. The dealer event contains seat numbers and timing, never card values.
(() => {
 const round = document.body.classList.contains('casino-round');
 const arena = round ? document.querySelector('.arena') : document.querySelector('.arena .table-top,.table .table-top');
 const panel = document.createElement('section');
 panel.className = round ? 'casino-dealer' : 'table-dealer';
 panel.setAttribute('aria-label', '虚拟女荷官席');
 const portrait = '<div class="dealer-portrait" role="img" aria-label="女荷官"></div>';
 const shoe = '<i></i><i></i><i></i><b>♠</b>';
 const initialStatus = '荷官已就位 · 等待发牌';
 panel.innerHTML = round
  ? portrait + '<div class="dealer-name">荷官 <span>DEALER</span></div><div class="casino-shoe" aria-hidden="true">' + shoe + '</div><div class="casino-tray" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="casino-status" role="status">' + initialStatus + '</span>'
  : portrait + '<div class="td-copy"><strong>荷官 <small>DEALER</small></strong><span class="td-status" role="status">' + initialStatus + '</span></div><div class="td-shoe" aria-hidden="true">' + shoe + '</div>';
 if (round) arena.append(panel);
 else arena.after(panel);

 const figure = panel.querySelector('.dealer-portrait');
 const status = panel.querySelector('[role="status"]');
 const motionSetting = window.matchMedia('(prefers-reduced-motion: reduce)');
 const reduced = () => motionSetting.matches || document.body.classList.contains('low-motion');
 const step = round ? 560 : 730;
 const release = Math.round(step * .62);
 const flightDuration = 460;
 const shuffleDuration = 1500;
 const handX = {1: .13, 2: .50, 3: .77};
 const sheet = new Image();
 let sheetReady = false;
 sheet.onload = () => { sheetReady = true; };
 sheet.src = '/club/dealer-motion-smooth.webp?v=420';

 let lastId = 0, animationFrame = 0, flights = [], hidden = [];

 function pose(row, strength) {
  const column = Math.round(strength * 12);
  figure.style.backgroundPosition = (column * 100 / 12) + '% ' + (row * 25) + '%';
 }

 const ease = progress => .5 - .5 * Math.cos(Math.PI * progress);

 function prepare(progress) {
  if (progress < .53) {
   const phase = progress / .53;
   pose(4, phase < .39 ? ease(phase/.39) : phase < .63 ? 1 : ease((1-phase)/.37));
  } else {
   pose(0, Math.sin(Math.PI * (progress-.53)/.47));
  }
 }

 function reach(side, progress) {
  if (progress < .20) {
   pose(0, .65 * Math.sin(Math.PI * progress/.20));
  } else if (progress < .56) {
   pose(side, ease((progress-.20)/.36));
  } else if (progress < .72) {
   pose(side, 1);
  } else {
   pose(side, 1-ease((progress-.72)/.28));
  }
 }

 function clear() {
  cancelAnimationFrame(animationFrame);
  for (const {node, animation} of flights) {
   animation.cancel();
   node.remove();
  }
  for (const card of hidden) card.classList.remove('card-in-flight');
  flights = [];
  hidden = [];
  pose(0, 0);
  panel.classList.remove('dealer-active');
 }

 function cardsAt(recipient, you) {
  if (round) return document.querySelector('[data-seat="' + recipient + '"] .cards') ||
   document.getElementById('cards' + (recipient === you ? 0 : 1));
  if (recipient === you) return document.getElementById('my-cards');
  return document.querySelector('[data-ten-seat="' + recipient + '"]') || document.getElementById('op-cards');
 }

 function poseToward(cards) {
  const seat = cards.getBoundingClientRect(), table = panel.getBoundingClientRect();
  const offset = (seat.left + seat.width / 2 - table.left) / table.width;
  return offset < .37 ? 1 : offset > .63 ? 3 : 2;
 }

 function fly(card, side, elapsed) {
  const image = figure.getBoundingClientRect(), target = card.getBoundingClientRect();
  const x = image.left + image.width * handX[side] - target.width / 2;
  const y = image.top + image.height * .955 - target.height / 2;
  const node = document.createElement('i');
  node.className = 'dealer-flying-card';
  node.textContent = '♠';
  node.setAttribute('aria-hidden', 'true');
  node.style.width = target.width + 'px';
  node.style.height = target.height + 'px';
  document.body.append(node);
  const animation = node.animate([
   {transform: `translate(${x}px,${y}px) rotate(${side===1?-10:side===3?10:0}deg) scale(.44)`,boxShadow:'0 2px 4px #0004'},
   {offset:.56,transform:`translate(${x+(target.left-x)*.65}px,${y+(target.top-y)*.58-12}px) rotate(${side===1?-5:side===3?5:0}deg) scale(.78)`,boxShadow:'0 8px 10px #0006'},
   {offset:.93,transform:`translate(${target.left}px,${target.top-1}px) rotate(0) scale(1)`,boxShadow:'0 3px 4px #0005'},
   {transform:`translate(${target.left}px,${target.top}px) rotate(0) scale(1)`,boxShadow:'0 1px 2px #0005'}
  ], {duration:flightDuration, easing:'cubic-bezier(.32,.58,.36,1)',fill:'both'});
  animation.currentTime = elapsed;
  flights.push({node, animation});
  animation.onfinish = () => {
   node.remove();
   card.classList.remove('card-in-flight');
  };
 }

 function update(event, you) {
  if (!event || event.id <= lastId) return;
  lastId = event.id;
  clear();
  if (event.remaining <= 0) return;
  const done = () => { clear(); status.textContent = '发牌完成 · 请按回合操作'; };
  if (reduced() || !sheetReady || !event.recipients.length) { done(); return; }

  panel.classList.add('dealer-active');
  const counts = event.recipients.reduce((all, seat) => (all[seat]++, all), [0, 0, 0]);
  const dealt = [0, 0, 0];
  const shuffleEnd = event.shuffle ? shuffleDuration : 0;
  // Use the event timestamp to catch up after network delay. The visual cadence is
  // local, so game actions and the server's deal event format stay the same.
  const start = performance.now() - (event.duration - event.remaining);
  const visualEnd = shuffleEnd + (event.recipients.length - 1) * step + Math.max(step, release + flightDuration);
  const items = event.recipients.map((seat, index) => {
   const cards = cardsAt(seat, you);
   const position = cards ? cards.children.length - counts[seat] + dealt[seat]++ : 0;
   const target = cards?.children[position];
   const time = shuffleEnd + index * step + release;
   if (!target || start + time + flightDuration <= performance.now()) return null;
   target.classList.add('card-in-flight');
   hidden.push(target);
   return {cards, position, target, side:poseToward(cards), time, sent:false};
  });
  let shuffling;
  function tick(now) {
   const elapsed = now - start;
   if (elapsed >= visualEnd || reduced()) { done(); return; }
   const preparing = elapsed < shuffleEnd;
   if (preparing !== shuffling) {
    shuffling = preparing;
    status.textContent = shuffling ? '荷官正在备牌…' : '荷官正在发牌…';
   }
   if (preparing) {
    prepare(elapsed / shuffleEnd);
   } else {
    const index = Math.floor((elapsed-shuffleEnd) / step);
    const item = items[index], phase = elapsed-shuffleEnd-index*step;
    if (item) reach(item.side, phase / step);
    else pose(0, 0);
   }
   for (const item of items) {
    if (!item || item.sent || elapsed < item.time) continue;
    item.sent = true;
    const age = elapsed-item.time;
    // Looking at a card can replace its DOM node while other seats are still
    // receiving theirs. A revealed card stays visible; a replacement back can land.
    const card = item.cards.children[item.position];
    if (age < flightDuration && card && (card === item.target || card.classList.contains('back'))) {
     card.classList.add('card-in-flight');
     hidden.push(card);
     fly(card, item.side, age);
    } else item.target.classList.remove('card-in-flight');
   }
   animationFrame = requestAnimationFrame(tick);
  }
  animationFrame = requestAnimationFrame(tick);
 }

 function chip(slot, amount, collect = false) {
  if (reduced()) return;
  const seat = document.querySelector('#player' + slot + ' .balance'), pot = document.querySelector('.center-pot .chips');
  if (!seat || !pot) return;
  const rect = arena.getBoundingClientRect(), from = (collect ? pot : seat).getBoundingClientRect(), to = (collect ? seat : pot).getBoundingClientRect();
  const x = from.left + from.width/2 - rect.left, y = from.top + from.height/2 - rect.top;
  const dx = to.left + to.width/2 - rect.left, dy = to.top + to.height/2 - rect.top;
  for (let index = 0; index < 3; index++) {
   const node = document.createElement('i');
   node.className = 'casino-chip';
   node.textContent = amount || '♠';
   node.setAttribute('aria-hidden', 'true');
   arena.append(node);
   const animation = node.animate([
    {transform:`translate(${x}px,${y}px)`,opacity:1},
    {offset:.65,transform:`translate(${x+(dx-x)*.7}px,${y+(dy-y)*.7-25}px) rotate(170deg)`,opacity:1},
    {transform:`translate(${dx+index*6}px,${dy-index*3}px) rotate(250deg)`,opacity:0}
   ], {duration:460,delay:index*55,easing:'ease-out',fill:'both'});
   animation.onfinish = () => node.remove();
  }
 }

 window.TableDealer = round ? {update, bet:(slot, amount) => chip(slot, amount), collect:slot => chip(slot, 0, true)} : {update};
})();
