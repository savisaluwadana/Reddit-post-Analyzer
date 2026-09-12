import type { ScrapeSessionSummary } from '../types/scrapeIntelligence';

const parseJson = async (response: Response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Request failed with HTTP ${response.status}`);
  return payload;
};

export async function getScrapeSessionSummary(jobId: string): Promise<ScrapeSessionSummary> {
  const response = await fetch(`/api/scrape-intelligence/jobs/${encodeURIComponent(jobId)}/summary`);
  const payload = await parseJson(response);
  return payload.session;
}

export async function startScrapeSession(jobId: string): Promise<ScrapeSessionSummary> {
  const response = await fetch(`/api/scrape-intelligence/jobs/${encodeURIComponent(jobId)}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: {} }),
  });
  const payload = await parseJson(response);
  return payload.session;
}

export async function reopenScrapeSession(jobId: string): Promise<ScrapeSessionSummary> {
  const response = await fetch(`/api/scrape-intelligence/jobs/${encodeURIComponent(jobId)}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const payload = await parseJson(response);
  return payload.session;
}
