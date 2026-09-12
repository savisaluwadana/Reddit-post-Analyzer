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
  const urls = [
    `/reddit/r/${safeSubreddit}/top.json?${query}`,
    `https://www.reddit.com/r/${safeSubreddit}/top.json?${query}`,
  ];

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json() as RedditListingResponse;
      const children = Array.isArray(data?.data?.children) ? data.data.children : [];

      return children.map((child) => ({
        id: child.data.id,
        subreddit: child.data.subreddit,
        title: child.data.title,
        score: Number(child.data.score ?? 0),
        author: child.data.author ?? '[deleted]',
        created_utc: Number(child.data.created_utc ?? 0),
        permalink: child.data.permalink,
        url: child.data.url,
        post_hint: child.data.post_hint,
        selftext: child.data.selftext,
        is_video: Boolean(child.data.is_video),
        is_gallery: Boolean(child.data.is_gallery),
        num_comments: Number(child.data.num_comments ?? 0),
        upvote_ratio: Number(child.data.upvote_ratio ?? 0),
        total_awards_received: Number(child.data.total_awards_received ?? 0),
        domain: child.data.domain,
        link_flair_text: child.data.link_flair_text,
      }));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to fetch subreddit data');
    }
  }

  throw new Error(lastError?.message || 'Failed to fetch subreddit data');
}

/** Fetches several communities in parallel, then deduplicates and strictly applies the requested date range. */
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

  const cleanSubreddits = [...new Set(subreddits.map((sub) => sub.trim().replace(/^\/?r\//i, '')).filter(Boolean))];
  const timeFilter = mapDateToTimeFilter(fromDate);
  const results = await Promise.allSettled(cleanSubreddits.map((sub) => fetchSubreddit(sub, limit, timeFilter)));

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
