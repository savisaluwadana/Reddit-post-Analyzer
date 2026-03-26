import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('Missing MONGODB_URI. Add it to your .env file.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const redditPostSchema = new mongoose.Schema(
  {
    redditId: { type: String, required: true, unique: true, index: true },
    subreddit: { type: String, required: true, index: true },
    title: { type: String, required: true },
    score: { type: Number, required: true, default: 0 },
    author: { type: String, required: true },
    createdUtc: { type: Number, required: true, index: true },
    permalink: { type: String, required: true },
    url: { type: String, required: true },
    postHint: { type: String },
    selfText: { type: String },
    isVideo: { type: Boolean, default: false },
    isGallery: { type: Boolean, default: false },
    lastFetchedAt: { type: Date, required: true }
  },
  {
    timestamps: true
  }
);

const RedditPostModel = mongoose.model('RedditPost', redditPostSchema);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/posts/bulk', async (req, res) => {
  try {
    const posts = req.body?.posts;

    if (!Array.isArray(posts)) {
      return res.status(400).json({ message: 'Request body must include posts[]' });
    }

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
              lastFetchedAt: now
            }
          },
          upsert: true
        }
      }));

    if (operations.length === 0) {
      return res.status(400).json({ message: 'No valid posts to save' });
    }

    const result = await RedditPostModel.bulkWrite(operations, { ordered: false });

    return res.json({
      message: 'Posts saved successfully',
      receivedCount: posts.length,
      processedCount: operations.length,
      insertedCount: result.upsertedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
      matchedCount: result.matchedCount ?? 0
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

    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
};

start();
