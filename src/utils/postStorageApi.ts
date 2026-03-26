import type { RedditPost } from '../types';

interface SavePostsResponse {
  message: string;
  receivedCount: number;
  processedCount: number;
  insertedCount: number;
  modifiedCount: number;
  matchedCount: number;
}

export async function savePostsToDatabase(posts: RedditPost[]): Promise<SavePostsResponse> {
  const response = await fetch('/api/posts/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ posts }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save posts to database');
  }

  return response.json() as Promise<SavePostsResponse>;
}
