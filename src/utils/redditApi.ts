import { requestRedditJson } from './redditRequest.ts';
import type { RedditPost, TimeFilter } from '../types';

interface RedditListingChild {
  data: {
    id: string;
    subreddit: string;
    title: string;
    score?: number;
    author?: string;
    created_utc?: number;
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
  };
}

interface RedditListingResponse {
  data?: {
    children?: RedditListingChild[];
  };
}

/** Maps the distance between `from` date and today to Reddit's supported top-feed window. */
export function mapDateToTimeFilter(fromDate: Date): TimeFilter {
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - fromDate.getTime());
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 1) return 'hour';
  if (diffHours <= 24) return 'day';
  if (diffHours <= 24 * 7) return 'week';
  if (diffHours <= 24 * 31) return 'month';
  if (diffHours <= 24 * 365) return 'year';
  return 'all';
}

async function fetchSubreddit(subreddit: string, limit: number, timeFilter: TimeFilter): Promise<RedditPost[]> {
  const safeSubreddit = encodeURIComponent(subreddit.trim());
  const query = `t=${timeFilter}&limit=${Math.min(Math.max(limit, 1), 100)}&raw_json=1`;
  const data = await requestRedditJson<RedditListingResponse>(`/reddit/r/${safeSubreddit}/top.json?${query}`);
  if (!Array.isArray(data?.data?.children)) throw new Error('Reddit returned an invalid post listing');
  return data.data.children.filter((child) => child?.data?.id && child.data.title).map((child) => ({
    ...child.data,
    score: Number(child.data.score ?? 0),
    author: child.data.author ?? '[deleted]',
    created_utc: Number(child.data.created_utc ?? 0),
    is_video: Boolean(child.data.is_video),
    is_gallery: Boolean(child.data.is_gallery),
    num_comments: Number(child.data.num_comments ?? 0),
    upvote_ratio: Number(child.data.upvote_ratio ?? 0),
    total_awards_received: Number(child.data.total_awards_received ?? 0),
  }));
}

/** Fetches communities with bounded concurrency, then deduplicates and strictly applies the requested date range. */
export async function fetchAllPosts(
  subreddits: string[],
  limit: number,
  fromDate: Date,
  toDate: Date
): Promise<{ posts: RedditPost[]; errors: string[] }> {
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new Error('Please provide a valid date range.');
  }

  if (fromDate > toDate) {
    throw new Error('The start date must be before the end date.');
  }

  const cleanSubreddits = [...new Set(subreddits.map((sub) => sub.trim().replace(/^\/?r\//i, '').toLowerCase()).filter(Boolean))];
  if (cleanSubreddits.length > 25) throw new Error('Collect at most 25 communities at a time.');
  if (cleanSubreddits.some((sub) => !/^[a-z0-9_]{2,21}$/.test(sub))) {
    throw new Error('Use valid subreddit names, for example webdev or r/webdev.');
  }
  const timeFilter = mapDateToTimeFilter(fromDate);
  const results: PromiseSettledResult<RedditPost[]>[] = [];
  for (let index = 0; index < cleanSubreddits.length; index += 3) {
    results.push(...await Promise.allSettled(cleanSubreddits.slice(index, index + 3)
      .map((sub) => fetchSubreddit(sub, limit, timeFilter))));
  }

  const postMap = new Map<string, RedditPost>();
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      result.value.forEach((post) => postMap.set(post.id, post));
    } else {
      errors.push(`Error fetching r/${cleanSubreddits[index]}: ${(result.reason as Error).message}`);
    }
  });

  const fromMs = fromDate.getTime() / 1000;
  const toDateEnd = new Date(toDate);
  toDateEnd.setHours(23, 59, 59, 999);
  const toMs = toDateEnd.getTime() / 1000;

  const posts = [...postMap.values()]
    .filter((post) => post.created_utc >= fromMs && post.created_utc <= toMs)
    .sort((a, b) => b.score - a.score);

  return { posts, errors };
}
