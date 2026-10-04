import { requestRedditJson } from './redditRequest.ts';
import type { RedditComment, RedditPost } from '../types';

interface FetchCommentsResult {
  comments: RedditComment[];
  errors: string[];
}

interface RedditCommentNode {
  kind?: string;
  data?: {
    id?: string;
    subreddit?: string;
    author?: string;
    body?: string;
    score?: number;
    created_utc?: number;
    permalink?: string;
    replies?: string | {
      data?: {
        children?: RedditCommentNode[];
      };
    };
  };
}

interface RedditThreadListing {
  data?: {
    children?: RedditCommentNode[];
  };
}

function flattenCommentChildren(children: RedditCommentNode[], post: RedditPost, depth = 0): RedditComment[] {
  const comments: RedditComment[] = [];

  children.forEach((child) => {
    if (child?.kind !== 't1' || !child?.data) return;
    const data = child.data;
    const body = typeof data.body === 'string' ? data.body.trim() : '';

    if (body && body !== '[deleted]' && body !== '[removed]') {
      comments.push({
        id: String(data.id ?? ''),
        postId: post.id,
        subreddit: data.subreddit ?? post.subreddit,
        author: data.author ?? '[deleted]',
        body,
        score: Number(data.score ?? 0),
        created_utc: Number(data.created_utc ?? 0),
        permalink: data.permalink,
        depth,
      });
    }

    const replies = typeof data.replies === 'object' ? data.replies?.data?.children : undefined;
    if (Array.isArray(replies) && depth < 4) {
      comments.push(...flattenCommentChildren(replies, post, depth + 1));
    }
  });

  return comments;
}

export async function fetchThreadComments(post: RedditPost, limit = 40): Promise<RedditComment[]> {
  const safeLimit = Math.min(Math.max(limit, 10), 100);
  const query = `limit=${safeLimit}&sort=top&raw_json=1`;
  const payload = await requestRedditJson<RedditThreadListing[]>(`/reddit/comments/${encodeURIComponent(post.id)}.json?${query}`);
  const children = payload?.[1]?.data?.children;
  if (!Array.isArray(children)) throw new Error('Reddit returned an invalid comment listing');
  return flattenCommentChildren(children, post)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
}

export async function fetchCommentsForPosts(
  posts: RedditPost[],
  commentsPerPost = 40,
  concurrency = 3,
  onProgress?: (completed: number, total: number) => void,
): Promise<FetchCommentsResult> {
  const comments: RedditComment[] = [];
  const errors: string[] = [];
  const safeConcurrency = Math.min(Math.max(concurrency, 1), 5);
  let completed = 0;

  for (let index = 0; index < posts.length; index += safeConcurrency) {
    const batch = posts.slice(index, index + safeConcurrency);
    const results = await Promise.allSettled(batch.map((post) => fetchThreadComments(post, commentsPerPost)));

    results.forEach((result, resultIndex) => {
      const post = batch[resultIndex];
      if (result.status === 'fulfilled') {
        comments.push(...result.value);
      } else {
        const message = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`r/${post.subreddit} · ${post.title.slice(0, 70)}: ${message}`);
      }
      completed += 1;
      onProgress?.(completed, posts.length);
    });
  }

  return { comments, errors };
}
