const TRACKING_QUERY_KEYS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'ref_src',
]);

const JOB_STAGE_ORDER = new Map([
  ['claimed', 0],
  ['collecting', 1],
  ['gap-research', 2],
  ['semantic-analysis', 3],
  ['opportunity-validation', 4],
]);

const STRONG_COMMERCIAL_PATTERNS = [
  /\bwilling to pay\b/i,
  /\bwould pay\b/i,
  /\bbudget(?:ed)? for\b/i,
  /\blooking for (?:an )?alternative\b/i,
  /\bswitch(?:ed|ing)? (?:from|to)\b/i,
  /\bcancel(?:led|ing)? (?:because|due to|after|my|our|the)\b/i,
  /\b(?:requested|asked for|got) (?:a )?refund\b/i,
  /\btoo expensive\b/i,
  /\bpaying\b.{0,80}\bper (?:month|year)\b/i,
  /\b(?:paid|pay) [$£€]?\s?\d+/i,
  /\bquote(?:d)? [$£€]\s?\d+/i,
  /\bhired (?:someone|a person|an agency|a contractor)\b/i,
  /\bbuilt (?:our|a|an) (?:own|internal|custom)\b/i,
];

const WORKAROUND_PATTERNS = [
  /\bspreadsheet\b/i, /\bexcel\b/i, /\bgoogle sheets\b/i, /\bcopy.?paste\b/i,
  /\bmanual(?:ly)?\b/i, /\bhomegrown\b/i, /\bcustom script\b/i, /\binternal tool\b/i,
  /\bemail chain\b/i, /\bwhatsapp\b/i, /\bmultiple (?:tools|apps|systems)\b/i,
  /\bworkaround\b/i, /\bhack(?:y)?\b/i,
];

const POSITIVE_COUNTER_PATTERNS = [
  /\bworks (?:fine|well) for (?:me|us)\b/i,
  /\b(?:have|had) no issues\b/i,
  /\beasy to (?:use|set up|setup)\b/i,
  /\bnever had (?:a )?problem\b/i,
  /\bnot a problem for (?:me|us)\b/i,
  /\bhappy with\b/i,
  /\b(?:i|we|would|highly) recommend\b/i,
  /\brecommend(?:ed)? (?:it|this|them)\b/i,
  /\bworth the (?:price|cost)\b/i,
  /\bsupport (?:was|is) (?:great|helpful|responsive)\b/i,
];

export function normalizeUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    const query = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
      const keyCompare = aKey.localeCompare(bKey);
      return keyCompare || aValue.localeCompare(bValue);
    });
    url.search = '';
    query.forEach(([key, val]) => url.searchParams.append(key, val));
    return url.toString();
  } catch {
    return raw.slice(0, 1400);
  }
}

