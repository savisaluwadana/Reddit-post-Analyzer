import type {
  PainCategory,
  PainCategoryBreakdown,
  PainCluster,
  PainEvidence,
  PainScanResult,
  RedditComment,
  RedditPost,
} from '../types';
import { calculatePostIntelligence } from './analytics';

const STOP_WORDS = new Set([
  'about','after','again','also','and','are','because','been','before','being','between','but','can','could','did','does','doing','for','from','had','has','have','having','here','how','into','just','more','most','not','now','only','other','our','out','over','same','should','some','such','than','that','the','their','them','then','there','these','they','this','those','through','too','under','until','very','was','were','what','when','where','which','while','who','why','will','with','would','you','your','reddit','http','https','www','com','really','thing','things','using','use','used','like','get','getting','got','make','made','want','trying','try','anyone','someone','something','much','many','still','even','way','work','working'
]);

const CATEGORY_RULES: Record<PainCategory, { label: string; terms: string[] }> = {
  'manual-work': { label: 'Manual work & repetitive operations', terms: ['manual','manually','copy paste','copy/paste','spreadsheet','excel','google sheets','repetitive','tedious','automate','automation','by hand'] },
  integration: { label: 'Integration & interoperability', terms: ['integration','integrate','integrating','webhook','api','connector','plugin','sync','incompatible','compatibility','interoperability'] },
  reliability: { label: 'Reliability & failures', terms: ['flaky','unreliable','downtime','outage','fails','failed','failure','broken','crash','incident','unstable','keeps breaking'] },
  performance: { label: 'Performance & latency', terms: ['slow','latency','performance','timeout','timeouts','takes forever','too long','lag','bottleneck'] },
  cost: { label: 'Cost & pricing', terms: ['expensive','costly','pricing','price','bill','billing','overpriced','cost','budget','too much money','spend'] },
  usability: { label: 'Usability & complexity', terms: ['confusing','hard to use','difficult to use','clunky','complicated','complex','poor ux','bad ux','annoying','frustrating'] },
  visibility: { label: 'Visibility, debugging & observability', terms: ['observability','debug','debugging','visibility','logs','logging','metrics','traces','tracing','monitoring','hard to see','hard to know'] },
  'security-compliance': { label: 'Security, permissions & compliance', terms: ['security','compliance','rbac','permission','permissions','secret','secrets','policy','policies','audit','access control','vulnerability'] },
  'setup-onboarding': { label: 'Setup, onboarding & configuration', terms: ['setup','set up','install','installation','configure','configuration','onboarding','documentation','docs','getting started','learning curve'] },
  'workflow-process': { label: 'Workflow & process friction', terms: ['workflow','approval','approvals','handoff','process','release','deployment','deploy','promotion','coordination','ticket','tickets','waiting on'] },
  'missing-capability': { label: 'Missing capability', terms: ['missing feature','does not support','doesn\'t support','wish it had','wish there was','need a feature','lacks','lack of','cannot do','can\'t do','no way to'] },
  support: { label: 'Support & troubleshooting', terms: ['support','customer service','ticket','help desk','no response','response time','troubleshooting','help me','stuck'] },
  'data-migration': { label: 'Data, migration & portability', terms: ['migration','migrate','import','export','data loss','duplicate','duplicates','inconsistent data','move data','portability','lock-in','lock in'] },
};

