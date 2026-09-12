import { useMemo, useState } from 'react';
import type { PainCategory, PainHistoryResponse, PainScanResult, RedditPost } from '../types';
import { deletePainScan, listPainScans, savePainScan } from '../utils/painHistoryApi';
import { buildPainScan, rankPostsForPainScan } from '../utils/painIntelligence';
import { fetchCommentsForPosts } from '../utils/threadApi';

interface PainPointLabProps {
  posts: RedditPost[];
}

const CATEGORY_LABELS: Record<PainCategory, string> = {
  'manual-work': 'Manual work', integration: 'Integration', reliability: 'Reliability', performance: 'Performance',
  cost: 'Cost', usability: 'Usability', visibility: 'Visibility / tracking', 'security-compliance': 'Security / compliance',
  'setup-onboarding': 'Setup / onboarding', 'workflow-process': 'Workflow / process', 'missing-capability': 'Missing capability',
  support: 'Support', 'data-migration': 'Data / transfer', 'access-availability': 'Access / availability', quality: 'Quality / accuracy',
  communication: 'Communication', 'billing-payments': 'Billing / payments', 'fulfillment-logistics': 'Delivery / logistics',
  'trust-safety': 'Trust / safety', 'discovery-comparison': 'Discovery / comparison',
};

function reportText(report: PainScanResult) {
  const lines = [
    'Pain Point Intelligence Report',
    `Posts scanned: ${report.postsScanned} | Comments scanned: ${report.commentsScanned}`,
    `Pain posts: ${report.painPosts} | Pain comments: ${report.painComments}`,
    '',
  ];
  report.clusters.slice(0, 10).forEach((cluster, index) => {
    lines.push(`${index + 1}. ${cluster.label} — ${cluster.painScore}/100`);
    lines.push(`Severity ${cluster.severity} | Recurrence ${cluster.recurrence} | Commercial intent ${cluster.commercialIntent} | Urgency ${cluster.urgency} | Workaround ${cluster.workaroundBurden} | Confidence ${cluster.confidence}`);
    lines.push(`Evidence: ${cluster.evidenceCount} across ${cluster.distinctPosts} threads / ${cluster.distinctSubreddits} communities`);
    lines.push(`Who: ${cluster.personas.join(', ')}`);
    lines.push(`Why it matters: ${cluster.opportunityReason}`);
    lines.push('');
  });
  return lines.join('\n');
}

