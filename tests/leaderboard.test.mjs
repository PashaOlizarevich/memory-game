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

test('malformed JSON and non-array values load as an empty list without rewriting storage', (t) => {
  const storage = useStorage(t);
  for (const raw of ['{broken', '', 'null', '{}', '42', '"text"', 'true']) {
    storage.values.set(key, raw);
    assert.deepEqual(createLeaderboardStore().getResults(), { results: [], persistence: 'persistent' });
    assert.equal(storage.values.get(key), raw);
  }
  assert.deepEqual(storage.writes, []);
});

test('loading filters invalid records, accepts valid bounds and strips extra fields', (t) => {
  const valid = [
    { moves: 8, completedAt: 0, roundId: 123 },
    { moves: Number.MAX_SAFE_INTEGER, completedAt: 8640000000000000 },
  ];
  const invalid = [null, [], {}, 4, 'result',
    { moves: 7, completedAt: 0 }, { moves: 8.5, completedAt: 0 },
    { moves: '8', completedAt: 0 }, { moves: Number.MAX_SAFE_INTEGER + 1, completedAt: 0 },
    { moves: 8, completedAt: -1 }, { moves: 8, completedAt: 0.5 },
    { moves: 8, completedAt: '0' }, { moves: 8, completedAt: null },
    { moves: 8, completedAt: 8640000000000001 },
  ];
  useStorage(t, [[key, JSON.stringify([...invalid, ...valid])]]);
  assert.deepEqual(createLeaderboardStore().getResults().results, [
    { moves: 8, completedAt: 0 },
    { moves: Number.MAX_SAFE_INTEGER, completedAt: 8640000000000000 },
  ]);
});

test('results sort by moves then completion time and keep equal records', (t) => {
  useStorage(t, [[key, JSON.stringify([
    { moves: 9, completedAt: 50 }, { moves: 8, completedAt: 300 },
    { moves: 8, completedAt: 100 }, { moves: 8, completedAt: 100 },
    { moves: 8, completedAt: 200 },
  ])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults().results, [
    { moves: 8, completedAt: 100 }, { moves: 8, completedAt: 100 },
    { moves: 8, completedAt: 200 }, { moves: 8, completedAt: 300 },
    { moves: 9, completedAt: 50 },
  ]);
  assert.deepEqual(store.addResult({ moves: 8, completedAt: 0 }).results[0], { moves: 8, completedAt: 0 });
});

test('loading a larger leaderboard returns only its ten best records', (t) => {
  const source = Array.from({ length: 12 }, (_, index) => ({ moves: 19 - index, completedAt: index }));
  const storage = useStorage(t, [[key, JSON.stringify(source)]]);
  assert.deepEqual(createLeaderboardStore().getResults().results, source.slice(2).reverse());
  assert.deepEqual(storage.writes, []);
});

test('adding a better or worse result keeps ten records in memory and storage', (t) => {
  const source = Array.from({ length: 10 }, (_, index) => ({ moves: 10 + index, completedAt: index }));
  const storage = useStorage(t, [[key, JSON.stringify(source)]]);
  const store = createLeaderboardStore();
  const better = { moves: 8, completedAt: 1000 };
  const expected = [better, ...source.slice(0, 9)];
  assert.deepEqual(store.addResult(better).results, expected);
  assert.deepEqual(JSON.parse(storage.values.get(key)), expected);
  assert.deepEqual(store.addResult({ moves: 100, completedAt: 0 }).results, expected);
  assert.deepEqual(JSON.parse(storage.values.get(key)), expected);
});

test('invalid additions are rejected before reading, writing or changing valid results', (t) => {
  const valid = { moves: 8, completedAt: 0 };
  const storage = useStorage(t, [[key, JSON.stringify([valid])]]);
  const store = createLeaderboardStore();
  const invalid = [undefined, null, [], {}, 'result',
    { moves: 7, completedAt: 0 }, { moves: 8.1, completedAt: 0 },
    { moves: NaN, completedAt: 0 }, { moves: Infinity, completedAt: 0 },
    { moves: Number.MAX_SAFE_INTEGER + 1, completedAt: 0 },
    { moves: 8, completedAt: -1 }, { moves: 8, completedAt: NaN },
    { moves: 8, completedAt: Infinity }, { moves: 8, completedAt: '0' },
    { moves: 8, completedAt: 8640000000000001 },
  ];
  for (const value of invalid) assert.throws(() => store.addResult(value), TypeError);
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(store.getResults().results, [valid]);
  for (const value of invalid) assert.throws(() => store.addResult(value), TypeError);
  assert.deepEqual(store.getResults().results, [valid]);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(JSON.parse(storage.values.get(key)), [valid]);
});
