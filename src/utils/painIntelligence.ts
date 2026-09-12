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
  'manual-work': { label: 'Manual work & repetitive tasks', terms: ['manual','manually','copy paste','copy/paste','spreadsheet','excel','google sheets','paperwork','data entry','repetitive','tedious','by hand','double entry','rekey'] },
  integration: { label: 'Integration & interoperability', terms: ['integration','integrate','sync','connector','plugin','api','webhook','incompatible','compatibility','does not connect','doesn\'t connect','import export'] },
  reliability: { label: 'Reliability & failures', terms: ['unreliable','broken','fails','failed','failure','crash','outage','unstable','keeps breaking','does not work','doesn\'t work','error','errors'] },
  performance: { label: 'Speed, delay & performance', terms: ['slow','latency','timeout','takes forever','too long','lag','delay','delayed','waiting','long wait','queue','response time'] },
  cost: { label: 'Cost, fees & pricing', terms: ['expensive','costly','overpriced','pricing','price','hidden fee','hidden fees','fee','fees','cost','budget','too much money','spend'] },
  usability: { label: 'Usability & complexity', terms: ['confusing','hard to use','difficult to use','clunky','complicated','complex','too many steps','cumbersome','poor ux','bad ux','annoying','frustrating'] },
  visibility: { label: 'Visibility, tracking & transparency', terms: ['no visibility','visibility','track','tracking','status','no update','updates','progress','transparency','hard to know','where is','what happened'] },
  'security-compliance': { label: 'Security, privacy & compliance', terms: ['security','privacy','compliance','permission','permissions','audit','access control','data leak','breach','identity verification','verification'] },
  'setup-onboarding': { label: 'Setup, signup & onboarding', terms: ['setup','set up','install','installation','configure','configuration','onboarding','signup','sign up','registration','getting started','learning curve','verification process'] },
  'workflow-process': { label: 'Workflow & process friction', terms: ['workflow','approval','approvals','handoff','process','scheduling','schedule','reschedule','booking','coordination','paperwork','waiting on','too many steps'] },
  'missing-capability': { label: 'Missing capability or option', terms: ['missing feature','does not support','doesn\'t support','wish it had','wish there was','need a feature','lacks','lack of','cannot do','can\'t do','no way to','no option'] },
  support: { label: 'Support & issue resolution', terms: ['support','customer service','help desk','no response','no reply','response time','troubleshooting','help me','stuck','refund request','dispute'] },
  'data-migration': { label: 'Data, transfer & portability', terms: ['migration','migrate','transfer','import','export','data loss','duplicate','duplicates','inconsistent data','move data','portability','lock-in','lock in'] },
  'access-availability': { label: 'Access & availability', terms: ['unavailable','not available','out of stock','no slots','waitlist','waiting list','inaccessible','coverage','not supported in','not in my area','sold out','availability'] },
  quality: { label: 'Quality & accuracy', terms: ['poor quality','low quality','bad quality','defective','inaccurate','wrong result','wrong order','inconsistent','not as described','quality issue','quality issues'] },
  communication: { label: 'Communication & coordination', terms: ['miscommunication','communication','ghosted','no reply','no response','unclear','not informed','never told','hard to reach','cannot reach','can\'t reach'] },
  'billing-payments': { label: 'Billing & payments', terms: ['billing','charged','charge','payment','payments','invoice','refund','checkout','transaction','card declined','subscription cancellation','cancel subscription','double charged'] },
  'fulfillment-logistics': { label: 'Delivery, logistics & fulfillment', terms: ['delivery','shipping','courier','pickup','late delivery','delayed delivery','order delayed','order missing','tracking number','shipment','fulfillment','dispatch'] },
  'trust-safety': { label: 'Trust, fraud & safety', terms: ['scam','fraud','fake','unsafe','trust','suspicious','misleading','counterfeit','stolen','risk','risky'] },
  'discovery-comparison': { label: 'Discovery, search & comparison', terms: ['hard to find','cannot find','can\'t find','search is bad','search results','compare','comparison','recommendation','recommendations','filters','filtering','discover','discovery','reviews are'] },
};

