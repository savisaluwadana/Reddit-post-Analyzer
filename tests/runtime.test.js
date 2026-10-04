import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import express from 'express';
import mongoose from 'mongoose';
import { app } from '../server/app.js';
import { createRedditRouter } from '../server/redditRoutes.js';

async function serve(application, run) {
  const server = application.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('readiness reflects the database connection and liveness remains available', async () => {
  await serve(app, async (url) => {
    const original = mongoose.connection.readyState;
    try {
      mongoose.connection.readyState = 0;
      let response = await fetch(`${url}/api/health`);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).ok, false);
      assert.equal((await fetch(`${url}/api/health/live`)).status, 200);
      mongoose.connection.readyState = 1;
      response = await fetch(`${url}/api/health`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).ok, true);
    } finally { mongoose.connection.readyState = original; }
  });
});

test('unknown API routes, malformed JSON and oversized bodies return JSON errors', async () => {
  await serve(app, async (url) => {
    const unknown = await fetch(`${url}/api/missing`, { headers: { Accept: 'text/html' } });
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json()).message, 'API route not found');
    const bad = await fetch(`${url}/api/posts/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad',
    });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).message, 'Request body must be valid JSON');
    const large = await fetch(`${url}/api/posts/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(2 * 1024 * 1024) }),
    });
    assert.equal(large.status, 413);
    assert.match((await large.json()).message, /2 MB/);
  });
});

test('built frontend is served without swallowing missing assets or API paths', {
  skip: !existsSync(new URL('../dist/index.html', import.meta.url)),
}, async () => {
  await serve(app, async (url) => {
    const home = await fetch(url);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /<div id="root"><\/div>/);
    assert.equal((await fetch(`${url}/missing.js`)).status, 404);
  });
});

test('Reddit relay restricts paths and builds fixed-origin feed requests', async () => {
  const calls = [];
  const application = express();
  application.use('/reddit', createRedditRouter({ fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ data: { children: [] } });
  } }));
  await serve(application, async (url) => {
    const response = await fetch(`${url}/reddit/r/webdev/top.json?t=month&limit=30&url=http://localhost`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { children: [] } });
    assert.equal(calls[0].url, 'https://www.reddit.com/r/webdev/top.json?limit=30&raw_json=1&t=month');
    assert.equal(calls[0].options.redirect, 'error');
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.equal((await fetch(`${url}/reddit/comments/abc12.json?limit=10`)).status, 200);
    assert.match(calls[1].url, /sort=top/);
    for (const invalid of ['/r/bad-name/top.json', '/r/webdev/top.json?limit=999', '/r/webdev/top.json?t=bad', '/api/v1/me']) {
      assert.ok([400, 404].includes((await fetch(`${url}/reddit${invalid}`)).status));
    }
    assert.equal(calls.length, 2);
  });
});

test('Reddit rate limits, invalid responses and timeouts remain visible', async () => {
  for (const [fetchImpl, expected] of [
    [async () => new Response('blocked', { status: 429, headers: { 'Retry-After': '60' } }), 429],
    [async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }), 502],
    [async () => { throw new DOMException('timed out', 'TimeoutError'); }, 504],
    [async () => { throw new Error('network unavailable'); }, 502],
  ]) {
    const application = express();
    application.use('/reddit', createRedditRouter({ fetchImpl }));
    await serve(application, async (url) => {
      const response = await fetch(`${url}/reddit/r/webdev/top.json`);
      assert.equal(response.status, expected);
      assert.ok((await response.json()).message);
      if (expected === 429) assert.equal(response.headers.get('retry-after'), '60');
    });
  }
});
