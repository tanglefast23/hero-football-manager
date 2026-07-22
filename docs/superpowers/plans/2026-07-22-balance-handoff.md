# Handoff — hero powers, training and league balance (2026-07-22)

Written at the end of the original measurement session, then updated after the
approved implementation and post-build audit. Sections 1–5 preserve the
starting evidence and decision record; sections 6–9 are the current status.

**Current branch:** `feature/hero-power-balance-m1-13`. The implementation is
committed in `3cbca1f`, and the Shadow Mark correctness fix is committed in
`f0d0ef5`. Final acceptance evidence is committed in `bf7c8e6`. All three are
pushed. The current replay version is **m1.16**.

---

## 1. Starting repo state (historical)

This section describes the state before the approved backlog was implemented.
For the current branch and gate status, use sections 6–9.

### Engine version is m1.13 (was m1.11)

Two replay-affecting changes landed:

- **m1.12 — Hero License card exemption.** Firing a licensed power never books
  its user, for *either* team. Fire Torch's 15% yellow and Super Strength's 25%
  yellow / 5% straight red are gone, along with the now-orphaned `rollCard` and
  `sendOff`. Rationale is written up in `docs/04-superpowers.md` under
  "Decision record — the Hero License card exemption".
- **m1.13 — five new powers + role-locked awakening** (see §2).

`SimPlayer.cards`, the `CARD` event and the `'redcard'` out-reason are still in
the schema so saved replays deserialize, but nothing can produce them now.

### Test status: 150 suites pass, 6 fail

All six failures are **expected consequences** of deliberate changes. None is a
mystery. In priority order:

| Suite | Why it fails | Fix |
|---|---|---|
| `sim/runtime-golden.test.ts` | Hardcoded fingerprint is m1.12's | Run it, copy the actual hash into `EXPECTED_RUNTIME_GOLDEN` in `src/sim/runtime-golden.ts`, note m1.13 in the comment |
| `game/power-catalog.test.ts` | Asserts the old "any outfielder can hold any non-GK power" rule and that generated clubs expose the whole catalog | Rewrite against the new `ROLE_POOL` in `src/game/power-catalog.ts` |
| `application/store.test.ts` | Career fixtures assert exact weeks/values; sim changes shift match results (saw `week: 27` → `26`) | Re-record the fixtures |
| `application/launch.test.ts` | Same cause | Re-record |
| `application/m2-managed-recovery-soak.test.ts` | Same cause | Re-record |
| `render/sprites/career-look-diversity.test.ts` | Same cause (roster/awakening shifts) | Re-record |

Also needs doing: `parity-replay.test.ts.snap` was rebaselined for m1.12 and
**needs rebaselining again for m1.13** (`npx jest src/sim/__tests__/parity-replay.test.ts -u`).

**Before updating any golden/snapshot, confirm the version decision is
deliberate** — that's the forcing function CLAUDE.md describes, and m1.13 is the
decision.

### Verified good

- `npx tsc --noEmit` — clean, 0 errors
- `sim/power-cadence.test.ts` — **passes for all 16 powers**, meaning every new
  power clears the "not a dead power" floor (≥0.35 fires/match, fires in ≥40% of
  matches). The five new powers genuinely work.
- `sim/powers.test.ts` — 28 pass, including a new test asserting neither Fire
  Torch nor Super Strength books its user at any roll value

### Not run

`src/audit/**` probes are excluded from the suite runs above — they take 10–17
minutes each. Run them explicitly. They are scratch tooling, not gates; decide
whether to keep them (see §5).

---

## 2. What was built

### Five new powers (m1.13)

All chosen because their trigger is a **sustained situation**, never "hold the
ball this instant" — the flaw that killed Magnet Touch and cripples Portal Pass
and Decoy Double.

| Power | Effect | Implementation |
|---|---|---|
| Rally Cry | Nearby teammates' Heat fills 3× faster | `rallyCryMultiplier` in `powers.ts`; **exempt from the one-power freeze**, or it cancels itself out |
| Ice Rink | Opponents crossing the anchored area move at 0.55× | `iceRinkSlow`, hooked into `speedFor` in `engine.ts:64` |
| Shadow Mark | Passers stop accounting for this defender | `isShadowMarked`; removes space/lane relief in `passContestInputs` (`engine.ts:522`) |
| Gravity Well | Drags nearby opponents toward the hero | Instant effect in `activatePower` |
| Giant GK | +55 keeper save bonus for a whole attack | `keeperSaveBonus` |

