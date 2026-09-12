# Reddit Conversation Signal Lab

A Reddit research and market-intelligence dashboard for finding high-signal conversations across multiple subreddits.

## What it does

- Fetches top posts across multiple subreddits and exact date ranges
- Captures score, comments, upvote ratio, flair, domain, awards and content type
- Ranks posts with a transparent opportunity score based on engagement, recency and conversation signals
- Detects pain/friction language, buying intent, questions, fast-moving posts and discussion-heavy threads
- Calculates score/hour, comments/hour and discussion ratio
- Extracts repeated topics across the result set
- Ranks subreddits by average signal quality
- Supports research search, signal filters, minimum score filters and multiple ranking modes
- Saves richer Reddit metadata to MongoDB
- Exposes a queryable `GET /api/posts` endpoint for stored research data
- Keeps the existing CSV workflow and visualizer

> The opportunity score is a transparent heuristic, not an AI prediction. It is designed to help prioritize what to inspect manually.

## Setup

Copy `.env.example` to `.env` and configure:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/reddit_post_analyzer
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Install dependencies:

```bash
npm install
```

Run the API and frontend in separate terminals:

```bash
npm run server
npm run dev
```

## Stored post API

Posts are upserted by Reddit ID through:

```text
POST /api/posts/bulk
```

Historical data can be queried through:

```text
GET /api/posts
```

Supported query parameters include:

- `subreddit`
- `q` for MongoDB text search
- `minScore`
- `minComments`
- `sort=createdUtc|score|numComments|lastFetchedAt`
- `order=asc|desc`
- `limit` up to 500

Example:

```text
/api/posts?subreddit=webdev&minComments=20&sort=numComments&order=desc&limit=50
```

## Current direction

This project is evolving from a simple Reddit extractor into a broader conversation-intelligence product for product research, developer relations, market research, community analysis and SaaS opportunity discovery.
