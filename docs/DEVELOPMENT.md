# Developer and contributor guide

Start with [Architecture](ARCHITECTURE.md), [Data model](DATA_MODEL.md), [API guide](API_REFERENCE.md) and [Deployment](DEPLOYMENT.md). The existing [System Audit](SYSTEM_AUDIT.md) explains research integrity invariants.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/components/` | Browser panels and controls |
| `src/types/` | TypeScript browser contracts |
| `src/utils/` | HTTP clients and browser analysis helpers |
| `src/*.css` | Shared and workspace styling |
| `server/*Routes.js` | Express routers and Mongoose schemas |
| `server/*Core.js` | Pure decision/scoring/normalization functions |
| `mcp/` | Stdio entrypoint and host tool definitions/HTTP mappings |
| `tests/` | Node unit/regression and HTTP runtime tests |
| `scripts/` | Generated reference documentation and link validation |
| `docs/` | User workflows, system reference and operating manual |
| `Dockerfile`, `compose.yaml` | Built local runtime with persistent MongoDB |
| `.github/workflows/ci.yml` | Lint, tests, syntax, MCP discovery, build and container smoke validation |

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the lockfile dependency set |
| `npm run dev` | Vite browser development server |
| `npm run server` | Database-connected Express server |
| `npm run mcp` | Local JSON-RPC stdio bridge; launch it through a client for actual use |
| `npm test` | Pure invariant tests and HTTP boundary regressions |
| `npm run lint` | TypeScript/TSX ESLint rules |
| `npm run build` | Type-check and build the frontend |
| `npm run docs:generate` | Regenerate route inventory and full MCP schemas |
| `npm run docs:check` | Verify generated references are current and local Markdown links exist |
| `docker compose up --build -d --wait` | Build/start the complete local app |
| `node scripts/smoke-stack.mjs` | Mongo-backed HTTP smoke workflow against a dedicated running test stack |

Node 22.12+ is required. Tests import erasable TypeScript directly through Node. For Node 22 versions before native type stripping is enabled by default, use `NODE_OPTIONS=--experimental-strip-types npm test` or a current Node 22 patch release. CI uses Node 22. Do not replace `npm ci` with a dependency upgrade while validating an unrelated change.

## Add or change a feature

1. Put deterministic logic in a core module where possible; cover meaningful edge cases.
2. Add/modify the schema and route in its feature module.
3. Review guard and reliability handlers that may intercept the same path.
4. Update the TypeScript contracts and HTTP client used by the browser.
5. For a host feature, define its MCP `inputSchema` and translate arguments into the HTTP contract in the relevant tool module.
6. Regenerate references and update the user workflow guide.
7. Run tests, lint, build and any relevant database/container smoke checks.

Complex nested MCP schemas are the host's discovery contract. They are not a substitute for server validation. The custom bridge does not use a general schema-validator package to validate every tool argument at runtime; the API must enforce integrity and input boundaries.

## Research invariants to preserve

- Evidence documents are globally deduplicated and job associations are many-to-many.
- Search memory, memberships and source provenance survive ordinary collection retries.
- Eligible annotations are scoped to the run filter; synthesis waits for all of them.
- Collection/search audit writes close when semantic work starts.
- Every cluster/opportunity references only its own run evidence and valid cluster IDs.
- Completing validation requires exactly one result per synthesized opportunity.
- Empty synthesis is allowed and must not manufacture product ideas.
- Heartbeats cannot terminate or rewind jobs; completed jobs need intentional restart.
- Root conversation grouping separates evidence quantity from independent stories.
- Paid commitments, observed experiments and research scores remain distinct signals.
- Source content is untrusted data; no page text becomes host instructions.

## Testing strategy

Pure tests cover score/decision boundaries, independence, commercial-signal interpretation, annotation progress, opportunity coverage and scrape policies. Runtime tests use local ephemeral HTTP listeners and injected upstream responses, verifying routing, readiness status, JSON errors and Reddit relay behavior without hitting Reddit.

The frontend-serving runtime test runs when `dist/index.html` exists. CI also builds a Docker image and starts MongoDB for the dedicated stack smoke workflow. The stack smoke script creates clearly labeled synthetic evidence, reads it back, runs analysis, stores a project and checks a queued job, then cleans up its own objects. Run it only against a dedicated test database; it is not a load test or a full autonomous host run.

External browsing/model outputs cannot be reproduced by these tests. Host orchestration needs a manual representative research run and evidence review. Container build/start checks do not establish public hosting readiness.

## Documentation maintenance

`docs/API_ROUTES.md` is generated from mounted route modules. `docs/MCP_REFERENCE.md` is generated from actual `tools/list` output and includes each full input schema. Run `npm run docs:generate` whenever routes or tools change, then `npm run docs:check`. The check also verifies relative links in README/docs. It does not validate external URLs or the truth of prose.

Diagrams describe implemented architecture. Label future components explicitly; do not add a worker, graph database, scheduler or external model API that the application does not contain. Examples using synthetic evidence must say so.

## Current engineering limits

There are no users/roles/tenants, an external worker service, unlimited archive scraping, cursor pagination, general migrations, or transactional bulk writes. JSON bodies are limited to 2 MB. List/run/frontier caps bound individual requests and documents, but very large sustained workloads still need capacity testing.

ESLint currently targets TypeScript/TSX; JavaScript server/MCP syntax is checked separately in CI. Existing hook-dependency warnings should be reviewed when changing the corresponding UI behavior. Review server changes through tests and source checks rather than assuming frontend lint covers them.

The repository does not currently include a license file. Do not assume an MIT/Apache license merely because the repository is public; the owner must choose a license before contributors or downstream users can rely on those permissions.
