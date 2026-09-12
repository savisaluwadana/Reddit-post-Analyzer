import { useEffect, useMemo, useState } from 'react';
import type { ResearchJob } from '../types/researchJobs';
import { createResearchJob, listResearchJobs, refreshResearchCoverage, requeueResearchJob } from '../utils/researchJobsApi';

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

export function ResearchJobsPanel() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const activeJobs = useMemo(() => jobs.filter((job) => !['complete', 'failed'].includes(job.status)).length, [jobs]);
  const completedJobs = useMemo(() => jobs.filter((job) => job.status === 'complete').length, [jobs]);

  const refresh = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      setJobs(await listResearchJobs());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load research jobs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createJob = async () => {
    if (!topic.trim() || isLoading) return;
    setIsLoading(true);
    setMessage('');
    try {
      const job = await createResearchJob({ topic: topic.trim(), audience: audience.trim(), maxPasses: 3 });
      setJobs((previous) => [job, ...previous]);
      setTopic('');
      setAudience('');
      setMessage('Research job queued. A connected Codex/Claude MCP host can claim it automatically.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to queue research job');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCoverage = async (jobId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const updated = await refreshResearchCoverage(jobId);
      setJobs((previous) => previous.map((job) => job._id === updated._id ? updated : job));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to refresh coverage');
    } finally {
      setIsLoading(false);
    }
  };

  const requeue = async (jobId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const updated = await requeueResearchJob(jobId);
      setJobs((previous) => previous.map((job) => job._id === updated._id ? updated : job));
      setMessage('Research job returned to the queue.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to requeue research job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="research-jobs-shell">
      <div className="research-jobs-header">
        <div>
          <div className="eyebrow">Autonomous research queue</div>
          <h3>Start deep research from one question</h3>
          <p>Queue the question here. A connected MCP host can claim it, collect cross-source evidence, fill coverage gaps, run semantic synthesis, validate competitors/pricing, and submit the final verdict.</p>
        </div>
        <div className="research-job-stats">
          <span><b>{activeJobs}</b> active</span>
          <span><b>{completedJobs}</b> complete</span>
        </div>
      </div>

      <div className="research-job-create">
        <label className="field-group">
          <span>Research question / market</span>
          <textarea className="input-base research-job-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Find recurring operational pain for independent dental clinics around scheduling, billing and patient communication" />
        </label>
        <label className="field-group">
          <span>Audience / segment</span>
          <input className="input-base" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="e.g. independent clinic owners and practice managers" />
        </label>
        <button className="btn-primary" disabled={isLoading || !topic.trim()} onClick={() => void createJob()}>{isLoading ? 'Working…' : 'Start deep research'}</button>
      </div>

      <div className="research-job-agent-note">
        <strong>MCP worker command</strong>
        <code>claim_research_job</code>
        <span>The connected host receives the full coverage → gap-fill → semantic → validation protocol. No model API key is stored by this app.</span>
      </div>

      {message && <div className="cross-source-message">{message}</div>}

      <div className="research-job-list">
        {jobs.length === 0 && <div className="research-job-empty">No research jobs yet. Queue a question above.</div>}
        {jobs.slice(0, 12).map((job) => {
          const coverage = job.coverage;
          const metrics = coverage?.metrics;
          const verdicts = job.opportunityValidations.reduce<Record<string, number>>((acc, item) => {
            acc[item.verdict] = (acc[item.verdict] ?? 0) + 1;
            return acc;
          }, {});
          return (
            <article className="research-job-card" key={job._id}>
              <div className="research-job-card-top">
                <div>
                  <span className={`research-job-status status-${job.status}`}>{job.status.replaceAll('-', ' ')}</span>
                  <h4>{job.name}</h4>
                  <p>{job.topic}</p>
                </div>
                <div className="research-job-score">
                  <strong>{coverage?.collectionScore ?? 0}</strong>
                  <span>coverage</span>
                </div>
              </div>

              <div className="research-job-metrics">
                <span><b>{metrics?.totalEvidence ?? 0}</b> evidence</span>
                <span><b>{metrics?.sourceKindCount ?? 0}</b> source types</span>
                <span><b>{metrics?.namedSourceCount ?? 0}</b> named sources</span>
                <span><b>{metrics?.commercialSignals ?? 0}</b> buying signals</span>
                <span><b>{metrics?.workaroundSignals ?? 0}</b> workarounds</span>
                <span><b>{pct(metrics?.recentCoverage)}</b> recent</span>
              </div>

              {metrics?.dominantSourceName && (
                <div className="research-job-concentration">
                  Largest source: <strong>{metrics.dominantSourceName}</strong> · {pct(metrics.dominantSourceShare)} of collected evidence
                </div>
              )}

              {job.gaps.length > 0 && job.status !== 'complete' && (
                <div className="research-job-gaps">
                  <strong>Research gaps</strong>
                  {job.gaps.slice(0, 4).map((gap) => <span key={gap.gap} className={`gap-${gap.priority}`}>{gap.goal}</span>)}
                </div>
              )}

              {job.status === 'complete' && (
                <div className="research-job-result">
                  <strong>Validated outcome</strong>
                  <div className="research-job-verdicts">
                    {Object.entries(verdicts).map(([verdict, count]) => <span key={verdict}>{count} {verdict}</span>)}
                  </div>
                  {job.resultSummary && <p>{job.resultSummary}</p>}
                </div>
              )}

              {job.failureReason && <div className="research-job-failure">{job.failureReason}</div>}

              <div className="research-job-footer">
                <span>Pass {job.researchPass}/{job.maxPasses}</span>
                <span>{job.claimedBy ? `worker: ${job.claimedBy}` : 'waiting for MCP worker'}</span>
                <span>{job.hostRunId ? 'semantic run linked' : 'semantic run pending'}</span>
                <div>
                  <button className="btn-secondary" disabled={isLoading} onClick={() => void refreshCoverage(job._id)}>Refresh coverage</button>
                  {(job.status === 'failed' || job.status === 'claimed') && <button className="btn-secondary" disabled={isLoading} onClick={() => void requeue(job._id)}>Requeue</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
