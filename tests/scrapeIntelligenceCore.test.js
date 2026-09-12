import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScrapeContract,
  canonicalizeResearchUrl,
  classifyAccessBoundary,
  evaluateExtractionQuality,
  rankScrapeFrontier,
  scoreScrapeCandidate,
  shouldStopScrapeSession,
} from '../server/scrapeIntelligenceCore.js';

test('canonicalizes tracking parameters and common Reddit host variants', () => {
  const value = canonicalizeResearchUrl('https://old.reddit.com/r/devops/comments/abc/test/?utm_source=x&sort=new#comment-1');
  assert.equal(value, 'https://reddit.com/r/devops/comments/abc/test?sort=new');
});

test('preserves meaningful query parameters while sorting them', () => {
  const value = canonicalizeResearchUrl('https://example.com/thread?page=2&utm_campaign=x&sort=old');
  assert.equal(value, 'https://example.com/thread?page=2&sort=old');
});

test('never recommends bypassing robots, auth or paywalls', () => {
  assert.deepEqual(classifyAccessBoundary({ robotsAllowed: false }), { action: 'skip', reason: 'robots-disallowed', retryable: false });
  assert.deepEqual(classifyAccessBoundary({ requiresLogin: true }), { action: 'skip', reason: 'authentication-required', retryable: false });
  assert.deepEqual(classifyAccessBoundary({ paywalled: true }), { action: 'skip', reason: 'paywall', retryable: false });
});

test('rate limits are retried later instead of treated as evidence failure', () => {
  const result = classifyAccessBoundary({ statusCode: 429 });
  assert.equal(result.action, 'retry-later');
  assert.equal(result.reason, 'rate-limited');
});

test('high relevance first-hand candidates outrank weak generic pages', () => {
  const strong = scoreScrapeCandidate({
    url: 'https://forum.example.com/thread/1', sourceKind: 'forum', title: 'Manual reconciliation takes hours every week',
    relevanceScore: 95, firstHandLikelihood: 92, evidenceYieldLikelihood: 90, noveltyScore: 90, commercialSignalLikelihood: 72,
  }, { topic: 'manual reconciliation', audience: 'finance teams' });
  const weak = scoreScrapeCandidate({
    url: 'https://example.com/blog', sourceKind: 'web', title: 'The complete guide', relevanceScore: 35,
    firstHandLikelihood: 10, evidenceYieldLikelihood: 20, noveltyScore: 35, duplicateRisk: 40,
  }, { topic: 'manual reconciliation', audience: 'finance teams' });
  assert.ok(strong.score > weak.score);
  assert.equal(strong.action, 'visit');
});

test('frontier canonicalization deduplicates tracking variants and respects host caps', () => {
  const result = rankScrapeFrontier([
    { url: 'https://example.com/a?utm_source=x', relevanceScore: 90, firstHandLikelihood: 90, evidenceYieldLikelihood: 90 },
    { url: 'https://example.com/a', relevanceScore: 88, firstHandLikelihood: 88, evidenceYieldLikelihood: 88 },
    { url: 'https://example.com/b', relevanceScore: 85, firstHandLikelihood: 85, evidenceYieldLikelihood: 85 },
    { url: 'https://other.example.org/c', relevanceScore: 82, firstHandLikelihood: 82, evidenceYieldLikelihood: 82 },
  ], { maxPerHost: 1, limit: 10 });
  assert.equal(result.stats.canonicalUnique, 3);
  assert.equal(result.selected.length, 2);
  assert.equal(new Set(result.selected.map((item) => item.host)).size, 2);
});

test('rich extraction provenance and context produces strong quality', () => {
  const quality = evaluateExtractionQuality({
    url: 'https://forum.example.com/thread/1', rootUrl: 'https://forum.example.com/thread/1',
    text: 'A detailed firsthand account of the workflow, failure, workaround, impact and outcome.'.repeat(8),
    author: 'operator-1', publishedAt: '2026-09-01T00:00:00Z', firstHand: true,
    parentContext: 'Original thread and parent reply context preserved', claimCount: 4, evidenceCount: 4,
    resolutionCaptured: true, contradictionCaptured: true, commercialCaptured: true,
  });
  assert.ok(quality.score >= 68);
  assert.notEqual(quality.grade, 'discard');
});

test('thin unprovenanced extraction is flagged', () => {
  const quality = evaluateExtractionQuality({ text: 'short claim', claimCount: 1 });
  assert.ok(quality.issues.includes('missing-canonical-url'));
  assert.ok(quality.issues.includes('author-unknown'));
  assert.ok(quality.score < 52);
});

test('crawl stops after sustained low marginal evidence yield', () => {
  const decision = shouldStopScrapeSession({
    pagesVisited: 20, evidenceAdded: 8, frontierCount: 20, duplicateRate: 0.1, blockedShare: 0.1,
    recentEvidenceYields: [0, 0, 0, 0, 0, 0],
  }, { maxPages: 100, evidenceTarget: 60, minMarginalYield: 0.25 });
  assert.equal(decision.stop, true);
  assert.equal(decision.reason, 'marginal-yield-collapsed');
});

test('crawl stops on duplicate saturation', () => {
  const decision = shouldStopScrapeSession({
    pagesVisited: 15, evidenceAdded: 20, frontierCount: 20, duplicateRate: 0.7, blockedShare: 0.1,
    recentEvidenceYields: [1, 1, 1, 1, 1],
  }, { maxDuplicateRate: 0.45, evidenceTarget: 60 });
  assert.equal(decision.stop, true);
  assert.equal(decision.reason, 'duplicate-saturation');
});

test('source contract tells the host to preserve provenance and respect boundaries', () => {
  const contract = buildScrapeContract({ sourceKind: 'github', url: 'https://github.com/example/repo/issues/1' });
  assert.equal(contract.sourceKind, 'github');
  assert.ok(contract.extractionContract.required.includes('canonical_url'));
  assert.match(contract.extractionContract.security, /never bypass authentication\/paywalls\/access controls/i);
});
