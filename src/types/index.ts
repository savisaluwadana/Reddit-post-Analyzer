export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  score: number;
  author: string;
  created_utc: number;
  permalink: string;
  url: string;
  post_hint?: string;
  selftext?: string;
  is_video?: boolean;
  is_gallery?: boolean;
  num_comments?: number;
  upvote_ratio?: number;
  total_awards_received?: number;
  domain?: string;
  link_flair_text?: string;
}

export interface SummaryStats {
  totalPosts: number;
  subredditsSearched: number;
  dateRange: string;
  avgScore: number;
  highestScore: number;
  highestScoringTitle: string;
}

export interface PostIntelligence {
  ageHours: number;
  scorePerHour: number;
  commentsPerHour: number;
  discussionRatio: number;
  painScore: number;
  buyingIntentScore: number;
  questionScore: number;
  opportunityScore: number;
  signals: string[];
}

export interface TopicInsight {
  topic: string;
  mentions: number;
  score: number;
  comments: number;
}

export interface SubredditInsight {
  subreddit: string;
  posts: number;
  avgScore: number;
  avgComments: number;
  avgOpportunity: number;
}

export interface DashboardInsights {
  totalComments: number;
  avgComments: number;
  avgOpportunity: number;
  painSignalPosts: number;
  buyingIntentPosts: number;
  fastMovingPosts: number;
  topics: TopicInsight[];
  subreddits: SubredditInsight[];
}

export type TimeFilter = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
export type SortMode = 'opportunity' | 'score' | 'comments' | 'velocity' | 'newest';
export type SignalFilter = 'all' | 'pain' | 'buying-intent' | 'question' | 'fast-moving' | 'discussion-heavy';

export interface ResearchProject {
  _id: string;
  name: string;
  description?: string;
  subreddits: string[];
  keywords: string[];
  minScore: number;
  minComments: number;
  signalFilter: SignalFilter;
  sortMode: SortMode;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchProjectInput {
  name: string;
  description?: string;
  subreddits: string[];
  keywords: string[];
  minScore: number;
  minComments: number;
  signalFilter: SignalFilter;
  sortMode: SortMode;
}

export interface TrendPoint {
  date: string;
  trackedPosts: number;
  avgScore: number;
  avgComments: number;
  totalScore: number;
  totalComments: number;
}

export interface TrendMover {
  redditId: string;
  subreddit: string;
  title?: string;
  permalink?: string;
  scoreDelta: number;
  commentsDelta: number;
  latestScore: number;
  latestComments: number;
}

export interface TrendResponse {
  days: number;
  points: TrendPoint[];
  topMovers: TrendMover[];
}
