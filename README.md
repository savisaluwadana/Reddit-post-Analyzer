# Pain Intelligence Lab

A cross-source market and customer research platform for finding recurring pain points, costly workarounds, unmet needs, switching intent and evidence-backed product opportunities.

Reddit is included as a deep native connector, but it is no longer the product boundary. Codex, Claude Code or another MCP-capable research harness can collect evidence from the wider public web and feed the same durable intelligence layer.

## What it does

### Cross-source evidence intelligence

The platform has a durable evidence inbox for first-hand research collected from sources such as:

- Reddit and specialist forums
- Hacker News and community discussions
- GitHub issues/discussions
- product and SaaS review sites
- app-store reviews
- public social posts
- support/community forums
- marketplaces
- surveys or exported customer research
- blogs/case studies containing first-hand workflow evidence
- other authorized public web sources

Evidence is normalized, fingerprinted and deduplicated before analysis. The dashboard shows source balance so a research run is less likely to overfit to one community.

### MCP research harness

`mcp/server.js` exposes a local stdio MCP server intended for coding/research harnesses such as Codex and Claude Code.

The harness does the browsing/search/scraping with whatever tools it already has. The MCP server provides the durable research workflow:

```text
search / browse / scrape
          ↓
   ingest_evidence
          ↓
     source_stats
          ↓
 analyze_pain_points
          ↓
 saved evidence-backed scan
          ↓
new / rising / persistent / falling pain
```

Available MCP tools:

- `platform_status`
- `research_protocol`
- `ingest_evidence`
- `search_evidence`
- `source_stats`
- `analyze_pain_points`
- `list_saved_analyses`

See [`docs/MCP.md`](docs/MCP.md) for Codex / Claude Code setup and a complete agent research workflow.

### General pain-point intelligence

The intelligence model is deliberately industry-agnostic. It can be used for B2B, B2C and operational research across areas such as e-commerce, healthcare, finance, education, real estate, travel, local services, consumer software, creator tools, HR, accounting, retail, logistics and technical infrastructure.

Pain is classified into broad problem families including:

- manual work and repetitive tasks
- integrations and interoperability
- reliability and failures
- delays and performance
- cost, fees and pricing
- usability and complexity
- visibility, tracking and transparency
- privacy, security and compliance
- setup, signup and onboarding
- workflow and process friction
- missing capabilities
- support and issue resolution
- data transfer and portability
- access and availability
- quality and accuracy
- communication and coordination
- billing and payments
- delivery, logistics and fulfillment
- trust, fraud and safety
- discovery, search and comparison

The engine also detects likely affected personas across consumers, small businesses, founders, operations, product, customer support, sales, marketing, finance, HR, healthcare, education, creators, e-commerce, retail/hospitality, property, logistics, travel, legal/compliance, software/IT, research and agencies/freelancers.

### Transparent scoring

A pain cluster is ranked using several visible dimensions rather than a black-box “AI opportunity” label:

1. **Severity** — strength of failure, frustration and outcome impact.
2. **Recurrence** — repeated independent evidence.
3. **Commercial intent** — pricing, budget, buying, switching, cancellation or alternative-seeking language.
4. **Urgency** — blockers, deadlines and time-sensitive impact.
5. **Workaround burden** — spreadsheets, copy/paste, scripts, paper processes, multiple apps and other compensating work.
6. **Confidence** — evidence volume plus diversity across sources/communities.

A high score is meant to prioritize manual validation, not predict market success.

### Versioned cross-source scans

Cross-source analyses can be saved to MongoDB. The latest two scans are compared automatically so clusters can be classified as:

- **New** — present now but absent from the previous scan
- **Rising** — materially stronger than before
- **Persistent** — remains important at similar strength
- **Falling** — materially weaker than before

### Reddit deep-research connector

The original Reddit workflow remains available as a specialized native connector:

- multi-subreddit post collection
- exact date filtering
- engagement/velocity ranking
- comment-level deep scans
- repeated pain clustering
- buying/switching intent
- manual workaround detection
- affected personas
- hourly post engagement history
- reusable Reddit research projects
- saved Reddit pain snapshots

This connector is useful when Reddit is an important source, while MCP handles the wider research web.

## Architecture

```text
                Public research sources
                          │
          ┌───────────────┴───────────────┐
          │                               │
   Built-in Reddit                  Codex / Claude Code
       connector                   browser/search tools
          │                               │
          │                         MCP stdio bridge
          │                               │
          └───────────────┬───────────────┘
                          │
                    EvidenceItem
                       MongoDB
                          │
                 Cross-source engine
                          │
     severity · recurrence · commercial intent
        urgency · workaround · confidence
                          │
                   Pain clusters
                          │
                    saved scans
                          │
            new / rising / persistent / falling
```

