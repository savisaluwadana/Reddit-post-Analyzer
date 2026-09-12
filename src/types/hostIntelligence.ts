export type HostResearchRunStatus = 'annotating' | 'ready-for-synthesis' | 'complete';

export interface HostEntity {
  name: string;
  type: string;
}

export interface HostEvidenceAnnotation {
  evidenceId: string;
  canonicalPain: string;
  painCategory: string;
  persona: string;
  segment: string;
  jobToBeDone: string;
  currentWorkflow: string;
  workaround: string;
  desiredOutcome: string;
  quantifiedImpact: string[];
  entities: HostEntity[];
  competitors: string[];
  purchaseIntent: 'none' | 'weak' | 'medium' | 'strong';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  semanticClusterKey: string;
  semanticClusterLabel: string;
  evidenceQuality: number;
  llmConfidence: number;
  notes: string;
}

export interface HostSemanticCluster {
  clusterId: string;
  label: string;
  problemStatement: string;
  summary: string;
  personas: string[];
  segments: string[];
  jobsToBeDone: string[];
  workarounds: string[];
  desiredOutcomes: string[];
  entities: HostEntity[];
  competitors: string[];
  evidenceIds: string[];
  painScore: number;
  severity: number;
  recurrence: number;
  commercialIntent: number;
  urgency: number;
  workaroundBurden: number;
  sourceDiversity: number;
  evidenceQuality: number;
  confidence: number;
  whyNow: string;
  risks: string[];
}

export interface HostOpportunity {
  opportunityId: string;
  title: string;
  problem: string;
  targetPersona: string;
  segment: string;
  jobToBeDone: string;
  solutionThesis: string;
  whyNow: string;
  willingnessToPay: string;
  currentAlternatives: string[];
  differentiation: string;
  evidenceIds: string[];
  clusterIds: string[];
  painStrength: number;
  marketPotential: number;
  commercialIntent: number;
  competitionIntensity: number;
  implementationDifficulty: number;
  confidence: number;
  opportunityScore: number;
  risks: string[];
  nextValidationSteps: string[];
}

export interface HostResearchRun {
  _id: string;
  name: string;
  status: HostResearchRunStatus;
  topic: string;
  audience: string;
  harness: string;
  modelLabel: string;
  annotations: HostEvidenceAnnotation[];
  clusters: HostSemanticCluster[];
  opportunities: HostOpportunity[];
  coverage: Record<string, unknown>;
  synthesisNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface HostGraphNode {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface HostGraphEdge {
  from: string;
  to: string;
  type: string;
}

export interface HostResearchGraph {
  nodes: HostGraphNode[];
  edges: HostGraphEdge[];
}
