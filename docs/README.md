# Pain Intelligence Lab documentation

Use this page as the documentation map.

## Start here

### [5-minute Quick Start](QUICKSTART.md)

Use this if you want to get the platform running and complete your first manual, Reddit or autonomous research workflow quickly.

### [Complete User Guide](USER_GUIDE.md)

The primary end-user/operator manual. It covers:

- installation
- MongoDB and environment setup
- browser workspaces
- manual evidence collection
- autonomous research jobs
- Codex / Claude Code MCP setup
- search planning
- deep scraping
- coverage and quality gates
- semantic annotation
- semantic clustering
- opportunity synthesis
- competitor / pricing validation
- Reddit research
- scoring interpretation
- MCP tool map
- troubleshooting
- safety boundaries
- full end-to-end example

If you are unsure which document to read, read the User Guide.

## Deeper technical guides

### [MCP Harness Integration](MCP.md)

How the local stdio MCP bridge connects the platform to Codex, Claude Code or another MCP-capable host.

Read this when you are configuring an MCP client or debugging host/tool connectivity.

### [Autonomous Research Jobs](AUTONOMOUS_RESEARCH.md)

How the durable research queue, leases, coverage loop, semantic-analysis stage and market-validation stage work.

Read this when you are changing or extending job orchestration.

### [Deep Research Workflow](DEEP_RESEARCH.md)

How search missions, search memory, entity branching, deep-scrape contracts, evidence independence, contradiction hunting and research-quality scoring work.

Read this when you are improving collection quality.

### [Host-powered LLM Intelligence](HOST_LLM.md)

Why the application does not need an OpenAI/Anthropic model API key and how the connected MCP host performs semantic annotation, JTBD/entity extraction, clustering and opportunity synthesis.

Read this when you are working on the semantic layer.

### [System Audit and Reliability](SYSTEM_AUDIT.md)

Correctness invariants introduced during the full reliability audit, including multi-job evidence membership, state guards, story-level independence and regression tests.

Read this before modifying research state, evidence ownership or destructive operations.

## Recommended reading order

For a new user:

```text
QUICKSTART
    ↓
USER_GUIDE
```

For someone integrating Codex or Claude Code:

```text
QUICKSTART
    ↓
USER_GUIDE
    ↓
MCP
    ↓
AUTONOMOUS_RESEARCH
```

For someone developing the research engine:

```text
USER_GUIDE
    ↓
DEEP_RESEARCH
    ↓
HOST_LLM
    ↓
SYSTEM_AUDIT
```

## Platform workflow at a glance

```text
Research question
      ↓
Research job
      ↓
MCP host search / browse
      ↓
Evidence ingestion
      ↓
Coverage + quality gates
      ↓
Semantic annotation
      ↓
Semantic pain clusters + JTBD
      ↓
Opportunity synthesis
      ↓
Competitor / pricing validation
      ↓
reject / watch / validate / build
```

The platform itself does not require an OpenAI, Anthropic or embedding API key. The connected MCP host supplies browsing and semantic reasoning from its own session.
