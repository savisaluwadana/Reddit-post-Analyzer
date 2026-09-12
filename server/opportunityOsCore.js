const clamp = (value, min = 0, max = 100) => Math.min(Math.max(Number(value) || 0, min), max);
const round = (value, digits = 1) => Number(Number(value || 0).toFixed(digits));

export const EXPERIMENT_TYPES = new Set([
  'interview','outbound','landing-page','waitlist','pricing','prototype','concierge','presale','paid-pilot','other',
]);

export const EXPERIMENT_STATUSES = new Set(['planned','running','complete','failed']);
export const EXPERIMENT_VERDICTS = new Set(['supports','mixed','refutes','inconclusive']);
export const WORKSPACE_STAGES = new Set(['research','validation','specification','gtm','building','watch','stopped']);

export function normalizeExperimentType(value) {
  const type = String(value || '').trim().toLowerCase();
  return EXPERIMENT_TYPES.has(type) ? type : 'other';
}

export function calculateExperimentSignal(experiment = {}) {
  const status = String(experiment.status || '').toLowerCase();
  if (status !== 'complete' && status !== 'failed') {
    return { score: 0, counted: false, paidSignal: false, confidence: 0 };
  }

  const result = experiment.result || {};
  const sampleSize = Math.max(0, Number(result.sampleSize) || 0);
  const positive = Math.max(0, Number(result.positiveResponses) || 0);
  const responses = Math.max(0, Number(result.responses) || 0);
  const paidCommitments = Math.max(0, Number(result.paidCommitments) || 0);
  const revenue = Math.max(0, Number(result.revenue) || 0);
  const pipelineValue = Math.max(0, Number(result.pipelineValue) || 0);
  const conversionRate = Number(result.conversionRate);
  const verdict = EXPERIMENT_VERDICTS.has(String(experiment.verdict || '').toLowerCase())
    ? String(experiment.verdict).toLowerCase()
    : 'inconclusive';

  const verdictBase = { supports: 82, mixed: 55, refutes: 15, inconclusive: 40 }[verdict];
  const responseRate = responses > 0 ? Math.min(1, positive / responses) : null;
  const responseSignal = responseRate === null ? 50 : responseRate * 100;
  const conversionSignal = Number.isFinite(conversionRate) ? clamp(conversionRate) : 50;
  const sampleConfidence = clamp(Math.log10(Math.max(1, sampleSize + responses + 1)) * 35);
  const paidSignal = paidCommitments > 0 || revenue > 0 || ['presale','paid-pilot'].includes(normalizeExperimentType(experiment.type));
  const commercialBoost = paidCommitments > 0 ? Math.min(12, 5 + Math.log10(paidCommitments + 1) * 5) : 0;
  const revenueBoost = revenue > 0 ? Math.min(10, 3 + Math.log10(revenue + 1) * 2) : 0;
  const pipelineBoost = pipelineValue > 0 ? Math.min(5, Math.log10(pipelineValue + 1)) : 0;

  let score = verdictBase * 0.58 + responseSignal * 0.18 + conversionSignal * 0.10 + sampleConfidence * 0.14;
  score += commercialBoost + revenueBoost + pipelineBoost;
  if (verdict === 'refutes') score = Math.min(score, 35);

  return {
    score: round(clamp(score)),
    counted: true,
    paidSignal,
    confidence: round(sampleConfidence),
    metrics: {
      sampleSize,
      responses,
      positiveResponses: positive,
      responseRate: responseRate === null ? null : round(responseRate * 100),
      conversionRate: Number.isFinite(conversionRate) ? round(conversionRate) : null,
      paidCommitments,
      revenue,
      pipelineValue,
    },
  };
}

export function calculateValidationSummary(experiments = []) {
  const scored = experiments.map((experiment) => ({ experiment, signal: calculateExperimentSignal(experiment) })).filter((item) => item.signal.counted);
  if (!scored.length) {
    return {
      score: 0,
      completedExperiments: 0,
      supportingExperiments: 0,
      refutingExperiments: 0,
      paidSignals: 0,
      confidence: 0,
      experimentSignals: [],
    };
  }

  let weighted = 0;
  let weight = 0;
  let supporting = 0;
  let refuting = 0;
  let paidSignals = 0;
  let confidenceSum = 0;

  for (const item of scored) {
    const type = normalizeExperimentType(item.experiment.type);
    const typeWeight = ['presale','paid-pilot'].includes(type) ? 1.5 : ['pricing','prototype','concierge'].includes(type) ? 1.25 : 1;
    weighted += item.signal.score * typeWeight;
    weight += typeWeight;
    confidenceSum += item.signal.confidence;
    if (item.experiment.verdict === 'supports') supporting += 1;
    if (item.experiment.verdict === 'refutes') refuting += 1;
    if (item.signal.paidSignal) paidSignals += 1;
  }

  let score = weighted / Math.max(1, weight);
  const refutationRate = refuting / scored.length;
  if (refutationRate >= 0.5) score = Math.min(score, 44);
  else if (refutationRate >= 0.34) score = Math.min(score, 58);

  return {
    score: round(clamp(score)),
    completedExperiments: scored.length,
    supportingExperiments: supporting,
    refutingExperiments: refuting,
    paidSignals,
    confidence: round(clamp(confidenceSum / scored.length)),
    experimentSignals: scored.map(({ experiment, signal }) => ({ experimentId: experiment.experimentId, type: experiment.type, verdict: experiment.verdict, ...signal })),
  };
}

