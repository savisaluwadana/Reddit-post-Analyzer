export type OpportunityStage = 'research' | 'validation' | 'specification' | 'gtm' | 'building' | 'watch' | 'stopped';
export type OpportunityRecommendation = 'build' | 'validate' | 'watch' | 'stop';

export interface ValidationExperimentResult {
  sampleSize: number;
  responses: number;
  positiveResponses: number;
  interviews: number;
  signups: number;
  paidCommitments: number;
  revenue: number;
  pipelineValue: number;
  conversionRate: number | null;
  notes: string;
}

export interface ValidationExperiment {
  experimentId: string;
  type: string;
  title: string;
  hypothesis: string;
  segment: string;
  channel: string;
  primaryMetric: string;
  targetValue: number | null;
  status: 'planned' | 'running' | 'complete' | 'failed';
  verdict: 'supports' | 'mixed' | 'refutes' | 'inconclusive';
  result: ValidationExperimentResult;
  evidenceUrls: string[];
  learning: string;
  nextStep: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface OpportunityDecision {
  decisionScore: number;
  recommendation: OpportunityRecommendation;
  nextAction: string;
  researchScore: number;
  validation: {
    score: number;
    completedExperiments: number;
    supportingExperiments: number;
    refutingExperiments: number;
    paidSignals: number;
    confidence: number;
  };
  founderFit: {
    score: number;
    components: Record<string, number>;
  };
  rule: string;
}

export interface OpportunityWorkspace {
  _id: string;
  hostRunId: string;
  hostRunName: string;
  opportunityId: string;
  title: string;
  stage: OpportunityStage;
  researchScore: number;
  marketValidationVerdict: string;
  researchSnapshot: Record<string, unknown> & {
    problem?: string;
    targetPersona?: string;
    segment?: string;
    jobToBeDone?: string;
    solutionThesis?: string;
    whyNow?: string;
    willingnessToPay?: string;
    differentiation?: string;
  };
  strategy: {
    icp?: string;
    economicBuyer?: string;
    endUser?: string;
    painfulWorkflow?: string;
    wedge?: string;
    positioning?: string;
    promise?: string;
    triggerEvents?: string[];
    pricingHypotheses?: string[];
    distributionChannels?: string[];
    moats?: string[];
    assumptions?: string[];
    killCriteria?: string[];
    risks?: string[];
  };
  founderFit: Record<string, unknown>;
  experiments: ValidationExperiment[];
  buildSpec: {
    productName?: string;
    oneLiner?: string;
    scopeIn?: string[];
    milestones?: string[];
  };
  gtmPlan: {
    firstCustomerProfile?: string;
    channels?: string[];
    offer?: string;
    first10CustomerPlan?: string[];
  };
  decision: OpportunityDecision;
  decisionHistory: Array<{
    score: number;
    recommendation: string;
    nextAction: string;
    recordedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
