# 08 — UI / UX

Portrait, one-handed, thumb-first. The design language follows the house rules (60-30-10 color, ≤4 font sizes, 2 weights, 8pt grid, monospace numerals for all money/stats, full-card tinting — never colored edge stripes).

## Design language

- **60% neutral**: warm cream surfaces (dark mode: deep navy-charcoal) — the "clubhouse" canvas.
- **30% structure**: dark ink text/borders; pitch-green reserved for match surfaces.
- **10% accent**: **hero gold** — used *only* for hero/power elements (gauges, license slots, awakening moments). The accent literally means "hero"; nothing else may use it. Semantic red/green only for money deltas and win/loss.
- **Accessible green**: pitch-dark remains the turf/art shadow. Small semantic green copy and dark green UI stages use `pitch-ink` (`#265b30`), which keeps normal text at AA contrast against white, paper, pitch-light, and gold-light.
- **Action colour carries meaning, not decoration** (the shared families live in [11-art-style.md](11-art-style.md)): **blue** confirm/primary and neutral action · **red** cancel/destructive · **gold** hero/reward only · **grey** disabled. Button faces are the one place the palette is allowed to shout against the calm cream canvas; blue is therefore the primary-action colour across management screens (Advance Week, confirms, guided cards) and is not a second brand accent competing with gold. Violet is retired from the UI palette (2026-07-24).
- **User-facing numbers read as things the manager receives**: name the player or thing and show the result — never surface a raw negative modifier or penalty label (no "Fans −3").
- Pixel-art portraits and icons on clean flat UI (the Kairosoft contrast: crunchy sprites, calm chrome).
- Type: one UI sans with four semantic content sizes — caption 13, body 15, heading 18, display 24 — plus monospace for numerals. Weights: regular + bold only. Wordmark and decorative-glyph sizes are art geometry, not content levels; each exception must be named in `src/ui/ui-tokens.ts` and held by a source test.

## Navigation & screen map

Bottom tab bar, 5 tabs; a persistent **Advance Week ▸** button lives above it on every management screen (the Kairosoft heartbeat button).

1. **Home** — club hub: next fixture card, cash/TP strip, alerts (renewals due, event waiting, injuries), league position snippet.
2. **Squad** — roster list (sortable chips) → Player Card (large portrait with customization/paper-doll layers, raw stats, exact Archetype/Position training bonuses, Potential grade and SUPER chance, contract, morale, and power panel). Stats have no personal cap; a value of 999 is labelled as the universal maximum.
3. **Club** — facilities grid (build/upgrade/move with adjacency glows), staff (coach card, hire market), finances (ledger, sponsors, loan status).
4. **Market** — scouting missions, transfer listings, negotiation flow (mood face + Pitch Cards), youth intake.
5. **League** — named five-division ladder, current standings, fixtures/results, cup progress, and a live comparison between your squad strength and each division's club strength range.

Events interrupt as full-screen cards on Advance Week (never mid-match). Match Day replaces the shell entirely.

### Weekly Review

Settling a non-match week always opens **Week N Complete** before the next management desk. The money block stays at the top beside the current cash total: the weekly net counts from zero to its signed value, followed by the exact cash-before → cash-after movement and itemized ledger. The center of the screen belongs to focused trainees: each player receives a joyful portrait reaction and their actual stat values count upward.

Only relevant club notes appear below development: skipped focus training names the missing Money or TP, injury recovery, contract pressure, a newly available event, and a fixture that has just become current. The full sequence settles within 2–4 seconds; one tap completes all motion, and Reduce Motion renders final values immediately. On match weeks, the full-time result returns to Home first, then presents the **Financial Report** as a modal over the office: every statement amount reveals as a slot-machine digit reel (0.5 s per row, top to bottom), facility-multiplied income shows its base, ×N chip, and rolled-up total, and a 1-in-10 surge week turns the spin fiery and pops a pixel-art callout banner. A press lands the current row instantly — one row per press, drags scroll — and Reduce Motion renders every amount final immediately (surge banners still show, statically). Continuing opens a separate celebration overlay over Home: focused trainees appear centrally, each positive stat pops in one at a time, and each reveal plays a short ding.

## Match Day flow

