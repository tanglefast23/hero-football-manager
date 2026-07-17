# 08 — UI / UX

Portrait, one-handed, thumb-first. The design language follows the house rules (60-30-10 color, ≤4 font sizes, 2 weights, 8pt grid, monospace numerals for all money/stats, full-card tinting — never colored edge stripes).

## Design language

- **60% neutral**: warm cream surfaces (dark mode: deep navy-charcoal) — the "clubhouse" canvas.
- **30% structure**: dark ink text/borders; pitch-green reserved for match surfaces.
- **10% accent**: **hero gold** — used *only* for hero/power elements (gauges, license slots, awakening moments, HE currency). The accent literally means "hero"; nothing else may use it. Semantic red/green only for money deltas and win/loss.
- Pixel-art portraits and icons on clean flat UI (the Kairosoft contrast: crunchy sprites, calm chrome).
- Type: one UI sans (4 sizes: 13/15/18/24) + monospace for numerals. Weights: regular + bold only.

## Navigation & screen map

Bottom tab bar, 5 tabs; a persistent **Advance Week ▸** button lives above it on every management screen (the Kairosoft heartbeat button).

1. **Home** — club hub: next fixture card, cash/TP/HE strip, alerts (renewals due, event waiting, injuries), league position snippet.
2. **Squad** — roster list (sortable chips) → Player Card (large portrait with customization/paper-doll layers, stats + archetype caps, contract, morale, power panel with gauge history & upgrade button).
3. **Club** — facilities grid (build/upgrade/move with adjacency glows), staff (coach card, hire market), finances (ledger, sponsors, loan status).
4. **Market** — scouting missions, transfer listings, negotiation flow (mood face + Pitch Cards), youth intake.
5. **League** — table, fixtures/results, cup brackets, season awards, Chemistry/adjacency Codex.

Events interrupt as full-screen cards on Advance Week (never mid-match). Match Day replaces the shell entirely.

## Match Day flow

1. **Pre-match** (one screen): formation pitch with drag-swap lineup, tactic (Normal/Short/Long), hero license slot picker, per-hero fire mode toggle. Big buttons: **Watch** / **Quick Result**.
2. **Live match** (portrait vertical pitch): scoreboard bug top; speed ×1/×2 + skip top-right; bottom row = hero chips (portrait + gold gauge ring, ≥44pt) that pulse and chime when full — tap to fire. Power cut-in: full-width comic panel, 2–3s, tap-to-skip after first view. Halftime sheet: subs/tactics.
3. **Post-match**: result banner → itemized income statement (line-by-line count-up with mono numerals) → TP/XP/fan gains → highlights ticker (tap any goal to replay).

## Feel (juice budget — restrained but present)

Haptics: power fired (heavy), goal (success), full gauge (light tick). Count-up tickers on money. Sprite squash-and-stretch on kicks. Confetti on promotion. No screen-shake spam; the comic cut-ins are the spectacle ration.

## Onboarding (first 20 minutes, tutorialized by fiction)

1. Cold open: you inherit the club mid-crisis; assistant coach walks you through one match (Watch, ×1) — you tap nothing yet.
2. Week 2: training plan + first sponsor signing (guided).
3. **Week 3 scripted event**: a mystery event awakens your first hero (guaranteed Super Speed on your best forward). Next match teaches the gauge tap with a slow-mo prompt.
4. Systems unlock progressively: facilities W4, scouting W6, Hero Lab mentioned only via rumor text until Div 3. Tutorial never blocks Quick Result.

## Accessibility

Colorblind-safe kit palette pairs (never red-vs-green matches); text scaling respected on management screens; reduce-motion setting = no cut-ins (banner only); all timing windows (fire window 8s) are generous by design; left/right-hand HUD flip.

## PC port posture

Management screens: same portrait column, centered, with keyboard shortcuts. Match view gains an optional landscape wide-pitch layout. Mouse hover = tap. Decided at the port spike (doc 10), designed not to be painted into a corner now (no gesture-only interactions anywhere).

## Visual mockups

The pixel-art direction mockups (B+ heroic chibi) from the planning session are the art north star. Proper screen mockups are an M1 deliverable — one per key screen, built with the real palette before UI code hardens.
