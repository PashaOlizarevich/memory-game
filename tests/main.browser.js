// Exercise the actual index.html/main.js through DOM actions and browser timers.
export async function runMainTests() {
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
    checkStart();
    assert(doc.querySelector('.button-secondary').disabled, 'Unconnected leaderboard must be unavailable');
    passed.push('actual page auto-start and zero counters');

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
    const oldDeck = cardButtons();
    newGame.click();
    checkStart();
    assert(cardButtons().every((button) => !oldDeck.includes(button)), 'Restart must replace the old round');
    const current = cardButtons()[0];
    current.click();
    await pause(1100);
    assert(current.dataset.status === 'open' && counters()[0] === 'Ходы: 0', 'Old timeout changed the new round selection');
    passed.push('restart during mismatch and unchanged new choice after old deadline');

    newGame.click();
    checkStart();
    const groups = Map.groupBy(cardButtons(), pairId);
    assert(groups.size === 8 && [...groups.values()].every((pair) => pair.length === 2), 'Expected eight pairs');
    for (const pair of groups.values()) pair.forEach((button) => button.click());
    assert(counters().join('|') === 'Ходы: 8|Пары: 8 / 8', 'Full game must finish in eight matching moves');
    assert(cardButtons().every((button) => button.disabled && button.dataset.status === 'matched'), 'Finished board must stay open and blocked');
    cardButtons()[0].firstElementChild.click();
    assert(counters()[0] === 'Ходы: 8', 'Finished click changed the result');
    newGame.click();
    checkStart();
    passed.push('complete game, ignored finished click and restart after completion');
    return { passed };
  } finally {
    frame.remove();
  }
}