Wired everywhere the compiler demanded: `PowerId`, `PowerIdSchema` (now 16–20),
`content/powers.json`, `content/onboarding.json` (omen/reveal copy),
`DUR`, `inUsefulContext`, `hasUsableTarget`, `requiresTarget`, `PRESENTATION`,
`POWER_SFX`, `LAUNCH_POWER_IDS`, awakening weights, `VALID_POWER_IDS`, and the
`CARRIER_SLOT` maps in both harnesses.

Sounds are placeholders reusing existing cues. Art/FX not touched.

### Role-locked awakening

`ROLE_POOL` in `src/game/power-catalog.ts` replaces the old "anyone but a
keeper" rule. Previously a defender drew a **carrier-only striker power 47% of
the time** and could essentially never fire it. Keepers previously had exactly
one possible power; they now have three.

---

## 3. Measured facts worth not re-deriving

Units: the pitch is 6800×10500 and a real pitch is 68×105m, so **100 units = 1 metre**.

### Opening matches (300 careers, real career path)

| Match | Result |
|---|---|
| 1 (league, wk5, always home) | 28% W / 29% D / 43% L |
| 2 (**National Cup**, wk5) | 29% W / 13% D / 58% L — opponent averages 60.9 vs your 52.8 |
| 3 (league, wk6) | 39% W / 25% D / 36% L |
| 4 (league, wk7) | 28% W / 23% D / 49% L |

Flat. No difficulty arc. Training 3 players every week for 5 weeks moved squad
average by **+0.49** and win rate by **0%**.

### Strength gap → result (400 matches per row, user at home)

| Opponent | You win | Draw | You lose |
|---|---|---|---|
| 8 weaker | 88% | 8% | 4% |
| 4 weaker | 76% | 15% | 9% |
| **Even** | **40%** | **23%** | **37%** |
| 2 stronger | 23% | 23% | 54% |
| 6 stronger | 7% | 17% | 76% |
| **10 stronger** | 0.3% | 8% | **92%** |

**1 point of squad strength ≈ 8 percentage points of win rate near even.**

### The actual pyramid (engine view)

| Division | Avg | Gap vs you |
|---|---|---|
| D1 | 86.3 | +34.3 |
| D2 | 68.9 | +16.9 |
| D3 | 62.0 | +10.0 |
| **D4** | **51.9** | **−0.1** ← promotion is *no step up* |
| D5 (you, launch clubs) | 52.0 | 0 |

`DIVISION_BASE_STRENGTH` intends 44/52/60/68/84, but D5 is populated by the ten
hand-authored launch clubs at 49–55 — **a full division too strong for its slot.**

### Power firing (200 matches each, power on its correct carrier slot)

| Power | Zones/match | Fires/match | Conversion |
|---|---|---|---|
| Phase Run | 2.92 | 2.63 | 90% |
| Super Speed | 2.79 | 2.59 | 93% |
| Fire Torch | 2.76 | 2.50 | 91% |
| Thunder Strike | 2.68 | 2.44 | 91% |
| Blink Run | 2.88 | 2.54 | 88% |
| **Portal Pass** | 3.79 | 1.29 | **34%** |
| **Decoy Double** | **4.59** | 0.53 | **11%** |
| Future Sight | 1.45 | 0.66 | 45% |
| Web Trap | 1.51 | 0.58 | 39% |
| Super Strength | 1.56 | 0.51 | 33% |
| **Elastic Keeper** | **0.68** | 0.56 | 82% |

Attacking powers waste **0.00** windows/match. Defensive powers waste 49–61%.
Decoy Double wastes 3.85 per match and is **0% usable manually**.

**A hero is currently worth +0.3 to +0.6 squad points** — roughly a 6–12%
win-rate uplift, i.e. below even the old `docs/09` bar.

**The target was rewritten on 2026-07-22.** `docs/09-tech-stack.md` now carries a
"Hero uplift target" section replacing the old "15–25% win-rate uplift" line:

| Case | Target worth |
|---|---|
| **Tier 1, auto-fired** — balance the leagues against this | **+2** |
| Tier 1, tapped well | +2.5 – 3 |
| Tier 3, tapped well (endgame, D1) | **+4** |

Near an even match, **1 squad point ≈ 8 percentage points of win rate**. Assert
uplift at **1,000 seeds minimum** — at 200 the standard error is ~0.09, so any
difference under ~0.19 is noise. Firing counts are reliable at 200; worth is not.

