import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../src/game/cards.js';
import { createGame } from '../src/game/engine.js';

const pairIds = cards.map((card) => card.pairId);

function startGame(t, options = {}) {
  const events = [];
  const game = createGame({
    pairIds,
    onChange: (snapshot, kind) => events.push({ snapshot, kind }),
    random: () => 0.5,
    ...options,
  });
  t.after(() => game.destroy());
  return { game, events };
}

function chooseMismatch(game) {
  const { deck } = game.getSnapshot();
  const first = deck[0];
  const second = deck.find((card) => card.pairId !== first.pairId);
  game.choose(first.id);
  game.choose(second.id);
}

function assertFreshRound(snapshot, previous = null) {
  assert.equal(snapshot.roundId, previous === null ? 1 : previous.roundId + 1);
  assert.equal(snapshot.phase, 'idle');
  assert.equal(snapshot.moves, 0);
  assert.equal(snapshot.matchedPairs, 0);
  assert.equal(snapshot.firstCardId, null);
  assert.equal(snapshot.secondCardId, null);
  assert.equal(snapshot.completedAt, null);
  assert.equal(snapshot.deck.length, 16);
  assert.equal(new Set(snapshot.deck.map((card) => card.id)).size, 16);
  assert.ok(snapshot.deck.every((card) => card.status === 'closed'));
  for (const pairId of pairIds) {
    assert.equal(snapshot.deck.filter((card) => card.pairId === pairId).length, 2);
  }
  if (previous !== null) {
    const oldIds = new Set(previous.deck.map((card) => card.id));
    assert.ok(snapshot.deck.every((card) => !oldIds.has(card.id)));
  }
}

test('creation is silent; restart starts fresh rounds and copies input pair IDs', (t) => {
  const input = [...pairIds];
  let shuffles = 0;
  let randomValue = 0;
  const { game, events } = startGame(t, {
    pairIds: input,
    random: () => { shuffles += 1; return randomValue; },
  });
  assert.equal(game.getSnapshot(), null);
  game.choose('unknown');
  assert.equal(events.length, 0);
  assert.equal(shuffles, 0);
  input.length = 0;

  game.restart();
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'started');
  assertFreshRound(events[0].snapshot);
  assert.deepEqual(events[0].snapshot, game.getSnapshot());
  const orderedPairs = pairIds.flatMap((pairId) => [pairId, pairId]);
  assert.deepEqual(events[0].snapshot.deck.map((card) => card.pairId),
    [...orderedPairs.slice(1), orderedPairs[0]]);
  assert.equal(shuffles, 15);
  game.choose(game.getSnapshot().deck[0].id);
  const firstRound = game.getSnapshot();
  assert.equal(firstRound.phase, 'one-open');
  randomValue = 0.999;
  const count = events.length;
  game.restart();
  const secondRound = game.getSnapshot();
  assert.equal(events.length, count + 1);
  assert.equal(events.at(-1).kind, 'started');
  assert.deepEqual(events.at(-1).snapshot, secondRound);
  assertFreshRound(secondRound, firstRound);
  assert.deepEqual(secondRound.deck.map((card) => card.pairId), orderedPairs);
  assert.equal(shuffles, 30);
});

test('restart resets matched progress and a completed result and allows immediate selection', (t) => {
  const { game, events } = startGame(t, { now: () => 1234 });
  game.restart();
  const pair = game.getSnapshot().deck.filter((card) => card.pairId === pairIds[0]);
  game.choose(pair[0].id);
  game.choose(pair[1].id);
  const progress = game.getSnapshot();
  assert.equal(progress.moves, 1);
  assert.equal(progress.matchedPairs, 1);
  game.restart();
  assertFreshRound(game.getSnapshot(), progress);
  assert.equal(events.at(-1).kind, 'started');
  assert.deepEqual(events.at(-1).snapshot, game.getSnapshot());

  for (const pairId of pairIds) {
    const currentPair = game.getSnapshot().deck.filter((card) => card.pairId === pairId);
    game.choose(currentPair[0].id);
    game.choose(currentPair[1].id);
  }
  const finished = game.getSnapshot();
  assert.equal(finished.phase, 'finished');
  assert.equal(finished.completedAt, 1234);
  const count = events.length;
  game.restart();
  const restarted = game.getSnapshot();
  assertFreshRound(restarted, finished);
  assert.equal(events.length, count + 1);
  assert.equal(events.at(-1).kind, 'started');
  assert.deepEqual(events.at(-1).snapshot, restarted);
  game.choose(restarted.deck[0].id);
  assert.equal(game.getSnapshot().phase, 'one-open');
  assert.equal(game.getSnapshot().moves, 0);
});

