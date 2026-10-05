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

function assertIgnored(state, cardId) {
  const before = structuredClone(state);
  state.deck.forEach(Object.freeze);
  Object.freeze(state.deck);
  Object.freeze(state);

  const result = selectCard(state, cardId);

  assert.equal(result.kind, 'ignored');
  assert.strictEqual(result.state, state);
  assert.deepEqual(state, before);
}

test('repeated clicks on the first card do not count moves or change selection', () => {
  const initial = startRound();
  const first = initial.deck[0];
  const opened = selectCard(initial, first.id);
  assert.equal(opened.kind, 'first-opened');

  for (let click = 0; click < 5; click += 1) {
    assertIgnored(opened.state, first.id);
  }

  const second = opened.state.deck.find((card) => card.id !== first.id);
  const result = selectCard(opened.state, second.id);
  assert.equal(result.state.moves, 1);
});

test('matched cards cannot be selected before or during the next turn', () => {
  const initial = startRound();
  const first = initial.deck[0];
  const partner = initial.deck.find(
    (card) => card.pairId === first.pairId && card.id !== first.id,
  );
  const matched = selectCard(selectCard(initial, first.id).state, partner.id);
  assert.equal(matched.kind, 'matched');
  assert.equal(matched.state.matchedPairs, 1);

  assertIgnored(matched.state, first.id);
  assertIgnored(matched.state, partner.id);

  const nextCard = matched.state.deck.find((card) => card.status === 'closed');
  const opened = selectCard(matched.state, nextCard.id);
  assert.equal(opened.kind, 'first-opened');
  assertIgnored(opened.state, first.id);
  assertIgnored(opened.state, partner.id);
});

test('all choices are blocked during mismatch and resume after resolution', () => {
  const initial = startRound();
  const first = initial.deck[0];
  const second = initial.deck.find((card) => card.pairId !== first.pairId);
  const mismatch = selectCard(selectCard(initial, first.id).state, second.id);
  assert.equal(mismatch.kind, 'mismatch');

  for (const card of mismatch.state.deck) {
    assertIgnored(mismatch.state, card.id);
  }

  const third = mismatch.state.deck.find((card) => card.status === 'closed');
  const resolved = resolveMismatch(mismatch.state);
  const opened = selectCard(resolved, third.id);
  assert.equal(opened.kind, 'first-opened');
  assert.equal(opened.state.moves, 1);
  assert.equal(opened.state.firstCardId, third.id);
});

test('finished phase blocks even closed cards without changing the result', () => {
  // The transition to finished belongs to implementation step 12.
  // Keep closed cards here to verify the phase guard independently of status.
  const finished = { ...startRound(), phase: 'finished', completedAt: 1000 };

  for (const card of finished.deck) {
    assertIgnored(finished, card.id);
  }
});

test('unknown card IDs do not alter idle or one-open state', () => {
  const initial = startRound();
  assertIgnored(initial, 'unknown-card');

  const opened = selectCard(initial, initial.deck[0].id);
  assert.equal(opened.kind, 'first-opened');
  assertIgnored(opened.state, 'unknown-card');
});