### Heat sources

Passive trickle is 0.02/tick = 40 over a match, against a threshold of 60 — so
**passive alone never reaches the Zone.** Real sources: shot 20, save 20, tackle
won 18, interception 12, loose ball 8, tackle attempt 3, pass received 2,
defender within 20m of the carrier +0.35/tick.

### Training headroom

Ordinary D5 players have **28–36 attribute points** of room each (~450 across
the squad ≈ 50 weeks of training). Training does **not** run out in a 30-week
season. The created hero has ~120 points.

**The real problem:** each drill targets one stat, and 6 of 15 starters are
already maxed on pace specifically — which rejects the *entire* plan
(`training.ts` `trainingPlanCapConflicts`).

Division potential ceilings already scale correctly: D5 is 100% tier-1
(ceiling 46–57), D4 spreads 10/30/35/20/5, D1 is 55% tier-5 (94–99).

---

## 4. Agreed implementation backlog

Ordered as recommended. Every item was explicitly approved by the owner. The
original wording is retained here as the implementation record; current status
is summarized in §6.

### Do first — verification
1. **Rebaseline m1.13**: runtime golden hash, parity replay snapshot, and the
   four career fixture suites listed in §1.
2. **Rewrite `power-catalog.test.ts`** against `ROLE_POOL`.
3. **Re-measure with `power-firing-probe.test.ts`** now that the five powers and
   role pools exist — this is what should inform all tuning below.

### Then — hero worth (target +2, not +4 in one go)
4. **Wire up power tiers.** `powerTier` (1–3) exists in career state, is shown in
   the UI as "Tier 2", and is priced at 400/600/800 in the market — but it
   **never reaches the engine**. `buildTeamDef` (`lineup.ts:114`) passes only
   `power`; `PlayerDef` has no tier field. Suggested: Tier 1 ≈ +2 worth when
   played well, Tier 3 ≈ +4. Balance the leagues against the *weakest* corner
   (Tier 1, auto-fired).
5. **More chances to fire** — fix Portal Pass and Decoy Double's `isCarrier`
   requirement (they generate the most windows and convert the fewest), and add
   keeper Heat: award on `MISS` (`engine.ts:993`, currently awards nothing),
   raise `SAVE_GAUGE` 20 → 30, and give keeper distribution a small award.
   **Trap:** do *not* award Heat to all passers — midfielders already have the
   most windows and it would widen the gap.
6. **Slightly bigger effects** — durations/magnitudes in `DUR` and `activatePower`.

### Then — match feel
7. **Press-to-arm window (2 seconds).** Pressing *places* a 2-second window
   rather than extending a timer, so choosing *when* is the decision. Do **not**
   make total time identical regardless of press moment — that deletes the choice.
   Suggested: full strength if the situation is already right, slightly reduced
   if it fires from the armed state.
8. **Power stacking** — remove the one-power-per-team freeze (`teamPowerBusy`).
   Note `addGauge` currently freezes *all* Heat including event awards, ~11% of a
   match with one hero. Rally Cry already has an exemption.
9. **Multi-tile cut-in** — `powerCutIn` in `MatchScreen.tsx:268` is a single
   `useState` object; make it an array of up to 4 with a grid keyed off length
   (1 full, 2 side by side, 3 as two-up-one-down, 4 as 2×2). `bannerRef` needs
   the same. Render-only, no version bump. Decide overflow policy: both teams can
   fire, so the worst case is ~7 — recommend your own heroes get tiles, rivals
   get banners.
10. **Gust on passes** — knock the ball *loose* rather than delivering it, so it
    stays distinct from Future Sight (clean steal) and keeps counterplay.
11. **Fire Torch range 800 → ~1400.** Tightest trigger in the game (8m) while
    defenders charge Heat from 20m. Cheapest meaningful power fix available.

### Then — career and league
12. **Skip capped players in training plans** instead of rejecting the whole
    plan, **plus an inbox warning** naming the player so the manager can swap the
    drill or the player. (Owner explicitly asked for the warning.)
13. **League restructure**: 10-point contiguous bands — D5 40–50, D4 50–60,
    D3 60–70, D2 70–80, D1 80–90 — with the player's club at the **bottom** of
    D5. Widen within-division spread from `±3` (`pyramid.ts:222`). This is what
    delivers the ~90% first-match loss naturally.
