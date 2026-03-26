import React, { useState } from 'react';

interface ControlsProps {
  subreddits: string[];
  setSubreddits: (subs: string[]) => void;
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
  limit: number;
  setLimit: (limit: number) => void;
  onFetch: () => void;
  isLoading: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  subreddits,
  setSubreddits,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  limit,
  setLimit,
  onFetch,
  isLoading
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddSubreddit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      // Remove r/ or /r/ prefix and trim spaces
      const raw = inputValue.trim().replace(/^\/?r\//i, '');
      if (raw && !subreddits.includes(raw)) {
        setSubreddits([...subreddits, raw]);
      }
      setInputValue('');
    }
  };

  const removeSubreddit = (subToRemove: string) => {
    setSubreddits(subreddits.filter(sub => sub !== subToRemove));
  };

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Subreddit Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
            Subreddits (Press Enter to add)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {subreddits.map(sub => (
              <span 
                key={sub} 
                style={{ 
                  background: '#222', 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  border: '1px solid var(--border-color)'
                }}
              >
                r/{sub}
                <button 
                  onClick={() => removeSubreddit(sub)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--reddit-orange)', fontSize: '1rem', lineHeight: '1' }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <input 
            type="text" 
            className="input-base" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleAddSubreddit}
            placeholder="e.g. reactjs, webdev"
            style={{ width: '100%', maxWidth: '400px' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>From Date</label>
            <input 
              type="date" 
              className="input-base" 
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>To Date</label>
            <input 
              type="date" 
              className="input-base" 
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Limit per sub</label>
            <select 
              className="input-base" 
              value={limit} 
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <button 
            className="btn-primary" 
            onClick={onFetch} 
            disabled={isLoading || subreddits.length === 0}
            style={{ marginLeft: 'auto', minWidth: '120px' }}
          >
            {isLoading ? 'Fetching...' : 'Fetch Top Posts'}
          </button>
        </div>
      </div>
    </div>
  );
};
