const storageKey = 'memory-game.leaderboard.v1';

function copyResult({ moves, completedAt }) {
  return { moves, completedAt };
}

export function createLeaderboardStore() {
  let results;

  function loadResults() {
    if (results !== undefined) {
      return;
    }

    const storedResults = window.localStorage.getItem(storageKey);
    results = storedResults === null ? [] : JSON.parse(storedResults).map(copyResult);
  }

  function getResults() {
    loadResults();

    return {
      results: results.map(copyResult),
      persistence: 'persistent',
    };
  }

  function addResult(result) {
    loadResults();
    results.push(copyResult(result));
    window.localStorage.setItem(storageKey, JSON.stringify(results));

    return getResults();
  }

  return { getResults, addResult };
}
