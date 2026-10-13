// Test four real modes through the actual application, preserving user storage.
export async function runDifficultyTests() {
  const key = 'memory-game.leaderboard.v2';
  const previous = localStorage.getItem(key);
  const legacyKey = 'memory-game.leaderboard.v1';
  const previousLegacy = localStorage.getItem(legacyKey);
  localStorage.setItem(key, JSON.stringify({ version: 2, results: { easy: [], medium: [], hard: [], expert: [] } }));
  const frame = document.createElement('iframe');
  frame.title = 'Проверка сложности';
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src = '../index.html';
  document.body.append(frame);
  const passed = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reload = async () => {
    const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    frame.contentWindow.location.reload();
    await ready;
    return frame.contentDocument;
  };
  try {
    await loaded;
    const doc = frame.contentDocument;
    const select = doc.querySelector('#game-difficulty');
    const start = doc.querySelector('.start-game');
    const repeat = doc.querySelector('.app-actions .button-primary');
    const leaderboard = doc.querySelector('.app-actions .button-secondary');
    const cards = () => [...doc.querySelectorAll('.game-card')];
    const pairId = (button) => button.dataset.cardId.split(':')[1];
    const chooseLevel = (id) => { select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })); };
    const countText = () => [...doc.querySelectorAll('.game-counter')].map((node) => node.textContent).join('|');
    for (const [id, pairCount, label] of [['easy',8,'Лёгкий'],['medium',12,'Средний'],['hard',16,'Сложный'],['expert',20,'Эксперт']]) {
      const oldDeck = cards();
      oldDeck[0].click();
      const oldCounters = countText();
      chooseLevel(id);
      assert(cards().every((card,index) => card === oldDeck[index]) && oldDeck[0].dataset.status === 'open' && countText() === oldCounters,
        'Pending level choice must preserve the current round');
      start.focus();
      start.click();
      assert(doc.activeElement === start, 'Starting must preserve focus on the persistent control');
      assert(cards().length === pairCount * 2 && cards().every((card) => card.dataset.status === 'closed' && !card.disabled), 'Selected level must start closed');
      assert(countText() === 'Ходы: 0|Пары: 0 / ' + pairCount && doc.querySelector('.active-difficulty').textContent === 'Уровень: ' + label, 'Level and counters must reflect the active game');
      assert(Map.groupBy(cards(), pairId).size === pairCount, 'Every level must contain its expected images');
      passed.push(id + ': pending choice and explicit launch');
      chooseLevel(id === 'expert' ? 'easy' : 'expert');
      repeat.click();
      assert(cards().length === pairCount * 2 && select.value !== id, 'Repeat must use active rather than pending difficulty');
      for (const pair of Map.groupBy(cards(), pairId).values()) pair.forEach((button) => button.click());
      assert(countText() === 'Ходы: ' + pairCount + '|Пары: ' + pairCount + ' / ' + pairCount, 'Win counters must use the entire deck');
      assert(doc.querySelector('.modal-description').textContent === 'Все ' + pairCount + ' пар найдены' && doc.querySelector('.victory-difficulty').textContent === 'Уровень: ' + label, 'Victory must identify the completed difficulty');
      const before = localStorage.getItem(key);
      const saved = JSON.parse(before).results;
      assert(saved[id].length === 1 && saved[id][0].moves === pairCount, 'Victory must save one result in its own ranking');
      doc.querySelector('.modal-close').click();
      leaderboard.click();
      const rating = doc.querySelector('.leaderboard-difficulty');
      assert(rating.value === id, 'Ranking must open on active level');
      rating.focus();
      rating.value = id === 'easy' ? 'expert' : 'easy';
      rating.dispatchEvent(new Event('change', { bubbles: true }));
      assert(doc.activeElement === rating && rating.isConnected, 'Ranking switch must retain its control and focus');
      const displayedRows = [...doc.querySelectorAll('.leaderboard-table tbody tr')];
      assert(displayedRows.length === saved[rating.value].length, 'Ranking must show entries of the selected level');
      assert(displayedRows.every((row, index) => Number(row.children[1].textContent) === saved[rating.value][index].moves), 'Ranking moves must belong to the selected level');
      assert(localStorage.getItem(key) === before && cards().length === pairCount * 2, 'Ranking switch must not change the game or save again');
      rating.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert(doc.activeElement === leaderboard, 'Closing ranking must return focus to its trigger');
      repeat.click();
      assert(cards().length === pairCount * 2 && cards().every((card) => card.dataset.status === 'closed'), 'Repeat after win must retain active level');
      passed.push(id + ': repeat, win and independent ranking');
    }
    chooseLevel('medium'); start.click();
    const first = cards()[0], second = cards().find((card) => pairId(card) !== pairId(first));
    first.click(); second.click();
    chooseLevel('expert'); start.click();
    const current = cards()[0]; current.click();
    await pause(1150);
    assert(cards().length === 40 && current.dataset.status === 'open' && countText() === 'Ходы: 0|Пары: 0 / 20', 'Old mismatch timer must not touch the selected new level');
    passed.push('level launch during mismatch cancels the old timer');
    repeat.click();
    const a = cards()[0], b = cards().find((card) => pairId(card) !== pairId(a));
    a.click(); b.click(); leaderboard.click();
    const rating = doc.querySelector('.leaderboard-difficulty');
    rating.focus(); rating.value = 'medium'; rating.dispatchEvent(new Event('change', { bubbles: true }));
    const entries = doc.querySelector('.leaderboard-entries');
    await pause(1150);
    assert(a.dataset.status === 'closed' && b.dataset.status === 'closed' && doc.activeElement === rating && entries === doc.querySelector('.leaderboard-entries') && rating.value === 'medium', 'Mismatch must resolve behind independently selected ranking without focus loss');
    passed.push('ranking switch preserves the running timer and selector focus');
    const beforeReload = localStorage.getItem(key);
    const fresh = await reload();
    assert(fresh.querySelectorAll('.game-card').length === 16 && [...fresh.querySelectorAll('.game-card')].every((card) => card.dataset.status === 'closed'), 'Reload must discard the unfinished expert round and start easy');
    fresh.querySelector('.app-actions .button-secondary').click();
    const freshRating = fresh.querySelector('.leaderboard-difficulty');
    for (const [id, moves] of [['easy',8],['medium',12],['hard',16],['expert',20]]) {
      freshRating.value = id;
      freshRating.dispatchEvent(new Event('change', { bubbles: true }));
      const rows = [...fresh.querySelectorAll('.leaderboard-table tbody tr')];
      assert(rows.length === 1 && Number(rows[0].children[1].textContent) === moves, 'Reload must preserve exactly one completed result for ' + id);
    }
    assert(localStorage.getItem(key) === beforeReload, 'Reload and ranking reads must not write another result');
    passed.push('real reload preserves all four rankings and discards the unfinished round');

    const legacySeed = JSON.stringify([{ moves: 9, completedAt: 0 }, { moves: 8, completedAt: 1 }, { moves: 7, completedAt: 2 }]);
    localStorage.setItem(legacyKey, legacySeed);
    localStorage.removeItem(key);
    const migrated = await reload();
    migrated.querySelector('.app-actions .button-secondary').click();
    const migration = JSON.parse(localStorage.getItem(key));
    assert(migration.version === 2 && migration.results.easy.length === 2 && migration.results.easy[0].moves === 8 && migration.results.easy[1].moves === 9, 'Real startup must filter and sort legacy results into easy');
    assert(['medium','hard','expert'].every((id) => migration.results[id].length === 0), 'Legacy results must not leak into other levels');
    assert(migrated.querySelectorAll('.leaderboard-table tbody tr').length === 2 && localStorage.getItem(legacyKey) === legacySeed, 'Migration must render results and preserve v1');
    const migratedValue = localStorage.getItem(key);
    await reload();
    assert(localStorage.getItem(key) === migratedValue && localStorage.getItem(legacyKey) === legacySeed, 'Second startup must not import legacy records twice');
    passed.push('real startup migrates v1 once into easy and preserves the legacy key');
    return { passed };
  } finally {
    frame.remove();
    if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous);
    if (previousLegacy === null) localStorage.removeItem(legacyKey); else localStorage.setItem(legacyKey, previousLegacy);
  }
}
