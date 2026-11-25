const card = require('card.cjs');
const dice = require('dice.cjs');
const twoHand = require('engine.cjs');
const threeHand = require('tenhalf3.cjs');
const games = ['card', 'dice', 'tenhalf'];
const code = '练习';
let room, table, botTimer, actionCounter, dealerEvent, commandIds;
const randomInt = max => {
  const values = new Uint32Array(1);
  const limit = 4294967296 - 4294967296 % max;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % max;
};
function shuffle() {
  const deck = Array.from({length: 52}, (_, index) => index);
  for (let index = 51; index > 0; index--) {
    const other = randomInt(index + 1);
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck;
}
const roll = () => Array.from({length: 5}, () => randomInt(6) + 1);
const ten = () => room.playerCount === 3 ? threeHand : twoHand;
const copy = value => JSON.parse(JSON.stringify(value));
function create(count, name) {
  clearTimeout(botTimer);
  const names = [name || '你', '机器人·阿岚', '机器人·小满'].slice(0, count);
  const tokens = names.map((_, seat) => String(seat + 1));
  const poker = card.initial(tokens[0], count);
  poker.players = tokens;
  poker.message = '机器人已入座，请荷官发牌';
  room = {
    code, you: 0, names, playerCount: count, memberCount: count, joined: true,
    selected: null, online: tokens.map(() => true), epoch: 0, rev: 0,
    canChangeMode: false, games: {}
  };
  table = {
    card: poker, dice: dice.initial(tokens, names), tenhalf: ten().initial(tokens, names)
  };
  actionCounter = 0;
  dealerEvent = {};
  commandIds = new Set();
  return roomView();
}
function roomView() {
  const status = Object.fromEntries(games.map(game => [game, {round: table[game].round}]));
  return copy({...room, games: {...status, gomoku: {round: 0}, landlord: {round: 0}}});
}
function view(game) {
  const state = table[game];
  const data = game === 'card' ? card.view(state, 0, actionCounter, code) :
    game === 'dice' ? dice.view(state, 0, code) : ten().view(state, 0, code);
  data.names = room.names;
  if (dealerEvent[game]) {
    const {at, ...event} = dealerEvent[game];
    data.dealerEvent = {...event, remaining: Math.max(0, event.duration - (Date.now() - at))};
  }
  return copy(data);
}
function record(game, shuffleCards, recipients) {
  dealerEvent[game] = {
    id: actionCounter, at: Date.now(), shuffle: shuffleCards, recipients,
    duration: (shuffleCards ? 1000 : 0) + recipients.length * 240 + 300
  };
}
function apply(game, seat, action) {
  const state = table[game];
  actionCounter++;
  if (game === 'card') {
    card.action(state, seat, action);
    if (action === 'deal') record(game, true, Array.from({length: 3}, () => room.names.map((_, i) => i)).flat());
    if (action === 'reset' && seat === 0) {
      for (let i = 1; i < room.playerCount; i++) card.action(state, i, 'reset');
    }
  }
  if (game === 'dice') dice.act(state, seat, action, roll);
  if (game === 'tenhalf') {
    const kind = action.type;
    const fresh = state.round === 0 || state.deck.length < room.playerCount;
    const recipient = kind === 'deal' ? (state.guest ?? 1 - state.dealer) : state.dealer;
    ten().act(state, seat, action, shuffle);
    if (kind === 'start') record(game, fresh, room.names.map((_, i) => i));
    if (kind === 'deal' || kind === 'draw') record(game, false, [recipient]);
  }
}
function nextBot(game) {
  const state = table[game];
  if (game === 'card') {
    if (!state.active) return state.round > 0 && state.dealer > 0 ? [state.dealer, 'deal', 2000] : null;
    const seat = state.turn;
    if (seat === 0) return null;
    if (!state.looked[seat] && (state.steps >= 5 || randomInt(3) === 0)) return [seat, 'look3'];
    const rank = state.looked[seat] ? card.evaluate(state.hands[seat]).score[0] : null;
    const target = state.players.map((_, i) => i).find(i => i !== seat && !state.folded[i]);
    if (rank === 0 && state.steps >= 3 && randomInt(4) === 0) return [seat, 'fold'];
    const count = state.folded.filter(folded => !folded).length;
    if (state.steps >= 7 && (state.steps >= 12 || rank >= 2 || randomInt(4) === 0)) {
      return [seat, count > 2 && state.looked[seat] ? {type: 'open', target} : 'open'];
    }
    return [seat, rank >= 2 && state.base < 60 && randomInt(3) === 0 ? 'raise' : 'follow'];
  }
  if (game === 'dice') {
    if (state.phase === 'playing') return null; // Let the user peek and choose when to open.
    const seat = state.ready.findIndex((ready, i) => i > 0 && !ready);
    return state.ready[0] && seat > 0 ? [seat, {type: 'ready', round: state.round}, 330] : null;
  }
  const action = type => ({type, round: state.round});
  if (state.phase === 'waiting' || state.phase === 'ended') {
    const dealer = ten().nextDealer(state);
    return dealer > 0 ? [dealer, action('start'), 1900] : null;
  }
  if (state.phase === 'guest') {
    const guest = state.guest ?? 1 - state.dealer;
    if (state.request) return state.dealer > 0 ? [state.dealer, action('deal')] : null;
    if (guest === 0) return null;
    const hand = state.hands[guest];
    const points = require('engine.cjs').total(hand);
    return [guest, action(points < 14 && hand.length < 5 ? 'request' : 'stand')];
  }
  const dealer = state.dealer;
  if (dealer === 0) return null;
  return [dealer, action(require('engine.cjs').total(state.hands[dealer]) < 15 ? 'draw' : 'stand')];
}
function notify() {
  if (!room?.selected) return;
  document.getElementById('game-frame').contentWindow?.postMessage({
    type: 'club-live-state', game: room.selected, epoch: room.epoch, code, state: view(room.selected)
  }, location.origin);
}
function schedule() {
  clearTimeout(botTimer);
  const game = room?.selected;
  if (!game || document.hidden) return;
  const turn = nextBot(game);
  if (!turn) return;
  const [seat, action, delay = 500 + randomInt(380)] = turn;
  botTimer = setTimeout(() => {
    if (room?.selected !== game || document.hidden) return;
    try { apply(game, seat, action); notify(); schedule(); }
    catch (error) { console.error('Practice action failed:', error.message); }
  }, delay);
}
function fetchLocal(path, options = {}) {
  const url = new URL(path, location.origin);
  const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {status}));
  const body = options.body ? JSON.parse(options.body) : {};
  if (!room) return json({error: '请重新开始单人练习'}, 404);
  const game = url.pathname.match(/^\/club-api\/game\/(card|dice|tenhalf)\/(state|action)$/);
  try {
    if (url.pathname === '/club-api/state') return json(roomView());
    if (url.pathname === '/club-api/leave') { clearTimeout(botTimer); room = null; return json({ok:true}); }
    if (url.pathname === '/club-api/select') {
      if (body.game !== null && !games.includes(body.game)) return json({error: '此玩法请使用好友房'}, 400);
      room.selected = body.game;
      room.epoch++;
      room.rev++;
      schedule();
      return json(roomView());
    }
    if (!game) return json({error: '练习模式不支持此操作'}, 404);
    const [, name, method] = game;
    if (name !== room.selected) return json({error: '游戏已切换'}, 409);
    if (method === 'state') return json(view(name));
    if (body.epoch !== room.epoch) return json({error: '牌桌已切换'}, 409);
    if (commandIds.has(body.id)) return json(view(name));
    const current = view(name);
    if (body.rev !== (current.revision ?? current.rev)) return json({error: '轮次已更新，请重试', state: current}, 409);
    apply(name, 0, body.action);
    commandIds.add(body.id);
    schedule();
    return json(view(name));
  } catch (error) { return json({error: error.message}, 400); }
}
window.clubPractice = {create, fetch: fetchLocal, schedule, notify};
document.addEventListener('visibilitychange', schedule);