1. **Pre-match** (one screen): formation pitch with drag-swap lineup and hero license slot picker. Big buttons: **Play** / **Quick Result**. The three quick-cycle formations live in persistent Settings, reachable from both the title screen and management shell.
2. **Live match** (portrait vertical pitch): scoreboard bug top with speed and pause; Seasons 1–2 expose **1× / 2×** playback, then the first watched match from Season 3 onward pauses for Bert's two-line veteran-coach introduction and permanently adds **3×**. A compact name + energy card stays fixed at bottom-left and retains the last carrier during passes, shots, and loose balls. A home hero glows as its Zone opens and fires automatically in context, exactly as rivals do. The first coaching row has **Formation**, **Playstyle**, and **Swap**: Formation taps cycle the three Settings presets with a large text overlay, Playstyle cycles Balanced / Attack / Protect, and Swap pauses play for an on-field-player → bench-player → confirm flow with names and numeric energy. A second full-width **Energy Use** row directly selects **Save Energy / Balanced / All Out** and shows Team Energy. The active mode is unmistakably selected without relying on color alone. Swap's secondary label becomes `N TIRED · used/5` when players are at or below 40%, prompting the player to inspect exhausted off-ball teammates; the count remains visible after all five substitutions are spent. A home power activation temporarily replaces the phone coaching dock—or the desktop left control rail—with a large player + power title in that team's jersey colour. It remains through the power, holds a completed state for 1.5 extra seconds, then returns the controls with a short exit animation. It never slows, pauses, or covers the pitch. Rival activations use compact red threat banners. All on-pitch power effects follow the Track-B pixel-art rules in doc 11 and must communicate the affected player and gameplay result without relying on the label.
3. **Post-match**: full-time result and highlights → Home beneath the **Financial Report** modal (row-by-row slot-reel reveal with a high-contrast semantic Net row and the RECORDED stamp slamming down at the end) → focused-player development celebration with sequential stat pops and a ding per positive gain. In the report, each press lands the currently spinning row on its final number; the sections below the statement animate concurrently and never wait for it. **Palette exception (narrow, 2026-08-06):** a surged income amount in the Financial Report keeps a permanent gold/orange/red fire tint in the pixel bold face, one size larger — the one place warm gold tones appear outside hero/power UI. It marks the surge fact after the animation ends; hero gold everywhere else still means hero/power only.

## Feel (juice budget — restrained but present)

Haptics: power fired (heavy), goal (success), full gauge (light tick). Count-up tickers on money. Confetti on promotion. No screen-shake spam; compact pixel effects are the spectacle ration and the pitch remains readable.

### Interaction feedback contract

Every tappable management control has three layers: a visible pressed-state change, a short semantic sound, and an immediate state/result message. Sounds are grouped by meaning rather than assigned randomly: ordinary navigation and selections share the short tap; player, academy, and coach signings share one transaction confirmation; construction starts use the works-order cue; coach dismissal uses the departure whistle; facility completion alone uses the full win fanfare. Disabled controls visibly explain why they are unavailable rather than silently accepting taps.

Milestone transactions get a readable presentation rather than a transient toast: signings show the new player/coach sprite and name; coach dismissal shows severance before confirmation and a departure card afterward; facility starts say **“Sports facility in construction!”** with duration; completion appears at weekly settlement with the finished building sprite, **“Works complete!”**, and the win fanfare. Reduce Motion skips entrance movement but retains the final card, text, and sound.

## Onboarding (first 20 minutes, tutorialized by fiction)

1. Create the manager's former high-school player with a bounded six-stat point buy. The campaign starts with **zero heroes**.
2. In the first club-office visit, assistant manager **Bert Rudge** establishes the step up from a national-championship high-school team to a professional club. He points out weekly wages, summarizes the five bottom-nav areas, and makes Home the player's reliable "what do I do next?" desk.
3. Bert follows the Kairosoft cadence: one short return, one relevant system, one concrete objective. The guided quick start is **Open Squad → train a player (the drill resolves on the tap) → return Home → read the desk and Advance Week**. Each milestone is saved and never repeats after completion; all navigation cues are hard-limited to Season 1, Week 1 so an incomplete older save cannot resurrect them later. This first week is the one place the guide does block: Advance Week refuses until a player has been trained, and then until the manager is back on Home or Club. Nothing else is blocked, and the block is gone from Week 2 on.
4. The opening live match arrives in **Week 3**, with Match 2 following in **Week 4**. Match 1 has no powers. At the final whistle the created player limps, collapses, and automatically becomes hero #1 through the shared three-beat cutscene. There is no origin choice and no failure result. Match 2 introduces using the new power. Later matches use the same cutscene when their eligible 10% post-match check fires. Later seasons retain their four-week preseason and begin league play in Week 5.
5. Recruitment is deliberately staggered. The story begins at **15/17 players**; Youth Intake appears in Week 2 and lets the manager choose one prospect, the Coaching Office prompt follows in Week 3 after the opening Training Pitch project completes, the Hero Cup briefing waits until Week 5, and scouting appears in Week 15 so its 2–3 week report lands for the Week 17–18 registration window. Signing that scout target fills 17/17, then Bert explains that future signings require a safe sale or release; the sale earns a fee and clears the departing wage. Hidden systems do not appear as disabled tabs before their reveal. Tutorial text never attempts to explain the full game in advance and never blocks Quick Result.

The approved Bert design and full copy cadence live in [the assistant-manager brainstorm](brainstorms/2026-07-19-assistant-manager-tutorial-brainstorm.md).

## Accessibility

Colorblind-safe kit palette pairs (never red-vs-green matches); text scaling respected on management screens; reduce-motion keeps the team-colour power title but removes its movement and sheen; no match input is timed at all, since a charged Zone holds without a countdown and fires on its own; left/right-hand HUD flip.

## PC port posture

Management screens: same portrait column, centered, with keyboard shortcuts. Match view gains an optional landscape wide-pitch layout. Mouse hover = tap. Decided at the port spike (doc 10), designed not to be painted into a corner now (no gesture-only interactions anywhere).

## Visual mockups

The pixel-art direction mockups (B+ heroic chibi) from the planning session are the art north star. Proper screen mockups are an M1 deliverable — one per key screen, built with the real palette before UI code hardens.
