# Phase 0 — Stat-Domain Matrix and Consumer Audit

Date: 2026-07-29 · Companion to `2026-07-29-scale-invariant-attributes.md` (r9)
Status: **Phase 0/A/B/C implemented and verified**

This is the contract Phase 0's refactor implements against, plus the findings from
reading every attribute consumer in `src/sim`.

**Final-tree note (2026-07-29).** The §4 refactor was verified behavior-preserving
before A1. The completed tree now uses `ratingD64`/`conditionD64`/`resolveD64`, the
generated fixed-point tables, and the single `m2.0` engine-version bump. The parity
snapshot and runtime golden were deliberately rebaselined only after all
replay-affecting Phase-A work landed. Final verification is recorded in §8 of the
master spec, including the real Hermes fingerprint `423e7304`.

## 1. The four domains

| Domain | Meaning | Becomes (Phase A) |
|---|---|---|
| **contest** | Resolved by a roll through `contest` / `contestProbability` | LOG64 log-ratio + `d64` mods (A1) |
| **movement** | Rendered speed and the spacing geometry derived from it | `PACE_SPEED128` bounded table (A3) |
| **execution** | Continuous quantities an action produces (aim, power, threat) | Bounded curves keyed off `d64` (A2) |
| **decision** | AI comparisons between players/options, never rolled | Ratios / normalized shares (A2) |

Enforcement: `src/sim/engine.ts` no longer exports an undomained `effectiveStat`.
Every call site now reads through `contestStat` / `movementStat` / `executionStat` /
`decisionStat`, which delegate to one private `conditionedStat` core. The four are
identical today **on purpose** — they are the seams that let A1/A2/A3 change one
domain at a time without hunting call sites.

## 2. Sim consumer matrix (`src/sim`)

### contest — 11 sites

| Site | Read | Notes |
|---|---|---|
| `engine.ts` pass launch (2 sites: expected + actual) | `pas` vs `interceptStat` (`def`-derived), mod 10 | Mod already probability-space; carries over as `d64Mod` |
| `engine.ts` marker duel | `def` + `defenseBonus` vs `tec` | Power bonus is a raw-point add ⇒ becomes `d64Mod` in **A1** |
| `engine.ts` tackle win | `def` + `defenseBonus` vs `tec` | Same |
| `engine.ts` slide tackle | `def` vs `tec` | |
| `engine.ts` `keeperSaveRating` | `ref` | Holds the **REF compression divisor** — see finding F4 |
| `engine.ts` save resolution + `shotExpectedValue` | keeper rating vs shot power, `SHOT_KEEPER_MOD` | Now single-sourced — see §4 |

### movement — 5 sites

| Site | Read | Notes |
|---|---|---|
| `engine.ts` `speedFor` | `pac` via `matchPaceAttribute` | Primary A3 target |
| `engine.ts` press standoff (2 sites) | carrier `pac` vs presser `pac` | Additive difference feeding a radius; **no PAC contest exists anywhere** — confirmed |
| `engine.ts` `drainStamina` | `sta` (raw, via `staminaEnduranceScale`) | A3 table |
| `engine.ts` `drainSlideCondition` | `sta` (raw, via `slideStaminaDrainScale`) | A3 table; different endpoint from the above (0.65 vs 0.678) |

### execution — 5 sites + 3 in powers

| Site | Read | Notes |
|---|---|---|
| `engine.ts` `shotSpreadAt` | `sho` | Contains a **second hidden compression branch** — finding F3 |
| `engine.ts` `shotPowerAt` | `sho` | `/4` divisor: SHO's second contribution deliberately damped |
| `engine.ts` `poweredFinishChallengeHeadroom` | `sho − ref` | Raw-point difference ⇒ `d64` in A2 |
| `engine.ts` `positionThreat` skill scale | `sho` | `0.16 + sho/500`, unbounded — finding F5 |
| `powers.ts` finish/technique grades | `sho·8 + tec·4 + pas·2`, `sho·4 + tec·2` | Weighted raw sums, scale-explosive — A2 |
| `powers.ts` decoy matchup | `tec − def` | Raw difference — A2 |

### decision — 1 site (plus the derived evaluators)

| Site | Read | Notes |
|---|---|---|
| `auto-coaching.ts` `automaticRoleValue` | weighted `sho/tec/pac/pas`, own condition curve | **Bypasses `matchAttribute` entirely** — finding F1 |

`shotExpectedValue`, `positionThreat`, and `opponentTurnoverCost` are decision
*evaluators* built from contest + execution primitives; they inherit whatever those
domains do and are not separately re-based.

### Phase A2 execution and decision formulas

