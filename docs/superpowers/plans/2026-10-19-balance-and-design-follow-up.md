# Balance and design follow-up — approved scope

Status: user approved this scope on 2026-10-19. Items 1–4 are implemented and verified. Item 5's bounded initial study is complete, with late-career coverage still limited. Numerical income/catch-up tuning and the weekly drill queue still need later approval.

Results: [implementation and verification](../../../artifacts/balance-design-2026-10-19/report.md), [measurement report](../../../artifacts/balance-design-2026-10-19/measurement-report.md), [implementation review](../../../artifacts/balance-design-2026-10-19/reviewer-decisions.md). No numerical income, catch-up or Green Bull price change was applied.

Confirmed bug work remains separate: WebGL atlas contexts and AI transfer power identity/licensing were fixed in 9e286a02.

## Judgment and evidence

Fix choices that punish reasonable planning before making the campaign harder. Training choices, scout dates, and the Week 19 savings charge have the clearest player cost. Shootouts should reward the squad the manager built. Measure late income and Cup catch-up before tuning.

The completed Chairman career won the Hero Cup in S5 and D1 in S6. Cash rose from $42,216 after S2 to $2,101,097 after S6. S6 ticket income was $1,470,395. Three Level 2 Stands gave +450% to the gate modifier. That identifies a lever, not a justified nerf.

This was one seed. It retained Eli from the old license bug, lost its S6 page action log after victory, and never bought Green Bull trips. Green Bull is a substantial late cash-to-strength sink. Do not infer general difficulty from this career alone.

Sources: [completed report](../../../artifacts/playtest-2026-10-19-run2/report.md), its checkpoints and receipts, and current production code. Grok, Opus and Muse independently reviewed the proposal. Dispositions appear below.

## 1. Show exact scout dates and honest Cup results

These are first because they are small and do not change match strength.

- Show the absolute scout return week alongside the existing duration.
- Extend the existing late-mission confirmation to cover both registration windows: W1–4 and W17–18. State whether the report can be used before it expires.
- Preview and purchase must use the same mission ID, seed and proposal. Browsing must not consume IDs or RNG.
- Keep report expiry unchanged. Do not imply that a late report survives into next season.
- Show the winner for rival-only Cup ties instead of the abstract 1–0 placeholder. Preserve stored data. Do not invent scorers or Cup stat lines.

Acceptance: due-week preview equals the purchased mission, including the named-role extra week. W4/W5 and W18/W19 boundaries work. User match scores stay visible; abstract ties show advancement only. Check all seven languages and the muted browser flow.

## 2. Restore training choices

Buying a higher tier should add an option. It should not remove a cheaper drill.

- Allow any unlocked lower tier on that training path.
- Show TP cost, the player's previewed gain, condition after training, and affordable drill count.
- Keep the catalog unchanged. Tier 4 gives more gain per TP. Tier 5 gives more gain per action and per condition spent. Every drill costs 8 condition.
- Preserve Training Priority, injury rules, SUPER progress, training boosts and stat caps.
- Keep the existing one-player repeat action. A saved multi-player queue is later work under item 6.

Acceptance: a Tier 4 owner can select Tier 2 and pay 11 TP for its +5 base outfield gain. Actual modifiers and the preview agree. Condition falls by 8. Promises and SUPER progress count the selected drill correctly.

Implementation: src/game/training-paths.ts and training.ts; training view models, store actions, and Squad/TrainingDrillModal. Use focused tests, muted browser checks and native layout checks where available.

## 3. Protect saved TP at the Week 19 decision

The decision is forced in D5/D4. Taking the trip is optional. Before this change, acceptance emptied the whole TP bank.

