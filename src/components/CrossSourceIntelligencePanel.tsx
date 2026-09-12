import { useEffect, useMemo, useState } from 'react';
import type {
  CrossSourceHistoryResponse,
  CrossSourcePainReport,
  EvidenceSourceKind,
  EvidenceStats,
  PlatformEvidenceItem,
} from '../types';
import {
  analyzeCrossSourceEvidence,
  fetchEvidenceStats,
  ingestEvidence,
  listCrossSourceScans,
  saveCrossSourceScan,
} from '../utils/evidenceApi';

const SOURCE_KINDS: EvidenceSourceKind[] = [
  'reddit','forum','social','review','github','support','survey','news','blog','community','marketplace','app-store','web','other',
];

export function CrossSourceIntelligencePanel() {
  const [stats, setStats] = useState<EvidenceStats | null>(null);
  const [report, setReport] = useState<CrossSourcePainReport | null>(null);
  const [history, setHistory] = useState<CrossSourceHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [scanName, setScanName] = useState('');
  const [sourceKind, setSourceKind] = useState<EvidenceSourceKind>('web');
  const [sourceName, setSourceName] = useState('');
  const [community, setCommunity] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const strongestSources = useMemo(() => stats?.bySource.slice(0, 6) ?? [], [stats]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchEvidenceStats(), listCrossSourceScans()])
      .then(([nextStats, nextHistory]) => {
        if (!active) return;
        setStats(nextStats);
        setHistory(nextHistory);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Failed to initialize cross-source intelligence');
      });
    return () => { active = false; };
  }, []);

  const refreshStats = async () => {
    setStats(await fetchEvidenceStats());
  };

  const addManualEvidence = async () => {
    if (!text.trim() || isLoading) return;
    setIsLoading(true);
    setMessage('');
    try {
      const item: PlatformEvidenceItem = {
        sourceKind,
        sourceName: sourceName.trim() || sourceKind,
        sourceUrl: sourceUrl.trim() || undefined,
        community: community.trim() || undefined,
        title: title.trim() || undefined,
        text: text.trim(),
      };
      const result = await ingestEvidence([item]);
      setMessage(`Evidence stored (${result.insertedCount} new, ${result.updatedCount} updated).`);
      setText('');
      setTitle('');
      setSourceUrl('');
      await refreshStats();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add evidence');
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const next = await analyzeCrossSourceEvidence();
      setReport(next);
      setMessage(`Analyzed ${next.evidenceScanned.toLocaleString()} evidence items across ${next.sourcesScanned} sources.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to analyze evidence');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnalysis = async () => {
    if (!report || report.clusters.length === 0 || isLoading) return;
    setIsLoading(true);
    setMessage('');
    try {
      const fallback = `Cross-source pain scan ${new Date().toISOString().slice(0, 10)}`;
      await saveCrossSourceScan(scanName.trim() || fallback, report);
      setScanName('');
      setHistory(await listCrossSourceScans());
      setMessage('Cross-source scan saved. Movement comparison updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save analysis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="cross-source card">
      <div className="cross-source-header">
        <div>
          <div className="eyebrow">Cross-source intelligence</div>
          <h2>One evidence layer for every market</h2>
          <p>
            Feed first-hand complaints, reviews, forum threads, GitHub discussions, support posts, social conversations and other public evidence into one pain-intelligence engine.
          </p>
        </div>
        <div className="mcp-ready-badge"><span /> MCP ready</div>
      </div>

      <div className="cross-source-summary">
        <div><span>Evidence stored</span><strong>{stats?.total.toLocaleString() ?? '—'}</strong></div>
        <div><span>Source types</span><strong>{stats?.byKind.length ?? '—'}</strong></div>
        <div><span>Named sources</span><strong>{stats?.bySource.length ?? '—'}</strong></div>
        <div><span>Saved scans</span><strong>{history?.scans.length ?? '—'}</strong></div>
      </div>

      <div className="cross-source-grid">
        <div className="source-inbox">
          <div className="section-heading compact">
            <div><div className="eyebrow">Evidence inbox</div><h3>Manual or agent-collected evidence</h3></div>
          </div>
          <div className="source-form-grid">
            <label className="field-group"><span>Source type</span><select className="input-base" value={sourceKind} onChange={(event) => setSourceKind(event.target.value as EvidenceSourceKind)}>{SOURCE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
            <label className="field-group"><span>Source name</span><input className="input-base" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="G2, Hacker News, GitHub…" /></label>
            <label className="field-group"><span>Community / product</span><input className="input-base" value={community} onChange={(event) => setCommunity(event.target.value)} placeholder="repo, forum, product, group…" /></label>
            <label className="field-group"><span>Evidence URL</span><input className="input-base" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" /></label>
          </div>
          <label className="field-group source-title"><span>Title / context</span><input className="input-base" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short context for this complaint or workflow" /></label>
          <label className="field-group"><span>First-hand evidence</span><textarea className="input-base source-textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the complaint, review, discussion excerpt, workaround description, unmet need, or buying/switching signal…" /></label>
          <div className="source-actions">
            <button className="btn-secondary" onClick={addManualEvidence} disabled={isLoading || !text.trim()}>Add evidence</button>
            <button className="btn-primary" onClick={runAnalysis} disabled={isLoading || !stats?.total}>{isLoading ? 'Working…' : 'Analyze all sources'}</button>
          </div>
        </div>

        <div className="agent-handoff">
          <div className="eyebrow">Agent / harness workflow</div>
          <h3>Let Codex or Claude Code collect the web</h3>
          <p>
            The harness browses and extracts useful first-hand evidence, then calls the local MCP server to ingest and analyze it. Reddit remains a built-in collector, not the product boundary.
          </p>
          <div className="agent-flow">
            <span>1. Search / scrape</span><i>→</i><span>2. ingest_evidence</span><i>→</i><span>3. source_stats</span><i>→</i><span>4. analyze_pain_points</span>
          </div>
          <div className="source-balance">
            <strong>Current source balance</strong>
            {strongestSources.length > 0 ? strongestSources.map((item) => <div key={item.sourceName}><span>{item.sourceName}</span><b>{item.count}</b></div>) : <small>No agent evidence ingested yet.</small>}
          </div>
          <code className="mcp-command">npm run mcp</code>
        </div>
      </div>

      {message && <div className="cross-source-message">{message}</div>}

      {report && (
        <div className="cross-source-results">
          <div className="cross-source-results-head">
            <div><div className="eyebrow">Cross-source pain map</div><h3>Strongest problems across all collected evidence</h3></div>
            <div className="save-cross-source"><input className="input-base" value={scanName} onChange={(event) => setScanName(event.target.value)} placeholder="Snapshot name" /><button className="btn-secondary" onClick={saveAnalysis} disabled={isLoading}>Save scan</button></div>
          </div>
          <div className="cross-source-metrics">
            <span>{report.evidenceScanned} evidence items</span><span>{report.painEvidence} pain evidence</span><span>{report.highIntentEvidence} commercial-intent signals</span><span>{report.workaroundEvidence} workaround signals</span>
          </div>
          <div className="cross-cluster-list">
            {report.clusters.slice(0, 8).map((cluster, index) => (
              <article key={cluster.id} className="cross-cluster">
                <div className="cross-cluster-rank">#{index + 1}</div>
                <div className="cross-cluster-copy"><strong>{cluster.label}</strong><p>{cluster.opportunityReason}</p><small>{cluster.distinctSources} sources · {cluster.distinctCommunities} communities · {cluster.evidenceCount} evidence items</small></div>
                <div className="cross-cluster-score"><strong>{cluster.painScore}</strong><span>pain</span></div>
              </article>
            ))}
          </div>
        </div>
      )}

      {history && history.comparison.length > 0 && (
        <div className="cross-source-movement">
          <div className="eyebrow">Cross-source movement</div>
          <div className="movement-row-list">
            {history.comparison.slice(0, 6).map((item) => <div key={item.id} className="movement-row"><span className={`trend-status status-${item.status}`}>{item.status}</span><strong>{item.label}</strong><span>{item.delta > 0 ? '+' : ''}{item.delta}</span><b>{item.currentScore}</b></div>)}
          </div>
        </div>
      )}
    </section>
  );
}