export function PainPointLab({ posts }: PainPointLabProps) {
  const [scanState, setScanState] = useState<{ postsKey: string; result: PainScanResult } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [maxThreads, setMaxThreads] = useState(12);
  const [commentsPerThread, setCommentsPerThread] = useState(35);
  const [category, setCategory] = useState<'all' | PainCategory>('all');
  const [history, setHistory] = useState<PainHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scanName, setScanName] = useState('');
  const [historyMessage, setHistoryMessage] = useState('');

  const postsKey = useMemo(() => posts.map((post) => post.id).join('|'), [posts]);
  const preview = useMemo(() => buildPainScan(posts), [posts]);
  const scan = scanState?.postsKey === postsKey ? scanState.result : null;
  const report = scan ?? preview;
  const subreddits = useMemo(() => [...new Set(posts.map((post) => post.subreddit))], [posts]);

  const clusters = useMemo(() => report.clusters.filter((cluster) => category === 'all' || cluster.category === category).slice(0, 14), [report, category]);

  const runDeepScan = async () => {
    if (posts.length === 0 || isScanning) return;
    setIsScanning(true);
    setCompleted(0);
    try {
      const targetPosts = rankPostsForPainScan(posts).slice(0, Math.min(maxThreads, posts.length));
      setScanTotal(targetPosts.length);
      const { comments, errors } = await fetchCommentsForPosts(targetPosts, commentsPerThread, 3, (done, total) => {
        setCompleted(done);
        setScanTotal(total);
      });
      setScanState({ postsKey, result: buildPainScan(posts, comments, errors) });
    } finally {
      setIsScanning(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryMessage('');
    try {
      setHistory(await listPainScans());
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Failed to load pain history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const persistCurrentScan = async () => {
    if (report.clusters.length === 0 || historyLoading) return;
    setHistoryLoading(true);
    setHistoryMessage('');
    try {
      const fallbackName = `${subreddits.slice(0, 3).map((item) => `r/${item}`).join(' + ') || 'Reddit'} pain scan`;
      await savePainScan(scanName.trim() || fallbackName, report, subreddits);
      setScanName('');
      setHistory(await listPainScans());
      setHistoryMessage('Pain scan saved. Trend comparison updated.');
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Failed to save pain scan');
    } finally {
      setHistoryLoading(false);
    }
  };

  const removeSavedScan = async (scanId: string) => {
    setHistoryLoading(true);
    try {
      await deletePainScan(scanId);
      setHistory(await listPainScans());
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Failed to delete pain scan');
    } finally {
      setHistoryLoading(false);
    }
  };

  const copyReport = async () => navigator.clipboard.writeText(reportText(report));
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reddit-pain-scan-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (posts.length === 0) return null;

  return (
    <section className="pain-lab card">
      <div className="pain-lab-header">
        <div>
          <div className="eyebrow">Reddit source adapter · pain intelligence</div>
          <h2>Validate recurring problems inside Reddit threads</h2>
          <p>{scan ? `Deep scan enriched with ${scan.commentsScanned.toLocaleString()} comments from the strongest threads.` : 'Post-only preview. Run a deep scan to validate pain inside the comment threads.'}</p>
        </div>
        <div className="pain-mode-badge">{scan ? 'Deep evidence' : 'Post preview'}</div>
      </div>

      <div className="deep-scan-controls">
        <label className="field-group"><span>Threads to inspect</span><select className="input-base" value={maxThreads} onChange={(event) => setMaxThreads(Number(event.target.value))} disabled={isScanning}><option value={8}>8 threads</option><option value={12}>12 threads</option><option value={20}>20 threads</option><option value={30}>30 threads</option></select></label>
        <label className="field-group"><span>Top comments / thread</span><select className="input-base" value={commentsPerThread} onChange={(event) => setCommentsPerThread(Number(event.target.value))} disabled={isScanning}><option value={20}>20 comments</option><option value={35}>35 comments</option><option value={50}>50 comments</option><option value={75}>75 comments</option></select></label>
        <button className="btn-primary deep-scan-button" onClick={runDeepScan} disabled={isScanning}>{isScanning ? `Scanning ${completed}/${scanTotal || '…'}` : scan ? 'Run deep scan again' : 'Run deep pain scan'}</button>
        <button className="btn-secondary" onClick={copyReport}>Copy report</button>
        <button className="btn-secondary" onClick={exportJson}>Export JSON</button>
      </div>

      {isScanning && <div className="scan-progress" aria-live="polite"><div style={{ width: `${scanTotal > 0 ? (completed / scanTotal) * 100 : 0}%` }} /></div>}

      <div className="pain-summary-grid">
        <div><span>Recurring clusters</span><strong>{report.clusters.length}</strong></div><div><span>Pain evidence</span><strong>{(report.painPosts + report.painComments).toLocaleString()}</strong></div><div><span>Commercial intent</span><strong>{report.highIntentEvidence}</strong></div><div><span>Workaround signals</span><strong>{report.workaroundEvidence}</strong></div><div><span>Comments analyzed</span><strong>{report.commentsScanned.toLocaleString()}</strong></div>
      </div>

      <div className="pain-history-toolbar">
        <label className="field-group"><span>Snapshot name</span><input className="input-base" value={scanName} onChange={(event) => setScanName(event.target.value)} placeholder="e.g. Customer pain scan — September" maxLength={100} /></label>
        <button className="btn-primary" onClick={persistCurrentScan} disabled={historyLoading || report.clusters.length === 0}>{historyLoading ? 'Working…' : 'Save pain snapshot'}</button>
        <button className="btn-secondary" onClick={loadHistory} disabled={historyLoading}>{history ? 'Refresh history' : 'Load pain history'}</button>
        {historyMessage && <span className="history-message">{historyMessage}</span>}
      </div>

      {history && (
        <div className="pain-history-grid">
          <div className="pain-history-card">
            <div className="eyebrow">Pain movement</div><h3>What changed since the previous scan</h3>
            <div className="pain-delta-list">
              {history.comparison.slice(0, 8).map((item) => <div className="pain-delta-row" key={item.id}><span className={`trend-status status-${item.status}`}>{item.status}</span><div><strong>{item.label}</strong><small>{CATEGORY_LABELS[item.category]} · confidence {item.currentConfidence} · intent {item.commercialIntent}</small></div><span className="delta-score">{item.delta > 0 ? '+' : ''}{item.delta}</span><span className="score-chip hot">{item.currentScore}</span></div>)}
              {history.comparison.length === 0 && <span className="empty-copy">Save at least two scans to compare pain movement.</span>}
            </div>
          </div>
          <div className="pain-history-card">
            <div className="eyebrow">Research archive</div><h3>Recent saved scans</h3>
            <div className="saved-scan-list">
              {history.scans.slice(0, 6).map((item) => <div className="saved-scan-row" key={item._id}><div><strong>{item.name}</strong><small>{new Date(item.createdAt).toLocaleDateString()} · {item.clusters.length} clusters · {item.commentsScanned} comments</small></div><button className="btn-secondary compact-button" onClick={() => removeSavedScan(item._id)} disabled={historyLoading}>Delete</button></div>)}
              {history.scans.length === 0 && <span className="empty-copy">No saved pain scans yet.</span>}
            </div>
          </div>
        </div>
      )}

      <div className="pain-grid">
        <div className="pain-landscape"><div className="pain-section-title"><div><div className="eyebrow">Pain landscape</div><h3>Categories with the strongest evidence</h3></div></div><div className="category-bars">{report.categories.slice(0, 8).map((item) => <button key={item.category} className="category-bar-row" onClick={() => setCategory(item.category)}><div className="category-bar-copy"><span>{CATEGORY_LABELS[item.category]}</span><small>{item.evidenceCount} evidence items</small></div><div className="category-bar-track"><div style={{ width: `${item.painScore}%` }} /></div><strong>{item.painScore}</strong></button>)}</div></div>
        <div className="persona-panel"><div className="eyebrow">Who feels the pain</div><h3>Likely affected personas</h3><div className="persona-list">{report.topPersonas.map((item) => <div key={item.persona} className="persona-row"><span>{item.persona}</span><strong>{item.mentions}</strong></div>)}</div></div>
      </div>

      <div className="pain-cluster-heading"><div><div className="eyebrow">Ranked pain clusters</div><h3>Highest-value problems to investigate</h3></div><select className="input-base pain-category-select" value={category} onChange={(event) => setCategory(event.target.value as 'all' | PainCategory)}><option value="all">All pain categories</option>{(Object.keys(CATEGORY_LABELS) as PainCategory[]).map((key) => <option value={key} key={key}>{CATEGORY_LABELS[key]}</option>)}</select></div>

      <div className="pain-cluster-list">{clusters.map((cluster, index) => <article className="pain-cluster" key={cluster.id}><div className="pain-cluster-top"><div><div className="cluster-rank">#{index + 1} · {CATEGORY_LABELS[cluster.category]}</div><h3>{cluster.label}</h3><p>{cluster.opportunityReason}</p></div><div className="pain-score-orb"><strong>{cluster.painScore}</strong><span>pain score</span></div></div><div className="pain-dimensions"><div><span>Severity</span><strong>{cluster.severity}</strong></div><div><span>Recurrence</span><strong>{cluster.recurrence}</strong></div><div><span>Commercial intent</span><strong>{cluster.commercialIntent}</strong></div><div><span>Urgency</span><strong>{cluster.urgency}</strong></div><div><span>Workaround burden</span><strong>{cluster.workaroundBurden}</strong></div><div><span>Confidence</span><strong>{cluster.confidence}</strong></div></div><div className="cluster-meta"><span>{cluster.evidenceCount} evidence items</span><span>{cluster.distinctPosts} threads</span><span>{cluster.distinctSubreddits} communities</span><span>{cluster.personas.join(' · ')}</span></div><div className="cluster-keywords">{cluster.keywords.slice(0, 7).map((keyword) => <span key={keyword}>{keyword}</span>)}</div><div className="evidence-list">{cluster.evidence.slice(0, 4).map((item, evidenceIndex) => <div className="evidence-card" key={`${cluster.id}-${evidenceIndex}`}><div className="evidence-meta"><span>{item.sourceType === 'comment' ? 'COMMENT' : 'POST'}</span><span>r/{item.subreddit}</span><span>{item.score.toLocaleString()} pts</span></div><p>“{item.text}”</p><div className="evidence-footer"><span>severity {item.severity} · intent {item.commercialIntent} · urgency {item.urgency} · workaround {item.workaroundBurden}</span>{item.permalink && <a href={item.permalink} target="_blank" rel="noopener noreferrer">Open evidence ↗</a>}</div></div>)}</div></article>)}</div>

      {report.errors.length > 0 && <details className="pain-errors"><summary>{report.errors.length} thread scans could not be loaded</summary>{report.errors.map((error) => <div key={error}>{error}</div>)}</details>}
    </section>
  );
}
