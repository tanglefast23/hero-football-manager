# Optimal career playtest — 2026-08-13

This report tracks a real career played on the deployed web build. The goal is
to win the Hero Cup quickly while optimizing training, condition, facilities,
transfers, contracts, and match tactics.

## Career state

- Season 1 finished first in D5: 16W, 0D, 2L, 65 GF, 21 GA, 48 points.
- Thunder Borough finished second with 45 points and a better goal difference.
- jobo scored 46 goals and won all three season awards.
- Season 2 began in D4 with $43,973, 84 TP, and 1,488 fans.
- jobo renewed for three seasons at $644 per week. The ask was $932.
- Thunderbolt Energy was selected for Season 2: win 14 league matches for a
  $20,800 target bonus.
- Season 2 finished fourth in D4: 10W, 1D, 7L, 51 GF, 42 GA, 31 points.
- Garnet United won D4 with 48 points and a +69 goal difference.
- The club finished with $109,632 and a 15-player squad.
- jobo won Player, Young Player, and Hero of the Season again.
- The Hero Cup run ended 1-3 against Harbour Wanderers in the Play-in.

## Local fixes made during this playtest

- Move the facility-upgrade lesson to Season 1, Week 8.
- Attribute power-assisted goals in the post-match report and show a distinct
  power icon.
- Let managers list players once scouting is unlocked. Do not require a full
  roster before the sales panel appears.
- Team Trip keeps its division-scaled gain, but now costs every player 10
  condition. The choice text states both the TP and condition costs. This is
  +1 per stat in D5 and +2 per stat in D4.
- Keep a Fan Shop or Stadium Stand's Level 1 effect intact, but make each Level
  2 or 3 upgrade add half the original effect. Separate Level 1 buildings still
  give their full effect.
- Keep the Deals tutorial spotlight attached to Deals while the page scrolls.
- Show the current career week in the Club office header. Settled ledger rows
  retain their own historical weeks.
- Clear the previous season's match banner during season rollover.
- Retire completed transfer-negotiation cards after a player signs.
- Show the roster-cap guide only while the roster is actually full. Otherwise,
  show the transfer-listing guide.
- State that a coach unlocks a formation in Settings across all seven locales.
- Show the club's actual sponsor payment and bonus consistently on the offer
  and confirmation screens.

## Fixes already being handled elsewhere

- Cup weeks move to 10, 14, 18, 22, 26, and 29. League fixtures move around
  them, with league play in Week 6.
- Training Pitch copy uses 12 TP.
- Dorm copy uses the real +3 recovery.
- Assistant Level 1 wage copy uses $150.
- Construction cards show zero built until construction finishes.
- TP copy no longer says drills are the only improvement source.
- Tutorial and glossary text match across all seven languages.

## Open bugs and inconsistencies

- Cup draws can show a loss without a visible tiebreak. A separate implementation
  handoff now covers the penalty-shootout presentation.
- The selected live formation does not persist into the next match.
- Quick Result does not expose a starting-formation choice.
- The saved XI selected a weaker player over Eli until manually corrected.
- The first transfer can still begin before the inbox teaches negotiation. A
  signed transfer no longer leaves a stale tutorial, but a just-in-time lesson
  should eventually replace the inbox timing.
- An in-progress save kept its old league schedule after the Cup-week update.
  Week 10 first played Thunder Borough in the league, then loaded the Hero Cup
  Play-in against Harbour Wanderers. The financial report paid both home gates.
  New Cup weeks need an explicit saved-career schedule migration.
- Home inbox cards become stale. The 17-player full-roster card remained after
  the squad fell to 15. The transfer-window-open card remained after Week 18.
- Signing Ari Stone at a 15-player roster showed “the squad is now full,” even
  though the 17-player cap still had two spaces.
- Tapping a pending request from Home said it was resolved from the season
  review. The same request remained actionable under Squad > Requests.
- Shooting Range and Keeper Court cards and receipts say +10% training. Their
  placement helper says +25% at Level 1 and up to +100% at Level 3.
- The Week 8 upgrade lesson can select the already-Level-2 Training Pitch. The
  tutorial then points at a D2-locked Level 3 button instead of an upgrade the
  player can buy.

## Balance watchlist

- 3-4-3 Attack looked close to a dominant answer in D5. It was not dominant in
  D4. Starting a rival match on All Out exhausted seven players by minute 37.
