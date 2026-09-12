import type { QualityIntelligenceSummary } from '../types/qualityIntelligence';

const parseJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
};

export async function getQualityIntelligenceSummary(runId: string): Promise<QualityIntelligenceSummary> {
  const response = await fetch(`/api/quality-intelligence/runs/${encodeURIComponent(runId)}/summary`);
  const payload = await parseJson(response);
  return payload.summary;
}

export async function refreshMarketEntities(runId: string): Promise<void> {
  const response = await fetch(`/api/quality-intelligence/runs/${encodeURIComponent(runId)}/entities/refresh`, { method: 'POST' });
  await parseJson(response);
}
