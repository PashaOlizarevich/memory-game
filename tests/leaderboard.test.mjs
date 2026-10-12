import assert from 'node:assert/strict';
import test from 'node:test';
import { createLeaderboardStore } from '../src/storage/leaderboard.js';

const key = 'memory-game.leaderboard.v2';
const legacyKey = 'memory-game.leaderboard.v1';
const encode = (easy) => JSON.stringify({ version: 2, results: { easy, medium: [], hard: [], expert: [] } });
const decode = (raw) => JSON.parse(raw).results.easy;
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
  assert.deepEqual(store.getResults('easy'), { results: [], persistence: 'persistent' });
  assert.deepEqual(store.getResults('easy'), { results: [], persistence: 'persistent' });
  assert.deepEqual(storage.reads, [key, legacyKey]);
  assert.deepEqual(storage.writes, [key]);
});

test('existing results are read and subsequent reads preserve the session list', (t) => {
  const result = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  const storage = useStorage(t, [[key, encode([result])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults('easy').results, [result]);
  storage.values.set(key, '[]');
  assert.deepEqual(store.getResults('easy').results, [result]);
  assert.deepEqual(storage.reads, [key]);
});

test('adding before the first read preserves loaded records and writes the result schema', (t) => {
  const first = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  const second = { difficultyId: 'easy', moves: 9, completedAt: 1000 };
  const storage = useStorage(t, [[key, encode([first])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.addResult({ ...second, roundId: 99 }), {
    results: [first, second], persistence: 'persistent',
  });
  assert.deepEqual(decode(storage.values.get(key)), [first, second]);
  assert.deepEqual(storage.reads, [key]);
  assert.deepEqual(storage.writes, [key]);
});

test('input and returned record mutations cannot alter cached or persisted results', (t) => {
  const storage = useStorage(t);
  const store = createLeaderboardStore();
  const input = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  const added = store.addResult(input);
  input.moves = 100;
  added.results[0].moves = 200;
  added.results.push({ difficultyId: 'easy', moves: 300, completedAt: 10 });
  const read = store.getResults('easy');
  read.results[0].completedAt = 123;
  store.addResult({ difficultyId: 'easy', moves: 9, completedAt: 1000 });
  assert.deepEqual(store.getResults('easy').results, [
    { difficultyId: 'easy', moves: 8, completedAt: 0 }, { difficultyId: 'easy', moves: 9, completedAt: 1000 },
  ]);
  assert.deepEqual(decode(storage.values.get(key)), store.getResults('easy').results);
});

test('a new store reads saved results and unrelated storage keys stay untouched', (t) => {
  const storage = useStorage(t, [['another-app', 'keep this value']]);
  const first = createLeaderboardStore();
  first.addResult({ difficultyId: 'easy', moves: 8, completedAt: 0 });
  const reloaded = createLeaderboardStore();
  assert.deepEqual(reloaded.getResults('easy'), first.getResults('easy'));
  assert.equal(storage.values.get('another-app'), 'keep this value');
  assert.ok(storage.reads.every((name) => [key, legacyKey].includes(name)));
  assert.ok(storage.writes.every((name) => name === key));
});

test('identical results from distinct finished games are retained', (t) => {
  useStorage(t);
  const store = createLeaderboardStore();
  const result = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  store.addResult(result);
  assert.deepEqual(store.addResult(result).results, [result, result]);
});

test('malformed JSON and invalid envelopes load as empty rankings without rewriting storage', (t) => {
  const storage = useStorage(t);
  for (const raw of ['{broken', '', 'null', '{}', '42', '"text"', 'true']) {
    storage.values.set(key, raw);
    assert.deepEqual(createLeaderboardStore().getResults('easy'), { results: [], persistence: 'persistent' });
    assert.equal(storage.values.get(key), raw);
  }
  assert.deepEqual(storage.writes, []);
});

test('loading filters invalid records, accepts valid bounds and strips extra fields', (t) => {
  const valid = [
    { difficultyId: 'easy', moves: 8, completedAt: 0, roundId: 123 },
    { difficultyId: 'easy', moves: Number.MAX_SAFE_INTEGER, completedAt: 8640000000000000 },
  ];
  const invalid = [null, [], {}, 4, 'result',
    { difficultyId: 'easy', moves: 7, completedAt: 0 }, { difficultyId: 'easy', moves: 8.5, completedAt: 0 },
    { difficultyId: 'easy', moves: '8', completedAt: 0 }, { difficultyId: 'easy', moves: Number.MAX_SAFE_INTEGER + 1, completedAt: 0 },
    { difficultyId: 'easy', moves: 8, completedAt: -1 }, { difficultyId: 'easy', moves: 8, completedAt: 0.5 },
    { difficultyId: 'easy', moves: 8, completedAt: '0' }, { difficultyId: 'easy', moves: 8, completedAt: null },
    { difficultyId: 'easy', moves: 8, completedAt: 8640000000000001 },
  ];
  useStorage(t, [[key, encode([...invalid, ...valid])]]);
  assert.deepEqual(createLeaderboardStore().getResults('easy').results, [
    { difficultyId: 'easy', moves: 8, completedAt: 0 },
    { difficultyId: 'easy', moves: Number.MAX_SAFE_INTEGER, completedAt: 8640000000000000 },
  ]);
});

test('results sort by moves then completion time and keep equal records', (t) => {
  useStorage(t, [[key, encode([
    { difficultyId: 'easy', moves: 9, completedAt: 50 }, { difficultyId: 'easy', moves: 8, completedAt: 300 },
    { difficultyId: 'easy', moves: 8, completedAt: 100 }, { difficultyId: 'easy', moves: 8, completedAt: 100 },
    { difficultyId: 'easy', moves: 8, completedAt: 200 },
  ])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults('easy').results, [
    { difficultyId: 'easy', moves: 8, completedAt: 100 }, { difficultyId: 'easy', moves: 8, completedAt: 100 },
    { difficultyId: 'easy', moves: 8, completedAt: 200 }, { difficultyId: 'easy', moves: 8, completedAt: 300 },
    { difficultyId: 'easy', moves: 9, completedAt: 50 },
  ]);
  assert.deepEqual(store.addResult({ difficultyId: 'easy', moves: 8, completedAt: 0 }).results[0], { difficultyId: 'easy', moves: 8, completedAt: 0 });
});

test('loading a larger leaderboard returns only its ten best records', (t) => {
  const source = Array.from({ length: 12 }, (_, index) => ({ difficultyId: 'easy', moves: 19 - index, completedAt: index }));
  const storage = useStorage(t, [[key, encode(source)]]);
  assert.deepEqual(createLeaderboardStore().getResults('easy').results, source.slice(2).reverse());
  assert.deepEqual(storage.writes, []);
});

test('adding a better or worse result keeps ten records in memory and storage', (t) => {
  const source = Array.from({ length: 10 }, (_, index) => ({ difficultyId: 'easy', moves: 10 + index, completedAt: index }));
  const storage = useStorage(t, [[key, encode(source)]]);
  const store = createLeaderboardStore();
  const better = { difficultyId: 'easy', moves: 8, completedAt: 1000 };
  const expected = [better, ...source.slice(0, 9)];
  assert.deepEqual(store.addResult(better).results, expected);
  assert.deepEqual(decode(storage.values.get(key)), expected);
  assert.deepEqual(store.addResult({ difficultyId: 'easy', moves: 100, completedAt: 0 }).results, expected);
  assert.deepEqual(decode(storage.values.get(key)), expected);
});

test('invalid additions are rejected before reading, writing or changing valid results', (t) => {
  const valid = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  const storage = useStorage(t, [[key, encode([valid])]]);
  const store = createLeaderboardStore();
  const invalid = [undefined, null, [], {}, 'result',
    { difficultyId: 'easy', moves: 7, completedAt: 0 }, { difficultyId: 'easy', moves: 8.1, completedAt: 0 },
    { difficultyId: 'easy', moves: NaN, completedAt: 0 }, { difficultyId: 'easy', moves: Infinity, completedAt: 0 },
    { difficultyId: 'easy', moves: Number.MAX_SAFE_INTEGER + 1, completedAt: 0 },
    { difficultyId: 'easy', moves: 8, completedAt: -1 }, { difficultyId: 'easy', moves: 8, completedAt: NaN },
    { difficultyId: 'easy', moves: 8, completedAt: Infinity }, { difficultyId: 'easy', moves: 8, completedAt: '0' },
    { difficultyId: 'easy', moves: 8, completedAt: 8640000000000001 },
  ];
  for (const value of invalid) assert.throws(() => store.addResult(value), TypeError);
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(store.getResults('easy').results, [valid]);
  for (const value of invalid) assert.throws(() => store.addResult(value), TypeError);
  assert.deepEqual(store.getResults('easy').results, [valid]);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(decode(storage.values.get(key)), [valid]);
});

test('localStorage access denial switches to memory once and never retries', (t) => {
  const storage = useStorage(t);
  let attempts = 0;
  const available = window.localStorage;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { attempts += 1; throw new Error('Storage access denied'); },
  });
  const store = createLeaderboardStore();
  assert.equal(attempts, 0);
  assert.deepEqual(store.getResults('easy'), { results: [], persistence: 'memory' });
  Object.defineProperty(window, 'localStorage', { configurable: true, value: available });
  assert.deepEqual(store.addResult({ difficultyId: 'easy', moves: 8, completedAt: 0 }), {
    results: [{ difficultyId: 'easy', moves: 8, completedAt: 0 }], persistence: 'memory',
  });
  assert.equal(store.getResults('easy').persistence, 'memory');
  assert.equal(attempts, 1);
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(storage.writes, []);
});

test('read failure allows immediate additions and does not replace memory with old storage', (t) => {
  const storage = useStorage(t, [[key, encode([{ difficultyId: 'easy', moves: 100, completedAt: 10 }])]]);
  const originalRead = window.localStorage.getItem;
  let attempts = 0;
  window.localStorage.getItem = () => { attempts += 1; throw new Error('Read failed'); };
  const store = createLeaderboardStore();
  assert.deepEqual(store.addResult({ difficultyId: 'easy', moves: 8, completedAt: 0 }), {
    results: [{ difficultyId: 'easy', moves: 8, completedAt: 0 }], persistence: 'memory',
  });
  window.localStorage.getItem = originalRead;
  store.addResult({ difficultyId: 'easy', moves: 9, completedAt: 1 });
  assert.deepEqual(store.getResults('easy').results, [{ difficultyId: 'easy', moves: 8, completedAt: 0 }, { difficultyId: 'easy', moves: 9, completedAt: 1 }]);
  assert.equal(attempts, 1);
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(storage.writes, []);
});

test('write failure retains loaded and new results with top-ten normalization and independent copies', (t) => {
  const old = { difficultyId: 'easy', moves: 20, completedAt: 0 };
  const storage = useStorage(t, [[key, encode([old])]]);
  const originalWrite = window.localStorage.setItem;
  let attempts = 0;
  window.localStorage.setItem = () => { attempts += 1; throw new Error('Quota exceeded'); };
  const store = createLeaderboardStore();
  const newResult = { difficultyId: 'easy', moves: 8, completedAt: 0 };
  const added = store.addResult(newResult);
  assert.deepEqual(added, { results: [newResult, old], persistence: 'memory' });
  newResult.moves = 1000;
  added.results[0].moves = 2000;
  window.localStorage.setItem = originalWrite;
  for (let moves = 9; moves <= 19; moves += 1) store.addResult({ difficultyId: 'easy', moves, completedAt: moves });
  assert.deepEqual(store.getResults('easy').results.map((result) => result.moves), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(store.getResults('easy').persistence, 'memory');
  assert.throws(() => store.addResult({ difficultyId: 'easy', moves: 7, completedAt: 0 }), TypeError);
  assert.equal(store.getResults('easy').results.length, 10);
  assert.equal(attempts, 1);
  assert.deepEqual(storage.reads, [key]);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(decode(storage.values.get(key)), [old]);
});

test('access denial during a write preserves the successfully loaded session', (t) => {
  const old = { difficultyId: 'easy', moves: 9, completedAt: 100 };
  const storage = useStorage(t, [[key, encode([old])]]);
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults('easy').results, [old]);
  let attempts = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { attempts += 1; throw new Error('Access revoked'); },
  });
  assert.deepEqual(store.addResult({ difficultyId: 'easy', moves: 8, completedAt: 0 }), {
    results: [{ difficultyId: 'easy', moves: 8, completedAt: 0 }, old], persistence: 'memory',
  });
  assert.equal(store.getResults('easy').persistence, 'memory');
  assert.equal(attempts, 1);
  assert.deepEqual(storage.writes, []);
});

for (const [difficultyId, pairCount] of [['easy', 8], ['medium', 12], ['hard', 16], ['expert', 20]]) {
  test(difficultyId + ': independent top ten accepts its minimum and rejects fewer moves', (t) => {
    const storage = useStorage(t, [[key, encode([])]]);
    const store = createLeaderboardStore();
    assert.throws(() => store.addResult({ difficultyId, moves: pairCount - 1, completedAt: 0 }), TypeError);
    assert.deepEqual(storage.reads, []);
    for (let index = 12; index >= 0; index -= 1) {
      store.addResult({ difficultyId, moves: pairCount + index, completedAt: index });
    }
    const expected = Array.from({ length: 10 }, (_, index) => ({ difficultyId, moves: pairCount + index, completedAt: index }));
    assert.deepEqual(store.getResults(difficultyId).results, expected);
    const saved = JSON.parse(storage.values.get(key));
    assert.equal(saved.version, 2);
    assert.deepEqual(Object.keys(saved.results), ['easy', 'medium', 'hard', 'expert']);
    for (const id of Object.keys(saved.results)) {
      assert.deepEqual(saved.results[id], id === difficultyId ? expected : []);
      assert.deepEqual(createLeaderboardStore().getResults(id).results, saved.results[id]);
    }
  });
}

test('unknown or missing difficulty IDs reject before storage and preserve all rankings', (t) => {
  const storage = useStorage(t, [[key, encode([])]]);
  const store = createLeaderboardStore();
  for (const id of [undefined, null, '', 'unknown', '__proto__', 'toString', 1]) {
    assert.throws(() => store.getResults(id), RangeError);
    assert.throws(() => store.addResult({ difficultyId: id, moves: 100, completedAt: 0 }), TypeError);
  }
  assert.deepEqual(storage.reads, []);
  assert.deepEqual(storage.writes, []);
  store.addResult({ difficultyId: 'hard', moves: 16, completedAt: 0 });
  assert.throws(() => store.addResult({ difficultyId: 'hard', moves: 15, completedAt: 0 }), TypeError);
  assert.deepEqual(store.getResults('hard').results, [{ difficultyId: 'hard', moves: 16, completedAt: 0 }]);
  assert.deepEqual(store.getResults('easy').results, []);
});

test('v2 validates the envelope, partition membership and minimum moves independently', (t) => {
  const source = { version: 2, results: {
    easy: [{ difficultyId: 'easy', moves: 8, completedAt: 0 }, { difficultyId: 'medium', moves: 12, completedAt: 0 }],
    medium: [{ difficultyId: 'medium', moves: 11, completedAt: 0 }, { difficultyId: 'medium', moves: 12, completedAt: 0, extra: true }],
    hard: 'broken', expert: [null, { difficultyId: 'expert', moves: 20, completedAt: 1 }], unknown: [{ moves: 8, completedAt: 0 }],
  } };
  const storage = useStorage(t, [[key, JSON.stringify(source)]]);
  const store = createLeaderboardStore();
  for (const [id, moves] of [['easy', 8], ['medium', 12], ['expert', 20]]) {
    assert.deepEqual(store.getResults(id).results, [{ difficultyId: id, moves, completedAt: id === 'expert' ? 1 : 0 }]);
  }
  assert.deepEqual(store.getResults('hard').results, []);
  assert.deepEqual(storage.writes, []);
  for (const bad of [{ version: 1, results: source.results }, { version: 2, results: [] }, { version: 2 }, []]) {
    storage.values.set(key, JSON.stringify(bad));
    assert.deepEqual(createLeaderboardStore().getResults('easy').results, []);
  }
});

test('v1 migrates only valid legacy results to easy, keeps v1 and never imports twice', (t) => {
  const legacy = [{ moves: 10, completedAt: 2 }, { moves: 8, completedAt: 0, roundId: 3 },
    { moves: 8, completedAt: 0 }, { moves: 7, completedAt: 0 }, null, [], { moves: 8, completedAt: -1 }];
  const raw = JSON.stringify(legacy);
  const storage = useStorage(t, [[legacyKey, raw], ['another-app', 'preserve']]);
  const expected = [{ difficultyId: 'easy', moves: 8, completedAt: 0 },
    { difficultyId: 'easy', moves: 8, completedAt: 0 }, { difficultyId: 'easy', moves: 10, completedAt: 2 }];
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults('easy').results, expected);
  assert.deepEqual(storage.reads, [key, legacyKey]);
  assert.deepEqual(storage.writes, [key]);
  assert.equal(storage.values.get(legacyKey), raw);
  assert.equal(storage.values.get('another-app'), 'preserve');
  for (const id of ['medium', 'hard', 'expert']) assert.deepEqual(store.getResults(id).results, []);
  assert.deepEqual(createLeaderboardStore().getResults('easy').results, expected);
  assert.deepEqual(storage.reads, [key, legacyKey, key]);
  assert.deepEqual(storage.writes, [key]);
});

test('legacy migration applies stable sorting and the ten-result limit', (t) => {
  const legacy = Array.from({ length: 12 }, (_, index) => ({ moves: 19 - index, completedAt: index }));
  const storage = useStorage(t, [[legacyKey, JSON.stringify(legacy)]]);
  const expected = legacy.slice(2).reverse().map((result) => ({ difficultyId: 'easy', ...result }));
  assert.deepEqual(createLeaderboardStore().getResults('easy').results, expected);
  assert.deepEqual(decode(storage.values.get(key)), expected);
});

test('existing damaged v2 does not reimport legacy data and can save fresh results', (t) => {
  const storage = useStorage(t, [[legacyKey, JSON.stringify([{ moves: 8, completedAt: 0 }])]]);
  for (const raw of ['', '{broken', 'null', '{}', '[]', '{"version":1,"results":{}}']) {
    storage.values.set(key, raw);
    assert.deepEqual(createLeaderboardStore().getResults('easy').results, []);
  }
  assert.ok(storage.reads.every((name) => name === key));
  assert.deepEqual(storage.writes, []);
  const store = createLeaderboardStore();
  store.addResult({ difficultyId: 'expert', moves: 20, completedAt: 0 });
  assert.deepEqual(createLeaderboardStore().getResults('easy').results, []);
  assert.equal(createLeaderboardStore().getResults('expert').results.length, 1);
});

test('malformed or absent legacy data creates an empty complete v2 marker', (t) => {
  const storage = useStorage(t);
  for (const legacy of [null, '{broken', 'null', '{}', '42', '[]']) {
    storage.values.delete(key);
    if (legacy === null) storage.values.delete(legacyKey);
    else storage.values.set(legacyKey, legacy);
    assert.deepEqual(createLeaderboardStore().getResults('easy').results, []);
    assert.deepEqual(JSON.parse(storage.values.get(key)), { version: 2, results: { easy: [], medium: [], hard: [], expert: [] } });
    assert.equal(storage.values.get(legacyKey) ?? null, legacy);
  }
});

test('failed migration write keeps imported and new results across every level without retry', (t) => {
  const legacy = JSON.stringify([{ moves: 9, completedAt: 0 }]);
  const storage = useStorage(t, [[legacyKey, legacy]]);
  let attempts = 0;
  const originalWrite = window.localStorage.setItem;
  window.localStorage.setItem = () => { attempts += 1; throw new Error('Quota'); };
  const store = createLeaderboardStore();
  assert.deepEqual(store.getResults('easy'), { results: [{ difficultyId: 'easy', moves: 9, completedAt: 0 }], persistence: 'memory' });
  window.localStorage.setItem = originalWrite;
  for (const [id, moves] of [['easy', 8], ['medium', 12], ['hard', 16], ['expert', 20]]) {
    store.addResult({ difficultyId: id, moves, completedAt: 1 });
    const view = store.getResults(id);
    assert.equal(view.persistence, 'memory');
    assert.equal(view.results[0].moves, moves);
  }
  assert.equal(store.getResults('easy').results.length, 2);
  assert.equal(attempts, 1);
  assert.deepEqual(storage.reads, [key, legacyKey]);
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.values.has(key), false);
  assert.equal(storage.values.get(legacyKey), legacy);
});

