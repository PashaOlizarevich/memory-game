// This page exercises main.js with a simulated quota failure on the project key.
export async function runMainStorageTests() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const key = 'memory-game.leaderboard.v1';
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  const storage = window.localStorage;
  const previous = originalGet.call(storage, key);
  const seed = JSON.stringify([{ moves: 9, completedAt: 0 }]);
  originalSet.call(storage, key, seed);
  let writes = 0;
  try {
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        writes += 1;
        throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      }
      return originalSet.call(this, name, value);
    };
    await import('../src/main.js');
    const cardButtons = () => [...document.querySelectorAll('.game-card')];
    const complete = () => {
      const groups = Map.groupBy(cardButtons(), (button) => button.dataset.cardId.split(':')[1]);
      for (const pair of groups.values()) pair.forEach((button) => button.click());
    };
    const headerNewGame = document.querySelector('.app-header .button-primary');
    const leaderboard = document.querySelector('.app-header .button-secondary');
    complete();
    assert(document.querySelector('.victory-result').textContent === 'Ходы: 8', 'Quota failure must preserve victory');
    assert(document.querySelector('.modal-persistence'), 'Victory must show the memory warning');
    assert(writes === 1, 'Victory must attempt persistence once');
    document.querySelector('.modal-close').click();
    for (let index = 0; index < 2; index += 1) {
      leaderboard.click();
      assert(document.querySelectorAll('tbody tr').length === 2, 'Memory leaderboard must preserve old and new results');
      assert(document.querySelector('.modal-persistence'), 'Leaderboard must show the memory warning');
      document.querySelector('.modal-close').click();
    }
    headerNewGame.click();
    complete();
    document.querySelector('.modal-close').click();
    leaderboard.click();
    assert(document.querySelectorAll('tbody tr').length === 3, 'Another round must add its result once in memory');
    assert(writes === 1 && originalGet.call(storage, key) === seed, 'Memory mode must not retry or overwrite old storage');
    document.querySelector('.modal-close').click();
    headerNewGame.click();
    assert(cardButtons().every((button) => button.dataset.status === 'closed' && !button.disabled), 'Storage failure must allow immediate new games');
    return { passed: ['actual main victory, repeated rating and new rounds remain usable after quota failure'] };
  } finally {
    Storage.prototype.setItem = originalSet;
    if (previous === null) storage.removeItem(key);
    else originalSet.call(storage, key, previous);
  }
}