test('snapshot and notification mutations cannot change the current or later game', (t) => {
  const { game, events } = startGame(t);
  game.restart();
  const initial = game.getSnapshot();
  events[0].snapshot.deck[0].status = 'matched';
  events[0].snapshot.deck.pop();
  events[0].snapshot.moves = 100;
  assert.deepEqual(game.getSnapshot(), initial);
  const snapshot = game.getSnapshot();
  snapshot.deck[0].pairId = 'changed';
  snapshot.phase = 'finished';
  game.choose(initial.deck[0].id);
  assert.equal(game.getSnapshot().phase, 'one-open');
  assert.equal(game.getSnapshot().deck[0].pairId, initial.deck[0].pairId);
  assert.equal(initial.deck[0].status, 'closed');
});

test('every notification reflects current state and isolates mutations inside its callback', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const kinds = [];
  const notifications = [];
  const { game } = startGame(t, {
    now: () => 1234,
    onChange: (snapshot, kind) => {
      const current = game.getSnapshot();
      assert.deepEqual(snapshot, current);
      assert.notEqual(snapshot, current);
      assert.notEqual(snapshot.deck, current.deck);
      snapshot.deck.forEach((card, index) => {
        assert.notEqual(card, current.deck[index]);
        card.id = 'changed';
        card.pairId = 'changed';
        card.status = 'closed';
      });
      snapshot.deck.length = 0;
      snapshot.roundId = -1;
      snapshot.phase = 'finished';
      snapshot.firstCardId = 'changed';
      snapshot.secondCardId = 'changed';
      snapshot.moves = 100;
      snapshot.matchedPairs = 100;
      snapshot.completedAt = -1;
      assert.deepEqual(game.getSnapshot(), current);
      notifications.push(snapshot);
      kinds.push(kind);
    },
  });
  game.restart();
  chooseMismatch(game);
  t.mock.timers.tick(1000);
  for (const pairId of pairIds) {
    const pair = game.getSnapshot().deck.filter((card) => card.pairId === pairId);
    game.choose(pair[0].id);
    game.choose(pair[1].id);
  }
  assert.deepEqual(kinds, [
    'started', 'first-opened', 'mismatch', 'mismatch-resolved',
    ...pairIds.flatMap((_pairId, index) => [
      'first-opened', index === 7 ? 'finished' : 'matched',
    ]),
  ]);
  assert.equal(game.getSnapshot().moves, 9);
  assert.equal(game.getSnapshot().matchedPairs, 8);
  assert.equal(game.getSnapshot().completedAt, 1234);
  game.restart();
  const restarted = game.getSnapshot();
  notifications.forEach((snapshot) => {
    snapshot.deck.push({ id: 'injected', pairId: 'changed', status: 'matched' });
    snapshot.moves = -1;
  });
  assert.deepEqual(game.getSnapshot(), restarted);
});

test('retained notifications and reads preserve history across choices, timeout and restart', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const history = [];
  const retain = (snapshot) => {
    history.push({ snapshot, expected: structuredClone(snapshot) });
  };
  const { game } = startGame(t, { onChange: retain });
  const verifyHistory = () => {
    history.forEach(({ snapshot, expected }) => assert.deepEqual(snapshot, expected));
    const current = game.getSnapshot();
    retain(current);
    history.slice(0, -1).forEach(({ snapshot }) => {
      assert.notEqual(current, snapshot);
      assert.notEqual(current.deck, snapshot.deck);
      current.deck.forEach((card) => {
        assert.ok(!snapshot.deck.includes(card));
      });
    });
  };
  game.restart();
  verifyHistory();
  chooseMismatch(game);
  verifyHistory();
  t.mock.timers.tick(1000);
  verifyHistory();
  for (const pairId of pairIds) {
    const pair = game.getSnapshot().deck.filter((card) => card.pairId === pairId);
    game.choose(pair[0].id);
    verifyHistory();
    game.choose(pair[1].id);
    verifyHistory();
  }
  game.restart();
  verifyHistory();
});