These are the signed-off per-site formulas required by D0. All constants below are
committed as d64 values or bounded output anchors; none are raw attribute-point
bonuses.

| Site | Phase A2 formula |
|---|---|
| `shotSpreadAt` | Let `q = contestProbability(conditioned SHO64, conditioned opposing REF64)`. Close-range spread is `round(1200 − 700q)`, bounded to 500–1200 pitch units, then the existing distance, pressure, and authored aim multipliers apply. |
| `shotPowerAt` / save | `shotStrength64 = conditioned SHO64 + finishPowerD64Mod − round(distance·37/200)`. The save helper consumes this value directly. The 37-d64 geometry anchor is the measured A2 correction: 64 preserved the old raw-point penalty literally but double-counted its former rating-space compression, yielding only 0.77 goals/match; 32 restored ordinary scoring but made the untrained opener lose 97.5%, above its 95% rail. The player-facing/event `power` and Resolve damage use `clamp(round(60 + (shotStrength64 − LOG64[60])/64), 1, 999)`; this display projection never feeds the save probability back. |
| powered-finish headroom | Full through SHO:REF = 1.10, linearly fades in d64 space, and reaches zero at 1.25. Equal elite opponents therefore retain the authored finish while an already dominant shooter cannot stack it linearly. |
| `positionThreat` | With the same keeper-relative `q`, skill scale is `0.16 + 0.30q`, exactly bounded to 0.16–0.46; geometry and direct shot EV remain unchanged. |
| Fire marker duration | `TEC64 − DEF64` replaces `TEC − DEF`; full effect through a 1.08 ratio and saturation at 1.30, with the existing minimum duration and authored strength interpolation. |
| Portal receiver and Decoy forward | Each candidate gets a weighted mean of raw LOG64 attributes using the shipped weights. That mean is converted to a 0–1000 normalized share against the eligible same-team candidate mean through `contestProbability`; geometry terms remain separate. Scaling every candidate's ratings by the same factor leaves the share unchanged within table precision. |
| auto-sub role value | Weighted mean of conditioned LOG64 attributes using the shipped role weights. The ordinary replacement margin pins today's exact D5 boundary: at condition 60, a fresh 48 clears a tired 50 while a fresh 47 does not. The same ratio improvement is required at every scale within one quantization step; emergency substitutions remain margin-free. |

