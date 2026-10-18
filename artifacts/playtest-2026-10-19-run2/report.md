# Hero Football Manager: completed Chairman playthrough

**Both goals are complete.** Bramble Rovers won the Hero Cup in Season 5, then Division 1 in Season 6. The ending played. I selected Finish and returned to the title. The saved Hall of Fame records both wins.

The run finished with **124 user fixtures, 675 drills, $2,101,097, and 5,632 fans**. Season 7 was not started. This is a new career, separate from the earlier Sol Reed crash run.

## Results

| Season | Division | Position | W–D–L | Goals | Points | Cup finish | Closing cash | Drills that season |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | D5 | 5 | 7–7–4 | 32–23 | 28 | Play-in | $6,421 | 158 |
| 2 | D5 | 1 | 17–1–0 | 73–4 | 52 | Round of 32 | $42,216 | 178 |
| 3 | D4 | 1 | 18–0–0 | 64–11 | 54 | Round of 32 | $167,018 | 106 |
| 4 | D3 | 1 | 16–1–1 | 62–8 | 49 | Round of 16 | $461,369 | 94 |
| 5 | D2 | 1 | 18–0–0 | 69–4 | 54 | Winner | $1,137,832 | 73 |
| 6 | D1 | 1 | 16–2–0 | 61–15 | 50 | Quarter-final | $2,101,097 | 66 |

League total: **108 matches, 92 wins, 11 draws, 5 losses, 361–65 goals**. Cup total: 16 matches. Each season had 18 league matches.

The Season 5 Cup road, with the score written home–away:

| Round | Home | Score | Away |
| --- | --- | --- | --- |
| Round of 32 | Bramble Rovers | 4–0 | Ashford Sporting |
| Round of 16 | Quarry Sentinels | 1–6 | Bramble Rovers |
| Quarter-final | Bramble Rovers | 7–3 | Vellum Collieries |
| Semi-final | Bramble Rovers | 5–3 | Thistle Bulls |
| Final | Dovewell Stags | 1–2 | Bramble Rovers |

Season 6 was a D1 title, rather than a same-season double. Thistle Bulls eliminated us 4–1 in the Cup quarter-final.

## How this was played

I played the local Expo web game at `http://127.0.0.1:8093/?qa=playtest` in a muted, background Paseo Chromium pane. The recorded viewport was 1200×700. This was not the Vercel deployment, a Steam career, or an iPhone test. Steam shares the web game, but its shell, storage, input, and performance still need separate checks.

Purchases, drills, contracts, events, lineups, and match starts used the rendered controls. The local QA bridge only supplied cloned state for inspection and exports. There were no score edits, save edits, rerolls, or simulations of future fixtures.

Of 124 fixtures, 122 used the production-engine Quick Match. Two were watched: Season 2's final league match, and Season 4's Cup Round of 32. The latter finished 0–0, and we advanced on penalties. The shootout screen showed 4–3. That tally is a scripted presentation of a winner decided beforehand, rather than a simulated shootout. This does not test a whole career with manual hero timing. Quick Match automatically controls powers and keeps the user's opening energy at Balanced.

The career source stayed pinned to **28386452**, engine **m2.9**. Later fixes in **de80d170** were tested separately. The improved QA clock in **ee2ee7a3** changed only the test helper, its tests, and its guide. Full hashes and the dependency-lock hash are in [provenance.json](provenance.json).

Two limits matter when judging the strategy:

- The old license bug accidentally created Eli Stone during a normal Season 2 rotation. I retained and trained him. I did not farm or sell minted players for cash. This career benefited from that extra player, so it is not a clean run under the latest rules.
- After victory, browser screenshot capture timed out and left the original tab unresponsive to evaluation. The persisted save recovered in a fresh muted tab on the same pinned port 8093 server. I selected Finish and No — title screen in that recovered tab. The Season 6 page action log was lost. All fixture results, the final save, actual ending text, and cumulative logs through Season 5 remain. The final export also contains the four recovery actions. There is no final victory PNG. [Ending proof](evidence/endgame-proof.json) and the saved Hall of Fame support the result.

## Strategy that worked

The useful order was training income, a few strong starters, then commercial income. It was an adaptive winning run. It does not prove the fastest possible route.

**Start with the cheap head coach and Training Pitch.** Noor did not need an office. The pitch added 12 weekly TP per level. Build the Level 1 Coaching Office for the assistant, and hire before upgrading that office. An office upgrade can raise an arriving coach's wage without enough extra TP to justify it early.

**Keep early cash for the window.** Scout and Deals unlock in Season 1 Week 15. Quiet Bert does not bypass that gate. Send a brief only when its printed due week fits Weeks 17–18. A named role can add a week and miss the window. The Scout Office level is fixed when the mission leaves, so building it afterwards cannot improve that report.

