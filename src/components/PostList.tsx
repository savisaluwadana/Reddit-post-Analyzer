import React, { useState } from 'react';
import type { RedditPost } from '../types';

interface PostListProps {
  posts: RedditPost[];
  errors: string[];
}

export const PostList: React.FC<PostListProps> = ({ posts, errors }) => {
  const [selectedPost, setSelectedPost] = useState<{ post: RedditPost; rank: number } | null>(null);
  
  const getBadge = (post: RedditPost) => {
    if (post.is_video || post.post_hint === 'hosted:video') {
      return { text: 'VID', color: 'var(--badge-vid)' };
    }
    if (post.is_gallery || post.url.includes('gallery')) {
      return { text: 'GALLERY', color: 'var(--badge-gallery)' };
    }
    if (post.post_hint === 'image' || post.url.match(/\.(jpeg|jpg|gif|png)$/i)) {
      return { text: 'IMG', color: 'var(--badge-img)' };
    }
    if (post.selftext) {
      return { text: 'TEXT', color: 'var(--badge-text)' };
    }
    return { text: 'LINK', color: 'var(--badge-link)' };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const getPostTextExport = (post: RedditPost, rank: number) => {
    return [
      `[${rank}] r/${post.subreddit} | Score: ${post.score} | by u/${post.author}`,
      `Title: ${post.title}`,
      `Link: https://reddit.com${post.permalink}`,
      post.url !== `https://reddit.com${post.permalink}` ? `External: ${post.url}` : null,
      '---'
    ].filter(Boolean).join('\n');
  };

  const relativeTime = (timestamp: number) => {
    const diff = Date.now() / 1000 - timestamp;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div>
      {errors.length > 0 && (
        <div style={{ color: '#ff4444', marginBottom: '1rem', padding: '1rem', border: '1px solid #ff4444', borderRadius: '4px', background: '#2a0808' }}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map((post, index) => {
          const badge = getBadge(post);
          const redditLink = `https://reddit.com${post.permalink}`;
          return (
            <div
              key={post.id}
              className="card"
              style={{ padding: '1.5rem', cursor: 'pointer' }}
              onClick={() => setSelectedPost({ post, rank: index + 1 })}
              title="Click to view full details"
            >
              
              {/* Header block */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    #{index + 1}
                  </span>
                  <span style={{ 
                    color: badge.color, 
                    border: `1px solid ${badge.color}`, 
                    padding: '0.1rem 0.4rem', 
                    borderRadius: '2px', 
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {badge.text}
                  </span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>
                    r/{post.subreddit}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    • u/{post.author} • {relativeTime(post.created_utc)}
                  </span>
                </div>
                
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(getPostTextExport(post, index + 1));
                  }}
                  title="Copy post details"
                >
                  Copy
                </button>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                <a
                  href={redditLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.title}
                </a>
              </h3>

              {/* External Link if different */}
              {post.url !== `https://www.reddit.com${post.permalink}` && post.url !== `https://reddit.com${post.permalink}` && (
                <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  🔗 <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }} onClick={(e) => e.stopPropagation()}>
                    {post.url.length > 60 ? post.url.substring(0, 60) + '...' : post.url}
                  </a>
                </div>
              )}

              {/* Score snippet */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', color: 'var(--reddit-orange)', fontWeight: 'bold' }}>
                ⬆ {post.score.toLocaleString()}
              </div>

              {/* Text Preview */}
              {post.selftext && (
                <div style={{ 
                  marginTop: '1rem', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.9rem',
                  display: '-webkit-box',
                  lineClamp: '3',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  background: '#1a1a1a',
                  padding: '1rem',
                  borderRadius: '2px',
                  borderLeft: '2px solid var(--border-color)'
                }}>
                  {post.selftext}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedPost && (
        <div
          onClick={() => setSelectedPost(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1rem',
            zIndex: 1000
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(980px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  #{selectedPost.rank} • r/{selectedPost.post.subreddit} • u/{selectedPost.post.author}
                </div>
                <h2 style={{ fontSize: '1.35rem', lineHeight: '1.45', marginBottom: '0.5rem' }}>{selectedPost.post.title}</h2>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedPost(null)} style={{ padding: '0.3rem 0.65rem' }}>
                Close
              </button>
            </div>

            <div style={{ color: 'var(--reddit-orange)', fontWeight: 'bold', marginBottom: '1rem' }}>
              ⬆ {selectedPost.post.score.toLocaleString()} points • {relativeTime(selectedPost.post.created_utc)}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <a className="btn-primary" href={`https://reddit.com${selectedPost.post.permalink}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                Open on Reddit
              </a>
              {selectedPost.post.url !== `https://reddit.com${selectedPost.post.permalink}` && (
                <a className="btn-secondary" href={selectedPost.post.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  Open External Link
                </a>
              )}
              <button
                className="btn-secondary"
                onClick={() => copyToClipboard(getPostTextExport(selectedPost.post, selectedPost.rank))}
              >
                Copy Full Details
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>Self Text</div>
              <div
                style={{
                  background: '#1a1a1a',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '1rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  minHeight: '100px'
                }}
              >
                {selectedPost.post.selftext?.trim() ? selectedPost.post.selftext : 'No self text content.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
