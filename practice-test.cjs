const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function openPractice() {
  let queued;
  const snapshots = [];
  const context = {
    crypto: require('node:crypto').webcrypto, Response, URL,
    location: {origin: 'https://local.test'},
    document: {
      hidden: false, addEventListener() {},
      getElementById() {return {contentWindow: {postMessage(packet) {snapshots.push(packet);}}};}
    },
    setTimeout(callback) {queued = callback; return 1;},
    clearTimeout() {queued = null;},
    console
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('public/club/practice.js', 'utf8'), context);
  return {
    runtime: context.clubPractice,
    drain() {
      for (let n = 0; queued; n++) {
        assert.ok(n < 24, 'bot chain should stop at the human turn');
        queued();
      }
    },
    snapshots
  };
}

for (const count of [2, 3]) {
  test(`local practice fills ${count} seats and plays the three games with no server`, async () => {
    const {runtime, drain, snapshots} = openPractice();
    assert.equal(runtime.create(count, '验收').memberCount, count);
    let epoch, id = 0;
    async function call(path, body) {
      const response = await runtime.fetch('/club-api/'+path, body ? {body: JSON.stringify(body)} : {});
      const value = await response.json();
      assert.equal(response.status,200,value.error);
      return value;
    }
    const select = async game => {epoch = (await call('select', {game})).epoch;};
    const state = game => call('game/'+game+'/state');
    async function action(game, input) {
      const current = await state(game);
      return call('game/'+game+'/action', {
        id: String(++id), epoch, rev: current.revision ?? current.rev,
        action: typeof input === 'string' ? input : {...input, round: current.round}
      });
    }
    await select('card');
    await action('card', 'deal');
    drain();
    let poker = await state('card');
    assert.equal(poker.turn, 0);
    assert.equal(poker.hands.length, count);
    assert.ok(poker.hands.every(hand => hand.every(card => card === null)));
    poker = await action('card', 'look1');
    assert.ok(poker.hands[0][0]);
    assert.equal(poker.callCost, 20);

    await select('dice');
    await action('dice', {type: 'ready'});
    drain();
    const cup = await state('dice');
    assert.equal(cup.phase,'playing');
    assert.equal(cup.dice[0].length,5);
    assert.ok(cup.dice.slice(1).every(seat => seat.every(die => die === null)));

    await select('tenhalf');
    const hand = await action('tenhalf', {type: 'start'});
    drain();
    assert.equal(hand.hands.length, count);
    assert.ok(hand.hands.slice(1).every(seat => seat[0] === null));
    assert.ok(snapshots.some(packet => packet.game === 'tenhalf'));
  });
}
