# Scale-Invariant Attributes — Master Spec (r9, implemented and verified)

Date: 2026-07-29 · Status: **implementation complete — Phase 0/A/B/C verified**
Revision 9. All open design questions were decided by the owner on 2026-07-29 and are
recorded in §7 — five before the Phase-0 audit, plus Cup giant-killing (§7.6) once the
audit showed the current formula forbids it. They are inputs now, not defaults.

The five-round design review and the implementation audit are complete. The
keeper-oriented save formula, canonical stamina generator, no-Phase-C-re-centering
rule, and the same-day D1 stamina endpoint correction were all verified in the final
tree. The 2026-07-29 opening-match balance report's key numbers are inlined in
Appendix A so this document stands alone; §8 records the final acceptance evidence.

## 1. Problem (measured, not asserted)

All numbers measured 2026-07-29 on real generated squads (20 seeds × 10 clubs/division,
production generator + production curves).

**A. Mid-band training numbness.** `matchAttribute` (src/sim/attributes.ts) maps raw
ratings above 99 onto an asymptote at 149. A +8 youth drill at raw 90 buys +8 effective;
at raw 133 it buys **+2**; at raw 200, **+1**.

**B. Top-end gap crushing.** Raw 250 vs raw 500 — one player *twice* the other —
compresses to effective 121 vs 132, a near-even contest under the difference-based
table.

**C. Displayed numbers are dishonest at the top.** A trained 400-SHO star against a D1
star's 434 plays as 128 vs 130. Owner requirement: the 400-vs-434 comparison the player
sees should be the comparison the match resolves.

**Current division reality** (support = 11 ordinary outfielders + 2 GKs per club; each
club also fields 3 stars — one DEF/MID/FWD — whose position stats are raised to
`starOverall × 2 − support`, back-solved from `DIVISION_STRENGTH_BANDS`):

| Div | Support PAC | Support SHO/PAS/DEF | Role-peer avg | GK REF | Star focus raw (eff) |
|---|---|---|---|---|---|
| D5 | 73 | 33–35 | ~40 | 43 | 86 (86) |
| D4 | 79 | 34–36 | ~41 | 44 | 173 (113) |
| D3 | 83 | 36–38 | ~42 | 45 | 260 (121) |
| D2 | 89 | 37–39 | ~44 | 47 | 346 (127) |
| D1 | 91 | 39–41 | ~46 | 49 | 434 (130) |

Rival growth today: +1 squad strength every 2 seasons, capped +8 lifetime
(`DEFAULT_OPPONENT_GROWTH`, src/game/m2-career.ts) plus 30+ age PAC/STA decline.

## 2. Owner intent and the semantic contract

1. **Ratio semantics for outcomes.** Equal ratios mean equal advantage at every scale:
   400 vs 434 resolves like 40 vs 43.4.
2. **Consequence, stated openly:** a fixed +5 drill is worth less at higher ratings
   (+12.5% of ability at 40, +1.25% at 400). Intended — higher-division progression is
   carried by the drill *tier* ladder (5/8/12/17/23, tier unlocks already gated by
   promotion). Acceptance criteria are written against tiers at their home division.
3. Ordinary full-condition base speed spread bounded (~2×). Powers, slide/carrier
   physics, and Energy Use multipliers are exempt (docs/04 spectacle exemption).
4. Divisions populated at honest raw numbers; rivals inflate slowly per season.
5. Opening remains a near-certain loss; promotion in 1–2 seasons per division.

## 3. Design decisions

### D0 — Stat-domain contract and consumer matrix (Phase-0 deliverable)

> **The audit half of this deliverable is already written up:**
> `2026-07-29-phase0-stat-domain-matrix.md` catalogues every attribute consumer in
> `src/sim` by domain and records five findings that change later phases — **F1**
> auto-coaching compares *raw* attributes (bypassing `matchAttribute`) and uses a fixed
> 3-point margin (→ A2); **F2** Cup ties add a fixed 0–6 bump per side, so a club can
> only beat someone within 6 strength points — giant-killing is impossible today and
> the window goes inert against a rebased ladder (→ Phase B, D7.5); **F3**
> `shotSpreadAt` hides a second
> post-99 compression branch (→ A2); **F4** `keeperSaveRating`'s `/4` divisor *is* the
> 2026-07-25 GK balance decision and is exactly what §7.5 replaces (→ A1); **F5**
> `positionThreat`'s `0.16 + sho/500` becomes unbounded once compression is removed
> (→ A2). The refactor half (helper split, shot/save seam) is implemented and verified
> behavior-preserving: typecheck plus engine, tactics, parity-snapshot, and runtime
> golden tests passed without changing either golden or `ENGINE_VERSION`.

Contests are **not** the complete attribute funnel. Before any behavior change, commit
an audit matrix listing *every* consumer of PAC/SHO/PAS/DEF/TEC/STA/REF with: consumer
site, assigned domain, condition placement, modifiers, and its test. **Four** domains
(round-2 finding: three were not enough):

