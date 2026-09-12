export interface ResearchSearchQualityReport {
  generatedAt: string;
  qualityScore: number;
  readyForSynthesis: boolean;
  independence: {
    totalEvidence: number;
    independentEvidenceCount: number;
    nearDuplicateCount: number;
    duplicationRate: number;
    identityGroupCount: number;
    largestIdentityGroupShare: number;
    independentStoryCount?: number;
    storyGroupCount?: number;
    largestStoryGroupSize?: number;
    largestStoryGroupShare?: number;
    effectiveIndependentCount?: number;
    duplicateExamples: Array<{ evidenceId: string; duplicateOf: string; similarity: number }>;
  };
  signals: {
    strongCommercial: number;
    workaround: number;
    contradictionCandidates: number;
    quantifiedImpact: number;
  };
  diversity: {
    namedSources: number;
    communities: number;
    identifiableAuthors: number;
    identityGroups?: number;
  };
  deepScraping: {
    runs: number;
    evidenceAdded: number;
  };
  gaps: Array<{ type: string; priority: 'high' | 'medium' | 'low'; message: string }>;
}

const parseJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
};

export async function getResearchSearchQuality(jobId: string): Promise<ResearchSearchQualityReport> {
  const response = await fetch(`/api/research-search/jobs/${encodeURIComponent(jobId)}/quality`);
  const payload = await parseJson(response);
  return payload.report;
}
