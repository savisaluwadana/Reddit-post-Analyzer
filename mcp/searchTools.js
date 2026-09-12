export const researchSearchTools = [
  {
    name: 'get_research_search_plan',
    description: 'Generate a memory-aware, source-aware search plan for a research job. Includes pain, workaround, commercial-intent, contradiction, alternatives, pricing, recency, and current coverage-gap missions.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['job_id'],
      properties: { job_id: { type: 'string' } },
    },
  },
  {
    name: 'record_research_search_progress',
    description: 'Persist queries already executed, URLs visited, discovered entities, and failed sources so the autonomous researcher does not repeat the same work across passes.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['job_id'],
      properties: {
        job_id: { type: 'string' },
        queries: {
          type: 'array', maxItems: 100, items: {
            type: 'object', additionalProperties: false, required: ['query'], properties: {
              mission_id: { type: 'string' }, query: { type: 'string' }, source_kind: { type: 'string' },
              results_seen: { type: 'integer', minimum: 0 }, evidence_added: { type: 'integer', minimum: 0 }, notes: { type: 'string' },
            },
          },
        },
        visited_urls: {
          type: 'array', maxItems: 200, items: {
            type: 'object', additionalProperties: false, required: ['url'], properties: {
              url: { type: 'string' }, source_kind: { type: 'string' }, canonical_url: { type: 'string' },
              depth: { type: 'integer', minimum: 0 }, evidence_added: { type: 'integer', minimum: 0 }, status: { type: 'string' },
            },
          },
        },
        discovered_entities: { type: 'array', items: { type: 'string' }, maxItems: 100 },
        failed_sources: { type: 'array', items: { type: 'string' }, maxItems: 100 },
      },
    },
  },
  {
    name: 'get_deep_scrape_plan',
    description: 'Return a safe deep-scrape traversal and extraction contract for a discovered public page/thread. The host browser performs the browsing; the platform describes how to traverse context without API keys.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['url'], properties: {
        url: { type: 'string' },
        source_kind: { type: 'string', description: 'reddit, forum, support, review, github, social, community, web, etc.' },
      },
    },
  },
  {
    name: 'record_deep_scrape_result',
    description: 'Record how deeply a public thread/page was traversed and how much independent evidence it produced. Use after a deep-scrape pass.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id', 'root_url'], properties: {
        job_id: { type: 'string' }, root_url: { type: 'string' }, source_kind: { type: 'string' },
        pages_visited: { type: 'integer', minimum: 1 }, branches_visited: { type: 'integer', minimum: 0 },
        replies_inspected: { type: 'integer', minimum: 0 }, evidence_added: { type: 'integer', minimum: 0 },
        claim_types: { type: 'array', items: { type: 'string' }, maxItems: 20 }, stopped_reason: { type: 'string' },
      },
    },
  },
  {
    name: 'evaluate_research_evidence_quality',
    description: 'Evaluate research quality beyond raw coverage: near-duplicate/repost rate, independent evidence, strong commercial signals, workaround proof, quantified impact, contradiction coverage, source/author diversity, and deep-scrape depth.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id'], properties: { job_id: { type: 'string' } },
    },
  },
  {
    name: 'get_research_search_memory',
    description: 'Retrieve persisted search memory for a research job: queries run, URLs visited, deep scrapes, discovered entities, and failed sources.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['job_id'], properties: { job_id: { type: 'string' } },
    },
  },
];

export async function callResearchSearchTool(name, args, requestJson) {
  const jobId = args?.job_id ? encodeURIComponent(args.job_id) : '';

  if (name === 'get_research_search_plan') {
    return { handled: true, value: await requestJson(`/api/research-search/jobs/${jobId}/plan`) };
  }

  if (name === 'record_research_search_progress') {
    return {
      handled: true,
      value: await requestJson(`/api/research-search/jobs/${jobId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          queries: args.queries || [],
          visitedUrls: args.visited_urls || [],
          discoveredEntities: args.discovered_entities || [],
          failedSources: args.failed_sources || [],
        }),
      }),
    };
  }

  if (name === 'get_deep_scrape_plan') {
    const params = new URLSearchParams({ url: args.url });
    if (args.source_kind) params.set('sourceKind', args.source_kind);
    return { handled: true, value: await requestJson(`/api/research-search/deep-scrape-plan?${params.toString()}`) };
  }

  if (name === 'record_deep_scrape_result') {
    return {
      handled: true,
      value: await requestJson(`/api/research-search/jobs/${jobId}/deep-scrape`, {
        method: 'POST',
        body: JSON.stringify({
          rootUrl: args.root_url,
          sourceKind: args.source_kind,
          pagesVisited: args.pages_visited,
          branchesVisited: args.branches_visited,
          repliesInspected: args.replies_inspected,
          evidenceAdded: args.evidence_added,
          claimTypes: args.claim_types || [],
          stoppedReason: args.stopped_reason,
        }),
      }),
    };
  }

  if (name === 'evaluate_research_evidence_quality') {
    return { handled: true, value: await requestJson(`/api/research-search/jobs/${jobId}/quality`) };
  }

  if (name === 'get_research_search_memory') {
    return { handled: true, value: await requestJson(`/api/research-search/jobs/${jobId}/memory`) };
  }

  return { handled: false, value: null };
}
