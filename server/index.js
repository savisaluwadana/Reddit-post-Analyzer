import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';

if (!mongoUri) {
  console.error('Missing MONGODB_URI. Add it to your .env file.');
  process.exit(1);
}

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));

const redditPostSchema = new mongoose.Schema(
  {
    redditId: { type: String, required: true, unique: true, index: true },
    subreddit: { type: String, required: true, index: true },
    title: { type: String, required: true },
    score: { type: Number, required: true, default: 0, index: true },
    author: { type: String, required: true },
    createdUtc: { type: Number, required: true, index: true },
    permalink: { type: String, required: true },
    url: { type: String, required: true },
    postHint: { type: String },
    selfText: { type: String },
    isVideo: { type: Boolean, default: false },
    isGallery: { type: Boolean, default: false },
    numComments: { type: Number, default: 0, index: true },
    upvoteRatio: { type: Number, default: 0 },
    totalAwardsReceived: { type: Number, default: 0 },
    domain: { type: String, index: true },
    linkFlairText: { type: String },
    lastFetchedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

redditPostSchema.index({ subreddit: 1, createdUtc: -1 });
redditPostSchema.index({ score: -1, numComments: -1 });
redditPostSchema.index({ title: 'text', selfText: 'text' });

const RedditPostModel = mongoose.model('RedditPost', redditPostSchema);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/posts', async (req, res) => {
  try {
    const {
      subreddit,
      q,
      minScore = '0',
      minComments = '0',
      sort = 'createdUtc',
      order = 'desc',
      limit = '100',
    } = req.query;

    const filter = {
      score: { $gte: Math.max(0, Number(minScore) || 0) },
      numComments: { $gte: Math.max(0, Number(minComments) || 0) },
    };

    if (typeof subreddit === 'string' && subreddit.trim()) filter.subreddit = subreddit.trim().replace(/^\/?r\//i, '');
    if (typeof q === 'string' && q.trim()) filter.$text = { $search: q.trim() };

    const allowedSortFields = new Set(['createdUtc', 'score', 'numComments', 'lastFetchedAt']);
    const sortField = allowedSortFields.has(String(sort)) ? String(sort) : 'createdUtc';
    const sortDirection = order === 'asc' ? 1 : -1;
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const posts = await RedditPostModel.find(filter)
      .sort({ [sortField]: sortDirection })
      .limit(safeLimit)
      .lean();

    return res.json({ count: posts.length, posts });
  } catch (error) {
    console.error('Failed to query posts:', error);
    return res.status(500).json({ message: 'Failed to query posts' });
  }
});

app.post('/api/posts/bulk', async (req, res) => {
  try {
    const posts = req.body?.posts;
    if (!Array.isArray(posts)) return res.status(400).json({ message: 'Request body must include posts[]' });
    if (posts.length > 1000) return res.status(400).json({ message: 'Maximum bulk size is 1000 posts' });

    const now = new Date();
    const operations = posts
      .filter((post) => post?.id && post?.subreddit && post?.title)
      .map((post) => ({
        updateOne: {
          filter: { redditId: post.id },
          update: {
            $set: {
              subreddit: post.subreddit,
              title: post.title,
              score: Number(post.score ?? 0),
              author: post.author ?? '[deleted]',
              createdUtc: Number(post.created_utc ?? 0),
              permalink: post.permalink ?? '',
              url: post.url ?? '',
              postHint: post.post_hint,
              selfText: post.selftext,
              isVideo: Boolean(post.is_video),
              isGallery: Boolean(post.is_gallery),
              numComments: Number(post.num_comments ?? 0),
              upvoteRatio: Number(post.upvote_ratio ?? 0),
              totalAwardsReceived: Number(post.total_awards_received ?? 0),
              domain: post.domain,
              linkFlairText: post.link_flair_text,
              lastFetchedAt: now,
            },
          },
          upsert: true,
        },
      }));

    if (operations.length === 0) return res.status(400).json({ message: 'No valid posts to save' });

    const result = await RedditPostModel.bulkWrite(operations, { ordered: false });
    return res.json({
      message: 'Posts saved successfully',
      receivedCount: posts.length,
      processedCount: operations.length,
      insertedCount: result.upsertedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0,
    });
  } catch (error) {
    console.error('Failed to save posts:', error);
    return res.status(500).json({ message: 'Failed to save posts' });
  }
});

const start = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    app.listen(port, () => console.log(`API server running on http://localhost:${port}`));
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
};

start();
