# Financial Report — post-match screen redesign

- **Date:** 2026-08-06
- **Status:** Approved by owner (design conversation, this date); pending council audit
- **Owner decisions locked:** screen scope, multiplier presentation, audio assets, straight-bonus economy (see §15)

## 1. Summary

The post-match "Match Summary" modal becomes the **Financial Report**: money is the star. The score and WIN/LOSS chip disappear (both already live on the Full-time Report screen that precedes this modal in the watched and Quick Result paths). Every ledger amount reveals itself as a slot-machine digit reel — half a second of fast spinning, then a snap onto the real number, row by row. Home gate and Fan Shop income gain real, seeded weekly variance with a 1-in-10 "surge" band that turns the spin fiery, lands bigger and bold, and pops a pixel-art callout banner (EXTREME ATTENDANCE! / TRENDING MERCHANDISE!). Facility-multiplied income reveals its math: base lands first, a ×N chip slides in, the digits roll up to the final total.

## 2. Goals and non-goals

**Goals**

- Make the weekly money moment legible, dramatic, and worth watching.
- Show *where* money came from: base × facility multiplier, visibly.
- Add real (not cosmetic) variance to gate and merch income, deterministically seeded.
- Keep the rest of the modal (warnings, buzz, TP/fans) present but subordinate, animating concurrently on their own clocks.

**Non-goals**

- No redesign of the Finances tab or its projections (they stay baseline, variance-free).
- No new currencies, no change to wages/upkeep/subsidy/sponsor/prize math.
- No change to the match sim (`src/sim/`) — `ENGINE_VERSION` does not bump.

## 3. What changes on screen

### Removed

- The home/away score row and the WIN/LOSS StatusChip. The Full-time Report screen (`PostMatchLedgerScreen`) already shows both in every path that reaches this modal.

### Identity and layout order

- Header eyebrow stays **BACK AT THE OFFICE**; title becomes **FINANCIAL REPORT**.
- Panel kicker/title stay **ACCOUNTS OFFICE / MATCH STATEMENT**.
- The **RECORDED stamp is no longer visible at open**. It slams down (rotate + scale-in + thunk SFX) only after the net total lands. The report is not "recorded" until the accountant finishes.
- New order, top to bottom: statement panel (the star) → net cash change banner (inside the panel, as today) → "Dressing room / What moved" TP + Fans chips → buzz card → "Club desk / What needs attention" warnings → Continue button (fixed footer, unchanged).

## 4. The reveal sequence

### Timeline

| Beat | Duration | Notes |
|---|---|---|
| Row spin | 500 ms | Per-digit vertical reels, fast cycle |
| Digit settle | 30 ms stagger per digit, left to right | The slot-machine "click-click-click" |
| Land pop | 120 ms, scale 1.0 → 1.06 → 1.0 | On the amount only |
| Multiplier chip slide-in | 150 ms | Only on multiplied rows, after base lands |
| Odometer roll to final | 200 ms | Digits roll upward from base to final |
| Surge spin | 650 ms (500 × 1.3) | Replaces the 500 ms spin on surged rows |
| Net row spin | 650 ms | Always the last row |
| Stamp slam | 250 ms | After net lands; rotate −8° → 4°, scale 1.4 → 1.0 |
| Banner hold | 2000 ms | Auto-dismiss; banners queue FIFO |

Rows run strictly top to bottom; the next row starts the moment the previous lands (an 80 ms beat between rows keeps the rhythm readable). Rows not yet started show their label with a dimmed `$•••` placeholder at final width, so nothing shifts.

### Digit reels

- Amounts render in the existing mono font. The sign and `$` and commas stay static; each digit is a vertical reel cycling 0–9 fast during the spin.
- Spinning digits are tinted in the row's tone (green income, red expense) at reduced saturation; they hit full saturation on land.
- The reel always lands on the true saved amount — the UI never invents digits it must correct later (see §10).

### Input

