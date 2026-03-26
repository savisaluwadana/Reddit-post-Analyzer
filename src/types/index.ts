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
}

export interface SummaryStats {
  totalPosts: number;
  subredditsSearched: number;
  dateRange: string;
  avgScore: number;
  highestScore: number;
  highestScoringTitle: string;
}

export type TimeFilter = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
