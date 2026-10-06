// Final acceptance checks against the real page, using only the project's storage key.
export async function runAcceptanceTests() {
  const storageKey = 'memory-game.leaderboard.v1';
  const original = localStorage.getItem(storageKey);
  const best = Array.from({ length: 10 }, (_, completedAt) => ({ moves: 8, completedAt }));
  const seeded = JSON.stringify(best);
  const frame = document.createElement('iframe');
  frame.title = 'Игра для проверки приёмки';
  const passed = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let doc;
  const cards = () => [...doc.querySelectorAll('.game-card')];
  const counters = () => [...doc.querySelectorAll('.game-counter')].map((node) => node.textContent);
  const pairId = (button) => button.dataset.cardId.split(':')[1];
  const boardState = () => JSON.stringify({
    cards: cards().map((button) => [button.dataset.cardId, button.dataset.status, button.disabled]),
    counters: counters(),
  });
  const unchangedRating = () => assert(localStorage.getItem(storageKey) === seeded, 'A worse or later equal victory must preserve the full best-ten ranking');
  const loadPage = async (reload = false) => {
    const loaded = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Game page did not load')), 3000);
      frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    if (reload) frame.contentWindow.location.reload();
    else frame.src = `../index.html?acceptance=${Math.random()}`;
    if (!frame.isConnected) document.body.append(frame);
    await loaded;
    doc = frame.contentDocument;
  };
  const finishPairs = () => {
    for (const pair of Map.groupBy(cards(), pairId).values()) pair.forEach((button) => button.click());
  };
  const checkFreshGame = () => {
    assert(cards().length === 16 && cards().every((button) => button.dataset.status === 'closed' && !button.disabled), 'Reload must start with sixteen selectable closed cards');
    assert(counters().join('|') === 'Ходы: 0|Пары: 0 / 8', 'Reload must reset both counters');
    assert(Map.groupBy(cards(), pairId).size === 8, 'Reload must retain eight actual pairs');
    assert(!doc.querySelector('.app-header .button-secondary').disabled, 'Reload must keep leaderboard available');
  };
  const closeWindow = (method) => {
    if (method === 'header') doc.querySelector('.modal-close').click();
    else if (method === 'footer') doc.querySelector('.modal-actions .button-secondary').click();
    else if (method === 'backdrop') doc.querySelector('.modal-overlay').click();
    else doc.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  };
  const checkWindowAndClose = (kind, method) => {
    const state = boardState();
    const deck = cards();
    const overlay = doc.querySelector('.modal-overlay');
    const panel = doc.querySelector('.modal-panel');
    const content = panel.querySelector(kind === 'victory' ? '.victory-result' : 'tbody td');
    assert(!overlay.hidden && doc.querySelector('.app').inert, `${kind} must open and lock the game`);
    content.click();
    assert(!overlay.hidden && panel.contains(doc.activeElement), `${kind} content click must leave the window open`);
    closeWindow(method);
    assert(overlay.hidden && !doc.querySelector('.app').inert, `${kind} ${method} must close and release the game`);
    assert(cards().every((button, index) => button === deck[index]) && boardState() === state, `${kind} ${method} must preserve the finished board and counters`);
    assert(doc.activeElement === doc.querySelector(kind === 'victory' ? '.app-header .button-primary' : '.app-header .button-secondary'), `${kind} ${method} must restore trigger focus`);
    unchangedRating();
  };

  try {
    localStorage.setItem(storageKey, seeded);
    await loadPage();
    checkFreshGame();
    const first = cards()[0];
    const different = cards().find((button) => pairId(button) !== pairId(first));
    first.click();
    const started = performance.now();
    different.click();
    await pause(700);
    assert(first.dataset.status === 'open' && different.dataset.status === 'open', 'Mismatch must remain open at 700 ms');
    while (first.dataset.status === 'open' && performance.now() - started < 1500) await pause(10);
    const elapsed = performance.now() - started;
    assert(first.dataset.status === 'closed' && different.dataset.status === 'closed' && elapsed >= 700 && elapsed <= 1500,
      `Active-tab mismatch must resolve within 700–1500 ms; observed ${elapsed} ms`);
    assert(counters().join('|') === 'Ходы: 1|Пары: 0 / 8', 'Mismatch must count one move without a pair');
    passed.push(`active-tab mismatch resolves in ${Math.round(elapsed)} ms within 700–1500 ms`);

    finishPairs();
    assert(doc.querySelector('.modal-title').textContent === 'Сила памяти с вами!'
      && doc.querySelector('.victory-result').textContent === 'Ходы: 9', 'A result outside top ten must still open victory with its actual nine moves');
    assert(counters().join('|') === 'Ходы: 9|Пары: 8 / 8', 'Excluded victory must retain final counters');
    unchangedRating();
    passed.push('nine-move victory opens while the ten better saved results remain unchanged');

    const methods = ['header', 'footer', 'backdrop', 'escape'];
    for (const method of methods) {
      checkWindowAndClose('victory', method);
      doc.querySelector('.app-header .button-secondary').click();
      assert(doc.querySelectorAll('tbody tr').length === 10, 'Actual leaderboard must show the full best ten');
      checkWindowAndClose('leaderboard', method);
      if (method !== methods.at(-1)) {
        doc.querySelector('.app-header .button-primary').click();
        finishPairs();
        assert(doc.querySelector('.victory-result').textContent === 'Ходы: 8', 'Later round must show its own eight-move result');
      }
    }
    passed.push('both actual windows preserve content clicks and close through header, footer, backdrop and Escape without changing board or ranking');

    doc.querySelector('.app-header .button-primary').click();
    cards()[0].click();
    assert(cards().filter((button) => button.dataset.status === 'open').length === 1, 'Reload scenario must begin with an unfinished selection');
    unchangedRating();
    await loadPage(true);
    checkFreshGame();
    unchangedRating();
    doc.querySelector('.app-header .button-secondary').click();
    const rows = [...doc.querySelectorAll('tbody tr')];
    assert(rows.length === 10 && rows.every((row, index) => row.children[0].textContent === String(index + 1)
      && row.children[1].textContent === '8'), 'Reload must display saved top-ten results with positions from one');
    closeWindow('footer');
    checkFreshGame();
    passed.push('reloading an unfinished round resets the field without saving it and restores the existing ranking');
    return { passed };
  } finally {
    frame.remove();
    if (original === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, original);
  }
}
