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

## Determinism rules (non-negotiable, enforced by lint + tests)

1. No `Math.random`, `Date.now`, or `new Date()` inside sim/ or game/ — a seeded PRNG (mulberry32) is injected; the seed is stored in the save per match/season.
2. Fixed timestep (100ms ticks); positions on an integer centimeter grid (no float drift across platforms).
3. Golden replay tests: recorded seeds must produce byte-identical event streams on every platform and every release (or the save-version bumps consciously).

## Testing strategy

- **Unit**: sim actions (tackles, shots, gauge math), economy functions, negotiation math — Jest, TDD for sim/ and game/.
- **Balance harness** (the deterministic core's superpower): headless Monte Carlo — simulate 1,000 seasons per candidate tuning table in CI, assert the design promises: "zero-hero club reaches Div 3 by season 4 (median)", "season-1 bankruptcy rate < 2% on Cozy", "hero win-rate uplift 15–25%", "awakening pace ≈ 1 per 1.5–2 risk-taking seasons". Balance changes become measurable, not vibes.
- **Render smoke**: Atlas stress scene on a real budget Android device at M0 (research risk #1) — gate before building more match UI.
- Standard house rules apply: `npm test` after changes, lint before commit, both web and native checked for UI work.

## Performance budget

60fps match on iPhone 12 / mid-range Android; cold start < 2s; app < 60MB. Sprite art via texture atlases; portraits pre-composited from paper-doll layers at save time (cache), not per-frame.

## Explicitly out (YAGNI at launch)

No server, no accounts, no analytics SDK, no cloud saves (Supabase backup = post-launch option), no multiplayer. Offline-first premium app.