14. **Pin the first five opponents on a venue-aware easing curve**: 50 home,
    45 away, 46 home, 43 away, then 42 home. This keeps the first two authored
    shocks while removing the weakest-match spike and harder-match rebound.
15. **Cup out of the opening** — `CUP_SETTLEMENT_WEEKS` (`career.ts:45`) starts
    at week 5, same week as the league opener, and the draw is a blind shuffle of
    all 50 clubs across every division. Move to ~week 10 *and* seed by division.
16. **Zero heroes in D5** — change `generatedClubHeroCount`'s D5 rule to 0
    (`power-catalog.ts:37`) and remove Rex Bould's power from Ferrous United in
    `content/clubs.json`. Makes your awakening the only power on the pitch.
17. **Ambient training points** — move TP off win/draw/loss (`career.ts:979`)
    onto a weekly amount from facilities/coaches. Currently TP is starved before
    week 5 and then piles up unused (98 banked by match 4). Cash never binds at
    all — 0 blocked weeks in 300 careers.
18. **Drill upgrade path** — single-stat, escalating magnitude (Sprints I +3,
    II +5, III +8). Owner rejected multi-stat drills: picking which stat to raise
    is the interesting choice. Aim upgrades at high-ceiling players.
19. **Loose-ball passes** — a failed pass currently always lands cleanly on the
    interceptor's foot (`engine.ts:713`); there is no "nobody's ball" outcome.
    `engine.ts:517` already flags the pre-rolled model as temporary pending an
    "emergent pass-flight resolver". Own piece of work — touches every pass.

---

## 5. Traps — I fell into two of these

**Measuring a power on the wrong position.** `powerIsCompatibleWithRole` only
excluded keepers, so a "first compatible player" loop puts Super Speed on a
centre-back. I reported "heroes enter the Zone 0.6×/match" and "Portal Pass never
fires" — both wrong, both artifacts. **Always use the `CARRIER_SLOT` map** from
`sim/__tests__/power-cadence.test.ts`.

**Setting `controlledTeam` in a harness.** It disables automatic substitutions
and energy management for that team (`auto-coaching.ts:44`), so the side plays 90
minutes with no fresh legs. My "tapping is worse than not tapping" result was
this, not a real finding. Taps work fine without it — only coaching inputs need it.

**Points-per-match noise.** At 200 matches the standard error is ~0.09, so
differences under ~0.19 are not meaningful. Firing counts are solid at that size;
"worth" values are not. The defensive powers' −0.5 was only ~1.5σ and cards have
since been removed — **it needs a ~1000-seed re-run before anyone acts on it.**

**Swallowing exceptions in a harness.** A `try/catch` around
`setCareerTrainingPlan` hid a real rejection for all 300 careers and produced two
byte-identical cohorts. Fail loudly.

### Probe files — decide whether to keep

`src/audit/__tests__/`: `opening-matches-probe`, `strength-gap-probe`,
`hero-value-probe`, `power-firing-probe`, `headroom-probe`,
`pyramid-strength-probe`, `training-trace-probe`. They produced every number
above and are the tool for verifying items 3–19. They are **slow (10–17 min)**
and must not go into CI as-is. Either keep them excluded via
`--testPathIgnorePatterns="src/audit"` or move them behind an explicit script.

`hero-value-probe.test.ts` now avoids `controlledTeam`, runs 1,000 seeds by
default, supports deterministic shards, and measures Tier-1 auto, Tier-1
well-tapped, and Tier-3 well-tapped cases. `power-firing-probe.test.ts` remains
the cadence/conversion probe.

---

## 6. Implementation status — 2026-07-22

A checked item means the approved behavior and its focused coverage were built.
It does **not** mean the post-build balance target passed; those results are kept
separate so tuning misses cannot hide behind a green implementation checklist.

- [x] Items 1–3: deliberate replay rebaseline, role-pool coverage, and
  opt-in firing measurement.
- [x] Items 4–6: career tiers reach the match engine, power opportunities were
  expanded, and the first effect-strength pass was applied.
- [x] Items 7–11: fixed press-to-arm timing, independent hero powers, multi-tile
  cut-ins, loose-ball Gust, and Fire Torch's wider context.
- [x] Items 12–16: capped-player skipping with named warnings, contiguous league
  bands, authored opening opponents, a week-10 division-seeded Cup, and a
  hero-free Division 5.
- [x] Items 17–19: weekly facility/coach TP sources, single-stat drill tiers,
  and an ordinary loose-ball outcome for failed passes.
