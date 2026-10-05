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

export function selectCard(state, cardId) {
  if (state.phase !== 'idle') {
    return { state, kind: 'ignored' };
  }

  const selectedCard = state.deck.find((card) => card.id === cardId);

  if (!selectedCard || selectedCard.status !== 'closed') {
    return { state, kind: 'ignored' };
  }

  return {
    state: {
      ...state,
      deck: state.deck.map((card) =>
        card.id === cardId ? { ...card, status: 'open' } : card,
      ),
      phase: 'one-open',
      firstCardId: cardId,
    },
    kind: 'first-opened',
  };
}