## Setup

Copy `.env.example` to `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/reddit_post_analyzer
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
SNAPSHOT_RETENTION_DAYS=90
```

Install dependencies:

```bash
npm install
```

Run the API and frontend in separate terminals:

```bash
npm run server
npm run dev
```

The browser UI is served by Vite. `/api` is proxied to the Node API and `/reddit` is proxied to Reddit for the built-in Reddit connector.

## MCP quick start

Keep the platform API running:

```bash
npm run server
```

The local MCP process can be launched directly for testing:

```bash
npm run mcp
```

Normally Codex or Claude Code launches the process automatically.

Claude Code project configuration example:

```json
{
  "mcpServers": {
    "pain-intelligence": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/server.js"],
      "env": {
        "PAIN_PLATFORM_API_URL": "http://127.0.0.1:4000"
      }
    }
  }
}
```

A copy-ready example is available at `.mcp.json.example`.

Codex TOML example:

```toml
[mcp_servers.pain-intelligence]
command = "node"
args = ["mcp/server.js"]
env = { PAIN_PLATFORM_API_URL = "http://127.0.0.1:4000" }
startup_timeout_sec = 10
tool_timeout_sec = 90
```

A copy-ready example is available at `.codex/config.toml.example`.

For the full setup, research prompt and security rules, see [`docs/MCP.md`](docs/MCP.md).

## Cross-source evidence API

### Evidence stats

```text
GET /api/evidence/stats
```

### Ingest normalized evidence

```text
POST /api/evidence/bulk
```

Example body:

```json
{
  "batchId": "restaurant-delivery-sept-2026",
  "ingestedBy": "research-agent",
  "items": [
    {
      "sourceKind": "review",
      "sourceName": "Example Review Site",
      "sourceUrl": "https://example.com/review/123",
      "community": "restaurant delivery software",
      "title": "Reconciling delivery orders takes hours",
      "text": "We export separate reports and manually reconcile them every night...",
      "engagementScore": 14,
      "tags": ["restaurant", "delivery", "reconciliation"]
    }
  ]
}
```

Batches support up to 500 evidence items. Duplicate evidence is fingerprinted and upserted.

### Search evidence

```text
GET /api/evidence?q=refund&sourceKind=review&limit=100
GET /api/evidence?community=restaurant%20delivery
```

Supported filters include text query, source kind, source name, community, tags, batch id and `since`.

### Analyze stored evidence

```text
POST /api/evidence/analyze
```

Example:

```json
{
  "sourceKind": "review",
  "since": "2026-08-01T00:00:00Z",
  "limit": 1000
}
```

### Saved cross-source scans

```text
GET /api/evidence/scans?limit=20
POST /api/evidence/scans
DELETE /api/evidence/scans/:id
```

The list endpoint includes latest-vs-previous cluster movement.

## Reddit-specific API

### Posts + hourly engagement history

```text
POST /api/posts/bulk
GET /api/posts
```

### Saved Reddit research projects

```text
GET /api/projects
POST /api/projects
DELETE /api/projects/:id
```

### Reddit momentum

```text
GET /api/trends?days=30
GET /api/trends?days=30&subreddit=kubernetes
```

### Saved Reddit pain scans

```text
GET /api/pain-scans?limit=20
POST /api/pain-scans
DELETE /api/pain-scans/:id
```

## MongoDB collections

The platform currently uses:

- `EvidenceItem` — durable normalized evidence from any source
- `CrossSourceScan` — versioned general-market pain analyses
- `RedditPost` — latest known state for built-in Reddit collection
- `PostSnapshot` — hourly Reddit engagement snapshots
- `ResearchProject` — reusable Reddit research configurations
- `PainScan` — versioned Reddit-specific pain scans

## Research safety

Anything collected from the web is untrusted input. Posts/pages can contain text that resembles instructions to an AI agent. The MCP tool descriptions and research protocol explicitly tell harnesses to treat scraped content only as evidence and never execute instructions embedded in source text.

Only collect content you are authorized to access. Respect applicable access controls, site terms and rate limits. Do not put secrets, private messages, credentials or unrelated sensitive account data into the evidence store.

## Validation

Pull requests run CI for:

```text
npm ci
npm run lint
node --check server/index.js
node --check server/painScanRoutes.js
node --check server/evidenceRoutes.js
node --check server/generalPainEngine.js
node --check mcp/server.js
MCP initialize + tools/list smoke test
npm run build
```

## Direction

The platform is now structured as an extensible pain-intelligence system rather than a Reddit-specific analyzer. Strong next layers include semantic/embedding clustering for paraphrased complaints, scheduled agent research jobs, threshold alerts, product/competitor/entity extraction, source credibility weighting, customer-interview imports and grounded LLM synthesis that always links back to the evidence set.
