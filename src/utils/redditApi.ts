import type { RedditPost, TimeFilter } from '../types';

/**
 * Maps the distance between `from` date and today to a Reddit time filter.
 */
export function mapDateToTimeFilter(fromDate: Date): TimeFilter {
  const now = new Date();
  const diffMs = now.getTime() - fromDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 1) return 'hour';
  if (diffHours <= 24) return 'day';
  if (diffHours <= 24 * 7) return 'week';
  if (diffHours <= 24 * 31) return 'month';
  if (diffHours <= 24 * 365) return 'year';
  return 'all';
}

/**
 * Fetches top posts from a single subreddit.
 */
async function fetchSubreddit(subreddit: string, limit: number, timeFilter: TimeFilter): Promise<RedditPost[]> {
  const safeSubreddit = encodeURIComponent(subreddit.trim());
  const query = `t=${timeFilter}&limit=${limit}`;

  // In dev, Vite proxy (`/reddit`) avoids CORS/network failures.
  // In production, direct Reddit URL remains available as a fallback.
  const urls = [
    `/reddit/r/${safeSubreddit}/top.json?${query}`,
    `https://www.reddit.com/r/${safeSubreddit}/top.json?${query}`,
  ];

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      return data.data.children.map((child: any) => ({
        id: child.data.id,
        subreddit: child.data.subreddit,
        title: child.data.title,
        score: child.data.score,
        author: child.data.author,
        created_utc: child.data.created_utc,
        permalink: child.data.permalink,
        url: child.data.url,
        post_hint: child.data.post_hint,
        selftext: child.data.selftext,
        is_video: child.data.is_video,
        is_gallery: child.data.is_gallery,
      }));
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw new Error(lastError?.message || 'Failed to fetch subreddit data');
}

/**
 * Fetches from multiple subreddits and merges/filters/sorts them.
 */
export async function fetchAllPosts(
  subreddits: string[],
  limit: number,
  fromDate: Date,
  toDate: Date
): Promise<{ posts: RedditPost[]; errors: string[] }> {
  const timeFilter = mapDateToTimeFilter(fromDate);
  
  const promises = subreddits.map(sub => fetchSubreddit(sub, limit, timeFilter));
  const results = await Promise.allSettled(promises);
  
  const posts: RedditPost[] = [];
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      posts.push(...result.value);
    } else {
      errors.push(`Error fetching r/${subreddits[index]}: ${(result.reason as Error).message}`);
    }
  });

  // Client side filtering strictly within exact dates provided
  const fromMs = fromDate.getTime() / 1000;
  
  // End of day for `toDate`
  const toDateEnd = new Date(toDate);
  toDateEnd.setHours(23, 59, 59, 999);
  const toMs = toDateEnd.getTime() / 1000;

  const filteredPosts = posts.filter(
    post => post.created_utc >= fromMs && post.created_utc <= toMs
  );

  // Merge and sort all results by score
  filteredPosts.sort((a, b) => b.score - a.score);

  return { posts: filteredPosts, errors };
}