export function calculateFounderFitScore(assessment = {}) {
  const components = {
    skillFit: clamp(assessment.skillFit),
    distributionFit: clamp(assessment.distributionFit),
    capitalFit: clamp(assessment.capitalFit),
    timeToMarketFit: clamp(assessment.timeToMarketFit),
    operatingFit: clamp(assessment.operatingFit),
  };
  const supplied = Object.values(components).filter((value) => value > 0);
  const score = supplied.length ? supplied.reduce((sum, value) => sum + value, 0) / supplied.length : 50;
  return { score: round(score), components };
}

export function calculateOpportunityDecision({ researchScore = 0, experiments = [], founderFit = {} } = {}) {
  const research = clamp(researchScore);
  const validation = calculateValidationSummary(experiments);
  const fit = calculateFounderFitScore(founderFit);
  const hasValidation = validation.completedExperiments > 0;

  let decisionScore = hasValidation
    ? research * 0.50 + validation.score * 0.35 + fit.score * 0.15
    : research * 0.78 + fit.score * 0.22;

  if (validation.refutingExperiments >= Math.max(2, Math.ceil(validation.completedExperiments / 2))) decisionScore = Math.min(decisionScore, 48);
  if (validation.paidSignals > 0 && validation.supportingExperiments > validation.refutingExperiments) decisionScore = Math.min(100, decisionScore + 4);
  decisionScore = round(clamp(decisionScore));

  let recommendation = 'validate';
  let nextAction = 'Run at least two independent validation experiments before committing to a build.';
  if (validation.completedExperiments === 0) {
    recommendation = research >= 55 ? 'validate' : 'watch';
  } else if (decisionScore >= 78 && validation.completedExperiments >= 2 && validation.paidSignals > 0) {
    recommendation = 'build';
    nextAction = 'Convert validated demand into a narrow MVP/build specification and a paid-pilot plan.';
  } else if (decisionScore >= 62 && validation.refutingExperiments < validation.supportingExperiments + 1) {
    recommendation = 'validate';
    nextAction = 'Run the next experiment against the largest unresolved assumption or pricing risk.';
  } else if (decisionScore >= 48) {
    recommendation = 'watch';
    nextAction = 'Do not build yet. Resolve contradictory evidence or change the segment/wedge before spending engineering time.';
  } else {
    recommendation = 'stop';
    nextAction = 'Stop or materially reframe the thesis; current real-world validation does not justify more investment.';
  }

  return {
    decisionScore,
    recommendation,
    nextAction,
    researchScore: round(research),
    validation,
    founderFit: fit,
    rule: 'Build requires a high combined score, at least two completed experiments, and at least one paid/commercial signal.',
  };
}

export function buildExperimentTemplate(type = 'interview', opportunity = {}) {
  const normalized = normalizeExperimentType(type);
  const persona = opportunity.targetPersona || opportunity.segment || 'target customer';
  const templates = {
    interview: {
      title: `Problem interviews with ${persona}`,
      hypothesis: `${persona} experiences the problem frequently enough to change behavior or spend money to solve it.`,
      primaryMetric: 'qualified problem confirmations',
      suggestedTarget: 5,
    },
    outbound: {
      title: `Cold outbound demand test for ${persona}`,
      hypothesis: `A pain-led message will generate qualified replies from ${persona}.`,
      primaryMetric: 'positive reply rate',
      suggestedTarget: 10,
    },
    'landing-page': {
      title: `Landing-page intent test for ${opportunity.title || 'the opportunity'}`,
      hypothesis: 'Target visitors will exchange contact information for a concrete solution promise.',
      primaryMetric: 'signup conversion rate',
      suggestedTarget: 8,
    },
    pricing: {
      title: 'Pricing and willingness-to-pay test',
      hypothesis: 'Qualified buyers will accept a price consistent with the opportunity thesis.',
      primaryMetric: 'price acceptance rate',
      suggestedTarget: 30,
    },
    prototype: {
      title: 'Prototype usability and value test',
      hypothesis: 'A narrow prototype materially improves the painful workflow.',
      primaryMetric: 'users willing to continue',
      suggestedTarget: 60,
    },
    concierge: {
      title: 'Concierge workflow test',
      hypothesis: 'Customers will repeatedly use the outcome even before the workflow is automated.',
      primaryMetric: 'repeat usage rate',
      suggestedTarget: 50,
    },
    presale: {
      title: 'Presale commitment test',
      hypothesis: 'Qualified buyers will commit money before a full product exists.',
      primaryMetric: 'paid commitments',
      suggestedTarget: 1,
    },
    'paid-pilot': {
      title: 'Paid pilot test',
      hypothesis: 'A qualified customer will pay to test the proposed solution in a real workflow.',
      primaryMetric: 'paid pilots',
      suggestedTarget: 1,
    },
  };
  return templates[normalized] || templates.interview;
}
