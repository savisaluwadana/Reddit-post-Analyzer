export type ResearchJobStatus =
  | 'queued'
  | 'claimed'
  | 'collecting'
  | 'gap-research'
  | 'semantic-analysis'
  | 'opportunity-validation'
  | 'complete'
  | 'failed';

export interface ResearchCoverageGap {
  gap: string;
  priority: 'high' | 'medium' | 'low';
  goal: string;
  queryAngles: string[];
  preferredSourceKinds: string[];
}

export interface ResearchCoverageMetrics {
  totalEvidence: number;
  sourceKindCount: number;
  namedSourceCount: number;
  dominantSourceName: string;
  dominantSourceShare: number;
  urlCoverage: number;
  recentCoverage: number;
  firstHandCoverage: number | null;
  firstHandTagged: number;
  commercialSignals: number;
  workaroundSignals: number;
  painEvidence: number;
  annotationCount: number;
  annotationCoverage: number;
  personaCount: number;
  hostRunLinked: boolean;
  byKind: Array<{ sourceKind: string; count: number }>;
  bySource: Array<{ sourceName: string; count: number }>;
}

export interface ResearchCoverage {
  generatedAt: string;
  collectionScore: number;
  semanticScore: number;
  readyForSemantic: boolean;
  targets: Record<string, number>;
  metrics: ResearchCoverageMetrics;
  gaps: ResearchCoverageGap[];
}

export interface CompetitorValidation {
  name: string;
  url: string;
  pricing: string;
  positioning: string;
  complaints: string[];
}

export interface OpportunityValidation {
  opportunityId: string;
  verdict: 'reject' | 'watch' | 'validate' | 'build';
  validationScore: number;
  marketSaturation: number;
  confidence: number;
  underservedSegment: string;
  differentiationEvidence: string;
  pricingSignals: string[];
  switchingBarriers: string[];
  competitors: CompetitorValidation[];
  risks: string[];
  recommendedExperiment: string;
}

export interface ResearchJob {
  _id: string;
  name: string;
  topic: string;
  audience: string;
  status: ResearchJobStatus;
  priority: number;
  batchId: string;
  preferredSourceKinds: string[];
  searchAngles: string[];
  claimedBy: string;
  claimExpiresAt?: string;
  lastHeartbeatAt?: string;
  researchPass: number;
  maxPasses: number;
  coverageTarget: Record<string, number>;
  coverage?: ResearchCoverage;
  gaps: ResearchCoverageGap[];
  hostRunId: string;
  opportunityValidations: OpportunityValidation[];
  resultSummary: string;
  failureReason: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResearchJobInput {
  name?: string;
  topic: string;
  audience?: string;
  priority?: number;
  preferredSourceKinds?: string[];
  searchAngles?: string[];
  maxPasses?: number;
}
