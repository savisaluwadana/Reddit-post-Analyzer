# Reddit-post-Analyzer

Reddit post analyzer with:
- multi-subreddit fetch
- CSV export + CSV visualizer
- MongoDB persistence for all retrieved posts

## 1) Setup

Create env file from example:

1. Copy [.env.example](.env.example) to `.env`
2. Set `MONGODB_URI`

Example:

`MONGODB_URI=mongodb://127.0.0.1:27017/reddit_post_analyzer`

## 2) Install

Run:

`npm install`

## 3) Run app + API

Use two terminals:

- Terminal A: `npm run server`
- Terminal B: `npm run dev`

Frontend runs with Vite, backend API runs on `http://localhost:4000`.

## MongoDB save behavior

When you click Fetch, all successfully retrieved Reddit posts are sent to:

- `POST /api/posts/bulk`

and upserted in MongoDB by unique `redditId`.
