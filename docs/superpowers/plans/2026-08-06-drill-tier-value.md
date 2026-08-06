# Drill tier upgrades have to be worth buying

**Date:** 2026-08-06
**Owner request:** "the upgrades went from +4 for 10TP to +6 for 15TP. it doesn't
actually give me a better deal, but i have to spend 3k to do this. It should be
15TP for +7. make it a slightly better deal. do that for all upgrades, including
scaling it."

**Revision 3** — after three rounds of Grok review. Five claims in that review were checked
against the source and all five held; the plan below is the corrected one. The
headline change is that this is **not** a content-only edit: it needs a schema
change and it uncovers a latent engine bug that must be fixed first.

## The defect

Every focus drill has a TP cost and an attribute gain. Dividing one by the other
gives what a tier actually buys — TP spent per attribute point:

| Tier | TP | Outfield gain | TP per point | Cash price |
| --- | --- | --- | --- | --- |
| I | 10 | 4 | **2.500** | owned |
| II | 15 | 6 | **2.500** | $3,000 |
| III | 21 | 10 | 2.100 | $8,000 |
| IV | 28 | 14 | 2.000 | $18,000 |
| V | 36 | 18 | 2.000 | $40,000 |

Tier II is the owner's case and it is exact: **2.500 TP/point at tier I and
2.500 at tier II.** Three thousand pounds buys a bigger single click and not one
point of extra throughput. Tier V has the same defect against tier IV — 2.000
and 2.000 — so the most expensive upgrade in the game ($40,000) is also a pure
convenience purchase.

## The blocker underneath it

`keeperDisplayLadderMultiplier(state, drillId)` returns
`referenceGain / ownGain` **for the tier of the drill id it is given**. It has
two callers and they pass different things:

- `training.ts:124` (the preview) passes `drill.id` — the **owned tier's** id.
- `training.ts:237` (`trainPlayerInstantly`, the resolve) passes `pathId` — which
  is the **tier-1** id, e.g. `keeper-drills`.

Today every keeper tier is exactly half its outfield reference (2/4, 3/6, 5/10,
7/14, 9/18), so both calls return 2 and the disagreement is invisible. **Any
ladder where the halving is not exact makes them diverge**: the preview would
promise a keeper +7 displayed while the resolve banked a display bonus computed
at ×2, landing roughly +8. That is a preview-versus-result desync at exactly the
tiers the upgrade shop exists to sell.

**This is fixed first, on its own, before any number moves.**

## The new ladder

### Outfield

| Tier | TP | Gain (old → new) | TP per point (old → new) |
| --- | --- | --- | --- |
| I | 10 | 4 → 4 | 2.500 → 2.500 |
| II | 15 | 6 → **7** | 2.500 → **2.143** |
| III | 21 | 10 → **11** | 2.100 → **1.909** |
| IV | 28 | 14 → **16** | 2.000 → **1.750** |
| V | 36 | 18 → **22** | 2.000 → **1.636** |

Improvement per step: 0.357, 0.234, 0.159, 0.114. Monotonic, decelerating, no
tier a sidegrade. TP and cash costs are untouched — the owner asked for a better
deal at the same price.

### Keeper

The keeper ladder is half the outfield one, and the halving is load-bearing:
`refDisplayBonus` exists so the halved ladder still *reads* like the outfield
one. Two of the new outfield gains are odd, so "half" no longer divides.

**Round up: 2 / 4 / 6 / 8 / 11.** The alternative (round down: 2 / 3 / 5 / 8 / 11)
leaves keeper tier II unimproved, which ships the reported bug for one of the
seven paths. Round-up makes keeper tier II a +33% jump against outfield's +17%,
which is a real keeper buff — see the measurement note below, which is honest
about what CI can and cannot tell us.

Resulting display multipliers stop being a constant 2: they become 2, 1.75,
1.833…, 2, 2. The shadow-bonus maths was built for non-half ladders and handles
this **once the call-site bug above is fixed**; the comments and tests that
assert "exactly half" and `multiplier === 2` must be updated deliberately.

## Implementation, in order

1. **Fix the call site.** `training.ts:237` → `keeperDisplayLadderMultiplier(state, drill.id)`.
   Add a regression test that pins preview against resolve on a **non-exact-half**
   tier, so the bug cannot come back the next time the ladder moves. The test
   injects its own `trainingRules` (outfield 7 / keeper 4 at tier II) rather than
   waiting for the shipped content, and takes an age in the flat band so the
   structural multiplier is the only thing under test.

   **SUPER has to be excluded from the result, not from the setup.** Clearing
   `drillsSinceSuper` only disables the *pity* branch; `isSuper` is
   `pityReached || instantDrillRoll(...) < superChance`, and the random half
   still fires at the potential grade's chance while the preview never rolls it
   at all. Assert `result.isSuper === false` (or compare only on a resolve that
   came back non-SUPER, or pick a seed known to miss); a test that merely clears
   pity is flaky, not pinned.