- [x] Post-build audit: 1,000-seed tiered hero-worth runs, a 300-career opening
  comparison, all-power cadence measurement, deterministic gates, and a clean
  web production export. The final full-suite count is recorded in §9.

The remaining misses are tuning or game-design decisions, except for the Cup
play-in pairing bug found by the audit and fixed so opponents are at most one
division apart.

---

## 7. Post-build measurements

### Hero value — 1,000 paired seeds per case

Targets are +2 for Tier-1 auto, +2.5–3 for Tier-1 well-tapped, and +4 for
Tier-3 well-tapped. Rally Cry is not graded in isolation because the game now
correctly prevents it from being a club's first or only power.

| Power | T1 auto | T1 tapped | T3 tapped |
|---|---:|---:|---:|
| Super Speed | +1.7 | +1.9 | **+4.3** |
| Fire Torch | +1.9 | +2.2 | +2.5 |
| Decoy Double | +0.5 | +0.7 | +1.2 |
| Web Trap | +0.5 | +0.9 | +0.9 |
| Ice Rink | +0.9 | +0.8 | +1.2 |
| Giant GK | +1.5 | +1.6 | +2.1 |
| Blink Run | +0.5 | +0.8 | +1.3 |
| Phase Run | +0.6 | +0.9 | +1.2 |
| Future Sight | +1.5 | +1.7 | +1.8 |
| Elastic Keeper | +0.8 | +1.0 | +1.3 |
| Shadow Mark (m1.16) | +0.5 | +0.5 | +0.8 |
| Gust | +1.1 | +1.6 | +2.2 |
| Thunder Strike | +1.3 | +1.4 | +1.8 |
| Portal Pass | +0.2 | +0.3 | +0.5 |
| Super Strength | +1.0 | +0.5 | +0.8 |
| Gravity Well | +0.5 | +0.1 | +0.5 |

Only **1 of 48** graded cells clears its target. This is the primary reason the
branch must not be merged as a finished balance pass. Shadow Mark's corrected
ambush logic improved all three cases, but it still misses every value target.

### Power opportunity and conversion — 200 seeds per mode

- Portal Pass: 2.16 zones / 2.12 fires, **98% conversion**.
- Decoy Double: 2.08 / 2.04, **98% conversion**.
- Defensive powers: 2.04–3.00 zones and **87–99% conversion** in the measured
  set, with only roughly 1–13% of chances wasted.
- Blink Run and Thunder Strike remain below the intended conversion floor at
  roughly **63–64%**; Phase Run is close at 78%.
- Manual play is not reliably better: the 200-seed skill delta is positive for
  some powers and negative for others. That is directional evidence; the
  1,000-seed value table confirms that the manual target is not met.

### Opening run — 300 careers

The trained cohort used three trainees whenever resources allowed.

| Match | Trained loss | Control loss | Intended read |
|---|---:|---:|---|
| 1 | **87.7%** | 89.7% | Authored heavy opening loss |
| 2 | **59.3%** | 68.3% | Softer second shock |
| 3 | **55.0%** | 70.0% | Curve starts bending |
| 4 | **42.0%** | 54.3% | Near even |
| 5 | **34.7%** | 42.3% | Player has moved past even |

This passes the revised opening target in the intended, trained play path.
Training also measurably changes results instead of producing the old 0% shift.

### Training points and cash

- The free operational Level-1 Training Pitch changes the pre-match TP trace
  from the old dry spell to **30 → 25 → 20 → 15 → 10**, so a basic drill is
  still available in week 4.
- Across 300 careers through match 18, a three-player plan trained for 15 weeks
  on average but was TP-blocked for 10.67 weeks and cash-blocked for 0 weeks.
- The trained cohort committed about 17,684 cash and finished with about 10,286
  cash versus 27,380 for the control cohort. Cash now matters, but does not yet
  constrain the plan in the measured window.
- Capped players are skipped individually with a named warning; they no longer
  reject the whole plan. Drill tiers unlock by division and roster headroom
  remains ample.

### League, Cup, awakening, and match feel

- Division content is contiguous at 40–50 / 50–60 / 60–70 / 70–80 / 80–90;
  the user's launch XI is 41.1 and starts at the bottom of Division 5.
- The Cup begins around week 10 and uses division-aware pairing. The play-in bug
  found by the audit was fixed so the opponent is never more than one division
  away.
- Division 5 contains no rival heroes. Awakening respects role pools, Rally Cry
  cannot be the first/only power, and keepers have at least three options.
