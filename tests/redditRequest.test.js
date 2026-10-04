import test from 'node:test';
import assert from 'node:assert/strict';
import { requestRedditJson } from '../src/utils/redditRequest.ts';

test('browser Reddit request surfaces JSON errors and rejects HTML fallbacks', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Rate limited' }, { status: 429 }));
  await assert.rejects(requestRedditJson('/reddit/r/webdev/top.json'), /Rate limited/);
  globalThis.fetch.mock.mockImplementation(async () => new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(requestRedditJson('/reddit/r/webdev/top.json'), /did not return JSON/);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ data: { children: [] } }));
  assert.deepEqual(await requestRedditJson('/reddit/r/webdev/top.json'), { data: { children: [] } });
});
