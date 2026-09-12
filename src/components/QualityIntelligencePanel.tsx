import { useEffect, useMemo, useState } from 'react';
import type { HostResearchRun } from '../types/hostIntelligence';
import type { QualityIntelligenceSummary } from '../types/qualityIntelligence';
import { listHostResearchRuns } from '../utils/hostIntelligenceApi';
import { getQualityIntelligenceSummary, refreshMarketEntities } from '../utils/qualityIntelligenceApi';

function score(value: number | undefined) {
  return Number.isFinite(value) ? Math.round(value ?? 0) : 0;
}

function signed(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

function compactMoney(value: number, currency = 'USD') {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

export function QualityIntelligencePanel() {
  const [runs, setRuns] = useState<HostResearchRun[]>([]);
  const [runId, setRunId] = useState('');
  const [summary, setSummary] = useState<QualityIntelligenceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const completedRuns = useMemo(() => runs.filter((run) => run.status === 'complete'), [runs]);

  const loadSummary = async (nextRunId: string) => {
    if (!nextRunId) return;
    setIsLoading(true);
    setMessage('');
    try {
      setSummary(await getQualityIntelligenceSummary(nextRunId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load research quality intelligence');
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    listHostResearchRuns(50)
      .then(async (next) => {
        if (!active) return;
        setRuns(next);
        const first = next.find((run) => run.status === 'complete');
        if (!first) return;
        setRunId(first._id);
        const nextSummary = await getQualityIntelligenceSummary(first._id);
        if (active) setSummary(nextSummary);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Failed to initialize research quality intelligence');
      });
    return () => { active = false; };
  }, []);

  const handleEntityRefresh = async () => {
    if (!runId || isLoading) return;
    setIsLoading(true);
    setMessage('');
    try {
      await refreshMarketEntities(runId);
      setSummary(await getQualityIntelligenceSummary(runId));
      setMessage('Canonical market entities refreshed from this research run.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to refresh market entities');
    } finally {
      setIsLoading(false);
    }
  };

  const assessedConsensus = summary?.consensus.filter((item) => item.classifiedEvidence > 0).length ?? 0;
  const lineageTracked = summary?.lineage.filter((item) => item.status !== 'new').length ?? 0;

  return (
    <section className="quality-intelligence card">
      <div className="quality-header">
        <div>
          <div className="eyebrow">Research quality intelligence</div>
          <h2>Challenge the synthesis before you trust it</h2>
          <p>
            Compare pain across runs, measure contradiction and consensus, normalize competitors, rescore opportunities deterministically, and attach sourced market-size ranges instead of relying on one model-generated score.
          </p>
        </div>
        <div className="quality-badge"><span /> Post-synthesis quality gate</div>
      </div>

      <div className="quality-toolbar">
        <label className="field-group">
          <span>Completed semantic run</span>
          <select
            className="input-base"
            value={runId}
            disabled={isLoading || completedRuns.length === 0}
            onChange={(event) => {
              const next = event.target.value;
              setRunId(next);
              void loadSummary(next);
            }}
          >
            {completedRuns.length === 0 && <option value="">No completed runs</option>}
            {completedRuns.map((run) => <option key={run._id} value={run._id}>{run.name}</option>)}
          </select>
        </label>
        <button className="btn-secondary" onClick={() => void loadSummary(runId)} disabled={!runId || isLoading}>{isLoading ? 'Loading…' : 'Refresh quality'}</button>
        <button className="btn-secondary" onClick={() => void handleEntityRefresh()} disabled={!runId || isLoading}>Normalize entities</button>
      </div>

      {message && <div className="cross-source-message">{message}</div>}

      {!summary && (
        <div className="quality-empty">
          <strong>No completed research synthesis is available yet.</strong>
          <p>Complete an autonomous or host semantic research run first. The quality layer operates after synthesis so it can challenge a concrete set of clusters and opportunities.</p>
        </div>
      )}

      {summary && (
        <>
          <div className="quality-summary-grid">
            <div><span>Deterministic opportunities</span><strong>{summary.opportunities.length}</strong></div>
            <div><span>Cross-run cluster matches</span><strong>{lineageTracked}/{summary.lineage.length}</strong></div>
            <div><span>Consensus assessed</span><strong>{assessedConsensus}/{summary.consensus.length}</strong></div>
            <div><span>Canonical entities</span><strong>{summary.entities.length}</strong></div>
            <div><span>Market sizes</span><strong>{summary.marketSizing.length}</strong></div>
          </div>

          <div className="quality-section">
            <div className="section-heading compact">
              <div><div className="eyebrow">Deterministic challenge score</div><h3>Would the opportunity survive a server-side rescore?</h3></div>
            </div>
            <div className="quality-opportunity-list">
              {summary.opportunities.slice(0, 10).map((opportunity, index) => (
                <article className="quality-opportunity" key={opportunity.opportunityId}>
                  <div className="quality-rank">#{index + 1}</div>
                  <div className="quality-opportunity-copy">
                    <strong>{opportunity.title}</strong>
                    <div className="quality-score-components">
                      <span>pain {score(opportunity.components.painStrength)}</span>
                      <span>intent {score(opportunity.components.commercialIntent)}</span>
                      <span>evidence {score(opportunity.components.evidenceSupport)}</span>
                      <span>consensus {score(opportunity.components.consensus)}</span>
                      <span>market sizing {score(opportunity.components.marketSizingConfidence)}</span>
                      <span>competition advantage {score(opportunity.components.competitionAdvantage)}</span>
                    </div>
                  </div>
                  <div className="quality-score-box">
                    <strong>{score(opportunity.deterministicScore)}</strong>
                    <span>{opportunity.interpretation.replaceAll('-', ' ')}</span>
                    <small>host {score(opportunity.hostScore)} · {signed(opportunity.scoreDelta)}</small>
                  </div>
                </article>
              ))}
              {summary.opportunities.length === 0 && <p className="quality-muted">This run did not produce any opportunities.</p>}
            </div>
            <p className="quality-note">{summary.scoringNote}</p>
          </div>

          <div className="quality-two-column">
            <div className="quality-section">
              <div className="eyebrow">Cross-run pain memory</div>
              <h3>New, rising, persistent and falling problems</h3>
              <div className="quality-lineage-list">
                {summary.lineage.slice(0, 12).map((item) => (
                  <div className="quality-lineage-row" key={item.clusterId}>
                    <span className={`trend-status status-${item.status}`}>{item.status}</span>
                    <div><strong>{item.label}</strong><small>{item.previousLabel ? `Matched ${item.previousLabel} · ${Math.round(item.similarity)}% similarity` : 'No credible prior match'}</small></div>
                    <b>{item.painDelta > 0 ? '+' : ''}{Math.round(item.painDelta)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="quality-section">
              <div className="eyebrow">Consensus / contradiction</div>
              <h3>How contested is each pain thesis?</h3>
              <div className="quality-consensus-list">
                {summary.consensus.slice(0, 12).map((item) => (
                  <div className="quality-consensus-row" key={item.clusterId}>
                    <div><strong>{item.clusterId}</strong><small>{item.classifiedEvidence ? `${item.supporting} support · ${item.contradicting} contradict · ${item.mixed} mixed` : 'Not classified yet — run the consensus MCP tools'}</small></div>
                    <div className="quality-consensus-score"><b>{score(item.consensusStrength)}</b><span>consensus</span></div>
                  </div>
                ))}
              </div>
              {assessedConsensus < summary.consensus.length && (
                <code className="quality-command">get_cluster_consensus_pack → submit_cluster_consensus</code>
              )}
            </div>
          </div>

          <div className="quality-two-column">
            <div className="quality-section">
              <div className="eyebrow">Canonical market entities</div>
              <h3>Competitors and alternatives without alias inflation</h3>
              <div className="quality-entity-grid">
                {summary.entities.slice(0, 18).map((entity) => (
                  <div className="quality-entity" key={entity._id}>
                    <strong>{entity.canonicalName}</strong>
                    <span>{entity.entityTypes.join(' · ') || 'entity'}</span>
                    <small>{entity.mentionCount} mentions · {entity.aliases.length} aliases</small>
                  </div>
                ))}
                {summary.entities.length === 0 && <p className="quality-muted">Click <strong>Normalize entities</strong> or call <code>refresh_market_entities</code> through MCP.</p>}
              </div>
            </div>

            <div className="quality-section">
              <div className="eyebrow">Sourced market sizing</div>
              <h3>Ranges, assumptions and confidence</h3>
              <div className="quality-sizing-list">
                {summary.marketSizing.map((item) => (
                  <div className="quality-sizing" key={item._id}>
                    <div><strong>{item.opportunityId}</strong><small>{item.geography || 'Geography not constrained'} · confidence {score(item.confidenceScore)}</small></div>
                    <div className="quality-sizing-ranges">
                      <span>TAM <b>{item.calculations?.tam ? `${compactMoney(item.calculations.tam.low, item.currency)}–${compactMoney(item.calculations.tam.high, item.currency)}` : '—'}</b></span>
                      <span>SAM <b>{item.calculations?.sam ? `${compactMoney(item.calculations.sam.low, item.currency)}–${compactMoney(item.calculations.sam.high, item.currency)}` : '—'}</b></span>
                      <span>SOM <b>{item.calculations?.som ? `${compactMoney(item.calculations.som.low, item.currency)}–${compactMoney(item.calculations.som.high, item.currency)}` : '—'}</b></span>
                    </div>
                  </div>
                ))}
                {summary.marketSizing.length === 0 && (
                  <div className="quality-muted">No sourced sizing yet. Use <code>get_market_sizing_pack</code> and <code>submit_market_sizing_assessment</code> for the strongest opportunities.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