- Ordinary failed passes can become loose balls. Gust also produces a loose
  ball rather than a Future Sight-style clean steal.

### Multi-hero marginal value — 1,000 paired seeds per sample

The representative order was Super Speed (forward), Decoy Double (midfielder),
Future Sight (defender), and Giant GK. All used Tier-1 contextual auto-fire.

| Hero added | Solo worth | Marginal worth | Retained value |
|---|---:|---:|---:|
| Super Speed | +1.7 | +1.7 | **100%** |
| Decoy Double | +0.5 | +0.1 | **27%** |
| Future Sight | +1.5 | +1.0 | **63%** |
| Giant GK | +1.5 | +1.5 | **102%** |

Cumulative prefix worth was **+1.7 → +1.8 → +2.8 → +4.3**. Rally Cry added
only +0.2 beside Super Speed. Independent activation and the four-tile UI work,
but heroes two and three do not yet retain close to their full solo value.

---

## 8. Approval-required follow-up packages

These are proposals, not implemented behavior. They convert weak powers into
visible football moments instead of multiplying hidden stats.

1. **Finish the attack:** charged-shot commitment for Thunder Strike;
   threat-aware forward exits for Portal Pass; a visible decoy-pursuit window;
   Fire Torch marking the relevant goal-side defender; Blink Run appearing in
   the clearest lane beyond the last defender.
2. **One-moment defensive cash-out:** Phase Run ends after preventing the next
   challenge; Future Sight turns its first dangerous read into a controlled
   outlet; Web Trap and Gust deflect toward a recoverable lane; Ice Rink spends
   itself on the first meaningful slip or spill.
3. **Danger-scoped keepers:** Giant GK lasts for the current dangerous attack;
   Elastic Keeper banks one stretch-save charge for the next on-target shot in
   that possession.
4. **Strength and Gravity:** tier/manual strength changes Super Strength's
   pursuit and landing reach; Gravity Well fires during friendly possession as
   one brief pull that opens the opposite lane.
5. **Weekly training:** raise the operational Level-1 Training Pitch from +5 to
   **+10 TP/week**. That funds one basic drill every week; because the existing
   drill charge scales with selected trainees, the extra training should also
   make cash become the natural limiter.
6. **Small numeric close-out:** modest Super Speed tuning and power-family
   radius/range/wind-up tuning after the mechanic packages, measured again at
   1,000 seeds before setting final league assumptions.
7. **Conditional stack independence:** first remeasure after packages 1–4. If
   the second and third heroes are still being cannibalized, reserve distinct
   targets or opportunities so one active effect cannot erase the next hero's
   useful moment. Do not add a blanket hidden stack multiplier.

---

## 9. Final gate addendum

The m1.16 Shadow-only rerun completed at 1,000 paired seeds: +0.5 Tier-1 auto,
+0.5 Tier-1 well-tapped, and +0.8 Tier-3 well-tapped. The targeted probe passed
3/3 tests in 1,608 seconds.

The first full run exposed nine stale or asymmetric test fixtures. They were
fixed without changing gameplay:

- gym fixtures moved away from the new starter Training Pitch;
- 34 tracked acceptance saves were deliberately regenerated so the pitch is
  present in current baselines;
- m1.16 auto-coaching and README source expectations were re-recorded;
- the Super Strength cadence ceiling now matches the approved 2–3 opportunity
  band; and
- the +20 mismatch rail now compares both venues under the same auto-fire
  policy. Its scoring limits were **not** weakened.

Final repaired-tree gates:

- `npx tsc --noEmit` — pass;
- `npm test -- --runInBand` — **159/159 suites, 1,098/1,098 tests, 3/3
  snapshots**, pass in 785 seconds;
- `npm run export:web` — pass (1,416 modules, 46 assets, 6 bundles, 3 files);
- `git diff --check` — pass; and
- all slow `*-probe.test.ts` measurement files remained outside the automated
  run.

The multi-hero marginal-value probe passed 4/4 tests at 1,000 paired seeds per
sample in 2,797 seconds. Decoy Double retained 27% of its solo value, Future
Sight 63%, and Giant GK 102%; Rally Cry's marginal value was +0.2.

All requested implementation and measurement work is complete. Do not merge to
`main` until the approval-required balance work has been accepted or explicitly
deferred by the owner: hero value, manual advantage, weekly TP/cash pressure,
and second/third-hero stacking still miss their targets.
