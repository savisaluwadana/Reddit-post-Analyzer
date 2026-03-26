import { useState } from 'react';
import { Controls } from './components/Controls';
import { StatsBar } from './components/StatsBar';
import { PostList } from './components/PostList';
import { CsvVisualizer } from './components/CsvVisualizer';
import { fetchAllPosts } from './utils/redditApi';
import { savePostsToDatabase } from './utils/postStorageApi';
import type { RedditPost, SummaryStats } from './types';

function App() {
  const [subreddits, setSubreddits] = useState<string[]>(['reactjs', 'webdev']);
  
  // Default to last 7 days
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const [fromDate, setFromDate] = useState(defaultFrom.toISOString().split('T')[0]);
  
  const defaultTo = new Date();
  const [toDate, setToDate] = useState(defaultTo.toISOString().split('T')[0]);

  const [limit, setLimit] = useState<number>(10);
  
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingData, setIsSavingData] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [stats, setStats] = useState<SummaryStats | null>(null);

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
        const totalScore = fetchedPosts.reduce((acc, p) => acc + p.score, 0);
        setStats({
          totalPosts: fetchedPosts.length,
          subredditsSearched: subreddits.length,
          dateRange: `${fromDate} to ${toDate}`,
          avgScore: totalScore / fetchedPosts.length,
          highestScore: fetchedPosts[0].score,
          highestScoringTitle: fetchedPosts[0].title
        });
      }
    } catch (err: any) {
      setErrors([err.message || 'An unknown error occurred']);
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
      setSaveMessage(`Saved ${result.processedCount} posts to MongoDB (${result.insertedCount} inserted, ${result.modifiedCount} updated).`);
    } catch (saveError: any) {
      const message = `Database save failed: ${saveError?.message || 'Unknown error'}`;
      setSaveMessage(message);
      setErrors(prev => [...prev, message]);
    } finally {
      setIsSavingData(false);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h1 className="header-title">Reddit Best Post Extractor</h1>
        <p className="header-desc">
          Fetch top posts from multiple subreddits simultaneously. Results are merged, sorted by score, and filtered to your exact date range.
        </p>
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
            posts={posts}
            errors={errors}
            onSaveData={handleSaveData}
            isSavingData={isSavingData}
            saveMessage={saveMessage}
          />
        )}

        <PostList posts={posts} errors={errors} />

        <CsvVisualizer />
      </main>
    </div>
  );
}

export default App;