- **Tap anywhere on the panel: the currently spinning row lands instantly** (spin SFX stops, thunk plays) and the next row starts. Repeated taps machine-gun through the report. This replaces today's "any touch completes all animation" behavior.
- Tapping does not dismiss a visible surge banner; banners auto-dismiss at 2 s and never block touches.
- Close (×), backdrop, and Continue behave as today and stop all report audio.

### Reduce motion

With `reduceMotion`, every amount renders final immediately, the stamp is visible from the start, no spin audio plays, and a surge banner appears as a static card for 2 s (it is information, not decoration: it explains why a number is large).

## 5. Matchday income variance (real economy change)

### What varies

Three ledger lines roll weekly at settlement, in `src/game/career.ts`:

1. **League home gate** (home league weeks)
2. **Hero Cup home gate** (home cup weeks)
3. **Fan Shop merchandise** (every week a shop exists)

Wages, coaching wages, facility upkeep, subsidy, sponsor, prize, training, loan lines: untouched and constant.

### The roll

Per line, per week:

- 10% chance: **surge** — variance percent uniform integer in **+11…+20**.
- 90% chance: variance percent uniform integer in **−10…+10**.

Gate and merch roll independently; both can surge the same week. The bonus band has no negative twin, so long-run average gate+merch income rises ~1.5%. Owner confirmed this straight bonus; the balance harness must still pass (§13).

### Determinism

- Each line derives its own PRNG: `mulberry32(hash(state.seed, season, week, lineSalt))` with a distinct integer salt per line kind (league gate, cup gate, merch), following the derived-seed pattern in `src/game/event-clock.ts`.
- Same career, same week → same roll, always. Reloading cannot re-spin. Quick Result banks the same money as a watched match.
- Rolls consume no RNG from any other system; no existing RNG stream shifts.
- Variance applies **only at settlement**. Projections (Finances tab `clubFinancesViewModel`, operating outlook) keep the baseline math — a projection is a typical week.

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
- Label gains a count suffix from operational stand *buildings*: "League home gate **· 2 stands**". Count in the label, combined level in the math — owner-chosen. No chip and no suffix when L = 0.

### Fan Shop merchandise

```
perLevel        = floor(fans / 2)                          // what one Lv1 shop makes
variedPerLevel  = round(perLevel × (100 + p) / 100)
N               = combined operational Fan Shop level
afterMultiplier = variedPerLevel × N
adjacency       = floor(afterMultiplier × merchIncomeBonusPercent / 100)
final           = afterMultiplier + adjacency
```

- Reveal shows: `variedPerLevel` lands → chip **×N** → odometer to `afterMultiplier`; if `adjacency > 0`, a quiet one-line caption under the row ("+10% adjacency") accompanies a final small roll to `final`. One multiplier beat per row; the adjacency is a caption, not a second chip.
- Label suffix "· 3 shops" from shop building count. No chip/suffix when N = 1 and one shop.
- **Rounding change:** today's formula is `floor(fans × N / 2)`; the new per-level form differs by at most N−1 dollars. The baseline (variance-free) function changes to the per-level form too, so settlement, projections, and the on-screen math all agree. Affected tests update.

## 7. Surge events

### The fire spin

- The surged row spins 30% longer. During the spin the digits flicker gold → orange → red with a warm background wash sweeping the row.
- On land, the amount stays **one font size larger, bold, and fire-tinted permanently** — the surge remains legible after the dust settles (owner-approved default).
- Audio: `flame-up` (Fire Torch activation sound) at spin start, fire crackle loop under the spin, both stop at land; the normal thunk still plays.

### Callout banners

