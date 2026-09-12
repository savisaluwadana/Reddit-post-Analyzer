import type { CreateResearchJobInput, ResearchJob } from '../types/researchJobs';

const parseJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
};

export async function listResearchJobs(limit = 30): Promise<ResearchJob[]> {
  const response = await fetch(`/api/research-jobs?limit=${Math.min(Math.max(limit, 1), 100)}`);
  const payload = await parseJson(response);
  return payload.jobs ?? [];
}

export async function createResearchJob(input: CreateResearchJobInput): Promise<ResearchJob> {
  const response = await fetch('/api/research-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  return payload.job;
}

export async function getResearchJob(jobId: string): Promise<ResearchJob> {
  const response = await fetch(`/api/research-jobs/${encodeURIComponent(jobId)}`);
  const payload = await parseJson(response);
  return payload.job;
}

export async function refreshResearchCoverage(jobId: string): Promise<ResearchJob> {
  const response = await fetch(`/api/research-jobs/${encodeURIComponent(jobId)}/coverage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advancePass: false }),
  });
  const payload = await parseJson(response);
  return payload.job;
}

export async function requeueResearchJob(jobId: string): Promise<ResearchJob> {
  const response = await fetch(`/api/research-jobs/${encodeURIComponent(jobId)}/requeue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await parseJson(response);
  return payload.job;
}
