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
  sourcePolicy,
} from './scrapeIntelligenceCore.js';

const COLLECTION_WRITABLE_STATUSES = new Set(['queued', 'claimed', 'collecting', 'gap-research']);
const DEFAULT_RETRY_SECONDS = 60;
const DEFAULT_LEASE_SECONDS = 300;

const safeText = (value, maxLength = 1000) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
const safeList = (value, maxItems = 50, maxLength = 500) => Array.isArray(value)
  ? [...new Set(value.map((item) => safeText(item, maxLength)).filter(Boolean))].slice(0, maxItems)
  : [];
const clamp = (value, min, max, fallback = min) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};
const policyValue = (input, base, camel, snake, min, max, fallback) => {
  const candidate = input?.[camel] ?? input?.[snake];
  if (Number.isFinite(Number(candidate))) return clamp(candidate, min, max, fallback);
  const prior = base?.[camel] ?? base?.[snake];
  if (Number.isFinite(Number(prior))) return clamp(prior, min, max, fallback);
  return fallback;
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
  relevanceScore: { type: Number, default: 0 },
  firstHandLikelihood: { type: Number, default: 0 },
  evidenceYieldLikelihood: { type: Number, default: 0 },
  noveltyScore: { type: Number, default: 0 },
  recencyScore: { type: Number, default: 0 },
  commercialSignalLikelihood: { type: Number, default: 0 },
  contradictionLikelihood: { type: Number, default: 0 },
  sourceTrust: { type: Number, default: 0 },
  duplicateRisk: { type: Number, default: 0 },
  accessCost: { type: Number, default: 0 },
  isBranch: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  leaseExpiresAt: { type: Date, default: null },
  retryAfterAt: { type: Date, default: null },
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

function assertCollectionWritable(job, res) {
  if (COLLECTION_WRITABLE_STATUSES.has(job.status)) return true;
  res.status(409).json({
    message: `Scrape collection is closed while the research job is ${job.status}.`,
    status: job.status,
    collectionClosed: true,
  });
  return false;
}

function normalizePolicy(input = {}, base = {}) {
  return {
    maxPages: policyValue(input, base, 'maxPages', 'max_pages', 5, 1000, 80),
    evidenceTarget: policyValue(input, base, 'evidenceTarget', 'evidence_target', 1, 5000, 60),
    minMarginalYield: policyValue(input, base, 'minMarginalYield', 'min_marginal_yield', 0, 20, 0.25),
    maxDuplicateRate: policyValue(input, base, 'maxDuplicateRate', 'max_duplicate_rate', 0, 1, 0.45),
    maxBlockedShare: policyValue(input, base, 'maxBlockedShare', 'max_blocked_share', 0, 1, 0.55),
    maxPerHost: policyValue(input, base, 'maxPerHost', 'max_per_host', 1, 50, 6),
  };
}

function hostAndRootVisitCounts(session) {
  const hosts = {};
  const roots = {};
  for (const page of session.pages || []) {
    if (!['visited', 'extracted'].includes(page.status)) continue;
    try {
      const host = new URL(page.canonicalUrl).hostname.toLowerCase().replace(/^www\./, '');
      hosts[host] = (hosts[host] || 0) + 1;
    } catch { /* invalid persisted URL is ignored */ }
    const root = canonicalizeResearchUrl(page.rootUrl || page.canonicalUrl);
    if (root) roots[root] = (roots[root] || 0) + 1;
  }
  return { hosts, roots };
}

function pageStats(session) {
  const pages = session.pages || [];
  const successful = pages.filter((item) => item.status === 'visited' || item.status === 'extracted');
  const blocked = pages.filter((item) => ['blocked', 'skipped'].includes(item.status));
  const evidenceAdded = pages.reduce((sum, item) => sum + (Number(item.evidenceAdded) || 0), 0);
  const duplicateEvidence = pages.reduce((sum, item) => sum + (Number(item.duplicateEvidence) || 0), 0);
  const totalEvidenceObserved = evidenceAdded + duplicateEvidence;
  const frontier = (session.candidates || []).filter((item) => ['queued', 'in-progress'].includes(item.status) && item.action === 'visit');
  const retryLater = (session.candidates || []).filter((item) => item.status === 'retry-later');
  return {
    pagesVisited: pages.length,
    successfulPages: successful.length,
    blockedPages: blocked.length,
    retryLaterCount: retryLater.length,
    evidenceAdded,
    duplicateEvidence,
    duplicateRate: totalEvidenceObserved ? duplicateEvidence / totalEvidenceObserved : 0,
    blockedShare: pages.length ? blocked.length / pages.length : 0,
    frontierCount: frontier.length,
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
    frontier: (raw.candidates || [])
      .filter((item) => item.status === 'queued' && item.action === 'visit')
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 30),
    recentPages: [...(raw.pages || [])].sort((a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)).slice(0, 20),
    updatedAt: raw.updatedAt,
  };
}

