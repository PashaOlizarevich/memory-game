import { cards, backImageUrl } from '../src/game/cards.js';
import { createInitialState, selectCard, resolveMismatch } from '../src/game/state.js';
import { createAppView } from '../src/ui/app-view.js';

// Run in a browser from the project HTTP origin; no simulated DOM or dependencies.
export async function runAppViewTests() {
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
    const initialImages = initialButtons.map((button) => button.querySelector('.game-card-image'));
    const initialCounters = counters();
    assert(initialButtons.length === 16, 'Expected 16 cards');
    assert(initialButtons.every((button) => button.querySelector('.game-card-back-image').getAttribute('src') === backImageUrl), 'Closed cards must show the shared back');
    assert(initialButtons.every((button) => button.querySelector('.game-card-inner').getAttribute('aria-hidden') === 'true'), 'Decorative sides must be excluded from accessible names');
    initialButtons.forEach((button, index) => {
      assert(button.getAttribute('aria-label') === `Карточка ${index + 1}, закрыта`, 'Closed name revealed its face');
      assert(button.querySelector('.game-card-image').alt === '' && !button.querySelector('.game-card-image').title, 'Decorative image revealed a face label');
      assert(button.querySelector('.game-card-fallback').hidden && button.textContent === '', 'Closed card contains face fallback text');
    });
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
    firstButton.querySelector('.game-card-image').click();
    assert(calls.cards.length === 1 && calls.cards[0] === first.id, 'Nested image click must send one exact card ID');
    state = selectCard(state, first.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(cardButtons().every((button, index) => button === initialButtons[index] && button.querySelector('.game-card-image') === initialImages[index]), 'Same-round render replaced card or image nodes');
    assert(counters().every((counter, index) => counter === initialCounters[index]), 'Render replaced counters');
    assert(view.root.querySelector('.app-header') === header && view.getNewGameButton() === newGame, 'Render replaced header controls');
    assert(firstButton.dataset.status === 'open' && firstButton.disabled, 'Opened card status or availability is wrong');
    assert(firstButton.getAttribute('aria-label') === `Карточка 1, ${cards.find((card) => card.pairId === first.pairId).label}`, 'Opened accessible name is wrong');
    assert(firstButton.querySelector('.game-card-image').getAttribute('src') === cards.find((card) => card.pairId === first.pairId).imageUrl, 'Opened card must show its face');
    assert(initialCounters[0].textContent === 'Ходы: 0', 'First card must not increase moves');
    firstButton.click();
    assert(calls.cards.length === 1, 'Disabled open card triggered callback');
    passed.push('stable same-round DOM and delegated card callback');

    const different = state.deck.find((card) => card.pairId !== first.pairId);
    state = selectCard(state, different.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(cardButtons().every((button) => button.disabled), 'Mismatch must block all card controls');
    assert(initialCounters[0].textContent === 'Ходы: 1', 'Mismatch counter is wrong');
    cardButtons().forEach((button) => button.querySelector('.game-card-image').click());
    assert(calls.cards.length === 1, 'Blocked image clicks triggered callback');
    newGame.click();
    leaderboard.click();
    assert(calls.newGame === 1 && calls.leaderboard === 1, 'Header actions must remain available during mismatch');
    outsideButton.focus();
    state = resolveMismatch(state);
    renderAndCheckSnapshot(state);
    assert(document.activeElement === outsideButton && outsideButton.textContent === 'Внешний элемент', 'Render changed external focus or content');
    assert(cardButtons().every((button) => !button.disabled && button.dataset.status === 'closed' && button.querySelector('.game-card-back-image').getAttribute('src') === backImageUrl), 'Resolved mismatch must restore backs and selection');
    passed.push('mismatch, resolution and external focus preservation');

    state = selectCard(state, first.id, 0).state;
    const partner = state.deck.find((card) => card.pairId === first.pairId && card.id !== first.id);
    state = selectCard(state, partner.id, 0).state;
    renderAndCheckSnapshot(state);
    assert(initialCounters[1].textContent === 'Пары: 1 / 8', 'Matched pair counter is wrong');
    assert(cardButtons().filter((button) => button.dataset.status === 'matched' && button.disabled).length === 2, 'Matched pair must stay open and disabled');
    cardButtons().filter((button) => button.dataset.status === 'matched').forEach((button) => {
      assert(button.getAttribute('aria-label').endsWith(', пара найдена'), 'Matched name must announce the found pair');
    });
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
    restartedCard.querySelector('.game-card-image').click();
    assert(calls.cards.length === 2 && calls.cards[1] === state.deck[0].id, 'Restarted deck callback has wrong ID or duplicate listeners');
    assert(initialCounters[0].textContent === 'Ходы: 0' && initialCounters[1].textContent === 'Пары: 0 / 8', 'Restarted counters did not reset');
    passed.push('new-round deck replacement and stable screen');

    const beforeDestroy = JSON.stringify(calls);
    view.destroy();
    view.destroy();
    newGame.click();
    leaderboard.click();
    restartedCard.querySelector('.game-card-image').click();
    view.render(state);
    assert(JSON.stringify(calls) === beforeDestroy, 'Destroyed view still triggered callbacks');
    assert(!view.root.isConnected && board.childElementCount === 16, 'Destroyed render changed or remounted the view');
    passed.push('destroy releases listeners and prevents future updates');
    await runFlipTests(assert, passed);
    await runImageTests(assert, passed);
    return { passed };
  } finally {
    view.destroy();
    outsideButton.remove();
  }
}

async function runFlipTests(assert, passed) {
  const view = createAppView({ cards, backImageUrl, onCard: () => {}, onNewGame: () => {} });
  const reducedMotion = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules])
    .find((rule) => rule.conditionText === '(prefers-reduced-motion: reduce)');
  const originalMedia = reducedMotion.media.mediaText;
  const pairIds = cards.map((card) => card.pairId);
  try {
    let state = createInitialState({ pairIds, roundId: 1, random: () => 0.5 });
    view.render(state);
    const button = view.root.querySelector('.game-card');
    const inner = button.querySelector('.game-card-inner');
    const faceImage = button.querySelector('.game-card-image');
    const backImage = button.querySelector('.game-card-back-image');
    assert(getComputedStyle(inner).transform === 'none', 'Initial deck must start without a flip');
    assert(getComputedStyle(button.querySelector('.game-card-face')).backfaceVisibility === 'hidden', 'Reverse face must not bleed through');
    state = selectCard(state, state.deck[0].id, 0).state;
    view.render(state);
    getComputedStyle(inner).transform;
    const opening = inner.getAnimations()[0];
    if (!matchMedia(originalMedia).matches) {
      assert(opening && opening.effect.getTiming().duration === 300, 'Opening must animate for 300 ms');
      opening.finish();
    }
    assert(new DOMMatrix(getComputedStyle(inner).transform).m11 < -0.99, 'Opened face must complete a half-turn');
    const faceUrl = faceImage.getAttribute('src');
    const different = state.deck.find((card) => card.pairId !== state.deck[0].pairId);
    state = selectCard(state, different.id, 0).state;
    view.render(state);
    state = resolveMismatch(state);
    view.render(state);
    getComputedStyle(inner).transform;
    const closing = inner.getAnimations()[0];
    if (!matchMedia(originalMedia).matches) {
      assert(closing, 'Mismatch must animate back to the shared back');
      closing.finish();
    }
    assert(new DOMMatrix(getComputedStyle(inner).transform).m11 > 0.99, 'Closed card must complete the return flip');
    assert(faceImage.getAttribute('src') === faceUrl && backImage.getAttribute('src') === backImageUrl, 'Return flip must preserve both images');
    // Apply the actual reduced-motion rule regardless of the test machine preference.
    reducedMotion.media.mediaText = 'all';
    getComputedStyle(inner).transform;
    state = selectCard(state, state.deck[0].id, 0).state;
    view.render(state);
    assert(getComputedStyle(inner).transitionDuration === '0s' && inner.getAnimations().length === 0, 'Reduced motion must remove the flip transition');
    assert(new DOMMatrix(getComputedStyle(inner).transform).m11 < -0.99, 'Reduced motion must still show the opened face');
    passed.push('300 ms opening and return flips, stable sides and reduced motion');
  } finally {
    reducedMotion.media.mediaText = originalMedia;
    view.destroy();
  }
}

