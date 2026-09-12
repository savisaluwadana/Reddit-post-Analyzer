import express from 'express';
import mongoose from 'mongoose';
import {
  analyzeEvidenceIndependence,
  analyzeResearchSignals,
  buildDeepScrapePlan,
  buildResearchSearchPlan,
} from './researchSearchPlanner.js';

const safeText = (value, maxLength = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const safeList = (value, maxItems = 50, maxLength = 300) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => safeText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
};
const clamp = (value, min, max, fallback = min) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

const queryRunSchema = new mongoose.Schema({
  missionId: { type: String, default: '', maxlength: 120 },
  query: { type: String, required: true, maxlength: 700 },
  sourceKind: { type: String, default: '', maxlength: 60 },
  resultsSeen: { type: Number, default: 0 },
  evidenceAdded: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 700 },
  executedAt: { type: Date, default: Date.now },
}, { _id: false });

const visitedUrlSchema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 1400 },
  sourceKind: { type: String, default: '', maxlength: 60 },
  canonicalUrl: { type: String, default: '', maxlength: 1400 },
  depth: { type: Number, default: 0 },
  evidenceAdded: { type: Number, default: 0 },
  status: { type: String, default: 'visited', maxlength: 60 },
  visitedAt: { type: Date, default: Date.now },
}, { _id: false });

const deepScrapeSchema = new mongoose.Schema({
  rootUrl: { type: String, required: true, maxlength: 1400 },
  sourceKind: { type: String, default: '', maxlength: 60 },
  pagesVisited: { type: Number, default: 1 },
  branchesVisited: { type: Number, default: 0 },
  repliesInspected: { type: Number, default: 0 },
  evidenceAdded: { type: Number, default: 0 },
  claimTypes: { type: [String], default: [] },
  stoppedReason: { type: String, default: '', maxlength: 700 },
  completedAt: { type: Date, default: Date.now },
}, { _id: false });

const searchMemorySchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  queries: { type: [queryRunSchema], default: [] },
  visitedUrls: { type: [visitedUrlSchema], default: [] },
  deepScrapes: { type: [deepScrapeSchema], default: [] },
  discoveredEntities: { type: [String], default: [] },
  failedSources: { type: [String], default: [] },
}, { timestamps: true });

const SearchMemoryModel = mongoose.models.ResearchSearchMemory || mongoose.model('ResearchSearchMemory', searchMemorySchema);

function researchJobModel() {
  const model = mongoose.models.ResearchJob;
  if (!model) throw new Error('ResearchJob model is not initialized');
  return model;
}

function evidenceModel() {
  const model = mongoose.models.EvidenceItem;
  if (!model) throw new Error('EvidenceItem model is not initialized');
  return model;
}

async function loadJob(jobId) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  return researchJobModel().findById(jobId).lean();
}

async function getMemory(jobId) {
  return SearchMemoryModel.findOne({ jobId }).lean();
}

function memoryAwarePlan(job, memory) {
  const plan = buildResearchSearchPlan(job, job.coverage || null);
  const alreadyRun = new Set((memory?.queries || []).map((item) => item.query.toLowerCase()));
  return {
    ...plan,
    missions: plan.missions.map((mission) => ({
      ...mission,
      queryTemplates: mission.queryTemplates.filter((query) => !alreadyRun.has(query.toLowerCase())),
    })).filter((mission) => mission.queryTemplates.length > 0),
    memorySummary: {
      queriesExecuted: memory?.queries?.length || 0,
      urlsVisited: memory?.visitedUrls?.length || 0,
      deepScrapes: memory?.deepScrapes?.length || 0,
      discoveredEntities: memory?.discoveredEntities || [],
      failedSources: memory?.failedSources || [],
    },
  };
}

