// Exercise the actual index.html/main.js through DOM actions and browser timers.
export async function runMainTests() {
  const storageKey = 'memory-game.leaderboard.v1';
  const originalResults = localStorage.getItem(storageKey);
  localStorage.setItem(storageKey, '[]');
  const frame = document.createElement('iframe');
  frame.title = 'Проверяемая игра';
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src = '../index.html';
  document.body.append(frame);
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    await loaded;
    const doc = frame.contentDocument;
    const cardButtons = () => [...doc.querySelectorAll('.game-card')];
    const counters = () => [...doc.querySelectorAll('.game-counter')].map((node) => node.textContent);
    const newGame = doc.querySelector('.button-primary');
    const pairId = (button) => button.dataset.cardId.split(':')[1];
    const closed = () => cardButtons().filter((button) => button.dataset.status === 'closed');
    const checkStart = () => {
      assert(cardButtons().length === 16 && closed().length === 16, 'Auto-start must create 16 closed cards');
      assert(cardButtons().every((button) => !button.disabled), 'Initial cards must be selectable');
      assert(counters().join('|') === 'Ходы: 0|Пары: 0 / 8', 'Initial counters must be zero');
    };
    const checkRestart = (button) => {
      const previousDeck = cardButtons();
      const previousRound = Number(previousDeck[0].dataset.cardId.split(':')[0]);
      const previousResults = localStorage.getItem(storageKey);
      button.click();
      checkStart();
      assert(cardButtons().every((card) => !previousDeck.includes(card)
        && Number(card.dataset.cardId.split(':')[0]) === previousRound + 1),
      'One New Game click must immediately replace the deck with exactly the next round');
      assert(localStorage.getItem(storageKey) === previousResults, 'Restart must preserve saved results exactly');
    };
    checkStart();
    const leaderboard = doc.querySelector('.app-header .button-secondary');
    assert(!leaderboard.disabled, 'Connected leaderboard must be available');
    passed.push('actual page auto-start and zero counters');

    leaderboard.click();
    assert(doc.querySelector('.modal-title').textContent === 'Таблица лидеров', 'Leaderboard must use the common shell');
    assert(doc.querySelector('.leaderboard-empty') && !doc.querySelector('.leaderboard-table'), 'Initial leaderboard must be empty');
    doc.querySelector('.modal-close').click();
    checkStart();
    passed.push('connected empty leaderboard and close preserve the initial game');

    const first = closed()[0];
    const partner = closed().find((button) => button !== first && pairId(button) === pairId(first));
    first.firstElementChild.click();
    assert(first.dataset.status === 'open' && counters()[0] === 'Ходы: 0', 'First click must open without a move');
    first.click();
    assert(counters()[0] === 'Ходы: 0', 'Repeated click must be ignored');
    partner.click();
    assert(first.dataset.status === 'matched' && partner.dataset.status === 'matched', 'Matching cards must remain open');
    assert(counters().join('|') === 'Ходы: 1|Пары: 1 / 8', 'Match must add one move and one pair');
    passed.push('first choice, ignored repeat and matched pair');

    const a = closed()[0];
    const b = closed().find((button) => pairId(button) !== pairId(a));
    a.click();
    const mismatchStarted = performance.now();
    b.click();
    assert(cardButtons().every((button) => button.disabled), 'Mismatch must immediately block cards');
    assert(counters()[0] === 'Ходы: 2', 'Mismatch must count exactly one move');
    closed()[0].firstElementChild.click();
    await pause(750);
    assert(a.dataset.status === 'open' && b.dataset.status === 'open', 'Mismatch closed before its delay');
    while (a.dataset.status === 'open' && performance.now() - mismatchStarted < 3000) await pause(25);
    const elapsed = performance.now() - mismatchStarted;
    assert(a.dataset.status === 'closed' && b.dataset.status === 'closed', 'Browser timer must close mismatch');
    assert(elapsed >= 950 && elapsed < 2500, `Unexpected mismatch delay: ${elapsed} ms`);
    assert(first.dataset.status === 'matched' && counters().join('|') === 'Ходы: 2|Пары: 1 / 8', 'Timer must preserve matches and counters');
    passed.push('real mismatch timer, blocked third click and preserved match');

    a.click();
    b.click();
    checkRestart(newGame);
    const current = cardButtons()[0];
    current.click();
    await pause(1100);
    assert(current.dataset.status === 'open' && counters()[0] === 'Ходы: 0', 'Old timeout changed the new round selection');
    passed.push('restart during mismatch and unchanged new choice after old deadline');

    checkRestart(newGame);
    const groups = Map.groupBy(cardButtons(), pairId);
    assert(groups.size === 8 && [...groups.values()].every((pair) => pair.length === 2), 'Expected eight pairs');
    for (const pair of groups.values()) pair.forEach((button) => button.click());
    assert(counters().join('|') === 'Ходы: 8|Пары: 8 / 8', 'Full game must finish in eight matching moves');
    assert(cardButtons().every((button) => button.disabled && button.dataset.status === 'matched'), 'Finished board must stay open and blocked');
    cardButtons()[0].firstElementChild.click();
    assert(counters()[0] === 'Ходы: 8', 'Finished click changed the result');
    const panel = doc.querySelector('.modal-panel');
    assert(doc.querySelector('.modal-title').textContent === 'Сила памяти с вами!', 'Completion must open victory');
    assert(panel.querySelector('.victory-result').textContent === 'Ходы: 8', 'Victory must show the completed result');
    const saved = JSON.parse(localStorage.getItem(storageKey));
    assert(saved.length === 1 && saved[0].moves === 8 && Number.isSafeInteger(saved[0].completedAt), 'Victory must save exactly one result');
    doc.querySelector('.modal-close').click();
    for (let index = 0; index < 2; index += 1) {
      leaderboard.click();
      assert(doc.querySelector('.modal-panel') === panel, 'Leaderboard must reuse the victory shell');
      const rows = [...panel.querySelectorAll('tbody tr')];
      assert(rows.length === 1 && rows[0].children[1].textContent === '8', 'Leaderboard must show the latest result');
      panel.querySelector('.modal-actions button').click();
    }
    assert(JSON.stringify(JSON.parse(localStorage.getItem(storageKey))) === JSON.stringify(saved), 'Closing and reopening must not save the victory again');
    passed.push('victory is saved once and repeated leaderboard views show the same result');
    checkRestart(newGame);
    passed.push('complete game, ignored finished click and restart after completion');

    const htmlStyle = doc.documentElement.style.cssText;
    const bodyStyle = doc.body.style.cssText;
    doc.documentElement.style.setProperty('overflow', 'scroll', 'important');
    doc.body.style.setProperty('overflow-y', 'auto');
    const expectedHtmlStyle = doc.documentElement.style.cssText;
    const expectedBodyStyle = doc.body.style.cssText;
    for (const pair of Map.groupBy(cardButtons(), pairId).values()) pair.forEach((button) => button.click());
    assert(JSON.parse(localStorage.getItem(storageKey)).length === 2, 'A different round must save its own result');
    assert(doc.querySelector('.app').inert && panel.contains(doc.activeElement), 'Victory must lock the game and focus its dialog');
    assert(doc.documentElement.style.overflow === 'hidden' && doc.body.style.overflow === 'hidden', 'Victory must lock both scroll surfaces');
    checkRestart(doc.querySelector('.modal-actions .button-primary'));
    assert(doc.querySelector('.modal-overlay').hidden && !doc.querySelector('.app').inert, 'Victory New Game must close and restore the game');
    assert(doc.activeElement === newGame, 'Victory New Game must restore focus to the header action');
    assert(doc.documentElement.style.cssText === expectedHtmlStyle && doc.body.style.cssText === expectedBodyStyle,
      'Victory New Game must restore original overflow values and priorities');
    doc.documentElement.style.cssText = htmlStyle;
    doc.body.style.cssText = bodyStyle;
    passed.push('another completed round saves independently and victory New Game restarts');

    cardButtons()[0].click();
    checkRestart(newGame);
    for (const pair of Map.groupBy(cardButtons(), pairId).values()) pair.forEach((button) => button.click());
    assert(JSON.parse(localStorage.getItem(storageKey)).length === 3, 'Repeated completion must save only its own result');
    checkRestart(doc.querySelector('.modal-actions .button-primary'));
    assert(doc.querySelector('.modal-overlay').hidden && !doc.querySelector('.app').inert
      && doc.activeElement === newGame, 'Repeated victory restart must release the dialog and restore focus');
    assert(doc.documentElement.style.cssText === htmlStyle && doc.body.style.cssText === bodyStyle,
      'Repeated victory restart must restore the default scroll declarations');
    cardButtons()[0].click();
    assert(cardButtons().filter((button) => button.dataset.status === 'open').length === 1,
      'The new round must accept a choice immediately after victory restart');
    passed.push('repeated header and victory restarts create one round per click without duplicate handlers');
    return { passed };
  } finally {
    frame.remove();
    if (originalResults === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, originalResults);
  }
}
