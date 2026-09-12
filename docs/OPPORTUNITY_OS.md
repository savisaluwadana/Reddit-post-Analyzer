# Founder / Product Opportunity OS

The Opportunity OS turns a completed research opportunity into an execution workspace that can survive contact with real customers.

The research engine answers:

> Is this problem real, recurring, commercially important, and plausibly underserved?

The Opportunity OS answers:

> Should this team validate it, build it, watch it, or stop — and what exactly should happen next?

The system still does **not** require an OpenAI or Anthropic API key. Codex, Claude Code or another MCP host supplies semantic planning and artifact generation from its existing host session. The platform owns durable state, real experiment outcomes and deterministic decision rules.

## End-to-end flow

```text
completed research opportunity
        ↓
create Opportunity Workspace
        ↓
opportunity strategy
ICP / buyer / user / wedge / pricing / distribution
        ↓
founder-team fit
skills / distribution / capital / time / operations
        ↓
validation experiments
interviews / outbound / landing page / pricing / prototype
concierge / presale / paid pilot
        ↓
record real results
responses / conversions / paid commitments / revenue / pipeline
        ↓
live decision engine
Build / Validate / Watch / Stop
        ↓
MVP build specification
        ↓
first-customer GTM plan
        ↓
building + further validation
```

## 1. Create a workspace

A workspace can only be created from an opportunity that already exists in a **completed** semantic host research run.

Using MCP:

```text
create_opportunity_workspace
```

Required:

```json
{
  "run_id": "<host research run id>",
  "opportunity_id": "<opportunity id>"
}
```

The operation is idempotent. Repeating it for the same run/opportunity returns the existing workspace instead of creating a duplicate.

The workspace snapshots:

- the original research run
- problem
- target persona and segment
- JTBD
- solution thesis
- why-now signal
- willingness-to-pay evidence
- alternatives
- differentiation
- supporting clusters/evidence ids
- host opportunity score
- deterministic research-quality score
- previous market-validation verdict when available

This keeps execution attached to provenance instead of turning into an unrelated idea document.

## 2. Define the opportunity strategy

Use:

```text
submit_opportunity_strategy
```

The strategy contains:

- ICP
- economic buyer
- end user
- painful workflow
- narrow wedge
- positioning
- concrete promise
- buyer trigger events
- pricing hypotheses
- distribution channels
- moat hypotheses
- assumptions
- kill criteria
- risks

A useful strategy should be falsifiable. Do not write a generic statement such as "businesses need automation."

Better:

```text
ICP: 5-30 location independent dental groups using two or more practice-management/payment systems
Buyer: practice owner / COO
User: billing manager
Pain: weekly manual reconciliation between claims, card payments and bank deposits
Wedge: automatic exception-first reconciliation for the three highest-volume payment sources
Kill criterion: fewer than 3 of 10 qualified practices report >3 hours/week of reconciliation or none will discuss paying for a pilot
```

## 3. Founder / team fit

Use:

```text
submit_founder_fit_assessment
```

The current dimensions are:

- skill fit
- distribution fit
- capital fit
- time-to-market fit
- operating fit

All are 0-100 heuristic scores.

The purpose is not to declare whether a market is objectively good. It asks whether **this team** is unusually well or poorly positioned to pursue it.

For example, two opportunities can have identical customer pain while one is much more attractive because the team already has domain distribution, integrations, technical assets or trusted relationships.

## 4. Create validation experiments

Use:

```text
create_validation_experiment
```

Supported experiment types:

```text
interview
outbound
landing-page
waitlist
pricing
prototype
concierge
presale
paid-pilot
other
```

The platform provides a default hypothesis, primary metric and target when they are omitted.

Examples:

### Problem interviews

Test whether the problem exists with sufficient frequency/severity.

### Cold outbound

Test whether pain-led messaging creates qualified responses.

### Landing page

Test whether a concrete promise produces a measurable action.

### Pricing

Test price acceptance rather than generic interest.

### Concierge

Deliver the result manually before automating it. This separates demand risk from engineering risk.

### Presale / paid pilot

Strongest early commercial evidence because the customer must commit money rather than merely express interest.

## 5. Record real experiment outcomes

Use:

```text
record_validation_result
```

Results can include:

- sample size
- responses
- positive responses
- interviews
- signups
- paid commitments
- revenue
- pipeline value
- conversion rate
- evidence URLs
- learning
- next step

Each result also has one explicit verdict:

```text
supports
mixed
refutes
inconclusive
```

### Important paid-signal rule

Creating a `presale` or `paid-pilot` experiment does **not** count as commercial proof.

A paid signal exists only when the recorded result contains:

- at least one paid commitment, or
- actual revenue

This prevents a planned commercial test from being mistaken for validated demand.

## 6. The live decision engine

The workspace decision score combines:

```text
research quality             50% once validation exists
real-world validation        35%
founder/team fit             15%
```

Before any experiment is complete, the system treats the opportunity as research-only and does **not** return `build`.

