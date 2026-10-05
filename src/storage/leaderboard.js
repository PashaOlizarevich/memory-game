const storageKey = 'memory-game.leaderboard.v1';
const resultLimit = 10;

function isValidResult(result) {
  return result !== null
    && typeof result === 'object'
    && !Array.isArray(result)
    && Number.isSafeInteger(result.moves)
    && result.moves >= 8
    && Number.isSafeInteger(result.completedAt)
    && result.completedAt >= 0
    && !Number.isNaN(new Date(result.completedAt).getTime());
}

function copyResult({ moves, completedAt }) {
  return { moves, completedAt };
}

function normalizeResults(results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .filter(isValidResult)
    .map(copyResult)
    .sort((first, second) => first.moves - second.moves
      || first.completedAt - second.completedAt)
    .slice(0, resultLimit);
}

export function createLeaderboardStore() {
  let results;

  function loadResults() {
    if (results !== undefined) {
      return;
    }

    const storedResults = window.localStorage.getItem(storageKey);
    let parsedResults;

    try {
      parsedResults = JSON.parse(storedResults);
    } catch {
      parsedResults = [];
    }

    results = normalizeResults(parsedResults);
  }

  function getResults() {
    loadResults();

    return {
      results: results.map(copyResult),
      persistence: 'persistent',
    };
  }

  function addResult(result) {
    if (!isValidResult(result)) {
      throw new TypeError('A leaderboard result must contain valid moves and completedAt.');
    }

    loadResults();
    results = normalizeResults([...results, result]);
    window.localStorage.setItem(storageKey, JSON.stringify(results));

    return getResults();
  }

  return { getResults, addResult };
}
