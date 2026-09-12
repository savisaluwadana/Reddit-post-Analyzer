import { useEffect, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { CrossSourceIntelligencePanel } from './components/CrossSourceIntelligencePanel';
import { CsvVisualizer } from './components/CsvVisualizer';
import { HostIntelligencePanel } from './components/HostIntelligencePanel';
import { IntelligencePanel } from './components/IntelligencePanel';
import { OpportunityOsPanel } from './components/OpportunityOsPanel';
import { PainPointLab } from './components/PainPointLab';
import { PostList } from './components/PostList';
import { QualityIntelligencePanel } from './components/QualityIntelligencePanel';
import { ResearchProjectsPanel } from './components/ResearchProjectsPanel';
import { ResearchToolbar } from './components/ResearchToolbar';
import { ScrapeIntelligencePanel } from './components/ScrapeIntelligencePanel';
import { StatsBar } from './components/StatsBar';
import { TrendPanel } from './components/TrendPanel';
import type {
  RedditPost,
  ResearchProject,
  ResearchProjectInput,
  SignalFilter,
  SortMode,
  SummaryStats,
  TrendResponse,
} from './types';
import { analyzePosts, calculatePostIntelligence } from './utils/analytics';
import { formatLocalDateInput, parseLocalDateInput } from './utils/date';
import { savePostsToDatabase } from './utils/postStorageApi';
import {
  createResearchProject,
  deleteResearchProject,
  fetchTrends,
  listResearchProjects,
} from './utils/researchApi';
import { fetchAllPosts } from './utils/redditApi';

function App() {
  const [subreddits, setSubreddits] = useState<string[]>(['reactjs', 'webdev']);

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const [fromDate, setFromDate] = useState(formatLocalDateInput(defaultFrom));
  const [toDate, setToDate] = useState(formatLocalDateInput(new Date()));
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
  const [minComments, setMinComments] = useState(0);

  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendDays, setTrendDays] = useState(14);
  const [trendSubreddit, setTrendSubreddit] = useState('');
  const [isTrendLoading, setIsTrendLoading] = useState(false);

  const displayedPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(',').map((term) => term.trim()).filter(Boolean);

    const filtered = posts.filter((post) => {
      if (post.score < minScore) return false;
      if ((post.num_comments ?? 0) < minComments) return false;

      const intel = calculatePostIntelligence(post);
      if (signalFilter !== 'all' && !intel.signals.includes(signalFilter)) return false;

      if (queryTerms.length === 0) return true;
      const haystack = [post.title, post.selftext, post.subreddit, post.author, post.domain, post.link_flair_text]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return queryTerms.some((term) => haystack.includes(term));
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
  }, [posts, query, signalFilter, minScore, minComments, sortMode]);

  const insights = useMemo(() => analyzePosts(displayedPosts), [displayedPosts]);
  const availableSubreddits = useMemo(() => {
    return [...new Set([...subreddits, ...posts.map((post) => post.subreddit)])].sort((a, b) => a.localeCompare(b));
  }, [posts, subreddits]);

  const refreshProjects = async () => {
    setIsProjectLoading(true);
    try {
      setProjects(await listResearchProjects());
    } catch (error) {
      setErrors((previous) => [...previous, error instanceof Error ? error.message : 'Failed to load research projects']);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const refreshTrends = async (days = trendDays, subreddit = trendSubreddit) => {
    setIsTrendLoading(true);
    try {
      setTrend(await fetchTrends(days, subreddit || undefined));
    } catch (error) {
      setErrors((previous) => [...previous, error instanceof Error ? error.message : 'Failed to load trend history']);
    } finally {
      setIsTrendLoading(false);
    }
  };

  useEffect(() => {
    void refreshProjects();
    void refreshTrends();
  }, []);

  const handleFetch = async () => {
    setIsLoading(true);
    setErrors([]);
    setPosts([]);
    setStats(null);
    setSaveMessage('');

    try {
      const from = parseLocalDateInput(fromDate);
      const to = parseLocalDateInput(toDate, true);
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
      setSaveMessage(`Saved ${result.processedCount} posts (${result.insertedCount} inserted, ${result.modifiedCount} updated) and captured history.`);
      await refreshTrends();
    } catch (saveError: unknown) {
      const message = `Database save failed: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`;
      setSaveMessage(message);
      setErrors((previous) => [...previous, message]);
    } finally {
      setIsSavingData(false);
    }
  };

  const handleCreateProject = async (input: ResearchProjectInput) => {
    setIsProjectLoading(true);
    try {
      const project = await createResearchProject(input);
      setProjects((previous) => [project, ...previous.filter((item) => item._id !== project._id)]);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleLoadProject = (project: ResearchProject) => {
    setSubreddits(project.subreddits);
    setQuery(project.keywords.join(', '));
    setMinScore(project.minScore);
    setMinComments(project.minComments);
    setSignalFilter(project.signalFilter);
    setSortMode(project.sortMode);
    setTrendSubreddit(project.subreddits.length === 1 ? project.subreddits[0] : '');
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteResearchProject(projectId);
      setProjects((previous) => previous.filter((project) => project._id !== projectId));
    } catch (error) {
      setErrors((previous) => [...previous, error instanceof Error ? error.message : 'Failed to delete research project']);
    }
  };

  const handleTrendRefresh = () => {
    void refreshTrends(trendDays, trendSubreddit);
  };

  return (
    <div className="container app-shell">
      <header className="hero-header">
        <div className="hero-kicker">Cross-source pain intelligence</div>
        <h1 className="header-title">Pain Intelligence Lab</h1>
        <p className="header-desc">
          Turn public conversations, reviews, forums, issues, support threads and community discussions into evidence-backed pain points, jobs-to-be-done, competitor intelligence and product opportunities.
        </p>
        <div className="hero-note">MCP-hosted LLM reasoning • No model API key • Adaptive public-web crawl intelligence • Semantic clustering • Validation experiments • Opportunity OS</div>
      </header>

      <main>
        <CrossSourceIntelligencePanel />
        <HostIntelligencePanel />
        <ScrapeIntelligencePanel />
        <QualityIntelligencePanel />
        <OpportunityOsPanel />

        <div className="source-connector-divider">
          <span>Built-in source connector</span>
          <strong>Reddit deep research</strong>
          <p>Use the native Reddit collector below, or use Codex / Claude Code through MCP to research any public source and feed the cross-source evidence layer above.</p>
        </div>

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

        <ResearchProjectsPanel
          projects={projects}
          subreddits={subreddits}
          query={query}
          minScore={minScore}
          minComments={minComments}
          signalFilter={signalFilter}
          sortMode={sortMode}
          onCreate={handleCreateProject}
          onLoad={handleLoadProject}
          onDelete={handleDeleteProject}
          isLoading={isProjectLoading}
        />

        <TrendPanel
          trend={trend}
          days={trendDays}
          setDays={setTrendDays}
          subreddit={trendSubreddit}
          setSubreddit={setTrendSubreddit}
          availableSubreddits={availableSubreddits}
          isLoading={isTrendLoading}
          onRefresh={handleTrendRefresh}
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
              minComments={minComments}
              setMinComments={setMinComments}
              resultCount={displayedPosts.length}
            />
            <IntelligencePanel insights={insights} posts={displayedPosts} />
            <PainPointLab posts={displayedPosts} />
          </>
        )}

        <PostList posts={displayedPosts} errors={errors} />

        <CsvVisualizer />
      </main>
    </div>
  );
}

export default App;