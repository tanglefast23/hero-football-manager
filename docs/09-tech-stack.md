# 09 — Tech Stack & Architecture

Full comparison and sources: [research/stack-analysis.md](../research/stack-analysis.md). Decision below.

## The stack

| Layer | Choice | Why |
|---|---|---|
| App shell | **Expo (managed) + EAS**, TypeScript strict | Reuses the exact pipeline and skills already in daily use; 90% of this game is management UI |
| Match canvas | **@shopify/react-native-skia — Atlas API from day one** | Verified 10k+ sprite headroom on iPhone 12-class; our match needs ~25. The known trap is per-sprite components instead of batched Atlas — architect around Atlas from the first spike |
| Animation driver | react-native-reanimated v4 (+ react-native-worklets) | 60fps frame updates off the JS thread |
| UI state | zustand | Small, boring, fits |
| Saves | **expo-sqlite** (relational: players, contracts, fixtures, history) + MMKV only for tiny flags | Game data is inherently relational; migrations versioned per release |
| Styling | NativeWind (house rules apply: no className+style mixing, RN imports only) | Existing muscle memory |
| PC later | react-native-web + CanvasKit; **Electron** wrap for Steam (Steamworks JS libs support Electron, not Tauri) | Timeboxed spike after mobile ships; sim core portability makes worst case a re-host, not a rewrite |

Version policy: pin per EAS milestone; upgrade quarterly, never continuously (stack-drift is risk #3 in the research).

## Architecture: four rings, dependencies point inward only

```
┌────────────────────────────────────────────────┐
│ ui/        RN screens, navigation, NativeWind   │
│   ┌──────────────────────────────────────────┐ │
│   │ render/   Skia match renderer (Atlas),    │ │
│   │           interpolates sim snapshots      │ │
│   │   ┌────────────────────────────────────┐  │ │
│   │   │ game/   season, economy, events,    │  │ │
│   │   │         training, contracts (pure)  │  │ │
│   │   │   ┌──────────────────────────────┐  │  │ │
│   │   │   │ sim/   match engine (pure TS) │  │  │ │
│   │   │   └──────────────────────────────┘  │  │ │
│   │   └────────────────────────────────────┘  │ │
│   └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

- **sim/** and **game/** import nothing from React Native, Skia, or Expo. They are plain TypeScript packages testable in Jest on any machine. This is the load-bearing rule of the whole codebase.
- **render/** consumes the sim's event stream + tick snapshots and interpolates 100ms ticks into 60fps motion. The renderer can lag, drop frames, or not exist (Quick Result) without affecting outcomes.
- Content (powers, events, drills, sponsors, archetypes, name tables) lives in typed JSON under `content/`, validated by zod at build time.

## Determinism rules (non-negotiable, enforced by a guard test + golden replays)

1. No `Math.random`, `Date.now`, or `new Date()` inside sim/ or game/ — a seeded PRNG (mulberry32) is injected; the seed is stored in the save per match/season.
2. Fixed timestep (100ms ticks); positions on an integer centimeter grid.
3. **No transcendental Math in the sim.** IEEE 754 specifies +, −, ×, ÷, and `Math.sqrt` exactly (bit-identical on every JS engine), but `Math.exp`, `Math.pow`, `Math.hypot` etc. are implementation-defined and can differ across Hermes/V8/JSC near decision boundaries. Distances use `sqrt` of integer squares; the logistic contest curve ships as a **generated, checked-in integer lookup table** (regenerated only by an explicit script).
4. **Replays are envelopes, not just seeds**: `{ schemaVersion, engineVersion, seed, both team snapshots, ordered input stream }`. Seed + taps alone go stale the moment stats or tuning change; the envelope pins everything. Golden tests snapshot full event payloads, not just event names. (Mid-match save/resume — which would also need the PRNG cursor — is an M1 concern, deliberately out of M0.)
5. Golden replay fixtures must pass on every release; from M1, CI runs them on both Node and the Hermes runtime to catch engine drift, not just code drift.

## Testing strategy

- **Unit**: sim actions (tackles, shots, gauge math), economy functions, negotiation math — Jest, TDD for sim/ and game/.
- **Balance harness** (the deterministic core's superpower): headless Monte Carlo. Fast deterministic rails run in CI and guard the authored thresholds. Decision-grade 1,000-seed hero-value and long career probes remain explicit opt-in checks because they take 10–50 minutes each; they are run and recorded deliberately for balance milestones rather than hidden inside every automated suite. Balance changes become measurable, not vibes.

### Hero uplift acceptance band (revised 2026-07-22, supersedes "15–25%")

The old assertion was **15–25% win-rate uplift**. It was written before anyone
measured the shipped catalog, and measurement found powers sitting *below* even
that: **+0.3 to +0.6 squad points**, roughly a 6–12% uplift. Raising the bar to
15–25% would have locked in a hero you can barely feel, in a game named after
having one.

Express the target in **squad-point equivalence**, not a raw percentage — the
percentage moves with whatever baseline you measure against, the equivalence
does not. Near an even match, **1 squad point ≈ 8 percentage points of win
rate** (measured: even = 40% W / 23% D / 37% L; two points stronger = 23% W).

The initial calibration center was +2 for Tier-1 automatic play, +2.5–3 for a
good tap, and +4 for an upgraded good tap. The owner broadened the closeout
acceptance band after seeing the measured catalog: an individual power may be
worth roughly **+1 to +6 squad points** if it is clearly useful, reliably fires,
and performs its advertised football moment. No power may have a demonstrated
negative effect. Manual activation and upgrades must not have a statistically
established harmful reversal; they do not need to hit one exact number.

League and opening-run probes therefore test the real randomized first-hero
path instead of assuming every basic automatic power is exactly +2. The +2
value remains a useful design center, not a per-power release gate.

**Measurement discipline — two mistakes that produced confident wrong numbers:**

1. **Put each power on its designed carrier slot.** `powerIsCompatibleWithRole`
   only excludes keepers, so a "first eligible player" loop hands Super Speed to
   a centre-back and reports a dead power that is merely misassigned. Use the
   `CARRIER_SLOT` map in `src/sim/__tests__/power-cadence.test.ts`.
2. **Never set `controlledTeam` in a measurement harness.** It disables that
   team's automatic substitutions and energy management (`auto-coaching.ts`
   `automaticTeams`), so the side plays 90 minutes on tired legs and the result
   has nothing to do with what you were measuring.

Points-per-match carries a standard error of ~0.09 at 200 matches, so **a worth
difference under ~0.19 is noise.** Assert hero uplift at **1,000 seeds minimum**.
Firing counts are reliable at 200; worth values are not.
- **Render smoke**: Atlas stress scene on a real budget Android device at M0 (research risk #1) — gate before building more match UI.
- Standard house rules apply: run the available typecheck and test gates after changes, plus web/native checks in proportion to UI risk. This repository currently has no lint script, so lint is not claimed as a release gate.

## Performance budget

60fps match on iPhone 12 / mid-range Android; cold start < 2s; app < 60MB. Sprite art via texture atlases; portraits pre-composited from paper-doll layers at save time (cache), not per-frame.

## Explicitly out (YAGNI at launch)

No server, no accounts, no analytics SDK, no cloud saves (Supabase backup = post-launch option), no multiplayer. Offline-first premium app.