const SEVERITY_TERMS = ['nightmare','impossible','terrible','awful','hate','painful','frustrating','frustrated','struggling','stuck','blocked','broken','unusable','waste','wasting','hours','days','every day','constantly','keeps','cannot','can\'t','doesn\'t work','does not work'];
const COMMERCIAL_TERMS = ['pay for','paid','budget','pricing','price','worth it','buy','purchase','subscription','vendor','alternative','alternatives','replace','switch','migrate away','looking for a tool','looking for software','recommend a tool'];
const URGENCY_TERMS = ['urgent','asap','immediately','today','deadline','production','prod','blocked','blocker','cannot ship','can\'t ship','losing customers','losing money','incident','outage'];
const WORKAROUND_TERMS = ['workaround','manual','manually','spreadsheet','excel','google sheets','script','cron','copy paste','copy/paste','hack','custom script','homegrown','built our own','building our own','doing it by hand'];
const PAIN_CONTEXT_TERMS = ['problem','issue','pain','painful','frustrating','frustrated','hate','broken','fails','failed','difficult','hard','slow','manual','annoying','struggling','expensive','costly','waste','blocked','bug','missing','cannot','can\'t','doesn\'t work','need help','wish','need a better','looking for'];

const PERSONA_RULES: Array<{ persona: string; terms: string[] }> = [
  { persona: 'Platform engineer', terms: ['platform engineer','platform team','internal developer platform','idp'] },
  { persona: 'DevOps engineer', terms: ['devops','dev ops','ci/cd','cicd'] },
  { persona: 'SRE / reliability engineer', terms: ['sre','site reliability','on-call','on call'] },
  { persona: 'Software developer', terms: ['developer','developers','engineer','coding','codebase','frontend','backend'] },
  { persona: 'Security engineer', terms: ['security engineer','security team','appsec','devsecops'] },
  { persona: 'Data engineer', terms: ['data engineer','data pipeline','etl','warehouse'] },
  { persona: 'Product manager', terms: ['product manager','pm ','product team','roadmap'] },
  { persona: 'Founder / operator', terms: ['founder','startup','small business','business owner','our company'] },
  { persona: 'Marketing / growth', terms: ['marketing','marketer','growth team','seo','content team'] },
  { persona: 'IT / operations', terms: ['it team','sysadmin','system administrator','operations team','ops team'] },
];

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const countMatches = (text: string, terms: string[]) => terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9+#.-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && token.length <= 28 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function extractKeywords(text: string, limit = 8) {
  const counts = new Map<string, number>();
  tokenize(text).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([token]) => token);
}

function detectPersonas(text: string) {
  const matches = PERSONA_RULES.filter((rule) => rule.terms.some((term) => text.includes(term))).map((rule) => rule.persona);
  return matches.length > 0 ? matches.slice(0, 3) : ['Practitioner / end user'];
}

function scoreDimension(text: string, terms: string[], multiplier: number) {
  return clamp(countMatches(text, terms) * multiplier);
}

function evidenceFromText(
  sourceType: 'post' | 'comment',
  postId: string,
  subreddit: string,
  author: string,
  rawText: string,
  permalink: string | undefined,
  score: number,
): PainEvidence[] {
  const text = rawText.toLowerCase();
  const severityMatches = countMatches(text, PAIN_CONTEXT_TERMS) + countMatches(text, SEVERITY_TERMS);
  const commercialIntent = scoreDimension(text, COMMERCIAL_TERMS, 22);
  const urgency = scoreDimension(text, URGENCY_TERMS, 24);
  const workaroundBurden = scoreDimension(text, WORKAROUND_TERMS, 22);
  const severity = clamp(severityMatches * 12 + Math.min(Math.log1p(Math.max(score, 0)) * 3, 12));

  if (severityMatches === 0 && commercialIntent === 0 && urgency === 0 && workaroundBurden === 0) return [];

  const categories = (Object.entries(CATEGORY_RULES) as Array<[PainCategory, { label: string; terms: string[] }]>)
    .map(([category, rule]) => ({ category, matches: countMatches(text, rule.terms) }))
    .filter((item) => item.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 2);

  if (categories.length === 0) categories.push({ category: 'usability', matches: 1 });

  const personas = detectPersonas(text);
  const keywords = extractKeywords(rawText);
  const cleanText = rawText.replace(/\s+/g, ' ').trim().slice(0, 420);

  return categories.map(({ category }) => ({
    sourceType, postId, subreddit, author, text: cleanText, permalink, score, category,
    severity, commercialIntent, urgency, workaroundBurden, personas, keywords,
  }));
}

