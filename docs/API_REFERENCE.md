# HTTP API guide

Default API origin: `http://localhost:4000`. Local Vite requests use relative URLs and its proxy; the built application uses the same origin as Express. Responses are JSON except frontend assets. Send `Content-Type: application/json` for writes. No authentication is implemented: keep the service local or behind an authenticated private gateway.

The [complete route inventory](API_ROUTES.md) lists every implemented HTTP method/path and its handler files. The [MCP reference](MCP_REFERENCE.md) contains every host-facing input schema, including nested annotation, validation and opportunity contracts. The [User Guide](USER_GUIDE.md) explains the workflows.

## Common response behavior

| Status | Meaning |
| --- | --- |
| 200 / 201 | Request completed / object created; inspect the endpoint's response body |
| 400 | Invalid input, object ID, JSON or reference set |
| 403 | Upstream Reddit access denied |
| 404 | Object, API route, asset or supported Reddit feed was not found |
| 409 | Lifecycle or integrity conflict; inspect current job/run state before retrying |
| 413 | JSON request exceeds 2 MB; use smaller batches |
| 429 | Reddit rate limit; preserve and honor `Retry-After` when present |
| 500 | Internal route/storage failure; inspect server logs |
| 502 / 504 | Reddit returned an unusable response / relay deadline expired |
| 503 | Readiness check reports MongoDB disconnected |

Error bodies use `message`; some lifecycle errors also include fields such as `jobStatus`, missing references, or progress. There is no single response envelope for all endpoints. Unknown `/api` paths remain JSON 404s even when the browser requests HTML. Parser errors do not expose raw stacks or request content.

List endpoints are capped and usually sorted by recent creation/update. There is no general cursor-pagination contract. Dates should be ISO-8601. Text-search endpoints use Mongo text indexes, not semantic/vector search. Many inputs accept snake_case aliases for MCP compatibility, but browser APIs generally use camelCase. See each handler and the tool schema before adding a client.

## Health and frontend

`GET /api/health` returns `ok`, `database`, snapshot retention, capabilities and model mode. HTTP 200 means Mongoose is connected; HTTP 503 means it is disconnected. This is a connection-state readiness check, not a fresh database ping on every request. `GET /api/health/live` always returns `{ "ok": true }` while HTTP is serving.

`GET /` serves the frontend after `npm run build`. Missing asset paths return 404. The application only provides the SPA fallback for non-API paths requesting HTML without a file extension.

```bash
curl -i http://localhost:4000/api/health
curl -i http://localhost:4000/api/health/live
```

## Reddit relay, posts, projects and trends

| Operation | Input and output |
| --- | --- |
| `GET /reddit/r/:subreddit/top.json` | Community must be 2–21 letters/digits/underscores; `t` is hour/day/week/month/year/all; `limit` is an integer 1–100. Returns upstream Reddit listing JSON. |
| `GET /reddit/comments/:postId.json` | Alphanumeric post ID; `limit` 1–100; comment sort is fixed to top; returns Reddit thread listing JSON. |
| `POST /api/posts/bulk` | `{posts: [...]}` using Reddit field names (`id`, `created_utc`, `num_comments`, `selftext`); max 1,000 items and 2 MB total. Returns received/processed/upsert/update/match and snapshot counts. |
| `GET /api/posts` | `subreddit`, `q`, `minScore`, `minComments`, `sort`, `order`, `limit`; sortable fields are createdUtc/score/numComments/lastFetchedAt; max 500. Returns `{count, posts}` using stored camelCase fields. |
| `GET /api/projects` | Returns up to 100 saved project configurations in `{count, projects}`. |
| `POST /api/projects` | Required `name`, nonempty `subreddits`; optional description/keywords/minScore/minComments/signalFilter/sortMode. Returns `{project}`. |
| `DELETE /api/projects/:id` | Deletes a saved configuration and returns `{ok: true}`. |
| `GET /api/trends` | `days` 1–90, optional subreddit; returns `{days, points, topMovers}` from saved snapshots. |