- 4-4-2 remained a good Quick Result default after the midfield was strengthened.
- A 3-4-3 can field only two natural forwards in the current squad. Check how
  strongly the role mismatch is punished.
- The first draw arrived in Season 2's final league match. The combined sample
  was 35 league matches without a draw, then one draw. Draw frequency is still
  suspiciously low.
- Jae arrived with fame near 300 while established players were near 30. Check
  whether this distorts wages and awards.
- Renewal asks are capped at 5x the larger of current wage or current open-market
  wage. Consider 7x if elite-player wages fail to absorb the late economy
  snowball. Do not remove the cap: the uncapped compounded formula can reach
  extreme multiples. Show an estimated renewal range during the final contract
  season before raising it.
- Season 1 has enough systems, but quiet late weeks repeat the same optimal
  training targets. Do not add chores. Prefer one meaningful counter-pressure
  every two or three quiet weeks.
- Hero matches are the fun peak. Ordinary live matches repeat, so Quick Result
  should remain the fast path.

## Season 2 measured findings

### Difficulty and progression

- D4 was not too easy. The optimized club finished fourth and did not earn
  promotion. A casual player using the original star-only plan could finish in
  the bottom half.
- The season started 5W-0D-0L, then hit five losses from the next five league
  matches. Strong opponents arrived in a cluster, making the difficulty jump
  feel sharper than the final table suggests.
- The concentrated striker plan stopped working against D4 rivals. Buying Ari
  Stone and redirecting TP into midfield and defense changed the result: the
  first Beacon match was a 2-4 loss; the rematch was a 4-2 win.
- Ari cost $69,041 plus $491 per week. His 106 starting rating was enormous for
  D4, but the club still lost to Harbour and drew with Garnet. The transfer was
  powerful without becoming an instant-win button.
- The final Garnet match showed the best live tactical loop. A 5-3-2 deep
  counter with Save Energy preserved the squad, then a switch to 3-4-3 Attack
  turned a 0-2 deficit into a 2-2 draw.
- All Out is a real trap when used too early. In the Cup Play-in, it used all
  five automatic substitutions by minute 57 and left multiple players near
  zero energy. Balanced or Save Energy should be the normal opening choice.
- The season produced 93 goals across 18 club league matches, or 5.17 per
  match. Garnet finished +69 and Thunder Borough -88. Top-versus-bottom score
  gaps are too extreme even though the table result itself felt fair.

### Powers

- Post-match power attribution works. jobo's Cup and final-day Thunder Strike
  goals showed the lightning icon and power name.
- Thunder Strike fired in real scoring contexts. Rally Cry was not spent merely
  because its gauge was full. No obvious waste timing was observed.
- The final comeback was readable: Thunder Strike scored at 67 minutes, then a
  normal jobo goal equalized at 86 minutes.

### Economy

- The commercial upgrade nerf works. Three Level 2 Fan Shops now return about
  $3,400-$4,340 per week. That roughly covers wages, staff, and most upkeep.
- Separate Level 1 Stadium Stands remain the exploit. Three stands produce a
  400% total gate. D4 home gates regularly paid about $18,500-$22,000.
- Week 10's saved-career doubleheader paid two home gates and created a false
  $41,253 weekly surplus. Exclude that week from normal economy tuning.
- Even after a $69,041 transfer, four new training facilities, a Scout Office,
  a Youth Field, one drill upgrade, scouting, and three granted favors, closing
  cash reached $109,632. Season cash change was +$65,659.
- Cap Stadium Stands at two. Keep the new upgrade scaling and the current Fan
  Shop values. The shop economy is close to healthy; the third full-strength
  stand is the remaining money printer.
- One construction crew was a useful limiter. It kept the facility build order
  meaningful even after cash stopped being scarce.

### Team Trip

- In D4, Team Trip spent 44 TP and gave all 15 players +2 to all seven stored
  attributes. That is 210 raw attribute points before caps.
- The -10 condition cost left everyone at 90, which was still safe and recovered
  quickly. Taking the trip was automatic, not a hard choice.
- Keep the visible condition cost, but make the reward +1 per stat in every
  division. Division scaling makes the already-efficient team-wide reward grow
  faster than focused drills.

### Player favors

- Week 5: granted Bo Hedges's $1,230 squad-headphones request.
- Week 12: granted jobo's $1,932 old-pitch request.
- Week 19: granted Sam Mitts's $399 matchday-barber request.
- Week 26: refused Jae Hart's national call-up. Granting it would remove a
  promised starting defender for two weeks during the promotion run-in; refusal
  cost 5 loyalty and 8 morale.
