import express from 'express';
import mongoose from 'mongoose';
import {
  buildScrapeContract,
  canonicalizeResearchUrl,
  classifyAccessBoundary,
  evaluateExtractionQuality,
  rankScrapeFrontier,
  scoreScrapeCandidate,
  shouldStopScrapeSession,
} from './scrapeIntelligenceCore.js';

const safeText = (value, maxLength = 1000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const safeList = (value, maxItems = 50, maxLength = 500) => Array.isArray(value)
  ? [...new Set(value.map((item) => safeText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
  : [];
const clamp = (value, min, max, fallback = min) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

const scrapeCandidateSchema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 1600 },
  canonicalUrl: { type: String, required: true, maxlength: 1600 },
  rootUrl: { type: String, default: '', maxlength: 1600 },
  sourceKind: { type: String, default: 'web', maxlength: 60 },
  depth: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  action: { type: String, default: 'visit', maxlength: 40 },
  status: { type: String, default: 'queued', maxlength: 40 },
  title: { type: String, default: '', maxlength: 500 },
  context: { type: String, default: '', maxlength: 1200 },
  reasons: { type: [String], default: [] },
  discoveredFrom: { type: String, default: '', maxlength: 1600 },
  discoveredAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const scrapePageSchema = new mongoose.Schema({
  canonicalUrl: { type: String, required: true, maxlength: 1600 },
  rootUrl: { type: String, default: '', maxlength: 1600 },
  sourceKind: { type: String, default: 'web', maxlength: 60 },
  depth: { type: Number, default: 0 },
  status: { type: String, default: 'visited', maxlength: 60 },
  accessAction: { type: String, default: '', maxlength: 40 },
  accessReason: { type: String, default: '', maxlength: 120 },
  qualityScore: { type: Number, default: 0 },
  qualityGrade: { type: String, default: '', maxlength: 40 },
  qualityIssues: { type: [String], default: [] },
  claimCount: { type: Number, default: 0 },
  evidenceAdded: { type: Number, default: 0 },
  duplicateEvidence: { type: Number, default: 0 },
  discoveredLinks: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 1200 },
  visitedAt: { type: Date, default: Date.now },
}, { _id: false });

const scrapeSessionSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  policy: { type: mongoose.Schema.Types.Mixed, default: {} },
  candidates: { type: [scrapeCandidateSchema], default: [] },
  pages: { type: [scrapePageSchema], default: [] },
  recentEvidenceYields: { type: [Number], default: [] },
  stopped: { type: Boolean, default: false },
  stopReason: { type: String, default: '', maxlength: 120 },
}, { timestamps: true });

const ScrapeSessionModel = mongoose.models.ResearchScrapeSession || mongoose.model('ResearchScrapeSession', scrapeSessionSchema);

function researchJobModel() {
  const model = mongoose.models.ResearchJob;
  if (!model) throw new Error('ResearchJob model is not initialized');
  return model;
}

async function loadJob(jobId) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  return researchJobModel().findById(jobId).lean();
}

function normalizePolicy(input = {}) {
  return {
    maxPages: clamp(input.maxPages ?? input.max_pages, 5, 1000, 80),
    evidenceTarget: clamp(input.evidenceTarget ?? input.evidence_target, 1, 5000, 60),
    minMarginalYield: clamp(input.minMarginalYield ?? input.min_marginal_yield, 0, 20, 0.25),
    maxDuplicateRate: clamp(input.maxDuplicateRate ?? input.max_duplicate_rate, 0, 1, 0.45),
    maxBlockedShare: clamp(input.maxBlockedShare ?? input.max_blocked_share, 0, 1, 0.55),
    maxPerHost: clamp(input.maxPerHost ?? input.max_per_host, 1, 50, 6),
  };
}

function pageStats(session) {
  const pages = session.pages || [];
  const visited = pages.filter((item) => item.status === 'visited' || item.status === 'extracted');
  const blocked = pages.filter((item) => ['blocked','skipped','retry-later'].includes(item.status));
  const evidenceAdded = pages.reduce((sum, item) => sum + (Number(item.evidenceAdded) || 0), 0);
  const duplicateEvidence = pages.reduce((sum, item) => sum + (Number(item.duplicateEvidence) || 0), 0);
  const totalEvidenceObserved = evidenceAdded + duplicateEvidence;
  const queued = (session.candidates || []).filter((item) => item.status === 'queued' && item.action === 'visit');
  return {
    pagesVisited: pages.length,
    successfulPages: visited.length,
    blockedPages: blocked.length,
    evidenceAdded,
    duplicateEvidence,
    duplicateRate: totalEvidenceObserved ? duplicateEvidence / totalEvidenceObserved : 0,
    blockedShare: pages.length ? blocked.length / pages.length : 0,
    frontierCount: queued.length,
    recentEvidenceYields: session.recentEvidenceYields || [],
  };
}

