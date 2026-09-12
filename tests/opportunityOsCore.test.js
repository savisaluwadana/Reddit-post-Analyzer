import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExperimentTemplate,
  calculateExperimentSignal,
  calculateOpportunityDecision,
  calculateOpportunityWorkspaceDecision,
  calculateValidationSummary,
  canEnterOpportunityStage,
  normalizeExperimentType,
} from '../server/opportunityOsCore.js';

test('normalizes supported experiment types and falls back safely', () => {
  assert.equal(normalizeExperimentType('PAID-PILOT'), 'paid-pilot');
  assert.equal(normalizeExperimentType('made-up-type'), 'other');
});

test('a presale experiment is not a paid signal without an actual commitment', () => {
  const signal = calculateExperimentSignal({
    type: 'presale',
    status: 'complete',
    verdict: 'supports',
    result: { sampleSize: 10, responses: 5, positiveResponses: 4, paidCommitments: 0, revenue: 0 },
  });
  assert.equal(signal.counted, true);
  assert.equal(signal.paidSignal, false);
});

test('a supports label with no observed data is capped', () => {
  const signal = calculateExperimentSignal({ type: 'interview', status: 'complete', verdict: 'supports', result: {} });
  assert.ok(signal.score <= 45);
  assert.equal(signal.paidSignal, false);
});

test('failed experiments are not counted as market validation', () => {
  const signal = calculateExperimentSignal({
    type: 'paid-pilot', status: 'failed', verdict: 'supports',
    result: { sampleSize: 10, responses: 10, positiveResponses: 10, paidCommitments: 2, revenue: 1000 },
  });
  assert.equal(signal.counted, false);
  assert.equal(signal.paidSignal, false);
  const summary = calculateValidationSummary([{ experimentId: 'failed', type: 'paid-pilot', status: 'failed', verdict: 'supports', result: { paidCommitments: 2, revenue: 1000 } }]);
  assert.equal(summary.completedExperiments, 0);
  assert.equal(summary.paidSignals, 0);
});

test('actual money or paid commitments create a commercial signal', () => {
  const signal = calculateExperimentSignal({
    type: 'paid-pilot',
    status: 'complete',
    verdict: 'supports',
    result: { sampleSize: 3, responses: 3, positiveResponses: 2, paidCommitments: 1, revenue: 500 },
  });
  assert.equal(signal.paidSignal, true);
  assert.ok(signal.score > 70);
});

test('high research alone never produces a build recommendation', () => {
  const decision = calculateOpportunityDecision({
    researchScore: 96,
    founderFit: { skillFit: 95, distributionFit: 90, capitalFit: 90, timeToMarketFit: 90, operatingFit: 90 },
    experiments: [],
  });
  assert.equal(decision.recommendation, 'validate');
  assert.equal(decision.validation.completedExperiments, 0);
});

test('prior reject verdict stays stopped until fresh real-world validation exists', () => {
  const decision = calculateOpportunityDecision({
    researchScore: 95,
    marketValidationVerdict: 'reject',
    founderFit: { skillFit: 95, distributionFit: 95, capitalFit: 95, timeToMarketFit: 95, operatingFit: 95 },
    experiments: [],
  });
  assert.equal(decision.recommendation, 'stop');
  assert.ok(decision.decisionScore <= 45);
});

test('workspace decision helper preserves prior market-validation verdict', () => {
  const decision = calculateOpportunityWorkspaceDecision({
    researchScore: 95,
    marketValidationVerdict: 'reject',
    founderFit: { skillFit: 95, distributionFit: 95, capitalFit: 95, timeToMarketFit: 95, operatingFit: 95 },
    experiments: [],
  });
  assert.equal(decision.priorMarketValidationVerdict, 'reject');
  assert.equal(decision.recommendation, 'stop');
});

test('two strong experiments without paid proof still do not produce build', () => {
  const experiments = [
    {
      experimentId: 'interviews', type: 'interview', status: 'complete', verdict: 'supports',
      result: { sampleSize: 10, responses: 10, positiveResponses: 8, conversionRate: 80 },
    },
    {
      experimentId: 'prototype', type: 'prototype', status: 'complete', verdict: 'supports',
      result: { sampleSize: 8, responses: 8, positiveResponses: 7, conversionRate: 87 },
    },
  ];
  const decision = calculateOpportunityDecision({ researchScore: 95, founderFit: { skillFit: 90, distributionFit: 90, capitalFit: 90, timeToMarketFit: 90, operatingFit: 90 }, experiments });
  assert.notEqual(decision.recommendation, 'build');
  assert.equal(decision.validation.paidSignals, 0);
});

test('strong validation plus real paid proof can unlock build', () => {
  const experiments = [
    {
      experimentId: 'interviews', type: 'interview', status: 'complete', verdict: 'supports',
      result: { sampleSize: 12, responses: 12, positiveResponses: 10, conversionRate: 83 },
    },
    {
      experimentId: 'pilot', type: 'paid-pilot', status: 'complete', verdict: 'supports',
      result: { sampleSize: 4, responses: 4, positiveResponses: 3, paidCommitments: 2, revenue: 1500, conversionRate: 75 },
    },
  ];
  const decision = calculateOpportunityDecision({ researchScore: 94, founderFit: { skillFit: 90, distributionFit: 88, capitalFit: 90, timeToMarketFit: 88, operatingFit: 90 }, experiments });
  assert.equal(decision.recommendation, 'build');
  assert.ok(decision.decisionScore >= 78);
  assert.equal(decision.validation.paidSignals, 1);
  assert.equal(canEnterOpportunityStage('specification', decision).allowed, true);
  assert.equal(canEnterOpportunityStage('building', decision).allowed, true);
});

test('build and specification stages are locked until the decision is build', () => {
  const decision = calculateOpportunityDecision({ researchScore: 90, founderFit: { skillFit: 90 }, experiments: [] });
  assert.equal(decision.recommendation, 'validate');
  assert.deepEqual(canEnterOpportunityStage('building', decision), { allowed: false, reason: 'build-gate-not-passed' });
  assert.deepEqual(canEnterOpportunityStage('specification', decision), { allowed: false, reason: 'build-gate-not-passed' });
});

test('gtm stage requires at least one usable completed experiment', () => {
  const decision = calculateOpportunityDecision({ researchScore: 90, founderFit: { skillFit: 90 }, experiments: [] });
  assert.deepEqual(canEnterOpportunityStage('gtm', decision), { allowed: false, reason: 'real-world-validation-required' });
});

test('repeated refutation caps validation enthusiasm', () => {
  const experiments = [
    { experimentId: 'a', type: 'interview', status: 'complete', verdict: 'refutes', result: { sampleSize: 10, responses: 10, positiveResponses: 1 } },
    { experimentId: 'b', type: 'outbound', status: 'complete', verdict: 'refutes', result: { sampleSize: 100, responses: 4, positiveResponses: 0 } },
  ];
  const summary = calculateValidationSummary(experiments);
  assert.ok(summary.score <= 44);
  assert.equal(summary.refutingExperiments, 2);
  const decision = calculateOpportunityDecision({ researchScore: 45, founderFit: { skillFit: 40 }, experiments });
  assert.notEqual(decision.recommendation, 'build');
  assert.ok(decision.decisionScore <= 48);
});

test('experiment templates preserve the target persona and commercial intent', () => {
  const interview = buildExperimentTemplate('interview', { targetPersona: 'clinic managers' });
  const presale = buildExperimentTemplate('presale', { title: 'Clinic automation' });
  assert.match(interview.title, /clinic managers/i);
  assert.match(presale.hypothesis, /commit money/i);
});
