# Reddit Conversation Signal Lab

A Reddit research and market-intelligence dashboard for finding high-signal conversations, repeated pain points and emerging opportunities across multiple subreddits.

## What it does

### Live conversation intelligence

- Fetches top posts across multiple subreddits and exact date ranges
- Captures score, comments, upvote ratio, flair, domain, awards and content type
- Ranks posts with a transparent opportunity score based on engagement, recency and conversation signals
- Detects pain/friction language, buying intent, questions, fast-moving posts and discussion-heavy threads
- Calculates score/hour, comments/hour and discussion ratio
- Extracts repeated topics across the active result set
- Ranks subreddits by average signal quality
- Supports full research filtering by text, signal, minimum score and minimum comments
- Ranks by opportunity, engagement velocity, comments, Reddit score or recency

### Saved research projects

Research configurations can be saved to MongoDB and reused later. A project stores:

- Project name and description
- Subreddit set
- Keyword set
- Minimum Reddit score
- Minimum comment count
- Signal filter
- Ranking mode

Use the project library in the dashboard to load a saved research configuration back into the workspace.

### Historical momentum tracking

Saving fetched posts now records an hourly snapshot of their score and comment count. These snapshots power:

- Daily average score history
- Daily average comment history
- Number of tracked posts
- Score movement across the selected window
- Comment movement across the selected window
- Top posts gaining momentum
- Optional subreddit-specific trend views
- 7, 14, 30, 60 and 90 day analysis windows

Snapshots are deduplicated to one record per Reddit post per hour. They expire automatically according to `SNAPSHOT_RETENTION_DAYS` so history does not grow forever by default.

> The opportunity score is a transparent heuristic, not an AI prediction. It is designed to help prioritize what to inspect manually.

## Setup

Copy `.env.example` to `.env` and configure:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/reddit_post_analyzer
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
SNAPSHOT_RETENTION_DAYS=90
```

`SNAPSHOT_RETENTION_DAYS` accepts 7–365 days and defaults to 90.

Install dependencies:

```bash
npm install
```

Run the API and frontend in separate terminals:

```bash
npm run server
npm run dev
```

## API

### Health

```text
GET /api/health
```

Returns database connectivity and snapshot-retention information.

### Store Reddit posts + history

```text
POST /api/posts/bulk
```

Posts are upserted by Reddit ID. The same request also upserts one historical snapshot per post for the current hour.

### Query stored posts

```text
GET /api/posts
```

Supported query parameters:

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

### Saved research projects

```text
GET /api/projects
POST /api/projects
DELETE /api/projects/:id
```

Example project body:

```json
{
  "name": "Platform engineering pain points",
  "description": "Track recurring operational friction and tool-switching intent",
  "subreddits": ["devops", "kubernetes"],
  "keywords": ["manual", "cost", "alternative"],
  "minScore": 5,
  "minComments": 5,
  "signalFilter": "pain",
  "sortMode": "opportunity"
}
```

### Historical trends

```text
GET /api/trends?days=30
GET /api/trends?days=30&subreddit=kubernetes
```

The response contains daily aggregate points plus the posts with the largest score/comment movement in that window.

## Data model

The application currently uses three MongoDB collections:

- `RedditPost` — latest known state for every collected post
- `PostSnapshot` — hourly historical engagement snapshots
- `ResearchProject` — reusable research configurations

## Current direction

This project is evolving from a simple Reddit extractor into a broader conversation-intelligence product for product research, developer relations, market research, community analysis and SaaS opportunity discovery.

Logical next phases include Reddit OAuth/server-side ingestion, scheduled project runs, alerts for newly emerging signals, cross-project trend comparison, semantic clustering and optional LLM-assisted summaries.