Power finish anchors become typed `powerD64Mod` values fitted from the shipped
rating-57 baseline (for example +4 → 139 d64, +14 → 450, +22 → 669, +26 → 770,
+28 → 819, +34 → 958, and Thunder's +70 → 1641 at full strength). These are
authored contest-space effects, not raw attribute bonuses or values regenerated
when K changes; the power-worth rails pin their final value. Aim multipliers remain
allowed scale-free effects.

## 3. Findings that change the plan

**F1 — auto-coaching compares raw attributes; the match compares compressed ones.**
`automaticRoleValue` applies its own `0.75 + 0.25·cond/100` curve to **raw**
`player.attrs`, never `matchAttribute` — a raw-250 player is ranked as 250 while
playing as 121.

This is **already a live defect, not only a post-rebase one.** `ROLE_VALUE_MARGIN = 300`
is 3 player-facing points: roughly 8% of a Division 5 player's value, but ~0.75% of a
trained 400-rated star's. So a user running Auto Subs with a well-trained squad already
swaps players on differences too small to matter, while rival clubs (raw 33–46) behave
as designed. The rebase makes it universal rather than causing it.

**Resolution:** A2 re-expresses both the role value and the margin as ratios, gated by
acceptance criteria 13 — reproduce today's D5 substitution frequency, and confirm a
trained squad no longer substitutes more eagerly than a D5 one. No owner decision was
required; the anchor is measured current behavior.

**F2 — Cup results cannot survive a ladder rebase, and forbid giant-killing today.**
`m2-career.ts` scores a simulated Cup tie as `squadStrength + (seededTie % 7)` — a
fixed 0–6 additive bump per side, so **a club can only beat someone within 6 strength
points of it.** Measured against the current ladder (divisions 10 points wide, 10
clubs each, so rivals sit ~1.1 apart):

- same-division ties are near coin flips;
- one division up is unreachable — D5 averages 45 against D4's 55, and a 10-point gap
  never closes;
- **a Division 5 club cannot knock out a Division 3 club. Not rarely — never.**

Against rebased strengths in the hundreds the fixed window would go inert entirely and
the Cup would become fully deterministic by strength.

**Resolution (owner decision, §7.6 of the spec — giant-killing enabled):** Phase B
rewrites the window as a *long-tailed percentage* of strength. Both properties are
needed and a uniform window cannot provide them together — widening a uniform draw
enough to permit a two-division upset turns same-division ties into pure noise.
Targets: same-division rate held at today's baseline, one division down 5–10%, two-plus
divisions down 1–2% (acceptance criterion 12). Determinism is preserved: integer math
on the existing seeded hash.

**F3 — `shotSpreadAt` hides a second compression curve.** Close-range spread is
`sho ≤ 99 ? 500 + (99 − sho)·8 : 50_000/(sho + 1)` — an independent post-99 curve that
nobody has been counting as compression. It must be re-expressed in A2, or high-SHO
aim silently keeps its own asymptote after `matchAttribute` is gone.

**F4 — the REF divisor is the GK balance decision, in code.** `keeperSaveRating` is
`57 + (ref − 57)/4`: the "compress REF, don't inflate SHO" fix from 2026-07-25, with
its measured tuning table in the comment above it. Owner decision §7.5 makes REF fully
symmetric, so **A1 replaces this divisor** and Phase B's per-division REF roster values
become the only place keeper dominance is set. The existing comment block is the
baseline to re-derive against.

**F5 — `positionThreat` skill scale is unbounded.** `0.16 + sho/500` is currently
capped in practice because `matchAttribute` limits `sho` to ~149 (max scale ≈ 0.46).
Remove compression and a 999-SHO striker reaches 2.16 — a ~5× threat inflation that
would distort every AI decision. A2 needs a bounded form.

## 4. Phase 0 refactor (implemented)

1. `effectiveStat` → private `conditionedStat` + four exported domain helpers
   (`contestStat`, `movementStat`, `executionStat`, `decisionStat`); all 17 call sites
   migrated to declare their domain; two test files updated.
2. Extracted `keeperSaveProbability` — the single expression of the shot/save contest,
   read by both the shooter's decision model and the ball's actual arrival.
   The keeper power bonus stays a **caller argument** because the two sites genuinely
   disagree today (the decision model omits it). That asymmetry is now explicit and
   documented instead of accidental; unifying it changes behavior and belongs to A1.

Verification: `npx tsc --noEmit` clean; parity-replay snapshot, runtime golden, engine
and tactics suites all pass **unchanged** — no `ENGINE_VERSION` bump required for
Phase 0, exactly as the plan requires.

## 5. `squadStrength` consumer matrix

Phase B changes the scale of every division, so a stored strength may only be a
cache of the squad currently beside it. Any operation that mutates a squad must
recompute the cache from actual role ratings in the same state transition.

| Consumer | Purpose | Phase-B rule and resolution |
|---|---|---|
| `pyramid.ts` generator | Targets the ten-club band | Generates explicit support, specialist, PAC, and GK REF values; `tuneGeneratedSquadToStrength` may adjust support-domain cells only, then writes `averageSquadStrength(actual squad)`. It cannot overwrite the protected authored values. |
| `pyramid.ts` D4 safety pack | Creates two relegation-level D4 rivals | The two selected clubs are an explicit whole-squad exception: PAC, specialists, and keeper REF scale with their 39/40 target so the displayed bridge is honest in the match engine. All ordinary D4 clubs are cloned unchanged and retain the division tables. |
| `m2-career.ts` inactive finish order | Orders divisions the player did not watch | Reads `currentClubStrength`, which recomputes from a non-empty squad. The stored field is only a legacy fallback for a structurally empty club. |
| `m2-career.ts` simulated Cup | Compares clubs in AI-only ties | Multiplies recomputed actual strength by the deterministic long-tail performance basis points; never trusts a drifted cache and never adds fixed raw points. |
| `m2-career.ts` rival growth | Applies the one season step | Grows every actual player attribute, then writes `clubSquadStrength(grown squad)` in the same pure transition. |
| `m2-career.ts` active-division synchronization | Copies live career players into the persistent pyramid | Rebuilds each active club's squad and strength together. This prevents matchday/transfer changes from leaving the pyramid display behind. |
| `market-career.ts` inactive transfers | Removes a player from a persistent rival | Writes the modified squad and recomputes the club strength atomically. |
| `full-career.ts` fixture seeding | Pins the intended opening opponent order | Builds its map from the live user squad and recomputed/generated opponent strengths after growth. |
| `application/m2-league-view-model.ts` | Displays the user's and division's comparison | Reads the synchronized cache only; every upstream mutation listed above owns recomputation, and codec tests reject non-positive or out-of-range values. |

Verification lives in the pyramid, M2 career, market-career, full-career, and
league view-model suites. The growth idempotence test additionally proves a
save/reload cannot apply the percentage step twice.