test('failure reading legacy switches all levels to coherent memory without retry', (t) => {
  const storage = useStorage(t);
  const originalRead = window.localStorage.getItem;
  let failures = 0;
  window.localStorage.getItem = (name) => {
    if (name === legacyKey) { failures += 1; throw new Error('Legacy read denied'); }
    return originalRead(name);
  };
  const store = createLeaderboardStore();
  store.addResult({ difficultyId: 'hard', moves: 16, completedAt: 0 });
  window.localStorage.getItem = originalRead;
  assert.deepEqual(store.getResults('hard'), { results: [{ difficultyId: 'hard', moves: 16, completedAt: 0 }], persistence: 'memory' });
  assert.deepEqual(store.getResults('easy'), { results: [], persistence: 'memory' });
  assert.equal(failures, 1);
  assert.deepEqual(storage.reads, [key]);
  assert.deepEqual(storage.writes, []);
});

test('interleaved additions persist every ranking without replacing the others', (t) => {
  const storage = useStorage(t, [[key, encode([])]]);
  const store = createLeaderboardStore();
  const records = [
    { difficultyId: 'medium', moves: 13, completedAt: 2 },
    { difficultyId: 'easy', moves: 8, completedAt: 0 },
    { difficultyId: 'expert', moves: 20, completedAt: 0 },
    { difficultyId: 'hard', moves: 16, completedAt: 0 },
    { difficultyId: 'medium', moves: 12, completedAt: 3 },
  ];
  records.forEach((record) => store.addResult(record));
  const reloaded = createLeaderboardStore();
  const expected = { easy: [records[1]], medium: [records[4], records[0]], hard: [records[3]], expert: [records[2]] };
  assert.deepEqual(JSON.parse(storage.values.get(key)), { version: 2, results: expected });
  for (const id of Object.keys(expected)) assert.deepEqual(reloaded.getResults(id).results, expected[id]);
});
