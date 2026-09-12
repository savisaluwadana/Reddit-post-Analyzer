import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { createPainScanRouter } from './painScanRoutes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
const snapshotRetentionDays = Math.min(Math.max(Number(process.env.SNAPSHOT_RETENTION_DAYS) || 90, 7), 365);

if (!mongoUri) {
  console.error('Missing MONGODB_URI. Add it to your .env file.');
  process.exit(1);
}

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/pain-scans', createPainScanRouter());

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

const postSnapshotSchema = new mongoose.Schema(
  {
    redditId: { type: String, required: true, index: true },
    subreddit: { type: String, required: true, index: true },
    score: { type: Number, required: true, default: 0 },
    numComments: { type: Number, required: true, default: 0 },
    upvoteRatio: { type: Number, default: 0 },
    capturedHour: { type: Number, required: true },
    capturedAt: { type: Date, required: true, index: true },
  },
  { versionKey: false }
);

postSnapshotSchema.index({ redditId: 1, capturedHour: 1 }, { unique: true });
postSnapshotSchema.index({ capturedAt: 1 }, { expireAfterSeconds: snapshotRetentionDays * 24 * 60 * 60 });
postSnapshotSchema.index({ subreddit: 1, capturedAt: -1 });

const researchProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 280 },
    subreddits: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    minScore: { type: Number, default: 0, min: 0 },
    minComments: { type: Number, default: 0, min: 0 },
    signalFilter: {
      type: String,
      enum: ['all', 'pain', 'buying-intent', 'question', 'fast-moving', 'discussion-heavy'],
      default: 'all',
    },
    sortMode: {
      type: String,
      enum: ['opportunity', 'score', 'comments', 'velocity', 'newest'],
      default: 'opportunity',
    },
  },
  { timestamps: true }
);

researchProjectSchema.index({ updatedAt: -1 });

const RedditPostModel = mongoose.model('RedditPost', redditPostSchema);
const PostSnapshotModel = mongoose.model('PostSnapshot', postSnapshotSchema);
const ResearchProjectModel = mongoose.model('ResearchProject', researchProjectSchema);

const normalizeSubreddit = (value) => String(value || '').trim().replace(/^\/?r\//i, '').slice(0, 64);
const normalizeStringList = (value, maxItems = 50, maxLength = 80) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    snapshotRetentionDays,
  });
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

    if (typeof subreddit === 'string' && subreddit.trim()) filter.subreddit = normalizeSubreddit(subreddit);
    if (typeof q === 'string' && q.trim()) filter.$text = { $search: q.trim().slice(0, 180) };

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

app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await ResearchProjectModel.find({}).sort({ updatedAt: -1 }).limit(100).lean();
    return res.json({ count: projects.length, projects });
  } catch (error) {
    console.error('Failed to list research projects:', error);
    return res.status(500).json({ message: 'Failed to list research projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ message: 'Project name is required' });

    const subreddits = normalizeStringList(req.body?.subreddits, 50, 64).map(normalizeSubreddit).filter(Boolean);
    if (subreddits.length === 0) return res.status(400).json({ message: 'Add at least one subreddit to the project' });

    const allowedSignals = new Set(['all', 'pain', 'buying-intent', 'question', 'fast-moving', 'discussion-heavy']);
    const allowedSortModes = new Set(['opportunity', 'score', 'comments', 'velocity', 'newest']);

    const project = await ResearchProjectModel.create({
      name,
      description: String(req.body?.description || '').trim().slice(0, 280),
      subreddits,
      keywords: normalizeStringList(req.body?.keywords, 30, 80),
      minScore: Math.max(0, Number(req.body?.minScore) || 0),
      minComments: Math.max(0, Number(req.body?.minComments) || 0),
      signalFilter: allowedSignals.has(req.body?.signalFilter) ? req.body.signalFilter : 'all',
      sortMode: allowedSortModes.has(req.body?.sortMode) ? req.body.sortMode : 'opportunity',
    });

    return res.status(201).json({ project: project.toObject() });
  } catch (error) {
    console.error('Failed to create research project:', error);
    return res.status(500).json({ message: 'Failed to create research project' });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid project id' });
    const deleted = await ResearchProjectModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Research project not found' });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete research project:', error);
    return res.status(500).json({ message: 'Failed to delete research project' });
  }
});