function sourceKey(evidence: PainEvidence) {
  return `${evidence.sourceType}:${evidence.postId}:${evidence.author}:${evidence.text.slice(0, 96)}`;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function commercialPeak(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(clamp(Math.max(...values) * 0.65 + average(values) * 0.35));
}

function createReason(cluster: Omit<PainCluster, 'opportunityReason'>) {
  const reasons: string[] = [];
  if (cluster.recurrence >= 60) reasons.push('repeats across multiple conversations');
  if (cluster.commercialIntent >= 45) reasons.push('people show switching or spending intent');
  if (cluster.workaroundBurden >= 40) reasons.push('users rely on manual or custom workarounds');
  if (cluster.urgency >= 45) reasons.push('the pain is blocking or time-sensitive');
  if (cluster.severity >= 60) reasons.push('language indicates strong frustration or failure');
  if (reasons.length === 0) reasons.push('multiple evidence signals make this worth manual validation');
  return reasons.join('; ');
}

function buildClusters(evidence: PainEvidence[]) {
  const categoryGroups = new Map<PainCategory, PainEvidence[]>();
  evidence.forEach((item) => categoryGroups.set(item.category, [...(categoryGroups.get(item.category) ?? []), item]));
  const clusters: PainCluster[] = [];

  categoryGroups.forEach((items, category) => {
    const documentFrequency = new Map<string, number>();
    items.forEach((item) => new Set(item.keywords).forEach((keyword) => documentFrequency.set(keyword, (documentFrequency.get(keyword) ?? 0) + 1)));
    const recurringKeywords = [...documentFrequency.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([keyword]) => keyword);
    const buckets = new Map<string, PainEvidence[]>();
    items.forEach((item) => {
      const primary = recurringKeywords.find((keyword) => item.keywords.includes(keyword)) ?? 'general';
      buckets.set(primary, [...(buckets.get(primary) ?? []), item]);
    });

    buckets.forEach((bucket, primary) => {
      const uniqueSources = new Map<string, PainEvidence>();
      bucket.forEach((item) => uniqueSources.set(sourceKey(item), item));
      const unique = [...uniqueSources.values()];
      const distinctPosts = new Set(unique.map((item) => item.postId)).size;
      const distinctSubreddits = new Set(unique.map((item) => item.subreddit)).size;
      const recurrence = Math.round(clamp(distinctPosts * 18 + unique.length * 5 + distinctSubreddits * 8));
      const severity = Math.round(average(unique.map((item) => item.severity)));
      const commercialIntent = commercialPeak(unique.map((item) => item.commercialIntent));
      const urgency = commercialPeak(unique.map((item) => item.urgency));
      const workaroundBurden = commercialPeak(unique.map((item) => item.workaroundBurden));
      const commentEvidence = unique.filter((item) => item.sourceType === 'comment').length;
      const confidence = Math.round(clamp(unique.length * 7 + distinctPosts * 10 + distinctSubreddits * 12 + Math.min(commentEvidence * 2, 20)));
      const painScore = Math.round(clamp(severity * 0.3 + recurrence * 0.26 + commercialIntent * 0.18 + urgency * 0.14 + workaroundBurden * 0.12));

      const personaCounts = new Map<string, number>();
      const keywordCounts = new Map<string, number>();
      unique.forEach((item) => {
        item.personas.forEach((persona) => personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1));
        item.keywords.forEach((keyword) => keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1));
      });

      const personas = [...personaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([persona]) => persona);
      const keywords = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([keyword]) => keyword);
      const categoryLabel = CATEGORY_RULES[category].label;
      const label = primary === 'general' ? categoryLabel : `${categoryLabel}: ${primary}`;
      const rankedEvidence = [...unique]
        .sort((a, b) => (b.severity + b.commercialIntent + b.urgency + b.workaroundBurden + Math.log1p(Math.max(b.score, 0)) * 4) - (a.severity + a.commercialIntent + a.urgency + a.workaroundBurden + Math.log1p(Math.max(a.score, 0)) * 4))
        .slice(0, 6);

      const partial: Omit<PainCluster, 'opportunityReason'> = {
        id: `${category}:${primary}`, category, label, painScore, severity, recurrence, commercialIntent,
        urgency, workaroundBurden, confidence, evidenceCount: unique.length, distinctPosts, distinctSubreddits,
        personas, keywords, evidence: rankedEvidence,
      };
      clusters.push({ ...partial, opportunityReason: createReason(partial) });
    });
  });

  return clusters.filter((cluster) => cluster.evidenceCount >= 1).sort((a, b) => (b.painScore + b.confidence * 0.15) - (a.painScore + a.confidence * 0.15));
}

