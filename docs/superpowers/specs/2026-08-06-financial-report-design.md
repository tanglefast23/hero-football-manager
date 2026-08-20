# Financial Report — post-match screen redesign

- **Date:** 2026-08-06 (revised through council round 3)
- **Status:** Historical. Buzz card requirements were retired when Buzz was removed on 2026-08-20.
- **Owner decisions locked:** screen scope, multiplier presentation, audio assets, straight-bonus economy (see §15)

## 1. Summary

The post-match "Match Summary" modal becomes the **Financial Report**: money is the star. The score and WIN/LOSS chip disappear (both already live on the Full-time Report screen that precedes this modal in the watched and Quick Result paths). Every ledger amount reveals itself as a slot-machine digit reel — half a second of fast spinning, then a snap onto the real number, row by row. Home gate and Fan Shop income gain real, seeded weekly variance with a 1-in-10 "surge" band that turns the spin fiery, lands bigger and bold, and pops a pixel-art callout banner (EXTREME ATTENDANCE! / TRENDING MERCHANDISE!). Facility-multiplied income reveals its math: base lands first, a ×N chip slides in, the digits roll up to the final total.

## 2. Goals and non-goals

**Goals**

- Make the weekly money moment legible, dramatic, and worth watching.
- Show *where* money came from: base × facility multiplier, visibly.
- Add real (not cosmetic) variance to gate and merch income, deterministically seeded, only where the player can see it.
- Keep the rest of the modal (warnings, buzz, TP/fans) present but subordinate, animating concurrently on their own clocks.

**Non-goals**

- No redesign of the Finances tab or its projections (they stay baseline, variance-free; one microcopy tweak in §6).
- No new currencies, no change to wages/upkeep/subsidy/sponsor/prize math.
- No change to the match sim (`src/sim/`) — `ENGINE_VERSION` does not bump.

## 3. What changes on screen

### Removed

- The home/away score row and the WIN/LOSS StatusChip. The Full-time Report screen (`PostMatchLedgerScreen`) already shows both in every path that reaches this modal (including the awakening detour, which returns to `postmatch` before the summary).

### Identity and layout order

- Header eyebrow stays **BACK AT THE OFFICE**; title becomes **FINANCIAL REPORT**.
- Panel kicker/title stay **ACCOUNTS OFFICE / MATCH STATEMENT**.
- The **RECORDED stamp is no longer visible at open**. It slams down (rotate + scale-in + thunk SFX) only after the net total lands. The report is not "recorded" until the accountant finishes.
- New order, top to bottom: statement panel (the star) → net cash change banner (inside the panel, as today) → "Dressing room / What moved" TP + Fans chips → buzz card → "Club desk / What needs attention" warnings → Continue button (fixed footer, unchanged).

## 4. The reveal sequence

### Row phases

A row passes through: **spin** (digit reels cycle) → **base land** (digits settle left-to-right, land pop, thunk) → for multiplied rows only: **chip slide-in** → **odometer roll** to the multiplied total → **adjacency roll** (merch with adjacency only, with its caption) → **complete**. A row is *complete* when its final amount, chip, and caption (where applicable) are all at rest.

**The next row starts 80 ms after the previous row completes.** That is the only inter-row rule. The net row is last; the stamp slam is part of the net row's completion.

### Timings

| Beat | Duration | Notes |
|---|---|---|
| Row spin | 500 ms | Per-digit vertical reels, fast cycle |
| Digit settle | 30 ms stagger per digit, left to right | The slot-machine "click-click-click" |
| Land pop | 120 ms, scale 1.0 → 1.06 → 1.0 | On the amount only |
| Multiplier chip slide-in | 150 ms | Multiplied rows, after base lands |
| Odometer roll | 200 ms | Digits roll upward from base to multiplied total |
| Adjacency roll | 150 ms | Merch rows with adjacency > 0, caption fades in alongside |
| Surge spin | 650 ms (500 × 1.3) | Replaces the 500 ms spin on surged rows |
| Net row spin | 650 ms | Always the last row |
| Stamp slam | 250 ms | After net lands; rotate −8° → 4°, scale 1.4 → 1.0 |
| Banner hold | 3000 ms | Auto-dismiss; banners queue FIFO (owner revision 2026-08-06, up from 2000) |

