export interface ScrapeFrontierItem {
  url: string;
  canonicalUrl: string;
  rootUrl: string;
  sourceKind: string;
  depth: number;
  score: number;
  action: string;
  status: string;
  title: string;
  context: string;
  reasons: string[];
}

export interface ScrapePageResult {
  canonicalUrl: string;
  rootUrl: string;
  sourceKind: string;
  depth: number;
  status: string;
  accessAction: string;
  accessReason: string;
  qualityScore: number;
  qualityGrade: string;
  qualityIssues: string[];
  claimCount: number;
  evidenceAdded: number;
  duplicateEvidence: number;
  discoveredLinks: number;
  visitedAt: string;
}

export interface ScrapeSessionSummary {
  jobId: string;
  stopped: boolean;
  stopReason: string;
  policy: {
    maxPages?: number;
    evidenceTarget?: number;
    minMarginalYield?: number;
    maxDuplicateRate?: number;
    maxBlockedShare?: number;
    maxPerHost?: number;
  };
  stats: {
    pagesVisited: number;
    successfulPages: number;
    blockedPages: number;
    evidenceAdded: number;
    duplicateEvidence: number;
    duplicateRate: number;
    blockedShare: number;
    frontierCount: number;
    averageExtractionQuality: number;
    candidateHosts: number;
  };
  stopDecision: {
    stop: boolean;
    reason: string;
    recentAverageYield: number | null;
  };
  frontier: ScrapeFrontierItem[];
  recentPages: ScrapePageResult[];
  updatedAt?: string;
}
