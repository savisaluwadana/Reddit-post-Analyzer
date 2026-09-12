import { callOpportunityOsTool, opportunityOsTools } from './opportunityTools.js';

const rangeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['low', 'high'],
  properties: {
    low: { type: 'number', minimum: 0 },
    high: { type: 'number', minimum: 0 },
  },
};

const sizingSourceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['url', 'label'],
  properties: {
    url: { type: 'string' },
    label: { type: 'string' },
    source_type: { type: 'string' },
    supports: { type: 'string', description: 'What sizing input or assumption this source supports.' },
  },
};

const consensusAssessmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['cluster_id'],
  properties: {
    cluster_id: { type: 'string' },
    supporting_evidence_ids: { type: 'array', items: { type: 'string' }, maxItems: 500 },
    contradicting_evidence_ids: { type: 'array', items: { type: 'string' }, maxItems: 500 },
    mixed_evidence_ids: { type: 'array', items: { type: 'string' }, maxItems: 500 },
    neutral_evidence_ids: { type: 'array', items: { type: 'string' }, maxItems: 500 },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    notes: { type: 'string' },
  },
};

export const qualityIntelligenceTools = [
  {
    name: 'get_research_quality_summary',
    description: 'Get the post-synthesis quality layer for a host research run: cross-run pain lineage, consensus/contradiction strength, deterministic opportunity scores, canonical market entities, market-sizing assessments, and final validation context.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['run_id'], properties: { run_id: { type: 'string' } } },
  },
  {
    name: 'refresh_market_entities',
    description: 'Normalize products, vendors, competitors and alternatives from a completed research run into a canonical market-entity registry with aliases and cross-run memory.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['run_id'], properties: { run_id: { type: 'string' } } },
  },
  {
    name: 'get_cluster_consensus_pack',
    description: 'Fetch a cluster-by-cluster evidence pack so the host model can explicitly classify evidence as supporting, contradicting, mixed or neutral instead of assuming every mention supports the pain thesis.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['run_id'],
      properties: { run_id: { type: 'string' }, cluster_id: { type: 'string' } },
    },
  },
  {
    name: 'submit_cluster_consensus',
    description: 'Persist host-classified evidence stance for semantic pain clusters. The server validates evidence membership and computes consensus strength, contradiction rate and uncertainty.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['run_id', 'assessments'],
      properties: {
        run_id: { type: 'string' },
        assessments: { type: 'array', minItems: 1, maxItems: 100, items: consensusAssessmentSchema },
      },
    },
  },
  {
    name: 'get_market_sizing_pack',
    description: 'Get an evidence-grounded market-sizing research pack for one or all opportunities in a host research run. The host must research sourced population/account counts and spend proxies; the platform does not invent TAM.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['run_id'],
      properties: { run_id: { type: 'string' }, opportunity_id: { type: 'string' } },
    },
  },
  {
    name: 'submit_market_sizing_assessment',
    description: 'Submit a sourced market-size scenario for an opportunity. The server computes TAM/SAM/SOM ranges only from supplied ranges and returns a sizing-confidence score plus caveats.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['run_id', 'opportunity_id', 'sources'],
      properties: {
        run_id: { type: 'string' }, opportunity_id: { type: 'string' }, geography: { type: 'string' }, segment: { type: 'string' }, currency: { type: 'string' },
        method: { type: 'string' }, target_population: rangeSchema, annual_spend_per_customer: rangeSchema,
        serviceable_share_pct: { ...rangeSchema, properties: { low: { type: 'number', minimum: 0, maximum: 100 }, high: { type: 'number', minimum: 0, maximum: 100 } } },
        obtainable_share_pct: { ...rangeSchema, properties: { low: { type: 'number', minimum: 0, maximum: 100 }, high: { type: 'number', minimum: 0, maximum: 100 } } },
        assumptions: { type: 'array', items: { type: 'string' }, maxItems: 20 }, sources: { type: 'array', minItems: 1, maxItems: 30, items: sizingSourceSchema }, notes: { type: 'string' },
      },
    },
  },
  ...opportunityOsTools,
];

export async function callQualityIntelligenceTool(name, args, requestJson) {
  const opportunityTool = await callOpportunityOsTool(name, args, requestJson);
  if (opportunityTool.handled) return opportunityTool;

  const runId = args?.run_id ? encodeURIComponent(args.run_id) : '';

  if (name === 'get_research_quality_summary') {
    return { handled: true, value: await requestJson(`/api/quality-intelligence/runs/${runId}/summary`) };
  }
  if (name === 'refresh_market_entities') {
    return { handled: true, value: await requestJson(`/api/quality-intelligence/runs/${runId}/entities/refresh`, { method: 'POST', body: '{}' }) };
  }
  if (name === 'get_cluster_consensus_pack') {
    const params = new URLSearchParams();
    if (args.cluster_id) params.set('clusterId', args.cluster_id);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return { handled: true, value: await requestJson(`/api/quality-intelligence/runs/${runId}/consensus-pack${suffix}`) };
  }
  if (name === 'submit_cluster_consensus') {
    const assessments = (args.assessments || []).map((item) => ({
      clusterId: item.cluster_id,
      supportingEvidenceIds: item.supporting_evidence_ids || [],
      contradictingEvidenceIds: item.contradicting_evidence_ids || [],
      mixedEvidenceIds: item.mixed_evidence_ids || [],
      neutralEvidenceIds: item.neutral_evidence_ids || [],
      reasons: item.reasons || [], notes: item.notes || '',
    }));
    return { handled: true, value: await requestJson(`/api/quality-intelligence/runs/${runId}/consensus`, { method: 'POST', body: JSON.stringify({ assessments }) }) };
  }
  if (name === 'get_market_sizing_pack') {
    const params = new URLSearchParams();
    if (args.opportunity_id) params.set('opportunityId', args.opportunity_id);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return { handled: true, value: await requestJson(`/api/quality-intelligence/runs/${runId}/market-sizing-pack${suffix}`) };
  }
  if (name === 'submit_market_sizing_assessment') {
    return {
      handled: true,
      value: await requestJson(`/api/quality-intelligence/runs/${runId}/market-sizing`, {
        method: 'POST',
        body: JSON.stringify({
          opportunityId: args.opportunity_id,
          geography: args.geography,
          segment: args.segment,
          currency: args.currency,
          method: args.method,
          targetPopulation: args.target_population,
          annualSpendPerCustomer: args.annual_spend_per_customer,
          serviceableSharePct: args.serviceable_share_pct,
          obtainableSharePct: args.obtainable_share_pct,
          assumptions: args.assumptions || [],
          sources: (args.sources || []).map((source) => ({ url: source.url, label: source.label, sourceType: source.source_type, supports: source.supports })),
          notes: args.notes,
        }),
      }),
    };
  }

  return { handled: false, value: null };
}
