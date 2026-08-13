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

## Local fixes made during this playtest

- Move the facility-upgrade lesson to Season 1, Week 8.
- Attribute power-assisted goals in the post-match report and show a distinct
  power icon.
- Let managers list players once scouting is unlocked. Do not require a full
  roster before the sales panel appears.
- Team Trip still gives every player +1 to all six stats, but now costs every
  player 10 condition. The choice text states both the TP and condition costs.
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

## Balance watchlist

- 3-4-3 Attack looked close to a dominant answer. 4-4-2 may be a beginner trap.
- A 3-4-3 can field only two natural forwards in the current squad. Check how
  strongly the role mismatch is punished.
- No league match ended in a draw during Season 1. Continue measuring in
  Season 2 before calling this a bug.
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