Rows not yet started show their label with a dimmed `$•••` placeholder at final width, so nothing shifts.

**Paired reveals for long ledgers (owner revision 2026-08-06):** statements with 8+ rows reveal their constant rows two at a time — one shared spin, both landing together on one thunk — while every reveal-carrying row (league gate, cup gate, merch) keeps its solo spotlight. Within each consecutive run of constant rows, rows pair in order and an odd run leaves its last row solo. A tap completes the whole current pair. Short statements are untouched.

### Digit reels

- Amounts render in the existing mono font. The sign, `$`, and commas stay static; each digit is a vertical reel cycling 0–9 fast during the spin.
- Spinning digits are tinted in the row's tone (green income, red expense) at reduced saturation; they hit full saturation on land.
- The reel always lands on the true saved amount — the UI never invents digits it must correct later (see §10).

### Input

- **A tap on the panel during any phase of a row jumps that row atomically to complete**: final amount shown, chip and caption visible, all of that row's timers and audio cancelled, one thunk plays. The next row starts 80 ms later. Repeated taps machine-gun through the report. A tap on the net row completes it and slams the stamp immediately — the amount-land and stamp slam coalesce into **one** thunk when reached by tap.
- **Skipping a surged row still enqueues exactly one banner** — the surge is information, and the skip only compresses the spin, never the fact.
- Taps are recognized as **presses** (Pressable `onPress`), not touch-starts — a drag that scrolls the modal never lands a row. This replaces today's `onTouchStart` "any touch completes all animation" behavior.
- The concurrent sections below the panel (§8) have no skip affordance — they finish within ~1 s on their own; this drops today's skip for them deliberately.
- Tapping does not dismiss a visible surge banner; banners auto-dismiss at 2 s and never block touches.
- After all rows are complete, panel taps do nothing. Close (×), backdrop, and Continue behave as today and stop all report audio.

### Reduce motion

With `reduceMotion`, every amount renders final immediately (chips and captions visible), the stamp is visible from the start, no spin audio plays, and a surge banner appears as a static card for 2 s (it is information, not decoration: it explains why a number is large).

## 5. Matchday income variance (real economy change)

### What varies, and when

Three ledger lines can roll, at settlement time in `src/game/career.ts`:

1. **League home gate** (home league weeks)
2. **Hero Cup home gate** (home cup weeks)
3. **Fan Shop merchandise** (weeks where an operational Fan Shop produces positive income)

**Variance rolls only on report-eligible settlements**: weeks whose settlement includes a played user fixture (league or cup, home or away), *excluding* the season's final settlement (`week === SEASON_WEEKS`), which routes to the season review instead of the summary modal. Quiet weeks and the season-final settlement bank the baseline amounts — so the Weekly Review screen and the Finances-tab projection never disagree with a number the report never presents. (Merch can therefore surge on an away-match week; the report shows it.)

"Report-eligible" is a guarantee about the settlement, not the player's eyes: the career saves immediately after settlement, so killing the app during the Full-time Report or awakening — or dismissing the report before rows land — preserves the varied cash but skips the show. That is accepted (low-scope decision, §15): the settled amounts remain visible as plain rows in the Finances statement, and no pending-report snapshot is persisted. The career save is never postponed for presentation.

Wages, coaching wages, facility upkeep, subsidy, sponsor, prize, training, loan lines: untouched and constant.

### The roll

Per line, per rolling week:

- 10% chance: **surge** — variance percent uniform integer in **+11…+20**.
- 90% chance: variance percent uniform integer in **−10…+10**.

Lines roll independently; a league/cup double-header week can have up to three surge-capable lines. A line whose raw base is 0 (e.g., a zero-fan gate) gets no reveal and can never surge — no EXTREME ATTENDANCE over $0.

