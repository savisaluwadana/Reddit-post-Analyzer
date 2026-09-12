import { useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { CsvVisualizer } from './components/CsvVisualizer';
import { IntelligencePanel } from './components/IntelligencePanel';
import { PostList } from './components/PostList';
import { ResearchToolbar } from './components/ResearchToolbar';
import { StatsBar } from './components/StatsBar';
import type { RedditPost, SignalFilter, SortMode, SummaryStats } from './types';
import { analyzePosts, calculatePostIntelligence } from './utils/analytics';
import { savePostsToDatabase } from './utils/postStorageApi';
import { fetchAllPosts } from './utils/redditApi';

function App() {
  const [subreddits, setSubreddits] = useState<string[]>(['reactjs', 'webdev']);

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const [fromDate, setFromDate] = useState(defaultFrom.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [limit, setLimit] = useState<number>(25);

  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [stats, setStats] = useState<SummaryStats | null>(null);

  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('opportunity');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [minScore, setMinScore] = useState(0);

  const displayedPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = posts.filter((post) => {
      if (post.score < minScore) return false;

      const intel = calculatePostIntelligence(post);
      if (signalFilter !== 'all' && !intel.signals.includes(signalFilter)) return false;

      if (!normalizedQuery) return true;
      const haystack = [post.title, post.selftext, post.subreddit, post.author, post.domain, post.link_flair_text]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'score') return b.score - a.score;
      if (sortMode === 'comments') return (b.num_comments ?? 0) - (a.num_comments ?? 0);
      if (sortMode === 'newest') return b.created_utc - a.created_utc;

      const aIntel = calculatePostIntelligence(a);
      const bIntel = calculatePostIntelligence(b);
      if (sortMode === 'velocity') {
        return (bIntel.scorePerHour + bIntel.commentsPerHour * 3) - (aIntel.scorePerHour + aIntel.commentsPerHour * 3);
      }
      return bIntel.opportunityScore - aIntel.opportunityScore;
    });
  }, [posts, query, signalFilter, minScore, sortMode]);

  const insights = useMemo(() => analyzePosts(displayedPosts), [displayedPosts]);

  const handleFetch = async () => {
    setIsLoading(true);
    setErrors([]);
    setPosts([]);
    setStats(null);
    setSaveMessage('');

    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const { posts: fetchedPosts, errors: fetchErrors } = await fetchAllPosts(subreddits, limit, from, to);

      setPosts(fetchedPosts);
      setErrors(fetchErrors);

      if (fetchedPosts.length > 0) {
        const totalScore = fetchedPosts.reduce((acc, post) => acc + post.score, 0);
        const highest = fetchedPosts.reduce((best, post) => post.score > best.score ? post : best, fetchedPosts[0]);
        setStats({
          totalPosts: fetchedPosts.length,
          subredditsSearched: subreddits.length,
          dateRange: `${fromDate} to ${toDate}`,
          avgScore: totalScore / fetchedPosts.length,
          highestScore: highest.score,
          highestScoringTitle: highest.title,
        });
      }
    } catch (err: unknown) {
      setErrors([err instanceof Error ? err.message : 'An unknown error occurred']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveData = async () => {
    if (posts.length === 0) return;

    setIsSavingData(true);
    setSaveMessage('');
    try {
      const result = await savePostsToDatabase(posts);
      setSaveMessage(`Saved ${result.processedCount} posts (${result.insertedCount} inserted, ${result.modifiedCount} updated).`);
    } catch (saveError: unknown) {
      const message = `Database save failed: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`;
      setSaveMessage(message);
      setErrors((previous) => [...previous, message]);
    } finally {
      setIsSavingData(false);
    }
  };

  return (
    <div className="container app-shell">
      <header className="hero-header">
        <div className="hero-kicker">Reddit research intelligence</div>
        <h1 className="header-title">Conversation Signal Lab</h1>
        <p className="header-desc">
          Discover high-signal Reddit conversations, recurring pain points, buying intent, fast-moving discussions and community-level opportunities.
        </p>
        <div className="hero-note">Transparent heuristic scoring • No black-box AI required</div>
      </header>

      <main>
        <Controls
          subreddits={subreddits}
          setSubreddits={setSubreddits}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          limit={limit}
          setLimit={setLimit}
          onFetch={handleFetch}
          isLoading={isLoading}
        />

        {stats && (
          <StatsBar
            stats={stats}
            posts={displayedPosts}
            errors={errors}
            onSaveData={handleSaveData}
            isSavingData={isSavingData}
            saveMessage={saveMessage}
          />
        )}

        {posts.length > 0 && (
          <>
            <ResearchToolbar
              query={query}
              setQuery={setQuery}
              sortMode={sortMode}
              setSortMode={setSortMode}
              signalFilter={signalFilter}
              setSignalFilter={setSignalFilter}
              minScore={minScore}
              setMinScore={setMinScore}
              resultCount={displayedPosts.length}
            />
            <IntelligencePanel insights={insights} posts={displayedPosts} />
          </>
        )}

        <PostList posts={displayedPosts} errors={errors} />

        <CsvVisualizer />
      </main>
    </div>
  );
}

export default App;