export function normalizeQueryKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/["'`()\[\]{}]/g, ' ')
    .replace(/\b(?:or|and)\b/g, ' ')
    .replace(/[^a-z0-9$£€%+.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeAnnotationProgress(candidateIds = [], annotationIds = []) {
  const eligible = new Set(candidateIds.map(String));
  const covered = new Set(annotationIds.map(String).filter((id) => eligible.has(id)));
  const eligibleEvidence = eligible.size;
  const annotatedEvidence = covered.size;
  const remainingEvidence = Math.max(0, eligibleEvidence - annotatedEvidence);
  return {
    eligibleEvidence,
    annotatedEvidence,
    remainingEvidence,
    annotationCoveragePct: eligibleEvidence ? Math.round((annotatedEvidence / eligibleEvidence) * 100) : 0,
    complete: eligibleEvidence > 0 && remainingEvidence === 0,
  };
}

export function canHeartbeatJob(currentStatus, requestedStatus) {
  const currentStage = JOB_STAGE_ORDER.get(currentStatus);
  if (currentStage === undefined) return false;
  if (!requestedStatus) return true;
  const requestedStage = JOB_STAGE_ORDER.get(requestedStatus);
  if (requestedStage === undefined) return false;
  return requestedStage >= currentStage;
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function evidenceText(item) {
  return compactText([item?.title, item?.text].filter(Boolean).join(' '));
}

function hostname(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function redditThreadUrl(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const commentsIndex = parts.indexOf('comments');
    if (commentsIndex >= 0 && parts[commentsIndex + 1]) {
      url.pathname = `/${parts.slice(0, commentsIndex + 2).join('/')}`;
      url.search = '';
      url.hash = '';
      return normalizeUrl(url.toString());
    }
  } catch {
    // Fall through to the generic URL key.
  }
  return '';
}

export function evidenceStoryKey(item = {}) {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
  const explicit = metadata.root_url ?? metadata.rootUrl ?? metadata.thread_id ?? metadata.threadId ?? metadata.conversation_id ?? metadata.conversationId;
  if (explicit) return `explicit:${compactText(explicit).toLowerCase()}`;

  const sourceKind = String(item.sourceKind || '').toLowerCase();
  const rawUrl = item.sourceUrl || item.url || '';
  if (sourceKind === 'reddit') {
    const redditRoot = redditThreadUrl(rawUrl);
    if (redditRoot) return `url:${redditRoot}`;
  }
  const canonical = normalizeUrl(rawUrl);
  if (canonical) return `url:${canonical}`;

  const source = String(item.sourceName || sourceKind || 'unknown').toLowerCase();
  const community = String(item.community || '').toLowerCase();
  const external = String(item.externalId || '').toLowerCase();
  const author = String(item.author || '').toLowerCase();
  return `fallback:${source}|${community}|${external || author || compactText(item.title).toLowerCase().slice(0, 120)}`;
}

export function evidenceIdentityKey(item = {}) {
  const source = String(item.sourceName || item.sourceKind || 'unknown').toLowerCase();
  const community = String(item.community || '').toLowerCase();
  const author = String(item.author || '').toLowerCase();
  const domain = hostname(item.sourceUrl || item.url || '');
  return [source, domain, community, author || 'anonymous'].join('|');
}

function positiveCounterText(text) {
  return text
    .replace(/\b(?:do not|don't|would not|wouldn't|cannot|can't|not)\s+(?:really\s+|still\s+)?recommend(?:ed)?\b/gi, ' ')
    .replace(/\bnot\s+(?:really\s+)?happy with\b/gi, ' ')
    .replace(/\bnot\s+worth the (?:price|cost)\b/gi, ' ')
    .replace(/\bnot\s+easy to (?:use|set up|setup)\b/gi, ' ');
}

export function analyzeResearchSignalsStrict(items = []) {
  let strongCommercial = 0;
  let workaround = 0;
  let contradictionCandidates = 0;
  let quantifiedImpact = 0;
  for (const item of items) {
    const text = evidenceText(item);
    if (STRONG_COMMERCIAL_PATTERNS.some((pattern) => pattern.test(text))) strongCommercial += 1;
    if (WORKAROUND_PATTERNS.some((pattern) => pattern.test(text))) workaround += 1;
    const counterText = positiveCounterText(text);
    if (POSITIVE_COUNTER_PATTERNS.some((pattern) => pattern.test(counterText))) contradictionCandidates += 1;
    if (/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|days?|weeks?|months?|%|percent|dollars?|usd|gbp|eur)\b|[$£€]\s?\d+/i.test(text)) quantifiedImpact += 1;
  }
  return { strongCommercial, workaround, contradictionCandidates, quantifiedImpact };
}

export function summarizeStoryIndependence(items = [], duplicateIds = new Set()) {
  const stories = new Map();
  items.forEach((item, index) => {
    const id = String(item?._id || item?.id || index);
    if (duplicateIds.has(id)) return;
    const key = evidenceStoryKey(item);
    stories.set(key, (stories.get(key) || 0) + 1);
  });
  const groupSizes = [...stories.values()];
  const largest = groupSizes.length ? Math.max(...groupSizes) : 0;
  const total = Math.max(1, items.length - duplicateIds.size);
  return {
    independentStoryCount: stories.size,
    storyGroupCount: stories.size,
    largestStoryGroupSize: largest,
    largestStoryGroupShare: Number((largest / total).toFixed(3)),
  };
}

export function validateOpportunityCoverage(expectedIds = [], submittedIds = []) {
  const expectedList = expectedIds.map(String);
  const expected = new Set(expectedList);
  const submitted = submittedIds.map(String);
  const uniqueSubmitted = new Set(submitted);
  const unknown = [...uniqueSubmitted].filter((id) => !expected.has(id));
  const missing = [...expected].filter((id) => !uniqueSubmitted.has(id));
  const duplicateExpectedCount = expectedList.length - expected.size;
  return {
    valid: duplicateExpectedCount === 0 && unknown.length === 0 && missing.length === 0 && uniqueSubmitted.size === submitted.length,
    unknown,
    missing,
    duplicateCount: submitted.length - uniqueSubmitted.size,
    duplicateExpectedCount,
  };
}