export function buildPainScan(posts: RedditPost[], comments: RedditComment[] = [], errors: string[] = []): PainScanResult {
  const evidence: PainEvidence[] = [];
  posts.forEach((post) => {
    const text = `${post.title}\n${post.selftext ?? ''}`;
    evidence.push(...evidenceFromText('post', post.id, post.subreddit, post.author, text, `https://reddit.com${post.permalink}`, post.score));
  });
  comments.forEach((comment) => {
    evidence.push(...evidenceFromText('comment', comment.postId, comment.subreddit, comment.author, comment.body, comment.permalink ? `https://reddit.com${comment.permalink}` : undefined, comment.score));
  });

  const uniqueSourceEvidence = new Map<string, PainEvidence>();
  evidence.forEach((item) => uniqueSourceEvidence.set(sourceKey(item), item));
  const uniqueSources = [...uniqueSourceEvidence.values()];
  const clusters = buildClusters(evidence);
  const categoryMap = new Map<PainCategory, PainCluster[]>();
  clusters.forEach((cluster) => categoryMap.set(cluster.category, [...(categoryMap.get(cluster.category) ?? []), cluster]));
  const categories: PainCategoryBreakdown[] = [...categoryMap.entries()]
    .map(([category, categoryClusters]) => ({
      category,
      evidenceCount: categoryClusters.reduce((sum, cluster) => sum + cluster.evidenceCount, 0),
      painScore: Math.round(average(categoryClusters.map((cluster) => cluster.painScore))),
    }))
    .sort((a, b) => b.painScore - a.painScore);

  const personaCounts = new Map<string, number>();
  uniqueSources.forEach((item) => item.personas.forEach((persona) => personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1)));

  return {
    generatedAt: new Date().toISOString(),
    postsScanned: posts.length,
    commentsScanned: comments.length,
    painPosts: new Set(uniqueSources.filter((item) => item.sourceType === 'post').map((item) => item.postId)).size,
    painComments: uniqueSources.filter((item) => item.sourceType === 'comment').length,
    highIntentEvidence: uniqueSources.filter((item) => item.commercialIntent >= 35).length,
    workaroundEvidence: uniqueSources.filter((item) => item.workaroundBurden >= 35).length,
    clusters,
    categories,
    topPersonas: [...personaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([persona, mentions]) => ({ persona, mentions })),
    errors,
  };
}

export function rankPostsForPainScan(posts: RedditPost[]) {
  return [...posts].sort((a, b) => {
    const aIntel = calculatePostIntelligence(a);
    const bIntel = calculatePostIntelligence(b);
    const aRank = aIntel.painScore * 4 + aIntel.buyingIntentScore * 3 + Math.log1p(a.num_comments ?? 0) * 10 + aIntel.opportunityScore;
    const bRank = bIntel.painScore * 4 + bIntel.buyingIntentScore * 3 + Math.log1p(b.num_comments ?? 0) * 10 + bIntel.opportunityScore;
    return bRank - aRank;
  });
}
