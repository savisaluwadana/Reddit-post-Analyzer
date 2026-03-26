import React from 'react';
import type { RedditPost, SummaryStats } from '../types';

interface StatsBarProps {
  stats: SummaryStats;
  posts: RedditPost[];
  errors: string[];
  onSaveData: () => void;
  isSavingData: boolean;
  saveMessage: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  stats,
  posts,
  errors,
  onSaveData,
  isSavingData,
  saveMessage,
}) => {
  if (stats.totalPosts === 0 && errors.length === 0) return null;

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
        <button className="btn-primary" onClick={onSaveData} disabled={posts.length === 0 || isSavingData} style={{ minWidth: '140px' }}>
          {isSavingData ? 'Saving...' : 'Save Data'}
        </button>
      </div>

      {saveMessage && (
        <div style={{ width: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {saveMessage}
        </div>
      )}

    </div>
  );
};