The relay accepts only two fixed feed paths, only reads from `www.reddit.com`, does not forward credentials, does not follow redirects and uses a 12-second deadline. Browser feed requests have a 15-second deadline. Unknown query keys do not become arbitrary upstream URLs. There is no OAuth connector, unrestricted proxy, archive search, listing pagination or expansion of Reddit `more` nodes.

The browser fetches at most 25 communities with concurrency three, up to 100 top posts each. Date filtering is applied to that sample, not to an exhaustive history. Comments are bounded, sorted by score and traversed to a limited depth. An empty listing is different from a failed request; invalid upstream structures are reported as errors.

## Cross-source evidence

`POST /api/evidence/bulk` accepts 1–500 items. Item text is required; source metadata makes the research useful. The request can provide shared `sourceKind`, `sourceName`, `batchId`, and `ingestedBy` defaults. Normalization bounds evidence text to 12,000 characters. The earlier reliability handler performs fingerprint deduplication and membership writes.

This is a **synthetic demonstration record**, not real market evidence. Use a separate demo database; do not mix this record with actual research. Batch-linked evidence is guarded against direct deletion.

```bash
curl -sS http://localhost:4000/api/evidence/bulk \
  -H 'Content-Type: application/json' \
  --data '{"batchId":"demo-only","sourceKind":"survey","sourceName":"Synthetic demo","items":[{"external_id":"demo-001","text":"Synthetic example: I spend three hours each week copying invoices between spreadsheets.","community":"demo","author":"demo-user","tags":["synthetic"]}]}'

curl -sS 'http://localhost:4000/api/evidence?batchId=demo-only&limit=20'

curl -sS http://localhost:4000/api/evidence/analyze \
  -H 'Content-Type: application/json' --data '{"batchId":"demo-only"}'
```

Search filters: `q`, `sourceKind`, `sourceName`, `community`, comma-separated `tags`, `since`, `batchId`, `limit`. Search returns `{count, items}`; analysis returns `{report, filters}`. `since` filters stored creation time in these handlers, so it is not automatically a source publication-date filter. Analysis uses at most 2,000 records.

`GET /api/evidence/stats` reports totals and source distributions. `POST /api/evidence/scans` stores `{name, filters, report}` with at least one cluster. `GET /api/evidence/scans` returns saved scans and movement comparison. DELETE endpoints remove individual evidence or scans subject to integrity checks. Batch writes report accepted counts, so compare `receivedCount` and `processedCount` before assuming every item was accepted.

Reddit pain reports are stored separately through `/api/pain-scans`: POST uses `{name, subreddits, scan}`, GET returns scans/comparison, DELETE removes a saved scan. Cross-source report and Reddit scan payloads are different contracts.

## Autonomous jobs

Create with `POST /api/research-jobs`:

```json
{
  "name": "Clinic billing workflow research",
  "topic": "Find recurring manual billing and reconciliation work in small clinics",
  "audience": "Practice managers and clinic owners",
  "priority": 50,
  "maxPasses": 3,
  "preferredSourceKinds": ["review", "forum", "support", "community"]
}
```

The response is `{job, executionProtocol}`. Store `job._id` and `job.batchId`; they serve different purposes. Use the job's batch ID when ingesting its evidence.

| Endpoint suffix under `/api/research-jobs` | Request / behavior |
| --- | --- |
| `GET /`, `GET /:id` | List recent jobs / read job and execution protocol |
| `POST /claim` | `{harness, leaseMinutes}`; default 30 minutes, bounded 5–120; returns a job or `job: null` |
| `POST /:id/heartbeat` | Extend lease, optionally advance active status; terminal transitions need dedicated endpoints |
| `POST /:id/coverage` | `{advancePass: true}` after a real collection pass; returns coverage, quality, readiness, gaps, `forcedForward` and remaining passes |
| `POST /:id/link-host-run` | `{hostRunId}`; linked run must match the job batch and pass handoff rules |
| `GET /:id/validation-pack` | Read opportunities to challenge against competitors/pricing |
| `POST /:id/validation` | `{validations: [...], resultSummary}`; exactly one validation per synthesized opportunity; completes job |
| `POST /:id/fail` | `{reason}`; cannot mark a completed job failed |
| `POST /:id/requeue` | Requeue interrupted/failed work; a completed job requires `{restart: true}`; restart clears linked result state, not all underlying evidence |
| `DELETE /:id` | Deletes job/memberships/search memory while preserving shared evidence |