The bonus band has no negative twin, so each **eligible rolled line** carries a pre-rounding EV of **+1.55%**. The aggregate long-run gate+merch uplift is smaller, because quiet-week and season-final merchandise stays baseline. Owner confirmed this straight bonus; the balance harness must still pass (§13).

**Balance-harness contingency (sanctioned in advance):** the opening-economy suite asserts hard zeros (no loans/forced sales/floor top-ups) over hundreds of seeds, and the −10% downside adds per-seed solvency risk the EV uplift does not offset seed-by-seed. If the suite fails under the full band, the sanctioned fallback is to clamp the **season 1** normal band to **−5…+10** (surge band untouched, later seasons untouched). Note the fallback raises season-1 per-eligible-line EV to **+3.8%** (0.9 × 2.5 + 0.1 × 15.5) — it deliberately trades a more generous season-1 average for the solvency floor. If it still fails, stop and raise to the owner — do not silently retune assertions or bands further.

### Determinism

- Each line derives its own PRNG: `mulberry32(mix(careerSeed, season, week, salt))`, where `mix` is a documented uint32 integer-mixing function and `salt` is a distinct constant per **variance source** — `league-gate`, `cup-gate`, `merch`. (Both gate lines share ledger kind `tickets`, so salts key off the source, not `LedgerLineKind`.) Uniform integers map via `Math.floor(rng() * span)`. This follows the derived-seed pattern in `src/game/event-clock.ts`.
- All money arithmetic keeps the existing checked-safe-integer helpers (`checkedMultiply`, `checkedAdd`, `requireSafeInteger`).
- Same career, same week → same roll, always. Reloading cannot re-spin. Quick Result banks the same money as a watched match.
- Rolls consume no RNG from any other system; no existing RNG stream shifts.
- Variance applies **only at settlement**. Projections (Finances tab `clubFinancesViewModel`, operating outlook) keep the baseline math.

## 6. The multiplier beat

Variance applies to the **base**, before the facility multiplier, so the on-screen math stays clean.

### League and cup home gate

```
attendance      = sixtyPercentOf(fans)
rawBase         = attendance × ticketPrice
variedBase      = round(rawBase × (100 + p) / 100)        // p = rolled percent
L               = combined operational Stadium Stand level
final           = variedBase + floor(variedBase × 50L / 100)
```

- Reveal shows: `variedBase` lands → chip **×(100 + 50L)%** slides in (e.g. ×150%, ×200%) → odometer rolls to `final`.
- The report renders a count suffix from operational stand *buildings*: "League home gate **· 2 stands**". Count in the display, combined level in the math — owner-chosen. **The suffix is UI-only, rendered from `reveal.facilityCount`; the persisted `line.label` is unchanged**, so the Finances tab is unaffected. No chip and no suffix when L = 0.

### Fan Shop merchandise

```
perLevel        = floor(fans / 2)                          // what one Lv1 shop makes
variedPerLevel  = round(perLevel × (100 + p) / 100)
N               = combined operational Fan Shop level
afterMultiplier = variedPerLevel × N
adjacency       = floor(afterMultiplier × merchIncomeBonusPercent / 100)
final           = afterMultiplier + adjacency
```

- Reveal shows: `variedPerLevel` lands → chip **×N** → odometer to `afterMultiplier`; if `adjacency > 0`, the adjacency roll follows with a quiet one-line caption ("+10% adjacency", from the persisted `adjacencyPercent`). One multiplier beat per row; the adjacency is a caption, not a second chip.
- Suffix "· 3 shops" from shop building count, UI-only as above. No chip/suffix when N = 1 and one shop.
- **Rounding change:** today's formula is `floor(fans × N / 2)`; the per-level form differs by at most `floor(N/2)` dollars. The baseline (variance-free) function changes to the per-level form too, so settlement, projections, and the on-screen math all agree. Affected tests update.
- **Finances-tab microcopy:** the four-week outlook labels gain a "typical" qualifier (e.g. "Next four weeks · typical"), so a settled surge/dip week differing from the projection reads as designed, not broken.

