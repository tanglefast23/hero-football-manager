# 10 — Roadmap & Risks

Solo-dev milestones, each ending in something playable. Estimates assume part-time solo pace; treat as relative sizes, not promises.

## M0 — "Is watching + tapping fun?" (2–3 weeks) — THE GATE

Build the smallest thing that answers the riskiest question.

- sim/ core: two hardcoded teams, full match loop, stats math, seeded determinism.
- Skia renderer with **Atlas from day one**; placeholder rectangles are fine, budget-Android stress test included.
- 3 powers (Super Speed, Super Strength, Fire Torch) with Hero Gauge + tap-to-fire + auto-fire.
- Quick Result parity test (same seed, same score).

**Gate**: hand the phone to 3 people. If watching a match and firing a power doesn't make anyone smile, we redesign the match layer before building anything else. Nothing in M1+ is worth building on an unfun core.

## M1 — One full season (3–4 weeks)

- Season loop: 10-team Div 5, fixtures, table, promotion; weekly tick.
- Money v1: wages, tickets, one sponsor, prize money, itemized post-match statement.
- Training v1 (drills, TP), squad screen, save/load (sqlite + migrations).
- First real sprite set (B+ heroic chibi, one kit) + vertical pitch.

## M2 — The management game (4 weeks)

- Facilities grid + adjacency, scouting + transfers + valuations, contracts + mood-meter negotiation + Pitch Cards, coach system, morale/condition, aging + retirement + legacy.
- All five divisions + National Cup; opposing squads generated with division-appropriate strength.

## M3 — Heroes at full depth (3 weeks)

- Event system (JSON-driven) + ~15 events including scripted first-awakening.
- Full 12-power catalog, Hero Essence + upgrades, license slots, pre-powered scouted heroes, hero wage cliff at renewal.
- Balance harness online in CI with the doc-09 assertions.

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
