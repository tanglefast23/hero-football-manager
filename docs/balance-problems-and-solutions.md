# Balance Problems and Solutions

Status: Sections 1, 3, and 4 were approved on 2026-08-22. Their measured work is complete.

Implemented result:

- Added an opt-in deterministic D5 and D4 scout distribution probe.
- Kept scout valuation unchanged because all 100 sampled missions returned an affordable upgrade and the strongest affordable player did not erase the race.
- Kept the affordable scout fallback unchanged for the same measured reason.
- Halved the existing reduced D4 clean-sheet targets: Cozy is now 1/2/3 and Chairman is 2/3/4.
- Sections 2, 5, 6, and 7 remain proposals only.

Audit date: 2026-08-22  
Clean code reviewed: `87b8c9ae`  
Council: Claude Fable 5 xhigh, Claude Opus 5 xhigh, and Grok 4.6 high  
Turn limit: 64 for every reviewer

## Decision summary

| Topic | Council result | Decision |
| --- | --- | --- |
| D5 scout broke the division | 3 of 3 said the reported outlier is blocked now | Resolved. Verify the live distribution before more tuning. |
| D4 defense felt ineffective | 3 of 3 said one career is not enough | Measure first. Do not change the match engine. |
| D4 eight-clean-sheet sponsor | 3 of 3 said eight is stale; all still questioned the live target | Likely problem. Measure the correct target, then change content only. |
| D4 scout feast or famine | 2 of 3 found a weak cheapest-affordable fallback | Measure the current reports. Use a better fallback only if the problem remains. |
| D3 youth grew too quickly | 3 of 3 said the TP hoard invalidates the economy claim | Do not change youth or TP income. Measure a clean run. |
| D2 Tier 4 drill spikes | 3 of 3 confirmed the multiplier stack; 2 of 3 supported a ceiling | Confirmed problem. Add a tier-aware session ceiling after approval. |
| D2 became a two-team league | 3 of 3 said the run was contaminated | Measure after the scout and training fixes. Do not strengthen D2 yet. |

## Bugs found during the balance audit

These were code bugs, not balance changes. They are fixed and pushed in `36a6268f`.

- Named scout-only Heroes can pass the normal strength ceiling in a Rumored Hero search.
- Relegation keeps earned scout briefs, but shortlist strength now uses the current division.

## 1. D5 scout result broke the division

Verdict: The old problem was real. It is resolved in current code.

Implementation result: Complete. The probe sampled 50 missions in D5 and 50 in D4.

- D5 OVR range: 43-86. Fees: $6,508-$28,439. All 50 missions had an affordable upgrade.
- D4 OVR range: 45-104. Fees: $7,202-$62,209. All 50 missions had an affordable upgrade.
- The strongest affordable signing improved goal difference slightly against the strongest rival, but did not change its win rate.
- Valuation stayed unchanged because the measured signing did not erase the division race.

Current code now:

- limits current strength to about one division above the club;
- limits selling-club reach to two divisions above;
- blocks the reported 112 OVR, 158-focus player from a D5 report;
- values stronger players through the existing transfer curve;
- keeps one affordable report when the eligible pool contains one.

Solution:

1. Keep the current cap.
2. Add a deterministic D5 and D4 scout distribution probe.
3. Record OVR, peak role stat, fee, wage, and starter improvement.
4. Change valuation only if an affordable result still erases a division race.

Rejected:

- A second strength cap.
- A division-based potential cap. Potential already uses a five-star scale and source reach.
- Tuning from the old Zane Lane result. That result is no longer reachable.

## 2. D4 defense did not match results

Verdict: Not confirmed.

The reported results are high-scoring. They do not prove that DEF or REF has no effect. The run also contains old scouting and training outliers.

Solution:

1. Run the existing division decisiveness and goalkeeper probes on clean code.
2. Add one DEF-delta arm. Hold both teams and the seed fixed.
3. Compare goals, clean sheets, shot quality, and stronger-team win rate.
4. Change the match engine only if added DEF produces too little measured benefit.

Contract:

- Any match-engine tuning must bump `ENGINE_VERSION`.
- It must update the golden replay by an explicit version decision.
- It must pass the strength-gap, goalkeeper, and division rails.

Rejected now:

- A general DEF buff.
- A goalkeeper buff designed only to make a sponsor target possible.

## 3. D4 clean-sheet sponsor target

Verdict: Likely a live target problem. The exact replacement needs measurement.

Implementation result: Complete. The current reduced target is halved after the Chairman adjustment.

- Cozy targets are now 1, 2, and 3 for Steady, Balanced, and Bold.
- Chairman targets are now 2, 3, and 4.

The old target of eight could not occur before this change. D4 already had one clean-sheet reduction, but Chairman BOLD could still ask for seven. That remained too high when a strong defense produced two.

