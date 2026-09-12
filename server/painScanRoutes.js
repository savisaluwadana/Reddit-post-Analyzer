import express from 'express';
import mongoose from 'mongoose';

const PAIN_CATEGORIES = new Set([
  'manual-work', 'integration', 'reliability', 'performance', 'cost', 'usability', 'visibility',
  'security-compliance', 'setup-onboarding', 'workflow-process', 'missing-capability', 'support', 'data-migration',
  'access-availability', 'quality', 'communication', 'billing-payments', 'fulfillment-logistics', 'trust-safety', 'discovery-comparison',
]);

const clampScore = (value) => Math.min(Math.max(Number(value) || 0, 0), 100);
const safeText = (value, maxLength = 240) => String(value || '').trim().slice(0, maxLength);
const safeStrings = (value, maxItems = 12, maxLength = 80) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => safeText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
};

const painEvidenceSchema = new mongoose.Schema({
  sourceType: { type: String, enum: ['post', 'comment'], required: true },
  postId: { type: String, required: true },
  subreddit: { type: String, required: true },
  author: { type: String, default: '[deleted]' },
  text: { type: String, required: true, maxlength: 420 },
  permalink: { type: String, maxlength: 600 },
  score: { type: Number, default: 0 },
  category: { type: String, required: true },
  severity: { type: Number, default: 0 },
  commercialIntent: { type: Number, default: 0 },
  urgency: { type: Number, default: 0 },
  workaroundBurden: { type: Number, default: 0 },
  personas: { type: [String], default: [] },
  keywords: { type: [String], default: [] },
}, { _id: false });

const painClusterSchema = new mongoose.Schema({
  clusterId: { type: String, required: true },
  category: { type: String, required: true },
  label: { type: String, required: true, maxlength: 180 },
  painScore: { type: Number, required: true },
  severity: { type: Number, default: 0 },
  recurrence: { type: Number, default: 0 },
  commercialIntent: { type: Number, default: 0 },
  urgency: { type: Number, default: 0 },
  workaroundBurden: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
  evidenceCount: { type: Number, default: 0 },
  distinctPosts: { type: Number, default: 0 },
  distinctSubreddits: { type: Number, default: 0 },
  personas: { type: [String], default: [] },
  keywords: { type: [String], default: [] },
  evidence: { type: [painEvidenceSchema], default: [] },
  opportunityReason: { type: String, default: '', maxlength: 500 },
}, { _id: false });

const painScanSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  generatedAt: { type: Date, required: true, index: true },
  subreddits: { type: [String], default: [] },
  postsScanned: { type: Number, default: 0 },
  commentsScanned: { type: Number, default: 0 },
  painPosts: { type: Number, default: 0 },
  painComments: { type: Number, default: 0 },
  highIntentEvidence: { type: Number, default: 0 },
  workaroundEvidence: { type: Number, default: 0 },
  clusters: { type: [painClusterSchema], default: [] },
  categories: { type: [new mongoose.Schema({ category: String, evidenceCount: Number, painScore: Number }, { _id: false })], default: [] },
  topPersonas: { type: [new mongoose.Schema({ persona: String, mentions: Number }, { _id: false })], default: [] },
}, { timestamps: true });

painScanSchema.index({ createdAt: -1 });
painScanSchema.index({ subreddits: 1, createdAt: -1 });

const PainScanModel = mongoose.models.PainScan || mongoose.model('PainScan', painScanSchema);

function normalizeEvidence(item, fallbackCategory) {
  const category = PAIN_CATEGORIES.has(item?.category) ? item.category : fallbackCategory;
  const text = safeText(item?.text, 420);
  if (!text) return null;

  return {
    sourceType: item?.sourceType === 'comment' ? 'comment' : 'post',
    postId: safeText(item?.postId, 64),
    subreddit: safeText(item?.subreddit, 64),
    author: safeText(item?.author, 80) || '[deleted]',
    text,
    permalink: safeText(item?.permalink, 600),
    score: Number(item?.score) || 0,
    category,
    severity: clampScore(item?.severity),
    commercialIntent: clampScore(item?.commercialIntent),
    urgency: clampScore(item?.urgency),
    workaroundBurden: clampScore(item?.workaroundBurden),
    personas: safeStrings(item?.personas, 4, 80),
    keywords: safeStrings(item?.keywords, 10, 40),
  };
}

