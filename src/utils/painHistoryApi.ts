import type { PainHistoryResponse, PainScanResult, PersistedPainScan } from '../types';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function listPainScans(limit = 20): Promise<PainHistoryResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const response = await fetch(`/api/pain-scans?limit=${safeLimit}`);
  return readJson<PainHistoryResponse>(response);
}

export async function savePainScan(
  name: string,
  scan: PainScanResult,
  subreddits: string[],
): Promise<PersistedPainScan> {
  const response = await fetch('/api/pain-scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scan, subreddits }),
  });
  const payload = await readJson<{ scan: PersistedPainScan }>(response);
  return payload.scan;
}

export async function deletePainScan(scanId: string): Promise<void> {
  const response = await fetch(`/api/pain-scans/${encodeURIComponent(scanId)}`, { method: 'DELETE' });
  await readJson<{ ok: boolean }>(response);
}