function summarize(session) {
  const raw = session?.toObject ? session.toObject() : session;
  const stats = pageStats(raw);
  const stop = shouldStopScrapeSession(stats, raw.policy || {});
  const qualityScores = (raw.pages || []).map((item) => Number(item.qualityScore) || 0).filter((value) => value > 0);
  const averageQuality = qualityScores.length ? qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length : 0;
  const hosts = new Set((raw.candidates || []).map((item) => {
    try { return new URL(item.canonicalUrl).hostname; } catch { return ''; }
  }).filter(Boolean));
  return {
    jobId: raw.jobId,
    stopped: Boolean(raw.stopped || stop.stop),
    stopReason: raw.stopReason || (stop.stop ? stop.reason : ''),
    policy: raw.policy || {},
    stats: { ...stats, averageExtractionQuality: Number(averageQuality.toFixed(1)), candidateHosts: hosts.size },
    stopDecision: stop,
    frontier: (raw.candidates || []).filter((item) => item.status === 'queued').sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 30),
    recentPages: [...(raw.pages || [])].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 20),
    updatedAt: raw.updatedAt,
  };
}

function mergeCandidates(session, inputCandidates = [], context = {}) {
  const visitedUrls = (session.pages || []).map((item) => item.canonicalUrl);
  const ranked = rankScrapeFrontier(inputCandidates, {
    ...context,
    visitedUrls,
    maxPerHost: session.policy?.maxPerHost || 6,
    limit: Math.min(Math.max(inputCandidates.length, 1), 100),
  });
  const existing = new Map((session.candidates || []).map((item) => [item.canonicalUrl, item.toObject ? item.toObject() : item]));
  const now = new Date();
  [...ranked.selected, ...ranked.deferred, ...ranked.skipped].forEach((item) => {
    const current = existing.get(item.url);
    if (current && ['visited','extracted','blocked','skipped'].includes(current.status)) return;
    existing.set(item.url, {
      url: safeText(item.url, 1600),
      canonicalUrl: item.url,
      rootUrl: canonicalizeResearchUrl(item.rootUrl ?? item.root_url ?? item.url),
      sourceKind: safeText(item.sourceKind, 60) || 'web',
      depth: clamp(item.depth, 0, 100, 0),
      score: clamp(item.score, 0, 100, 0),
      action: safeText(item.action, 40) || 'visit',
      status: item.action === 'skip' ? 'skipped' : item.action === 'retry-later' ? 'retry-later' : 'queued',
      title: safeText(item.title, 500),
      context: safeText(item.context ?? item.snippet, 1200),
      reasons: safeList(item.reasons, 20, 120),
      discoveredFrom: safeText(item.discoveredFrom ?? item.discovered_from, 1600),
      discoveredAt: current?.discoveredAt || now,
      updatedAt: now,
    });
  });
  session.candidates = [...existing.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3000);
  return ranked;
}