- **contest** — probabilistic resolution via LOG64 (D1).
- **movement** — rendered speed/spacing via the bounded pace table (D3).
- **decision** — AI comparisons (auto-subs' 3-point margin, targeting sums): re-expressed
  as ratios or normalized shares, never raw-point margins.
- **execution** — continuous quantities currently read from absolute points: shot
  spread, shot power, position threat, powered-finish headroom (src/sim/engine.ts:678).
  Rule: every execution quantity derives from `d64` against the relevant opponent (or a
  committed reference constant) through a committed bounded curve — never raw points.
  The per-site formula for each execution row is itself a Phase-0 matrix deliverable,
  signed off before Phase A2 implements it. The save mapping is **locked now,
  keeper-oriented** (matching the shipped
  `contestProbability(keeperRating + keeperBonus, shotPower, −7)`,
  src/sim/engine.ts:756 — round-5 correction; an earlier draft reversed this):

  ```
  d64(save) = LOG64[ref] + CLOG64[keeperCond] + resolveD64(remainingResolve)
            + keeperPowerD64Mod − shotStrength64 + SHOT_KEEPER_MOD_D64
  ```

  where `shotStrength64` is the execution-derived shot strength expressed in d64
  units, `SHOT_KEEPER_MOD_D64` is the keeper-oriented modifier declared **directly as
  a d64 constant** (mods are authored in d64 units — never by multiplying an
  already-d64 value by 64), remaining GK Resolve scales the probability **before**
  the roll via `resolveD64`, and Resolve damage stays a post-save state update as
  today. Phase-0 scope note: expected-value shot decisions currently **omit**
  `keeperSaveBonus`, so Phase 0 only extracts behavior-preserving seams (shared
  helper with the existing asymmetry intact); expected and actual save math are
  unified in A1, where behavior is allowed to change under the K gate.

Known consumers requiring explicit rows (from review): PAC press spacing (additive raw
difference; **no PAC contests exist today** — PAC stays movement-domain, no new contest
mechanic), tackle-fall probability (old point difference), pass-geometry relief (raw
defender points), Fire Torch / Portal Pass / Decoy targeting (compressed sums,
src/sim/powers.ts:990), auto-substitution margins (src/sim/auto-coaching.ts:32).

`effectiveStat` splits into `contestStat` / `movementStat` / `decisionStat` /
`executionStat` helpers; a shared shot/save helper makes expected-value decisions and
actual resolution use identical math. Phase 0 is refactor-only: goldens must not move.

### D1 — Contest resolution: fixed-point log-ratio (deterministic)

```
LOG64[v]   = round(64 · K · ln(v))                  v = 1…999, committed integer table
CLOG64[c]  = round(64 · K · ln(0.75 + 0.25·c/100))  c = 0…100, committed integer table
                                                    (condition as a log-space modifier —
                                                    no fractional table indices)
condIndex  = clamp(floor(condition), 0, 100)        match condition is fractional
                                                    (per-tick drain, engine.ts:174);
                                                    floor is the deterministic
                                                    quantizer (uses only IEEE-exact
                                                    ops), boundaries pinned by test
d64        = clamp(LOG64[att] + CLOG64[attCond]
                 − LOG64[def] − CLOG64[defCond]
                 + 64·mod, −99·64, 99·64)
P          = interpolate64(contest-table, d64)      deterministic integer linear
                                                    interpolation between entries
```

Tables generated by `scripts/gen-log-table.mjs` (pattern of `gen-contest-table.mjs`;
no runtime transcendentals, per docs/09 rule 3). Subtraction happens at 1/64-point
resolution before any rounding: +5 at rating 400 moves d64 by ≈ 23 sub-units at K = 29
— never a dead step. Quantized invariance tolerance: equal-ratio matchups resolve
within one interpolation step (≤ 0.1 pp). Invalid ratings (non-integer, < 1, > 999)
**throw**, as `assertPlayerAttribute` does today — no silent clamping; the ±99·64 clamp
applies only to the d64 sum. Power/authored bonuses are typed effects
(`{ d64Mod | multiplier | geometry }`) applied **after** LOG64. RNG consumption per
contest is unchanged.

**K calibration:** the analytic starting anchor was +10 points at rating 50
(ratio 1.2) mapping to today's d = 10 ⇒ K ≈ 55. Whole-match fitting rejected that
estimate: after the locked symmetric REF change, K = 55 produced 99.2% opening losses
in both trained and control cohorts. The final measured fit is **K = 29**, paired
with a neutral `SHOT_KEEPER_MOD_D64 = 0`. On the 1,000-seed calibration cohort,
untrained losses moved 90.0% → 91.1% and trained final losses were 94.3%. On the
untouched 1,000-seed held-out cohort, untrained losses moved 91.3% → 91.7%, every
paired W/D/L CI stayed inside ±3 pp, and trained final losses were 92.5%.
K is fitted **only** in Phase A1, then held fixed and re-validated after A2/A3.

### D2 — `matchAttribute` leaves the contest path

`contestStat` returns the raw rating; condition contributes via CLOG64 exactly once
(placement per-site in the D0 matrix). Under ratio resolution a −25% condition penalty
is a constant probability penalty at every scale. Table access is property-tested
against maxed stats with power mods applied — no out-of-range index, no NaN.

### D3 — Rendered speed: fixed-point bounded table (literal linear speed REJECTED)

Rejected: "PAC 120 moves 2× PAC 60" taken literally — a D1 ladder near 450 vs a
promoted 80-PAC player is a 5.6× on-pitch gap; unplayable on fixed geometry.

Proposed: `PACE_SPEED128[v]` — committed integer table in **1/128 speed units**
(999 entries). Precision matters (round-3 finding): at the D5 anchor, 1/16 units
collapse 999 ratings onto ~551 distinct speeds because the power-law slope at the top
is ~0.3 sub-units per rating point; 1/128 keeps the generator **strictly increasing**,
which the table test asserts along with pinned endpoints. Movement accumulates
position in 1/128 sub-units with deterministic integer residue carry; the existing
integer coordinate rounding (src/sim/engine.ts:155, src/sim/geometry.ts:24) reads the
accumulated position. **Residue lifecycle (pinned):** residues reset to zero at
kickoff/restart placement, on substitution entry, on any teleporting or
forced-position effect (Portal Pass, Blink Run, knock-outs, clamp-to-target arrival);
slide displacement and other forced movement use their own math and never consume
residue. Fallback if the integrator change proves invasive: keep integer speeds,
accept plateaus explicitly, and re-state the no-dead-band criterion at drill-tier
granularity. Curve shape: power-law α = ln(2)/ln(999) ≈ 0.100 ⇒ ordinary spread ≤ 2.0×
and ≈ **+7.2% per PAC doubling**; the spread bound is pinned as an exact table
invariant, `PACE_SPEED128[999] ≤ 2 · PACE_SPEED128[1]`, asserted by the table test —
the generator adjusts endpoint rounding to satisfy it (naïve rounding slightly
exceeds 2×). `SPEED_REF` anchors a typical current D5 match to look identical to
today. The 2× bound covers ordinary full-condition base speed only. Press spacing
re-expressed through `movementStat`. The PAC geometry criterion (one home-tier drill
⇒ measurable geometry change) applies to the **primary** implementation, not only the
fallback.

### D4 — Stamina: fixed-point tables, both drain scales

`staminaEnduranceScale` **and** `slideStaminaDrainScale` become committed integer
tables with fixed-point denominator **1000** (round-4 correction: 1024 cannot exactly
represent the pinned anchors; 1000 makes them exact integers — 1360, 1120, 678, 650).
**Canonical generator (round-9 implementation correction — anchors alone do not
define 999 entries):** the tables are generated directly from the shipped formulas,
`ENDURANCE1000[v] = round(1000 · staminaEnduranceScale(v))` and
`SLIDE1000[v] = round(1000 · slideStaminaDrainScale(v))` for v = 1…999 (each formula
composed with today's `matchAttribute` exactly as shipped) — STA is absolute-drain
domain, so preserving today's bounded curve at every point is the intent, not a
compromise. One acceptance-forcing correction is applied after generation: if a
home-tier drill endpoint would tie its start because of `matchAttribute` integer
rounding, that endpoint is reduced by the minimum table step (**1/1000**). This is
required at D1's 442→465 step in both tables; without it, criterion 5 is
mathematically impossible. The table test compares **all 999 values** within that
explicit one-step allowance, plus monotonicity, live home-tier drill endpoints, and
the exact anchors (40 ⇒ 1360, 80 ⇒ 1120, 999 ⇒ 678 endurance / 650 slide, floors as
backstops). New rails in the harness:
match-end average condition, auto-substitution counts, and Energy Use decision
distributions must stay within CI bands of the committed baseline.

### D5 — Condition carryover ships in this campaign (LOCKED, owner 2026-07-29)

Acceptance criterion 2 requires a stacking lever; asserting one without sequencing it
was a round-2 blocker. Owner decision §7.1 (the per-player drill cap alternative in
Appendix A was considered and rejected): **career condition carries into kickoff** —
a new immutable
`PlayerDef.startingCondition` field (integer **0–100** — career condition legitimately
reaches zero, src/game/training.ts:102 — default 100, zod/def-validated, serialized in
replay envs, validated on load, with zero-condition starters and substitutes
explicitly tested) replaces both hard-coded sites:
match init (src/sim/match.ts:69) **and** substitution entry (src/sim/substitutions.ts:38
— bench players enter at their own starting condition). Applies identically to watched
matches and Quick Result. Lands in Phase A2. Validation is required, not assumed: the
Appendix A 88–92% figures were hypothetical projections; the ≥90% criterion is
re-measured on the production path in Phase A gates. The condition *system* (drain,
recovery, thresholds) is otherwise unchanged.

### D6 — Powers and authored modifiers: scale-free domains only

No authored effect may be expressed in raw attribute points. Allowed: d64 mods,
multipliers, geometry/time. Audit rows: `dribbleBonus`, `defenseBonus`,
`keeperSaveBonus`, GK Resolve, shot power/`keeperSaveRating` funnel, wind-up
interruption, Fire Torch / Portal Pass / Decoy targeting. Powers keep their catalog,
tiers, timing model, and spectacle exemptions. Power-worth probes and balance rails
are re-run **inside Phase A2**, not deferred.

Measured m2.0 probe center: `EVEN_DELTA = -12` (400 frozen seeds, no-hero
**1.403 PPM**, closest to the locked 1.43 center). The shared single-hero,
multi-hero, and firing probes all consume that one value. A focused paired
400-seed check of the two weakest diagnostic rows found no demonstrated harmful
effect: Phase Run T1 automatic ΔPPM +0.015, 95% CI [−0.132, +0.162], with its
Tier-3 timing ceiling clearly positive; Ice Rink T1 automatic ΔPPM +0.140,
95% CI [−0.007, +0.287], with no statistically established upgrade reversal.

### D7 — Division ladder rebase (Phase B — separate experiment)

**Measured trajectory** (long-career development probe, 2026-07-29; three starters
rotate position drills, TP supplied; fast = promotes every season):

| Season (fast) | Div | Focused trainee raw | Rival club strength | Rival star focus |
|---|---|---|---|---|
| 1 | D5 | 87 | 45 | 94 |
| 2 | D4 | 130 | 55 | 180 |
| 3 | D3 | 173 | 65 | 268 |
| 4 | D2 | 209 | 75 | 356 |
| 5 | D1 | 247 | 85 | 442 |
| 10 (slow track) | D1 | 382 | 85 | 442 |

Focused-trainee ceiling ≈ +35–45 raw/season (TP-supplied; income-constrained careers
grow slower). The owner's sketched ladder (D4 ≈ 130, D3 ≈ 200, D2 ≈ 350, D1 ≈ 450)
already nearly matches shipping star values (180/268/356/442): the rebase is mostly
raising the support band onto the same honest scale.

Phase B deliverables — **locked replacement tables, not deltas** (the star back-solve
`starOverall × 2 − support` goes negative and clamps to 1 if support rises while
`DIVISION_STRENGTH_BANDS` stays put, src/game/pyramid.ts:701):

1. New `DIVISION_STRENGTH_BANDS`, `DIVISION_SUPPORT_STRENGTHS`,
   `DIVISION_TYPICAL_PACE`, explicit star values (back-solve removed or re-derived),
   D4 relegation-pack strengths. The committed D5→D1 support values are
   **40/88/130/175/214**, star-focus values **94/180/268/356/442**, keeper REF
   **80/153/228/303/376**, and typical PAC **72/90/132/176/216**. Ordinary
   squad-strength bands are **40–50 / 90–102 / 135–151 / 178–203 / 223–248**.
   The user's first D4 season has exactly two **39/40 whole-squad** relegation
   strugglers; PAC, specialists, and keeper REF scale with those targets while
   every ordinary D4 club keeps the committed tables. **Per-division GK REF values
   are explicit table entries** (§7.5): with REF fully symmetric in the ratio system,
   these numbers alone set keeper dominance, so the gate set includes a GK-dominance
   rail — **2–5 goals per peer match and a 50–75% save rate in every division**,
   enforcing the owner's locked rule that GK is not the most important player. The
   frozen 100-match-per-division artifact measured **4.32–4.60 goals per match and
   54.2–59.5% saves**. The first provisional REF ladder (45/95/140/190/230) was
   rejected because it yielded 7.87–9.72 goals per peer match and only 27.1–35.1%
   saves; preserving the even worse pre-campaign baseline (7.74–15.32 goals and
   27.2–44.8% saves) would have contradicted, rather than protected, the locked
   keeper rule.
   The final 39/40 D4 bridge measured 2/3 prepared careers surviving versus 1/3
   paired controls, with preparation adding 4.67 points and 92.33 goal difference.
2. **A `squadStrength` consumer matrix** (round-2 finding): inactive-division
   simulation, simulated Cup outcomes, fixture ordering, generator tuning, UI display —
   each re-specified on the new scale. `tuneSquadToStrength` is retired or re-derived
   so it can never overwrite the explicit support/star values; `squadStrength` is
   always **recomputed from actual squads**, never stored-and-drifted.
3. **Rival growth model — fully specified transition** (round-3 finding): at each
   season transition, **all seven** attributes (pac, sho, pas, def, tec, sta, ref —
   REF included, so goalkeepers grow under the same rule) of every non-user-club
   player are multiplied by the division's growth factor (1+g), **g = 0.03 locked**
   (§7.2; Chairman difficulty may step faster via the existing hook):
   `next = floor(attr · (1+g))`, with the fractional remainder promoted to +1 by a
   deterministic per-player-per-attribute roll (seeded from careerSeed, season,
   playerId, attrKey — the pyramid's existing lifecycleRoll pattern; **no stored
   residuals**, so save/reload equivalence is structural). Same percentage for stars
   and support: within-club ratios are preserved **in expectation** (stochastic
   rounding is independent per attribute), so a drift rail is added — measured
   star/support ratio drift ≤ 2% over a 15-season probe. Scope (round-4 finding):
   rival growth is a **standalone step**, separate from the existing user-only
   decline/retirement lifecycle; adding rival decline/retirement (and the replacement
   generation it would require) is explicitly out of scope for this campaign. Cap
   keeping D1 stars ≤ ~700 under 999 across a 15-season endless career; Cozy/Chairman
   hooks; growth measured inside the trajectory probes; a transition-idempotence test
   proves the step applies exactly once per season and reload reproduces identical
   state.
4. **Economy re-derivation**: transfer valuation and wages read raw stats
   (src/game/market.ts:276, src/game/market-career.ts:987) — valuation/wage curves
   re-anchored per division band; market affordability probe; awakening wage-cliff
   (×3–5) interaction check.
5. **Cup upset model — rewritten, giant-killing enabled** (owner decision §7.6;
   Phase-0 finding F2). Today `m2-career.ts` scores a Cup tie as
   `squadStrength + (hash % 7)`: a fixed 0–6 additive bump per side, meaning a club
   can only beat someone **within 6 strength points**. Against divisions 10 points
   wide with clubs ~1.1 apart, that makes same-division ties near coin flips and
   cross-division wins impossible — a D5 club can never knock out a D3 club. Two
   changes, together:
   - **Scale-correct**: the window becomes a percentage of strength, so it means the
     same at every point on the rebased ladder (the current fixed ±6 would go inert
     against strengths in the hundreds).
   - **Long-tailed, not uniform**: a wider *uniform* window cannot deliver both goals
     — widen it enough for a two-division upset and same-division ties become pure
     noise. The draw needs a long tail: mostly small perturbations, occasionally a
     large one. Deterministic and seeded as today (integer math on the existing
     stable hash; no `Math.random`).
   - Provisional targets, tuned and measured in Phase B: same-division tie rate within
     CI of today's baseline; **one division down ≈ 5–10%** of ties won; **two or more
     divisions down ≈ 1–2%** — rare enough that a cup run is a story, not a coin flip.
   - **Bert celebrates every player giant-killing.** After the result is confirmed, a
     qualifying user-club win gets Bert's standard walk-on before the player returns to
     the Cup flow. The trigger uses the divisions recorded for that Cup draw, applies
     identically after a watched match or Quick Result, and never consumes sim RNG.
     AI-only upsets do not interrupt the player with a walk-on.
     - **Exactly one division up — enthusiastic:** title **"You've toppled a
       favourite"**; Bert says: **"Boss, that was magnificent! We've just sent a club
       from the division above packing. That's a proper Cup upset — enjoy this one."**
     - **Two or more divisions up — giant-killer:** title **"GIANT-KILLERS!"**; Bert
       says: **"Boss... we've just killed a giant. A result like this happens only once
       or twice in a hundred tries. What this club has just achieved is extraordinary."**
     Each qualifying win earns its own celebration, even if the player produces more
     than one giant-killing in the same Cup run.
6. Seasons beyond 10, and the D5 opening anchored unchanged (user 40 vs opener 50,
   creation cap 65).
7. **Save schema boundary lands here, not later** (round-2 blocker): Phase B changes
   the persisted pyramid, so the schema bump + refuse-and-reset flow ship in the same
   PR. **Implementable data path** (round-3 finding — the current export requires a
   successfully decoded current-schema `GameState`, which an incompatible save cannot
   produce, and the existing hard reset drops every table): backup-export reads the
   **raw stored payload pre-decode** (bytes/JSON as persisted, no schema decode); if
   the user requests export and it fails, reset is blocked; the reset itself
   transactionally deletes **only** the career slot and its associated
   replays/backups — an explicit test proves preferences/settings and unrelated data
   survive. Old save preserved untouched until the user confirms; cancel,
   relaunch-mid-flow, and failed-reset paths all tested. Dev-phase policy permits
   breaking saves (owner 2026-07-24); silent ladder mixing and silent deletion are
   prohibited.

### D8 — Versioning, goldens, runtime parity (Phase C wrap-up)

- `ENGINE_VERSION` m1.30 → **m2.0**, bumped once — inside the single atomic Phase A
  PR, which contains every replay-affecting engine change (§6); stored replays are
  refused on mismatch by the existing check (src/sim/match.ts:463).
- Regenerate the Jest parity snapshot and `EXPECTED_RUNTIME_GOLDEN`. **Honesty note
  (round-2 finding): the runtime-golden Jest test executes under Node** — updating the
  fingerprint alone does not prove Hermes parity. Criterion 9 is narrowed accordingly,
  and the gate matrix adds one real Hermes execution: boot the app once on
  device/simulator and confirm the `assertRuntimeGoldenReplay` boot assertion passes
  (the native-gate harness memory documents how).
- New committed tables (`log-table.json`, `clog-table.json`, `pace-table.json`,
  stamina tables): length/contents/monotonicity tests, regeneration-drift test
  (script ⇔ committed file), import-layer allowlist entries, determinism-guard
  extension.

### D9 — What does NOT change

Sim architecture and determinism rules, powers catalog and Heat/Zone model, drill
content values and tier unlocks, TP economy, condition drain/recovery/thresholds
(kickoff honoring in D5 is the only condition change), tactics, Quick Result parity,
fail-soft economy, `MAX_PLAYER_ATTRIBUTE = 999`.

## 4. Blast radius (honest inventory)

Engine version + goldens + one real Hermes boot check (D8) · balance harness
re-centering (EVEN_DELTA — ships in Phase A with the behavior change) and all probe
baselines (each in its owning phase) · power-worth constants in docs
03/04/09 · docs 03/04/05 rewrites (compression, pace targets, stamina bands) · GK
balance under the locked owner rule (GK not most important; compress REF, don't
inflate SHO) · market/wage economy (D7.4) · auto-coaching margins (D0) · condition
carryover UX copy (D5) · Bert's Cup giant-killing walk-on and exact copy (D7.5) · UI
stat displays (audit ≤99 assumptions for rivals) · save schema + reset flow (D7.6).

## 5. Acceptance criteria

Statistical protocol for every baseline-equivalence rate criterion: frozen, committed
1,000-seed calibration and 1,000-seed held-out lists; committed baseline artifact;
paired per-seed differences with a 95% bootstrap CI computed with a **frozen resample
count (10,000) and a fixed, committed bootstrap PRNG seed** so results are
bit-reproducible in CI. Calibration chooses K with every untrained W/D/L point
difference inside ±3 pp; the untouched held-out gate passes only when every paired
W/D/L CI lies wholly inside ±3 pp. Direct target rails must pass independently in
both cohorts.

Implementation correction (same-day gate finding): condition carryover deliberately
changes the trained path. The original held-out trained build lost 87.8% while the
locked final rail requires ≥90%, so requiring the final trained path to remain
baseline-equivalent is logically invalid. Baseline equivalence therefore applies to
the untrained contest calibration; the trained production path is pinned by criterion
2 in both cohorts. No owner decision or player-facing target changes.

1. Untrained opening: loss rate in [90%, 95%] in both 1,000-seed cohorts; calibration
   point W/D/L differences and held-out paired CIs vs the committed baseline follow
   the protocol above.
2. Max-stacked opening (with D5's condition carryover, or the owner-chosen
   alternative): loss rate ≥ 90%, measured on the production path — not carried over
   from Appendix A's hypothetical.
3. Phase A1 gate: ladder unchanged, contest sites only — fitted K reproduces the
   untrained baseline opening W/D/L on the 1,000-seed calibration set, then holds
   every paired W/D/L CI inside ±3 pp on the frozen 1,000-seed held-out set without
   re-fitting. Re-validated unchanged after A2 and A3; the deliberately changed
   trained path follows criterion 2 instead of baseline equivalence.
4. A trains-well club promotes from each division in 1–2 seasons; a never-trains club
   does not promote from D5 (income-constrained division-ramp probe).
5. No dead band, per domain: at each division, one home-tier drill on a star at that
   division's star rating (a) shifts a same-role contest probability by ≥ 1 pp
   (property test), (b) for PAC, produces a measurable geometry change (primary
   implementation and fallback alike), and (c) for STA, measurably changes the drain
   outcome (match-end condition delta, monotonic per tier).
6. Quantized ratio invariance: for random (a, b, s) with s·a, s·b ≤ 999, contests
   (a vs b) and (s·a vs s·b) resolve within one interpolation step (≤ 0.1 pp).
7. Ordinary full-condition base speed spread between any two players ≤ 2.0×
   (powers/slides/carrier/energy exempt).
8. D1 title race, numeric: trained user star vs same-role D1 star rating ratio within
   [0.80, 1.25] at first D1 season (competitive), and user star vs D1 same-role
   support average ≥ 1.7× (the fantasy). Provisional values — the owner may retune
   them **before Phase B starts**, after which they freeze for the campaign.
9. Determinism: byte-identical replays across runs on Node; Node goldens green; **one
   real Hermes boot-assertion run green** (narrowed per D8).
10. Headroom, policy-qualified: an organically played 15-season endless career keeps
    rival stars and trained user players under 999; deliberate max-stacking may reach
    the cap earlier (inputs then throw-guarded per D1, gameplay clamps at the cap).
11. Full gate matrix per phase: typecheck, unit suites, balance harness, power probes,
    economy probes, save load/reload + reset-flow tests, Quick Result ⇔ watched parity.
12. Cup upsets (Phase B, §7.6): same-division tie rate within CI of the committed
    baseline; one division down 5–10% of ties won; two-plus divisions down 1–2%.
    Measured over a multi-season probe, not a single cup. Presentation tests pin Bert's
    exact one-division and two-plus-division copy, prove each qualifying user win
    produces exactly one walk-on after both watched and Quick Result paths, and prove
    same-division wins, defeats, and AI-only upsets produce none.
13. Auto-substitutions (F1): the ratio-based role value and margin reproduce today's
    D5 substitution frequency within CI, **and** a trained squad (raw 200–400) no
    longer substitutes more eagerly than a D5 one — the present-day defect the raw
    comparison causes. The frozen 5,000-scenario scale gate permits only the same
    one-interpolation-step quantization tolerance as criterion 6: trained-minus-D5
    point frequency ≤ 0.1 pp, with its paired 95% CI inside ±0.3 pp.

## 6. Sequencing

Repository rule (round-3 blocker): every replay-affecting change that merges must
carry its own `ENGINE_VERSION` bump and golden rebaseline. Therefore **Phase A is one
atomic PR** — A1/A2/A3 are sequenced, individually-gated commits inside it, each with
its committed probe artifact, and the single m1.30 → m2.0 bump plus both golden
updates land in that same PR. Nothing replay-affecting merges unversioned. Rails and
doc updates ship **with the phase that changes the behavior**, not deferred to
Phase C.

1. **Phase 0 (PR 1)** — commit the stat-domain matrix incl. execution formulas and
   the `squadStrength` consumer matrix; split `effectiveStat`; extract the shared
   shot/save helper. Refactor-only; goldens must not move.
2. **Phase A (PR 2, atomic; internal sub-gates):**
   - *A1 commit(s)* — LOG64/CLOG64 + interpolation on contest call sites, **including
     the contest-participating power bonuses** (`dribbleBonus`, `defenseBonus`,
     `keeperSaveBonus`, GK Resolve) converted to typed d64 mods here — they feed
     contests directly today, so K must be fitted against the complete contest domain
     (round-4 finding); fit K; criterion 3 gate artifact committed. Nothing else
     changes.
   - *A2 commit(s)* — execution formulas, decision helpers, execution/targeting power
     effects, condition carryover (D5); power-worth probes + rails re-run and updated
     here; K re-validated, not re-fit.
   - *A3 commit(s)* — pace + stamina fixed-point tables; K re-validated;
     ENGINE_VERSION → m2.0, parity snapshot + runtime golden regenerated, docs/03
     engine sections updated in the same PR.
   - *Merge gate:* the Hermes boot assertion (`assertRuntimeGoldenReplay` in a
     development build on device/simulator) runs **before this PR merges** — runtime
     parity protects the change, it is not deferred to Phase C (round-4 finding);
     Phase C repeats it as the final pass.
3. **Phase B (PR 3)** — ladder/growth/economy tables + save schema & reset flow (D7);
   engine untouched, but fixture/tuning constants shift ⇒ probe baselines re-committed;
   re-run opening-gap, opening-matches, division-ramp, promotion-survival, hero-value,
   power-firing probes; docs/05 roster/economy sections updated here.
4. **Phase C (PR 4)** — remaining docs 03/04 narrative rewrites, unrelated CI wiring,
   a repeat of the full verification pass (including the Hermes boot check), cleanup.
   **No thresholds or baselines move here** (round-5 correction): EVEN_DELTA and every
   affected rail/baseline ship inside Phase A (engine behavior) or Phase B (ladder),
   with the change that moves them.

## 7. Locked decisions (owner, 2026-07-29)

All open questions are decided (1–5 on 2026-07-29 before Phase 0; 6 added the same day
once the Phase-0 audit surfaced it). These are inputs to the campaign, not defaults —
changing one after Phase 0 starts invalidates the affected gate artifacts.

1. **Stacking lever: condition carryover** (D5). Career condition carries into kickoff
   and substitution entry; the per-player weekly drill cap is **not** taken. Acceptance
   criteria 1–2 are measured against this.
2. **Rival growth: +3%/season**, per-division percentage step, capped per D7.3 —
   the bottom of the proposed band, chosen for deliberately gentle pressure. Sanity
   check at this value: a D1 star at 442 gains ≈ +13/season, a D5 star at 94 gains
   ≈ +3/season, against a focused trainee's measured +35–45/season, so a training club
   always outpaces the league. Compounded over a 15-season endless career,
   442 × 1.03¹⁵ ≈ 689 — under the ~700 headroom target and well clear of 999.
3. **`MAX_PLAYER_ATTRIBUTE` stays 999.** 3-digit UI preserved; headroom guaranteed by
   the D7.3 cap; deliberate max-stackers who reach 999 simply stop growing that stat.
4. **Ordinary-speed spread budget 2.0×**, powers/slides/carrier/energy exempt (D3),
   pinned as the exact table invariant `PACE_SPEED128[999] ≤ 2 · PACE_SPEED128[1]`.
5. **GK REF joins the ratio system fully symmetrically** via the locked keeper-oriented
   save mapping (D0) — no damping term. Consequence, recorded deliberately: keeper
   dominance is now tuned by each division's **REF roster values**, an explicit number
   in the Phase-B ladder tables, rather than by a hidden curve. The owner's locked
   2026-07-25 rule (GK is not the most important player; compress REF, don't inflate
   SHO) is enforced there, and a GK-dominance rail is part of the Phase-B gate set.
6. **Cup giant-killing enabled** (added 2026-07-29 after Phase-0 finding F2 revealed
   that the current formula forbids it entirely). The upset window is rewritten as a
   long-tailed percentage of strength; a club one division down should win ≈ 5–10% of
   ties and two-plus divisions down ≈ 1–2%, with same-division rates held at today's
   baseline. Every qualifying player victory gets Bert's standard post-result walk-on:
   enthusiastic for one division, and an emphatic **GIANT-KILLERS!** celebration that
   states the one-to-two-in-a-hundred rarity for two or more divisions. Detail, exact
   copy, and rationale in D7.5.

## 8. Implementation verification (2026-07-29)

All 13 acceptance criteria pass in the final `m2.0` tree:

| # | Final evidence |
|---|---|
| 1 | Untrained opening losses are **91.1%** on the 1,000-seed calibration cohort and **91.7%** held out; every frozen paired W/D/L confidence interval stays inside ±3 pp. |
| 2 | The production max-stacked path loses **94.3%** on calibration and **92.5%** held out, including career-condition carryover. |
| 3 | Whole-match fitting selected **K = 29** and `SHOT_KEEPER_MOD_D64 = 0`; the untouched held-out artifact passes after A2/A3 without refitting. |
| 4 | The trained division-ramp cohort promotes **2/2 in season 1**; the never-trains cohort promotes **0/2 after season 2**. |
| 5 | Contest probability, PAC geometry, and both STA drain tables respond to one home-tier drill at all five division anchors. D1's formerly tied 442→465 STA endpoint moves by the documented minimum 1/1000 table step. |
| 6 | The deterministic random ratio-property suite holds every scaled contest within **0.1 percentage points**. |
| 7 | The generated pace table is strictly increasing and its maximum ordinary speed is no more than exactly **2×** its minimum. |
| 8 | The first-D1 trained-star probe passes both locked ratio rails: 0.80–1.25× the D1 role star and at least 1.7× D1 support. |
| 9 | Repeated Node replays and both committed goldens pass. A real Debug Hermes simulator boot logged **`HERMES_GOLDEN_OK 423e7304`**. |
| 10 | Fifteen-season Cozy rivals stay at or below **700** with star/support ratio drift at or below **2%**. On the final combined tree's 1.3× youth-training curve, the organic three-tap active-manager path peaks at **539**; the intentionally supplied-TP max-stack path reaches the permitted **999** exception. |
| 11 | TypeScript, the full Jest suite, web export, balance/power/economy probes, save load/reload/reset flow, and watched/Quick Result parity all pass. Final combined-tree Jest result: **240 suites passed, 1 skipped; 2,000 tests passed, 1 skipped; 3 snapshots passed**. |
| 12 | Frozen Cup measurement: same-division weaker side **35.625%**, one division down **7.5%**, two-plus divisions down **1.415%**. Exact Bert copy, watched and Quick Result delivery, FIFO repeat wins, and all no-false-trigger cases pass. |
| 13 | The frozen **5,000-scenario** auto-substitution artifact reproduces the D5 reference and keeps trained-scale eagerness within the 0.1 pp point rail and ±0.3 pp paired-CI rail. |

Additional locked gates pass: the 100-match-per-division goalkeeper artifact records
**4.32–4.60 goals** and **54.2–59.5% saves**; the D4 39/40 bridge lets 2/3 prepared
careers survive versus 1/3 controls, with preparation worth +4.67 points and +92.33
goal difference. The incompatible-save UI was also rendered on the Debug Hermes run,
including Retry, Export Raw Save, and Delete Save — Start Fresh.

## Appendix A — Key numbers from the 2026-07-29 opening-match balance report

Opening match, real 7-drill stacks through the production path (140 seeds): untrained
hero ⇒ ~95% losses; stacked to raw SHO 126–135 (effective 105–107) ⇒ ~84% losses; the
SHO ladder 87→97→125→250 raw moved losses only 90.7% → 85.0% → 84.3% → 74.3% —
nearly all stacking benefit arrives in the first ~30 raw points. At that report's
baseline, career condition was discarded at kickoff (`condition: 100` in the old
`src/sim/match.ts:69` path). **Hypothetical** runs honoring it (engine-side projection,
not then the production path) restored ~88–92% losses — motivating D5. The implemented
production path is now measured in criterion 2. Growth-tuning alone (base 5→4, youth
1.5→1.25, hero −10) measured ~84% → ~85%: not a viable path to the ≥90% target. The
considered alternative lever was a per-player weekly drill cap (1 drill/player/week
landed raw SHO 81–89 ⇒ ~90–91% losses in the same measurement).
