import React, { useState } from 'react';
import type { RedditPost } from '../types';
import { calculatePostIntelligence } from '../utils/analytics';

interface PostListProps {
  posts: RedditPost[];
  errors: string[];
}

const formatNumber = (value: number) => new Intl.NumberFormat('en', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

export const PostList: React.FC<PostListProps> = ({ posts, errors }) => {
  const [selectedPost, setSelectedPost] = useState<{ post: RedditPost; rank: number } | null>(null);

  const getBadge = (post: RedditPost) => {
    if (post.is_video || post.post_hint === 'hosted:video') return { text: 'VIDEO', color: 'var(--badge-vid)' };
    if (post.is_gallery || post.url.includes('gallery')) return { text: 'GALLERY', color: 'var(--badge-gallery)' };
    if (post.post_hint === 'image' || post.url.match(/\.(jpeg|jpg|gif|png)$/i)) return { text: 'IMAGE', color: 'var(--badge-img)' };
    if (post.selftext) return { text: 'TEXT', color: 'var(--badge-text)' };
    return { text: 'LINK', color: 'var(--badge-link)' };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getPostTextExport = (post: RedditPost, rank: number) => {
    const intel = calculatePostIntelligence(post);
    return [
      `[${rank}] r/${post.subreddit} | Score: ${post.score} | Comments: ${post.num_comments ?? 0} | Opportunity: ${intel.opportunityScore}`,
      `Title: ${post.title}`,
      `Signals: ${intel.signals.join(', ') || 'none'}`,
      `Link: https://reddit.com${post.permalink}`,
      post.url !== `https://reddit.com${post.permalink}` ? `External: ${post.url}` : null,
      '---',
    ].filter(Boolean).join('\n');
  };

  const relativeTime = (timestamp: number) => {
    const diff = Math.max(0, Date.now() / 1000 - timestamp);
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <section className="post-section">
      {errors.length > 0 && (
        <div className="error-panel">
          {errors.map((error, index) => <div key={`${error}-${index}`}>{error}</div>)}
        </div>
      )}

      {posts.length === 0 && errors.length === 0 && (
        <div className="empty-state card">
          <div className="eyebrow">Ready to research</div>
          <h2>Choose communities and fetch conversations</h2>
          <p>The workspace will rank discussions by opportunity, velocity, comments, pain language and buying intent.</p>
        </div>
      )}

      <div className="post-list">
        {posts.map((post, index) => {
          const badge = getBadge(post);
          const intel = calculatePostIntelligence(post);
          const redditLink = `https://reddit.com${post.permalink}`;

          return (
            <article key={post.id} className="card post-card" onClick={() => setSelectedPost({ post, rank: index + 1 })}>
              <div className="post-card-topline">
                <div className="post-meta-group">
                  <span className="post-rank">#{index + 1}</span>
                  <span className="content-badge" style={{ color: badge.color, borderColor: badge.color }}>{badge.text}</span>
                  <span className="subreddit-name">r/{post.subreddit}</span>
                  {post.link_flair_text && <span className="flair-chip">{post.link_flair_text}</span>}
                  <span className="muted-copy">u/{post.author} · {relativeTime(post.created_utc)}</span>
                </div>
                <div className="opportunity-badge" title="Heuristic opportunity score from engagement, recency and conversation signals">
                  <span>Opportunity</span>
                  <strong>{intel.opportunityScore}</strong>
                </div>
              </div>

              <h3 className="post-title">
                <a href={redditLink} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{post.title}</a>
              </h3>

              {post.selftext && <p className="post-preview">{post.selftext}</p>}

              <div className="signal-row">
                {intel.signals.map((signal) => <span className={`signal-chip signal-${signal}`} key={signal}>{signal.replace('-', ' ')}</span>)}
                {intel.signals.length === 0 && <span className="signal-chip muted-signal">general discussion</span>}
              </div>

              <div className="post-metrics">
                <div><span>Score</span><strong>{formatNumber(post.score)}</strong></div>
                <div><span>Comments</span><strong>{formatNumber(post.num_comments ?? 0)}</strong></div>
                <div><span>Score / hr</span><strong>{intel.scorePerHour.toFixed(1)}</strong></div>
                <div><span>Comments / hr</span><strong>{intel.commentsPerHour.toFixed(1)}</strong></div>
                <div><span>Upvote ratio</span><strong>{post.upvote_ratio != null ? `${Math.round(post.upvote_ratio * 100)}%` : '—'}</strong></div>
              </div>

              <div className="post-actions">
                {post.domain && <span className="domain-label">{post.domain}</span>}
                <button className="btn-secondary compact-button" onClick={(event) => { event.stopPropagation(); copyToClipboard(getPostTextExport(post, index + 1)); }}>Copy insight</button>
              </div>
            </article>
          );
        })}
      </div>

      {selectedPost && (() => {
        const intel = calculatePostIntelligence(selectedPost.post);
        return (
          <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
            <div className="card modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="eyebrow">Post #{selectedPost.rank} · r/{selectedPost.post.subreddit}</div>
                  <h2>{selectedPost.post.title}</h2>
                </div>
                <button className="btn-secondary compact-button" onClick={() => setSelectedPost(null)}>Close</button>
              </div>

              <div className="modal-score-strip">
                <div><span>Opportunity</span><strong>{intel.opportunityScore}/100</strong></div>
                <div><span>Reddit score</span><strong>{selectedPost.post.score.toLocaleString()}</strong></div>
                <div><span>Comments</span><strong>{(selectedPost.post.num_comments ?? 0).toLocaleString()}</strong></div>
                <div><span>Discussion ratio</span><strong>{intel.discussionRatio.toFixed(2)}</strong></div>
              </div>

              <div className="signal-row modal-signals">
                {intel.signals.map((signal) => <span className={`signal-chip signal-${signal}`} key={signal}>{signal.replace('-', ' ')}</span>)}
              </div>

              <div className="modal-actions">
                <a className="btn-primary" href={`https://reddit.com${selectedPost.post.permalink}`} target="_blank" rel="noopener noreferrer">Open on Reddit</a>
                {selectedPost.post.url !== `https://reddit.com${selectedPost.post.permalink}` && (
                  <a className="btn-secondary" href={selectedPost.post.url} target="_blank" rel="noopener noreferrer">Open source link</a>
                )}
                <button className="btn-secondary" onClick={() => copyToClipboard(getPostTextExport(selectedPost.post, selectedPost.rank))}>Copy insight</button>
              </div>

              <div className="analysis-explainer">
                <div><span>Pain / friction</span><strong>{intel.painScore}/20</strong></div>
                <div><span>Buying intent</span><strong>{intel.buyingIntentScore}/15</strong></div>
                <div><span>Question signal</span><strong>{intel.questionScore}/10</strong></div>
                <div><span>Velocity</span><strong>{intel.scorePerHour.toFixed(1)} pts/hr</strong></div>
              </div>

              <div className="post-body-block">
                <div className="eyebrow">Full self text</div>
                <div className="post-body-text">{selectedPost.post.selftext?.trim() || 'No self text content.'}</div>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};
