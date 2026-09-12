import { callScrapeIntelligenceTool, scrapeIntelligenceTools } from './scrapeTools.js';

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
  {
    name: 'complete_research_job_without_opportunities',
    description: 'Complete a research job whose finished semantic synthesis generated zero opportunities. This is a valid negative research outcome and avoids inventing a validation item just to satisfy a non-empty schema.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['job_id'],
      properties: {
        job_id: { type: 'string' },
        result_summary: { type: 'string', description: 'Optional concise explanation of why no opportunity survived synthesis/validation.' },
      },
    },
  },
  ...scrapeIntelligenceTools,
];

async function optionalRequest(requestJson, path) {
  try { return await requestJson(path); } catch { return null; }
}

function collectionExecutionSequence(job) {
  return [
    'Call/get the supplied searchPlan first. Execute multiple distinct missions rather than one broad query.',
    'For every search result set, submit useful public URL candidates with add_scrape_candidates instead of opening results in arbitrary order.',
    'Use get_next_scrape_batch to browse the highest-information URLs first. Call get_source_scrape_contract for each source class before deep traversal.',
    `Ingest useful evidence with ingest_evidence using batch_id=${job.batchId}. Preserve canonical URLs, dates, source/community, metadata.first_hand and metadata.root_url where known.`,
    'After every browsed page/thread branch, call record_scrape_page_result with extraction quality fields, evidence yield, duplicate yield, access state, and newly discovered candidates.',
    'Never bypass authentication, paywalls, robots/access restrictions, or anti-bot challenges. Record the access boundary and move on.',
    'Use get_scrape_session_summary regularly. Respect adaptive stop decisions when marginal yield collapses, duplicates dominate, access boundaries saturate, the frontier is exhausted, or the evidence target is reached.',
    'Call record_research_search_progress after each search pass so repeated queries and URLs are avoided.',
    'Call evaluate_research_job_coverage AND evaluate_research_evidence_quality. Fill both coverage gaps and quality gaps.',
    'Explicitly search for contradictory/positive evidence, quantified impact, strong commercial behavior, and independent sources before synthesis.',
    'Repeat search/frontier/deep-scrape passes until the evidence-quality gate is ready or the research pass cap is reached.',
    'Then call start_job_semantic_analysis and complete the host semantic workflow.',
    'Finally validate competitors, pricing, switching barriers, and substitutes before submit_opportunity_validation. If synthesis produced zero opportunities, use complete_research_job_without_opportunities instead.',
  ];
}

function resumeExecutionProtocol(claimed) {
  const job = claimed.job || {};
  if (job.status === 'semantic-analysis') {
    return {
      ...(claimed.executionProtocol || {}),
      resumedFrom: 'semantic-analysis',
      sequence: [
        `Resume semantic analysis for host run ${job.hostRunId || '(linked host run)'}. Do not reopen evidence collection.`,
        'Call get_llm_evidence_batch and submit_llm_annotations until every eligible evidence item is annotated.',
        'Call get_llm_synthesis_pack and submit_llm_synthesis.',
        'Then move to get_research_job_validation_pack and validate every synthesized opportunity, or use complete_research_job_without_opportunities if synthesis yielded none.',
      ],
    };
  }
  if (job.status === 'opportunity-validation') {
    return {
      ...(claimed.executionProtocol || {}),
      resumedFrom: 'opportunity-validation',
      sequence: [
        'Resume opportunity validation. Evidence collection and semantic inputs are closed; do not scrape or ingest additional evidence.',
        'Call get_research_job_validation_pack.',
        'Validate competitors, pricing, substitutes, switching barriers, underserved segments and counter-evidence for every opportunity.',
        'Submit the exact opportunity set with submit_opportunity_validation, or complete_research_job_without_opportunities when the synthesis contains zero opportunities.',
      ],
    };
  }
  return {
    ...(claimed.executionProtocol || {}),
    resumedFrom: job.status || 'claimed',
    sequence: collectionExecutionSequence(job),
  };
}