function buildQualityReport(evidence, memory) {
  const independence = analyzeEvidenceIndependence(evidence);
  const signals = analyzeResearchSignals(evidence);
  const sourceNames = new Set(evidence.map((item) => item.sourceName).filter(Boolean));
  const communities = new Set(evidence.map((item) => item.community).filter(Boolean));
  const authors = new Set(evidence.map((item) => item.author).filter(Boolean));
  const deepScrapeEvidence = (memory?.deepScrapes || []).reduce((sum, item) => sum + (Number(item.evidenceAdded) || 0), 0);
  const deepScrapeCount = memory?.deepScrapes?.length || 0;
  const total = evidence.length;
  const qualityScore = Math.round(
    Math.min(100, independence.independentEvidenceCount / 40 * 100) * 0.30 +
    Math.min(100, sourceNames.size / 6 * 100) * 0.16 +
    Math.min(100, communities.size / 6 * 100) * 0.10 +
    Math.min(100, signals.strongCommercial / 6 * 100) * 0.14 +
    Math.min(100, signals.workaround / 6 * 100) * 0.10 +
    Math.min(100, signals.quantifiedImpact / 4 * 100) * 0.08 +
    Math.min(100, signals.contradictionCandidates / 3 * 100) * 0.06 +
    Math.min(100, deepScrapeCount / 4 * 100) * 0.06
  );

  const gaps = [];
  if (independence.duplicationRate > 0.25) gaps.push({ type: 'duplicate-evidence', priority: 'high', message: `${Math.round(independence.duplicationRate * 100)}% of evidence appears near-duplicate. Find independent sources rather than more copies of the same claim.` });
  if (independence.independentEvidenceCount < 30) gaps.push({ type: 'independent-evidence', priority: 'high', message: `Only ${independence.independentEvidenceCount} evidence items look independent. Continue source discovery.` });
  if (signals.strongCommercial < 5) gaps.push({ type: 'commercial-proof', priority: 'high', message: 'Search specifically for paying, cancelling, switching, procurement, budget, refund, and alternative-seeking behavior.' });
  if (signals.contradictionCandidates < 2) gaps.push({ type: 'contradiction', priority: 'medium', message: 'Actively search for positive/contradicting experiences so the conclusion is not confirmation-biased.' });
  if (signals.quantifiedImpact < 3) gaps.push({ type: 'quantified-impact', priority: 'medium', message: 'Find claims containing time, money, frequency, error rate, or measurable business impact.' });
  if (deepScrapeCount < 2 || deepScrapeEvidence < Math.min(10, Math.ceil(total * 0.15))) gaps.push({ type: 'deep-context', priority: 'medium', message: 'Deep-scrape several evidence-rich threads/pages rather than relying mainly on search snippets or isolated comments.' });
  if (authors.size > 0 && authors.size < Math.min(10, Math.ceil(total * 0.35))) gaps.push({ type: 'author-diversity', priority: 'medium', message: 'Evidence is concentrated among too few identifiable authors. Seek more independent practitioners/customers.' });

  return {
    generatedAt: new Date().toISOString(),
    qualityScore,
    readyForSynthesis: qualityScore >= 72 && gaps.every((gap) => gap.priority !== 'high'),
    independence,
    signals,
    diversity: { namedSources: sourceNames.size, communities: communities.size, identifiableAuthors: authors.size },
    deepScraping: { runs: deepScrapeCount, evidenceAdded: deepScrapeEvidence },
    gaps,
  };
}

