import type { HostResearchGraph, HostResearchRun } from '../types/hostIntelligence';

const parseJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
};

export async function listHostResearchRuns(limit = 20): Promise<HostResearchRun[]> {
  const response = await fetch(`/api/host-intelligence/runs?limit=${Math.min(Math.max(limit, 1), 50)}`);
  const payload = await parseJson(response);
  return payload.runs ?? [];
}

export async function getHostResearchRun(runId: string): Promise<HostResearchRun> {
  const response = await fetch(`/api/host-intelligence/runs/${encodeURIComponent(runId)}`);
  const payload = await parseJson(response);
  return payload.run;
}

export async function getHostResearchGraph(runId: string): Promise<HostResearchGraph> {
  const response = await fetch(`/api/host-intelligence/runs/${encodeURIComponent(runId)}/graph`);
  const payload = await parseJson(response);
  return payload.graph ?? { nodes: [], edges: [] };
}
