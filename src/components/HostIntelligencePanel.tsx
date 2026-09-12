import { useEffect, useMemo, useState } from 'react';
import type { HostResearchGraph, HostResearchRun } from '../types/hostIntelligence';
import { getHostResearchGraph, getHostResearchRun, listHostResearchRuns } from '../utils/hostIntelligenceApi';

function compactScore(value: number | undefined) {
  return Number.isFinite(value) ? Math.round(value ?? 0) : 0;
}

export function HostIntelligencePanel() {
  const [runs, setRuns] = useState<HostResearchRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<HostResearchRun | null>(null);
  const [graph, setGraph] = useState<HostResearchGraph | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const graphTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (graph?.nodes ?? []).forEach((node) => counts.set(node.type, (counts.get(node.type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  const loadRun = async (runId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const [run, nextGraph] = await Promise.all([getHostResearchRun(runId), getHostResearchGraph(runId)]);
      setSelectedRun(run);
      setGraph(nextGraph);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load host intelligence run');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRuns = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const next = await listHostResearchRuns();
      setRuns(next);
      if (next.length > 0) await loadRun(next[0]._id);
      else {
        setSelectedRun(null);
        setGraph(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load host intelligence runs');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    listHostResearchRuns()
      .then(async (next) => {
        if (!active) return;
        setRuns(next);
        if (next.length === 0) return;
        const [run, nextGraph] = await Promise.all([getHostResearchRun(next[0]._id), getHostResearchGraph(next[0]._id)]);
        if (!active) return;
        setSelectedRun(run);
        setGraph(nextGraph);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Failed to initialize host intelligence');
      });
    return () => { active = false; };
  }, []);

  return (
    <section className="host-intelligence card">
      <div className="host-intelligence-header">
        <div>
          <div className="eyebrow">Host-model intelligence</div>
          <h2>Semantic research without a model API key</h2>
          <p>
            Codex or Claude Code does the semantic reasoning inside the connected MCP host session. The platform stores the resulting JTBD, entities, competitors, semantic clusters, opportunities and research graph.
          </p>
        </div>
        <div className="no-key-badge"><span /> No model API key</div>
      </div>

      <div className="host-workflow-strip">
        <span>Collect evidence</span><i>→</i><span>Host annotates batches</span><i>→</i><span>Semantic merge</span><i>→</i><span>Opportunity synthesis</span><i>→</i><span>Research graph</span>
      </div>

      <div className="host-run-toolbar">
        <label className="field-group">
          <span>Host research run</span>
          <select
            className="input-base"
            value={selectedRun?._id ?? ''}
            onChange={(event) => { if (event.target.value) void loadRun(event.target.value); }}
            disabled={isLoading || runs.length === 0}
          >
            {runs.length === 0 && <option value="">No host runs yet</option>}
            {runs.map((run) => <option key={run._id} value={run._id}>{run.name} · {run.status}</option>)}
          </select>
        </label>
        <button className="btn-secondary" onClick={() => void refreshRuns()} disabled={isLoading}>{isLoading ? 'Loading…' : 'Refresh runs'}</button>
        <code className="host-mcp-command">npm run mcp</code>
      </div>

      {message && <div className="cross-source-message">{message}</div>}

      {!selectedRun && (
        <div className="host-empty-state">
          <strong>No semantic host run has been submitted yet.</strong>
          <p>
            Connect Codex or Claude Code through MCP, collect evidence, then ask it to follow <code>research_protocol</code>. The host will create the run and persist its semantic reasoning here.
          </p>
          <div className="host-tool-sequence">
            <span>start_llm_research_run</span><span>get_llm_evidence_batch</span><span>submit_llm_annotations</span><span>get_llm_synthesis_pack</span><span>submit_llm_synthesis</span>
          </div>
        </div>
      )}

      {selectedRun && (
        <>
          <div className="host-run-summary">
            <div><span>Status</span><strong className={`host-status status-${selectedRun.status}`}>{selectedRun.status.replaceAll('-', ' ')}</strong></div>
            <div><span>Evidence annotated</span><strong>{selectedRun.annotations.length.toLocaleString()}</strong></div>
            <div><span>Semantic clusters</span><strong>{selectedRun.clusters.length}</strong></div>
            <div><span>Opportunities</span><strong>{selectedRun.opportunities.length}</strong></div>
            <div><span>Graph nodes</span><strong>{graph?.nodes.length ?? 0}</strong></div>
          </div>

          <div className="host-run-context">
            <div><span>Research topic</span><strong>{selectedRun.topic || 'General pain research'}</strong></div>
            <div><span>Audience</span><strong>{selectedRun.audience || 'Not constrained'}</strong></div>
            <div><span>Harness</span><strong>{selectedRun.harness || 'MCP host'}</strong></div>
            <div><span>Model label</span><strong>{selectedRun.modelLabel || 'Host-provided model'}</strong></div>
          </div>

          {selectedRun.status !== 'complete' && (
            <div className="host-progress-note">
              This run is still <strong>{selectedRun.status.replaceAll('-', ' ')}</strong>. The MCP host should continue fetching evidence batches and submit final synthesis when annotation is complete.
            </div>
          )}

          {selectedRun.clusters.length > 0 && (
            <div className="host-section">
              <div className="section-heading compact"><div><div className="eyebrow">Semantic pain clusters</div><h3>Problems merged by meaning, not keyword overlap</h3></div></div>
              <div className="host-cluster-grid">
                {selectedRun.clusters.slice(0, 8).map((cluster, index) => (
                  <article className="host-cluster-card" key={cluster.clusterId}>
                    <div className="host-card-top"><span>#{index + 1}</span><b>{compactScore(cluster.painScore)}</b></div>
                    <h4>{cluster.label}</h4>
                    <p>{cluster.problemStatement}</p>
                    <div className="host-score-row">
                      <span>severity {compactScore(cluster.severity)}</span>
                      <span>recurrence {compactScore(cluster.recurrence)}</span>
                      <span>intent {compactScore(cluster.commercialIntent)}</span>
                      <span>confidence {compactScore(cluster.confidence)}</span>
                    </div>
                    {cluster.jobsToBeDone[0] && <div className="host-detail"><span>JTBD</span><strong>{cluster.jobsToBeDone[0]}</strong></div>}
                    {cluster.workarounds[0] && <div className="host-detail"><span>Workaround</span><strong>{cluster.workarounds[0]}</strong></div>}
                    {cluster.desiredOutcomes[0] && <div className="host-detail"><span>Desired outcome</span><strong>{cluster.desiredOutcomes[0]}</strong></div>}
                    {cluster.competitors.length > 0 && <div className="host-chip-row">{cluster.competitors.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>}
                  </article>
                ))}
              </div>
            </div>
          )}

          {selectedRun.opportunities.length > 0 && (
            <div className="host-section">
              <div className="section-heading compact"><div><div className="eyebrow">Opportunity ranking</div><h3>What may actually be worth validating or building</h3></div></div>
              <div className="host-opportunity-list">
                {[...selectedRun.opportunities].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 8).map((opportunity, index) => (
                  <article className="host-opportunity" key={opportunity.opportunityId}>
                    <div className="host-opportunity-score"><small>#{index + 1}</small><strong>{compactScore(opportunity.opportunityScore)}</strong><span>opportunity</span></div>
                    <div className="host-opportunity-copy">
                      <h4>{opportunity.title}</h4>
                      <p>{opportunity.problem}</p>
                      <div className="host-opportunity-meta">
                        <span>{opportunity.targetPersona || 'Broad persona'}</span>
                        <span>market {compactScore(opportunity.marketPotential)}</span>
                        <span>intent {compactScore(opportunity.commercialIntent)}</span>
                        <span>competition {compactScore(opportunity.competitionIntensity)}</span>
                        <span>difficulty {compactScore(opportunity.implementationDifficulty)}</span>
                      </div>
                      {opportunity.solutionThesis && <div className="host-thesis"><span>Solution thesis</span><strong>{opportunity.solutionThesis}</strong></div>}
                      {opportunity.nextValidationSteps.length > 0 && <div className="host-validation"><span>Next validation</span><strong>{opportunity.nextValidationSteps.slice(0, 2).join(' · ')}</strong></div>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {graph && graph.nodes.length > 0 && (
            <div className="host-section graph-summary">
              <div><div className="eyebrow">Research graph</div><h3>How the market evidence connects</h3><p>{graph.nodes.length} nodes · {graph.edges.length} relationships generated from host synthesis.</p></div>
              <div className="graph-type-list">
                {graphTypeCounts.slice(0, 8).map(([type, count]) => <span key={type}><b>{count}</b>{type.replaceAll('-', ' ')}</span>)}
              </div>
            </div>
          )}

          {selectedRun.synthesisNotes && <div className="host-synthesis-note"><span>Synthesis notes</span><p>{selectedRun.synthesisNotes}</p></div>}
        </>
      )}
    </section>
  );
}