Do not advance the pass counter just to bypass quality checks. A capped-pass handoff preserves uncertainty and should be surfaced in the result. Prefer `start_job_semantic_analysis` via MCP: it creates and links a batch-scoped run. Zero-opportunity completion is exposed as `complete_research_job_without_opportunities`; it uses the validation endpoint with an empty set only when synthesis has no opportunities.

## Search and adaptive scraping

Under `/api/research-search`: `/jobs/:id/plan`, `/quality`, `/memory` are GET; `/progress` and `/deep-scrape` are POST. `/deep-scrape-plan` is GET with URL/source context. Search plans and source contracts are instructions for the host, not a server-side browsing engine.

Under `/api/scrape-intelligence`: get `/source-contract`, start `/jobs/:id/session`, add `/candidates`, get `/next`, record `/page-result`, get `/summary`, and explicitly `/reopen` a stopped session. The exact methods and paths are in [the inventory](API_ROUTES.md). A page result records extraction quality, access boundary, evidence yield and discovered links. Evidence still needs the ingestion tool; an audit record is not proof that corresponding evidence was saved.

Honor page leases and retry timestamps. Preserve root URLs and conversation IDs. Closed job stages reject collection/search writes. See [Scraping Intelligence](SCRAPING_INTELLIGENCE.md) and the full MCP schemas for candidate/page/result shapes.

## Semantic runs

Under `/api/host-intelligence`, create a run at `POST /runs` with required `name`, optional topic/audience/harness/modelLabel/filters. GET `/runs` and `/runs/:id` read stored state.

1. GET `/runs/:id/evidence-batch?limit=40` for pending items and the annotation contract. Batch maximum is 80; eligible run input is capped at 1,000 records.
2. POST `/runs/:id/annotations` with 1–100 annotations. Required identifiers/meaning fields are `evidence_id`, `canonical_pain`, `semantic_cluster_key`, `semantic_cluster_label` (camelCase aliases are normalized).
3. Repeat until the response says annotation progress is complete. `remaining` excludes the returned batch; use `remainingTotal` for all still-unannotated records.
4. GET `/runs/:id/synthesis-pack`; incomplete annotations produce HTTP 409.
5. POST `/runs/:id/synthesis` with clusters, opportunities, coverage and synthesis notes. IDs must be nonempty/unique and references must belong to the run.
6. GET `/runs/:id/graph` for bounded nodes/edges. DELETE `/runs/:id` is guarded when a research job references it.

Use the [Host LLM guide](HOST_LLM.md) and [MCP schemas](MCP_REFERENCE.md) for complete nested fields. The API validates structure and references; it cannot establish that a host's reasoning or cited market claims are true.

## Quality and execution

`/api/quality-intelligence` provides run summary, entity refresh/list, consensus pack/submission, and market-sizing pack/submission/list. Consensus separates supporting, contradicting, mixed and neutral evidence. Market sizing requires explicit population/spend/share ranges and source/assumption records; it does not look up market sizes itself.

`/api/opportunity-os/workspaces/from-run` creates a workspace from `runId` and `opportunityId`. Workspace endpoints cover strategy, founder fit, experiments, observed results, execution pack, build specification, GTM plan and stage. Existing decision gates can reject an unsupported stage with HTTP 409. A research thesis and a real paid validation outcome have different roles. See [Quality Intelligence](QUALITY_INTELLIGENCE.md), [Opportunity OS](OPPORTUNITY_OS.md) and the corresponding full tool schemas.

## MCP versus HTTP naming

MCP tools usually use `job_id`, `run_id`, `workspace_id`, and `batch_id`; the bridge maps them into HTTP path parameters and camelCase bodies. Do not send `job_id` where a route expects `hostRunId`. Prefer MCP for complex host orchestration so the existing translation and contracts remain centralized.

MCP API calls time out after 30 seconds; clients may have their own outer tool timeout. A timed-out write may have succeeded in MongoDB. Read current state before retrying a create or transition operation. Do not assume all writes are idempotent or transactional.
