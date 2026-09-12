import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import { analyzeGeneralEvidence } from './generalPainEngine.js';

const SOURCE_KINDS = new Set([
  'reddit','forum','social','review','github','support','survey','news','blog','community','marketplace','app-store','web','other',
]);

const safeText = (value, maxLength = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const safeList = (value, maxItems = 20, maxLength = 80) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => safeText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
};

const evidenceItemSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true, index: true },
  externalId: { type: String, default: '', index: true, maxlength: 180 },
  sourceKind: { type: String, required: true, index: true },
  sourceName: { type: String, required: true, index: true, maxlength: 120 },
  sourceUrl: { type: String, default: '', maxlength: 1200 },
  community: { type: String, default: '', index: true, maxlength: 160 },
  author: { type: String, default: '', maxlength: 120 },
  title: { type: String, default: '', maxlength: 500 },
  text: { type: String, required: true, maxlength: 12000 },
  publishedAt: { type: Date, index: true },
  engagementScore: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  tags: { type: [String], default: [], index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  batchId: { type: String, default: '', index: true, maxlength: 120 },
  ingestedBy: { type: String, default: 'api', index: true, maxlength: 80 },
  lastSeenAt: { type: Date, required: true, index: true },
}, { timestamps: true });

evidenceItemSchema.index({ title: 'text', text: 'text', community: 'text', sourceName: 'text' });
evidenceItemSchema.index({ sourceKind: 1, createdAt: -1 });

evidenceItemSchema.index({ sourceName: 1, createdAt: -1 });

const crossSourceEvidenceSchema = new mongoose.Schema({
  sourceKind: String,
  sourceName: String,
  externalId: String,
  community: String,
  author: String,
  title: String,
  text: String,
  url: String,
  engagementScore: Number,
  category: String,
  severity: Number,
  commercialIntent: Number,
  urgency: Number,
  workaroundBurden: Number,
  personas: [String],
  keywords: [String],
}, { _id: false });

const crossSourceClusterSchema = new mongoose.Schema({
  clusterId: { type: String, required: true },
  category: { type: String, required: true },
  label: { type: String, required: true, maxlength: 220 },
  painScore: Number,
  severity: Number,
  recurrence: Number,
  commercialIntent: Number,
  urgency: Number,
  workaroundBurden: Number,
  confidence: Number,
  evidenceCount: Number,
  distinctSources: Number,
  distinctCommunities: Number,
  personas: [String],
  keywords: [String],
  evidence: { type: [crossSourceEvidenceSchema], default: [] },
  opportunityReason: { type: String, default: '', maxlength: 700 },
}, { _id: false });

const crossSourceScanSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  generatedAt: { type: Date, required: true, index: true },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  evidenceScanned: Number,
  painEvidence: Number,
  highIntentEvidence: Number,
  workaroundEvidence: Number,
  sourcesScanned: Number,
  sourceKinds: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sourceNames: { type: [mongoose.Schema.Types.Mixed], default: [] },
  categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  topPersonas: { type: [mongoose.Schema.Types.Mixed], default: [] },
  clusters: { type: [crossSourceClusterSchema], default: [] },
}, { timestamps: true });

crossSourceScanSchema.index({ createdAt: -1 });

const EvidenceItemModel = mongoose.models.EvidenceItem || mongoose.model('EvidenceItem', evidenceItemSchema);
const CrossSourceScanModel = mongoose.models.CrossSourceScan || mongoose.model('CrossSourceScan', crossSourceScanSchema);

function normalizeKind(value) {
  const kind = safeText(value, 40).toLowerCase();
  return SOURCE_KINDS.has(kind) ? kind : 'web';
}

function parseDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildFingerprint(item) {
  const stable = [item.sourceKind, item.sourceName, item.externalId, item.sourceUrl, item.title, item.text.slice(0, 800)].join('|').toLowerCase();
  return crypto.createHash('sha256').update(stable).digest('hex');
}