export function createResearchSearchRouter() {
  const router = express.Router();

  router.get('/jobs/:id/plan', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const memory = await getMemory(String(job._id));
      return res.json({ jobId: String(job._id), plan: memoryAwarePlan(job, memory) });
    } catch (error) {
      console.error('Failed to build research search plan:', error);
      return res.status(500).json({ message: 'Failed to build research search plan' });
    }
  });

  router.get('/jobs/:id/quality', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const [memory, evidence] = await Promise.all([
        getMemory(String(job._id)),
        evidenceModel().find({ batchId: job.batchId }).sort({ createdAt: -1 }).limit(2000).lean(),
      ]);
      return res.json({ jobId: String(job._id), report: buildQualityReport(evidence, memory), plan: memoryAwarePlan(job, memory) });
    } catch (error) {
      console.error('Failed to evaluate research search quality:', error);
      return res.status(500).json({ message: 'Failed to evaluate research search quality' });
    }
  });

  router.get('/jobs/:id/memory', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const memory = await getMemory(String(job._id));
      return res.json({ jobId: String(job._id), memory: memory || { jobId: String(job._id), queries: [], visitedUrls: [], deepScrapes: [], discoveredEntities: [], failedSources: [] } });
    } catch (error) {
      console.error('Failed to load research search memory:', error);
      return res.status(500).json({ message: 'Failed to load research search memory' });
    }
  });

  router.post('/jobs/:id/progress', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const queryItems = Array.isArray(req.body?.queries) ? req.body.queries.slice(0, 100) : [];
      const urlItems = Array.isArray(req.body?.visitedUrls ?? req.body?.visited_urls) ? (req.body.visitedUrls ?? req.body.visited_urls).slice(0, 200) : [];
      const queries = queryItems.map((item) => ({
        missionId: safeText(item?.missionId ?? item?.mission_id, 120), query: safeText(item?.query, 700), sourceKind: safeText(item?.sourceKind ?? item?.source_kind, 60),
        resultsSeen: clamp(item?.resultsSeen ?? item?.results_seen, 0, 10000, 0), evidenceAdded: clamp(item?.evidenceAdded ?? item?.evidence_added, 0, 10000, 0), notes: safeText(item?.notes, 700), executedAt: new Date(),
      })).filter((item) => item.query);
      const visitedUrls = urlItems.map((item) => ({
        url: safeText(item?.url, 1400), sourceKind: safeText(item?.sourceKind ?? item?.source_kind, 60), canonicalUrl: safeText(item?.canonicalUrl ?? item?.canonical_url, 1400),
        depth: clamp(item?.depth, 0, 100, 0), evidenceAdded: clamp(item?.evidenceAdded ?? item?.evidence_added, 0, 10000, 0), status: safeText(item?.status, 60) || 'visited', visitedAt: new Date(),
      })).filter((item) => item.url);
      const discoveredEntities = safeList(req.body?.discoveredEntities ?? req.body?.discovered_entities, 100, 180);
      const failedSources = safeList(req.body?.failedSources ?? req.body?.failed_sources, 100, 500);
      const current = await SearchMemoryModel.findOne({ jobId: String(job._id) });
      const memory = current || new SearchMemoryModel({ jobId: String(job._id) });
      const queryMap = new Map((memory.queries || []).map((item) => [item.query.toLowerCase(), item.toObject ? item.toObject() : item]));
      queries.forEach((item) => queryMap.set(item.query.toLowerCase(), item));
      const urlMap = new Map((memory.visitedUrls || []).map((item) => [String(item.canonicalUrl || item.url).toLowerCase(), item.toObject ? item.toObject() : item]));
      visitedUrls.forEach((item) => urlMap.set(String(item.canonicalUrl || item.url).toLowerCase(), item));
      memory.queries = [...queryMap.values()].slice(-500);
      memory.visitedUrls = [...urlMap.values()].slice(-1500);
      memory.discoveredEntities = [...new Set([...(memory.discoveredEntities || []), ...discoveredEntities])].slice(0, 300);
      memory.failedSources = [...new Set([...(memory.failedSources || []), ...failedSources])].slice(0, 200);
      await memory.save();
      return res.json({ jobId: String(job._id), memory });
    } catch (error) {
      console.error('Failed to record research search progress:', error);
      return res.status(500).json({ message: 'Failed to record research search progress' });
    }
  });

  router.get('/deep-scrape-plan', (req, res) => {
    return res.json({ plan: buildDeepScrapePlan({ sourceKind: req.query.sourceKind ?? req.query.source_kind, url: req.query.url }) });
  });

  router.post('/jobs/:id/deep-scrape', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      const rootUrl = safeText(req.body?.rootUrl ?? req.body?.root_url, 1400);
      if (!rootUrl) return res.status(400).json({ message: 'root_url is required' });
      const report = {
        rootUrl,
        sourceKind: safeText(req.body?.sourceKind ?? req.body?.source_kind, 60),
        pagesVisited: clamp(req.body?.pagesVisited ?? req.body?.pages_visited, 1, 1000, 1),
        branchesVisited: clamp(req.body?.branchesVisited ?? req.body?.branches_visited, 0, 10000, 0),
        repliesInspected: clamp(req.body?.repliesInspected ?? req.body?.replies_inspected, 0, 100000, 0),
        evidenceAdded: clamp(req.body?.evidenceAdded ?? req.body?.evidence_added, 0, 10000, 0),
        claimTypes: safeList(req.body?.claimTypes ?? req.body?.claim_types, 20, 80),
        stoppedReason: safeText(req.body?.stoppedReason ?? req.body?.stopped_reason, 700),
        completedAt: new Date(),
      };
      const memory = await SearchMemoryModel.findOneAndUpdate(
        { jobId: String(job._id) },
        { $push: { deepScrapes: { $each: [report], $slice: -200 } } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.json({ jobId: String(job._id), report, memorySummary: { deepScrapes: memory.deepScrapes.length } });
    } catch (error) {
      console.error('Failed to record deep scrape:', error);
      return res.status(500).json({ message: 'Failed to record deep scrape' });
    }
  });

  return router;
}
