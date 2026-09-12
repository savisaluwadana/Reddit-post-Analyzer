import type { SignalFilter, SortMode } from '../types';

interface ResearchToolbarProps {
  query: string;
  setQuery: (value: string) => void;
  sortMode: SortMode;
  setSortMode: (value: SortMode) => void;
  signalFilter: SignalFilter;
  setSignalFilter: (value: SignalFilter) => void;
  minScore: number;
  setMinScore: (value: number) => void;
  resultCount: number;
}

export function ResearchToolbar({
  query,
  setQuery,
  sortMode,
  setSortMode,
  signalFilter,
  setSignalFilter,
  minScore,
  setMinScore,
  resultCount,
}: ResearchToolbarProps) {
  return (
    <section className="research-toolbar card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">Research workspace</div>
          <h2>Find the posts that matter</h2>
        </div>
        <div className="result-count">{resultCount} matches</div>
      </div>

      <div className="toolbar-grid">
        <label className="field-group field-wide">
          <span>Search title, text, subreddit or author</span>
          <input
            className="input-base"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. kubernetes cost, alternatives, manual workflow"
          />
        </label>

        <label className="field-group">
          <span>Rank by</span>
          <select className="input-base" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="opportunity">Opportunity score</option>
            <option value="velocity">Engagement velocity</option>
            <option value="comments">Comments</option>
            <option value="score">Reddit score</option>
            <option value="newest">Newest</option>
          </select>
        </label>

        <label className="field-group">
          <span>Signal</span>
          <select className="input-base" value={signalFilter} onChange={(event) => setSignalFilter(event.target.value as SignalFilter)}>
            <option value="all">All signals</option>
            <option value="pain">Pain / friction</option>
            <option value="buying-intent">Buying intent</option>
            <option value="question">Questions</option>
            <option value="fast-moving">Fast moving</option>
            <option value="discussion-heavy">Discussion heavy</option>
          </select>
        </label>

        <label className="field-group">
          <span>Minimum Reddit score</span>
          <input
            className="input-base"
            type="number"
            min={0}
            value={minScore}
            onChange={(event) => setMinScore(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>
      </div>
    </section>
  );
}