function normalizeEvidence(item, fallback = {}) {
  const sourceKind = normalizeKind(item?.sourceKind ?? item?.source_kind ?? fallback.sourceKind);
  const sourceName = safeText(item?.sourceName ?? item?.source_name ?? item?.platform ?? fallback.sourceName ?? sourceKind, 120) || sourceKind;
  const text = safeText(item?.text ?? item?.body ?? item?.content, 12000);
  if (!text) return null;

  const normalized = {
    externalId: safeText(item?.externalId ?? item?.external_id ?? item?.id, 180),
    sourceKind,
    sourceName,
    sourceUrl: safeText(item?.sourceUrl ?? item?.source_url ?? item?.url ?? item?.permalink, 1200),
    community: safeText(item?.community ?? item?.subreddit ?? item?.forum, 160),
    author: safeText(item?.author, 120),
    title: safeText(item?.title, 500),
    text,
    publishedAt: parseDate(item?.publishedAt ?? item?.published_at ?? item?.date),
    engagementScore: Number(item?.engagementScore ?? item?.engagement_score ?? item?.score ?? item?.likes ?? 0) || 0,
    commentsCount: Math.max(0, Number(item?.commentsCount ?? item?.comments_count ?? item?.num_comments ?? 0) || 0),
    tags: safeList(item?.tags, 20, 80),
    metadata: item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {},
    batchId: safeText(item?.batchId ?? item?.batch_id ?? fallback.batchId, 120),
    ingestedBy: safeText(item?.ingestedBy ?? item?.ingested_by ?? fallback.ingestedBy ?? 'api', 80) || 'api',
    lastSeenAt: new Date(),
  };
  return { ...normalized, fingerprint: buildFingerprint(normalized) };
}

function buildQuery(input = {}) {
  const query = {};
  if (input.sourceKind || input.source_kind) query.sourceKind = normalizeKind(input.sourceKind ?? input.source_kind);
  if (input.sourceName || input.source_name) query.sourceName = safeText(input.sourceName ?? input.source_name, 120);
  if (input.community) query.community = safeText(input.community, 160);
  if (input.batchId || input.batch_id) query.batchId = safeText(input.batchId ?? input.batch_id, 120);
  if (input.tags) {
    const tags = typeof input.tags === 'string' ? input.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : safeList(input.tags, 20, 80);
    if (tags.length) query.tags = { $in: tags };
  }
  if (input.q && String(input.q).trim()) query.$text = { $search: safeText(input.q, 240) };
  const since = parseDate(input.since);
  if (since) query.createdAt = { $gte: since };
  return query;
}

