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

### Weekly Review

Settling a non-match week always opens **Week N Complete** before the next management desk. The money block stays at the top beside the current cash total: the weekly net counts from zero to its signed value, followed by the exact cash-before → cash-after movement and itemized ledger. The center of the screen belongs to focused trainees: each player receives a joyful portrait reaction and their actual stat values count upward. Free squad conditioning is summarized once rather than repeating every player card.

Only relevant club notes appear below development: skipped focus training names the missing Money or TP, injury recovery, contract pressure, a newly available event, and a fixture that has just become current. The full sequence settles within 2–4 seconds; one tap completes all motion, and Reduce Motion renders final values immediately. On match weeks, the full-time result returns to Home first, then presents the accounts statement as a modal over the office. Continuing opens a separate celebration overlay over Home: focused trainees appear centrally, each positive stat pops in one at a time, and each reveal plays a short ding.

## Match Day flow

1. **Pre-match** (one screen): formation pitch with drag-swap lineup and hero license slot picker. Big buttons: **Watch** / **Quick Result**. The three quick-cycle formations and manual/automatic power control live in persistent Settings, reachable from both the title screen and management shell.
2. **Live match** (portrait vertical pitch): scoreboard bug top with speed and pause; a compact name + energy card stays fixed at bottom-left and retains the last carrier during passes, shots, and loose balls. A home hero glows in the Zone and is tapped directly on the pitch; rivals always run automatically. The bottom coaching bar has **Formation**, **Mentality**, and **Swap**: Formation taps cycle the three Settings presets with a large text overlay, Mentality cycles Balanced / Attack / Protect, and Swap pauses play for an on-field-player → bench-player → confirm flow with names and energy bars. Power cut-in: full-width comic panel, 2–3s, tap-to-skip after first view.
3. **Post-match**: full-time result and highlights → Home beneath an accounts statement modal (line-by-line count-up with a high-contrast semantic Net row) → focused-player development celebration with sequential stat pops and a ding per positive gain. One tap finishes all remaining motion.

## Feel (juice budget — restrained but present)

Haptics: power fired (heavy), goal (success), full gauge (light tick). Count-up tickers on money. Sprite squash-and-stretch on kicks. Confetti on promotion. No screen-shake spam; the comic cut-ins are the spectacle ration.

## Onboarding (first 20 minutes, tutorialized by fiction)

1. Create the manager's former high-school player with a bounded six-stat point buy. The campaign starts with **zero heroes**.
2. In the first club-office visit, assistant manager **Bert Rudge** establishes the step up from a national-championship high-school team to a professional club. He points out weekly wages, summarizes the five bottom-nav areas, and makes Home the player's reliable "what do I do next?" desk.
3. Bert follows the Kairosoft cadence: one short return, one relevant system, one concrete objective. The guided quick start is **Open Squad → train one player once → return Home → read the desk and Advance Week**. Each milestone is saved and never repeats after completion; all navigation cues are hard-limited to Season 1, Week 1 so an incomplete older save cannot resurrect them later. The guide does not hard-block other choices.
4. Match 1 has no powers. At the final whistle the created player collapses, the one choice-driven awakening resolves, and the created player becomes hero #1. Match 2 introduces using the new power. Later awakenings keep the general stat-weighted fitting rule.
5. Contracts, facilities, scouting and later systems are introduced only when their decisions become relevant. Tutorial text never attempts to explain the full game in advance and never blocks Quick Result.

The approved Bert design and full copy cadence live in [the assistant-manager brainstorm](brainstorms/2026-07-19-assistant-manager-tutorial-brainstorm.md).

## Accessibility

Colorblind-safe kit palette pairs (never red-vs-green matches); text scaling respected on management screens; reduce-motion setting = no cut-ins (banner only); all timing windows (fire window 8s) are generous by design; left/right-hand HUD flip.

## PC port posture

Management screens: same portrait column, centered, with keyboard shortcuts. Match view gains an optional landscape wide-pitch layout. Mouse hover = tap. Decided at the port spike (doc 10), designed not to be painted into a corner now (no gesture-only interactions anywhere).

## Visual mockups

The pixel-art direction mockups (B+ heroic chibi) from the planning session are the art north star. Proper screen mockups are an M1 deliverable — one per key screen, built with the real palette before UI code hardens.
