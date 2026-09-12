import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalDateInput } from '../src/utils/date.ts';

test('date input parser preserves calendar day and start/end boundaries', () => {
  const start = parseLocalDateInput('2026-09-12');
  const end = parseLocalDateInput('2026-09-12', true);
  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 8);
  assert.equal(start.getDate(), 12);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
});

test('date input parser rejects impossible calendar dates', () => {
  assert.equal(Number.isNaN(parseLocalDateInput('2026-02-31').getTime()), true);
  assert.equal(Number.isNaN(parseLocalDateInput('not-a-date').getTime()), true);
});
