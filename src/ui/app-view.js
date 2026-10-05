export function createAppView({ cards, backImageUrl, onCard, onNewGame, onLeaderboard }) {
  const cardCatalog = new Map(cards.map((card) => [card.pairId, { ...card }]));
  const listeners = new AbortController();
  const root = document.createElement('main');
  root.className = 'app';

  const header = document.createElement('header');
  header.className = 'app-header';
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = 'Memory Game — Галактическая память';
  const actions = document.createElement('div');
  actions.className = 'app-actions';
  const newGameButton = document.createElement('button');
  newGameButton.type = 'button';
  newGameButton.className = 'button button-primary';
  newGameButton.textContent = 'Новая игра';
  const leaderboardButton = document.createElement('button');
  leaderboardButton.type = 'button';
  leaderboardButton.className = 'button button-secondary';
  leaderboardButton.textContent = 'Таблица лидеров';
  actions.append(newGameButton, leaderboardButton);
  header.append(title, actions);

  const counters = document.createElement('div');
  counters.className = 'game-counters';
  counters.setAttribute('aria-live', 'polite');
  counters.setAttribute('aria-atomic', 'true');
  const moves = document.createElement('p');
  moves.className = 'game-counter';
  moves.textContent = 'Ходы: 0';
  const pairs = document.createElement('p');
  pairs.className = 'game-counter';
  pairs.textContent = 'Пары: 0 / 8';
  counters.append(moves, pairs);

  const instruction = document.createElement('p');
  instruction.className = 'game-instruction';
  instruction.textContent = 'Откройте две карточки и найдите пару';
  const board = document.createElement('div');
  board.className = 'game-board';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Игровое поле');
  root.append(header, counters, instruction, board);

  let roundId = null;
  let cardViews = new Map();
  let destroyed = false;

  function createCard(card, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-card';
    button.dataset.cardId = card.id;
    button.dataset.status = 'closed';
    button.setAttribute('aria-label', `Карточка ${index + 1}, закрыта`);
    const image = document.createElement('img');
    image.className = 'game-card-image';
    image.alt = '';
    image.width = 256;
    image.height = 256;
    image.draggable = false;
    image.src = backImageUrl;
    button.append(image);
    return { button, image, number: index + 1 };
  }

  function createDeck(deck) {
    cardViews = new Map();
    const fragment = document.createDocumentFragment();
    deck.forEach((card, index) => {
      const view = createCard(card, index);
      cardViews.set(card.id, view);
      fragment.append(view.button);
    });
    board.replaceChildren(fragment);
  }

  function render(snapshot) {
    if (destroyed) return;
    if (roundId !== snapshot.roundId) {
      createDeck(snapshot.deck);
      roundId = snapshot.roundId;
    }
    const movesText = `Ходы: ${snapshot.moves}`;
    const pairsText = `Пары: ${snapshot.matchedPairs} / 8`;
    if (moves.textContent !== movesText) moves.textContent = movesText;
    if (pairs.textContent !== pairsText) pairs.textContent = pairsText;
    const blocked = snapshot.phase === 'waiting-mismatch' || snapshot.phase === 'finished';
    snapshot.deck.forEach((card) => {
      const { button, image, number } = cardViews.get(card.id);
      const closed = card.status === 'closed';
      const description = cardCatalog.get(card.pairId);
      const imageUrl = closed ? backImageUrl : description.imageUrl;
      if (image.getAttribute('src') !== imageUrl) image.src = imageUrl;
      button.dataset.status = card.status;
      button.disabled = blocked || !closed;
      button.setAttribute('aria-label', closed
        ? `Карточка ${number}, закрыта`
        : `Карточка ${number}, ${description.label}${card.status === 'matched' ? ', пара найдена' : ''}`);
    });
  }

  newGameButton.addEventListener('click', () => onNewGame(), { signal: listeners.signal });
  leaderboardButton.addEventListener('click', () => onLeaderboard(), { signal: listeners.signal });
  board.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-card-id]');
    if (button && board.contains(button) && !button.disabled) onCard(button.dataset.cardId);
  }, { signal: listeners.signal });

  // Position-only placeholders show the shell until main renders the first engine snapshot.
  createDeck(Array.from({ length: 16 }, (_, index) => ({ id: `initial:${index}` })));
  document.body.append(root);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    listeners.abort();
    root.remove();
    cardViews.clear();
  }

  return { root, render, getNewGameButton: () => newGameButton, destroy };
}
