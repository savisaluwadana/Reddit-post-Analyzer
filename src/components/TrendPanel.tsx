import type { TrendPoint, TrendResponse } from '../types';

interface TrendPanelProps {
  trend: TrendResponse | null;
  days: number;
  setDays: (days: number) => void;
  subreddit: string;
  setSubreddit: (subreddit: string) => void;
  availableSubreddits: string[];
  isLoading: boolean;
  onRefresh: () => void;
}

function buildPolyline(points: TrendPoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const values = points.map((point) => point.avgScore);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - ((point.avgScore - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function TrendPanel({
  trend,
  days,
  setDays,
  subreddit,
  setSubreddit,
  availableSubreddits,
  isLoading,
  onRefresh,
}: TrendPanelProps) {
  const points = trend?.points ?? [];
  const latest = points.at(-1);
  const earliest = points[0];
  const scoreChange = latest && earliest ? latest.avgScore - earliest.avgScore : 0;
  const commentChange = latest && earliest ? latest.avgComments - earliest.avgComments : 0;
  const polyline = buildPolyline(points, 720, 150);

  return (
    <section className="card trend-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Historical intelligence</div>
          <h2>See which conversations are gaining momentum</h2>
        </div>
        <div className="trend-controls">
          <select className="input-base compact-select" value={subreddit} onChange={(event) => setSubreddit(event.target.value)}>
            <option value="">All communities</option>
            {availableSubreddits.map((item) => <option key={item} value={item}>r/{item}</option>)}
          </select>
          <select className="input-base compact-select" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button className="btn-secondary" onClick={onRefresh} disabled={isLoading}>{isLoading ? 'Loading...' : 'Refresh history'}</button>
        </div>
      </div>

      {!trend || points.length === 0 ? (
        <div className="trend-empty">
          <strong>No historical snapshots yet.</strong>
          <span>Save fetched posts over time to build score and comment trajectories.</span>
        </div>
      ) : (
        <>
          <div className="trend-metric-grid">
            <div className="metric-box">
              <strong>{latest?.trackedPosts ?? 0}</strong>
              <span>Tracked posts</span>
            </div>
            <div className="metric-box">
              <strong>{latest ? Math.round(latest.avgScore).toLocaleString() : 0}</strong>
              <span>Latest avg score</span>
            </div>
            <div className="metric-box">
              <strong>{scoreChange >= 0 ? '+' : ''}{Math.round(scoreChange)}</strong>
              <span>Avg score movement</span>
            </div>
            <div className="metric-box">
              <strong>{commentChange >= 0 ? '+' : ''}{Math.round(commentChange)}</strong>
              <span>Avg comment movement</span>
            </div>
          </div>

          <div className="trend-chart-shell">
            <div className="trend-chart-labels">
              <span>Average Reddit score</span>
              <span>{points[0]?.date} → {points.at(-1)?.date}</span>
            </div>
            <svg className="trend-chart" viewBox="0 0 720 170" role="img" aria-label="Average Reddit score over time">
              <line x1="0" y1="25" x2="720" y2="25" className="chart-grid-line" />
              <line x1="0" y1="85" x2="720" y2="85" className="chart-grid-line" />
              <line x1="0" y1="145" x2="720" y2="145" className="chart-grid-line" />
              <polyline points={polyline} className="trend-line" transform="translate(0 10)" />
            </svg>
          </div>

          <div className="mover-section">
            <div className="section-heading compact">
              <div>
                <div className="eyebrow">Momentum watch</div>
                <h3>Largest movers in the selected window</h3>
              </div>
            </div>
            <div className="rank-list">
              {trend.topMovers.slice(0, 6).map((mover, index) => (
                <a
                  className="rank-row interactive"
                  key={mover.redditId}
                  href={mover.permalink ? `https://reddit.com${mover.permalink}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="rank-number">{index + 1}</span>
                  <div className="rank-copy">
                    <strong>{mover.title || mover.redditId}</strong>
                    <span>r/{mover.subreddit} • {mover.latestComments.toLocaleString()} comments</span>
                  </div>
                  <span className="score-chip hot">+{mover.scoreDelta}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