const SEVERITY_TERMS = ['nightmare','impossible','terrible','awful','hate','painful','frustrating','frustrated','struggling','stuck','blocked','broken','unusable','waste','wasting','hours','days','every day','every week','constantly','always','keeps','cannot','can\'t','does not work','doesn\'t work','gave up','cancelled because','canceled because'];
const COMMERCIAL_TERMS = ['pay for','paid','budget','pricing','price','worth it','buy','purchase','subscription','vendor','alternative','alternatives','replace','switch','move away','migrate away','looking for a tool','looking for software','looking for a service','recommend a tool','recommend a service','refund','cancel subscription'];
const URGENCY_TERMS = ['urgent','asap','immediately','today','deadline','blocked','blocker','cannot complete','can\'t complete','losing customers','losing money','emergency','missed deadline','need this now','time sensitive'];
const WORKAROUND_TERMS = ['workaround','manual','manually','spreadsheet','excel','google sheets','paper','notebook','script','cron','copy paste','copy/paste','hack','custom script','homegrown','built our own','building our own','doing it by hand','email chain','whatsapp','multiple apps','separate app'];
const PAIN_CONTEXT_TERMS = ['problem','issue','pain','painful','frustrating','frustrated','hate','broken','fails','failed','difficult','hard','slow','manual','annoying','struggling','expensive','costly','waste','blocked','bug','missing','cannot','can\'t','doesn\'t work','does not work','need help','wish','need a better','looking for','unavailable','inaccurate','delayed','no response','no reply','refund'];

const PERSONA_RULES: Array<{ persona: string; terms: string[] }> = [
  { persona: 'Consumer / customer', terms: ['customer','consumer','buyer','shopper','user','as a customer','my family','parent','patient'] },
  { persona: 'Small business owner', terms: ['small business','business owner','shop owner','store owner','merchant','sme','our shop','my business'] },
  { persona: 'Founder / operator', terms: ['founder','startup','cofounder','co-founder','our company','operator'] },
  { persona: 'Operations / admin', terms: ['operations','ops team','administrator','admin team','office manager','back office'] },
  { persona: 'Product manager', terms: ['product manager','product team','roadmap','product owner'] },
  { persona: 'Customer support / success', terms: ['customer support','support team','customer success','help desk','service desk'] },
  { persona: 'Sales / revenue', terms: ['sales team','sales rep','account executive','revenue team','business development'] },
  { persona: 'Marketing / growth', terms: ['marketing','marketer','growth team','seo','content team','advertising'] },
  { persona: 'Finance / accounting', terms: ['finance team','accountant','accounting','bookkeeper','accounts payable','accounts receivable','cfo'] },
  { persona: 'HR / recruiting', terms: ['hr team','human resources','recruiter','recruiting','talent team','hiring manager'] },
  { persona: 'Healthcare professional', terms: ['doctor','nurse','clinic','hospital','therapist','pharmacist','healthcare worker','medical practice'] },
  { persona: 'Educator', terms: ['teacher','lecturer','professor','educator','school admin','instructor','tutor'] },
  { persona: 'Student / learner', terms: ['student','learner','university','college','course student'] },
  { persona: 'Creator / influencer', terms: ['creator','influencer','youtuber','streamer','content creator','podcaster'] },
  { persona: 'E-commerce merchant', terms: ['ecommerce','e-commerce','online store','shopify','seller','marketplace seller','amazon seller'] },
  { persona: 'Retail / hospitality operator', terms: ['retail','restaurant','hotel','cafe','store manager','hospitality','property host','airbnb host'] },
  { persona: 'Property / real-estate operator', terms: ['property manager','landlord','tenant','real estate','realtor','property owner','homeowner'] },
  { persona: 'Logistics / supply chain', terms: ['logistics','supply chain','warehouse','dispatcher','fleet','delivery driver','procurement'] },
  { persona: 'Travel / hospitality customer', terms: ['traveler','traveller','guest','booking','flight','hotel guest','tourist'] },
  { persona: 'Legal / compliance', terms: ['lawyer','legal team','compliance team','paralegal','regulatory'] },
  { persona: 'Software / IT professional', terms: ['developer','engineer','devops','platform engineer','sre','it team','sysadmin','software team','security engineer','data engineer'] },
  { persona: 'Researcher / analyst', terms: ['researcher','analyst','market research','data analyst','consultant'] },
  { persona: 'Freelancer / agency', terms: ['freelancer','agency','client work','consulting business','independent contractor'] },
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
  return matches.length > 0 ? matches.slice(0, 4) : ['End user / practitioner'];
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
  const severity = clamp(severityMatches * 11 + Math.min(Math.log1p(Math.max(score, 0)) * 3, 14));

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
    sourceType,
    postId,
    subreddit,
    author,
    text: cleanText,
    permalink,
    score,
    category,
    severity,
    commercialIntent,
    urgency,
    workaroundBurden,
    personas,
    keywords,
  }));
}