- The first three favors were easy yes decisions once gate money snowballed.
  The call-up was the first favor that genuinely disrupted the optimal plan.
- Requests appeared exactly every seven weeks: 5, 12, 19, and 26. Vary the
  interval slightly so the system feels like people, not a timer.
- More good requests should trade availability, condition, a promise, or a
  sponsor goal. Cash-only favors stop mattering once the third stand pays out.

### Sponsor objective

- Thunderbolt Energy paid $3,168 monthly and required 14 league wins for a
  $20,800 bonus. The club finished with 10 wins, so the bonus paid $0.
- Fourteen wins means winning 77.8% of an 18-match season. It was a valid bold
  target, but it did not change formation or training by itself.
- The objective mostly measured whether the club was already dominant. The
  strategy-shifting sponsor goals below remain the better direction.

## Season 2 balance verdict

The game is not globally too easy. Season 1 is generous to an optimized player,
but D4 pushed the same plan down to fourth. The strongest part of Season 2 was
having to diagnose the weak midfield, sell dead weight, buy one transformational
defender, and change live tactics.

The main balance problems are narrower:

1. Three full-strength Stadium Stands remove financial pressure.
2. D4 Team Trip is overwhelmingly efficient at +2 to every stored attribute.
3. Rival scorelines and league goal differences are too extreme.
4. Most cash favors become automatic yes decisions.
5. The 14-win sponsor target records success but does not shape how success is
   pursued.

The best next balance pass is small: cap Stadium Stands at two, flatten Team Trip
to +1, and narrow D4 opponent scoring extremes. Do not weaken the player's whole
team. The fourth-place finish shows the overall difficulty is already doing its
job.

## Season 2 counter-pressure test

For every player favor, loyalty problem, and sponsor objective, record whether
it:

1. changes the optimal decision;
2. adds tension but leaves the same optimal decision; or
3. only rewards normal play.

If most entries land in groups 2 or 3, connect the existing systems more
directly. A player favor should compete with condition, training priority,
lineup strength, a contract promise, or a sponsor objective.

### Success pressure, not hidden punishment

Do not secretly target strong clubs with injuries, cash losses, opponent stat
boosts, or repeated negative rolls. That makes growth feel stolen.

Visible success can create fair complications:

- better players demand higher wages, starts, or captaincy;
- stars attract transfer bids and agent trouble;
- bigger sponsors attach harder objectives to larger payouts;
- Cup progress creates schedule and condition pressure;
- strong finishes raise next season's board expectations;
- fame creates publicity choices that trade money against condition; and
- squad success creates ego clashes and loyalty requests.

Give each event two or three costly choices. State why it happened. Keep the
cost temporary and recoverable, and cap these interruptions at roughly one or
two per season.

Example: a sponsor requests jobo before a Cup match. Accepting pays $4,000 but
costs him 12 condition. Declining protects the match plan but loses sponsor
trust. Success caused the opportunity, and both responses remain fair.

## Better sponsor objectives

The first offers mostly reward normal success: score 22 goals, finish in the
top three, or win 14 matches. Better objectives should change behavior.

- **Iron Wall:** Keep 6 league clean sheets. Train GK/DEF and protect leads.
- **Fast Start:** Score first in 10 league matches. Attack early and spend
  energy sooner.
- **Fresh Finish:** Win 6 matches with average XI condition above 65. Rotate
  and save energy.
- **Shared Spotlight:** Four players each score 3 league goals. Spread training
  and attacking responsibility beyond the hero.
- **Future Stars:** Give under-21 players 900 minutes and 8 starts. Recruit and
  develop youth.
- **Tactical Range:** Win twice with each formation. Count a formation only
  after 60 minutes to prevent last-second switching.
- **Giant Killer:** Take 7 points from the three strongest clubs. Save TP and
  condition for difficult fixtures.
- **Shut the Door:** Lead at halftime, then concede no second-half goal five
  times. Change from Attack to Protect.
- **Bench Impact:** Get 5 goals or assists from substitutes. Reward live match
  management.
- **Balanced Squad:** Finish with five players above a target OVR. Spread
  training beyond one star.

Avoid objectives based only on total wins, total goals, or league position.
Avoid power-use objectives because powers fire automatically.

If season-long objectives still feel passive, add optional pre-match sponsor
challenges. The manager chooses one risky objective for extra money before a
selected match. This should reuse the existing match and sponsor screens.