Solution:

1. Measure clean-sheet counts across clean D4 seasons.
2. Set EASY near the lower measured range.
3. Set NORMAL near the median.
4. Set BOLD near the upper reachable range, not an outlier.
5. Change `content/sponsors.json` and its pinned tests only.

The target must remain authored and saved. It must not change during a career.

Rejected:

- Runtime targets derived from the active career.
- Match-engine changes made to satisfy a sponsor.

## 4. D4 scouting was feast or famine

Verdict: The extreme elite reports should now be blocked. A weaker fallback can remain.

Implementation result: Measured and closed without a code change.

- All 50 sampled D4 missions returned at least one affordable upgrade.
- 93 of 100 individual D4 reports were affordable upgrades.
- The weak cheapest-affordable fallback did not appear as a live distribution problem.
- The existing fallback and RNG order remain unchanged.

When every drawn player is unaffordable, current code inserts the cheapest affordable eligible player. Cheapest does not mean useful.

Solution:

1. Measure current D4 reports after the new strength cap.
2. Compare each report with the club's current starter by role.
3. If the affordable fallback is still weak, choose the best affordable eligible profile.
4. Use the existing profile score, then fee and player ID as stable tie-breaks.
5. Do not add RNG or guarantee an upgrade in every report.

Rejected:

- A generator rewrite.
- A guaranteed starter upgrade on most reports.
- Removing rare aspirational players from reports.

## 5. D3 youth growth

Verdict: No youth-specific problem is confirmed.

The rise from 59 to 75 OVR matches the reported attribute gains. The problem is access to many drills from about 2,000 obsolete TP, not hidden youth growth.

Solution:

1. Run one clean D3 career that spends only weekly earned TP.
2. Record TP income, drills used, ordinary gains, SUPER gains, and OVR by week.
3. Inspect youth, facility, coach, position, and archetype modifiers in the same trace.
4. Treat any extreme single tap under the Tier 4 solution below.

Rejected:

- Lower youth growth now.
- Lower TP income from this contaminated save.
- Remove facility, coach, or potential bonuses without isolated evidence.

## 6. D2 Tier 4 drill spikes

Verdict: Confirmed.

The current formula can stack SUPER, age, facility, coach, archetype, position, request, and adjacency bonuses. A +13 Tier 4 drill can become a gain near +52. The only final ceiling is the universal stat maximum of 999.

Synthesized solution:

1. Keep the authored drill ladder and the 1.5x SUPER roll.
2. Calculate every existing modifier as now.
3. Cap the final one-session gain at 2.5 times the authored tier gain.
4. Apply the same shared calculation to the exact preview.
5. Discard overflow. Do not bank it for a later drill.
6. Measure ordinary and SUPER gains by tier before finalizing the 2.5 value.
7. Reprice Tier 4 or Tier 5 base gains only if typical gains are also too high.

Why this synthesis:

- It stops rare multiplier stacks from skipping weeks of progression.
- It keeps SUPER exciting below the ceiling.
- It preserves every existing modifier.
- It consumes no extra RNG.
- It does not touch the match replay engine.

Acceptance checks:

- The preview and awarded ordinary gain remain exact.
- SUPER still beats an ordinary drill from the same state.
- Opening training leverage remains inside its rail.
- Long-career development remains inside its rail.
- Tier 4 and Tier 5 still feel stronger than the previous tier.

## 7. D2 became a two-team league

Verdict: Not confirmed on clean balance.

The observed user club had the old scout outlier, hoarded TP, and uncapped drill spikes. D2 also has one designed three-Hero rival. Strengthening every middle club now can hide the real cause.

Solution:

1. Fix and measure Tier 4 training first.
2. Run clean multi-seed careers through at least season five.
3. Record each division's realized club-strength range after promotion and relegation.
4. Compare that range with the authored division band.
5. Record the points gap from second to third and the middle clubs' goal differences.
6. If moved clubs drift outside the new band, tune only those moved clubs toward the nearest band edge.
7. Reuse the existing deterministic squad-strength tuner. Do not regenerate squads.

This keeps promoted clubs weaker and relegated clubs stronger without making every club identical.

Rejected now:

- Strengthen all D2 clubs.
- Nerf the user again before removing the old outliers.
- Change the match engine to compress the table.

## Proposed order after approval

1. Add the balance probes and collect clean measurements.
2. Implement the Tier 4 and Tier 5 session ceiling.
3. Retune D4 sponsor content from the measured clean-sheet range.
4. Improve the affordable scout fallback only if the new report probe confirms it.
5. Re-anchor moved AI clubs only if the long-career probe confirms division drift.
6. Re-run focused tests, TypeScript, and every affected balance rail.

No balance implementation starts until this document is approved.