## 7. Surge events

### The fire spin

- The surged row spins 30% longer. During the spin the digits flicker gold → orange → red with a warm background wash sweeping the row.
- On land, the amount stays **one font size larger, bold, and fire-tinted permanently** — the surge remains legible after the dust settles (owner-approved default).
- Audio: `flame-up` one-shot at spin start, fire crackle loop under the spin, both stop at land; the normal thunk still plays.

### Callout banners

- After a surged row lands, a banner pops over the panel: pop-in (scale 0.2 → 1.0 with slight rotation), hold 3 s, fade. **The card shrink-wraps its content** (centered, padding only — never spanning the panel), and **shows the surge's extra money beside the headline** (e.g. "+$590"), computed against a typical 0% week by recovering the pre-variance base from the stored reveal (exact for the shipped bands; `surgeBonusAmount`, unit-tested). It never blocks touches, and later rows keep spinning beneath it.
- **EXTREME ATTENDANCE!** (gate surge, league or cup): a pixel crowd strip — five chibi fans, arms up, confetti pixels — drawn as Skia sprite runs in the style of `event-pixel-art.ts`.
- **TRENDING MERCHANDISE!** (merch surge): 4–5 toys drawn from a set of **10 merch sprites**: scarf, mini ball, foam finger, bobblehead, plush mascot, snow-globe stadium, boot keychain, jersey, trading-card pack, club mug. The subset is picked deterministically from season + week.
- Banners queue FIFO **in ledger order**, arbitrary length: a league/cup double-header plus merch can legally produce three. Each holds 2 s.

## 8. The rest of the screen (concurrent)

Everything below the statement animates from modal open, independent of the row sequence:

- **TP / Fans chips**: slide up + count up (existing count-up helper), small bounce on land.
- **Buzz card**: slide + fade entrance.
- **Warnings**: staggered fade-in; warning-tone cards get one 300 ms attention wiggle.

Nothing below the statement ever waits for the slot machine.

## 9. Audio

| Cue | Asset | Behavior |
|---|---|---|
| Spin bed | `progress.webm` (owner-provided) → `assets/audio/sfx/ledger-spin.wav` | Seek-to-0-then-play at each row's spin start; hard stop on land/skip. |
| Landing | `thunk.webm` (owner-provided) → `assets/audio/sfx/ledger-thunk.wav` | One-shot per land, and for the stamp slam. |
| Surge ignition | existing `assets/audio/sfx/flame-up.wav` | One-shot at surge spin start. |
| Surge bed | existing `assets/audio/sfx/flame-loop.m4a` | Low-volume loop during the surge spin only. |

- Owner source files live at `~/Library/Mobile Documents/com~apple~CloudDocs/sounds/` (`progress.webm`, `thunk.webm`); both convert to the project's wav format (pcm_s16le, 48 kHz, stereo — matching `flame-up.wav`).
- **A dedicated report audio controller owns all four cues** (new `src/render/financial-report-sfx.ts`), modeled on `src/render/audio.ts` rather than the management-SFX registry — the registry is one-shot-only, applies a single master volume, and its async `seekTo(0).then(play)` can resurrect audio after a cancel. The controller provides:
  - a generation/cancellation token around every async seek/play, so a landed or unmounted row can never start late audio;
  - a real loop player for the crackle (the pattern `FIRE_LOOP_SOURCE` uses in `audio.ts`);
  - per-cue gain multiplied by the user's master volume setting;
  - idempotent stop functions per cue and a stop-all wired to modal dismiss/unmount, registered with the audio lifecycle like other looping owners;
  - on lifecycle resume, the crackle restarts **only if the same generation is still actively spinning** — a suspend that outlives the row resumes to silence.
- **`App.tsx` wiring (touched module):** the app propagates master volume to every audio owner and tears each down separately; the existing effects gain `setFinancialReportSfxMasterVolume(...)` and `teardownFinancialReportSfx()` calls alongside their peers.
- `management-sfx.ts` is untouched — no registry append, no index-trap churn.
- The existing `playMatchStatementSfx` opening is a ~6 s one-shot sting, not a loop; it stays exactly as today and the new cues ride over it.

