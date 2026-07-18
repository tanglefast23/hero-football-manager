# 10 — Roadmap & Risks

Solo-dev milestones, each ending in something playable. Estimates assume part-time solo pace; treat as relative sizes, not promises.

## M0 — "Is watching + tapping fun?" (2–3 weeks) — THE GATE

Build the smallest thing that answers the riskiest question.

- sim/ core: two hardcoded teams — **your 2 heroes vs. 1 rival hero** (all 3 launch powers covered, license cap respected, opponent threat tested) — full match loop, in-flight passes, stats math, seeded determinism with a replay envelope.
- Skia renderer with **Atlas from day one**, rendering the real **B+ heroic-chibi sprite pack** (all 22 players hand-designed, stars visually distinct, 2-frame run cycles — produced as a concurrent workstream) plus **cheap telegraphs** (possession ring, wind-up pulse, power trails, ignite marker). Polish is part of what's being tested — a fire power on a gray rectangle under-tests the fantasy. Budget-Android stress test on the worklet-driven render path.
- 3 powers with Hero Gauge, per-power **useful contexts**, tap-to-fire (100%) / contextual auto (85%) / lapse (75%), interruptible wind-ups.
- Acceptance tests: parity (untapped watch == Quick Result), **causal divergence** (a tap changes possession/shots/score, not just event bytes), **timing-value** (context-aware firing must outperform context-blind firing over 200 seeds), golden replay with full payloads.

**Gate**: hand the phone to 3 people and ask three questions — "What just happened?" (comprehension), "When should you tap?" (decision legibility), "Was the rival's power scary but fair?" (threat + counterplay). If they can't answer, or nobody smiles, we redesign the match layer before building anything else.

> **✅ GATE PASSED — 2026-07-18** (owner's on-device verdict after live play on iPhone: "I like the fun gate, it's passed"). The In-the-Zone tap model reads clearly, the rival Super Strength threat lands as scary-but-fair, and the match is a charming payoff screen. Post-gate polish then shipped on top (engine m0.6): positional-table team movement, GK angle-narrowing, side-split hero cards, 27 SFX + match theme, the Caped Ball app icon, and the ball-at-foot render fix. M1 is now unblocked.

Scope of this gate, stated precisely: M0 judges whether the match is a **readable, charming payoff screen** — not whether the game is fun. Management sims earn most of their fun in the building loop (training nobodies into heroes, economy pressure, collection), which is industry-proven and gets its own verdict at M1's two-season slice, where matches and management are finally judged together. M0 exists because "auto-played soccer with tappable superpowers" is the one unproven bet; it must clear the bar of "worthy payoff for the loop," nothing more.

## M1 — Two-season hero vertical slice (4 weeks) — THE SECOND GATE

The second existential question — "does *managing heroes* stay fun across seasons?" — gets answered before any breadth is built. One division, 10 teams, two compressed seasons, containing exactly one of everything that defines the game:

- One awakening event chain (risk choices + pity counter) → a third hero competing for 2 license slots.
- One contract renewal crossing the **hero wage cliff** (the awakened-bargain dilemma, felt end to end).
- Training v1 (focus drills + TP), money v1 (wages, tickets, one sponsor, prize money, itemized statement), one facility decision.
- Save/load (sqlite + migrations, replay envelopes persisted); worklet-driven match renderer migration.
- **Mini balance harness in CI from this milestone** (season bankruptcy rate, TP affordability, awakening cadence).
- First real sprite set (B+ heroic chibi, one kit) + vertical pitch.

**Gate**: play both seasons twice. If the license-slot competition, the wage cliff, and the awakening chase don't generate "one more season" pull, fix the loop before widening it.

## M2 — The management game (4 weeks)

- Facilities grid + adjacency, scouting + transfers + valuations, contracts + mood-meter negotiation + Pitch Cards, coach system, morale/condition, aging + retirement + legacy.
- All five divisions + National Cup; opposing squads generated with division-appropriate strength.

## M3 — Heroes at full depth (3 weeks)

- Event system fully data-driven + ~15 events; guaranteed Season-1 second-hero chain.
- Full 12-power catalog with per-power contexts, Hero Essence + upgrades, license slot growth, pre-powered scouted heroes.
- Balance harness expanded to the full doc-09 assertion set.

## M4 — Content & polish (3–4 weeks)

- ~30 events, portrait paper-doll system + customization variety, comic cut-in art pass, sound + haptics, tutorial/onboarding fiction, accessibility settings, Cozy/Chairman difficulty, season awards + recap.
- Balance passes driven by harness + human playtests.

## M5 — Beta & launch (2 weeks)

- TestFlight via the house local-Xcode pipeline; 2 feedback rounds.
- Store listing (name decision, screenshots, $0.99), privacy labels (trivial: no data collected).
- Launch iOS. Android + PC spike scheduling based on reception.

## Top risks

| Risk | Mitigation |
|---|---|
| **Match isn't fun to watch** (the existential one) | M0 gate before any management work; Aura/Inazuma precedents say the mechanic works — our job is pacing + readability |
| Art volume (customization × animation) | Paper-doll layers on chibi frame counts (chosen for exactly this); portraits carry detail, pitch sprites stay simple |
| Balance sprawl (3 currencies, powers, wages) | Deterministic harness makes tuning measurable; tuning tables live in one content file |
| Skia perf trap (per-sprite components) | Atlas-first architecture + real-device stress test inside M0 |
| Solo-dev scope creep | Pillars test every feature; power count hard-capped at 12 for launch; "Explicitly out" list in doc 09 |
| PC port uncertainty | Deferred by design; sim/game purity guarantees worst case is re-hosting the renderer, not a rewrite |

## Post-launch candidates (unordered, earn their way in)

Android release · PC/Steam spike · New Game+ (legacy carryover) · power expansion packs (events + powers as content drops) · async friend leagues · Hero Essence sinks (cosmetic power colors) · localization.