Approved rule: charge min(current bank, one current week's ambient TP income). Use weeklyAmbientTrainingPoints, which includes base, pitch and coaches. Keep older savings, the current squad gain, and condition cost. Show the exact charge and remaining bank before acceptance.

Keep the prompt's management gate. This prevents spending the same week's TP before the trip. Decline changes no resources. Do not add a bank cap or make the trip nearly free by opening Squad under the prompt.

Reason: spending down before W19 already reduces the cost to about one week's income. The current wipe adds an arbitrary charge for earlier savings.

Acceptance: bank 200 and weekly income 24 leaves 176 after acceptance; decline leaves 200. A bank below 24 never goes negative. Verify each player's gain and condition change. Compare D5/D4 trip value with ordinary drills before shipping. If the benefit itself needs tuning, bring back that separate proposal.

Green Bull stays unchanged. Its copy already states the full-bank charge, cash charge and weekly minimum. Include it in the commercial study. Aligning its price later is a separate decision.

## 4. Make user shootouts depend on player skills

Before this change, user Cup draws used seed parity. Displayed kicks were scripted from pre-match teams and were not saved. There was no stored partial shootout to migrate.

- Resolve once at Cup settlement from the full-time match state on Quick Match and watched paths.
- Use players still on the pitch, the actual keeper and full-time condition. Order outfield takers by effective shooting, with stable ID ties; keeper last. Keeper-last is a new rule.
- Reuse logarithmic shot/keeper scaling where practical, with bounded conversion chances. Start calibration near 75% for equal effective skills. That is a game test target, not a real-world claim.
- Exclude active powers and Heat, including keeper save powers. Cutscene timing cannot affect the outcome.
- Retain the Cup-day opponent attribute lift already used for that match. Do not apply it twice.
- Use five kicks per side with early termination, then paired sudden death. Use equal-sized eligible lists and exhaust them before repeating takers.
- Derive a dedicated seed from career seed, fixture seed and a penalties label. Do not consume the match engine RNG.
- Save kicks, shooter IDs, tally and winner on the Cup fixture. Animation and bracket read that result. Reload cannot reroll it.
- Old fixtures retain their winner. Show 'advanced on penalties' when kicks were never saved; do not invent a tally.
- Rival-only Cup ties stay abstract. They do not gain simulated shootouts.

Acceptance: equal teams win about half the seeded trials. Stronger shooting increases conversion; stronger reflexes reduce it. Extreme stats stay bounded. Check early stops, sudden death, keeper/repeat order and save/reload. The same settled match produces identical kicks. Quick and watched games can differ because their inputs differ.

Version decision: keep the resolver in pure src/game, outside the regulation match engine. Add optional Cup fields without a save-version bump. ENGINE_VERSION stays unchanged if sim behavior and replay RNG stay unchanged. Revisit if implementation crosses that boundary. Measure the change in strong-team tie-break wins before release.

## 5. Measure commercial income and Cup catch-up before tuning

Approval covers measurement and candidate comparisons. It does not authorize an unmeasured income cut or catch-up change. Return measured numbers and exact proposed values for approval before applying them.

First correct experimental parity. The managed-career harness uses 4-4-2, auto-subs off, and no Cup-round argument. Live Quick Match uses the selected formation and auto-subs on. Add a named production-policy experiment arm and pass the actual Cup round. Keep old baselines labelled as their original policy. Do not relabel them as live Quick Match evidence.

Commercial study:

- Start with smoke checks, then fixed paired seeds on Cozy and Chairman.
- Compare balanced investment and commercial stacking. Include Green Bull use and non-use as named policies.
- Track gate components, fans, ticket price, merchandise, wages, upkeep, prizes, signings, trip spend, loans, forced sales, promotions and wins.
- Report cash and purchasing power: cash divided by the next useful legal facility upgrade and a starter fee. Include median and spread before the ending.
- If dominance repeats, first test reduced marginal gate effects for second/third Stands. Measure Shops separately. Keep the first Stand/Shop and early training investment unchanged.
- Change one lever. Do not also change fan growth, wages, transfer prices and prizes. Wealth after the main goals is acceptable.

Old saves keep their cash and buildings. A changed multiplier would affect their next income settlement. That is not grandfathering. Keeping an old formula requires a saved income policy. Choose and disclose that compatibility rule with the tuning proposal.

Cup study:

- Pair the same real-engine teams and seeds with and without current SF 25% / Final 50% catch-up, at mean-XI gaps of 10, 20 and 40.
- Count its trigger rate in late careers. The current gap ignores powers and licenses; check whether this misclassifies strength.
- Separate league regulation, Cup regulation and shootout results.
- Do not remove the rule from one final. Any player explanation must describe an opponent's Cup-day lift, consistent with the UI rule against raw penalty labels.

Acceptance: finance previews equal settlement; production-policy parity passes; required balance rails stay green; candidate results show money and success tradeoffs. Return exact tuning values and compatibility rules for approval.

## 6. Later: a weekly drill queue

The 675-drill workload warrants attention, but a queue is larger than the tier selector. Keep it out of the first implementation batch.

The manager would choose players, paths, tiers and order. Each step calls the normal action and saves successful drills. Stop before blocked steps for TP, availability, requests, injury or Training Priority. Preserve completed steps and unspent TP. No auto-buy, XI changes, automatic stat optimizer or promise bypass.

Bring back a small UI proposal after items 1–4 work. Reuse the repeat action where it fits.

## Review decisions

| Feedback | Lead decision |
| --- | --- |
| Muse: separate quick fairness work from large builds | Accepted. Dates/bracket first; queue deferred. |
| Muse: Tier 5 needs repricing with the selector | Rejected after source checks and Grok/Opus feedback. Tier 5 has an action/condition advantage. Keep tables. |
| Muse: keep the bank wipe or add a bank cap | Rejected. Cap the trip charge, preserve savings and keep the management gate. Check benefit separately. |
| Muse: scout preview must share the purchased mission ID | Accepted. No date drift or browsing RNG use. |
| Grok: preserve both tier tradeoffs and successful queue steps | Accepted. Selector first; later queue uses normal actions. |
| Grok: acknowledge existing scout warning and report expiry | Accepted. Add exact dates/window fit; no cross-season report change. |
| Grok: fix experiment policy before income tuning | Accepted. Add a named production-policy arm. |
| Opus: trip optional; protect savings; Green Bull is a cash sink | Accepted. Only the decision is forced. Green Bull stays separate. |
| Opus: use full-time match state and save penalty kicks | Accepted. Historical winners unchanged; no imaginary partial-save migration. |
| Opus: decide keeper powers, catch-up, and Quick/watched parity | Accepted. Explicit contracts in item 4. |
| All three: measure before income or catch-up nerfs | Accepted. Numerical tuning returns for approval. |

## Approval boundary

Items 1–4 and item 5's measurements are approved. Item 6 and numerical commercial/catch-up tuning need later approval.

No blanket training-gain nerf, Tier 4/5 reprice, division-strength increase, D5 subsidy cut, academy resale ban, retirement-ranking change, new currency or automatic training optimizer.