function candidateRecord(item, current, now) {
  const components = item.components || {};
  return {
    url: safeText(item.url, 1600),
    canonicalUrl: item.url,
    rootUrl: canonicalizeResearchUrl(item.rootUrl ?? item.root_url ?? item.url),
    sourceKind: safeText(item.sourceKind ?? item.source_kind, 60) || 'web',
    depth: clamp(item.depth, 0, 100, 0),
    score: clamp(item.score, 0, 100, 0),
    action: safeText(item.action, 40) || 'visit',
    status: item.action === 'skip' ? 'skipped' : item.action === 'retry-later' ? 'retry-later' : current?.status === 'in-progress' ? 'in-progress' : 'queued',
    title: safeText(item.title, 500),
    context: safeText(item.context ?? item.snippet, 1200),
    reasons: safeList(item.reasons, 20, 120),
    relevanceScore: clamp(item.relevanceScore ?? item.relevance_score ?? components.relevance, 0, 100, 0),
    firstHandLikelihood: clamp(item.firstHandLikelihood ?? item.first_hand_likelihood ?? components.firstHand, 0, 100, 0),
    evidenceYieldLikelihood: clamp(item.evidenceYieldLikelihood ?? item.evidence_yield_likelihood ?? components.evidenceYield, 0, 100, 0),
    noveltyScore: clamp(item.noveltyScore ?? item.novelty_score ?? components.novelty, 0, 100, 0),
    recencyScore: clamp(item.recencyScore ?? item.recency_score ?? components.recency, 0, 100, 0),
    commercialSignalLikelihood: clamp(item.commercialSignalLikelihood ?? item.commercial_signal_likelihood ?? components.commercial, 0, 100, 0),
    contradictionLikelihood: clamp(item.contradictionLikelihood ?? item.contradiction_likelihood ?? components.contradiction, 0, 100, 0),
    sourceTrust: clamp(item.sourceTrust ?? item.source_trust ?? components.sourceTrust, 0, 100, 0),
    duplicateRisk: clamp(item.duplicateRisk ?? item.duplicate_risk ?? components.duplicateRisk, 0, 100, 0),
    accessCost: clamp(item.accessCost ?? item.access_cost ?? components.accessCost, 0, 100, 0),
    isBranch: Boolean(item.isBranch ?? item.is_branch ?? current?.isBranch),
    attempts: Number(current?.attempts) || 0,
    leaseExpiresAt: current?.leaseExpiresAt || null,
    retryAfterAt: item.action === 'retry-later' ? (current?.retryAfterAt || new Date(now.getTime() + DEFAULT_RETRY_SECONDS * 1000)) : null,
    discoveredFrom: safeText(item.discoveredFrom ?? item.discovered_from, 1600),
    discoveredAt: current?.discoveredAt || now,
    updatedAt: now,
  };
}

