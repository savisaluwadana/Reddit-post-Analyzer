# Reddit Conversation Signal Lab

A Reddit research and market-intelligence dashboard for finding high-signal conversations, repeated pain points, costly workarounds and product opportunities across multiple subreddits.

## What it does

### Deep pain-point intelligence

The Pain Point Lab goes beyond post sentiment and looks for evidence that a problem is real, recurring and commercially meaningful.

- Builds an immediate pain preview from post titles and self text
- Deep-scans top Reddit comment threads on demand
- Scores pain across severity, recurrence, commercial intent, urgency and workaround burden
- Detects manual workflows, spreadsheets, scripts, hacks and homegrown workarounds
- Detects switching, alternative-seeking, pricing and willingness-to-pay language
- Groups evidence into recurring pain clusters instead of isolated complaints
- Measures confidence from evidence volume, distinct threads, comment corroboration and cross-subreddit recurrence
- Detects likely affected personas such as platform engineers, SREs, developers, founders, security teams and data engineers
- Categorizes pain into manual work, integrations, reliability, performance, cost, usability, observability, security/compliance, onboarding, workflow/process, missing capability, support and migration
- Shows the exact Reddit posts/comments behind every cluster score
- Exports the current pain report as readable text or JSON for downstream research

The pain score is intentionally transparent. A high score requires multiple useful signals rather than generic negative sentiment.

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

Saving fetched posts records an hourly snapshot of score and comment count. These snapshots power:

- Daily average score history
- Daily average comment history
- Number of tracked posts
- Score and comment movement across the selected window
- Top posts gaining momentum
- Optional subreddit-specific trend views
- 7, 14, 30, 60 and 90 day analysis windows

Snapshots are deduplicated to one record per Reddit post per hour and expire according to `SNAPSHOT_RETENTION_DAYS`.

## Pain scoring model

Each evidence item is evaluated across five core dimensions:

1. **Severity** — frustration, failure, blocking language and engagement strength.
2. **Recurrence** — repeated evidence across distinct threads, comments and subreddits.
3. **Commercial intent** — pricing, budget, buying, replacement, migration and alternative-seeking language.
4. **Urgency** — production impact, deadlines, blockers, incidents and time-sensitive language.
5. **Workaround burden** — manual steps, spreadsheets, scripts, copy/paste, cron jobs, hacks and homegrown tooling.

Cluster confidence increases when the same pain appears in multiple threads/subreddits and is corroborated by comments. This is a heuristic prioritization system, not a prediction of market success.

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

The Vite development server proxies `/api` to the Node API and `/reddit` to Reddit for public JSON requests used by post collection and deep comment scans.

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

Supported query parameters include `subreddit`, `q`, `minScore`, `minComments`, `sort`, `order` and `limit`.

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

Deep comment evidence is analyzed in the research session and can be exported as JSON. A future persistence layer can store versioned pain scans for long-term comparison.

## Validation

Pull requests run GitHub Actions CI with:

```text
npm ci
npm run lint
npm run build
```

## Current direction

The project is evolving into a dedicated pain-point and opportunity research system. Logical next phases include authenticated Reddit server-side ingestion, scheduled project scans, pain-cluster history, alerts when a problem crosses a confidence/intent threshold, semantic clustering and optional grounded LLM summaries.