async function runImageTests(assert, passed) {
  const brokenUrl = 'data:image/png;base64,invalid';
  const testCards = cards.map((card, index) => index === 0 ? { ...card, imageUrl: brokenUrl } : card);
  const pairIds = cards.map((card) => card.pairId);
  const imageEvent = (image, type, action) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      image.removeEventListener(type, onEvent);
      reject(new Error(`Image ${type} did not arrive`));
    }, 3000);
    function onEvent() {
      clearTimeout(timeout);
      resolve();
    }
    image.addEventListener(type, onEvent, { once: true });
    action();
  });
  const view = createAppView({ cards: testCards, backImageUrl, onCard: () => {}, onNewGame: () => {} });
  let brokenBackView;
  try {
    let state = createInitialState({ pairIds, roundId: 1, random: () => 0.5 });
    view.render(state);
    const card = state.deck.find((item) => item.pairId === cards[0].pairId);
    const getButton = () => [...view.root.querySelectorAll('.game-card')].find((button) => button.dataset.cardId === card.id);
    const button = getButton();
    const image = button.querySelector('.game-card-image');
    const fallback = button.querySelector('.game-card-fallback');
    state = selectCard(state, card.id, 0).state;
    await imageEvent(image, 'error', () => view.render(state));
    assert(!fallback.hidden && fallback.textContent === cards[0].label && image.hidden, 'Broken face must show its text after opening');
    const changes = new MutationObserver(() => {});
    changes.observe(image, { attributes: true, attributeFilter: ['src'] });
    view.render(state);
    assert(changes.takeRecords().length === 0 && !fallback.hidden, 'Repeated render retried a failed image or hid its fallback');
    changes.disconnect();
    const different = state.deck.find((item) => item.pairId !== card.pairId);
    state = selectCard(state, different.id, 0).state;
    view.render(state);
    state = resolveMismatch(state);
    view.render(state);
    assert(fallback.hidden && fallback.textContent === '' && !image.hidden && button.dataset.status === 'closed' && button.querySelector('.game-card-back-image').getAttribute('src') === backImageUrl, 'Closing a failed face must conceal all face text');
    image.dispatchEvent(new Event('error'));
    assert(fallback.hidden && fallback.textContent === '', 'Late face error exposed a closed image');
    state = selectCard(state, card.id, 0).state;
    view.render(state);
    assert(!fallback.hidden, 'Reopening a failed face lost its fallback');
    const partner = state.deck.find((item) => item.pairId === card.pairId && item.id !== card.id);
    state = selectCard(state, partner.id, 0).state;
    view.render(state);
    assert(!fallback.hidden && button.getAttribute('aria-label').endsWith(', пара найдена'), 'Matched failed image lost its fallback or name');
    passed.push('real image failure, closed secrecy, reopen and matched fallback');

    await imageEvent(image, 'load', () => { image.src = cards[0].imageUrl; });
    assert(fallback.hidden && fallback.textContent === '' && !image.hidden, 'Successful load did not restore the image');
    image.dispatchEvent(new Event('error'));
    assert(fallback.hidden, 'Late error replaced a healthy current image');
    passed.push('successful image recovery and stale error rejection');

    state = createInitialState({ pairIds, roundId: 2, random: () => 0.5 });
    view.render(state);
    await imageEvent(image, 'error', () => { image.src = brokenUrl; });
    assert(fallback.hidden && fallback.textContent === '', 'Detached old-round image listener remained active');
    const currentButton = view.root.querySelector('.game-card');
    const currentImage = currentButton.querySelector('.game-card-image');
    const currentFallback = currentButton.querySelector('.game-card-fallback');
    view.destroy();
    currentButton.dataset.status = 'open';
    await imageEvent(currentImage, 'error', () => { currentImage.src = brokenUrl; });
    assert(currentFallback.hidden && currentFallback.textContent === '', 'Destroyed image listener remained active');
    passed.push('image listeners released on new round and destroy');

    brokenBackView = createAppView({ cards, backImageUrl: brokenUrl, onCard: () => {}, onNewGame: () => {} });
    brokenBackView.render(createInitialState({ pairIds, roundId: 1, random: () => 0.5 }));
    const closedButton = brokenBackView.root.querySelector('.game-card');
    await imageEvent(closedButton.querySelector('.game-card-back-image'), 'error', () => {});
    assert(closedButton.textContent === '' && closedButton.querySelector('.game-card-fallback').hidden
      && closedButton.getAttribute('aria-label') === 'Карточка 1, закрыта', 'Broken back must never reveal its face');
    passed.push('real shared-back failure keeps closed face concealed');
  } finally {
    view.destroy();
    brokenBackView?.destroy();
  }
}