- After a surged row lands, a banner pops over the panel: pop-in (scale 0.2 → 1.0 with slight rotation), hold 2 s, fade. It never blocks touches, and later rows keep spinning beneath it.
- **EXTREME ATTENDANCE!** (gate surge): a pixel crowd strip — five chibi fans, arms up, confetti pixels — drawn as Skia sprite runs in the style of `event-pixel-art.ts`.
- **TRENDING MERCHANDISE!** (merch surge): 4–5 toys drawn from a set of **10 merch sprites**: scarf, mini ball, foam finger, bobblehead, plush mascot, snow-globe stadium, boot keychain, jersey, trading-card pack, club mug. The subset is picked deterministically from season + week.
- If both lines surge, banners queue FIFO (gate first, since its row lands first).

## 8. The rest of the screen (concurrent)

Everything below the statement animates from modal open, independent of the row sequence:

- **TP / Fans chips**: slide up + count up (existing count-up helper), small bounce on land.
- **Buzz card**: slide + fade entrance.
- **Warnings**: staggered fade-in; warning-tone cards get one 300 ms attention wiggle.

Nothing below the statement ever waits for the slot machine.

## 9. Audio

| Cue | Asset | Behavior |
|---|---|---|
| Spin bed | `progress.webm` (owner-provided, 4.0 s) → `ledger-spin.wav` | Seek-to-0-then-play at each row's spin start; hard stop on land. Same seek-then-play pattern as the rapid tap pool. |
| Landing | `thunk.webm` (owner-provided, 0.38 s) → `ledger-thunk.wav` | One-shot per land, and for the stamp slam. |
| Surge ignition | existing `assets/audio/sfx/flame-up.wav` | One-shot at surge spin start (registered under a new management cue id). |
| Surge bed | existing `assets/audio/sfx/flame-loop.m4a` | Low-volume loop during the surge spin only. |

- Both webm files convert to wav (`ffmpeg`, mono, 48 kHz) into `assets/audio/sfx/`.
- New cues append **last** in the management-SFX registry; the hardcoded player count bumps; both rapid-pool index arrays shift accordingly (the known test-index trap).
- The existing match-statement music bed (`playMatchStatementSfx`) keeps playing under everything; volumes balanced at implementation.
- All report audio stops on dismiss/unmount.

## 10. Data model and architecture

### Reveal metadata, persisted

The settlement computes the roll once and saves the breakdown; the UI replays saved truth and never recomputes money at display time (fans can change during the match, so a display-time recompute could disagree with what was banked).

```ts
// src/game/types.ts
export interface LedgerLineReveal {
  base: number;               // post-variance base the reel lands on first
  variancePercent: number;    // −10…+20; 11…20 iff surge
  surge: boolean;
  multiplierPercent?: number; // gate rows: 150, 200, …
  multiplierTimes?: number;   // merch rows: 2, 3, …
  facilityCount?: number;     // stands/shops for the label suffix
  adjacencyAmount?: number;   // merch: dollars added after the multiplier
}

export interface LedgerLine {
  // …existing fields…
  reveal?: LedgerLineReveal;
}
```

Invariant (tested): `reveal` reconstructs `amount` exactly, with absent fields defaulting to identity (`multiplierPercent` → 100, `multiplierTimes` → 1, `adjacencyAmount` → 0) — gate: `base + floor(base × (multiplierPercent − 100) / 100)`; merch: `base × multiplierTimes + adjacencyAmount`.

### Touched modules

- **`src/game/career.ts`** — settlement-time variants of gate/merch income that accept an injected RNG and return `{ amount, reveal }`; `settlementLines` attaches reveals. Baseline (variance-free) functions remain for projections; merch baseline moves to the per-level rounding (§6).
- **`src/persistence/game-state-codec.ts`** — encode/decode `reveal` (optional field; old saves load unchanged).
- **`src/application/view-models.ts`** — `postMatchViewModel` passes `reveal` through on its ledger lines; Finances-tab view models ignore it.
- **`src/ui/PostMatchSummaryModal.tsx`** — rewired per §3; drops the score block; hosts the new statement component and the concurrent sections.
- **New `src/ui/components/FinancialStatement.tsx`** — the row-sequence state machine (per-row spin/land, chips, adjacency caption, net row, stamp, tap-to-land), timing constants from §4 in one place.
- **New `src/ui/components/SlotAmount.tsx`** — the digit-reel amount: spin mode, settle stagger, odometer-up mode. Plain RN `Animated`; no Skia needed for text.
- **New `src/ui/components/SurgeBanner.tsx`** — banner queue + pixel art (Skia `Canvas`/`Rect` runs, same approach as `EventPixelScene`).
- **New `src/ui/finance-pixel-art.ts`** — sprite runs: crowd strip + 10 merch toys.
- **`src/render/management-sfx.ts`** — new cues per §9.
- **Dev harness** — new entry `financial-report` with scripted scenarios: no facilities; 2 stands + 3 shops; gate surge; merch surge; both surge; away week; reduce motion. This is the QA surface for the animation.

