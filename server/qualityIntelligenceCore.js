const LEGAL_SUFFIXES = new Set([
  'inc','incorporated','corp','corporation','co','company','llc','ltd','limited','plc','gmbh','ag','sa','sas','bv','nv','pty','pvt','private','holdings','holding'
]);

const STOP_WORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it','of','on','or','that','the','their','this','to','was','were','with','without','into','over','under','using','use','used','users','user','customer','customers','people','problem','problems','issue','issues'
]);

const clamp = (value, min = 0, max = 100) => Math.min(Math.max(Number(value) || 0, min), max);
const round = (value, digits = 0) => Number(Number(value || 0).toFixed(digits));

function normalizedText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value = '') {
  return normalizedText(value)
    .split(' ')
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function setOverlap(a = [], b = []) {
  const left = new Set(a.map((item) => normalizedText(item)).filter(Boolean));
  const right = new Set(b.map((item) => normalizedText(item)).filter(Boolean));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((item) => { if (right.has(item)) intersection += 1; });
  return intersection / Math.max(left.size, right.size);
}

function tokenJaccard(a = '', b = '') {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((item) => { if (right.has(item)) intersection += 1; });
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function normalizeMarketEntityKey(value = '') {
  const parts = normalizedText(value)
    .split(' ')
    .map((part) => part.replace(/^[.-]+|[.-]+$/g, ''))
    .filter(Boolean)
    .filter((part, index, values) => !(LEGAL_SUFFIXES.has(part) && index >= values.length - 2));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function chooseCanonicalEntityName(names = []) {
  const candidates = [...new Set(names.map((item) => String(item || '').trim()).filter(Boolean))];
  if (!candidates.length) return '';
  return candidates
    .sort((a, b) => {
      const aLooksRaw = /https?:|[_/]/i.test(a) ? 1 : 0;
      const bLooksRaw = /https?:|[_/]/i.test(b) ? 1 : 0;
      if (aLooksRaw !== bLooksRaw) return aLooksRaw - bLooksRaw;
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      if (aWords !== bWords) return aWords - bWords;
      return a.length - b.length;
    })[0];
}

export function clusterSimilarity(current = {}, previous = {}) {
  const currentText = [current.label, current.problemStatement, current.summary].filter(Boolean).join(' ');
  const previousText = [previous.label, previous.problemStatement, previous.summary].filter(Boolean).join(' ');
  const semantic = tokenJaccard(currentText, previousText);
  const jtbd = setOverlap(current.jobsToBeDone, previous.jobsToBeDone);
  const personas = setOverlap(current.personas, previous.personas);
  const segments = setOverlap(current.segments, previous.segments);
  const entities = setOverlap(
    [...(current.competitors || []), ...(current.entities || []).map((item) => item?.name || item)],
    [...(previous.competitors || []), ...(previous.entities || []).map((item) => item?.name || item)],
  );
  const workarounds = setOverlap(current.workarounds, previous.workarounds);
  return round(clamp((semantic * 0.55 + jtbd * 0.15 + personas * 0.08 + segments * 0.07 + entities * 0.10 + workarounds * 0.05) * 100), 1);
}

export function matchClusterLineage(currentClusters = [], previousRuns = []) {
  const matches = [];
  const used = new Set();
  for (const current of currentClusters) {
    let best = null;
    for (const previousRun of previousRuns) {
      for (const previous of previousRun.clusters || []) {
        const key = `${previousRun._id || previousRun.id}:${previous.clusterId}`;
        if (used.has(key)) continue;
        const similarity = clusterSimilarity(current, previous);
        if (!best || similarity > best.similarity) best = { previousRun, previous, similarity, key };
      }
    }
    if (!best || best.similarity < 46) {
      matches.push({
        clusterId: current.clusterId,
        label: current.label,
        status: 'new',
        similarity: best?.similarity || 0,
        previousRunId: '',
        previousClusterId: '',
        painDelta: Number(current.painScore) || 0,
        confidenceDelta: Number(current.confidence) || 0,
      });
      continue;
    }
    used.add(best.key);
    const painDelta = (Number(current.painScore) || 0) - (Number(best.previous.painScore) || 0);
    const confidenceDelta = (Number(current.confidence) || 0) - (Number(best.previous.confidence) || 0);
    let status = 'persistent';
    if (painDelta >= 8) status = 'rising';
    else if (painDelta <= -8) status = 'falling';
    matches.push({
      clusterId: current.clusterId,
      label: current.label,
      status,
      similarity: best.similarity,
      previousRunId: String(best.previousRun._id || best.previousRun.id || ''),
      previousRunName: best.previousRun.name || '',
      previousClusterId: best.previous.clusterId,
      previousLabel: best.previous.label,
      previousPainScore: Number(best.previous.painScore) || 0,
      currentPainScore: Number(current.painScore) || 0,
      painDelta: round(painDelta, 1),
      confidenceDelta: round(confidenceDelta, 1),
    });
  }
  return matches.sort((a, b) => {
    const priority = { new: 4, rising: 3, persistent: 2, falling: 1 };
    return (priority[b.status] - priority[a.status]) || (b.currentPainScore || 0) - (a.currentPainScore || 0);
  });
}

export function computeConsensusSummary(cluster = {}, assessment = {}) {
  const supporting = new Set((assessment.supportingEvidenceIds || []).map(String));
  const contradicting = new Set((assessment.contradictingEvidenceIds || []).map(String));
  const mixed = new Set((assessment.mixedEvidenceIds || []).map(String));
  const neutral = new Set((assessment.neutralEvidenceIds || []).map(String));
  const total = supporting.size + contradicting.size + mixed.size + neutral.size;
  const weightedSupport = supporting.size + mixed.size * 0.5;
  const contested = contradicting.size + mixed.size * 0.5;
  const evidenceCoverage = (cluster.evidenceIds || []).length
    ? Math.min(1, total / Math.max(1, new Set((cluster.evidenceIds || []).map(String)).size))
    : 0;
  const consensusStrength = total ? clamp((weightedSupport / Math.max(1, weightedSupport + contested)) * 100) : 0;
  const contradictionRate = total ? clamp((contradicting.size / total) * 100) : 0;
  const uncertainty = clamp(
    100 - (consensusStrength * 0.55 + evidenceCoverage * 100 * 0.30 + clamp(cluster.confidence) * 0.15),
  );
  return {
    clusterId: cluster.clusterId,
    supporting: supporting.size,
    contradicting: contradicting.size,
    mixed: mixed.size,
    neutral: neutral.size,
    classifiedEvidence: total,
    evidenceCoverage: round(evidenceCoverage, 3),
    consensusStrength: round(consensusStrength, 1),
    contradictionRate: round(contradictionRate, 1),
    uncertainty: round(uncertainty, 1),
    classificationComplete: total >= new Set((cluster.evidenceIds || []).map(String)).size && total > 0,
  };
}

export function deterministicOpportunityScore(opportunity = {}, supportingClusters = [], consensusByCluster = new Map(), sizingAssessment = null) {
  const clusterQuality = supportingClusters.length
    ? supportingClusters.reduce((sum, cluster) => sum + (clamp(cluster.evidenceQuality) * 0.55 + clamp(cluster.confidence) * 0.45), 0) / supportingClusters.length
    : 0;
  const consensusValues = supportingClusters
    .map((cluster) => consensusByCluster.get(cluster.clusterId)?.consensusStrength)
    .filter((value) => Number.isFinite(value));
  const consensus = consensusValues.length
    ? consensusValues.reduce((sum, value) => sum + value, 0) / consensusValues.length
    : clusterQuality;
  const sizingConfidence = sizingAssessment ? clamp(sizingAssessment.confidenceScore) : 50;

  const components = {
    painStrength: clamp(opportunity.painStrength),
    marketPotential: clamp(opportunity.marketPotential),
    commercialIntent: clamp(opportunity.commercialIntent),
    confidence: clamp(opportunity.confidence),
    evidenceSupport: clamp(clusterQuality),
    consensus: clamp(consensus),
    marketSizingConfidence: sizingConfidence,
    competitionAdvantage: 100 - clamp(opportunity.competitionIntensity),
    implementationFeasibility: 100 - clamp(opportunity.implementationDifficulty),
  };

  const score =
    components.painStrength * 0.21 +
    components.marketPotential * 0.16 +
    components.commercialIntent * 0.16 +
    components.confidence * 0.10 +
    components.evidenceSupport * 0.10 +
    components.consensus * 0.08 +
    components.marketSizingConfidence * 0.05 +
    components.competitionAdvantage * 0.07 +
    components.implementationFeasibility * 0.07;

  const hostScore = clamp(opportunity.opportunityScore);
  return {
    opportunityId: opportunity.opportunityId,
    title: opportunity.title,
    deterministicScore: round(clamp(score), 1),
    hostScore: round(hostScore, 1),
    scoreDelta: round(clamp(score) - hostScore, 1),
    components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value, 1)])),
    interpretation: score >= 80 ? 'very-strong' : score >= 68 ? 'strong' : score >= 55 ? 'promising' : score >= 42 ? 'weak' : 'low-confidence',
  };
}