Experiment scoring considers:

- supports/mixed/refutes/inconclusive verdict
- sample depth
- positive-response ratio
- conversion rate
- paid commitments
- revenue
- pipeline
- experiment type

Presales and paid pilots receive higher evidentiary weight, but they still require actual observed results.

### Build gate

The current deterministic build gate requires all of the following:

1. combined decision score >= 78
2. at least two completed validation experiments
3. at least one actual paid/commercial signal

Therefore:

```text
excellent research + no validation          → Validate
excellent research + interviews only        → Validate / Watch
strong research + contradictory experiments → Watch / Stop
strong research + repeated proof + payment  → Build
```

This is intentionally conservative.

## 7. Negative evidence is durable

If several experiments refute the thesis, the validation score is capped.

If real customers reject the idea, the correct outcome may be:

```text
Stop
```

The platform should preserve that result. Do not rewrite the experiment as a success or create a new opportunity solely to avoid recording a failure.

A stopped thesis is valuable market knowledge.

## 8. Execution pack

Use:

```text
get_opportunity_execution_pack
```

It returns the full workspace plus field contracts for:

- opportunity strategy
- validation experiments
- build spec
- GTM plan

This is the recommended context packet for Codex/Claude when moving an opportunity forward.

Example host instruction:

```text
Load this Opportunity OS workspace with get_opportunity_execution_pack.

Review the original evidence, research score, current strategy, founder fit and every validation result.

Do not assume the opportunity should be built. If the current recommendation is validate/watch/stop, respect it and design the next experiment or reframe the thesis.

If the opportunity has earned a build recommendation, create the smallest build spec that tests the core JTBD and then create a concrete first-10-customer GTM plan.
```

## 9. MVP / build specification

Use:

```text
submit_build_spec
```

The spec supports:

- product name
- one-line promise
- target persona
- core JTBD
- scope in
- scope out
- user stories
- functional requirements
- non-functional requirements
- architecture
- data entities
- API endpoints
- integrations
- milestones
- acceptance criteria
- open questions

The spec should be deliberately narrower than the imagined mature product.

A good first spec optimizes for:

```text
short time to learning
+ enough functionality to deliver the validated outcome
- platform features that are not required for the first customer
```

## 10. First-customer GTM

Use:

```text
submit_gtm_plan
```

The GTM plan contains:

- first-customer profile
- buyer trigger events
- prospecting criteria
- channels
- outreach angles
- offer
- CTA
- proof required
- first-10-customer sequence
- objections
- partnership angles

The purpose is not a broad marketing plan. It is a concrete path to the first customers who experience the validated pain.

## 11. Portfolio view

Use:

```text
list_opportunity_workspaces
```

or the browser **Founder / Product Opportunity OS** workspace.

The portfolio displays:

- total opportunity workspaces
- Build / Validate / Watch / Stop counts
- current decision score
- research score
- validation score
- founder fit
- completed experiments
- paid signals
- recorded revenue
- pipeline value
- current lifecycle stage
- strategy summary
- build-spec status
- first-customer GTM status

This allows opportunities from different markets to compete for limited builder time.

## 12. Lifecycle stages

```text
research
validation
specification
gtm
building
watch
stopped
```

Use:

```text
set_opportunity_stage
```

Stage is an explicit execution state, not a claim that the opportunity is good.

For example, `building` should be set because the team chose to commit engineering effort, not because a model generated a high score.

## 13. Recommended agent workflow

After a completed research run:

```text
get_research_quality_summary
        ↓
create_opportunity_workspace
        ↓
get_opportunity_execution_pack
        ↓
submit_opportunity_strategy
        ↓
submit_founder_fit_assessment
        ↓
create_validation_experiment
        ↓
run experiment in the real world
        ↓
record_validation_result
        ↓
inspect live decision
        ↓
repeat experiments
        ↓
if BUILD:
  submit_build_spec
  submit_gtm_plan
  set_opportunity_stage(building) when the team actually commits

if VALIDATE:
  run the next uncertainty-reducing experiment

if WATCH:
  park it until new evidence appears

if STOP:
  preserve the negative learning and move on
```

## 14. MCP tool map

```text
create_opportunity_workspace
list_opportunity_workspaces
get_opportunity_workspace
submit_opportunity_strategy
submit_founder_fit_assessment
create_validation_experiment
record_validation_result
get_opportunity_execution_pack
submit_build_spec
submit_gtm_plan
set_opportunity_stage
```

These sit after the existing research and quality-intelligence tools.

## 15. What this changes about the platform

Before Opportunity OS:

```text
Research → ranked opportunity
```

Now:

```text
Research
  → quality challenge
  → opportunity
  → explicit strategy
  → real-world tests
  → evidence-weighted decision
  → build spec
  → first-customer GTM
  → outcomes
```

That closes the most important gap in an automated founder-research system: the difference between **finding an interesting problem** and **earning the right to build a product**.
