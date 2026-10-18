Showing 1 of 665 activities (limited to 1)

The Scout and Deals desks stay shut until Season 1 Week 15. Quiet Bert does not open them. No bought player can arrive in Weeks 1–4. Keep the keeper training weight at 0.36.

**Unlocks.** `isStoryScoutingUnlocked` in `src/game/story-progression.ts` is Season 1 and `week >= 15`. It never reads `assistantMode`. Quiet Bert only skips lessons. `careerMarketViewModelSource` feeds `MarketScreen`, and the test locks the sections: Week 1 is Coaches only, Week 2 adds Youth, Week 15 adds Scout and Deals. `startCareerScoutMission` throws "Scouting unlocks in Week 15" before that. Onboarding complete does not change it.

The only early signing is the academy. Youth opens in Weeks 2–4, and `signYouthIntakeOffer` rejects any later week. Kai Ward used one offer. The cap is 17 with Ace on the books, so the squad is 16/17. If the Youth desk is still open on this Week 4 manage screen, one more academy player fits. Week 5 closes it.

**Weeks 13–18.** Weeks 13 and 14 still have no scout slip and no deals. In Week 15 send Local, Immediate Starter, and no named role. That costs $2,000 and is due Week 17 or 18, which is the signing window. A named role, including a keeper-only brief, can be due Week 19. A Week 19 report dies at season end and cannot be signed. Reports already store exact attributes. No office returns 2 names. A finished Scout Office returns 3. The level is snapshotted when the mission starts.

Deals appear in Week 15, but a buy throws while the window is shut. Selling does not. A listing lives for the week it is made plus the next two. One buy fits without a sale. Sell in Week 15 only to fund a fee or to free a second seat. Division 5 licenses 2 heroes. Count the licensed heroes before accepting a powered player. Thunder Strike already uses one.

**Next building.** The pitch upgrade occupies the only crew. An upgrade stays operational, so the weekly total is 10 base + 12 from Pitch L1 + 5 from Noor + 3 from Thandi, which is 30. Pitch L2 makes that 42. The 42 matches the desk. The 27 does not include Thandi's 3.

When the crew is free, build the Fan Shop. It costs $5,000, takes 1 week, and pays `floor(fans / 2)` every week at upkeep $40. The Scout Office costs $6,000, takes 1 week, upkeep $75, and buys one extra name. Build the office later in a free week before Week 15 if the cash is there. The shop is what funds the $2,000 slip and the fee.

**Keeper drills.** The rail in `src/audit/__tests__/training-leverage-rails.test.ts` uses 600 seeds from 4,000,000 step 7,919, on Cozy, with a created player at 50/65/50/50/50/50. The control hires nobody and builds nothing. One arm spends the whole pre-match bank on Keeper Drills for the best keeper. The other spends that same bank on Finishing for the best forward. The print is goals per contested shot per 100 TP: 0.0706 prevented against 0.0484 created, ratio 1.46. That already includes the live +1 REF for 7 TP against +3 SHO for 7 TP.

The ratio divides out exposure, so a match score can move by more than 1.46 times. This run did not print the shot counts. The same file only requires a keeper-only opener to lose at least 45% of the time. It does not measure Nora, Sam, a 2–2 side, or one drill beside outfield work.

Leave the training weight at 0.36. Against Ace at SHO 65 and PAC 65, 0.6 still loses to a +3 outfield drill. It takes about 0.8 to steal the first slot, and that 0.8 belongs on the lineup pick, where Nora's REF 51 already beats Sam's 49. Noor's Attack specialty adds 6% to Ace's shooting. Thandi's Goalkeeping specialty adds 3% to REF. Spend the bank on Ace and the other live outfield stats. One Keeper Drills tap on Nora is enough in a week that still has 7 TP. The first bought keeper cannot arrive before Week 17 or 18.