export function createScrapeIntelligenceRouter() {
  const router = express.Router();

  router.get('/source-contract', (req, res) => {
    return res.json({ contract: buildScrapeContract({ sourceKind: req.query.sourceKind ?? req.query.source_kind, url: req.query.url }) });
  });

  router.post('/jobs/:id/session', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const policy = normalizePolicy(req.body?.policy || req.body || {});
      const session = await ScrapeSessionModel.findOneAndUpdate(
        { jobId: String(job._id) },
        { $setOnInsert: { jobId: String(job._id), candidates: [], pages: [], recentEvidenceYields: [] }, $set: { policy } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.status(201).json({ session: summarize(session) });
    } catch (error) {
      console.error('Failed to start scrape session:', error);
      return res.status(500).json({ message: 'Failed to start scrape session' });
    }
  });

  router.get('/jobs/:id/summary', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const session = await ScrapeSessionModel.findOne({ jobId: String(job._id) }).lean();
      if (!session) return res.status(404).json({ message: 'Scrape session not found' });
      return res.json({ session: summarize(session) });
    } catch (error) {
      console.error('Failed to load scrape session:', error);
      return res.status(500).json({ message: 'Failed to load scrape session' });
    }
  });

  router.post('/jobs/:id/candidates', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates.slice(0, 300) : [];
      if (!candidates.length) return res.status(400).json({ message: 'candidates[] is required' });
      let session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) session = new ScrapeSessionModel({ jobId: String(job._id), policy: normalizePolicy({}) });
      const ranked = mergeCandidates(session, candidates, { topic: job.topic, audience: job.audience, objective: req.body?.objective, query: req.body?.query });
      session.stopped = false;
      session.stopReason = '';
      await session.save();
      return res.json({ ranking: ranked, session: summarize(session) });
    } catch (error) {
      console.error('Failed to add scrape candidates:', error);
      return res.status(500).json({ message: 'Failed to add scrape candidates' });
    }
  });

  router.get('/jobs/:id/next', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) return res.status(404).json({ message: 'Scrape session not found' });
      const summary = summarize(session);
      if (summary.stopped) return res.json({ stopped: true, reason: summary.stopReason || summary.stopDecision.reason, items: [], session: summary });
      const limit = clamp(req.query.limit, 1, 30, 8);
      const visited = (session.pages || []).map((item) => item.canonicalUrl);
      const reranked = rankScrapeFrontier(
        (session.candidates || []).filter((item) => item.status === 'queued').map((item) => item.toObject ? item.toObject() : item),
        { topic: job.topic, audience: job.audience, visitedUrls: visited, maxPerHost: session.policy?.maxPerHost || 6, limit },
      );
      return res.json({ stopped: false, items: reranked.selected.slice(0, limit), deferred: reranked.deferred.slice(0, limit), session: summary });
    } catch (error) {
      console.error('Failed to get next scrape batch:', error);
      return res.status(500).json({ message: 'Failed to get next scrape batch' });
    }
  });

  router.post('/jobs/:id/page-result', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      let session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) session = new ScrapeSessionModel({ jobId: String(job._id), policy: normalizePolicy({}) });

      const canonicalUrl = canonicalizeResearchUrl(req.body?.canonicalUrl ?? req.body?.canonical_url ?? req.body?.url);
      if (!canonicalUrl) return res.status(400).json({ message: 'A valid public page URL is required' });
      const access = classifyAccessBoundary(req.body || {});
      const extraction = evaluateExtractionQuality({ ...req.body, canonicalUrl });
      const status = access.action === 'skip' ? 'blocked' : access.action === 'retry-later' ? 'retry-later' : extraction.grade === 'discard' ? 'visited' : 'extracted';
      const evidenceAdded = clamp(req.body?.evidenceAdded ?? req.body?.evidence_added, 0, 10000, 0);
      const duplicateEvidence = clamp(req.body?.duplicateEvidence ?? req.body?.duplicate_evidence, 0, 10000, 0);
      const page = {
        canonicalUrl,
        rootUrl: canonicalizeResearchUrl(req.body?.rootUrl ?? req.body?.root_url ?? canonicalUrl),
        sourceKind: safeText(req.body?.sourceKind ?? req.body?.source_kind, 60) || 'web',
        depth: clamp(req.body?.depth, 0, 100, 0),
        status,
        accessAction: access.action,
        accessReason: access.reason,
        qualityScore: extraction.score,
        qualityGrade: extraction.grade,
        qualityIssues: extraction.issues,
        claimCount: clamp(req.body?.claimCount ?? req.body?.claim_count ?? (Array.isArray(req.body?.claims) ? req.body.claims.length : 0), 0, 10000, 0),
        evidenceAdded,
        duplicateEvidence,
        discoveredLinks: Array.isArray(req.body?.discoveredCandidates ?? req.body?.discovered_candidates) ? (req.body.discoveredCandidates ?? req.body.discovered_candidates).length : 0,
        notes: safeText(req.body?.notes, 1200),
        visitedAt: new Date(),
      };

      const pageMap = new Map((session.pages || []).map((item) => [item.canonicalUrl, item.toObject ? item.toObject() : item]));
      pageMap.set(canonicalUrl, page);
      session.pages = [...pageMap.values()].slice(-2000);
      session.recentEvidenceYields = [...(session.recentEvidenceYields || []), evidenceAdded].slice(-20);

      const candidates = Array.isArray(req.body?.discoveredCandidates ?? req.body?.discovered_candidates)
        ? (req.body.discoveredCandidates ?? req.body.discovered_candidates).slice(0, 250).map((item) => ({ ...item, discoveredFrom: canonicalUrl, depth: Number(item.depth ?? page.depth + 1) }))
        : [];
      if (candidates.length) mergeCandidates(session, candidates, { topic: job.topic, audience: job.audience, objective: 'follow evidence-rich branches' });

      session.candidates = (session.candidates || []).map((item) => {
        if (item.canonicalUrl !== canonicalUrl) return item;
        const raw = item.toObject ? item.toObject() : item;
        return { ...raw, status, updatedAt: new Date() };
      });

      const stats = pageStats(session);
      const stop = shouldStopScrapeSession(stats, session.policy || {});
      if (stop.stop) {
        session.stopped = true;
        session.stopReason = stop.reason;
      }
      await session.save();
      return res.json({ page, extractionQuality: extraction, stopDecision: stop, session: summarize(session) });
    } catch (error) {
      console.error('Failed to record scrape page result:', error);
      return res.status(500).json({ message: 'Failed to record scrape page result' });
    }
  });

  router.post('/jobs/:id/reopen', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) return res.status(404).json({ message: 'Scrape session not found' });
      session.stopped = false;
      session.stopReason = '';
      if (req.body?.policy) session.policy = { ...(session.policy || {}), ...normalizePolicy(req.body.policy) };
      await session.save();
      return res.json({ session: summarize(session) });
    } catch (error) {
      console.error('Failed to reopen scrape session:', error);
      return res.status(500).json({ message: 'Failed to reopen scrape session' });
    }
  });

  return router;
}
