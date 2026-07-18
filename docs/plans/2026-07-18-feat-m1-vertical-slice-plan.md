---
title: "feat: Build the M1 two-season hero vertical slice"
type: feat
date: 2026-07-18
---

# M1 Two-Season Hero Vertical Slice

## Overview

Build the smallest complete management game that can answer M1's second gate:
does awakening, license competition, training, and the hero wage cliff create
"one more season" pull across two seasons?

M1 is a product milestone, not an automatic match-engine version. The current
`ENGINE_VERSION` remains independent and changes only when match behavior,
tuning, or RNG consumption changes.

## Scope

M1 includes one 10-team division, two 30-week seasons, 18 home-and-away league
matches per season, created-player onboarding, a powerless opening match, the
choice-driven tutorial awakening that makes the avatar hero #1, one later
stat-weighted awakening that makes hero #2 and fills the two license slots, one
hero-wage renewal, training v1, money v1, one facility decision, save/load, the
balance harness, and the production renderer migration.

Transfers, player sales, contract-negotiation cards, the full facility grid,
scouting, coaches, the full event catalog, and the 12/20-power expansion remain
M2/M3 work. This follows `docs/10-roadmap.md`; the older M0 handoff's broader M1
list is not authoritative where it conflicts.

## Architecture

- `src/game/` is pure TypeScript and may depend inward on `src/sim/`; it never
  imports React Native, Expo, Skia, wall-clock APIs, or ambient randomness.
- Persisted state contains plain serializable data only. Random outcomes use
  explicit seeds and generated values stored in state.
- Matchday is an explicit boundary: the game layer emits scheduled fixtures
  and seeds, while watched or quick-result matches return the same result shape.
- Derived standings are calculated from played fixtures instead of duplicated
  in mutable state.
- Clubs, powers, events, training, and onboarding copy live in typed JSON and are
  zod-validated before the career is created. New content stays out of executable
  game logic.

## Implementation Phases

### Phase 1 — Deterministic season spine

- [x] Add the serializable career, club, fixture, ledger, and result types.
- [x] Generate a deterministic 10-team double round-robin schedule with match seeds.
- [x] Implement `Advance Week` as manage → matchday → weekly settlement.
- [x] Apply wages, Season-1 subsidy, monthly sponsor income, home tickets, TP rewards, and final league prize.
- [x] Derive stable league standings and enforce the two-season M1 boundary.
- [x] Extend purity/import guards to cover `src/game/`.
- [x] Add focused tests for schedule integrity, financial order, standings, validation, and determinism.

### Phase 2 — Player growth and hero decisions

- [x] Add a bounded six-outfield-stat point-buy and persist the created player.
- [x] Script the powerless first match, collapse cut-in, three-origin choice, and hero #1 reveal.
- [x] Add persistent player/contract state and the sim-team adapter.
- [x] Add training plans, focus-drill costs, TP spending, and one facility choice.
- [x] Add awakening event choices, pity tracking, and deterministic outcomes.
- [x] Add two-slot match selection and the hero-#2 competition.
- [x] Add contract expiry, renewal, and the hero wage cliff.

### Phase 3 — Persistence and management UI

- [x] Approve and add zod, expo-sqlite, zustand, and the chosen styling dependency.
- [x] Add content validation plus schema-versioned SQLite migrations.
- [x] Add new/load game, Home, Squad, pre-match, post-match, finances, and season-end screens.
- [x] Persist replay envelopes and verify save/kill/relaunch/load continuity.

### Phase 4 — Gate readiness

- [x] Move the watched renderer's per-frame path fully onto worklets.
- [x] Add Node and Hermes golden replay checks.
- [x] Add season bankruptcy, TP affordability, and awakening-cadence harness rails.
- [x] Complete the one-kit vertical-pitch visual pass and required mockups.
- [ ] Play both seasons twice and record the M1 gate verdict.

## Phase 1 Acceptance Criteria

- The same setup and seed produce byte-identical career state and fixture seeds.
- Every pair of clubs plays exactly twice per season, once home and once away.
- Each club plays 18 matches, nine home and nine away.
- Advance Week pauses at matchday until every scheduled result is supplied.
- Weekly settlement applies visible ledger lines in the documented order.
- Season 1 pays the 50% wage subsidy; Season 2 does not.
- Standings sort by points, goal difference, goals scored, then stable club ID.
- Season 1 can roll into Season 2; completing Season 2 closes the M1 slice.
- `src/game/` passes purity, determinism, focused Jest, TypeScript, and full regression checks.

## Risks and Mitigations

- **Scope creep:** gate every task against the M1 question and defer breadth.
- **Save incompatibility:** keep state plain-data and version it before SQLite arrives.
- **Match/game coupling:** exchange immutable fixture/result records only.
- **Balance guesswork:** centralize first-pass constants and replace guesses with
  harness evidence before the M1 gate.

## References

- `docs/02-core-loop.md` — weekly order and 30-week season structure
- `docs/04-superpowers.md` — license slots and awakening pity
- `docs/06-economy.md` — income, wages, TP, and tuning targets
- `docs/07-events.md` — event timing and awakening rules
- `docs/09-tech-stack.md` — four-ring architecture and determinism
- `docs/10-roadmap.md` — canonical M1 scope and gate
