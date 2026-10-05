import { cards, backImageUrl } from '../src/game/cards.js';
import { createInitialState, selectCard, resolveMismatch } from '../src/game/state.js';
import { createAppView } from '../src/ui/app-view.js';

// Run in a browser from the project HTTP origin; no simulated DOM or dependencies.
export function runAppViewTests() {
  const calls = { cards: [], newGame: 0, leaderboard: 0 };
  const view = createAppView({
    cards,
    backImageUrl,
    onCard: (id) => calls.cards.push(id),
    onNewGame: () => { calls.newGame += 1; },
    onLeaderboard: () => { calls.leaderboard += 1; },
  });
  const outsideButton = document.createElement('button');
  outsideButton.textContent = 'Внешний элемент';
  document.body.append(outsideButton);
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const cardButtons = () => [...view.root.querySelectorAll('.game-card')];
  const counters = () => [...view.root.querySelectorAll('.game-counter')];
  const header = view.root.querySelector('.app-header');
  const newGame = view.getNewGameButton();
  const leaderboard = view.root.querySelector('.button-secondary');
  const board = view.root.querySelector('.game-board');
  const pairIds = cards.map((card) => card.pairId);
  let state = createInitialState({ pairIds, roundId: 1, random: () => 0.5 });

  function renderAndCheckSnapshot(snapshot) {
    const before = JSON.stringify(snapshot);
    view.render(snapshot);
    assert(JSON.stringify(snapshot) === before, 'render mutated its snapshot');
  }

  try {
    renderAndCheckSnapshot(state);
    const initialButtons = cardButtons();
    const initialImages = initialButtons.map((button) => button.firstElementChild);
    const initialCounters = counters();
    assert(initialButtons.length === 16, 'Expected 16 cards');
    assert(initialImages.every((image) => image.getAttribute('src') === backImageUrl), 'Closed cards must show the shared back');
    assert(initialButtons.every((button) => !button.disabled), 'Initial cards must be selectable');
    passed.push('initial deck and snapshot immutability');

    const counterChanges = new MutationObserver(() => {});
    initialCounters.forEach((counter) => counterChanges.observe(counter, { childList: true, subtree: true, characterData: true }));
    view.render(state);
    const repeatedCounterChanges = counterChanges.takeRecords();
    counterChanges.disconnect();
    assert(repeatedCounterChanges.length === 0, 'Unchanged counters must not repeat aria-live DOM updates');
    const first = state.deck[0];
    const firstButton = initialButtons[0];
    firstButton.firstElementChild.click();
    assert(calls.cards.length === 1 && calls.cards[0] === first.id, 'Nested image click must send one exact card ID');
    state = selectCard(state, first.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(cardButtons().every((button, index) => button === initialButtons[index] && button.firstElementChild === initialImages[index]), 'Same-round render replaced card or image nodes');
    assert(counters().every((counter, index) => counter === initialCounters[index]), 'Render replaced counters');
    assert(view.root.querySelector('.app-header') === header && view.getNewGameButton() === newGame, 'Render replaced header controls');
    assert(firstButton.dataset.status === 'open' && firstButton.disabled, 'Opened card status or availability is wrong');
    assert(firstButton.firstElementChild.getAttribute('src') === cards.find((card) => card.pairId === first.pairId).imageUrl, 'Opened card must show its face');
    assert(initialCounters[0].textContent === 'Ходы: 0', 'First card must not increase moves');
    firstButton.click();
    assert(calls.cards.length === 1, 'Disabled open card triggered callback');
    passed.push('stable same-round DOM and delegated card callback');

    const different = state.deck.find((card) => card.pairId !== first.pairId);
    state = selectCard(state, different.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(cardButtons().every((button) => button.disabled), 'Mismatch must block all card controls');
    assert(initialCounters[0].textContent === 'Ходы: 1', 'Mismatch counter is wrong');
    cardButtons().forEach((button) => button.firstElementChild.click());
    assert(calls.cards.length === 1, 'Blocked image clicks triggered callback');
    newGame.click();
    leaderboard.click();
    assert(calls.newGame === 1 && calls.leaderboard === 1, 'Header actions must remain available during mismatch');
    outsideButton.focus();
    state = resolveMismatch(state);
    renderAndCheckSnapshot(state);
    assert(document.activeElement === outsideButton && outsideButton.textContent === 'Внешний элемент', 'Render changed external focus or content');
    assert(cardButtons().every((button) => !button.disabled && button.dataset.status === 'closed' && button.firstElementChild.getAttribute('src') === backImageUrl), 'Resolved mismatch must restore backs and selection');
    passed.push('mismatch, resolution and external focus preservation');

    state = selectCard(state, first.id, 0).state;
    const partner = state.deck.find((card) => card.pairId === first.pairId && card.id !== first.id);
    state = selectCard(state, partner.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(initialCounters[1].textContent === 'Пары: 1 / 8', 'Matched pair counter is wrong');
    assert(cardButtons().filter((button) => button.dataset.status === 'matched' && button.disabled).length === 2, 'Matched pair must stay open and disabled');
    passed.push('matched statuses and counters');

    for (const pairId of pairIds.filter((id) => id !== first.pairId)) {
      for (const card of state.deck.filter((item) => item.pairId === pairId)) {
        state = selectCard(state, card.id, 123).state;
      }
    }
    renderAndCheckSnapshot(state);
    assert(state.phase === 'finished' && cardButtons().every((button) => button.disabled), 'Finished board must be blocked');
    assert(initialCounters[0].textContent === 'Ходы: 9' && initialCounters[1].textContent === 'Пары: 8 / 8', 'Finished counters are wrong');
    newGame.click();
    leaderboard.click();
    assert(calls.newGame === 2 && calls.leaderboard === 2, 'Finished game must keep header actions available exactly once');
    passed.push('finished board and available header actions');

    state = createInitialState({ pairIds, roundId: 2, random: () => 0.1 });
    renderAndCheckSnapshot(state);
    assert(cardButtons().every((button) => !initialButtons.includes(button)), 'New round must replace the deck');
    assert(view.root.querySelector('.app-header') === header && view.getNewGameButton() === newGame && view.root.querySelector('.game-board') === board, 'New round replaced the main screen');
    const restartedCard = cardButtons()[0];
    restartedCard.firstElementChild.click();
    assert(calls.cards.length === 2 && calls.cards[1] === state.deck[0].id, 'Restarted deck callback has wrong ID or duplicate listeners');
    assert(initialCounters[0].textContent === 'Ходы: 0' && initialCounters[1].textContent === 'Пары: 0 / 8', 'Restarted counters did not reset');
    passed.push('new-round deck replacement and stable screen');

    const beforeDestroy = JSON.stringify(calls);
    view.destroy();
    view.destroy();
    newGame.click();
    leaderboard.click();
    restartedCard.firstElementChild.click();
    view.render(state);
    assert(JSON.stringify(calls) === beforeDestroy, 'Destroyed view still triggered callbacks');
    assert(!view.root.isConnected && board.childElementCount === 16, 'Destroyed render changed or remounted the view');
    passed.push('destroy releases listeners and prevents future updates');
    return { passed };
  } finally {
    view.destroy();
    outsideButton.remove();
  }
}
