import assert from 'node:assert/strict';

// Use a dedicated test database. Fixtures are synthetic and removed after the smoke run.
const base = process.env.PAIN_PLATFORM_API_URL || 'http://127.0.0.1:4000';
const batchId = `stack-smoke:${Date.now()}`;
const created = [];
async function request(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${route}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
try {
  assert.equal((await request('/api/health')).database, 'connected');
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /id="root"/);
  const project = await request('/api/projects', { name: batchId, subreddits: ['webdev'] });
  created.push(`/api/projects/${project.project._id}`);
  assert.ok((await request('/api/projects')).projects.some((item) => item._id === project.project._id));
  const evidence = { external_id: batchId, source_kind: 'survey', source_name: 'Synthetic stack smoke',
    text: 'Synthetic test fixture: I waste three hours a week manually copying invoices and need to automate the process.',
    tags: ['synthetic', batchId], metadata: { root_url: 'https://example.invalid/synthetic-smoke' } };
  const ingested = await request('/api/evidence/bulk', { items: [evidence, evidence] });
  assert.equal(ingested.processedCount, 1);
  assert.equal(ingested.duplicateInputCount, 1);
  const stored = await request(`/api/evidence?tags=${encodeURIComponent(batchId)}`);
  assert.equal(stored.count, 1);
  created.push(`/api/evidence/${stored.items[0]._id || stored.items[0].id}`);
  assert.ok((await request('/api/evidence/analyze', { tags: [batchId] })).report);
  const job = await request('/api/research-jobs', { name: batchId, topic: 'Synthetic smoke job' });
  created.push(`/api/research-jobs/${job.job._id}`);
  assert.equal((await request(`/api/research-jobs/${job.job._id}`)).job.status, 'queued');
  console.log('Built frontend, readiness, Mongo-backed project/evidence storage, deduplication, analysis and job persistence passed.');
} finally {
  for (const route of created.reverse()) await request(route, undefined, 'DELETE');
}
