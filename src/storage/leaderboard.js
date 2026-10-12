import { difficulties, getDifficulty } from '../game/difficulty.js';

const storageKey = 'memory-game.leaderboard.v2';
const legacyStorageKey = 'memory-game.leaderboard.v1';
const resultLimit = 10;

function emptyResults() {
  return Object.fromEntries(difficulties.map(({ id }) => [id, []]));
}

function isValidResult(result, difficultyId) {
  const difficulty = difficulties.find(({ id }) => id === difficultyId);
  return difficulty !== undefined
    && result !== null
    && typeof result === 'object'
    && !Array.isArray(result)
    && result.difficultyId === difficultyId
    && Number.isSafeInteger(result.moves)
    && result.moves >= difficulty.pairCount
    && Number.isSafeInteger(result.completedAt)
    && result.completedAt >= 0
    && !Number.isNaN(new Date(result.completedAt).getTime());
}

function copyResult({ difficultyId, moves, completedAt }) {
  return { difficultyId, moves, completedAt };
}

function normalizeResults(results, difficultyId) {
  if (!Array.isArray(results)) return [];
  return results.filter((result) => isValidResult(result, difficultyId))
    .map(copyResult)
    .sort((first, second) => first.moves - second.moves
      || first.completedAt - second.completedAt)
    .slice(0, resultLimit);
}

function parseStored(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function createLeaderboardStore() {
  let results;
  let persistence = 'persistent';

  function saveResults() {
    if (persistence !== 'persistent') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 2, results }));
    } catch {
      persistence = 'memory';
    }
  }

  function loadResults() {
    if (results !== undefined) return;
    results = emptyResults();
    let storedResults;
    try {
      storedResults = window.localStorage.getItem(storageKey);
    } catch {
      persistence = 'memory';
      return;
    }

    if (storedResults !== null) {
      const parsed = parseStored(storedResults);
      if (parsed?.version === 2 && parsed.results !== null
        && typeof parsed.results === 'object' && !Array.isArray(parsed.results)) {
        for (const { id } of difficulties) {
          results[id] = normalizeResults(parsed.results[id], id);
        }
      }
      return;
    }

    let legacy;
    try {
      legacy = parseStored(window.localStorage.getItem(legacyStorageKey));
    } catch {
      persistence = 'memory';
      return;
    }
    if (Array.isArray(legacy)) {
      results.easy = normalizeResults(legacy.map((result) => (
        result !== null && typeof result === 'object' && !Array.isArray(result)
          ? { ...result, difficultyId: 'easy' } : result
      )), 'easy');
    }
    // A complete v2 marker also prevents importing old data on a later launch.
    saveResults();
  }

  function getResults(difficultyId) {
    getDifficulty(difficultyId);
    loadResults();
    return { results: results[difficultyId].map(copyResult), persistence };
  }

  function addResult(result) {
    if (!isValidResult(result, result?.difficultyId)) {
      throw new TypeError('A leaderboard result must contain a known difficultyId, valid moves and completedAt.');
    }
    loadResults();
    results[result.difficultyId] = normalizeResults([...results[result.difficultyId], result], result.difficultyId);
    saveResults();
    return getResults(result.difficultyId);
  }

  return { getResults, addResult };
}
