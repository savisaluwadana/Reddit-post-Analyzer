import type { DashboardInsights, RedditPost } from '../types';
import { calculatePostIntelligence } from '../utils/analytics';

interface IntelligencePanelProps {
  insights: DashboardInsights;
  posts: RedditPost[];
}

export function IntelligencePanel({ insights, posts }: IntelligencePanelProps) {
  const topOpportunities = posts
    .map((post) => ({ post, intel: calculatePostIntelligence(post) }))
    .sort((a, b) => b.intel.opportunityScore - a.intel.opportunityScore)
    .slice(0, 5);

  return (
    <section className="intelligence-grid">
      <div className="card intelligence-card intelligence-summary">
        <div className="eyebrow">Signal summary</div>
        <div className="metric-grid">
          <div className="metric-box">
            <strong>{Math.round(insights.avgOpportunity)}</strong>
            <span>Avg opportunity</span>
          </div>
          <div className="metric-box">
            <strong>{insights.totalComments.toLocaleString()}</strong>
            <span>Total comments</span>
          </div>
          <div className="metric-box">
            <strong>{insights.painSignalPosts}</strong>
            <span>Pain signals</span>
          </div>
          <div className="metric-box">
            <strong>{insights.buyingIntentPosts}</strong>
            <span>Buying intent</span>
          </div>
          <div className="metric-box">
            <strong>{insights.fastMovingPosts}</strong>
            <span>Fast moving</span>
          </div>
        </div>
      </div>

      <div className="card intelligence-card">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Topic radar</div>
            <h3>Repeated conversation themes</h3>
          </div>
        </div>
        <div className="topic-cloud">
          {insights.topics.length > 0 ? insights.topics.map((topic) => (
            <span key={topic.topic} className="topic-pill" title={`${topic.mentions} posts • ${topic.comments} comments`}>
              {topic.topic} <small>{topic.mentions}</small>
            </span>
          )) : <span className="empty-copy">Fetch more posts to detect repeated topics.</span>}
        </div>
      </div>

      <div className="card intelligence-card">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Community quality</div>
            <h3>Best subreddits by signal quality</h3>
          </div>
        </div>
        <div className="rank-list">
          {insights.subreddits.slice(0, 6).map((item, index) => (
            <div className="rank-row" key={item.subreddit}>
              <span className="rank-number">{index + 1}</span>
              <div className="rank-copy">
                <strong>r/{item.subreddit}</strong>
                <span>{item.posts} posts • {Math.round(item.avgComments)} avg comments</span>
              </div>
              <span className="score-chip">{Math.round(item.avgOpportunity)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card intelligence-card">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Opportunity queue</div>
            <h3>Highest-signal posts</h3>
          </div>
        </div>
        <div className="rank-list">
          {topOpportunities.map(({ post, intel }, index) => (
            <a className="rank-row interactive" key={post.id} href={`https://reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer">
              <span className="rank-number">{index + 1}</span>
              <div className="rank-copy">
                <strong>{post.title}</strong>
                <span>r/{post.subreddit} • {(post.num_comments ?? 0).toLocaleString()} comments</span>
              </div>
              <span className="score-chip hot">{intel.opportunityScore}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
