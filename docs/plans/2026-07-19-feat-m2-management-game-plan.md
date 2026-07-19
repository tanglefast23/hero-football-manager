# M2 Management Game Implementation Plan

**Status:** Implemented on 2026-07-19 after the M1 gate passed. Final verification is recorded below.

## Goal

Turn the two-season vertical slice into the long-running management game: a
five-division career with a National Cup, a meaningful club grounds puzzle,
staff and transfer markets, full contract talks, and players who age into club
legends.

## Phase 1 — Deterministic management domains

- [x] Add the 8x6 facilities grid with build, upgrade, move, upkeep, and adjacency discoveries.
- [x] Add scouting missions, transfer valuations, transfer windows, and buy/sell quote rules.
- [x] Add three-round contract talks with mood, perks, Pitch Cards, and the +/-20% influence cap.
- [x] Add the coach market, specialties, division/fame gates, progression, and legend candidates.
- [x] Add the five-division pyramid, division-scaled opposition, promotion/relegation, and National Cup.
- [x] Add morale, condition, aging, retirement announcements, and both legacy choices.

## Phase 2 — Career, save, and economy integration

- [x] Extend plain-data career state and launch reconciliation without breaking older saves.
- [x] Wire facility upkeep/bonuses, coach wages, morale, condition, scouting clocks, and cup rounds into the weekly/season clock.
- [x] Remove the two-season completion boundary and advance careers through the pyramid.
- [x] Persist M2 state through the existing schema-versioned repository and verify save/load round trips.
- [x] Add deterministic integration tests and M2 balance rails.

## Phase 3 — Player-facing management screens

- [x] Replace the Club placeholder with facilities and staff management.
- [x] Open the Market tab for scouting, transfers, youth intake, and contract negotiations.
- [x] Expand Squad player cards with morale, condition, age, personality, potential, and contract state.
- [x] Expand League with division navigation and the National Cup bracket.
- [x] Add season-end aging, retirement, legacy, promotion, and relegation decisions.

## Acceptance Criteria

- The same seed and player choices produce byte-identical management state.
- `src/game` remains pure TypeScript with no content or platform imports.
- Every division has 10 clubs and division strength rises gradually without rubber-banding.
- The National Cup contains all divisions and advances a stable knockout bracket.
- Pitch Cards can help or hurt an offer but never move the effective ask by more than 20%.
- Facilities never overlap or leave the 8x6 grid, and all money/upkeep changes are itemized.
- Older M1 saves load safely with deterministic M2 defaults.
- Focused Jest, full Jest, and TypeScript checks pass before M2 is treated as integrated.

## Final verification

- `npx tsc --noEmit`
- Focused M2 regression: 26 suites, 135 tests
- Full regression: 102 suites, 677 tests, 3 snapshots
- `npm run export:web` (Expo web bundle + self-contained SQLite worker)
- Final multi-agent audit: no remaining M2 blocker

## Canon

- `docs/02-core-loop.md`
- `docs/05-players-training-coaches.md`
- `docs/06-economy.md`
- `docs/08-ui-ux.md`
- `docs/09-tech-stack.md`
- `docs/10-roadmap.md`