### Known UI traps to respect

- Never use function-form `style` on any Pressable (iOS zero-height trap).
- Amounts already use the mono font; reels must reserve fixed digit widths so nothing jitters (pixel-font width lessons apply if any Silkscreen text is measured).
- NativeWind rem = 14 pt on native; spacing follows the 8-point grid in that unit system.

## 11. Determinism, saves, and compatibility

- `reveal` is additive and optional: existing dev saves load and simply render lines without multiplier/surge dressing on historical weeks.
- No `ENGINE_VERSION` bump: `src/sim` is untouched and the golden replay is unaffected.
- The variance changes weekly settled cash, so season-scale integration tests with pinned dollar expectations update to seeded-deterministic values.

## 12. Accessibility

- Row `accessibilityLabel`s carry the final amounts immediately; VoiceOver never waits for reels.
- Surge rows append "surged this week" to the row's accessibility label.
- Banners are `accessibilityRole="alert"` with their text; they are announced but never trap focus.
- Reduce-motion behavior per §4.

## 13. Testing and verification

- **Game ring (Jest, headless):** determinism (same state → identical lines twice); band bounds (percent always in −10…+10 or 11…20, surge flag matches band); exact counts over a fixed seed grid (~10% surge); reveal-reconstructs-amount invariant; constant lines carry no reveal; cup-gate reveal on home cup weeks; away weeks have no gate line; projections match settlement at p = 0.
- **Codec:** round-trip a ledger with and without `reveal`.
- **View model:** pass-through test for `postMatchViewModel`.
- **SFX registry tests:** counts and index arrays updated (the trap in §9).
- **Balance harness:** re-run; assertions must pass with the ~+1.5% gate+merch EV shift.
- **Manual QA:** static web export + dev-harness entry; RAF-recorder screenshots for the PR (browser pane freezes RAF while hidden — use the recorder + forced paint technique). Mute game audio on load; close tabs and stop servers when done.

## 14. Out of scope

- Finances tab redesign, ranged projections, or reveal animation anywhere else the ledger renders.
- Any change to sponsor/prize/buzz/loan line math or presentation beyond the generic spin.
- Docs 03/04/09 power-worth numbers (separate open item from the balance-harness recalibration).

## 15. Decision log

| Decision | Choice | Source |
|---|---|---|
| Score/result on this screen | Removed; lives on Full-time Report | Owner |
| Screen scope | Money star on top; warnings/buzz/TP+fans stay below with concurrent animations | Owner |
| Title | FINANCIAL REPORT | Owner ("something like Financial Report") |
| Multiplier presentation | Count in label, combined level in math | Owner |
| Economy effect | Straight bonus (~+1.5% EV on gate+merch); harness must pass | Owner |
| Audio | Owner-provided spin + thunk; Fire Torch flame sounds for surges | Owner |
| Stamp at end of sequence | Yes (vetoable default, presented and accepted) | Claude proposal |
| Surge rows stay fire-tinted after landing | Yes (vetoable default, presented and accepted) | Claude proposal |
| Variance bands | 90%: −10…+10; 10%: +11…+20; independent per line | Owner |
| Tap behavior | Lands the current row instantly; repeat taps chain | Owner |