## 10. Data model and architecture

### Reveal metadata, persisted

The settlement computes the roll once and saves the breakdown; the UI replays saved truth and never recomputes money at display time (fans can change during the match, so a display-time recompute could disagree with what was banked).

```ts
// src/game/types.ts — discriminated by variance source; identity values stored explicitly
export type LedgerLineReveal =
  | {
      source: 'league-gate' | 'cup-gate';
      base: number;               // post-variance base the reel lands on first
      variancePercent: number;    // −10…+20; 11…20 iff surge
      surge: boolean;
      multiplierPercent: number;  // 100 + 50L; 100 when no stands
      facilityCount: number;      // operational stand buildings; 0 when none
    }
  | {
      source: 'merch';
      base: number;               // varied per-level income
      variancePercent: number;
      surge: boolean;
      multiplierTimes: number;    // combined shop level N ≥ 1
      facilityCount: number;      // operational shop buildings ≥ 1
      adjacencyPercent: number;   // merchIncomeBonusPercent at settlement; 0 if none
      adjacencyAmount: number;    // dollars added after the multiplier; 0 if none
    };

export interface LedgerLine {
  // …existing fields…
  reveal?: LedgerLineReveal;
}
```

Reconstruction invariant (enforced by settlement tests): gate `amount = base + floor(base × (multiplierPercent − 100) / 100)`; merch `amount = base × multiplierTimes + adjacencyAmount`. A line with raw base 0 carries no `reveal`.

### Touched modules

