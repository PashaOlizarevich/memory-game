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
  if (
    (state.phase !== 'idle' && state.phase !== 'one-open') ||
    state.secondCardId !== null
  ) {
    return { state, kind: 'ignored' };
  }

  const selectedCard = state.deck.find((card) => card.id === cardId);

  if (
    !selectedCard ||
    selectedCard.status !== 'closed' ||
    cardId === state.firstCardId
  ) {
    return { state, kind: 'ignored' };
  }

  const isSecondCard = state.phase === 'one-open';

  if (isSecondCard) {
    const firstCard = state.deck.find((card) => card.id === state.firstCardId);

    if (firstCard.pairId === selectedCard.pairId) {
      return {
        state: {
          ...state,
          deck: state.deck.map((card) =>
            card.id === state.firstCardId || card.id === cardId
              ? { ...card, status: 'matched' }
              : card,
          ),
          phase: 'idle',
          firstCardId: null,
          secondCardId: null,
          moves: state.moves + 1,
          matchedPairs: state.matchedPairs + 1,
        },
        kind: 'matched',
      };
    }
  }

  return {
    state: {
      ...state,
      deck: state.deck.map((card) =>
        card.id === cardId ? { ...card, status: 'open' } : card,
      ),
      phase: 'one-open',
      firstCardId: isSecondCard ? state.firstCardId : cardId,
      secondCardId: isSecondCard ? cardId : null,
      moves: state.moves + (isSecondCard ? 1 : 0),
    },
    kind: isSecondCard ? 'second-opened' : 'first-opened',
  };
}