function normalizeCluster(cluster) {
  const category = PAIN_CATEGORIES.has(cluster?.category) ? cluster.category : 'usability';
  const label = safeText(cluster?.label, 180);
  if (!label) return null;

  return {
    clusterId: safeText(cluster?.id, 220) || `${category}:${label.toLowerCase()}`,
    category,
    label,
    painScore: clampScore(cluster?.painScore),
    severity: clampScore(cluster?.severity),
    recurrence: clampScore(cluster?.recurrence),
    commercialIntent: clampScore(cluster?.commercialIntent),
    urgency: clampScore(cluster?.urgency),
    workaroundBurden: clampScore(cluster?.workaroundBurden),
    confidence: clampScore(cluster?.confidence),
    evidenceCount: Math.max(0, Number(cluster?.evidenceCount) || 0),
    distinctPosts: Math.max(0, Number(cluster?.distinctPosts) || 0),
    distinctSubreddits: Math.max(0, Number(cluster?.distinctSubreddits) || 0),
    personas: safeStrings(cluster?.personas, 5, 80),
    keywords: safeStrings(cluster?.keywords, 10, 40),
    evidence: Array.isArray(cluster?.evidence)
      ? cluster.evidence.slice(0, 4).map((item) => normalizeEvidence(item, category)).filter(Boolean)
      : [],
    opportunityReason: safeText(cluster?.opportunityReason, 500),
  };
}

function serializeScan(scan) {
  const raw = scan.toObject ? scan.toObject() : scan;
  return {
    ...raw,
    clusters: (raw.clusters || []).map((cluster) => ({ ...cluster, id: cluster.clusterId ?? cluster.id })),
  };
}

function compareScans(current, previous) {
  if (!current) return [];
  const previousMap = new Map((previous?.clusters || []).map((cluster) => [cluster.clusterId, cluster]));

  return (current.clusters || [])
    .map((cluster) => {
      const prior = previousMap.get(cluster.clusterId);
      const previousScore = Number(prior?.painScore) || 0;
      const currentScore = Number(cluster.painScore) || 0;
      const delta = currentScore - previousScore;
      let status = 'persistent';
      if (!prior) status = 'new';
      else if (delta >= 8) status = 'rising';
      else if (delta <= -8) status = 'falling';

      return {
        id: cluster.clusterId,
        label: cluster.label,
        category: cluster.category,
        currentScore,
        previousScore,
        delta,
        currentConfidence: Number(cluster.confidence) || 0,
        commercialIntent: Number(cluster.commercialIntent) || 0,
        recurrence: Number(cluster.recurrence) || 0,
        status,
      };
    })
    .sort((a, b) => {
      const priority = { new: 4, rising: 3, persistent: 2, falling: 1 };
      return (priority[b.status] - priority[a.status]) || (b.currentScore - a.currentScore);
    })
    .slice(0, 20);
}

export function createPainScanRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
      const scans = await PainScanModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
      const comparison = compareScans(scans[0], scans[1]);
      return res.json({ scans: scans.map(serializeScan), comparison });
    } catch (error) {
      console.error('Failed to list pain scans:', error);
      return res.status(500).json({ message: 'Failed to load pain scan history' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const report = req.body?.scan;
      if (!report || !Array.isArray(report.clusters)) return res.status(400).json({ message: 'A valid pain scan is required' });

      const clusters = report.clusters.slice(0, 20).map(normalizeCluster).filter(Boolean);
      if (clusters.length === 0) return res.status(400).json({ message: 'The scan has no pain clusters to save' });

      const generatedAt = new Date(report.generatedAt || Date.now());
      const scan = await PainScanModel.create({
        name: safeText(req.body?.name, 100) || `Pain scan ${generatedAt.toISOString().slice(0, 10)}`,
        generatedAt: Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt,
        subreddits: safeStrings(req.body?.subreddits, 50, 64),
        postsScanned: Math.max(0, Number(report.postsScanned) || 0),
        commentsScanned: Math.max(0, Number(report.commentsScanned) || 0),
        painPosts: Math.max(0, Number(report.painPosts) || 0),
        painComments: Math.max(0, Number(report.painComments) || 0),
        highIntentEvidence: Math.max(0, Number(report.highIntentEvidence) || 0),
        workaroundEvidence: Math.max(0, Number(report.workaroundEvidence) || 0),
        clusters,
        categories: Array.isArray(report.categories) ? report.categories.slice(0, 20).map((item) => ({
          category: PAIN_CATEGORIES.has(item?.category) ? item.category : 'usability',
          evidenceCount: Math.max(0, Number(item?.evidenceCount) || 0),
          painScore: clampScore(item?.painScore),
        })) : [],
        topPersonas: Array.isArray(report.topPersonas) ? report.topPersonas.slice(0, 12).map((item) => ({
          persona: safeText(item?.persona, 80),
          mentions: Math.max(0, Number(item?.mentions) || 0),
        })).filter((item) => item.persona) : [],
      });

      return res.status(201).json({ scan: serializeScan(scan) });
    } catch (error) {
      console.error('Failed to save pain scan:', error);
      return res.status(500).json({ message: 'Failed to save pain scan' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid pain scan id' });
      const deleted = await PainScanModel.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Pain scan not found' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to delete pain scan:', error);
      return res.status(500).json({ message: 'Failed to delete pain scan' });
    }
  });

  return router;
}
