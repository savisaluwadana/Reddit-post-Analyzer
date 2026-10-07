import { useEffect, useState } from 'react';
import { PAGES, type PageId } from '../pages';

interface DashboardProps {
  onNavigate: (page: PageId) => void;
  postCount: number;
  projectCount: number;
}

type Health = { state: 'checking' } | { state: 'ok'; database: string } | { state: 'down'; message: string };

export function Dashboard({ onNavigate, postCount, projectCount }: DashboardProps) {
  const [health, setHealth] = useState<Health>({ state: 'checking' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { ok?: boolean; database?: string };
        if (cancelled) return;
        setHealth(response.ok && body.ok
          ? { state: 'ok', database: body.database ?? 'connected' }
          : { state: 'down', message: `API responded with status ${response.status}` });
      })
      .catch((error: unknown) => {
        if (!cancelled) setHealth({ state: 'down', message: error instanceof Error ? error.message : 'API unreachable' });
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="dash">
      <section className="card dash-status">
        <div>
          <div className="eyebrow">System status</div>
          <h2>
            {health.state === 'checking' && 'Checking…'}
            {health.state === 'ok' && 'Platform is running'}
            {health.state === 'down' && 'Platform API is not reachable'}
          </h2>
          <p className="empty-copy">
            {health.state === 'ok' && `API online · MongoDB ${health.database}`}
            {health.state === 'down' && `${health.message}. Start it with "docker compose up -d" or "npm run server".`}
          </p>
        </div>
        <div className="dash-counters">
          <div className="metric-box"><strong>{postCount}</strong><span>Reddit posts loaded</span></div>
          <div className="metric-box"><strong>{projectCount}</strong><span>Saved Reddit projects</span></div>
        </div>
      </section>

      <section className="card dash-start">
        <div className="eyebrow">How it works</div>
        <h2>Where do you want to start?</h2>
        <ol className="dash-steps">
          <li><strong>Collect</strong> evidence: scrape Reddit, paste your own text, or queue a research job.</li>
          <li><strong>Analyze</strong>: the platform clusters complaints into recurring pain points and scores them.</li>
          <li><strong>Validate</strong>: check evidence quality, then run real experiments on the best opportunities.</li>
        </ol>
        <div className="dash-actions">
          <button type="button" className="btn-primary" onClick={() => onNavigate('reddit')}>Scrape Reddit</button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('evidence')}>Paste my own evidence</button>
          <button type="button" className="btn-secondary" onClick={() => onNavigate('research')}>Queue a research job</button>
        </div>
      </section>

      <div className="dash-grid">
        {PAGES.map((page) => (
          <button type="button" key={page.id} className="card dash-card" onClick={() => onNavigate(page.id)}>
            <span className="dash-card-icon" aria-hidden="true">{page.icon}</span>
            <strong>{page.label}</strong>
            <span className="dash-card-summary">{page.summary}</span>
            <span className="dash-card-when">{page.when}</span>
            <span className={page.needsHost ? 'dash-tag host' : 'dash-tag'}>
              {page.needsHost ? 'Needs Claude Code / Codex connected' : 'Works on its own'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
