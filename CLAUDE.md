# Hero Football Manager — Project Context

Kairosoft-style soccer club management sim with superpowered players. iOS-first (paid ~$0.99), Expo/React Native. Currently in planning → early build phase.

## Read first

- `README.md` — decision log + doc index. All design decisions live in `docs/01`–`docs/10`.
- `research/` — background research reports (Kairosoft economics, match presentation, stack analysis). Reference, not canon; the docs are canon.

## Non-negotiable architecture rules

- `src/sim/` (match engine) and `src/game/` (season/economy/events) are **pure TypeScript**: no React Native, Skia, or Expo imports, no `Math.random`/`Date.now` — a seeded PRNG (mulberry32) is injected. Everything in these rings must be Jest-testable headless and deterministic (same seed = byte-identical results).
- Match rendering uses react-native-skia's **Atlas batched API** — never one component per sprite (known perf trap).
- Game content (powers, events, drills, sponsors, archetypes, names) is typed JSON in `content/`, zod-validated. New content ships as data, not code.
- Balance changes must keep the CI balance-harness assertions passing (see `docs/09-tech-stack.md`).
- Any replay-affecting sim change (behavior, tuning, or RNG consumption) must bump `ENGINE_VERSION` in `src/sim/match.ts`. The golden-replay snapshot update is the forcing reminder — never update that snapshot without a version decision.

## Key design facts (don't re-litigate casually)

- Matches auto-play, 3–4 real minutes watched; heroes build Heat and semi-randomly enter "the Zone" (~7s fading window); user taps during the zone to fire at 100%, a missed manual window decays (no auto-fire); fire-when-ready heroes auto-fire in-context at 85%. One power active per team at a time; teammates' zones freeze while one runs. Taps are recorded inputs that genuinely change outcomes (deterministic = same seed + same inputs, NOT predetermined). Quick Result runs the same engine with heroes on auto behavior.
- Powers: 20 designed / at least 12 ship at launch (chosen at M4 by playtest), Hero License field caps (2→5), GK Resolve prevents one-shot goals, wind-ups are interruptible, cut-ins skippable after first view. Timing-sensitivity principle: effects are visible possession/geometry spikes, never stat smears.
- Economy: Money + Training Points + Hero Essence — exactly one job each; no new currencies.
- Salaries weekly; awakened players keep old wage until renewal, then ×3–5 hero rates.
- Art: B+ "heroic chibi" pixel sprites + comic FX + broadcast dressing; paper-doll customization layers.
- Fail-soft economy (warnings → one loan → forced sale), never game over.