**Buy match stats, rather than the largest overall number.** Ben Irons cost $19,075 in Season 1 Week 18 and arrived with raw REF 110. The last seven league games were 5–2–0, 19–1. Training and other changes also contributed; this is not a controlled keeper-only comparison. Later fees were Cal Ash $28,634, Zane Ash $37,693, Ari Ward $37,499, Vik York $84,060, and Uma Knox $71,436.

**Use new shops and stands before costly commercial upgrades.** Three Level 1 Fan Shops and three Level 2 Stands became the income base. Adjacency helped merchandise. Keep a cash reserve before starting them. My early second stand left too little reserve and helped trigger the Season 2 loan. Week 15 closed at −$569. The warning then led to a $15,000 loan in Week 16, even though that week's other income had recovered the cash. The $16,500 debt was repaid in Season 3.

**Train the active eleven and pay one Training Priority at a time.** The five promised drills can block everyone else's training. Sign-at-ask attaches no promise. Negotiated examples include Kai at $1,190 against a $1,340 ask, and Ace at $2,700 against $3,060. Avoid Starter or Captain promises when you need license rotation.

**Change the training target as ratios improve.** Ben reached raw REF 361. Ace reached SHO 458, but his weaker technique, pace, and stamina then deserved attention. Grok's review helped stop the fixed weekly keeper drill and more Ace shooting. We shifted to Kai's shooting, Ace's technique and stamina, and the rest of the eleven.

Tier 4 gives the best base gain per TP on both ladders: outfield 13/26 and keeper 7/26. Tier 5 gives 18/39 and 10/39. I bought all seven Tier 4 paths by Season 6 and skipped Tier 5. That does not make every Tier 4 purchase necessary. Grok recommended skipping REF 4 and PAC 3+4 at D2 entry. The run bought those paths and was broader than that recommendation. Their fees remain actual costs.

The final pitch was Level 3. Coaches Noor and Thandi were Level 3. Normal weekly income reached 57 TP, then 58 after a late pitch event. Two Tier 4 drills fit each week. Banked TP covered promises and selected extra work.

The saved fees, two watched-screen transitions through Season 5, and the production 57/58 TP calculations are in [the method check](evidence/method-and-strategy-check.json). Season 6's Quick Match count comes from the run record; its complete action log was lost.

Final facilities: Pitch 3, Coaching Office 1, three Shops 1, three Stands 2, Dorm 1, Gym 2, Tech Center 3, Shooting Range 1, Medical Bay 2, Scout Office 1, and Keeper Court 2. I bought no extra Hero License permit. D1's four earned licenses covered Ace, Kai, Ed, and Ari.

## Confirmed bugs and their status

### R2-01 — Team sheet shows players on the wrong side: fixed on main

In 3-4-3, the visible forward row showed Ace, Kai, Dario from left to right. The engine placed Kai, Dario, Ace. The midfield row had the same class of error. 4-3-3 forwards were also affected. This made a seemingly central assignment misleading.

The screen rendered engine-slot order instead of sorting each row by the engine's horizontal anchor. The fix adds `pitchX` and sorts only the displayed row. Saved IDs, anchors, RNG, and the match engine stay unchanged. Focused tests and separate browser cases verified the order. [Original sheet](evidence/03-team-sheet-position-mismatch.png), [fixed UI proof](evidence/fixed-ui-proof.json).

During the pinned career, I used the visible swap controls to keep Ace in engine slot 10. This workaround is not needed with the corrected display. Source: `FixtureMatchDayScreen.tsx`, `view-models.ts`, and `formationSlotX` in `tactics.ts`.

### R2-02 — A new season undoes manual positions: fixed on main

The season repair dropped the saved formation. The store then rearranged starters by rating, moving Ace from his chosen central slot. The fix keeps the formation and repairs injuries without rearranging a valid unchanged shape. A changed formation still triggers arrangement.

Tests cover exact XI retention, changed formation, and injury cover. Opus also checked the real Season 1-end copy. The career itself retained the older behavior because its source was pinned. Source: `repairUserLineup` in `full-career.ts` and the season boundary in `store.ts`.

### R2-03 — Removing a license creates a sellable free player: fixed on main

With no fit cover, turning a starting hero's license off called emergency injury relief. That created a free youth. Restoring the licenses could bench that youth and allow a sale. A repeated mint in the same week could also collide with its generated ID.

The fix refuses a voluntary change without cover. It also lets the manager exchange one hero's license for another in one operation. This preserves the real rotation that a refusal-only fix would block. A repeated exchange cannot undo itself. The new refusal is translated into all seven languages.