test('ignored choices do not notify; matching and completion use state rules and now', (t) => {
  let time = 0;
  const { game, events } = startGame(t, { now: () => time });
  game.restart();
  game.choose('unknown');
  assert.equal(events.length, 1);
  for (const [index, pairId] of pairIds.entries()) {
    const pair = game.getSnapshot().deck.filter((card) => card.pairId === pairId);
    game.choose(pair[0].id);
    const count = events.length;
    game.choose(pair[0].id);
    assert.equal(events.length, count);
    assert.equal(game.getSnapshot().moves, index);
    time = 100 + index;
    game.choose(pair[1].id);
    assert.equal(events.at(-1).kind, index === 7 ? 'finished' : 'matched');
    assert.equal(game.getSnapshot().matchedPairs, index + 1);
    const afterMatchCount = events.length;
    game.choose(pair[1].id);
    assert.equal(events.length, afterMatchCount);
  }
  const finished = game.getSnapshot();
  assert.equal(finished.completedAt, 107);
  assert.equal(finished.moves, 8);
  assert.equal(finished.phase, 'finished');
  time = 1000;
  game.choose(finished.deck[0].id);
  assert.deepEqual(game.getSnapshot(), finished);
  assert.equal(events.length, 17);
});

test('each mismatch has one 1000 ms timer; callback and rapid choices cannot extend it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const schedule = t.mock.method(globalThis, 'setTimeout');
  const events = [];
  const { game } = startGame(t, {
    onChange: (snapshot, kind) => {
      events.push({ snapshot, kind });
      if (kind === 'mismatch') {
        const count = events.length;
        for (const card of snapshot.deck) game.choose(card.id);
        game.choose('unknown');
        assert.deepEqual(game.getSnapshot(), snapshot);
        assert.equal(events.length, count);
      }
    },
  });
  game.restart();
  game.choose('unknown');
  const matched = game.getSnapshot().deck.filter((card) => card.pairId === pairIds[0]);
  game.choose(matched[0].id);
  game.choose(matched[0].id);
  assert.equal(schedule.mock.callCount(), 0);
  game.choose(matched[1].id);
  game.choose(matched[1].id);
  assert.equal(schedule.mock.callCount(), 0);

  const unmatched = game.getSnapshot().deck.filter((card) => card.status === 'closed');
  const first = unmatched[0];
  const second = unmatched.find((card) => card.pairId !== first.pairId);
  game.choose(first.id);
  assert.equal(schedule.mock.callCount(), 0);
  game.choose(second.id);
  const waiting = game.getSnapshot();
  assert.equal(waiting.phase, 'waiting-mismatch');
  assert.equal(waiting.moves, 2);
  assert.equal(waiting.matchedPairs, 1);
  assert.equal(waiting.deck.filter((card) => card.status === 'open').length, 2);
  assert.equal(schedule.mock.callCount(), 1);
  assert.equal(schedule.mock.calls[0].arguments[1], 1000);
  const count = events.length;
  for (const card of waiting.deck) game.choose(card.id);
  t.mock.timers.tick(500);
  for (const card of waiting.deck) game.choose(card.id);
  game.choose('unknown');
  assert.equal(schedule.mock.callCount(), 1);
  assert.equal(events.length, count);
  t.mock.timers.tick(499);
  assert.deepEqual(game.getSnapshot(), waiting);
  assert.equal(events.length, count);
  t.mock.timers.tick(1);
  assert.equal(events.at(-1).kind, 'mismatch-resolved');
  const resolved = game.getSnapshot();
  assert.equal(resolved.phase, 'idle');
  assert.equal(resolved.moves, waiting.moves);
  assert.equal(resolved.matchedPairs, waiting.matchedPairs);
  assert.equal(resolved.firstCardId, null);
  assert.equal(resolved.secondCardId, null);
  assert.deepEqual(resolved.deck.filter((card) => card.status === 'matched'),
    waiting.deck.filter((card) => card.status === 'matched'));
  assert.ok(resolved.deck.filter((card) => card.status !== 'matched')
    .every((card) => card.status === 'closed'));
  t.mock.timers.tick(1000);
  assert.equal(events.length, count + 1);
  assert.deepEqual(game.getSnapshot(), resolved);

  game.choose(first.id);
  assert.equal(game.getSnapshot().phase, 'one-open');
  assert.equal(schedule.mock.callCount(), 1);
  game.choose(second.id);
  assert.equal(schedule.mock.callCount(), 2);
  assert.equal(schedule.mock.calls[1].arguments[1], 1000);
  const nextWaiting = game.getSnapshot();
  t.mock.timers.tick(999);
  assert.deepEqual(game.getSnapshot(), nextWaiting);
  t.mock.timers.tick(1);
  assert.equal(game.getSnapshot().phase, 'idle');
  assert.equal(game.getSnapshot().moves, 3);
  assert.equal(game.getSnapshot().matchedPairs, 1);
  assert.equal(events.filter((event) => event.kind === 'mismatch-resolved').length, 2);
});

