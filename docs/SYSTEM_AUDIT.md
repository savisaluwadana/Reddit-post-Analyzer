# System audit and reliability fixes

This audit covers the current Pain Intelligence Lab architecture after the autonomous research and deep-search phases. The focus is correctness and research integrity rather than deployment or multi-tenant concerns.

## Critical issues fixed

### Evidence moved between research jobs
Evidence is globally deduplicated by fingerprint. Previously the same document also stored a single mutable `batchId`, so re-ingesting an existing item for a new research job overwrote the old job association.

The reliability layer adds a durable many-to-many `EvidenceBatchMembership` collection. Global evidence remains deduplicated while one evidence item can belong to multiple research jobs. Legacy `EvidenceItem.batchId` values are still read for backward compatibility.

### Semantic runs became synthesis-ready too early
Submitting the first annotation batch previously moved a host run to `ready-for-synthesis` even if eligible evidence remained.

The server now computes annotation progress against the actual eligible evidence set. Runs stay `annotating` until every eligible item is annotated, and synthesis endpoints reject incomplete runs.

### Job states could bypass lifecycle rules
Heartbeat requests could previously move a job to terminal states or extend completed jobs.

Heartbeats are now restricted to active lifecycle states. Completion and failure must use their dedicated endpoints.

### Quality gates were advisory
Search coverage and evidence quality were described in the MCP workflow, but semantic analysis could be started without satisfying them.

The server now checks both collection coverage and search-quality gates before linking a semantic run. The max-pass rule remains as the explicit escape hatch when a research question cannot reach the normal thresholds.

### Raw item counts overstated independence
Many comments from one large thread could look like many independent signals.

Quality evaluation now combines near-duplicate detection with root-conversation/story grouping. Reddit comments from the same post and evidence carrying common `root_url`, `thread_id`, or `conversation_id` metadata are treated as one independent story for the quality gate.

### Opportunity validation was not referentially strict
A job could be completed with missing, duplicate, or unknown opportunity validation IDs.

The server now requires exactly one validation per synthesized opportunity. Jobs with zero synthesized opportunities can complete with an empty validation set.

## Additional correctness fixes

- Batch-aware evidence search and deterministic analysis use the many-to-many membership store.
- Existing legacy batch associations remain readable while new ingests backfill memberships.
- Reclaimed expired jobs preserve their current active stage rather than being reset to `claimed`.
- Completed jobs cannot be failed or casually requeued; an intentional restart is explicit.
- Deleting a research job removes its batch memberships and search memory while preserving shared evidence.
- Semantic cluster/opportunity references are checked against the run's annotated evidence and generated clusters.
- Host evidence batches report accurate eligible, annotated, and remaining counts.
- Host evidence text is bounded before being sent to the MCP model context.
- Search memory normalizes equivalent queries so punctuation/operator variations do not trigger redundant research passes.
- Commercial-signal heuristics no longer count a generic subscription mention as buying intent.
- Negated wording such as "I do not recommend it" is not counted as positive counter-evidence.
- The browser Reddit connector now parses HTML date inputs as local calendar dates rather than UTC-midnight dates.

## Reliability tests

The project now includes Node tests for the pure invariants used by the reliability layer:

- annotation completion math
- lifecycle transition rules
- root-thread story grouping
- strict commercial-signal detection
- negated counter-evidence handling
- exact opportunity validation coverage
- URL/query normalization
- local calendar date parsing

CI runs the unit tests in addition to lint, server syntax checks, MCP discovery/smoke tests, and the production frontend build.

## Architecture principle retained

No model API key is introduced. Codex/Claude remains the browsing and semantic-reasoning host through MCP. The application owns durable evidence, membership, search memory, lifecycle state, deterministic gates, and structured outputs.