app.get('/api/trends', async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 14, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { capturedAt: { $gte: since } };

    if (typeof req.query.subreddit === 'string' && req.query.subreddit.trim()) {
      match.subreddit = normalizeSubreddit(req.query.subreddit);
    }

    const points = await PostSnapshotModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$capturedAt', timezone: 'UTC' } },
          postIds: { $addToSet: '$redditId' },
          avgScore: { $avg: '$score' },
          avgComments: { $avg: '$numComments' },
          totalScore: { $sum: '$score' },
          totalComments: { $sum: '$numComments' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          trackedPosts: { $size: '$postIds' },
          avgScore: { $round: ['$avgScore', 2] },
          avgComments: { $round: ['$avgComments', 2] },
          totalScore: 1,
          totalComments: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    const topMovers = await PostSnapshotModel.aggregate([
      { $match: match },
      { $sort: { capturedAt: 1 } },
      {
        $group: {
          _id: '$redditId',
          subreddit: { $first: '$subreddit' },
          firstScore: { $first: '$score' },
          latestScore: { $last: '$score' },
          firstComments: { $first: '$numComments' },
          latestComments: { $last: '$numComments' },
        },
      },
      {
        $project: {
          subreddit: 1,
          latestScore: 1,
          latestComments: 1,
          scoreDelta: { $subtract: ['$latestScore', '$firstScore'] },
          commentsDelta: { $subtract: ['$latestComments', '$firstComments'] },
        },
      },
      { $match: { $or: [{ scoreDelta: { $gt: 0 } }, { commentsDelta: { $gt: 0 } }] } },
      { $sort: { scoreDelta: -1, commentsDelta: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: RedditPostModel.collection.name,
          localField: '_id',
          foreignField: 'redditId',
          as: 'post',
        },
      },
      {
        $project: {
          _id: 0,
          redditId: '$_id',
          subreddit: 1,
          title: { $arrayElemAt: ['$post.title', 0] },
          permalink: { $arrayElemAt: ['$post.permalink', 0] },
          scoreDelta: 1,
          commentsDelta: 1,
          latestScore: 1,
          latestComments: 1,
        },
      },
    ]);

    return res.json({ days, points, topMovers });
  } catch (error) {
    console.error('Failed to load trends:', error);
    return res.status(500).json({ message: 'Failed to load trend history' });
  }
});

app.post('/api/posts/bulk', async (req, res) => {
  try {
    const posts = req.body?.posts;
    if (!Array.isArray(posts)) return res.status(400).json({ message: 'Request body must include posts[]' });
    if (posts.length > 1000) return res.status(400).json({ message: 'Maximum bulk size is 1000 posts' });

    const now = new Date();
    const capturedHour = Math.floor(now.getTime() / (60 * 60 * 1000));
    const validPosts = posts.filter((post) => post?.id && post?.subreddit && post?.title);

    const operations = validPosts.map((post) => ({
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

    const snapshotOperations = validPosts.map((post) => ({
      updateOne: {
        filter: { redditId: post.id, capturedHour },
        update: {
          $set: {
            subreddit: post.subreddit,
            score: Number(post.score ?? 0),
            numComments: Number(post.num_comments ?? 0),
            upvoteRatio: Number(post.upvote_ratio ?? 0),
            capturedAt: now,
          },
          $setOnInsert: { redditId: post.id, capturedHour },
        },
        upsert: true,
      },
    }));

    const [result, snapshotResult] = await Promise.all([
      RedditPostModel.bulkWrite(operations, { ordered: false }),
      PostSnapshotModel.bulkWrite(snapshotOperations, { ordered: false }),
    ]);

    return res.json({
      message: 'Posts and history snapshots saved successfully',
      receivedCount: posts.length,
      processedCount: operations.length,
      insertedCount: result.upsertedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0,
      snapshotsUpserted: snapshotResult.upsertedCount ?? 0,
      snapshotsUpdated: snapshotResult.modifiedCount ?? 0,
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