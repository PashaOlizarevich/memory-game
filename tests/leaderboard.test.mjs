import assert from 'node:assert/strict';
import test from 'node:test';
import { createLeaderboardStore } from '../src/storage/leaderboard.js';

const key = 'memory-game.leaderboard.v1';
function useStorage(t, initial = []) {
  const values = new Map(initial);
  const reads = [];
  const writes = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: {
      getItem(name) { reads.push(name); return values.get(name) ?? null; },
      setItem(name, value) { writes.push(name); values.set(name, value); },
    } },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  });
  return { values, reads, writes };
}

test('creation is silent and missing results are loaded once', (t) => {
  const storage = useStorage(t);
  const store = createLeaderboardStore();
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(store.getResults(), { results: [], persistence: 'persistent' });
  assert.deepEqual(store.getResults(), { results: [], persistence: 'persistent' });
  assert.deepEqual(storage.reads, [key]);
  assert.deepEqual(storage.writes, []);
});

test('existing results are read and subsequent reads preserve the session list', (t) => {
  const result = { moves: 8, completedAt: 0 };
  const storage = useStorage(t, [[key, JSON.stringify([result])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults().results, [result]);
  storage.values.set(key, '[]');
  assert.deepEqual(store.getResults().results, [result]);
  assert.deepEqual(storage.reads, [key]);
});

test('adding before the first read preserves loaded records and writes the result schema', (t) => {
  const first = { moves: 8, completedAt: 0 };
  const second = { moves: 9, completedAt: 1000 };
  const storage = useStorage(t, [[key, JSON.stringify([first])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.addResult({ ...second, roundId: 99 }), {
    results: [first, second], persistence: 'persistent',
  });
  assert.deepEqual(JSON.parse(storage.values.get(key)), [first, second]);
  assert.deepEqual(storage.reads, [key]);
  assert.deepEqual(storage.writes, [key]);
});

test('input and returned record mutations cannot alter cached or persisted results', (t) => {
  const storage = useStorage(t);
  const store = createLeaderboardStore();
  const input = { moves: 8, completedAt: 0 };
  const added = store.addResult(input);
  input.moves = 100;
  added.results[0].moves = 200;
  added.results.push({ moves: 300, completedAt: 10 });
  const read = store.getResults();
  read.results[0].completedAt = 123;
  store.addResult({ moves: 9, completedAt: 1000 });
  assert.deepEqual(store.getResults().results, [
    { moves: 8, completedAt: 0 }, { moves: 9, completedAt: 1000 },
  ]);
  assert.deepEqual(JSON.parse(storage.values.get(key)), store.getResults().results);
});

test('a new store reads saved results and unrelated storage keys stay untouched', (t) => {
  const storage = useStorage(t, [['another-app', 'keep this value']]);
  const first = createLeaderboardStore();
  first.addResult({ moves: 8, completedAt: 0 });
  const reloaded = createLeaderboardStore();
  assert.deepEqual(reloaded.getResults(), first.getResults());
  assert.equal(storage.values.get('another-app'), 'keep this value');
  assert.ok(storage.reads.every((name) => name === key));
  assert.ok(storage.writes.every((name) => name === key));
});

test('identical results from distinct finished games are retained', (t) => {
  useStorage(t);
  const store = createLeaderboardStore();
  const result = { moves: 8, completedAt: 0 };
  store.addResult(result);
  assert.deepEqual(store.addResult(result).results, [result, result]);
});