function mergeCandidates(session, inputCandidates = [], context = {}) {
  const visitedUrls = (session.pages || []).map((item) => item.canonicalUrl);
  const globalCounts = hostAndRootVisitCounts(session);
  const scoredMap = new Map();
  for (const candidate of inputCandidates) {
    const scored = scoreScrapeCandidate(candidate, { ...context, visitedUrls });
    if (!scored.url || visitedUrls.includes(scored.url)) continue;
    const prior = scoredMap.get(scored.url);
    if (!prior || scored.score > prior.score) scoredMap.set(scored.url, { ...candidate, ...scored });
  }
  const scoredItems = [...scoredMap.values()];
  const ranked = rankScrapeFrontier(scoredItems, {
    ...context,
    visitedUrls,
    hostVisitCounts: globalCounts.hosts,
    rootVisitCounts: globalCounts.roots,
    maxPerHost: session.policy?.maxPerHost || 6,
    limit: Math.min(Math.max(scoredItems.length, 1), 100),
  });
  const existing = new Map((session.candidates || []).map((item) => [item.canonicalUrl, item.toObject ? item.toObject() : item]));
  const now = new Date();
  for (const item of scoredItems) {
    const current = existing.get(item.url);
    if (current && ['visited','extracted','blocked','skipped'].includes(current.status)) continue;
    existing.set(item.url, candidateRecord(item, current, now));
  }
  session.candidates = [...existing.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3000);
  return ranked;
}

function reclaimCandidates(session, now = new Date()) {
  let changed = false;
  session.candidates = (session.candidates || []).map((candidate) => {
    const raw = candidate.toObject ? candidate.toObject() : candidate;
    if (raw.status === 'in-progress' && raw.leaseExpiresAt && new Date(raw.leaseExpiresAt) <= now) {
      changed = true;
      return { ...raw, status: 'queued', leaseExpiresAt: null, updatedAt: now };
    }
    if (raw.status === 'retry-later' && raw.retryAfterAt && new Date(raw.retryAfterAt) <= now) {
      changed = true;
      return { ...raw, status: 'queued', action: 'visit', retryAfterAt: null, updatedAt: now };
    }
    return raw;
  });
  return changed;
}

