import type {
  CrossSourceHistoryResponse,
  CrossSourcePainReport,
  EvidenceStats,
  PlatformEvidenceItem,
} from '../types';

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload as T;
}

export async function fetchEvidenceStats(): Promise<EvidenceStats> {
  return readJson(await fetch('/api/evidence/stats'), 'Failed to load evidence stats');
}

export async function ingestEvidence(items: PlatformEvidenceItem[], batchId = 'manual-ui') {
  return readJson<{ processedCount: number; insertedCount: number; updatedCount: number }>(
    await fetch('/api/evidence/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, batchId, ingestedBy: 'manual-ui' }),
    }),
    'Failed to ingest evidence',
  );
}

export async function analyzeCrossSourceEvidence(filters: Record<string, unknown> = {}): Promise<CrossSourcePainReport> {
  const payload = await readJson<{ report: CrossSourcePainReport }>(
    await fetch('/api/evidence/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, ...filters }),
    }),
    'Failed to analyze cross-source evidence',
  );
  return payload.report;
}

export async function listCrossSourceScans(): Promise<CrossSourceHistoryResponse> {
  return readJson(await fetch('/api/evidence/scans?limit=20'), 'Failed to load cross-source scan history');
}

export async function saveCrossSourceScan(name: string, report: CrossSourcePainReport, filters: Record<string, unknown> = {}) {
  return readJson(
    await fetch('/api/evidence/scans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, report, filters }),
    }),
    'Failed to save cross-source scan',
  );
}