function serializeItem(item) {
  const raw = item?.toObject ? item.toObject() : item;
  return {
    id: String(raw._id || ''),
    externalId: raw.externalId,
    sourceKind: raw.sourceKind,
    sourceName: raw.sourceName,
    sourceUrl: raw.sourceUrl,
    community: raw.community,
    author: raw.author,
    title: raw.title,
    text: raw.text,
    publishedAt: raw.publishedAt,
    engagementScore: raw.engagementScore,
    commentsCount: raw.commentsCount,
    tags: raw.tags || [],
    batchId: raw.batchId,
    ingestedBy: raw.ingestedBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function sanitizeReport(report) {
  return {
    generatedAt: report.generatedAt,
    evidenceScanned: Math.max(0, Number(report.evidenceScanned) || 0),
    painEvidence: Math.max(0, Number(report.painEvidence) || 0),
    highIntentEvidence: Math.max(0, Number(report.highIntentEvidence) || 0),
    workaroundEvidence: Math.max(0, Number(report.workaroundEvidence) || 0),
    sourcesScanned: Math.max(0, Number(report.sourcesScanned) || 0),
    sourceKinds: Array.isArray(report.sourceKinds) ? report.sourceKinds.slice(0, 30) : [],
    sourceNames: Array.isArray(report.sourceNames) ? report.sourceNames.slice(0, 30) : [],
    categories: Array.isArray(report.categories) ? report.categories.slice(0, 30) : [],
    topPersonas: Array.isArray(report.topPersonas) ? report.topPersonas.slice(0, 20) : [],
    clusters: Array.isArray(report.clusters) ? report.clusters.slice(0, 30).map((cluster) => ({
      clusterId: safeText(cluster.id ?? cluster.clusterId, 240),
      category: safeText(cluster.category, 80),
      label: safeText(cluster.label, 220),
      painScore: Number(cluster.painScore) || 0,
      severity: Number(cluster.severity) || 0,
      recurrence: Number(cluster.recurrence) || 0,
      commercialIntent: Number(cluster.commercialIntent) || 0,
      urgency: Number(cluster.urgency) || 0,
      workaroundBurden: Number(cluster.workaroundBurden) || 0,
      confidence: Number(cluster.confidence) || 0,
      evidenceCount: Number(cluster.evidenceCount) || 0,
      distinctSources: Number(cluster.distinctSources) || 0,
      distinctCommunities: Number(cluster.distinctCommunities) || 0,
      personas: safeList(cluster.personas, 8, 80),
      keywords: safeList(cluster.keywords, 15, 50),
      opportunityReason: safeText(cluster.opportunityReason, 700),
      evidence: Array.isArray(cluster.evidence) ? cluster.evidence.slice(0, 6).map((item) => ({
        sourceKind: safeText(item.sourceKind, 40),
        sourceName: safeText(item.sourceName, 120),
        externalId: safeText(item.externalId, 180),
        community: safeText(item.community, 160),
        author: safeText(item.author, 120),
        title: safeText(item.title, 300),
        text: safeText(item.text, 700),
        url: safeText(item.url, 1200),
        engagementScore: Number(item.engagementScore) || 0,
        category: safeText(item.category, 80),
        severity: Number(item.severity) || 0,
        commercialIntent: Number(item.commercialIntent) || 0,
        urgency: Number(item.urgency) || 0,
        workaroundBurden: Number(item.workaroundBurden) || 0,
        personas: safeList(item.personas, 6, 80),
        keywords: safeList(item.keywords, 12, 50),
      })) : [],
    })).filter((cluster) => cluster.clusterId && cluster.label) : [],
  };
}

function compareScans(current, previous) {
  if (!current) return [];
  const previousMap = new Map((previous?.clusters || []).map((cluster) => [cluster.clusterId, cluster]));
  return (current.clusters || []).map((cluster) => {
    const prior = previousMap.get(cluster.clusterId);
    const currentScore = Number(cluster.painScore) || 0;
    const previousScore = Number(prior?.painScore) || 0;
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
      confidence: Number(cluster.confidence) || 0,
      commercialIntent: Number(cluster.commercialIntent) || 0,
      recurrence: Number(cluster.recurrence) || 0,
      status,
    };
  }).sort((a, b) => {
    const priority = { new: 4, rising: 3, persistent: 2, falling: 1 };
    return (priority[b.status] - priority[a.status]) || (b.currentScore - a.currentScore);
  }).slice(0, 30);
}

export function createEvidenceRouter() {
  const router = express.Router();

  router.get('/stats', async (_req, res) => {
    try {
      const [total, byKind, bySource] = await Promise.all([
        EvidenceItemModel.countDocuments({}),
        EvidenceItemModel.aggregate([{ $group: { _id: '$sourceKind', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        EvidenceItemModel.aggregate([{ $group: { _id: '$sourceName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
      ]);
      return res.json({
        total,
        byKind: byKind.map((item) => ({ sourceKind: item._id, count: item.count })),
        bySource: bySource.map((item) => ({ sourceName: item._id, count: item.count })),
      });
    } catch (error) {
      console.error('Failed to load evidence stats:', error);
      return res.status(500).json({ message: 'Failed to load evidence stats' });
    }
  });

  router.get('/scans', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
      const scans = await CrossSourceScanModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ scans, comparison: compareScans(scans[0], scans[1]) });
    } catch (error) {
      console.error('Failed to load cross-source scans:', error);
      return res.status(500).json({ message: 'Failed to load cross-source scan history' });
    }
  });

  router.post('/scans', async (req, res) => {
    try {
      const report = sanitizeReport(req.body?.report || {});
      if (!report.clusters.length) return res.status(400).json({ message: 'A report with at least one pain cluster is required' });
      const generatedAt = parseDate(report.generatedAt) || new Date();
      const scan = await CrossSourceScanModel.create({
        name: safeText(req.body?.name, 120) || `Cross-source scan ${generatedAt.toISOString().slice(0, 10)}`,
        generatedAt,
        filters: req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {},
        ...report,
      });
      return res.status(201).json({ scan });
    } catch (error) {
      console.error('Failed to save cross-source scan:', error);
      return res.status(500).json({ message: 'Failed to save cross-source scan' });
    }
  });

  router.delete('/scans/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid scan id' });
      const deleted = await CrossSourceScanModel.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Cross-source scan not found' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to delete cross-source scan:', error);
      return res.status(500).json({ message: 'Failed to delete cross-source scan' });
    }
  });

  router.post('/bulk', async (req, res) => {
    try {
      const items = req.body?.items;
      if (!Array.isArray(items)) return res.status(400).json({ message: 'Request body must include items[]' });
      if (items.length < 1 || items.length > 500) return res.status(400).json({ message: 'Evidence batches must contain 1-500 items' });
      const fallback = {
        sourceKind: req.body?.sourceKind ?? req.body?.source_kind,
        sourceName: req.body?.sourceName ?? req.body?.source_name,
        batchId: req.body?.batchId ?? req.body?.batch_id,
        ingestedBy: req.body?.ingestedBy ?? req.body?.ingested_by ?? 'api',
      };
      const normalized = items.map((item) => normalizeEvidence(item, fallback)).filter(Boolean);
      if (!normalized.length) return res.status(400).json({ message: 'No valid evidence items were supplied' });
      const operations = normalized.map((item) => ({
        updateOne: {
          filter: { fingerprint: item.fingerprint },
          update: { $set: item, $setOnInsert: { createdAt: new Date() } },
          upsert: true,
        },
      }));
      const result = await EvidenceItemModel.bulkWrite(operations, { ordered: false });
      return res.json({
        receivedCount: items.length,
        processedCount: normalized.length,
        insertedCount: result.upsertedCount || 0,
        updatedCount: result.modifiedCount || 0,
        matchedCount: result.matchedCount || 0,
      });
    } catch (error) {
      console.error('Failed to ingest evidence:', error);
      return res.status(500).json({ message: 'Failed to ingest evidence' });
    }
  });

  router.post('/analyze', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.body?.limit) || 500, 1), 2000);
      const query = buildQuery(req.body || {});
      const items = await EvidenceItemModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      const report = analyzeGeneralEvidence(items.map((item) => ({
        id: item.externalId || String(item._id),
        sourceKind: item.sourceKind,
        sourceName: item.sourceName,
        community: item.community,
        author: item.author,
        title: item.title,
        text: item.text,
        url: item.sourceUrl,
        engagementScore: item.engagementScore,
        publishedAt: item.publishedAt,
        tags: item.tags,
      })));
      return res.json({ report, filters: req.body || {} });
    } catch (error) {
      console.error('Failed to analyze cross-source evidence:', error);
      return res.status(500).json({ message: 'Failed to analyze evidence' });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const query = buildQuery(req.query || {});
      const items = await EvidenceItemModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ count: items.length, items: items.map(serializeItem) });
    } catch (error) {
      console.error('Failed to search evidence:', error);
      return res.status(500).json({ message: 'Failed to search evidence' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid evidence id' });
      const deleted = await EvidenceItemModel.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Evidence item not found' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Failed to delete evidence:', error);
      return res.status(500).json({ message: 'Failed to delete evidence' });
    }
  });

  return router;
}
