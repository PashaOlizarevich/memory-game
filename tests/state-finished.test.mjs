import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../src/game/cards.js';
import { createInitialState, resolveMismatch, selectCard } from '../src/game/state.js';

function startRound() {
  return createInitialState({
    pairIds: cards.map((card) => card.pairId),
    roundId: 1,
    random: () => 0.5,
  });
}

function choose(state, cardId, completedAt) {
  const before = structuredClone(state);
  state.deck.forEach(Object.freeze);
  Object.freeze(state.deck);
  Object.freeze(state);

  const result = selectCard(state, cardId, completedAt);
  assert.deepEqual(state, before);
  return result;
}

function matchPair(state, pairId, completedAt) {
  const pair = state.deck.filter((card) => card.pairId === pairId);
  const first = choose(state, pair[0].id, completedAt - 1);
  assert.equal(first.kind, 'first-opened');
  assert.equal(first.state.phase, 'one-open');
  assert.equal(first.state.moves, state.moves);
  assert.equal(first.state.completedAt, null);
  return choose(first.state, pair[1].id, completedAt);
}

test('only the eighth matched pair finishes a round with the supplied timestamp', () => {
  let state = startRound();
  const completedAt = 1791190800000;

  for (const [index, card] of cards.entries()) {
    const result = matchPair(state, card.pairId, completedAt + index);
    const pairCount = index + 1;
    const isLastPair = pairCount === 8;

    assert.equal(result.kind, isLastPair ? 'finished' : 'matched');
    assert.equal(result.state.phase, isLastPair ? 'finished' : 'idle');
    assert.equal(result.state.moves, pairCount);
    assert.equal(result.state.matchedPairs, pairCount);
    assert.equal(result.state.firstCardId, null);
    assert.equal(result.state.secondCardId, null);
    assert.equal(result.state.completedAt, isLastPair ? completedAt + index : null);
    assert.equal(
      result.state.deck.filter((entry) => entry.status === 'matched').length,
      pairCount * 2,
    );
    state = result.state;
  }

  const before = structuredClone(state);
  for (const cardId of [...state.deck.map((card) => card.id), 'unknown-card']) {
    const result = choose(state, cardId, completedAt + 1000);
    assert.equal(result.kind, 'ignored');
    assert.strictEqual(result.state, state);
  }
  assert.strictEqual(resolveMismatch(state), state);
  assert.deepEqual(state, before);
});

test('a mismatch adds a move without finishing, and its move remains in the final result', () => {
  const initial = startRound();
  const first = initial.deck[0];
  const second = initial.deck.find((card) => card.pairId !== first.pairId);
  const opened = choose(initial, first.id, 1000);
  const mismatch = choose(opened.state, second.id, 2000);

  assert.equal(mismatch.kind, 'mismatch');
  assert.equal(mismatch.state.phase, 'waiting-mismatch');
  assert.equal(mismatch.state.moves, 1);
  assert.equal(mismatch.state.matchedPairs, 0);
  assert.equal(mismatch.state.completedAt, null);

  const before = structuredClone(mismatch.state);
  const resolved = resolveMismatch(mismatch.state);
  assert.deepEqual(mismatch.state, before);
  assert.equal(resolved.phase, 'idle');
  assert.equal(resolved.moves, 1);
  assert.equal(resolved.completedAt, null);

  let state = resolved;
  for (const card of cards) {
    state = matchPair(state, card.pairId, 3000).state;
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.moves, 9);
  assert.equal(state.matchedPairs, 8);
  assert.equal(state.completedAt, 3000);
});

test('zero is preserved as a valid completion timestamp', () => {
  let state = startRound();
  for (const card of cards) {
    state = matchPair(state, card.pairId, 0).state;
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.completedAt, 0);
});