test('restart cancels the pending timer and new mismatch keeps its own deadline', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const schedule = t.mock.method(globalThis, 'setTimeout');
  const clear = t.mock.method(globalThis, 'clearTimeout');
  const { game, events } = startGame(t, { delayMs: 700 });
  game.restart();
  chooseMismatch(game);
  const previous = game.getSnapshot();
  t.mock.timers.tick(300);
  game.restart();
  assertFreshRound(game.getSnapshot(), previous);
  assert.equal(events.at(-1).kind, 'started');
  assert.deepEqual(events.at(-1).snapshot, game.getSnapshot());
  assert.equal(clear.mock.callCount(), 1);
  assert.deepEqual(clear.mock.calls[0].arguments, [schedule.mock.calls[0].result]);
  chooseMismatch(game);
  const waiting = game.getSnapshot();
  assert.equal(waiting.phase, 'waiting-mismatch');
  assert.equal(waiting.moves, 1);
  assert.equal(waiting.matchedPairs, 0);
  t.mock.timers.tick(400);
  assert.deepEqual(game.getSnapshot(), waiting);
  assert.equal(events.length, 6);
  t.mock.timers.tick(300);
  assert.equal(game.getSnapshot().phase, 'idle');
  assert.equal(events.length, 7);
});

test('even an invoked stale callback cannot affect a new round or clear its timer', (t) => {
  const callbacks = [];
  const clear = t.mock.method(globalThis, 'clearTimeout', () => {});
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  const { game, events } = startGame(t);
  game.restart();
  chooseMismatch(game);
  game.restart();
  assert.equal(clear.mock.calls.length, 1);
  game.choose(game.getSnapshot().deck[0].id);
  const firstOpen = game.getSnapshot();
  callbacks[0]();
  assert.deepEqual(game.getSnapshot(), firstOpen);
  const second = firstOpen.deck.find((card) => card.pairId !== firstOpen.deck[0].pairId);
  game.choose(second.id);
  const waiting = game.getSnapshot();
  const count = events.length;
  callbacks[0]();
  assert.deepEqual(game.getSnapshot(), waiting);
  assert.equal(events.length, count);
  callbacks[1]();
  assert.equal(game.getSnapshot().phase, 'idle');
  assert.equal(events.length, count + 1);
  callbacks[1]();
  assert.equal(events.length, count + 1);
});

test('destroy is terminal and cancels timers, including destroy before starting', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { game, events } = startGame(t);
  game.restart();
  chooseMismatch(game);
  const last = game.getSnapshot();
  game.destroy();
  game.destroy();
  game.restart();
  game.choose(last.deck[0].id);
  t.mock.timers.tick(1000);
  assert.deepEqual(game.getSnapshot(), last);
  assert.equal(events.length, 3);
  const { game: unstarted, events: silentEvents } = startGame(t);
  unstarted.destroy();
  unstarted.restart();
  assert.equal(unstarted.getSnapshot(), null);
  assert.equal(silentEvents.length, 0);
});

for (const action of ['restart', 'destroy']) {
  test(`${action} inside a mismatch notification cancels the registered timer`, (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const kinds = [];
    const { game } = startGame(t, {
      onChange: (_snapshot, kind) => {
        kinds.push(kind);
        if (kind === 'mismatch') game[action]();
      },
    });
    game.restart();
    chooseMismatch(game);
    const last = game.getSnapshot();
    if (action === 'restart') {
      assert.equal(last.roundId, 2);
      assert.equal(last.phase, 'idle');
    }
    t.mock.timers.tick(1000);
    assert.deepEqual(game.getSnapshot(), last);
    assert.ok(!kinds.includes('mismatch-resolved'));
  });
}