export async function callResearchSearchTool(name, args, requestJson) {
  const jobId = args?.job_id ? encodeURIComponent(args.job_id) : '';

  // claim_research_job is declared by hostTools, but intercepted here so every claimed
  // job resumes from its persisted stage rather than blindly restarting collection.
  if (name === 'claim_research_job') {
    const claimed = await requestJson('/api/research-jobs/claim', {
      method: 'POST',
      body: JSON.stringify({ harness: args.harness || 'mcp-host', leaseMinutes: args.lease_minutes || 30 }),
    });
    if (!claimed?.job?._id) return { handled: true, value: claimed };
    const claimedJobId = encodeURIComponent(claimed.job._id);
    const collectionStage = ['claimed', 'collecting', 'gap-research'].includes(claimed.job.status);

    if (!collectionStage) {
      const [quality, scrapeSummary] = await Promise.all([
        optionalRequest(requestJson, `/api/research-search/jobs/${claimedJobId}/quality`),
        optionalRequest(requestJson, `/api/scrape-intelligence/jobs/${claimedJobId}/summary`),
      ]);
      return {
        handled: true,
        value: {
          ...claimed,
          searchQuality: quality?.report || null,
          scrapeSession: scrapeSummary?.session || null,
          executionProtocol: resumeExecutionProtocol(claimed),
        },
      };
    }

    const [searchPlan, quality, scrapeSession] = await Promise.all([
      requestJson(`/api/research-search/jobs/${claimedJobId}/plan`),
      requestJson(`/api/research-search/jobs/${claimedJobId}/quality`),
      requestJson(`/api/scrape-intelligence/jobs/${claimedJobId}/session`, { method: 'POST', body: JSON.stringify({ policy: {} }) }),
    ]);
    return {
      handled: true,
      value: {
        ...claimed,
        searchPlan: searchPlan.plan,
        searchQuality: quality.report,
        scrapeSession: scrapeSession.session,
        executionProtocol: resumeExecutionProtocol(claimed),
      },
    };
  }

  // Also enrich the existing coverage tool with the deeper evidence-quality report.
  if (name === 'evaluate_research_job_coverage') {
    const coverage = await requestJson(`/api/research-jobs/${jobId}/coverage`, {
      method: 'POST',
      body: JSON.stringify({ advancePass: args.advance_pass !== false }),
    });
    const quality = await requestJson(`/api/research-search/jobs/${jobId}/quality`);
    const scrape = await optionalRequest(requestJson, `/api/scrape-intelligence/jobs/${jobId}/summary`);
    return {
      handled: true,
      value: {
        ...coverage,
        searchQuality: quality.report,
        scrapeQuality: scrape?.session || null,
        qualityReadyForSynthesis: Boolean(quality.report?.readyForSynthesis),
        recommendedNextStep: quality.report?.readyForSynthesis
          ? 'Proceed when the coverage gate is also ready, otherwise close remaining coverage gaps.'
          : 'Continue search/frontier/deep-scrape work using the returned quality gaps before semantic synthesis.',
      },
    };
  }

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

  if (name === 'complete_research_job_without_opportunities') {
    const pack = await requestJson(`/api/research-jobs/${jobId}/validation-pack`);
    if ((pack.opportunities || []).length !== 0) {
      throw new Error(`This job has ${(pack.opportunities || []).length} synthesized opportunities; validate them with submit_opportunity_validation instead.`);
    }
    return {
      handled: true,
      value: await requestJson(`/api/research-jobs/${jobId}/validation`, {
        method: 'POST',
        body: JSON.stringify({ validations: [], resultSummary: args.result_summary || 'Semantic synthesis produced no opportunities worth validating.' }),
      }),
    };
  }

  const scrapeTool = await callScrapeIntelligenceTool(name, args, requestJson);
  if (scrapeTool.handled) return scrapeTool.value;

  return { handled: false, value: null };
}