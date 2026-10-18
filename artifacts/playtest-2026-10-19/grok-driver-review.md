Showing 1 of 572 activities (limited to 1)

The driver is safe on decisions and match counts. Change the keeper weight before you let it train.

**Decisions.** Week 19 returns before training and before Advance. A tap on "{player} says: …" only opens the card. Yes and No stay "Do not take the training trip" and "Spend N TP…", so `clear()` does not choose. A request walk-on works the same way, then `playWeek` stops on `playerRequests.pending`. Grant and Refuse are outside the auto-tap set. Inbox duties still stop on "Must do before Advance Week". While that duty is up, Advance reads "Bert says: read the desk, then Advance Week", and that press only focuses the duty.

**Matches.** `info()` and `record()` count this season's played rows in `career.fixtures`, using `score.homeGoals` and `score.awayGoals`. Cup ties stay on `nationalCups`. On a league-plus-cup week, one Quick leaves the career on matchday, Continue returns there, and `start()` stops. Expect that stop and play the cup yourself. A shootout winner is `winnerClubId`. This counter never reads it.

**Training.** Every drill has `moneyCost` 0. The heuristic still spends the TP bank badly. Keeper REF weight 0.8 times a gain of 1 beats an outfield gain of 3 when pace is about 13% higher than REF, defending about 20% higher, or shooting about 28% higher. The starter keeper is always eligible, so the first 7 TP most weeks buy +1 stored REF. It reads `attrs.ref`. Set that weight down with the other live weights, or skip REF until the +3 drills are done. If Tier 5 is owned, every drill spends 39 TP for +18 and never Tier 4, which returns more per TP. `playWeek` does not buy tiers. A Training Priority player is labelled "Train {name} now, {count} promised drills owed", so the exact tap throws and the promise is not paid.

On season 1 week 1, while Bert's objective is advance-week, `clear()` can press that "says:" button before `trainBudget`. After that week the accessible name is "Advance Week", and the exact tap matches.

**Facilities.** One project at a time. The pitch is 2 weeks and $8,000. The Coaching Office is 1 week and $6,500. The Scout Office is 1 week and $6,000. Those three cannot all finish in week 1.

Hire the level-1 head immediately. No office is required. The wage is $300 and the scaled gain is +5 TP. Start the pitch. An optional local Immediate Starter with no named role costs $2,000 and is due week 3 or 4. A named role can add a week, arrive in week 5, and miss the window. Signing is open in weeks 1–4 and 17–18. The office level is snapshotted when the mission starts. No office returns 2 names and an attribute span of 8. A level-1 office returns 3 names and a span of 30, so the first office adds a name and widens the ranges. Build it before the mission that should return three names. After the pitch finishes, build the office and hire the cheap assistant. Leave the office at level 1 until both are in. Then take pitch level 2, another +12 TP for $20,000, and a new level-1 shop or stand. A new building is +100 commercial. The first upgrade of one building is +50.

No files changed.
