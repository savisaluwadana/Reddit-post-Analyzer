import { useEffect, useMemo, useState } from 'react';
import type { ResearchJob } from '../types/researchJobs';
import type { ScrapeSessionSummary } from '../types/scrapeIntelligence';
import { listResearchJobs } from '../utils/researchJobsApi';
import { getScrapeSessionSummary, reopenScrapeSession, startScrapeSession } from '../utils/scrapeIntelligenceApi';

function pct(value: number) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function ScrapeIntelligencePanel() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [summary, setSummary] = useState<ScrapeSessionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedJob = useMemo(() => jobs.find((job) => job._id === selectedJobId), [jobs, selectedJobId]);

  const loadSummary = async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    setMessage('');
    try {
      setSummary(await getScrapeSessionSummary(jobId));
    } catch (error) {
      setSummary(null);
      setMessage(error instanceof Error && /not found/i.test(error.message)
        ? 'No adaptive scrape session exists for this job yet.'
        : error instanceof Error ? error.message : 'Failed to load scrape session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const items = await listResearchJobs(30);
        setJobs(items);
        if (items[0]) setSelectedJobId(items[0]._id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load research jobs');
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedJobId) void loadSummary(selectedJobId);
  }, [selectedJobId]);

  const handleStart = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    try {
      setSummary(await startScrapeSession(selectedJobId));
      setMessage('Adaptive scrape session ready. The MCP host can now rank and traverse discovered public URLs.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start scrape session');
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    try {
      setSummary(await reopenScrapeSession(selectedJobId));
      setMessage('Scrape session reopened. Use this only when a meaningful evidence gap justifies another pass.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reopen scrape session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="scrape-intelligence card">
      <div className="scrape-header">
        <div>
          <div className="eyebrow">Adaptive crawl intelligence</div>
          <h2>Best-evidence scraping</h2>
          <p>Ranks public URLs by expected information gain, tracks extraction quality, and stops automatically when the crawl starts producing duplicates or low-value evidence.</p>
        </div>
        <div className="scrape-controls">
          <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
            <option value="">Select research job</option>
            {jobs.map((job) => <option key={job._id} value={job._id}>{job.name} · {job.status}</option>)}
          </select>
          <button type="button" onClick={() => selectedJobId && void loadSummary(selectedJobId)} disabled={!selectedJobId || loading}>Refresh</button>
          {!summary && <button type="button" className="primary" onClick={handleStart} disabled={!selectedJobId || loading}>Start session</button>}
          {summary?.stopped && <button type="button" onClick={handleReopen} disabled={loading}>Reopen</button>}
        </div>
      </div>

      {selectedJob && <div className="scrape-job-context"><strong>{selectedJob.topic}</strong>{selectedJob.audience ? ` · ${selectedJob.audience}` : ''}</div>}
      {message && <div className="scrape-message">{message}</div>}

      {summary && (
        <>
          <div className={`scrape-state ${summary.stopped ? 'stopped' : 'running'}`}>
            <strong>{summary.stopped ? `Stopped: ${summary.stopReason || summary.stopDecision.reason}` : 'Adaptive crawl active'}</strong>
            <span>{summary.stopped ? 'The crawler hit a quality/budget stop rule. Reopen only when new evidence gaps justify it.' : 'The host should keep following the highest-ranked frontier until a stop rule fires.'}</span>
          </div>

          <div className="scrape-stats">
            <div><span>Pages</span><strong>{summary.stats.pagesVisited}</strong></div>
            <div><span>Evidence</span><strong>{summary.stats.evidenceAdded}</strong></div>
            <div><span>Frontier</span><strong>{summary.stats.frontierCount}</strong></div>
            <div><span>Hosts</span><strong>{summary.stats.candidateHosts}</strong></div>
            <div><span>Extraction quality</span><strong>{Math.round(summary.stats.averageExtractionQuality)}</strong></div>
            <div><span>Duplicate rate</span><strong>{pct(summary.stats.duplicateRate)}</strong></div>
            <div><span>Blocked share</span><strong>{pct(summary.stats.blockedShare)}</strong></div>
            <div><span>Recent yield/page</span><strong>{summary.stopDecision.recentAverageYield ?? '—'}</strong></div>
          </div>

          <div className="scrape-grid">
            <div className="scrape-panel">
              <div className="scrape-panel-title"><strong>Priority frontier</strong><span>Highest information gain first</span></div>
              {summary.frontier.length === 0 ? <p className="muted">No queued URLs.</p> : (
                <div className="scrape-list">
                  {summary.frontier.slice(0, 10).map((item) => (
                    <div className="scrape-row" key={item.canonicalUrl}>
                      <div className="scrape-score">{Math.round(item.score)}</div>
                      <div>
                        <strong>{item.title || item.sourceKind || 'Public page'}</strong>
                        <a href={item.canonicalUrl} target="_blank" rel="noreferrer">{item.canonicalUrl}</a>
                        <small>{item.sourceKind} · depth {item.depth}{item.reasons.length ? ` · ${item.reasons.join(' · ')}` : ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="scrape-panel">
              <div className="scrape-panel-title"><strong>Recent extraction quality</strong><span>What the crawler actually produced</span></div>
              {summary.recentPages.length === 0 ? <p className="muted">No pages recorded yet.</p> : (
                <div className="scrape-list">
                  {summary.recentPages.slice(0, 10).map((page) => (
                    <div className="scrape-row" key={page.canonicalUrl}>
                      <div className={`scrape-grade ${page.qualityGrade || 'weak'}`}>{Math.round(page.qualityScore)}</div>
                      <div>
                        <a href={page.canonicalUrl} target="_blank" rel="noreferrer">{page.canonicalUrl}</a>
                        <small>{page.qualityGrade || page.status} · +{page.evidenceAdded} evidence · {page.duplicateEvidence} duplicates · {page.discoveredLinks} links</small>
                        {page.accessReason && page.accessReason !== 'public-accessible' && <small className="scrape-warning">{page.accessReason}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="scrape-policy">
            <strong>Crawl budget</strong>
            <span>{summary.policy.maxPages ?? 80} pages max</span>
            <span>{summary.policy.evidenceTarget ?? 60} evidence target</span>
            <span>{summary.policy.maxPerHost ?? 6} URLs/host per batch</span>
            <span>stop at {pct(summary.policy.maxDuplicateRate ?? 0.45)} duplicate saturation</span>
          </div>
        </>
      )}
    </section>
  );
}
