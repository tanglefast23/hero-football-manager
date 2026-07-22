# 08 — UI / UX

Portrait, one-handed, thumb-first. The design language follows the house rules (60-30-10 color, ≤4 font sizes, 2 weights, 8pt grid, monospace numerals for all money/stats, full-card tinting — never colored edge stripes).

## Design language

- **60% neutral**: warm cream surfaces (dark mode: deep navy-charcoal) — the "clubhouse" canvas.
- **30% structure**: dark ink text/borders; pitch-green reserved for match surfaces.
- **10% accent**: **hero gold** — used *only* for hero/power elements (gauges, license slots, awakening moments, HE currency). The accent literally means "hero"; nothing else may use it. Semantic red/green only for money deltas and win/loss.
- **Action colour carries meaning, not decoration** (the shared families live in [11-art-style.md](11-art-style.md)): **violet** confirm/primary · **red** cancel/destructive · **blue** neutral action · **gold** hero/reward only · **grey** disabled. Button faces are the one place the palette is allowed to shout against the calm cream canvas; violet is therefore the primary-action colour across management screens (Advance Week, confirms, guided cards) and is not a second brand accent competing with gold.
- Pixel-art portraits and icons on clean flat UI (the Kairosoft contrast: crunchy sprites, calm chrome).
- Type: one UI sans (4 sizes: 13/15/18/24) + monospace for numerals. Weights: regular + bold only.

## Navigation & screen map

Bottom tab bar, 5 tabs; a persistent **Advance Week ▸** button lives above it on every management screen (the Kairosoft heartbeat button).

1. **Home** — club hub: next fixture card, cash/TP/HE strip, alerts (renewals due, event waiting, injuries), league position snippet.
2. **Squad** — roster list (sortable chips) → Player Card (large portrait with customization/paper-doll layers, stats + archetype caps, contract, morale, power panel with gauge history & upgrade button).
3. **Club** — facilities grid (build/upgrade/move with adjacency glows), staff (coach card, hire market), finances (ledger, sponsors, loan status).
4. **Market** — scouting missions, transfer listings, negotiation flow (mood face + Pitch Cards), youth intake.
5. **League** — named five-division ladder, current standings, fixtures/results, cup progress, and a live comparison between your squad strength and each division's club strength range.

Events interrupt as full-screen cards on Advance Week (never mid-match). Match Day replaces the shell entirely.

### Weekly Review

Settling a non-match week always opens **Week N Complete** before the next management desk. The money block stays at the top beside the current cash total: the weekly net counts from zero to its signed value, followed by the exact cash-before → cash-after movement and itemized ledger. The center of the screen belongs to focused trainees: each player receives a joyful portrait reaction and their actual stat values count upward. Free squad conditioning is summarized once rather than repeating every player card.

Only relevant club notes appear below development: skipped focus training names the missing Money or TP, injury recovery, contract pressure, a newly available event, and a fixture that has just become current. The full sequence settles within 2–4 seconds; one tap completes all motion, and Reduce Motion renders final values immediately. On match weeks, the full-time result returns to Home first, then presents the accounts statement as a modal over the office. Continuing opens a separate celebration overlay over Home: focused trainees appear centrally, each positive stat pops in one at a time, and each reveal plays a short ding.

## Match Day flow

1. **Pre-match** (one screen): formation pitch with drag-swap lineup and hero license slot picker. Big buttons: **Watch** / **Quick Result**. The three quick-cycle formations and manual/automatic power control live in persistent Settings, reachable from both the title screen and management shell.
2. **Live match** (portrait vertical pitch): scoreboard bug top with speed and pause; a compact name + energy card stays fixed at bottom-left and retains the last carrier during passes, shots, and loose balls. A home hero glows in the Zone and is tapped directly on the pitch; rivals always run automatically. The first coaching row has **Formation**, **Playstyle**, and **Swap**: Formation taps cycle the three Settings presets with a large text overlay, Playstyle cycles Balanced / Attack / Protect, and Swap pauses play for an on-field-player → bench-player → confirm flow with names and numeric energy. A second full-width **Energy Use** row directly selects **Save Energy / Balanced / All Out** and shows Team Energy. The active mode is unmistakably selected without relying on color alone. Swap's secondary label becomes `N TIRED · used/3` when players are at or below 40%, prompting the player to inspect exhausted off-ball teammates; the count remains visible after all three substitutions are spent. Power cut-ins can hold up to four simultaneous **home** activations: one full tile, two side by side, three as two-up/one-down, and four as a 2×2 grid. Rival activations use compact red banners instead of consuming tiles. Banners use the same newest-four overflow rule. First reveals hold for 1.55s; previously seen panels are skippable and hold for 1s.
3. **Post-match**: full-time result and highlights → Home beneath an accounts statement modal (line-by-line count-up with a high-contrast semantic Net row) → focused-player development celebration with sequential stat pops and a ding per positive gain. One tap finishes all remaining motion.