2. **`src/content/schemas.ts`** — `FOCUS_DRILL_TIERS` gains `4/6/10/14/18` →
   `4/7/11/16/22`, and the keeper path's `gains: [2, 3, 5, 7, 9]` →
   `[2, 4, 6, 8, 11]`. Zod validates every drill against these, so editing the
   JSON alone fails content load with `must grant exactly +N ATTR`.
3. **`content/training.json`** — the same 35 gains.
4. **`src/content/__tests__/content.test.ts`** — the ladder pin.
5. **Save policy: rebase in `reconcileLaunchRoster`, not the codec.**
   `trainingRules.focusDrills` is persisted into the career
   (`game-state-codec.ts:1282`), so an in-progress career keeps the old gains
   forever unless the loader replaces them — a balance fix the owner cannot see
   in the save he is playing is worse than no fix.

   The hook is `reconcileLaunchRoster` in `src/application/launch.ts`, which the
   store already calls on resume and which already holds `content`. It currently
   injects `trainingRules` only when the field is `undefined`; it must instead
   replace `focusDrills` from current content whenever the stored catalog
   differs. **Not** the codec's retired-field strip: that path has no access to
   launch content and must not grow a content dependency to get it.

   Compare the catalogs and set `changed` **before** the function's early return
   — it bails out when nothing changed and does so before applying patches, so a
   comparison made after it would never rebase a save that already has a
   `trainingRules` field. Set `changed` only when the catalog actually differs,
   so a second reconcile is still a no-op; `launch.test.ts` pins that
   idempotence. Add a load test: a save carrying the old gains comes back
   matching content.

### Tests that pin the current numbers

Named, not "search":

- `src/game/__tests__/training-paths.test.ts` — tier III pac 10 → 11
- `src/application/__tests__/training-tier-unlocks.test.ts` — Sprints 4 gain 14 → 16
- `src/application/__tests__/displayed-attributes.test.ts` — keeper expected table
- `src/game/__tests__/keeper-display-bonus.test.ts` — `multiplier === 2` now holds
  only for the exact-half tiers
- `src/application/__tests__/keeper-display-parity.test.ts` — comments and assumptions

## What the rails will and will not catch

This is the part revision 1 got wrong, and it matters because it decides what
"measured" means here.

- **`training-leverage-rails` will not move, and that is expected.** Its own
  header records that an opening career only ever owns tier 1, and that scaling
  keeper tiers 3–5 moved nothing. Tier I is unchanged, so this rail is blind to
  the entire change. A green rail here is **not** evidence the keeper round-up is
  safe.
- **`keeper-display-drift-rail` is a tier-1 canary, not a measurement of this
  change.** It trains for 150 taps and never buys an upgrade, so the owned tier
  stays 1 and the shortfall it sees is the unchanged 2-against-4. Expect
  `MAXIMUM_KEEPER_DISPLAY_DRIFT = 460` to hold; re-measure to confirm it, and do
  not go looking for a retune the higher tiers would justify — this rail never
  reaches them. Its value here is as an always-on guard that the display lie
  stays healthy after the call-site fix, and that tier I was not damaged.
- **`m2-balance` is the wrong instrument for climb pace.** Its own comment says
  headless scoring ignores squad strength entirely. It is an economy and plumbing
  rail. Run it — it must stay green — but do not read it as evidence about
  promotion pace.
- **Nothing measures mid-career tier II–V throughput today.** The honest position
  is that the round-up keeper buff and the +22% tier-V outfield gain are shipped
  on judgement and playtest, with **no** automated mid-career rail behind them —
  the drift rail stays a tier-1 canary and covers none of this. If a mid-career
  measurement is wanted it needs a new probe that forces owned tiers; that is a
  separate piece of work, called out here rather than implied.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Content parse failure from JSON-only edit | Blocker | Step 2 lands with step 3 |
| GK preview ≠ resolve at tier II+ | High | Step 1, fixed before any number moves |
| Late-career outfield +22% at tier V | Medium | Unmeasured by design; judgement call, stated |
| Keeper round-up mid/late career | Medium | Judgement + play; no automated rail reaches it |
| In-progress careers keep old gains | Medium | Step 5 rebase |
| Display drift bound moves | Low | Rail is tier-1 only; 460 should hold, confirm it |
| SUPER with a fractional multiplier | Low | Shadow maths built for it; re-check tiers II/III |
| Data loss | None | Pure gain retune |

Nothing in `src/sim/`, so `ENGINE_VERSION` does not move and no golden replay is
touched.

## Out of scope

- TP costs (10 / 15 / 21 / 28 / 36) and cash prices ($3k / $8k / $18k / $40k).
- The one-division-per-tier unlock gate.
- A mid-career owned-tier probe, which this plan argues for but does not build.
