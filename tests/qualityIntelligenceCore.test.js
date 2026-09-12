import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMarketSizingAssessment,
  clusterSimilarity,
  computeConsensusSummary,
  deterministicOpportunityScore,
  matchClusterLineage,
  normalizeMarketEntityKey,
} from '../server/qualityIntelligenceCore.js';

test('market entity normalization collapses common legal suffix aliases', () => {
  assert.equal(normalizeMarketEntityKey('Acme, Inc.'), 'acme');
  assert.equal(normalizeMarketEntityKey('ACME Incorporated'), 'acme');
  assert.equal(normalizeMarketEntityKey('Example Private Limited'), 'example');
});

test('semantic cluster similarity rewards shared problem meaning and JTBD', () => {
  const current = {
    label: 'Delivery payout reconciliation',
    problemStatement: 'Restaurants manually reconcile marketplace payouts with order reports.',
    jobsToBeDone: ['reconcile delivery payouts with accounting'],
    personas: ['restaurant operator'],
    competitors: ['DoorDash'],
  };
  const prior = {
    label: 'Marketplace settlement reconciliation',
    problemStatement: 'Operators manually match delivery marketplace deposits to accounting records.',
    jobsToBeDone: ['reconcile delivery payouts with accounting'],
    personas: ['restaurant operator'],
    competitors: ['DoorDash'],
  };
  assert.ok(clusterSimilarity(current, prior) >= 46);
});

test('cluster lineage marks materially stronger matched pain as rising', () => {
  const current = [{
    clusterId: 'payout-reconciliation', label: 'Payout reconciliation', problemStatement: 'Manual payout reconciliation for delivery marketplaces',
    jobsToBeDone: ['reconcile payouts'], personas: ['operator'], painScore: 82, confidence: 80,
  }];
  const previousRuns = [{
    _id: 'previous', name: 'Older run', clusters: [{
      clusterId: 'delivery-settlement', label: 'Payout reconciliation', problemStatement: 'Manual payout reconciliation for delivery marketplaces',
      jobsToBeDone: ['reconcile payouts'], personas: ['operator'], painScore: 65, confidence: 72,
    }],
  }];
  const [match] = matchClusterLineage(current, previousRuns);
  assert.equal(match.status, 'rising');
  assert.equal(match.previousClusterId, 'delivery-settlement');
  assert.equal(match.painDelta, 17);
});

test('consensus summary distinguishes support from contradiction', () => {
  const cluster = { clusterId: 'pain', confidence: 80, evidenceIds: ['a', 'b', 'c', 'd'] };
  const summary = computeConsensusSummary(cluster, {
    supportingEvidenceIds: ['a', 'b'],
    contradictingEvidenceIds: ['c'],
    mixedEvidenceIds: ['d'],
  });
  assert.equal(summary.classifiedEvidence, 4);
  assert.equal(summary.classificationComplete, true);
  assert.ok(summary.consensusStrength > 50 && summary.consensusStrength < 100);
  assert.equal(summary.contradictionRate, 25);
});

test('deterministic opportunity score penalizes competition and implementation difficulty', () => {
  const base = {
    opportunityId: 'op', title: 'Opportunity', painStrength: 85, marketPotential: 80, commercialIntent: 80,
    confidence: 80, opportunityScore: 90, competitionIntensity: 20, implementationDifficulty: 20,
  };
  const cluster = { clusterId: 'c1', evidenceQuality: 80, confidence: 80 };
  const consensus = new Map([['c1', { consensusStrength: 80 }]]);
  const strong = deterministicOpportunityScore({ ...base, clusterIds: ['c1'] }, [cluster], consensus, { confidenceScore: 80 });
  const weak = deterministicOpportunityScore({ ...base, competitionIntensity: 95, implementationDifficulty: 95, clusterIds: ['c1'] }, [cluster], consensus, { confidenceScore: 80 });
  assert.ok(strong.deterministicScore > weak.deterministicScore);
  assert.ok(strong.deterministicScore < 100);
});

test('market sizing computes ranges only from supplied scenario inputs', () => {
  const result = calculateMarketSizingAssessment({
    targetPopulation: { low: 1000, high: 2000 },
    annualSpendPerCustomer: { low: 1200, high: 2400 },
    serviceableSharePct: { low: 40, high: 60 },
    obtainableSharePct: { low: 2, high: 5 },
    method: 'Bottom-up account count multiplied by sourced annual spend proxies, then bounded serviceable and obtainable shares.',
    assumptions: ['Account count reflects target geography.'],
    sources: [
      { url: 'https://one.example/report', label: 'Population source' },
      { url: 'https://two.example/pricing', label: 'Pricing source' },
      { url: 'https://three.example/benchmark', label: 'Benchmark source' },
    ],
  });
  assert.deepEqual(result.calculations.tam, { low: 1200000, high: 4800000 });
  assert.deepEqual(result.calculations.sam, { low: 480000, high: 2880000 });
  assert.deepEqual(result.calculations.som, { low: 9600, high: 144000 });
  assert.equal(result.fullySized, true);
  assert.ok(result.confidenceScore >= 80);
});

test('market sizing refuses to fabricate TAM without population and spend', () => {
  const result = calculateMarketSizingAssessment({ sources: [], method: '' });
  assert.equal(result.calculations.tam, null);
  assert.equal(result.fullySized, false);
  assert.ok(result.caveats.length >= 3);
});
