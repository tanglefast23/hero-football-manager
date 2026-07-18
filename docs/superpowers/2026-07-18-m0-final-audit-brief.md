# M0 Final Re-Audit Brief

**Date:** 2026-07-18
**Audit target:** engine **m0.6**, branch `claude/hero-football-m0-handoff-75b9eb`
at the T8-merge tip `89e9c34` (the last functional commit; T9 wrap-up docs sit
on top and change no audited code). Not yet merged to `main`.
**Quality snapshot at target:** `npx tsc --noEmit` clean; `npx jest` = 19 suites
/ 136 tests / 3 snapshots green (~58s warm).
**Purpose:** outside second opinion before the M1 vertical slice begins. The M0
**fun gate has already PASSED** (owner's on-device verdict, 2026-07-18) — this is
an engineering correctness audit, not a re-litigation of the design.

## What changed since the last audit (main @ 734a6a8)

That audit (this session) verified m0.4 and found no P0/P1 defects. Everything
below shipped on top, each through two-stage subagent review (spec compliance
then code quality); the last two (T7, T8) were reviewed inline by the
orchestrator after the review agents were interrupted by a spend limit.

- **m0.5 — positional-table movement (T1):** SWOS-style 35-area phase tables
  (build-time generator + committed overrides + emitted JSON, drift-guarded),
  cell-center bilinear sampling, integer-mirror team-1 convention, staggered
  turnover blend, presser lease, dedicated kickoff layout. Two interpretive
  deviations from the spec letter are recorded and accepted in the spec's
  disposition ledger. Plus accepted audit riders: zone-knockout semantics fix,
  widened determinism guard, full import-specifier enforcement.
- **m0.6 — GK angle-narrowing (T7):** keeper sits on the goal→ball ray at a
  depth that grows as the ball nears, box-clamped. Own commit, own balance re-run.
- **Renderer:** side-split hero cards with availability guard (T2), worklet
  stress screen (T4), ball-at-foot offset (T8), audio wiring via expo-audio (T5),
  Caped Ball icon (T3), `DebugOverlay` behind a `__DEV__` toggle.

## Scope for this audit (same four axes as before)

1. **sim purity** — `src/sim` + the pure `src/render/interpolate.ts`: no
   RN/Expo/Skia imports, no `Math.random`/`Date.now`, no transcendental Math
   (injected PRNG + contest table + `sqrt`-of-integers only). New surfaces to
   check: `movement-table.ts` bilinear/mirror math and `gkTarget`'s ray math —
   both use only `+ − × ÷`, `round/min/max/abs`, and `dist` (sqrt of integers).
   The determinism guard and import-layers tests now police these; confirm they
   have no remaining holes (the `**` operator and side-effect/dynamic imports
   were closed this session).
2. **determinism / replay** — `validateEnvelope` coverage; ENGINE_VERSION
   discipline (m0.4→m0.5→m0.6, each bump paired with golden regeneration in the
   same commit); golden fingerprint integrity (the m0.6 golden shifted across
   ~1069 numeric lines, confirming GK narrowing is genuinely replay-affecting).
   Movement bookkeeping (`state.movement`) is derived, excluded from the
   envelope, and included in determinism double-runs — verify that split holds.
   **Zero new RNG draws** in movement or GK (7 draw sites, unchanged) — re-audit.
3. **zone/heat model + gates** — the In-the-Zone state machine in
   `src/sim/powers.ts` (knockout mid-zone now clears with missed-window
   semantics; tap loop guards availability); do the gates measure what they
   claim (paired seeds, bootstrap CI, no peeking)? Numbers in
   `docs/superpowers/m0-engine-metrics.md`. Known soft spot flagged for you:
   GATE-2 SUPER_SPEED measures positional value, not power value in isolation.
4. **renderer** — interpolation correctness, single-`<Atlas>` batching (no
   per-sprite components), per-frame allocation churn (the known steady-state
   ~70-object rebuild is logged for the M1 worklet migration), the audio
   fail-soft/lifecycle path, and the end-of-match hold.

## Known-and-logged (don't re-report as findings)

- Per-frame `useMemo` churn in `MatchScreen` (M1 worklet migration addresses it).
- GATE-2 speed-test altitude (2×2 redesign is a T10 backlog item).
- First-half stoppage slightly shortens the second half (bounded, cosmetic).
- Missing accessibility labels on Skia/Pressable UI (blocks UI-automation
  screenshotting; acceptable for M0).
- SE-class (667pt) screens overflow with the rival strip (pre-existing; T10).

## Ask

Numbered findings, severity P0–P3, `file:line` evidence, suggested fix — same
format as the prior audit. Flag anything in the four scoped axes. The binding
rules (gates are design problems never weakened; replay-affecting changes bump
ENGINE_VERSION; content ships as typed JSON; no new deps without discussion)
are non-negotiable — call out any violation as at least P1.
