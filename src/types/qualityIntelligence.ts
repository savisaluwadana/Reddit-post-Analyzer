export type ClusterLineageStatus = 'new' | 'rising' | 'persistent' | 'falling';

export interface ClusterLineageItem {
  clusterId: string;
  label: string;
  status: ClusterLineageStatus;
  similarity: number;
  previousRunId: string;
  previousRunName?: string;
  previousClusterId: string;
  previousLabel?: string;
  previousPainScore?: number;
  currentPainScore?: number;
  painDelta: number;
  confidenceDelta: number;
}

export interface ConsensusSummary {
  clusterId: string;
  supporting: number;
  contradicting: number;
  mixed: number;
  neutral: number;
  classifiedEvidence: number;
  evidenceCoverage: number;
  consensusStrength: number;
  contradictionRate: number;
  uncertainty: number;
  classificationComplete: boolean;
}

export interface OpportunityQualityScore {
  opportunityId: string;
  title: string;
  deterministicScore: number;
  hostScore: number;
  scoreDelta: number;
  interpretation: 'very-strong' | 'strong' | 'promising' | 'weak' | 'low-confidence';
  components: Record<string, number>;
}

export interface MarketEntitySummary {
  _id: string;
  canonicalKey: string;
  canonicalName: string;
  aliases: string[];
  entityTypes: string[];
  sourceRunIds: string[];
  sourceClusterIds: string[];
  sourceOpportunityIds: string[];
  contexts: string[];
  mentionCount: number;
  lastSeenAt: string;
}

export interface MarketSizingAssessment {
  _id: string;
  runId: string;
  opportunityId: string;
  geography: string;
  segment: string;
  currency: string;
  confidenceScore: number;
  calculations: {
    tam?: { low: number; high: number } | null;
    sam?: { low: number; high: number } | null;
    som?: { low: number; high: number } | null;
  };
  caveats: string[];
  updatedAt: string;
}

export interface QualityIntelligenceSummary {
  runId: string;
  runName: string;
  generatedAt: string;
  comparableRuns: Array<{ _id: string; name: string; topic: string; topicSimilarity: number; updatedAt: string }>;
  lineage: ClusterLineageItem[];
  consensus: ConsensusSummary[];
  opportunities: OpportunityQualityScore[];
  marketSizing: MarketSizingAssessment[];
  entities: MarketEntitySummary[];
  finalValidation: null | {
    status: string;
    validations: Array<Record<string, unknown>>;
    resultSummary: string;
  };
  scoringNote: string;
}
