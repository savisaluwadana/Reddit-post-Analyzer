import React from 'react';
import type { RedditPost, SummaryStats } from '../types';

interface StatsBarProps {
  stats: SummaryStats;
  posts: RedditPost[];
  errors: string[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, posts, errors }) => {
  if (stats.totalPosts === 0 && errors.length === 0) return null;

  const escapeCsv = (value: string | number | undefined | null) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const copyAll = async () => {
    const textExport = posts.map((post, i) => {
      return [
        `[${i + 1}] r/${post.subreddit} | Score: ${post.score} | by u/${post.author}`,
        `Title: ${post.title}`,
        `Link: https://reddit.com${post.permalink}`,
        post.url !== `https://reddit.com${post.permalink}` ? `External: ${post.url}` : null,
        '---'
      ].filter(Boolean).join('\n');
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(textExport);
      alert('Copied all posts to clipboard!');
    } catch (err) {
      console.error('Failed to copy all: ', err);
    }
  };

  const downloadCsv = () => {
    const headers = [
      'Rank',
      'Subreddit',
      'Title',
      'Score',
      'Author',
      'CreatedUTC',
      'CreatedISO',
      'RedditPermalink',
      'RedditLink',
      'ExternalUrl',
      'PostType',
      'SelfText'
    ];

    const rows = posts.map((post, i) => {
      const redditLink = `https://reddit.com${post.permalink}`;
      const createdIso = new Date(post.created_utc * 1000).toISOString();
      const postType = post.is_video || post.post_hint === 'hosted:video'
        ? 'video'
        : post.is_gallery || post.url.includes('gallery')
          ? 'gallery'
          : post.post_hint === 'image' ? 'image' : post.selftext ? 'text' : 'link';

      return [
        i + 1,
        post.subreddit,
        post.title,
        post.score,
        post.author,
        post.created_utc,
        createdIso,
        post.permalink,
        redditLink,
        post.url,
        postType,
        post.selftext ?? ''
      ];
    });

    const csv = [headers, ...rows]
      .map(row => row.map(cell => escapeCsv(cell)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `reddit-posts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between', alignItems: 'center' }}>
      
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total Posts</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.totalPosts}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Subreddits</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.subredditsSearched}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Avg Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{Math.round(stats.avgScore).toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Highest Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--reddit-orange)' }}>{stats.highestScore.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date Range</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '0.3rem' }}>{stats.dateRange}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={copyAll} disabled={posts.length === 0} style={{ minWidth: '140px' }}>
          Copy All As Text
        </button>
        <button className="btn-primary" onClick={downloadCsv} disabled={posts.length === 0} style={{ minWidth: '140px' }}>
          Download CSV
        </button>
      </div>

    </div>
  );
};
