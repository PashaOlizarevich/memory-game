import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { cards, cardOrder, getCardsForDifficulty } from '../src/game/cards.js';
import { difficulties } from '../src/game/difficulty.js';

test('catalog contains twenty unique labeled images and preserves the original eight', () => {
  assert.equal(cards.length, 20);
  assert.deepEqual(cards.map(({ pairId }) => pairId), cardOrder);
  assert.deepEqual(cardOrder.slice(0, 8), ['astromech', 'protocol-droid', 'trooper-helmet', 'dark-helmet', 'lightsaber', 'starfighter', 'freighter', 'space-station']);
  assert.equal(new Set(cards.map(({ pairId }) => pairId)).size, 20);
  assert.equal(new Set(cards.map(({ label }) => label)).size, 20);
  assert.equal(new Set(cards.map(({ imageUrl }) => imageUrl)).size, 20);
  assert.ok(cards.every(({ label }) => typeof label === 'string' && label.trim()));
  assert.ok(cards.slice(0, 8).every(({ animated }) => animated === true));
  assert.ok(cards.slice(8).every(({ animated }) => !animated));
});

test('all four card sets have unique fixed nested membership regardless of catalog order', () => {
  let previous = [];
  for (const { id, pairCount } of difficulties) {
    const selected = getCardsForDifficulty(id, cards.toReversed());
    const ids = selected.map(({ pairId }) => pairId);
    assert.equal(ids.length, pairCount);
    assert.equal(new Set(ids).size, pairCount);
    assert.deepEqual(ids.slice(0, previous.length), previous);
    assert.deepEqual(ids, cardOrder.slice(0, pairCount));
    selected[0].label = 'modified copy';
    assert.notEqual(cards[0].label, selected[0].label);
    previous = ids;
  }
});

test('every card resource exists and new character SVGs are standalone static distinct images', async () => {
  const images = [];
  for (const [index, card] of cards.entries()) {
    assert.match(card.imageUrl, /^\.\/public\/assets\/images\/cards\/[a-z-]+\.svg$/);
    const svg = await readFile(new URL('../' + card.imageUrl, import.meta.url), 'utf8');
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 256 256"/);
    assert.match(svg, /<path\s/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|(?:href|src)="https?:/i);
    if (index >= 8) assert.doesNotMatch(svg, /<animate\b|<animateTransform\b|@keyframes|animation\s*:/i);
    images.push(svg);
  }
  assert.equal(new Set(images).size, 20);
});