Pure tests, store tests, view-model tests, real-checkpoint checks, and a separate rendered exchange case passed. The case kept the player count unchanged. Involuntary injury relief remains available. [Review](reviews/opus-fixes-review.md), [fixed UI proof](evidence/fixed-ui-proof.json). Source: `selectCareerLicensedHeroes` and `toggleHeroLicense`.

### R2-04 — Duplicate Continue targets after the training trip: fixed on main

The completed trip exposed an outer button and an inner button with the same label. Web had two tab stops. The fix removes accessibility from the finished outer wrapper while keeping its pointer behavior. The inner Continue remains the single accessible button. A separate browser case returned Home with one target. [Proof](evidence/fixed-continue-proof.json).

### R2-05 — Sold heroes change power between seasons: confirmed, open

Ken Ash was sold to Sable Dragons with ICE_RINK. At the actual Season 4 transition, he had RALLY_CRY, while Hugo York changed from RALLY_CRY to ICE_RINK. [Before-state checkpoint](checkpoints/season-3-week-2-snapshot.json.gz), [live transition proof](evidence/season-4-ken-transition-proof.json), [queue review](reviews/opus-ai-transfer-review.md).

The pyramid record does not carry a player's power. Rebuilding AI squads assigns powers from club and squad position. Ken's original global-list position moved him to the front of the buyer's eligible queue. The assignment change is confirmed. A resulting change in rival strength was not measured.

The sound fix is to preserve player-owned powers through the pyramid, save codec, season rebuild, Cup opponents, and transfer targets. Keep the authored hero count while defining overflow behavior. This changes the power mix and needs a balance check. It was not patched during this run. Moving Ken to the end of a list would stop the queue jump, but would not preserve his identity.

The wage change from $800 to $234, division-based tier, and seasonal attribute growth come from the existing AI rebuild. They are not evidence of the power bug. Source: `careerPlayerToPyramid` in `m2-career.ts`, `PyramidPlayer`, `pyramidPlayerSchema`, and the three generated-power call sites.

### R2-06 — AI purchases cannot license a hero in-season: open policy gap

Every sale clears the player's license. No AI in-season action grants one. The lineup and bench correctly exclude an unlicensed hero, so a bought hero waits until the season rebuild.

Ken's actual buyer already had two licensed heroes and stronger midfielders. This sale therefore does not demonstrate a lost strong starter. A buyer with free capacity could still be affected. Define the AI's license allocation policy before changing this behavior. Both sale paths clear licenses: `completeCareerPlayerSale` in `market-career.ts` and `applyBoardForcedSaleConsequences` in `board-ultimatum.ts`. The AI team builder then excludes the unlicensed hero.

The earlier Sol Reed AI-lineup crash is a different issue. That picker admitted an unlicensed powered player and the team builder threw. Its fix landed before this new career. The earlier report's stopped outcome remains unchanged.

## Balance and product thoughts

**Late money stops being a meaningful limit in this seed.** Cash rose from $42,216 after Season 2 to $2,101,097 after Season 6, despite facilities, signings, renewals, and paid player requests. Four paid requests cost $91,882 across the run, including $86,112 in Season 6. Those costs are in cash transactions, not the weekly ledger lines. Season 6 ticket income was $1,470,395 and merchandise was $259,038. Total player and coach wages were $594,420. Three upgraded stands and rising fans drove a strong surplus. Test commercial stacking across more seeds before changing the numbers. I would measure this before adding more late cash sinks.

**D5 took two seasons, then every promotion took one.** The first promotion was slow enough to teach reserves and scouting. Later league results were very strong, including two perfect seasons. The Cup still supplied setbacks. One seed with an extra legacy relief player cannot establish that Chairman is generally too easy.

**High stats need clearer marginal feedback.** Raw REF 150 is not a hard engine wall. Logarithmic contests keep responding, with smaller gains per raw point. The weak technique or stamina of an overtrained scorer can matter more than more shooting. Training previews could explain which live contest improves, without promising a score outcome.

**Unlocking a higher tier removes useful budget flexibility.** The training screen uses the owned tier. At low weekly TP, buying a path can change how many drills fit. A lower-tier selector would help managers choose volume versus gain. Several paths bought Tier 3 and Tier 4 in the same week. The Tier 3 fee is a required gate, not a double-charge bug. Tier 5's weaker gain per TP also deserves a clear reason to buy it.

**The mandatory Week 19 trip is a real trade.** In D5 and D4 it consumes the whole TP bank and reduces condition. The prompt blocks access to Squad, so the manager cannot first spend that week's bank. This was an observed flow, rather than a broken Advance button. Consider showing the exact bank cost earlier or allowing preparation before the decision. [Trip screen](evidence/02-team-trip.png).

