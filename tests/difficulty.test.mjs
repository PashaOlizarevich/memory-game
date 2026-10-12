import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_DIFFICULTY_ID, difficulties, getDifficulty } from '../src/game/difficulty.js';
import { cards, cardOrder, getCardsForDifficulty } from '../src/game/cards.js';
import { createGame } from '../src/game/engine.js';

test('four unique immutable levels define consistent pair counts and grids', () => {
  assert.equal(DEFAULT_DIFFICULTY_ID, 'easy');
  assert.deepEqual(difficulties.map(({ id }) => id), ['easy', 'medium', 'hard', 'expert']);
  assert.equal(new Set(difficulties.map(({ id }) => id)).size, 4);
  assert.deepEqual(difficulties.map(({ pairCount }) => pairCount), [8, 12, 16, 20]);
  assert.deepEqual(difficulties.map(({ columns, rows }) => [columns, rows]), [[4, 4], [6, 4], [8, 4], [8, 5]]);
  for (const difficulty of difficulties) {
    assert.ok(difficulty.label.length > 0);
    assert.equal(difficulty.columns * difficulty.rows, difficulty.pairCount * 2);
    assert.equal(getDifficulty(difficulty.id), difficulty);
    assert.ok(Object.isFrozen(difficulty));
  }
  assert.ok(Object.isFrozen(difficulties));
  assert.ok(Object.isFrozen(cardOrder));
  assert.equal(cardOrder.length, 20);
  assert.equal(new Set(cardOrder).size, 20);
});

test('easy membership survives catalog expansion and reordering without mutating input', () => {
  const expected = cardOrder.slice(0, 8);
  const catalog = [{ pairId: 'unrelated' }, { pairId: 'yoda' }, ...cards.toReversed()];
  const before = structuredClone(catalog);
  const selected = getCardsForDifficulty('easy', catalog);
  assert.deepEqual(selected.map(({ pairId }) => pairId), expected);
  assert.deepEqual(catalog, before);
  selected[0].label = 'changed';
  selected.pop();
  assert.deepEqual(catalog, before);
  assert.deepEqual(getCardsForDifficulty('easy', catalog).map(({ pairId }) => pairId), expected);
});

test('unknown or incomplete levels fail instead of returning partial or fake sets', () => {
  for (const id of ['medium', 'hard', 'expert']) {
    assert.throws(() => getCardsForDifficulty(id, cards.slice(0, 8)), /yoda/);
  }
  assert.throws(() => getDifficulty('unknown'), RangeError);
  assert.throws(() => getCardsForDifficulty('unknown'), RangeError);
  assert.throws(() => getCardsForDifficulty('easy', cards.slice(1)), /astromech/);
  assert.throws(() => getCardsForDifficulty('easy', [...cards, cards[0]]), /astromech/);
});

test('default selection still starts sixteen closed cards and finishes after eight pairs', (t) => {
  const pairIds = getCardsForDifficulty(DEFAULT_DIFFICULTY_ID).map(({ pairId }) => pairId);
  const game = createGame({ pairIds, onChange: () => {}, random: () => 0.5 });
  t.after(() => game.destroy());
  game.restart();
  const initial = game.getSnapshot();
  assert.equal(initial.deck.length, 16);
  assert.equal(new Set(initial.deck.map(({ id }) => id)).size, 16);
  assert.ok(initial.deck.every(({ status }) => status === 'closed'));
  assert.equal(initial.moves, 0);
  assert.equal(initial.matchedPairs, 0);
  for (const [index, pairId] of pairIds.entries()) {
    const pair = game.getSnapshot().deck.filter((card) => card.pairId === pairId);
    assert.equal(pair.length, 2);
    game.choose(pair[0].id);
    game.choose(pair[1].id);
    assert.equal(game.getSnapshot().phase, index === 7 ? 'finished' : 'idle');
  }
  assert.equal(game.getSnapshot().moves, 8);
  assert.equal(game.getSnapshot().matchedPairs, 8);
});