function validRange(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!input || typeof input !== 'object') return null;
  const low = Number(input.low);
  const high = Number(input.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < min || high < low || high > max) return null;
  return { low, high };
}

function multiplyRanges(a, b) {
  if (!a || !b) return null;
  return { low: a.low * b.low, high: a.high * b.high };
}

function applyShare(range, share) {
  if (!range || !share) return null;
  return { low: range.low * (share.low / 100), high: range.high * (share.high / 100) };
}

export function calculateMarketSizingAssessment(input = {}) {
  const population = validRange(input.targetPopulation, 0, 1e12);
  const spend = validRange(input.annualSpendPerCustomer, 0, 1e12);
  const serviceable = validRange(input.serviceableSharePct, 0, 100);
  const obtainable = validRange(input.obtainableSharePct, 0, 100);
  const sources = Array.isArray(input.sources) ? input.sources.filter((source) => source?.url && source?.label).slice(0, 30) : [];
  const independentSources = new Set(sources.map((source) => {
    try { return new URL(source.url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return String(source.label).toLowerCase(); }
  })).size;
  const assumptions = Array.isArray(input.assumptions) ? input.assumptions.filter(Boolean).slice(0, 20) : [];
  const method = String(input.method || '').trim();

  const tam = multiplyRanges(population, spend);
  const sam = applyShare(tam, serviceable);
  const som = applyShare(sam, obtainable);

  const populationScore = population ? 20 : 0;
  const spendScore = spend ? 20 : 0;
  const serviceabilityScore = serviceable ? 10 : 0;
  const obtainabilityScore = obtainable ? 10 : 0;
  const sourceScore = Math.min(25, independentSources * 5);
  const methodScore = method.length >= 30 ? 10 : method ? 5 : 0;
  const assumptionScore = Math.min(5, assumptions.length);
  const confidenceScore = clamp(populationScore + spendScore + serviceabilityScore + obtainabilityScore + sourceScore + methodScore + assumptionScore);

  const caveats = [];
  if (!population) caveats.push('Target population/account count is missing or invalid.');
  if (!spend) caveats.push('Annual spend or price proxy is missing or invalid.');
  if (independentSources < 3) caveats.push('Market sizing uses fewer than three independent source domains.');
  if (!serviceable) caveats.push('SAM cannot be calculated without a sourced serviceable-share range.');
  if (!obtainable) caveats.push('SOM cannot be calculated without an explicit obtainable-share hypothesis.');
  if (!method) caveats.push('Sizing method/rationale is missing.');

  return {
    confidenceScore: round(confidenceScore, 1),
    independentSources,
    calculations: {
      tam: tam ? { low: round(tam.low, 2), high: round(tam.high, 2) } : null,
      sam: sam ? { low: round(sam.low, 2), high: round(sam.high, 2) } : null,
      som: som ? { low: round(som.low, 2), high: round(som.high, 2) } : null,
    },
    caveats,
    calculationReady: Boolean(tam),
    fullySized: Boolean(tam && sam && som),
  };
}

export function topicSimilarity(a = {}, b = {}) {
  const left = [a.topic, a.audience].filter(Boolean).join(' ');
  const right = [b.topic, b.audience].filter(Boolean).join(' ');
  return round(tokenJaccard(left, right) * 100, 1);
}
