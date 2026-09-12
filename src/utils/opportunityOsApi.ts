import type { OpportunityStage, OpportunityWorkspace } from '../types/opportunityOs';

async function parseJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
}

export async function listOpportunityWorkspaces(limit = 50, stage?: OpportunityStage): Promise<OpportunityWorkspace[]> {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 100)) });
  if (stage) params.set('stage', stage);
  const response = await fetch(`/api/opportunity-os/workspaces?${params.toString()}`);
  const payload = await parseJson(response);
  return payload.workspaces ?? [];
}

export async function createOpportunityWorkspace(runId: string, opportunityId: string): Promise<OpportunityWorkspace> {
  const response = await fetch('/api/opportunity-os/workspaces/from-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, opportunityId }),
  });
  const payload = await parseJson(response);
  return payload.workspace;
}

export async function getOpportunityWorkspace(workspaceId: string): Promise<OpportunityWorkspace> {
  const response = await fetch(`/api/opportunity-os/workspaces/${encodeURIComponent(workspaceId)}`);
  const payload = await parseJson(response);
  return payload.workspace;
}

export async function setOpportunityStage(workspaceId: string, stage: OpportunityStage): Promise<OpportunityWorkspace> {
  const response = await fetch(`/api/opportunity-os/workspaces/${encodeURIComponent(workspaceId)}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
  const payload = await parseJson(response);
  return payload.workspace;
}
