const candidateSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['url'],
  properties: {
    url: { type: 'string' },
    root_url: { type: 'string' },
    source_kind: { type: 'string' },
    depth: { type: 'integer', minimum: 0, maximum: 100 },
    title: { type: 'string' },
    anchor_text: { type: 'string' },
    snippet: { type: 'string' },
    context: { type: 'string' },
    relevance_score: { type: 'number', minimum: 0, maximum: 100 },
    first_hand_likelihood: { type: 'number', minimum: 0, maximum: 100 },
    evidence_yield_likelihood: { type: 'number', minimum: 0, maximum: 100 },
    novelty_score: { type: 'number', minimum: 0, maximum: 100 },
    recency_score: { type: 'number', minimum: 0, maximum: 100 },
    commercial_signal_likelihood: { type: 'number', minimum: 0, maximum: 100 },
    contradiction_likelihood: { type: 'number', minimum: 0, maximum: 100 },
    source_trust: { type: 'number', minimum: 0, maximum: 100 },
    duplicate_risk: { type: 'number', minimum: 0, maximum: 100 },
    access_cost: { type: 'number', minimum: 0, maximum: 100 },
    is_branch: { type: 'boolean' },
  },
};

const policySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    max_pages: { type: 'integer', minimum: 5, maximum: 1000 },
    evidence_target: { type: 'integer', minimum: 1, maximum: 5000 },
    min_marginal_yield: { type: 'number', minimum: 0, maximum: 20 },
    max_duplicate_rate: { type: 'number', minimum: 0, maximum: 1 },
    max_blocked_share: { type: 'number', minimum: 0, maximum: 1 },
    max_per_host: { type: 'integer', minimum: 1, maximum: 50 },
  },
};

export const scrapeIntelligenceTools = [
  {
    name: 'get_source_scrape_contract',
    description: 'Get source-specific traversal, extraction, provenance, pagination, security and stop rules before deep-scraping a public Reddit/forum/GitHub/review/support/social/web page.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { source_kind: { type: 'string' }, url: { type: 'string' } },
    },
  },
  {
    name: 'start_scrape_session',
    description: 'Start or update the adaptive crawl session for a research job. This stores page budgets, evidence targets, duplicate/access saturation thresholds and host caps.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id'],
      properties: { job_id: { type: 'string' }, policy: policySchema },
    },
  },
  {
    name: 'add_scrape_candidates',
    description: 'Submit public URLs discovered by search or page traversal. The platform canonicalizes, deduplicates and ranks them by relevance, first-hand likelihood, expected evidence yield, novelty, commercial/counter-evidence value, source trust, depth and access cost.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id', 'candidates'],
      properties: {
        job_id: { type: 'string' }, objective: { type: 'string' }, query: { type: 'string' },
        candidates: { type: 'array', minItems: 1, maxItems: 300, items: candidateSchema },
      },
    },
  },
  {
    name: 'get_next_scrape_batch',
    description: 'Get the highest-information public URLs to browse next for a research job while respecting canonical dedup, host caps, depth budgets and adaptive stop rules.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id'],
      properties: { job_id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 30 } },
    },
  },
  {
    name: 'record_scrape_page_result',
    description: 'Record one browsed page with extraction quality, evidence yield, duplicate yield, access boundary state and newly discovered public links. The crawl session automatically decides whether to continue or stop.',
    inputSchema: {
      type: 'object', additionalProperties: true, required: ['job_id', 'url'],
      properties: {
        job_id: { type: 'string' }, url: { type: 'string' }, canonical_url: { type: 'string' }, root_url: { type: 'string' },
        source_kind: { type: 'string' }, depth: { type: 'integer', minimum: 0, maximum: 100 },
        status_code: { type: 'integer' }, content_type: { type: 'string' }, robots_allowed: { type: 'boolean' }, requires_login: { type: 'boolean' }, paywalled: { type: 'boolean' }, rate_limited: { type: 'boolean' }, bot_challenge: { type: 'boolean' },
        text: { type: 'string' }, author: { type: 'string' }, published_at: { type: 'string' }, first_hand: { type: 'boolean' }, parent_context: { type: 'string' }, thread_context: { type: 'string' },
        claim_count: { type: 'integer', minimum: 0 }, claims: { type: 'array', items: { type: 'object', additionalProperties: true } },
        evidence_added: { type: 'integer', minimum: 0 }, duplicate_evidence: { type: 'integer', minimum: 0 },
        resolution_captured: { type: 'boolean' }, contradiction_captured: { type: 'boolean' }, commercial_captured: { type: 'boolean' },
        discovered_candidates: { type: 'array', maxItems: 250, items: candidateSchema }, notes: { type: 'string' },
      },
    },
  },
  {
    name: 'get_scrape_session_summary',
    description: 'Get crawl frontier, yield, extraction quality, duplicate rate, blocked share, candidate-host diversity and the current adaptive stop decision for a research job.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['job_id'], properties: { job_id: { type: 'string' } } },
  },
  {
    name: 'reopen_scrape_session',
    description: 'Explicitly reopen a stopped crawl session, optionally with a new budget. Use only when the research objective changed or a known high-value gap justifies more public browsing.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['job_id'], properties: { job_id: { type: 'string' }, policy: policySchema } },
  },
];

export async function callScrapeIntelligenceTool(name, args, requestJson) {
  const jobId = args?.job_id ? encodeURIComponent(args.job_id) : '';

  if (name === 'get_source_scrape_contract') {
    const params = new URLSearchParams();
    if (args.source_kind) params.set('sourceKind', args.source_kind);
    if (args.url) params.set('url', args.url);
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/source-contract?${params.toString()}`) };
  }
  if (name === 'start_scrape_session') {
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/session`, { method: 'POST', body: JSON.stringify({ policy: args.policy || {} }) }) };
  }
  if (name === 'add_scrape_candidates') {
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/candidates`, { method: 'POST', body: JSON.stringify({ candidates: args.candidates || [], objective: args.objective, query: args.query }) }) };
  }
  if (name === 'get_next_scrape_batch') {
    const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 30);
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/next?limit=${limit}`) };
  }
  if (name === 'record_scrape_page_result') {
    const body = { ...args };
    delete body.job_id;
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/page-result`, { method: 'POST', body: JSON.stringify(body) }) };
  }
  if (name === 'get_scrape_session_summary') {
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/summary`) };
  }
  if (name === 'reopen_scrape_session') {
    return { handled: true, value: await requestJson(`/api/scrape-intelligence/jobs/${jobId}/reopen`, { method: 'POST', body: JSON.stringify({ policy: args.policy || null }) }) };
  }
  return { handled: false, value: null };
}
