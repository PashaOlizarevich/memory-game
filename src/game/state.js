import { shuffle } from './shuffle.js';

export function createInitialState({ pairIds, roundId, random = Math.random }) {
  const deck = pairIds.flatMap((pairId) =>
    [0, 1].map((copyIndex) => ({
      id: `${roundId}:${pairId}:${copyIndex}`,
      pairId,
      status: 'closed',
    })),
  );

  return {
    roundId,
    deck: shuffle(deck, random),
    phase: 'idle',
    firstCardId: null,
    secondCardId: null,
    moves: 0,
    matchedPairs: 0,
    completedAt: null,
  };
}
