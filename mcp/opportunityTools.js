const scoreSchema = { type: 'number', minimum: 0, maximum: 100 };

const experimentResultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sample_size: { type: 'integer', minimum: 0 },
    responses: { type: 'integer', minimum: 0 },
    positive_responses: { type: 'integer', minimum: 0 },
    interviews: { type: 'integer', minimum: 0 },
    signups: { type: 'integer', minimum: 0 },
    paid_commitments: { type: 'integer', minimum: 0 },
    revenue: { type: 'number', minimum: 0 },
    pipeline_value: { type: 'number', minimum: 0 },
    conversion_rate: { type: 'number', minimum: 0, maximum: 100 },
    notes: { type: 'string' },
  },
};

export const opportunityOsTools = [
  {
    name: 'create_opportunity_workspace',
    description: 'Create or return a durable Founder/Product Opportunity OS workspace from one synthesized opportunity in a completed host research run. The workspace preserves research provenance and becomes the home for strategy, experiments, build spec, GTM and outcome tracking.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['run_id','opportunity_id'], properties: { run_id: { type: 'string' }, opportunity_id: { type: 'string' } } },
  },
  {
    name: 'list_opportunity_workspaces',
    description: 'List the opportunity portfolio with current stage, research score, experiment results and live build/validate/watch/stop recommendation.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { stage: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 } } },
  },
  {
    name: 'get_opportunity_workspace',
    description: 'Load one Opportunity OS workspace including research snapshot, strategy, founder/team fit, validation experiments, build spec, GTM plan and decision history.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['workspace_id'], properties: { workspace_id: { type: 'string' } } },
  },
  {
    name: 'submit_opportunity_strategy',
    description: 'Store the executable opportunity thesis: ICP, buyer, user, workflow, wedge, positioning, pricing hypotheses, distribution, moats, assumptions, kill criteria and risks.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id'], properties: {
        workspace_id: { type: 'string' }, icp: { type: 'string' }, economic_buyer: { type: 'string' }, end_user: { type: 'string' }, painful_workflow: { type: 'string' },
        wedge: { type: 'string' }, positioning: { type: 'string' }, promise: { type: 'string' },
        trigger_events: { type: 'array', items: { type: 'string' } }, pricing_hypotheses: { type: 'array', items: { type: 'string' } },
        distribution_channels: { type: 'array', items: { type: 'string' } }, moats: { type: 'array', items: { type: 'string' } },
        assumptions: { type: 'array', items: { type: 'string' } }, kill_criteria: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'submit_founder_fit_assessment',
    description: 'Score how well the opportunity fits the builder/team. This prevents a globally attractive market from automatically becoming the best opportunity for this team.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id'], properties: {
        workspace_id: { type: 'string' }, skill_fit: scoreSchema, distribution_fit: scoreSchema, capital_fit: scoreSchema,
        time_to_market_fit: scoreSchema, operating_fit: scoreSchema,
        advantages: { type: 'array', items: { type: 'string' } }, constraints: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
      },
    },
  },
  {
    name: 'create_validation_experiment',
    description: 'Create a validation experiment such as interviews, outbound, landing page, pricing, prototype, concierge, presale or paid pilot. The platform provides sensible templates when fields are omitted.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id','type'], properties: {
        workspace_id: { type: 'string' }, type: { type: 'string', enum: ['interview','outbound','landing-page','waitlist','pricing','prototype','concierge','presale','paid-pilot','other'] },
        title: { type: 'string' }, hypothesis: { type: 'string' }, segment: { type: 'string' }, channel: { type: 'string' }, primary_metric: { type: 'string' }, target_value: { type: 'number' },
      },
    },
  },
  {
    name: 'record_validation_result',
    description: 'Record real-world experiment results. Completed results immediately change the opportunity validation score and may move the recommendation between build, validate, watch and stop.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id','experiment_id','verdict'], properties: {
        workspace_id: { type: 'string' }, experiment_id: { type: 'string' }, status: { type: 'string', enum: ['planned','running','complete','failed'] },
        verdict: { type: 'string', enum: ['supports','mixed','refutes','inconclusive'] }, result: experimentResultSchema,
        evidence_urls: { type: 'array', items: { type: 'string' } }, learning: { type: 'string' }, next_step: { type: 'string' },
      },
    },
  },
  {
    name: 'get_opportunity_execution_pack',
    description: 'Get the complete execution context and structured contracts for converting a validated opportunity into strategy, experiments, a narrow MVP specification and first-customer GTM plan.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['workspace_id'], properties: { workspace_id: { type: 'string' } } },
  },
  {
    name: 'submit_build_spec',
    description: 'Persist an evidence/validation-backed MVP specification: scope, stories, requirements, architecture, data model, APIs, integrations, milestones and acceptance criteria.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id','product_name','one_liner'], properties: {
        workspace_id: { type: 'string' }, product_name: { type: 'string' }, one_liner: { type: 'string' }, target_persona: { type: 'string' }, core_job: { type: 'string' },
        scope_in: { type: 'array', items: { type: 'string' } }, scope_out: { type: 'array', items: { type: 'string' } }, user_stories: { type: 'array', items: { type: 'string' } },
        functional_requirements: { type: 'array', items: { type: 'string' } }, non_functional_requirements: { type: 'array', items: { type: 'string' } }, architecture: { type: 'string' },
        data_entities: { type: 'array', items: { type: 'string' } }, api_endpoints: { type: 'array', items: { type: 'string' } }, integrations: { type: 'array', items: { type: 'string' } },
        milestones: { type: 'array', items: { type: 'string' } }, acceptance_criteria: { type: 'array', items: { type: 'string' } }, open_questions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'submit_gtm_plan',
    description: 'Persist the first-customer go-to-market plan: who to prospect, trigger events, channels, outreach angles, offer, CTA, proof requirements, objections and a concrete first-10-customer sequence.',
    inputSchema: {
      type: 'object', additionalProperties: false, required: ['workspace_id'], properties: {
        workspace_id: { type: 'string' }, first_customer_profile: { type: 'string' }, buyer_triggers: { type: 'array', items: { type: 'string' } },
        prospecting_criteria: { type: 'array', items: { type: 'string' } }, channels: { type: 'array', items: { type: 'string' } }, outreach_angles: { type: 'array', items: { type: 'string' } },
        offer: { type: 'string' }, call_to_action: { type: 'string' }, proof_needed: { type: 'array', items: { type: 'string' } }, first_10_customer_plan: { type: 'array', items: { type: 'string' } },
        objections: { type: 'array', items: { type: 'string' } }, partnership_angles: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'set_opportunity_stage',
    description: 'Explicitly move an opportunity workspace through research, validation, specification, GTM, building, watch or stopped after the human/host has made the corresponding commitment.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['workspace_id','stage'], properties: { workspace_id: { type: 'string' }, stage: { type: 'string', enum: ['research','validation','specification','gtm','building','watch','stopped'] } } },
  },
];

export async function callOpportunityOsTool(name, args, requestJson) {
  const workspaceId = args?.workspace_id ? encodeURIComponent(args.workspace_id) : '';

  if (name === 'create_opportunity_workspace') {
    return { handled: true, value: await requestJson('/api/opportunity-os/workspaces/from-run', { method: 'POST', body: JSON.stringify({ runId: args.run_id, opportunityId: args.opportunity_id }) }) };
  }
  if (name === 'list_opportunity_workspaces') {
    const params = new URLSearchParams();
    if (args.stage) params.set('stage', args.stage);
    if (args.limit) params.set('limit', String(args.limit));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces${suffix}`) };
  }
  if (name === 'get_opportunity_workspace') return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}`) };
  if (name === 'submit_opportunity_strategy') {
    const { workspace_id: _workspaceId, ...strategy } = args;
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/strategy`, { method: 'PATCH', body: JSON.stringify(strategy) }) };
  }
  if (name === 'submit_founder_fit_assessment') {
    const { workspace_id: _workspaceId, ...fit } = args;
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/founder-fit`, { method: 'PATCH', body: JSON.stringify(fit) }) };
  }
  if (name === 'create_validation_experiment') {
    const { workspace_id: _workspaceId, ...experiment } = args;
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/experiments`, { method: 'POST', body: JSON.stringify(experiment) }) };
  }
  if (name === 'record_validation_result') {
    const experimentId = encodeURIComponent(args.experiment_id);
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/experiments/${experimentId}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ status: args.status || 'complete', verdict: args.verdict, result: args.result || {}, evidenceUrls: args.evidence_urls || [], learning: args.learning, nextStep: args.next_step }),
    }) };
  }
  if (name === 'get_opportunity_execution_pack') return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/execution-pack`) };
  if (name === 'submit_build_spec') {
    const { workspace_id: _workspaceId, ...spec } = args;
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/build-spec`, { method: 'POST', body: JSON.stringify(spec) }) };
  }
  if (name === 'submit_gtm_plan') {
    const { workspace_id: _workspaceId, ...gtm } = args;
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/gtm-plan`, { method: 'POST', body: JSON.stringify(gtm) }) };
  }
  if (name === 'set_opportunity_stage') {
    return { handled: true, value: await requestJson(`/api/opportunity-os/workspaces/${workspaceId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: args.stage }) }) };
  }

  return { handled: false, value: null };
}