function enforceSessionBudgets(session) {
  const counts = hostAndRootVisitCounts(session);
  const maxPerHost = session.policy?.maxPerHost || 6;
  let changed = false;
  session.candidates = (session.candidates || []).map((candidate) => {
    const raw = candidate.toObject ? candidate.toObject() : candidate;
    if (raw.status !== 'queued' || raw.action !== 'visit') return raw;
    let host = '';
    try { host = new URL(raw.canonicalUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* ignored */ }
    const root = canonicalizeResearchUrl(raw.rootUrl || raw.canonicalUrl);
    const policy = sourcePolicy(raw.sourceKind);
    if (host && (counts.hosts[host] || 0) >= maxPerHost) {
      changed = true;
      return { ...raw, status: 'skipped', action: 'skip', reasons: [...new Set([...(raw.reasons || []), 'session-host-budget-exceeded'])], updatedAt: new Date() };
    }
    if (root && (counts.roots[root] || 0) >= policy.maxPagesPerRoot) {
      changed = true;
      return { ...raw, status: 'skipped', action: 'skip', reasons: [...new Set([...(raw.reasons || []), 'session-root-budget-exceeded'])], updatedAt: new Date() };
    }
    return raw;
  });
  return { changed, counts };
}

async function syncAdaptiveSearchMemory(session) {
  const SearchMemory = mongoose.models.ResearchSearchMemory;
  if (!SearchMemory) return;
  let memory = await SearchMemory.findOne({ jobId: session.jobId });
  if (!memory) memory = new SearchMemory({ jobId: session.jobId });

  const visitedMap = new Map((memory.visitedUrls || []).map((item) => [String(item.canonicalUrl || item.url).toLowerCase(), item.toObject ? item.toObject() : item]));
  for (const page of session.pages || []) {
    visitedMap.set(String(page.canonicalUrl).toLowerCase(), {
      url: page.canonicalUrl,
      sourceKind: page.sourceKind,
      canonicalUrl: page.canonicalUrl,
      depth: page.depth,
      evidenceAdded: page.evidenceAdded,
      status: page.status,
      visitedAt: page.visitedAt || new Date(),
    });
  }
  memory.visitedUrls = [...visitedMap.values()].slice(-1500);

  const rootGroups = new Map();
  for (const page of session.pages || []) {
    if (!['visited','extracted'].includes(page.status)) continue;
    const rootUrl = canonicalizeResearchUrl(page.rootUrl || page.canonicalUrl);
    if (!rootUrl) continue;
    const current = rootGroups.get(rootUrl) || { rootUrl, sourceKind: page.sourceKind, pagesVisited: 0, branchesVisited: 0, repliesInspected: 0, evidenceAdded: 0, maxDepth: 0 };
    current.pagesVisited += 1;
    current.branchesVisited += Number(page.discoveredLinks) || 0;
    current.evidenceAdded += Number(page.evidenceAdded) || 0;
    current.maxDepth = Math.max(current.maxDepth, Number(page.depth) || 0);
    rootGroups.set(rootUrl, current);
  }

  const deepMap = new Map((memory.deepScrapes || []).map((item) => [String(item.rootUrl), item.toObject ? item.toObject() : item]));
  for (const group of rootGroups.values()) {
    if (group.pagesVisited < 2 && group.maxDepth < 1 && group.branchesVisited < 1) continue;
    const prior = deepMap.get(group.rootUrl) || {};
    deepMap.set(group.rootUrl, {
      rootUrl: group.rootUrl,
      sourceKind: group.sourceKind || prior.sourceKind || '',
      pagesVisited: Math.max(Number(prior.pagesVisited) || 0, group.pagesVisited),
      branchesVisited: Math.max(Number(prior.branchesVisited) || 0, group.branchesVisited),
      repliesInspected: Number(prior.repliesInspected) || 0,
      evidenceAdded: Math.max(Number(prior.evidenceAdded) || 0, group.evidenceAdded),
      claimTypes: prior.claimTypes || [],
      stoppedReason: prior.stoppedReason || (session.stopped ? session.stopReason : ''),
      completedAt: new Date(),
    });
  }
  memory.deepScrapes = [...deepMap.values()].slice(-200);
  await memory.save();
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
      if (!assertCollectionWritable(job, res)) return;
      let session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) session = new ScrapeSessionModel({ jobId: String(job._id), candidates: [], pages: [], recentEvidenceYields: [] });
      const policyInput = req.body?.policy ?? req.body ?? {};
      session.policy = normalizePolicy(policyInput, session.policy || {});
      await session.save();
      return res.status(session.isNew ? 201 : 200).json({ session: summarize(session) });
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
      if (!assertCollectionWritable(job, res)) return;
      const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates.slice(0, 300) : [];
      if (!candidates.length) return res.status(400).json({ message: 'candidates[] is required' });
      let session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) session = new ScrapeSessionModel({ jobId: String(job._id), policy: normalizePolicy({}) });
      if (session.stopped) return res.status(409).json({ message: 'Scrape session is stopped. Use reopen_scrape_session explicitly before adding more candidates.', stopReason: session.stopReason });
      const ranked = mergeCandidates(session, candidates, { topic: job.topic, audience: job.audience, objective: req.body?.objective, query: req.body?.query });
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
      if (!assertCollectionWritable(job, res)) return;
      const session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) return res.status(404).json({ message: 'Scrape session not found' });
      const now = new Date();
      const reclaimed = reclaimCandidates(session, now);
      const budget = enforceSessionBudgets(session);
      if (reclaimed || budget.changed) await session.save();
      const summary = summarize(session);
      if (session.stopped || summary.stopDecision.stop) {
        if (summary.stopDecision.stop && !session.stopped) {
          session.stopped = true;
          session.stopReason = summary.stopDecision.reason;
          await session.save();
        }
        return res.json({ stopped: true, reason: session.stopReason || summary.stopDecision.reason, items: [], session: summarize(session) });
      }

      const limit = clamp(req.query.limit, 1, 30, 8);
      const visited = (session.pages || []).map((item) => item.canonicalUrl);
      const queued = (session.candidates || []).filter((item) => item.status === 'queued' && item.action === 'visit').map((item) => item.toObject ? item.toObject() : item);
      const reranked = rankScrapeFrontier(queued, {
        topic: job.topic,
        audience: job.audience,
        visitedUrls: visited,
        hostVisitCounts: budget.counts.hosts,
        rootVisitCounts: budget.counts.roots,
        maxPerHost: session.policy?.maxPerHost || 6,
        limit,
      });
      const selectedUrls = new Set(reranked.selected.slice(0, limit).map((item) => item.url));
      const leaseExpiresAt = new Date(now.getTime() + DEFAULT_LEASE_SECONDS * 1000);
      session.candidates = (session.candidates || []).map((candidate) => {
        const raw = candidate.toObject ? candidate.toObject() : candidate;
        if (!selectedUrls.has(raw.canonicalUrl)) return raw;
        return { ...raw, status: 'in-progress', attempts: (Number(raw.attempts) || 0) + 1, leaseExpiresAt, updatedAt: now };
      });
      await session.save();

      if (!reranked.selected.length) {
        const current = summarize(session);
        const waiting = current.stats.retryLaterCount > 0;
        return res.json({ stopped: false, temporarilyPaused: waiting, reason: waiting ? 'waiting-for-retry' : 'no-eligible-frontier-items', items: [], deferred: reranked.deferred.slice(0, limit), session: current });
      }
      return res.json({ stopped: false, items: reranked.selected.slice(0, limit), deferred: reranked.deferred.slice(0, limit), leaseExpiresAt, session: summarize(session) });
    } catch (error) {
      console.error('Failed to get next scrape batch:', error);
      return res.status(500).json({ message: 'Failed to get next scrape batch' });
    }
  });

  router.post('/jobs/:id/page-result', async (req, res) => {
    try {
      const job = await loadJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Research job not found' });
      if (!assertCollectionWritable(job, res)) return;
      let session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) session = new ScrapeSessionModel({ jobId: String(job._id), policy: normalizePolicy({}) });
      if (session.stopped) return res.status(409).json({ message: 'Scrape session is stopped. Reopen it explicitly before recording additional collection results.', stopReason: session.stopReason });

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
      // Only successfully accessible pages count toward marginal evidence yield. A burst
      // of 429/5xx/auth failures must not masquerade as evidence exhaustion.
      if (access.action === 'visit') session.recentEvidenceYields = [...(session.recentEvidenceYields || []), evidenceAdded].slice(-20);

      const candidates = Array.isArray(req.body?.discoveredCandidates ?? req.body?.discovered_candidates)
        ? (req.body.discoveredCandidates ?? req.body.discovered_candidates).slice(0, 250).map((item) => ({ ...item, discoveredFrom: canonicalUrl, depth: Number(item.depth ?? page.depth + 1) }))
        : [];
      if (candidates.length) mergeCandidates(session, candidates, { topic: job.topic, audience: job.audience, objective: 'follow evidence-rich branches' });

      const retrySeconds = clamp(req.body?.retryAfterSeconds ?? req.body?.retry_after_seconds, 5, 86400, DEFAULT_RETRY_SECONDS);
      session.candidates = (session.candidates || []).map((candidate) => {
        if (candidate.canonicalUrl !== canonicalUrl) return candidate;
        const raw = candidate.toObject ? candidate.toObject() : candidate;
        return {
          ...raw,
          status,
          action: access.action === 'retry-later' ? 'retry-later' : access.action === 'skip' ? 'skip' : raw.action,
          retryAfterAt: access.action === 'retry-later' ? new Date(Date.now() + retrySeconds * 1000) : null,
          leaseExpiresAt: null,
          updatedAt: new Date(),
        };
      });

      const stats = pageStats(session);
      const stop = shouldStopScrapeSession(stats, session.policy || {});
      if (stop.stop) {
        session.stopped = true;
        session.stopReason = stop.reason;
      }
      await session.save();
      await syncAdaptiveSearchMemory(session);
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
      if (!assertCollectionWritable(job, res)) return;
      const session = await ScrapeSessionModel.findOne({ jobId: String(job._id) });
      if (!session) return res.status(404).json({ message: 'Scrape session not found' });
      session.stopped = false;
      session.stopReason = '';
      if (req.body?.policy) session.policy = normalizePolicy(req.body.policy, session.policy || {});
      await session.save();
      return res.json({ session: summarize(session) });
    } catch (error) {
      console.error('Failed to reopen scrape session:', error);
      return res.status(500).json({ message: 'Failed to reopen scrape session' });
    }
  });

  return router;
}