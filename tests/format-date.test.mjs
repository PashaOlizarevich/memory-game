import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { formatDate } from '../src/utils/format-date.js';

test('local date has padded day and month and no time', () => {
  assert.equal(formatDate(new Date(2024, 0, 2, 12, 34, 56).getTime()), '02.01.2024');
  assert.equal(formatDate(new Date(2024, 1, 29, 12).getTime()), '29.02.2024');
});

// Independent processes exercise the runtime's actual local timezone.
const cases = [
  { zone: 'UTC', times: [0, Date.UTC(2024, 1, 29, 23, 59)], dates: ['01.01.1970', '29.02.2024'] },
  { zone: 'Europe/Minsk', times: [Date.UTC(2024, 0, 1, 22, 30)], dates: ['02.01.2024'] },
  { zone: 'America/Los_Angeles', times: [Date.UTC(2024, 0, 1, 1, 30)], dates: ['31.12.2023'] },
  { zone: 'America/New_York', times: [Date.UTC(2024, 2, 10, 4, 30), Date.UTC(2024, 2, 10, 7, 30)], dates: ['09.03.2024', '10.03.2024'] },
  { zone: 'Pacific/Kiritimati', times: [Date.UTC(2024, 11, 31, 12, 30)], dates: ['01.01.2025'] },
];
const formatterUrl = new URL('../src/utils/format-date.js', import.meta.url).href;
for (const { zone, times, dates } of cases) {
  test(`timestamps use local calendar dates in ${zone}`, () => {
    const source = `import { formatDate } from ${JSON.stringify(formatterUrl)};
      process.stdout.write(JSON.stringify(${JSON.stringify(times)}.map(formatDate)));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), dates);
  });
}