- **`src/game/career.ts`** — settlement-time variants of gate/merch income that derive their roll internally from persisted career data (`careerSeed`, season, week, source — the §5 seed contract) and return `{ amount, reveal }`; `settlementLines` attaches reveals per the §5 rolling rule. Baseline (variance-free) functions remain for projections; merch baseline moves to the per-level rounding (§6).
- **`src/persistence/game-state-codec.ts`** — the ledger schema is zod `.passthrough()` over whole-state JSON, so persistence works without changes. A malformed or inconsistent reveal must never brick the save **in either direction** — neither a hard reconstruction refinement nor schema rejection. Instead, a **fail-soft `sanitizeLedgerReveals` normalization pass** (alongside the codec's existing pre-validation normalizations) strips `line.reveal` — and only the reveal — when any of these fail: source agrees with the ledger kind; `variancePercent` is a **signed** safe integer in −10…+10 when `surge` is false and 11…20 when `surge` is true; `base` is a **positive** safe integer (zero-base reveals are stripped — they should never have been written); counts, multipliers, and adjacency values meet their source-specific constraints (gate: `multiplierPercent` ≥ 100 and `facilityCount` ≥ 0; merch: `multiplierTimes` ≥ 1, `facilityCount` ≥ 1, `adjacencyPercent` ≥ 0, `adjacencyAmount` ≥ 0 — all safe integers); reconstruction intermediates stay safe integers; gate/merch reconstruction equals the authoritative `line.amount`; merch `adjacencyAmount` equals `floor(base × multiplierTimes × adjacencyPercent / 100)`. The line and its amount always load and render generically. Reconstruction uses only the stored fields, so future formula changes cannot invalidate old reveals; if stored semantics ever change, add a new reveal variant rather than reinterpreting the old one. `GAME_SCHEMA_VERSION` does not bump: the field is optional and backward-compatible. Old saves render historical weeks without reveal dressing.
- **`src/application/view-models.ts`** — `postMatchViewModel` passes `reveal` through, plus explicit `settlementSeason` and `settlementWeek` fields (the banner toy-subset seed — never parsed out of an ID format). Finances-tab view models ignore reveals. Outlook microcopy per §6.
- **`src/ui/models.ts`** — the post-match ledger line view-model type gains the `reveal` field (post-match-specific; the Finances ledger line type is untouched).
- **`src/ui/PostMatchSummaryModal.tsx`** — rewired per §3; drops the score block; hosts the new statement component and the concurrent sections.
- **New `src/ui/components/FinancialStatement.tsx`** — the row-sequence state machine per §4 (phases, tap-to-complete, chips, adjacency caption, net row, stamp), timing constants in one place.
- **New `src/ui/components/SlotAmount.tsx`** — the digit-reel amount: spin mode, settle stagger, odometer-up mode. Plain RN `Animated`; no Skia needed for text.
- **New `src/ui/components/SurgeBanner.tsx`** — banner queue + pixel art (Skia `Canvas`/`Rect` runs, same approach as `EventPixelScene`).
- **New `src/ui/finance-pixel-art.ts`** — sprite runs: crowd strip + 10 merch toys.
- **New `src/render/financial-report-sfx.ts`** — the report audio controller per §9.
- **Dev harness** — new entry `financial-report` with scripted scenarios: no facilities; 2 stands + 3 shops; gate surge; merch surge; triple surge (league/cup double-header + merch); zero-fan home fixture ($0 gate line, no reveal — away weeks emit no gate line at all, so they cannot exercise this rule); longest realistic ledger (sponsor portfolio + prize week); reduce motion. This is the QA surface for the animation.
- **The statement's skip surface uses native RN `Pressable`, not `SfxPressable`** — the aliased wrapper auto-plays a generic click before `onPress`, which would double every skip with click + thunk. The report thunk is the only intended feedback. (Close, backdrop, and Continue keep their existing `SfxPressable` behavior.)
- **Canonical docs sync (same PR):** `docs/08-ui-ux.md` — Financial Report flow, one-row-per-press skip, reduce-motion behavior, and a narrow approved palette exception: the permanent surge treatment (gold/orange/red fire tint, larger bold type) is allowed *only* on surged income amounts in this report, alongside the retained plus sign and banner; hero gold elsewhere still means hero/power UI. `docs/06-economy.md` — report-eligible variance bands, baseline projections, and the revised per-level Fan Shop calculation. `docs/02-core-loop.md` — the post-match income statement is named the Financial Report.

### Known UI traps to respect

- Never use function-form `style` on any Pressable (iOS zero-height trap).
- Amounts already use the mono font; reels must reserve fixed digit widths so nothing jitters.
- NativeWind rem = 14 pt on native; spacing follows the 8-point grid in that unit system.

## 11. Determinism, saves, and compatibility

- `reveal` is additive and optional: existing dev saves load and simply render lines without multiplier/surge dressing on historical weeks.
- No `ENGINE_VERSION` bump: `src/sim` is untouched and the golden replay is unaffected. No `GAME_SCHEMA_VERSION` bump (§10).
- The variance changes weekly settled cash, so season-scale integration tests with pinned dollar expectations update to seeded-deterministic values.

## 12. Accessibility

- Row `accessibilityLabel`s carry the final amounts immediately; VoiceOver never waits for reels.
- Multiplied rows narrate the full math, available immediately (the grouped-row label pattern already overrides descendant text): "League home gate, two stands. Base $1,200, times 200 percent, total $2,400." / "Fan Shop merchandise, three shops. Base $250, times three, plus 10 percent adjacency, total $825."
- Surge rows append "surged this week" to the row's accessibility label.
- Banners are `accessibilityRole="alert"` with their text; they are announced but never trap focus.
- Reduce-motion behavior per §4.

## 13. Testing and verification

- **Game ring (Jest, headless):** determinism (same state → identical lines twice); watched vs Quick Result reveal equality; band bounds (percent always in −10…+10 or 11…20, `surge` matches band); exact surge counts over a fixed seed grid (~10%); reveal-reconstructs-amount invariant; constant lines carry no reveal; cup-gate reveal on home cup weeks; triple-source double-header weeks; zero-base lines carry no reveal; quiet weeks and season-final settlements bank baseline; projections match settlement at p = 0.
- **Codec:** round-trip with and without `reveal`; a valid negative-variance reveal survives round-trip untouched; `sanitizeLedgerReveals` strips inconsistent reveals (wrong source/kind, out-of-range values, zero base, reconstruction mismatch, adjacency mismatch) while the save and the line still load.
- **View model:** pass-through for `postMatchViewModel`; Finances ledger unaffected.
- **UI state machine (headless where the Jest env allows):** rapid-skip transitions, timer cleanup on unmount, empty ledger, tap-during-every-phase, single-banner-on-skipped-surge, single-thunk on tap-completed net row.
- **Audio controller:** master volume zero, suspend/resume (crackle resumes only into a still-spinning generation), skip while suspended, stop-all on dismissal.
- **Balance harness:** re-run; if the opening-economy suite fails, apply the §5 season-1 clamp contingency and re-run; if still failing, stop and raise to owner.
- **Manual QA:** static web export + dev-harness entry for animation (RAF-recorder screenshots for the PR; the browser pane freezes RAF while hidden — use the recorder + forced-paint technique; mute game audio on load; close tabs and stop servers when done). **Audio verifies on the iOS simulator** — new bundled assets and loop behavior are not trustworthy on web alone. Include a large-text (iOS text-size 1.6×) harness pass and a longest-ledger pass so the net row and stamp stay reachable.

## 14. Out of scope

- Finances tab redesign or ranged projections (beyond the §6 "typical" microcopy).
- Reveal animation anywhere else the ledger renders (Weekly Review, Finances history).
- Any change to sponsor/prize/buzz/loan line math or presentation beyond the generic spin.
- Docs 03/04/09 power-worth numbers (separate open item from the balance-harness recalibration).

## 15. Decision log

| Decision | Choice | Source |
|---|---|---|
| Score/result on this screen | Removed; lives on Full-time Report | Owner |
| Screen scope | Money star on top; warnings/buzz/TP+fans stay below with concurrent animations | Owner |
| Title | FINANCIAL REPORT | Owner ("something like Financial Report") |
| Multiplier presentation | Count in label, combined level in math | Owner |
| Economy effect | Straight bonus (+1.55% EV per eligible rolled line; smaller in aggregate); harness must pass | Owner |
| Audio | Owner-provided spin + thunk; Fire Torch flame sounds for surges | Owner |
| Stamp at end of sequence | Yes (vetoable default, presented and accepted) | Claude proposal |
| Surge rows stay fire-tinted after landing | Yes (vetoable default, presented and accepted) | Claude proposal |
| Variance bands | 90%: −10…+10; 10%: +11…+20; independent per line | Owner |
| Tap behavior | Press lands the current row atomically; repeat taps chain; drags scroll | Owner + council round 1 |
| Variance scope | Only report-eligible settlements: user-match weeks, excluding season-final | Council round 1 (Fable) |
| Report lost on process kill / early dismissal | Accepted, low-scope: cash is honest, Finances shows the rows; no pending-report snapshot | Council round 2 (Codex), Claude chose low-scope |
| Harness contingency | Season-1 normal band clamps to −5…+10 (+3.8% EV per eligible line) if the suite fails; then stop and ask | Council rounds 1–2 |
| Audio ownership | Dedicated `financial-report-sfx.ts` controller + App.tsx volume/teardown wiring; management-sfx untouched | Council rounds 1–2 (both) |
| Reveal shape | Discriminated union by source; identity values explicit; adjacencyPercent persisted | Council round 1 (Codex) |
| Malformed/inconsistent reveals | Fail-soft `sanitizeLedgerReveals` strips only the reveal; never bricks the save | Council round 2 (Codex) |
| Skip semantics | Skipped surge still enqueues one banner; tap-completed net row plays one thunk | Council round 2 (Codex) |
| Banner sizing + bonus | Shrink-wrapped card showing the surge's extra money beside the headline; hold 3 s | Owner (post-review, 2026-08-06) |
| Paired reveals | 8+ rows: constant rows reveal two at a time (odd tail solo); reveal rows stay solo | Owner (post-review, 2026-08-06) |