function sourceKey(evidence: PainEvidence) {
  return `${evidence.sourceType}:${evidence.postId}:${evidence.author}:${evidence.text.slice(0, 96)}`;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function peakBlend(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(clamp(Math.max(...values) * 0.65 + average(values) * 0.35));
}

function createReason(cluster: Omit<PainCluster, 'opportunityReason'>) {
  const reasons: string[] = [];
  if (cluster.recurrence >= 60) reasons.push('repeats across multiple conversations');
  if (cluster.commercialIntent >= 45) reasons.push('people show spending, switching, cancellation, or alternative-seeking intent');
  if (cluster.workaroundBurden >= 40) reasons.push('people rely on manual or improvised workarounds');
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
    const recurringKeywords = [...documentFrequency.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([keyword]) => keyword);
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
      const commercialIntent = peakBlend(unique.map((item) => item.commercialIntent));
      const urgency = peakBlend(unique.map((item) => item.urgency));
      const workaroundBurden = peakBlend(unique.map((item) => item.workaroundBurden));
      const commentEvidence = unique.filter((item) => item.sourceType === 'comment').length;
      const confidence = Math.round(clamp(unique.length * 7 + distinctPosts * 10 + distinctSubreddits * 12 + Math.min(commentEvidence * 2, 20)));
      const painScore = Math.round(clamp(severity * 0.28 + recurrence * 0.27 + commercialIntent * 0.18 + urgency * 0.13 + workaroundBurden * 0.14));

      const personaCounts = new Map<string, number>();
      const keywordCounts = new Map<string, number>();
      unique.forEach((item) => {
        item.personas.forEach((persona) => personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1));
        item.keywords.forEach((keyword) => keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1));
      });

      const personas = [...personaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([persona]) => persona);
      const keywords = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([keyword]) => keyword);
      const categoryLabel = CATEGORY_RULES[category].label;
      const label = primary === 'general' ? categoryLabel : `${categoryLabel}: ${primary}`;
      const rankedEvidence = [...unique]
        .sort((a, b) => (b.severity + b.commercialIntent + b.urgency + b.workaroundBurden + Math.log1p(Math.max(b.score, 0)) * 4) - (a.severity + a.commercialIntent + a.urgency + a.workaroundBurden + Math.log1p(Math.max(a.score, 0)) * 4))
        .slice(0, 6);

      const partial: Omit<PainCluster, 'opportunityReason'> = {
        id: `${category}:${primary}`,
        category,
        label,
        painScore,
        severity,
        recurrence,
        commercialIntent,
        urgency,
        workaroundBurden,
        confidence,
        evidenceCount: unique.length,
        distinctPosts,
        distinctSubreddits,
        personas,
        keywords,
        evidence: rankedEvidence,
      };
      clusters.push({ ...partial, opportunityReason: createReason(partial) });
    });
  });

  return clusters
    .filter((cluster) => cluster.evidenceCount >= 1)
    .sort((a, b) => (b.painScore + b.confidence * 0.15) - (a.painScore + a.confidence * 0.15));
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
    topPersonas: [...personaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([persona, mentions]) => ({ persona, mentions })),
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
