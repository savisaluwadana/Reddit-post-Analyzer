import { useEffect, useMemo, useState } from 'react';
import type { HostResearchRun } from '../types/hostIntelligence';
import type { OpportunityStage, OpportunityWorkspace } from '../types/opportunityOs';
import { listHostResearchRuns } from '../utils/hostIntelligenceApi';
import { createOpportunityWorkspace, listOpportunityWorkspaces, setOpportunityStage } from '../utils/opportunityOsApi';

const STAGES: OpportunityStage[] = ['research','validation','specification','gtm','building','watch','stopped'];

function score(value: number | undefined) {
  return Number.isFinite(value) ? Math.round(value ?? 0) : 0;
}

function money(value: number | undefined) {
  const numeric = Number(value) || 0;
  if (!numeric) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: numeric >= 1000000 ? 'compact' : 'standard' }).format(numeric);
}

export function OpportunityOsPanel() {
  const [workspaces, setWorkspaces] = useState<OpportunityWorkspace[]>([]);
  const [runs, setRuns] = useState<HostResearchRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const completedRuns = useMemo(() => runs.filter((run) => run.status === 'complete' && run.opportunities.length > 0), [runs]);
  const selectedRun = useMemo(() => completedRuns.find((run) => run._id === selectedRunId) ?? completedRuns[0], [completedRuns, selectedRunId]);
  const selectedOpportunity = useMemo(() => selectedRun?.opportunities.find((item) => item.opportunityId === selectedOpportunityId) ?? selectedRun?.opportunities[0], [selectedRun, selectedOpportunityId]);

  const refresh = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const [nextWorkspaces, nextRuns] = await Promise.all([listOpportunityWorkspaces(100), listHostResearchRuns(50)]);
      setWorkspaces(nextWorkspaces);
      setRuns(nextRuns);
      const firstComplete = nextRuns.find((run) => run.status === 'complete' && run.opportunities.length > 0);
      if (!selectedRunId && firstComplete) {
        setSelectedRunId(firstComplete._id);
        setSelectedOpportunityId(firstComplete.opportunities[0]?.opportunityId ?? '');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load Opportunity OS');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (selectedRun && !selectedRun.opportunities.some((item) => item.opportunityId === selectedOpportunityId)) {
      setSelectedOpportunityId(selectedRun.opportunities[0]?.opportunityId ?? '');
    }
  }, [selectedRun, selectedOpportunityId]);

  const createWorkspace = async () => {
    if (!selectedRun || !selectedOpportunity) return;
    setIsLoading(true);
    setMessage('');
    try {
      const workspace = await createOpportunityWorkspace(selectedRun._id, selectedOpportunity.opportunityId);
      setWorkspaces((previous) => [workspace, ...previous.filter((item) => item._id !== workspace._id)]);
      setMessage(`Workspace ready for ${workspace.title}. Continue through MCP with get_opportunity_execution_pack.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create opportunity workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const changeStage = async (workspaceId: string, stage: OpportunityStage) => {
    setIsLoading(true);
    try {
      const updated = await setOpportunityStage(workspaceId, stage);
      setWorkspaces((previous) => previous.map((item) => item._id === updated._id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update stage');
    } finally {
      setIsLoading(false);
    }
  };

  const sorted = useMemo(() => [...workspaces].sort((a, b) => (b.decision?.decisionScore ?? 0) - (a.decision?.decisionScore ?? 0)), [workspaces]);
  const counts = useMemo(() => {
    const value = { build: 0, validate: 0, watch: 0, stop: 0 };
    workspaces.forEach((workspace) => {
      const recommendation = workspace.decision?.recommendation;
      if (recommendation && recommendation in value) value[recommendation as keyof typeof value] += 1;
    });
    return value;
  }, [workspaces]);

  return (
    <section className="opportunity-os card">
      <div className="opportunity-os-header">
        <div>
          <div className="eyebrow">Founder / Product Opportunity OS</div>
          <h2>Research → validation → build → first customers</h2>
          <p>
            Promote evidence-backed opportunities into durable execution workspaces. Real experiments change the recommendation, so a strong research thesis can still be stopped when customers do not validate it.
          </p>
        </div>
        <div className="opportunity-os-badge"><span /> Outcome feedback loop</div>
      </div>

      <div className="opportunity-os-summary">
        <div><span>Portfolio</span><strong>{workspaces.length}</strong></div>
        <div><span>Build</span><strong>{counts.build}</strong></div>
        <div><span>Validate</span><strong>{counts.validate}</strong></div>
        <div><span>Watch</span><strong>{counts.watch}</strong></div>
        <div><span>Stop</span><strong>{counts.stop}</strong></div>
      </div>

      <div className="opportunity-promoter">
        <div className="opportunity-promoter-copy">
          <div className="eyebrow">Promote from completed research</div>
          <h3>Turn a validated opportunity into an execution workspace</h3>
          <p>The original run, evidence links, market validation and quality score stay attached to the workspace.</p>
        </div>
        <div className="opportunity-promoter-controls">
          <select className="input-base" value={selectedRun?._id ?? ''} onChange={(event) => { setSelectedRunId(event.target.value); setSelectedOpportunityId(''); }} disabled={isLoading || completedRuns.length === 0}>
            {completedRuns.length === 0 && <option value="">No completed opportunity runs yet</option>}
            {completedRuns.map((run) => <option key={run._id} value={run._id}>{run.name}</option>)}
          </select>
          <select className="input-base" value={selectedOpportunity?.opportunityId ?? ''} onChange={(event) => setSelectedOpportunityId(event.target.value)} disabled={isLoading || !selectedRun}>
            {(selectedRun?.opportunities ?? []).map((opportunity) => <option key={opportunity.opportunityId} value={opportunity.opportunityId}>{opportunity.title}</option>)}
          </select>
          <button className="btn-primary" onClick={() => void createWorkspace()} disabled={isLoading || !selectedOpportunity}>{isLoading ? 'Working…' : 'Create workspace'}</button>
          <button className="btn-secondary" onClick={() => void refresh()} disabled={isLoading}>Refresh</button>
        </div>
      </div>

      {message && <div className="opportunity-os-message">{message}</div>}

      {sorted.length === 0 ? (
        <div className="opportunity-os-empty">
          <strong>No promoted opportunities yet.</strong>
          <p>Complete a research run above, promote its strongest opportunity, then let Codex/Claude populate the strategy, validation experiments, MVP spec and first-customer plan through MCP.</p>
          <code>create_opportunity_workspace → get_opportunity_execution_pack → submit_opportunity_strategy → create_validation_experiment</code>
        </div>
      ) : (
        <div className="opportunity-workspace-list">
          {sorted.map((workspace, index) => {
            const decision = workspace.decision;
            const completed = decision?.validation?.completedExperiments ?? 0;
            const paid = decision?.validation?.paidSignals ?? 0;
            const revenue = (workspace.experiments ?? []).reduce((sum, experiment) => sum + (Number(experiment.result?.revenue) || 0), 0);
            const pipeline = (workspace.experiments ?? []).reduce((sum, experiment) => sum + (Number(experiment.result?.pipelineValue) || 0), 0);
            return (
              <article className="opportunity-workspace" key={workspace._id}>
                <div className="opportunity-rank">
                  <span>#{index + 1}</span>
                  <strong>{score(decision?.decisionScore)}</strong>
                  <small>{decision?.recommendation ?? 'validate'}</small>
                </div>
                <div className="opportunity-workspace-body">
                  <div className="opportunity-workspace-title">
                    <div>
                      <small>{workspace.hostRunName}</small>
                      <h3>{workspace.title}</h3>
                    </div>
                    <select value={workspace.stage} onChange={(event) => void changeStage(workspace._id, event.target.value as OpportunityStage)} disabled={isLoading}>
                      {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </div>

                  <p className="opportunity-problem">{String(workspace.researchSnapshot.problem || 'Research problem statement not available.')}</p>

                  <div className="opportunity-metrics">
                    <span><b>{score(workspace.researchScore)}</b> research</span>
                    <span><b>{score(decision?.validation?.score)}</b> validation</span>
                    <span><b>{score(decision?.founderFit?.score)}</b> founder fit</span>
                    <span><b>{completed}</b> experiments</span>
                    <span><b>{paid}</b> paid signals</span>
                    <span><b>{money(revenue)}</b> revenue</span>
                    <span><b>{money(pipeline)}</b> pipeline</span>
                  </div>

                  <div className="opportunity-next-action">
                    <span>Recommended next action</span>
                    <strong>{decision?.nextAction || 'Run real validation before committing engineering time.'}</strong>
                  </div>

                  <div className="opportunity-columns">
                    <div>
                      <span>Strategy</span>
                      <strong>{workspace.strategy?.icp || 'ICP not defined yet'}</strong>
                      <p>{workspace.strategy?.wedge || 'Use submit_opportunity_strategy to define the narrow wedge, buyer and pricing thesis.'}</p>
                    </div>
                    <div>
                      <span>Build spec</span>
                      <strong>{workspace.buildSpec?.productName || 'Not generated yet'}</strong>
                      <p>{workspace.buildSpec?.oneLiner || 'Generate after validation is strong enough to justify an MVP.'}</p>
                    </div>
                    <div>
                      <span>First customers</span>
                      <strong>{workspace.gtmPlan?.firstCustomerProfile || 'Not defined yet'}</strong>
                      <p>{workspace.gtmPlan?.offer || 'The GTM plan will define triggers, channels, outreach angles and the first-10-customer sequence.'}</p>
                    </div>
                  </div>

                  {workspace.experiments.length > 0 && (
                    <div className="opportunity-experiments">
                      {workspace.experiments.slice(-4).reverse().map((experiment) => (
                        <div key={experiment.experimentId}>
                          <span className={`experiment-verdict verdict-${experiment.verdict}`}>{experiment.verdict}</span>
                          <strong>{experiment.title}</strong>
                          <small>{experiment.type} · {experiment.status}</small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="opportunity-os-footer">
        <div><span>Host workflow</span><code>get_opportunity_execution_pack → experiments → submit_build_spec → submit_gtm_plan</code></div>
        <p>A high research score is not permission to build. The system requires real validation and rewards paid signals before recommending a build.</p>
      </div>
    </section>
  );
}
