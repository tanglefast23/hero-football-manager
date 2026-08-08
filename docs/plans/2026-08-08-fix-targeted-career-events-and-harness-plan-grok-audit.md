---
title: "Grok audit: Complete targeted career events in the game and Dev Harness"
type: audit
date: 2026-08-08
model: grok-4.5
effort: high
status: passed
plan: docs/plans/2026-08-08-fix-targeted-career-events-and-harness-plan.md
---

# Grok audit — targeted career events completion plan

## Method

The exact named plan was reviewed through the bundled read-only Grok audit workflow at
high effort before any production implementation. The scope asked Grok to hard-gate
correctness, minimal scope, architecture, deterministic RNG, target rules, store/UI wiring,
persistence, outcome copy, chain behavior, both Harnesses, verification, and dirty-checkout
isolation.

Preflight proved:

- CLI: `grok 0.2.118`;
- login: grok.com session;
- model: `grok-4.5` available and selected;
- no `XAI_API_KEY` was passed;
- audit mode: read-only named-file review.

Round 1 returned `FINDINGS`: one critical, three high, and one medium. Grok explicitly said
its evidence pack did not inspect repository source, so every finding below was checked
against the live repository before changing the plan.

## Round 1 findings and local disposition

| Severity | Finding | Local verification | Disposition |
|---|---|---|---|
| Critical | An already-pending targeted event with zero candidates could remain a disabled dead card | Confirmed. Existing reconciliation only drops an event id missing from the catalog; it does not repair invalid/missing targets | Accepted. The plan now mandates load/restore reconciliation, no-effect dismissal for unresolved zero-candidate cards, locked-sequel skipping, and direct resolver validation |
| High | Specialty filtering was ambiguous across choices/outcomes | Confirmed as a plan ambiguity. The approved spec selects a target before a choice and explicitly excludes a coach already holding GOALKEEPING | Accepted. The plan now locks event-wide filtering when any outcome adds specialty S, and requires the same rule in offer, picker, store, resolver, and both Harnesses |
| High | Save/load behavior for valid, unlocked-invalid, and locked-missing targets was not a complete matrix | Confirmed. `.passthrough()` preserves current fields but does not define recovery semantics | Accepted. The plan now names every persistence/reconciliation cell and its test |
| High | Risky success/miss steering lacked a bound and formal branch-existence rule | Confirmed as a plan omission. The current visible Harness already has `RISK_SEARCH_LIMIT = 512` | Accepted. The plan now defines positive authored weight as existence, searches counters 0…512 in ascending order, mutates only `riskyChoices`, and fails explicitly if unreachable |
| Medium | The plan overstated dirty rival-intro work because Grok's evidence pack appeared clean | Rejected. Fresh live evidence showed 20 tracked modifications and 18 untracked paths, with target-file overlap; `HEAD`, `origin/main`, and merge base all remain `b46a841d…` | Rejected as an evidence-pack limitation. The plan records the fresh counts and keeps mandatory isolated-worktree controls |

## Round 1 changes to the plan

- Added mandatory pending-target reconciliation and no-soft-lock behavior.
- Defined the event-wide coach-specialty candidate rule.
- Added a concrete persistence/recovery matrix.
- Defined deterministic risky-branch search bounds and explicit failure behavior.
- Added fresh dirty-tree evidence and explained why Grok's provenance warning was not
  accepted.

No production file was modified during this round.

## Round 2

The revised exact plan was audited again at high effort. Grok confirmed that the
event-wide specialty rule, 0…512 RNG steering bound, and dirty-worktree isolation were
closed. It returned two high findings and one medium finding around recovery completeness:

| Severity | Finding | Disposition |
|---|---|---|
| High | Load-only reconciliation still allowed a rendered zero-candidate empty state with no exit | Accepted. One shared helper is now mandatory before every store transition into `screen: 'event'` and before resolution; the defensive empty state now has a guarded no-effect “Return to the office” action |
| High | Strictly validating newly explicit optional fields could reject a save before semantic recovery | Accepted. The plan now requires fail-soft parsing of malformed optional coach/facility target fields, followed by semantic reconciliation |
| Medium | A direct invalid-target resolution rejection had no defined store recovery | Accepted. The store now preflights and, on that specific rejection, applies no effects and deterministically clears for re-pick or dismisses when zero candidates remain |

No production file was modified during round 2.

## Round 3

The next exact-plan audit found one critical and one high stale-save edge case:

| Severity | Finding | Disposition |
|---|---|---|
| Critical | A locked target could still exist but be illegal while another candidate remained, so neither zero-candidate dismissal nor re-picking applied | Accepted. Any missing **or illegal** locked target now skips with no effects even if alternatives exist; it is never unlocked and recast |
| High | Tolerant parsing of a malformed lock could leave a valid carried part two editable | Accepted. Reconciliation now derives carried-only events from the validated incoming `nextEventId` graph (plus the carried hat-trick milestone), restores the lock around a valid inherited target, and skips an absent/illegal one |

No production file was modified during round 3.

## Round 4

The blocker-only audit found two remaining ordering/wording contradictions:

| Severity | Finding | Disposition |
|---|---|---|
| High | A fail-soft carried event could reach ordinary unlocked re-pick before carried-only classification | Accepted. Reconciliation is now a numbered decision procedure: resolved-result handling, then carried-only classification and lock/skip, then other locked handling, and only then ordinary unlocked re-pick |
| High | Some continuation criteria still said “missing” rather than the canonical “missing or present-but-illegal” predicate | Accepted. Observable success, resolved continuation, Phase 1 tests, QA matrix, and acceptance now all use membership in the shared legal candidate set as the only predicate |

No production file was modified during round 4.

## Round 5

The final contradiction-only audit returned `NO_CONFIRMED_FINDINGS` and an explicit
`PASS`. Grok verified that the ordered reconciliation procedure handles resolved results
before carried-only events, handles carried-only events before ordinary unlocked re-pick,
skips every missing or present-but-illegal carried/locked target even when alternatives
exist, restores a valid carried lock, and uses the shared legal-candidate predicate
consistently in success criteria, continuation, tests, QA, and acceptance.

The plan is approved for implementation. No production file was modified during any audit
round.
