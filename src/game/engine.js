import { createInitialState, resolveMismatch, selectCard } from './state.js';

export function createGame({
  pairIds,
  onChange,
  random = Math.random,
  now = Date.now,
  delayMs = 1000,
}) {
  const roundPairIds = [...pairIds];
  let state = null;
  let roundId = 0;
  let pendingMismatch = null;
  let destroyed = false;

  function getSnapshot() {
    return state === null
      ? null
      : { ...state, deck: state.deck.map((card) => ({ ...card })) };
  }

  function cancelMismatch() {
    if (pendingMismatch !== null) {
      clearTimeout(pendingMismatch.timerId);
      pendingMismatch = null;
    }
  }

  function restart() {
    if (destroyed) return;

    cancelMismatch();
    roundId += 1;
    state = createInitialState({ pairIds: roundPairIds, roundId, random });
    onChange(getSnapshot(), 'started');
  }

  function choose(cardId) {
    if (destroyed || state === null) return;

    const result = selectCard(state, cardId, now());
    if (result.kind === 'ignored') return;

    state = result.state;
    if (result.kind === 'mismatch') {
      const pending = { roundId: state.roundId, timerId: null };
      pendingMismatch = pending;
      pending.timerId = setTimeout(() => {
        if (
          destroyed ||
          pendingMismatch !== pending ||
          state.roundId !== pending.roundId ||
          state.phase !== 'waiting-mismatch'
        ) {
          return;
        }

        pendingMismatch = null;
        state = resolveMismatch(state);
        onChange(getSnapshot(), 'mismatch-resolved');
      }, delayMs);
    }

    onChange(getSnapshot(), result.kind);
  }

  function destroy() {
    cancelMismatch();
    destroyed = true;
  }

  return { restart, choose, getSnapshot, destroy };
}
