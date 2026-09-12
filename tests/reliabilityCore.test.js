import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeResearchSignalsStrict,
  canHeartbeatJob,
  computeAnnotationProgress,
  evidenceStoryKey,
  normalizeQueryKey,
  normalizeUrl,
  summarizeStoryIndependence,
  validateOpportunityCoverage,
} from '../server/reliabilityCore.js';

test('annotation progress only counts evidence eligible for the run', () => {
  const progress = computeAnnotationProgress(['a', 'b', 'c'], ['a', 'outside']);
  assert.deepEqual(progress, {
    eligibleEvidence: 3,
    annotatedEvidence: 1,
    remainingEvidence: 2,
    annotationCoveragePct: 33,
    complete: false,
  });
  assert.equal(computeAnnotationProgress(['a'], ['a']).complete, true);
  assert.equal(computeAnnotationProgress([], []).complete, false);
});

test('heartbeat transitions cannot bypass dedicated terminal state endpoints', () => {
  assert.equal(canHeartbeatJob('claimed', 'collecting'), true);
  assert.equal(canHeartbeatJob('gap-research', 'semantic-analysis'), true);
  assert.equal(canHeartbeatJob('claimed', 'complete'), false);
  assert.equal(canHeartbeatJob('complete', 'collecting'), false);
  assert.equal(canHeartbeatJob('queued', 'claimed'), false);
});

test('reddit comments from the same root thread count as one story', () => {
  const first = { sourceKind: 'reddit', sourceUrl: 'https://www.reddit.com/r/test/comments/abc123/problem/comment-one/' };
  const second = { sourceKind: 'reddit', sourceUrl: 'https://reddit.com/r/test/comments/abc123/problem/comment-two/' };
  assert.equal(evidenceStoryKey(first), evidenceStoryKey(second));

  const summary = summarizeStoryIndependence([
    { ...first, _id: '1' },
    { ...second, _id: '2' },
    { _id: '3', sourceKind: 'review', sourceUrl: 'https://reviews.example/product/review-77' },
  ]);
  assert.equal(summary.independentStoryCount, 2);
  assert.equal(summary.largestStoryGroupSize, 2);
});

test('explicit root/thread metadata takes precedence for story grouping', () => {
  const a = { metadata: { root_url: 'https://forum.example/t/42' }, sourceUrl: 'https://forum.example/t/42/3' };
  const b = { metadata: { root_url: 'https://forum.example/t/42' }, sourceUrl: 'https://forum.example/t/42/9' };
  assert.equal(evidenceStoryKey(a), evidenceStoryKey(b));
});

test('strong commercial signals exclude generic subscription mentions', () => {
  const weak = analyzeResearchSignalsStrict([{ text: 'There is a subscription plan for this product.' }]);
  assert.equal(weak.strongCommercial, 0);

  const strong = analyzeResearchSignalsStrict([
    { text: 'We cancelled because it was too expensive and are looking for an alternative.' },
    { text: 'We pay $350 per month and still use a spreadsheet workaround.' },
  ]);
  assert.equal(strong.strongCommercial, 2);
  assert.equal(strong.workaround, 1);
  assert.ok(strong.quantifiedImpact >= 1);
});

test('negated recommendations are not counted as positive counter-evidence', () => {
  const negative = analyzeResearchSignalsStrict([
    { text: 'I do not recommend it. I am not happy with it and it is not worth the price.' },
    { text: 'It is not easy to use and support was slow.' },
  ]);
  assert.equal(negative.contradictionCandidates, 0);

  const positive = analyzeResearchSignalsStrict([{ text: 'I highly recommend it; it works fine for us and is worth the price.' }]);
  assert.equal(positive.contradictionCandidates, 1);
});

test('validation coverage requires exactly one validation per opportunity', () => {
  assert.equal(validateOpportunityCoverage(['a', 'b'], ['a', 'b']).valid, true);
  assert.deepEqual(validateOpportunityCoverage(['a', 'b'], ['a']).missing, ['b']);
  assert.equal(validateOpportunityCoverage(['a'], ['a', 'a']).duplicateCount, 1);
  assert.deepEqual(validateOpportunityCoverage([], []), { valid: true, unknown: [], missing: [], duplicateCount: 0 });
});

test('query and URL normalization remove superficial differences', () => {
  assert.equal(normalizeQueryKey('"Dental Billing" OR complaints'), normalizeQueryKey('dental billing complaints'));
  const normalized = normalizeUrl('https://WWW.Example.com/path/?utm_source=x&b=2&a=1#section');
  assert.equal(normalized, 'https://example.com/path?a=1&b=2');
});