**Late Cup difficulty includes an authored catch-up rule.** `applyCupCatchUp` closes 25% of a qualifying team-rating gap in the semi-final and 50% in the final. It applies when the user's mean role rating leads by at least 10. This is a source fact, not a measured explanation of our scores. It does not apply in the quarter-final and cannot explain the Season 6 loss there.

**AI Cup scores are placeholders for a real winner decision.** All 44 Season 5 rival-only ties showed 1–0 or 0–1. Their winners come from strength and a seeded performance roll with upset tails. Our own regulation scores used the match engine. Rival league fixtures also used the engine and had varied scores. This is intended abstraction, not a score corruption bug. Showing only the winner for abstract ties would make the bracket less misleading. Those ties create no Cup stat lines and do not alter league goal difference or awards. [Opus review](reviews/opus-ai-cup-scoring-review.md).

**User shootouts also have a separate rule.** `deterministicPenaltyWinner` picks the winner from fixture and career seeds. It does not read shooting or keeper attributes. `penaltyShootoutViewModel` then presents one of four legal kick scripts for that winner. Consider whether player skills should affect shootouts. The observed 4–3 was presentation detail, while the save retained 0–0 and the winning club.

**Emergency academy resale remains a separate balance question.** Normal annual backfills can be sold for fees. I used legal sales to fund the climb. Their total contribution should be tested before changing that policy. The license-created cash loop was a bug and is closed on main in de80d170. The pinned career still had that bug. It is not the same rule.

Retirement cover still picks the first same-role player in roster order. It does not always pick the strongest. This becomes more visible after preserving manual positions. Treat an automatic-best replacement as a separate balance decision.

## Problems rejected or left unconfirmed

- Home's recent-form strip did include away wins. Wins are trophy graphics, so page text omitted them. The Won accessibility label confirmed the result. No fix was needed.
- Several apparent dead controls came from suspended browser frames. At Season 3 Week 16, a frame probe received zero frames for 15 seconds; a one-pixel background resize released the rival introduction. This was a QA environment incident.
- Covered-pane timers made nominal 450 ms guards take seconds, sometimes much longer. The maintained helper now uses short-lived worker timers. Live probes took about 458–468 ms, and an actual tab tap took about 986 ms. Worker tests and cleanup checks passed. This fixes QA pacing; it makes no phone-performance claim.
- Repeated WebGL eviction warnings and a blank watched kickoff remain a graphics hypothesis. The offscreen atlas allocation path is a suspect. Live context counts were not captured, and the match later finished. Do not patch the renderer from this evidence alone.
- The later screenshot failure is distinct from the confirmed zero-frame incident. A fresh frame probe succeeded before full-page capture stalled. Closing our old tab released its OPFS lock; the recovered save matched the final totals. No career corruption was observed.
- A Rumored Hero brief returned three ordinary players. That search is not a guaranteed hero. I did not classify it as a bug.

My own mistakes were an early stand without enough reserve, too much training on flat stats, broad tier purchases, and briefly treating Week 19 as a trip stop after leaving D4. The unused TP carried forward. These are strategy or driver errors.

## Review and verification

Grok reviewed strategy, training, timing, and graphics hypotheses. Opus reviewed the fixes, AI transfers, recent form, frame suspension, and Cup scoring. Their original notes are in [reviews](reviews/). The final report review and dispositions are in [final-review-decisions.md](final-review-decisions.md). Muse was quota-blocked and supplied no review.

Accepted changes included atomic license exchange, its repeated-tap guard, preserving manual positions, corrected sheet order, one accessible Continue, and the worker-based QA clock. I also accepted the later shift away from fixed weekly keeper training. Rejected claims include a missing away win and treating every 1–0 Cup tie as a simulation bug. Player power identity remains open.

For de80d170, local verification passed **522 suites and 5,041 tests**, with one suite and one test skipped. Three snapshots, TypeScript, QA tools, the web export, and the hidden muted desktop shell check passed. The four CI jobs also passed. [Fix receipt](evidence/fix-validation.json), [completed CI receipt](evidence/fix-ci-result.json).

For ee2ee7a3, TypeScript and QA tools passed locally. All four CI jobs passed, including the full suite and native iOS Release build. This build result is not device gameplay proof. [CI receipt](evidence/qa-clock-ci-result.json).

All six season-end exports pass the current save codec and production team builders: ten clubs each, zero lineup failures. The report verifier checks hashes, fixtures, recaps, Hall of Fame totals, and the saved true-ending flag. It runs no matches. [Validation](evidence/checkpoint-validation.json), [facts](facts.json), [compressed checkpoints](checkpoints/).

Run `node artifacts/playtest-2026-10-19-run2/verify-report.cjs` to repeat those read-only checks. The report and evidence are committed separately from game changes. No Vercel, EAS, Steam, or App Store release was published. Only our browser tabs and port 8093 server were closed; existing unrelated servers were left alone.
