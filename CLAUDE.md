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

## Key design facts (don't re-litigate casually)

- Matches auto-play, 3–4 real minutes watched; heroes charge a Hero Gauge; user taps to fire (auto-fires at 75% after 8s). Quick Result always available and outcome-identical.
- Powers: 12 at launch, Hero License field caps (2→5), GK Resolve prevents one-shot goals, wind-ups are interruptible, cut-ins skippable after first view.
- Economy: Money + Training Points + Hero Essence — exactly one job each; no new currencies.
- Salaries weekly; awakened players keep old wage until renewal, then ×3–5 hero rates.
- Art: B+ "heroic chibi" pixel sprites + comic FX + broadcast dressing; paper-doll customization layers.
- Fail-soft economy (warnings → one loan → forced sale), never game over.