## Feel (juice budget — restrained but present)

Haptics: power fired (heavy), goal (success), full gauge (light tick). Count-up tickers on money. Sprite squash-and-stretch on kicks. Confetti on promotion. No screen-shake spam; the comic cut-ins are the spectacle ration.

### Interaction feedback contract

Every tappable management control has three layers: a visible pressed-state change, a short semantic sound, and an immediate state/result message. Sounds are grouped by meaning rather than assigned randomly: ordinary navigation and selections share the short tap; player, academy, and coach signings share one transaction confirmation; construction starts use the works-order cue; coach dismissal uses the departure whistle; facility completion alone uses the full win fanfare. Disabled controls visibly explain why they are unavailable rather than silently accepting taps.

Milestone transactions get a readable presentation rather than a transient toast: signings show the new player/coach sprite and name; coach dismissal shows severance before confirmation and a departure card afterward; facility starts say **“Sports facility in construction!”** with duration; completion appears at weekly settlement with the finished building sprite, **“Works complete!”**, and the win fanfare. Reduce Motion skips entrance movement but retains the final card, text, and sound.

## Onboarding (first 20 minutes, tutorialized by fiction)

1. Create the manager's former high-school player with a bounded six-stat point buy. The campaign starts with **zero heroes**.
2. In the first club-office visit, assistant manager **Bert Rudge** establishes the step up from a national-championship high-school team to a professional club. He points out weekly wages, summarizes the five bottom-nav areas, and makes Home the player's reliable "what do I do next?" desk.
3. Bert follows the Kairosoft cadence: one short return, one relevant system, one concrete objective. The guided quick start is **Open Squad → choose players and drills → save the first weekly plan → return Home → read the desk and Advance Week**. Each milestone is saved and never repeats after completion; all navigation cues are hard-limited to Season 1, Week 1 so an incomplete older save cannot resurrect them later. The guide does not hard-block other choices.
4. Match 1 has no powers. At the final whistle the created player limps, collapses, and automatically becomes hero #1 through the shared three-beat cutscene. There is no origin choice and no failure result. Match 2 introduces using the new power. Later matches use the same cutscene when their eligible 10% post-match check fires.
5. Recruitment is deliberately staggered. The story begins at **15/17 players**; Youth Intake appears in Week 3 and lets the manager choose one prospect, the National Cup briefing waits until Week 5, and scouting appears in Week 15 so its 2–3 week report lands for the Week 17–18 registration window. Signing that scout target fills 17/17, then Bert explains that future signings require a safe sale or release; the sale earns a fee and clears the departing wage. Hidden systems do not appear as disabled tabs before their reveal. Tutorial text never attempts to explain the full game in advance and never blocks Quick Result.

The approved Bert design and full copy cadence live in [the assistant-manager brainstorm](brainstorms/2026-07-19-assistant-manager-tutorial-brainstorm.md).

## Accessibility

Colorblind-safe kit palette pairs (never red-vs-green matches); text scaling respected on management screens; reduce-motion setting = no cut-ins (banner only); timing gives a 7-second Zone followed by a fixed 2-second armed window when the player commits early; left/right-hand HUD flip.

## PC port posture

Management screens: same portrait column, centered, with keyboard shortcuts. Match view gains an optional landscape wide-pitch layout. Mouse hover = tap. Decided at the port spike (doc 10), designed not to be painted into a corner now (no gesture-only interactions anywhere).

## Visual mockups

The pixel-art direction mockups (B+ heroic chibi) from the planning session are the art north star. Proper screen mockups are an M1 deliverable — one per key screen, built with the real palette before UI code hardens.
