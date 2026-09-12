import type { DashboardInsights, PostIntelligence, RedditPost, TopicInsight } from '../types';

const STOP_WORDS = new Set([
  'about','after','again','against','also','and','are','because','been','before','being','between','both','but','can','could','did','does','doing','down','each','few','for','from','had','has','have','having','here','how','into','its','just','more','most','not','now','off','once','only','other','our','out','over','own','same','should','some','such','than','that','the','their','them','then','there','these','they','this','those','through','too','under','until','very','was','were','what','when','where','which','while','who','why','will','with','would','you','your','reddit','http','https','www','com'
]);

const PAIN_TERMS = [
  'problem','issue','pain','painful','frustrating','frustrated','hate','broken','fails','failed','failure','difficult','hard','slow','manual','annoying','struggling','struggle','expensive','costly','waste','wasting','blocked','blocker','bug','bugs','missing','cannot','can\'t','doesn\'t work','need help','help me'
];

const BUYING_TERMS = [
  'recommend','recommendation','alternative','alternatives','best tool','which tool','software for','looking for','pay for','pricing','price','budget','worth it','subscription','service for','solution for','vendor','buy','purchase'
];

const QUESTION_TERMS = ['how do','how can','what is','what are','which','why does','why is','anyone know','help','advice','suggest'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function countMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

export function calculatePostIntelligence(post: RedditPost): PostIntelligence {
  const text = `${post.title} ${post.selftext ?? ''}`.toLowerCase();
  const ageHours = Math.max(0.25, (Date.now() / 1000 - post.created_utc) / 3600);
  const comments = post.num_comments ?? 0;
  const scorePerHour = post.score / ageHours;
  const commentsPerHour = comments / ageHours;
  const discussionRatio = comments / Math.max(post.score, 1);

  const painMatches = countMatches(text, PAIN_TERMS);
  const buyingMatches = countMatches(text, BUYING_TERMS);
  const questionMatches = countMatches(text, QUESTION_TERMS) + (post.title.includes('?') ? 1 : 0);

  const painScore = clamp(painMatches * 5, 0, 20);
  const buyingIntentScore = clamp(buyingMatches * 5, 0, 15);
  const questionScore = clamp(questionMatches * 4, 0, 10);
  const engagementScore = clamp(Math.log1p(Math.max(post.score, 0)) * 5 + Math.log1p(comments) * 6, 0, 45);
  const recencyScore = clamp(10 - ageHours / 24, 0, 10);
  const opportunityScore = Math.round(clamp(engagementScore + painScore + buyingIntentScore + questionScore + recencyScore, 0, 100));

  const signals: string[] = [];
  if (painMatches > 0) signals.push('pain');
  if (buyingMatches > 0) signals.push('buying-intent');
  if (questionMatches > 0) signals.push('question');
  if (scorePerHour >= 25 || commentsPerHour >= 8) signals.push('fast-moving');
  if (discussionRatio >= 0.35 && comments >= 10) signals.push('discussion-heavy');

  return {
    ageHours,
    scorePerHour,
    commentsPerHour,
    discussionRatio,
    painScore,
    buyingIntentScore,
    questionScore,
    opportunityScore,
    signals,
  };
}

export function extractTopics(posts: RedditPost[], limit = 10): TopicInsight[] {
  const counts = new Map<string, { mentions: number; score: number; comments: number }>();

  posts.forEach((post) => {
    const uniqueTokens = new Set(
      `${post.title} ${post.selftext ?? ''}`
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9+#.-]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 3 && token.length <= 28 && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
    );

    uniqueTokens.forEach((token) => {
      const current = counts.get(token) ?? { mentions: 0, score: 0, comments: 0 };
      current.mentions += 1;
      current.score += post.score;
      current.comments += post.num_comments ?? 0;
      counts.set(token, current);
    });
  });

  return [...counts.entries()]
    .filter(([, value]) => value.mentions >= Math.min(2, posts.length))
    .map(([topic, value]) => ({ topic, ...value }))
    .sort((a, b) => (b.mentions * 4 + Math.log1p(b.score) + Math.log1p(b.comments)) - (a.mentions * 4 + Math.log1p(a.score) + Math.log1p(a.comments)))
    .slice(0, limit);
}

export function analyzePosts(posts: RedditPost[]): DashboardInsights {
  const intelligence = posts.map((post) => ({ post, intel: calculatePostIntelligence(post) }));
  const subredditMap = new Map<string, { posts: number; score: number; comments: number; opportunity: number }>();

  intelligence.forEach(({ post, intel }) => {
    const current = subredditMap.get(post.subreddit) ?? { posts: 0, score: 0, comments: 0, opportunity: 0 };
    current.posts += 1;
    current.score += post.score;
    current.comments += post.num_comments ?? 0;
    current.opportunity += intel.opportunityScore;
    subredditMap.set(post.subreddit, current);
  });

  const subreddits = [...subredditMap.entries()]
    .map(([subreddit, value]) => ({
      subreddit,
      posts: value.posts,
      avgScore: value.score / value.posts,
      avgComments: value.comments / value.posts,
      avgOpportunity: value.opportunity / value.posts,
    }))
    .sort((a, b) => b.avgOpportunity - a.avgOpportunity);

  const signalCounts = intelligence.reduce<Record<string, number>>((acc, item) => {
    item.intel.signals.forEach((signal) => {
      acc[signal] = (acc[signal] ?? 0) + 1;
    });
    return acc;
  }, {});

  return {
    totalComments: posts.reduce((sum, post) => sum + (post.num_comments ?? 0), 0),
    avgComments: posts.length ? posts.reduce((sum, post) => sum + (post.num_comments ?? 0), 0) / posts.length : 0,
    avgOpportunity: posts.length ? intelligence.reduce((sum, item) => sum + item.intel.opportunityScore, 0) / posts.length : 0,
    painSignalPosts: signalCounts['pain'] ?? 0,
    buyingIntentPosts: signalCounts['buying-intent'] ?? 0,
    fastMovingPosts: signalCounts['fast-moving'] ?? 0,
    topics: extractTopics(posts),
    subreddits,
  };
}
