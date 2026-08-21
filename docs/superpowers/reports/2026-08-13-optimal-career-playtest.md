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
- Show lightning and gold only for the controlled team's power-assisted goals.
  Normal goals use a football, and opponent goals use the threat treatment.
- Keep all three Week Review cash figures on the same count-up clock.
- Use gender-neutral copy in stories that select a coach.
- Do not show `Not enough money.` when Bert waives the first scouting fee.
- Save Energy already persisted through goals and halftime. A regression test
  now protects that behavior; the browser focus marker caused the false report.

## Fixes already being handled elsewhere

- Cup weeks move to 10, 14, 18, 22, 26, and 29. League fixtures move around
  them, with league play in Week 6.
- Training Pitch copy uses 12 TP.
- Dorm copy uses the real +3 recovery.
- Assistant Level 1 wage copy uses $150.
- Construction cards show zero built until construction finishes.
- TP copy no longer says drills are the only improvement source.
- Tutorial and glossary text match across all seven languages.
- The 20-0 Cup mismatch is being handled in a separate session.

## Open bugs and inconsistencies

- Cup draws can show a loss without a visible tiebreak. A separate implementation
  handoff now covers the penalty-shootout presentation.

## Implemented in the 2026-08-14 findings pass

- Live formation choices now become the next match's opening formation.
- Match Day exposes a starting-formation button for Quick Result. The built-in
  browser verified the visible `4-4-2 ▸` control and its accessible label.
- Automatic saved-XI repair now chooses the strongest legal same-role reserve.
  Manual lineup choices remain untouched.
- The first successful transfer approach now opens the negotiation lesson
  immediately.
- Existing careers move only unplayed league rounds around Cup Weeks 10, 14,
  18, 22, 26, and 29. Played results and their historical weeks stay intact.
- Roster-cap and transfer-list inbox cards now reconcile with the current
  roster, transfer window, and scouting state.
- Transfer completion says the squad is full only at the real roster cap.
- A pending request opened from Home now routes to Squad > Requests.
- Training facility helper copy now uses the real +10% per Level, up to +30%.
- The Week 8 facility lesson skips upgrades blocked by a division lock.
- Money-only player requests now cost absence, condition, or reduced drills.
  Reduced-drill costs last at least two weeks, so answering after training cannot
  erase the whole cost before the next training week.
  Existing open requests keep their snapshotted cost until settled.
- New sponsor offers use Iron Wall, Goal Rush, or Road Warriors. Existing
  contracts keep their snapshotted legacy objective and remain settleable.

The sponsor approval gate passed two independent 3,000-seed cohorts, starting
at Seeds 0 and 40,000. Goal Rush's higher Bold bonus is measured compensation
for its lower completion rate, not an unchecked fallback.

Opus 5 reviewed the full uncommitted pass. Its one-week drill-cost and Advisor
mode request-routing findings were confirmed and fixed. The calendar collector
test now uses a reachable pre-season state, and whitespace-pinned source checks
were loosened. Its Goal Rush payout warning was rejected because both measured
approval cohorts passed the profile-spread and dominance gates.

Automated checks cover these paths. The Match Day formation control also passed
local built-in-browser QA. The saved-career migration and multi-week request and
sponsor behavior still need confirmation after deployment in the same career.

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
- Three Level 1 Stadium Stands produced a 400% total gate. D4 home gates
  regularly paid about $18,500-$22,000.
- Week 10's saved-career doubleheader paid two home gates and created a false
  $41,253 weekly surplus. Exclude that week from normal economy tuning.
- Even after a $69,041 transfer, four new training facilities, a Scout Office,
  a Youth Field, one drill upgrade, scouting, and three granted favors, closing
  cash reached $109,632. Season cash change was +$65,659.
- Keep all three Stadium Stands available. The optimized club used all three
  and still finished fourth. The missed opportunity was leaving late cash
  unspent instead of continuously upgrading performance facilities.
- One construction crew was a useful limiter. It kept the facility build order
  meaningful even after cash stopped being scarce.

### Team Trip

- In D4, Team Trip spent 44 TP and gave all 15 players +2 to all seven stored
  attributes. That is 210 raw attribute points before caps.
- The -10 condition cost left everyone at 90, which was still safe and recovered
  quickly. Taking the trip was strong, but the boost helped the squad stay
  competitive after promotion to D4.
- Keep the division-scaled reward: +1 in D5, +2 in D4, through +5 in D1. Keep
  the visible -10 condition cost. Do not flatten the reward unless later
  division playtests show that it makes promotion too easy.
- Spending banked TP before Week 19 is an intentional optimization, not an
  exploit. The trip is a fun power spike, its growth is spread across every
  player and stat, and many recipients will later leave the club.

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
  interval slightly so the system feels like people, not a timer. Code review
  confirmed the cadence already varies from a seeded probability curve; this
  career's exact seven-week rhythm was a coincidence, so no tuning changed.
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

1. Rival scorelines and league goal differences are too extreme.
2. Most cash favors become automatic yes decisions.
3. The 14-win sponsor target records success but does not shape how success is
   pursued.

The best next balance pass is small: narrow D4 opponent scoring extremes and
make favors and sponsors alter the optimal plan. Keep all three Stadium Stands
and Team Trip's promotion catch-up boost. Do not weaken the player's whole team.
The fourth-place finish shows the overall difficulty is already doing its job.

The D4 scoreline concern was measured before changing the match engine. A
20-match-per-cell probe produced 3.73 goals and 17.5% draws in D4 peer matches,
and 3.60 goals with 25% draws in D4 mismatch matches. D5 mismatches were more
extreme at 5.20 goals and no draws. The single played D4 season was an outlier,
not evidence that average D4 opponents need a buff. No D4 engine tuning changed.

The intended pace is one season for an expert in some early divisions, about
two seasons per division for a casual player, and up to three seasons for the
final D1 plus Hero Cup challenge. Difficulty should rise gradually rather than
making three seasons normal before D1.

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

## Fresh optimal career run — 2026-08-14

### Starting state — Season 1, D5, Week 1

- Joe completed the first part of onboarding and created `jojo`, an 18-year-old
  FWD with B potential and a 23% SUPER chance.
- `jojo` started at 50 PAC, 65 SHO, 50 PAS, 50 DEF, 50 TEC, and 50 STA. The
  full 15-point creation budget went into SHO.
- The club started with $53,000, 12 TP, 500 fans, and 15 players.
- One Finishing drill raised `jojo` from 65 to 68 SHO for 7 TP and 8 condition.
- The Training Pitch started at column 1, row 1 for $8,000. It takes two weeks.
- Sofia Rossi became head coach for $300 per week. She adds 5 TP weekly and
  gives +10% to DEF and SHO training.
- End of Week 1 management: $45,000, 5 TP, 500 fans, and no matches played.
- Investigated: Bert's fast-tap path already uses live refs for the current
  line, reveal, phase, and one-shot completion. The duplicate did not reproduce,
  so no extra tap delay was added.

### Season 1, Weeks 2–3

- Signed 16-year-old FWD Milo Ward for $500 and $174 per week. He has B-
  potential, 13% SUPER, and 68 PAC, but starts behind the stronger forwards.
- Week 2 training raised `jojo` to 75 SHO and Bo Hedges to 53 DEF. Week 3
  training raised `jojo` to 79 SHO, Bo to 59 DEF, and Gio Marsh to 54 PAS.
- The Coaching Office started at column 3, row 2 for $6,500 and opened after
  one week.
- Bramble lost the Week 3 home opener 1-3 to Quartz FC. Joss Ruby scored at 4,
  45, and 54 minutes; `jojo` scored at 20 minutes.
- The match started in 4-4-2 Balanced. Attack recovered 0-1 to 1-1, but Quartz
  led 3-1 before the switch to 3-4-3 Attack. Three fresh manual substitutes and
  late All Out produced no comeback.
- `jojo` awakened Thunder Strike after the loss. Its required match example
  scored and returned cleanly to the full-time flow.
- Observed balance: 4-4-2 Attack drained the early squad quickly. `jojo` reached
  30 energy by minute 60 despite starting at 92 condition. All Out was kept for
  minute 74 onward and still drove team energy from 52% to 28% by minute 89.

### Season 1, Week 4

- Priya Nair became assistant coach for $150 per week. She adds 3 TP weekly and
  gives +5% to SHO and REF training.
- The first Stadium Stand started at column 4, row 1 for $10,000.
- Training raised `jojo` to 82 SHO, Sam Mitts to 52 REF, and Gio Marsh to 50
  TEC.
- The previous live-match switch had saved 3-4-3 as the next opening shape. It
  placed a natural MID at FWD and a DEF at MID. The Match Day control was used
  to restore 4-4-2 before Quick Result.
- Harbor Comets beat Bramble 2-0 away. Harbor entered the week bottom with an
  0-1 record and -8 goal difference, so this was a surprising safe-match loss.
  Keep it as one result, not a balance conclusion.

### Season 1, Week 5

- The first Cup draw sends Bramble back to Quartz FC in the Week 10 Play-in.
  Quartz was D5 rank 1 and had already won the league opener 3-1.
- Five drills used 35 of 36 TP: `jojo` reached 86 SHO, Sam reached 56 REF, Bo
  reached 63 DEF, Gio reached 58 PAS, and Ravi reached 50 TEC.
- Bramble drew 4-4 at home with Cedar Crown. Dario Flint scored at 14, 24, and
  54 minutes. Milo Ward scored the 82nd-minute equalizer.
- 4-4-2 Attack with Save Energy recovered an early 0-1 deficit to 2-2. Cedar
  led 4-3 after a later 3-4-3 Attack switch. Late All Out produced the draw.
- Fixed locally: `jojo` reached 99% Thunder Strike charge, then the charge fell
  to 0% as the live feed showed `⚡ GOAL! Micah Ash` at minute 67. The feed
  had used lightning and gold for every goal. It now distinguishes normal,
  powered, controlled-team, and opponent goals. Power timing was unchanged.

### Season 1, Week 6

- A media story rewarded the risky Player of the Month nomination for Dario's
  hat trick. He gained 8 morale, 14 fame, and 9 SHO. The 60% upside was worth
  the failed-roll cost of 8 morale and 3 PAS.
- Four drills raised `jojo` to 90 SHO, Sam to 59 REF, Bo to 67 DEF, and Gio to
  54 TEC.
- Bramble won 4-0 away at Oakridge. Dario scored at 17 minutes. `jojo` scored
  Thunder Strike goals at 36 and 71. Zip Vela scored at 88.
- 4-4-2 Balanced and Save Energy held the first lead of the run. Automatic
  substitutions kept team energy near 62% at minute 79 without an All Out push.
- Zip Vela awakened Gravity Well after the match. Its required example and the
  return to the full-time report both completed correctly.
- End of Week 6 league record: 1W-1D-2L, four points, eighth place, and level
  goal difference.

### Season 1, Weeks 7–9

- The second Stadium Stand started at column 6, row 1. Cash fell to $14,033,
  then recovered through match and monthly income while it built.
- Week 8 Quick Result beat bottom club Meadow City 2-1 at home. This followed
  the surprising Week 4 loss to bottom club Harbor, so weak-opponent Quick
  Results are now 1-1.
- A Week 9 assistant story used male copy for Priya Nair: `Give him the week`,
  `Give him a session`, and `his own plan`. Fixed locally: coach-targeted story
  copy now uses gender-neutral pronouns.
- The safe one-session choice gave 5 TP. The risky choice had only a 30% chance
  of +2 weekly coach TP, against a 70% chance of -1 and worse squad morale, so
  its expected value was negative.
- Against one-hero Thunder Borough, 5-3-2 with Save Energy held 0-0 to minute
  34 and 1-1 to minute 82. Kurt Flash scored at 83, so Bramble lost 2-1 away.
  `jojo` scored at 39. The conservative plan was competitive but did not bank
  the draw.
- Entering the Week 10 Cup tie: 2W-1D-3L, seven points, sixth place, and level
  goal difference.

### Season 1, Week 10 — Hero Cup Play-in

- The second Stadium Stand opened. The Training Pitch Level 2 upgrade then
  started for $10,000 and two weeks, leaving $4,220 cash before the Cup match.
- Four Cup-week drills raised `jojo` to 105 SHO, Sam to 69 REF, Bo to 82 DEF,
  and Gio to 72 PAS.
- Bramble beat Quartz FC 3-0 away. `jojo` scored at 31, 49, and 61 minutes;
  the 49th-minute goal used Thunder Strike.
- 5-3-2 Balanced with Save Energy held Quartz scoreless, led 1-0 at halftime,
  and reached 3-0 by minute 63. No attacking formation switch or All Out was
  needed. This was the cleanest strong-opponent plan so far.
- The Cup run continues in the Round of 32 in Week 14.

### Season 1, Week 11

- The risky Cup-celebration story paid off: +7 squad morale and +95 fans. The
  failed outcome was only a $250 loss, so the 65% reward was the clear choice.
- The Round of 32 draw is away to Alder Rovers, D1 rank 8, in Week 14.
- Bramble beat unbeaten league leader Neon Athletic 6-0 at home. Dario scored
  twice, `jojo` scored three times, and Milo scored once. Two `jojo` goals used
  Thunder Strike.
- The match used 5-3-2 Balanced with Save Energy throughout. Bramble led 1-0
  at minute 19, 2-0 at minute 52, and 5-0 at minute 77.
- Against strong opponents, this plan is now 2W-1L with nine scored and two
  conceded: 2-1 loss at Thunder, 3-0 Cup win at Quartz, and 6-0 league win over
  Neon. Track more matches before calling it dominant, but the latest margin is
  extreme for a 44-strength squad against the 50-strength end of D5.

### Season 1, Week 12

- The Training Pitch reached Level 2. The first Fan Shop then started at column
  7, row 3, beside the second Stadium Stand for the merchandise combo.
- Quick Result lost 3-1 away to Moonlight Town. Bramble entered sixth on 10
  points and +6 goal difference; Moonlight was seventh on six points and -7.
- Weak-opponent Quick Results are now 1W-2L: loss at Harbor, win over Meadow,
  and loss at Moonlight. Stop using the shortcut until the club has a clear
  strength gap; the live 5-3-2 Save Energy plan is producing better evidence.

### Season 1, Weeks 13–14 — Cup exit

- The first Fan Shop opened in Week 13. Its edge with the second Stadium Stand
  activated the +10% merchandise combo.
- Cash fell to $1,584 before the Round of 32 because an idle Week 13 produced
  only $348 merchandise against $2,665 in wages and $340 upkeep, partly offset
  by the Season 1 subsidy.
- Alder Rovers, four divisions above Bramble, won the Cup tie 20-0. Paz Reed
  scored 16 times. Bramble stayed in 5-3-2 Balanced with Save Energy and used
  automatic substitutions rather than wasting condition on a hopeless chase.
- Observed balance: the cross-pyramid Cup mismatch was correctly signposted,
  but a 20-goal loss is so extreme that it reads more like a broken simulation
  than a heroic underdog lesson. This is being fixed in a separate session.
- The away Cup week had no gate or Cup participation income. Cash entered Week
  15 at $11 after another $1,573 operating loss.

### Season 1, Weeks 15–17

- The first free scout trip was sent to South America with a DEF brief. Before
  dispatch, both missions displayed `FREE` and enabled `Send free scout`, while
  also displaying `Not enough money.` The later Bert explanation clarifies the
  fee waiver. Fixed locally: a waived fee no longer carries the blocked reason.
- Bramble beat fourth-place Ferrous United 3-2 at home and third-place Quartz
  FC 2-0 away. Both matches used 5-3-2 Balanced with Save Energy. `jojo` scored
  four of the five goals, including one Thunder Strike goal in each match.
- The Ferrous home gate produced $4,608 and a $500 win bonus, rescuing cash from
  $11 to $3,497. Monthly advertising after Quartz added another $2,400.
- Against Harbor in Week 17, 5-3-2 Balanced held 1-1 through minute 69. A switch
  to Attack was followed by goals at 75, 79, and 84, producing a 4-1 home loss.
  Do not treat a late attacking switch as a free improvement when level.
- Extreme attendance added $738 after the Harbor match. Cash reached $8,870.

### Season 1, Weeks 18–19 — transfer window and Team Trip

- Listed Ty Brooks and Zip Vela. Ty moved to Cedar Crown for $6,789. The sale
  replaced a 40-rated, C- defender and removed his weekly wage.
- The free scout returned Hugo Gray, age 20, B- potential and 13% SUPER. His
  exact line after signing was 82 PAC, 51 SHO, 56 PAS, 64 DEF, 51 TEC, and 56
  STA before later broad gains. He was a major Starting XI improvement.
- Hugo signed for a fixed $11,209 fee, $197 per week, and three seasons, with a
  Starting XI promise. An opening $147 offer with the same long term, promise,
  and a liked pitch card was rejected; the second offer was accepted.
- Zip moved to Neon Athletic for $21,800. He was a 30-year-old, E-potential
  reserve with Gravity Well. The sale left legal goalkeeper and outfield cover,
  freed the second hero licence, and funded the early income engine.
- The third Stadium Stand started at column 5, row 3 for $10,000. Its footprint
  shares an edge with the existing Fan Shop. Cash after the two sales, Hugo,
  and the build was $16,250.
- Fixed locally: the Week 18 review animated three different final cash values
  for one settlement: `$14,765`, `$14,751`, and the next screen's actual
  `$14,750`. All three figures now use the same count-up duration.
- The `He Used To Keep Goal` story selected Sofia Rossi but used `him` in both
  choices, repeating the coach-identity copy bug seen with Priya. This copy is
  now gender-neutral. The safe choice gave 5 TP; the risky choice again had a
  30% upside and a persistent weekly downside.
- Team Trip spent 53 TP, reduced every player from 100 to 90 condition, and
  gave all 15 players +1 to every stored stat. Eight drills in Week 18 had
  reduced the pre-settlement TP bank to six before the unavoidable weekly TP
  income and story reward arrived.
- Hugo honored his Starting XI promise immediately. At Week 19 matchday he was
  a 60-rated defender. Bramble then beat Cedar Crown 2-0 away in 5-3-2 Balanced
  with Save Energy; `jojo` and Dario scored at 66 and 69 minutes.

### Training-plan correction — Week 22

- Joe correctly flagged that the run had stayed on each priority player's
  primary attribute too long. The intended handoff rule is no more than two
  drills per priority player each week, except before several match-free weeks.
- There is no hidden post-99 cap: ordinary contests compare displayed ratings
  proportionally. PAC and STA do have bounded curves, so every added point still
  helps but contributes less near their ordinary endpoints.
- The run now rotates across every position-relevant attribute while keeping
  each priority player to at most two drills per week. This corrects the earlier
  over-focus without imposing a two-attribute career limit.

### Season 2, Week 4 — final transfer-window rebuild

- Week 4 resumed with $3,171, 8 TP, 1,534 fans, and no league matches played.
  D4 averages 61 squad strength; Bramble started the week at 59.
- Sold 39-rated defender Mae Thorn for $3,779, 39-rated third goalkeeper Nora
  Vale for $3,581, and 64-rated defender Bo Hedges for $11,807. The squad kept
  two goalkeepers and enough outfield cover.
- Signed 19-year-old defender Quin North for $19,558 and $275 per week over
  three seasons, with a Starting XI promise. He arrived rated 88 with 117 PAS,
  119 DEF, and 117 STA, a major upgrade over Bo.
- One Pace drill used 7 TP and raised Quin from 88 to 92 PAC. His displayed
  rating rose to 89 and his condition fell from 100 to 92. This followed the
  corrected plan: train a useful supporting attribute instead of stacking more
  points onto his already extreme DEF.
- The early income engine is complete: three Stadium Stands, three Fan Shops,
  and the active merchandise combo. The Training Pitch is Level 2; the Gym,
  Tech Center, Scout Office, and Coaching Office are Level 1. No construction
  was affordable after the transfer.
- Northstar Tools pays $3,168 monthly and offers $14,400 for earning 18 away
  league points. The target should affect whether away draws are protected.
- The Hero Cup Play-in is at home to Thunder Borough in Week 10. Bramble has
  59 strength against a D4 range of 52–70.

## Fresh Spanish full-career playtest — 2026-08-15

### Run contract and setup

- Replaced the previous Season 4 save at Joe's request and started a new
  Chairman career on the deployed production build.
- Selected Spanish on the title screen before erasing the old save.
- Goal: win both D1 and the Hero Cup, reach the true ending, and follow the
  optimal-career handoff throughout.
- Log every visible English leak and every awkward, incorrect, unclear, or
  contextually wrong Spanish translation with its screen and career week. Log
  translation-caused clipping, poor wrapping, overlap, spacing, and layout
  problems too. Log bugs and balance findings here before fixing them after
  the true ending.
- Title screen, saved-career replacement flow, and initial player setup were
  fully Spanish. No English leak was visible before player creation.

### Spanish language and layout log — observed and open

- Season 1, Week 1, Home: the visible speaker label says `Boss` above the
  Spanish dashboard. This is an English leak; it should use the manager name or
  a Spanish label.
- Season 1, Week 1, Home accessibility copy: `Aficion`, `asi`, and `aun` are
  missing the required accents (`Afición`, `así`, `aún`).
- Season 1, Week 1, Home market note: `la plantilla que tienes es la que te
  quedas` is ungrammatical. It should say `la plantilla que tienes es con la
  que te quedas` or use shorter natural copy.
- Season 1, Week 1, Club and Market headers: `S1 · W1` uses the English `W`
  abbreviation throughout the Spanish UI. It needs a Spanish week label.
- Season 1, Week 1, construction map: the active build badge says `BUILD · 2W`.
  Both words are untranslated.
- Season 1, Week 1, Bert task footer: `INBOX CLEAR. ADVANCE WEEK.` is fully
  untranslated and appears on both the Club and Finance screens.
- Season 1, Week 1, roster and training: position and attribute abbreviations
  remain English (`FWD`, `MID`, `GK`, `PAC`, `SHO`, `STA`, and others). Spanish
  football abbreviations should be used consistently if these labels are
  intended to be localized.
- Season 1, Week 1, training modal: cost badges use `TP` while the same screen
  uses Spanish `PE`; the confirmation says `7 of 12`; and `Riesgo de lesión:
  Ninguna` has the wrong gender. These should read `PE`, `7 de 12`, and
  `Ninguno`.
- Season 1, Week 1, drill shop: `Sprints 1` is untranslated. `Sesiones nivel 2
  se abren...` is unnatural; `Las sesiones de nivel 2 se desbloquean...` is
  clear Spanish.
- Season 1, Week 1, facility count: `1 construidas` disagrees in number. It
  should be `1 construida`.
- Season 1, Week 2, SUPER drill result: `Súper entrenamiento session!` mixes
  Spanish and English. It should be fully Spanish.
- Season 1, Week 3, assistant-coach onboarding: `segunda plaza de staff` uses
  English. `segunda plaza del cuerpo técnico` is natural Spanish.
- Season 1, Week 4, assistant tutorial: Bert repeats the untranslated loanword
  in `Con puntos fuertes distintos, el staff llega a más sitios.` Use `cuerpo
  técnico`.
- Season 1, Week 3, match header: the week is `W3`, repeating the English week
  abbreviation. The speed accessibility label says `Velocidad 1 veces`, which
  is ungrammatical; use `Velocidad ×1` or `Velocidad normal`.
- Season 1, Week 4, weekly report: `¡Oficina Técnica listo!` has the wrong
  gender. It should be `¡Oficina Técnica lista!`.
- Season 1, Week 4, quick-result power cut-in: `TAP TO SKIP` is displayed in
  English over the otherwise Spanish presentation.
- Season 1, Week 5, Hero Cup bracket: every unresolved slot says `TBD`. Use a
  Spanish placeholder such as `POR DECIDIR` or a neutral dash.
- Season 1, Week 7, weekly report: `¡Grada listo!` has the wrong gender. It
  should be `¡Grada lista!`.
- Season 1, Week 11, `Un día con las cámaras`: both choice accessibility
  labels join the description and effect with two periods (`revés..` and
  `seguro..`). The visible cards are laid out correctly, but the spoken copy
  needs one sentence boundary.
- Season 1, Week 19, team-trip result: the tiny footer says `TOCA DONDE SEA
  PARA INICIO`. This is unnatural Spanish, and it remains partly exposed under
  the large `CONTINUAR` button. Use `TOCA EN CUALQUIER LUGAR PARA EMPEZAR` and
  hide the start prompt once the result button appears.
- Season 1 awards: `1 premio ganados` has the wrong agreement. Use `1 premio
  ganado` and preserve the plural form for other counts.
- Season 1 review: `Acabas #6` and `7W · 2D · 9L` are English-shaped copy.
  Use a natural Spanish finishing-position label and Spanish result initials.
- Season 1 Hero of the Season card: `BLINK RUN marcó la diferencia` bypasses
  the localized power name `Parpadeo`. Awards must resolve the localized power
  display name for every supported language instead of inserting the English
  source name.
- Season 1 renewal accessibility copy: `Contrato de 1 temporadas` and `Fichar
  a jojo 1 temporadas` use a plural noun with one. Use the singular form.

### Bugs — observed and open

- Season 1, Week 3, first live-match tired-player tutorial: automatic
  substitutions started enabled and used the only reserve forward before the
  tutorial paused for exhausted jojo. The tutorial then would not let the match
  resume until a substitution was saved, leaving only goalkeepers and defenders
  as replacements. Dara Ward had to play out of position at forward. Required
  behavior: the first live match starts with Auto Subs off; Quick Result always
  uses Auto Subs; later live matches remember the player's last live-match
  choice. The tutorial must not consume the legal same-role replacement before
  asking for a manual substitution.
- Season 1, Week 24, `Cuatro sin perder`: the risky choice currently rewards
  failure with +6 TP, so it has no downside. Change failure to -6 TP. The
  narrative is that rival coaches copied the plan and wasted the club's
  training preparation. Keep success at +140 followers and +15 TP.

### Season 1, Week 1 checkpoint

- Chairman difficulty, D5, Week 1. Cash $53,000, TP 12, and 500 fans.
- No matches played. Quartz FC is the first league opponent in Week 3.
- Training Pitch construction and hiring a coach are mandatory onboarding
  tasks. No construction is active yet.
- Starting squad: 15 players, 42.9 average rating, 43.5 Starting XI average.
  Player wages total $2,041 per week before the Season 1 wage subsidy.
- Spent 7 TP on one Shooting session for jojo, raising SHO from 58 to 61 and
  lowering condition from 100 to 92. TP ended at 5.
- Started the Level 1 Training Pitch at column 1, row 1 for $8,000. It takes two
  weeks. Hired Level 1 head coach Kenji Sato for $300 per week, adding 5 weekly
  TP, PAS/TEC training, morale protection, hero heat, and 4-3-3.

### Season 1, Weeks 2–3

- Signed 17-year-old C+ defender Dara Ward from the academy for $500 and $167
  per week over three years. Chose the defender over a second forward because
  the squad already has jojo and defense is the weaker long-term unit.
- Trained jojo in TEC and SHO, Dara in DEF twice, and Gio Marsh in PAS. The
  Week 3 TP bank ended at zero.
- Completed the Training Pitch and started the Level 1 Coaching Office beside
  it at column 3, row 1 for $6,500.
- Lost the first league match 0-1 at home to strong Quartz FC. The match was
  level until the 31st-minute goal. A switch from 4-4-2 Balanced/Save Energy to
  Attack and then 3-4-3 did not find an equalizer. jojo awakened Parpadeo after
  the match.

### Season 1, Week 4 checkpoint

- Chairman difficulty, D5. Record 0-0-1, sixth place. Hero Cup has not started.
- Cash $34,632, TP 27 before training and 6 after training, 500 fans, and 16
  players.
- Full squad average 42.8 before Week 4 training; Starting XI average 43.8.
  After three drills, jojo rated 55, Gio Marsh 49, and Dara Ward 40.
- Player wages total $2,208 per week. Head coach and assistant wages total $450
  per week before the Season 1 wage subsidy.
- Training Pitch and Coaching Office are both Level 1. No construction is
  active after the office opened.
- Hired Level 1 assistant Elena Petrova for DEF and PAS/TEC training, plus 3
  weekly TP. Week 4 training targeted jojo PAC, Dara STA, and Gio DEF.

### Season 1, Weeks 4–6

- Beat Harbor Comets 1-0 away, then lost 2-1 at home to Cedar Crown and 2-1
  away to Oakridge. jojo scored with Parpadeo at Oakridge. The record is 1-0-3
  and the club is eighth after four matches.
- Started the first Level 1 Stadium Stand at column 5, row 1. It completed at
  the start of Week 7.
- The early D5 schedule feels demanding on Chairman. Three of four opponents
  were competitive or stronger. The one Harbor win kept the opening from
  feeling hopeless, but focused drills lowering starters into the high 80s
  made condition a real tradeoff.

### Season 1, Weeks 7–8

- Completed the first Stadium Stand, then built the first Fan Shop beside it.
  The pairing activated the expected 10% shop-income combo. Started the second
  Fan Shop at column 4, row 2 in Week 8.
- Used four focused drills in each week while keeping the two-drill weekly cap
  per priority player. Training covered jojo TEC and SHO, Gio DEF and PAS,
  Dara DEF and STA, Sam REF, and Sol TEC.
- Joe clarified that condition below 80 is acceptable and must not become a
  hard blocker. The run will treat condition as a match-planning tradeoff,
  rotating only when the bench or schedule makes that the better choice.
- Drew 2-2 at home to Meadow City in Week 8. Bramble is eighth at 1-1-3 after
  five league matches. Cash ended at $15,168, TP at 37, and fans at 509 after
  match income and weekly recovery.

### Season 1, Weeks 9–18

- Lost the Week 9 rivalry match 1-0 at Thunder Borough. The live match stayed
  level until the 59th minute; switching to Attack and All Out at 68 minutes
  did not produce an equalizer.
- Led the Hero Cup play-in 2-0 through two jojo goals, but lost 3-2 after using
  Save Energy to protect the lead. The comeback made the energy choice matter,
  although one match cannot prove direct causation.
- The Week 11 condition lesson appeared when jojo and Gio reached 80. It
  correctly explained that drills lower condition first, then that starters
  pay the full match cost, substitutes pay half, rested bench players recover,
  and low condition lowers performance. The bubble fit the phone layout.
- Took the risky camera-day choice in Week 11. It succeeded for 90 followers
  and 20 fame. The percentage-based failure cost was only $254 because cash was
  low, so the risk felt proportionate instead of trivial or ruinous.
- League form stayed difficult: losses in Weeks 11, 15, and 16, a Week 12 draw,
  and a Week 17 win. Bramble entered Week 19 eighth at 2-2-7 with a -7 goal
  difference.
- Completed the second Stadium Stand and all three Fan Shops. The third shop
  was built beside the second stand. Cash repeatedly fell near $3,000 during
  Cup-bye weeks, so the early D5 economy still demands restraint.

### Season 1, Week 19 checkpoint

- Chairman difficulty, D5. League record 2-2-7, eighth place. Eliminated 3-2
  in the Hero Cup play-in.
- Cash $5,883, TP 36 before the team trip and 0 after it, 608 fans, and 16
  players. No construction is active. Facilities are one Training Pitch, one
  Coaching Office, two Stadium Stands, and three Fan Shops, all Level 1.
- Full squad average is 46.2. Starting XI average is 46.5. Priority ratings are
  jojo 65 at FWD, Gio Marsh 58 and Sol Reed 53 at MID, Dara Ward 52 at DEF,
  and Sam Mitts 39 at GK.
- Accepted the one-time Week 19 team trip. Spending all 36 TP for +1 to every
  attribute on every player was much stronger than four or five individual
  Tier 1 drills. Every player also lost 10 condition; jojo and Gio ended at 74,
  which is acceptable under the agreed condition strategy.

### Season 1 validity correction

- This season was not a valid fully optimized D5 run. The tester failed two
  explicit handoff checks: inspect Deals during the Weeks 17–18 transfer window,
  and convert stable income into the Level 2 Training Pitch first.
- Dead weight was not listed during the open window. The prior optimized run
  sold Ty Brooks and Zip Vela for $28,589 combined, which funded major squad and
  facility improvements. This run sent a scout in Week 19, after the window had
  closed, and left Nora Vale's exit request unresolved.
- The Level 2 Training Pitch costs $20,000 and would have raised the same
  staff-supported weekly TP income from 30 to 42. Missing the sales meant the
  club never held enough cash to start it.
- The tester also failed to refresh the saved Starting XI. By Week 30,
  61-rated Dara Ward and 57-rated Sol Reed remained on the bench behind a
  41-rated defender and a 46-rated midfielder.
- Therefore the sixth-place result cannot be used as a clean measurement of
  condition carryover. Condition added difficulty, but missed sales, the
  missing Pitch upgrade, a stale lineup, a different hero power, and different
  recruitment also materially weakened this run.

### Season 2, Weeks 1–4

- Applied the corrected optimization gates. Opened Scouting and Deals in every
  transfer-window week, inspected the Training Pitch upgrade, and compared the
  saved XI against every eligible reserve.
- Sold Ty Brooks for $5,950, Zip Vela for $4,854, Dario Flint for $4,892, Max
  Tanko for $6,272, Nora Vale for $4,516, and Sam Mitts for $5,427.
- Signed 18-year-old B-potential goalkeeper Ivo Tate for $34,475 and $417 per
  week over three years with a Starter promise. He reached 90 overall by the
  Week 4 checkpoint. Signed 17-year-old C+ backup goalkeeper Remy Moss and
  17-year-old C+ forward Dara Oak from the academy for $500 each.
- The Training Pitch stayed at Level 1 because Ivo was a major long-term XI
  upgrade. Its Level 2 quote remains $20,000 for another 12 weekly TP. This is
  an intentional, recorded delay rather than an overlooked upgrade.
- Focus training spread supporting attributes instead of feeding compressed
  headline stats: jojo PAC/TEC, Gio PAS/TEC, Ivo PAS/STA, Dara Ward
  PAC/STA/PAS, Sol DEF/TEC, and Ari SHO.
- Bert's facility-upgrade lesson did select the Training Pitch, but it arrived
  in Season 2 Week 2 instead of Season 1 Week 8. It appeared after the transfer
  spending and only explained upgrade mechanics. It did not say the Training
  Pitch was the recommended next investment or wait for an affordable moment.
- Week 3's risky school-visit story succeeded for +8 morale and 190 fans.

### Season 2, Week 4 checkpoint

- Chairman difficulty, D5. No matches played. Cash $3,166, TP 36 before
  training and 1 after it, 990 fans, and 14 players after the final academy
  signing.
- The 13-player pre-signing squad averaged 54.0. The saved XI averaged 54.8;
  the strongest eligible XI averaged 56.0.
- The saved lineup still benched 59-rated Sol Reed behind 46-rated Ken Ash.
  This must be corrected on the Week 5 team sheet before the first match.
- Priority ratings were Ivo Tate 90, jojo 75, Gio Marsh 67, Dara Ward 64, Sol
  Reed 59, and Ari Academy 1 44. Player wages were $2,560 per week before Dara
  Oak's $174 weekly academy contract.
- Facilities remained one Level 1 Training Pitch, one Coaching Office, three
  Stadium Stands, three Fan Shops, one Scout Office, and one Residence.

### Season 2, Weeks 5–9

- Corrected the saved XI before the opener by starting 59-rated Sol Reed over
  46-rated Ken Ash. The corrected lineup persisted through later matches.
- Won the first five league matches 4-0, 5-0, 4-0, 5-0, and 11-0. Ivo Tate
  kept five clean sheets. The Week 9 score is the first strong warning that a
  repeat D5 season can become boring once optimized recruitment and training
  compound.
- Continued spreading drills across position-relevant supporting attributes.
  No priority player received more than two drills in one week, and condition
  below 80 remained a planning tradeoff instead of a blocker.
- Granted Ravi Chan one week of leave for a hometown match. Ken Ash correctly
  replaced him in the saved XI for Week 9. Week 10 must confirm Ravi returns
  on time and automatically reclaims his former starting slot.
- The unavailable-player badge leaked English as `ON LEAVE · 1 SEMANA` on
  the Spanish match sheet.
- Upgraded the Training Pitch at the first safe post-recruitment opportunity:
  Week 9, with $20,044 available. The Level 2 project cost $20,000 and takes
  two weeks. Cash fell to $44 before a home match, making the timing aggressive
  but viable under the game's fail-soft weekly settlement.
- Week 7's risky `Mil voces` choice failed for -$200 and +30 followers. The
  loss was small but real.

### Season 2, Weeks 10–14

- Beat first-place Fable United 2-1 in a watched Hero Cup play-in. Balanced
  energy produced a two-goal lead; Save Energy after minute 69 protected it.
  The Cup's D2 Fable City then won the round of 32 by 3-1. That gap felt fair
  and matched Bert's warning that a three-division upset was unlikely.
- Ravi Chan returned exactly one week after his approved leave. He reclaimed
  his former starting midfield slot automatically and Ken Ash returned to the
  bench, confirming the unavailable-player lineup restoration fix works in
  this case.
- Sol Reed awakened `Doble Señuelo` in Week 11. Replacing Ravi's Hero License
  with Sol's correctly put the stronger 63-rated hero into the saved XI, though
  the two-license cap then forced unlicensed 48-rated Ravi behind 46-rated Ken
  Ash.
- Completed the Level 2 Training Pitch. Weekly TP income rose from 30 to 42 as
  promised. Started and completed a Level 1 Tech Center, then started a Level
  1 Gym immediately after the crew became free.
- League results stayed dominant: 4-0, 8-0, then a watched 1-0 away win against
  first-place Fable United. The top rival provided a tense match, while the
  bottom half remained too weak for an optimized repeat D5 squad.
- The rival power tile leaked English as `SUPER SPEED` during the Spanish live
  match. This is the same untranslated power-name path implicated by the
  earlier `BLINK RUN` season-award leak.

### Season 2, Weeks 15–30 and final review

- Finished D5 as undefeated champions: 18 wins, 0 draws, 0 losses, 99 goals
  for and 1 against. The repeat season became far too easy. Fable United was
  tense in the first two watched meetings, but lost the title decider 7-0.
- Used every open week for up to two position-relevant drills per priority
  prospect. Match weeks spread one drill each across starters and long-term
  reserves. Condition influenced the final title-match plan but never became a
  hard blocker.
- The facility-fire event correctly triggered after the release and win-streak
  thresholds. The risky choice failed and destroyed one Level 1 Fan Shop. The
  club rebuilt it on its original paired site the next week. The risk text
  repeats `70%` twice, its no-loss outcome says the vague `Historia asegurada`,
  and the failure copy says the club's main facility was lost even though the
  effect removed one Fan Shop.
- Signed 21-year-old B-potential midfielder Dara Quick for $8,825 and $156 per
  week over three years with a Starter promise. He immediately replaced a
  weaker midfielder. His scout report showed potential `E-–C+`, while the
  Deals page revealed exact B potential before signing, making the uncertainty
  path inconsistent.
- Tried to list Ravi Chan after the signing. Week 18 still said the market was
  open and enabled `Poner en venta`, but confirmation returned `Eso no se puede
  hacer ahora mismo`. The final-week listing action must work immediately or
  be disabled with an explanation.
- Built the Level 1 Gym, rebuilt Fan Shop, Shooting Range, Keeper Court, and
  Youth Field. Starting the $12,000 Youth Field with only $3,551 left caused a
  single negative-cash week and an automatic $15,000 emergency loan plus 10%
  interest. The $16,500 balance begins weekly repayment in Season 3. This was a
  real, fair consequence, but it was an avoidable optimization mistake caused
  by using too thin a cash reserve.
- Weekly-report number disagreement continued. Week 24 showed accessible TP
  income +42 but visible +41. The season-award screen similarly exposed a
  $6,160 prize in its accessible label while visibly showing $4,797.
- Spanish leaks found late in the season: `POWER COMPLETE` on Sol Reed's live
  power overlay, `YOU WON THE LEAGUE!` on the title celebration, `DECOY DOUBLE`
  in Hero of the Season, and `County League` in the D4 promotion reward copy.
- The awards card says `1 premio ganados`, which has incorrect singular/plural
  agreement. The season review says `Llega a 0 partidos` for a Cup run that won
  the play-in and then lost in the round of 32.
- Released expired dead weight Ed Stone, Ken Ash, Leo Quick, and Mae Thorn.
  Renewed Sol Reed for three seasons at $667 per week with a Starter promise,
  down from the hero-wage demand of $950.

### Repeated cash-display bug

- The weekly review repeatedly exposed two different closing balances. Week 1
  said $34,253 → $32,863 and net -$1,390 visually, while its accessible labels
  said $32,385 and -$1,868; Week 2 similarly showed $5,457 versus $5,103; Week
  3 showed $3,513 versus $3,166. The following week's saved balance always
  matched the accessible destination, not the larger visible value.
- The same mismatch briefly appeared in the header after transfers: $7,353
  versus $5,915, and $2,666 versus $2,669. Treat this as the same unresolved
  cash-state/render ordering bug until the shared source is traced.

### Season 3, Weeks 1–7

- Entered D4 with $67,904, 47 TP, 1,658 fans, and $16,500 still owed on the
  emergency loan. Signed Brightside Bank's bold sponsor: $3,168 monthly, a
  $5,280 bonus for eight league clean sheets, and a useful tactical reason to
  protect leads.
- Spent $25,000 on Level 2 Pace, Passing, Defense, Technique, and Goalkeeper
  drills. This was the first convincing later-season money sink. The club then
  stayed solvent through player sales, the sponsor payment, and home gates.
- Signed 17-year-old B- keeper Cal Lane for $750, sold surplus keeper Remy Moss
  for $3,945, and sold 43-rated defender Bo Hedges for $5,251.
- A targeted South America defender search produced a real choice. Elite
  specialist Finn Jett was unaffordable at $57,163. The club instead signed
  21-year-old, B-potential Ben Irons for $17,848 and $274 per week over three
  years with a Starter promise. His 67 starting rating immediately improved
  the defense without making the best target attainable.
- Training followed the optimized handoff. No priority player received more
  than two sessions in a week. Work moved between jojo and Ivo, the new Ben
  Irons, Dara Quick, and the young B- reserves. Midfield training included
  Defense, not only Passing and Technique.
- Corrected the saved team sheet before Week 5. The formation had placed a
  forward in defense and weaker players over stronger natural defenders. The
  final 4-4-2 used the strongest legal role players while preserving Starter
  promises and Hero Licenses.
- Changing to 3-4-3 auto-placed Starter-promise players out of position. The
  hard promise lock then prevented temporarily benching them to repair those
  slots. Returning to 4-4-2 was the only clean route. Formation changes should
  preserve promised starters in valid old or natural positions, or allow a
  direct starter-to-starter slot swap that keeps both in the XI.
- Opened D4 with wins of 1-0, 1-0, and 4-2. The first two matches were tense
  and earned sponsor clean sheets; the third showed more attacking freedom.
  This is much healthier than the repeat-D5 routs, though three straight wins
  suggest the optimized rebuild may already be above the lower D4 band.
- Player-request copy renders penalties as `--5 lealtad · --8 ánimo` instead
  of a single minus. Both `Mi propio gurú` and `El coche` would cut that
  player's training gains for four weeks, so both were denied.
- The finance ledger leaks `South America` in `Misión de ojeo · South
  America` while the rest of the Spanish scouting flow correctly says
  `Sudamérica`.
- The weekly cash mismatch persists in Season 3. Week 1 visibly closed at
  $35,841 and net -$3,813, while accessible values said $35,497 and -$4,157.
  Weeks 2–4 repeated the same split. The next saved balance again followed the
  accessible value.

### Season 3, Weeks 8–18

- Completed all seven Tier 2 drills for $35,000 total. Each session costs 11
  TP and gives +5 before facility bonuses. The 43 weekly TP income supported
  three or four useful sessions every week without breaking the two-sessions-
  per-player limit.
- Built a Level 1 Infirmary, then upgraded the Tech Center and Keeper Court to
  Level 2. These were meaningful cash sinks because their +20% bonuses visibly
  improve the relevant training sessions.
- The league stayed competitive through the first half. Bramble drew 1-1 at
  Dunwich and reached Week 16 level on 22 points with Copper Wanderers. A
  midseason sponsor challenge asked for either three goals or a clean sheet in
  the next match. Choosing the clean sheet changed the immediate priority, and
  the 2-0 win over Copper earned $6,336. This weekly sponsor format works.
- The Hero Cup round of 16 ended in a credible 6-0 loss away to D1 Iron
  Athletic. The gap was large without resembling the earlier broken 20-0
  outlier.
- A watched 4-0 Cup play-in win showed that Save Energy and remembered Auto
  Subs still worked. The rival introduction leaked `SUPER POWER`, even though
  the specific power name below it was translated.
- Sold 49-rated, 30-year-old Ravi Chan for $21,289 in the final transfer week.
  That funded the $53,320 signing of 108-rated specialist defender Finn Jett.
  The transfer was a satisfying late-window upgrade and confirms D4 scouting
  can produce a player stronger than the current XI.
- Finn's negotiation summary said only `$426 a la semana por 3 temporadas`,
  but the signed contract silently included a Starter promise. The team sheet
  did place him correctly in defense, yet promises should never be hidden from
  the final offer summary.
- Granted reserve Remy Ward two weeks of leave. The match sheet showed the
  untranslated `ON LEAVE · 1 SEMANA`. The persistent home greeting also shows
  the untranslated standalone word `Boss` under `Buenos días, jefe`.

### Season 3, Weeks 19–30 and final review

- Finished D4 as unbeaten champions: 17 wins, 1 draw, 0 losses, 63 goals for,
  4 against, 52 points, and +59 goal difference. Bramble beat second-place
  Copper 2-0 and 5-0. The first half was competitive; the second half became a
  procession.
- The annual Green Bull team trip spent 44 TP, gave every player +2 to every
  attribute, and cost 10 condition. Bramble immediately won 9-0. The reward is
  intentionally exciting, but it accelerated an already superior squad and
  made the late D4 schedule less interesting.
- Condition never forced a lineup change. The team trip put every starter at
  90%, and normal one-session match weeks usually left priority players around
  88–97%. This is acceptable in D4, but D3 must show whether the denser schedule
  finally creates meaningful starter-versus-bench choices.
- Upgraded the Gym, Shooting Range, Scout Office, and Youth Field to Level 2.
  Combined with the Infirmary and earlier upgrades, Season 3 absorbed roughly
  $130,000 in facility spending plus $35,000 in drill upgrades. Cash still
  repeatedly rebuilt after home gates, but aggressive upgrades briefly pushed
  the saved balance to -$1,160 before the next home match restored it. The
  economy offered real choices once every available Level 2 upgrade was used.
- The emergency loan shrank from $16,500 to $1,100 by Week 29. Weekly wages
  rose to about $4,477 before renewal. Gio Marsh renewed for three seasons at
  $450 per week, and Dara Ward renewed for three seasons at $300 per week.
- Main sponsor progress reached eight clean sheets, and the one-week stretch
  target paid correctly. Sponsor goals helped both the season plan and one
  specific match; the latter was the more interesting form.
- Player requests remained strategically easy when assigned to reserves. Remy
  Ward's leave and Cal Stone's family request were granted because neither
  reduced priority training. The negative option still renders `--5 lealtad ·
  --8 ánimo`.
- The title celebration again leaked `YOU WON THE LEAGUE!`. The awards screen
  exposed a $7,040 prize in its accessible label while visibly showing $3,264,
  and repeated the bad grammar `1 premio ganados`.
- The title screen credited jojo with 58 season goals while the team scored 63
  league goals and also played three Cup matches. This total needs a clear
  `liga` or `todas las competiciones` label before it can be trusted.
- The weekly cash bug remained severe. Week 27 visibly closed at -$550, while
  the accessible destination and next saved balance were -$1,160. Week 29
  visibly closed at $19,086, while the accessible destination and next saved
  balance were $18,444.
- D4 worked best during Weeks 5–16. The lower clubs supplied reachable wins,
  Copper supplied a real title rival, and the D1 Cup opponent showed the next
  ceiling. After Finn, the team trip, and several Level 2 upgrades, opponent
  growth did not keep pace. Preserve the wide 51–63 D4 band, but ensure the
  strongest clubs receive between-season growth so a repeat year cannot become
  another D5-style sweep.

## Season 4 · D3 Spanish Playtest

- Won D3 with a perfect 18-0-0 league record, 90 goals for, 3 against, 54
  points, and +87 goal difference. Second-place Beacon United finished ten
  points back. The final six league results were 7-0, 3-0, 10-0, 5-0, 3-0,
  and 7-0. D3 was not competitive after the optimized team reached full speed.
- The Cup was much healthier. Bramble beat Elm Athletic 4-0 in the play-in,
  then lost 4-3 to Dunwich Wanderers in the round of 16. That close loss gave
  the overpowered league squad a credible ceiling without feeling broken.
- Green Bull was the decisive balance lever. Six D3 trips cost $300,000,
  consumed all current TP, and gave every player +12 to every attribute in
  total. The individual-training lock worked, but weekly availability still
  let optimized home-gate income turn cash directly into a runaway squad.
  Green Bull is an effective money sink and a fun reward, but it is too
  efficient or too repeatable at its current D3 settings.
- All seven drills reached Tier 3. Each upgrade cost $15,000, for another
  $105,000 spent. Tier 3 sessions cost 17 TP and gave +8 before staff and
  facility bonuses. Production still showed $15,000 rather than the planned
  higher D3 price, so the live price needs checking against the design decision.
- Even after $405,000 of Green Bull and drill spending, gates repeatedly rebuilt
  cash into the $40,000-$90,000 range. The club ended with $72,623, up $12,362
  across the season. D3 has enough purchases, but its income growth can pay for
  all of them while also making the team much stronger.
- Replaced Level 2 Kenji Sato with Level 3 Rafael Costa. Weekly TP reached 44:
  10 base, 24 from the Level 2 Training Pitch, 7 from Rafael, and 3 from Elena.
  Staff hiring was a clear, worthwhile progression choice.
- The Level 2 Youth Field produced B- forward Milo Hart and B midfielder Jae
  Oak. Signing Jae immediately closed the academy and removed Milo. The warning
  says signing rejects the rest, but optimized play must create every needed
  roster slot before the first signing. This should be explicit in the handoff.
- The Level 2 Scout Office became unusable. D4 candidate Nico Vale persisted
  throughout D3 and blocked every new mission. He was not an upgrade, so signing
  him only to clear the state would have been wasteful. A stale candidate must
  expire or stop blocking a new-season mission.
- Sold Remy Ward, Dara Oak, Cal Stone, and other dead weight. Signed Jae Oak.
  The final 15-player squad had useful depth, but Green Bull improved every
  reserve too, reducing the transfer market's role.
- Condition still did not force a meaningful lineup choice. Trips lowered the
  whole squad to 90%, match costs lowered starters further, and the team trained
  prospects, yet routine recovery and the large quality gap kept the strongest
  XI available. D2's 10-point match cost is the next useful test.
- The one-match sponsor stretch target worked well. Bramble chose the three-goal
  target, switched to Attack, won 4-1, and earned $9,552. It changed one week's
  strategy without distorting the whole season.
- Save Energy again lost its active state during watched matches, including at
  halftime in the sponsor match. The tactic must remain selected until the
  manager changes it.
- Spanish remained understandable, but visible leaks included `Boss`, `SUPER
  POWER`, `ON LEAVE`, `YOU WON THE LEAGUE!`, and `DECOY DOUBLE`. Other issues
  included `--5 lealtad`, `Misión de ojeo · South America`, and mismatched
  visible versus accessible cash and award values.
- The title review showed `Llega a 0 partidos` beside `Dieciseisavos`, which is
  not a useful Cup summary. It should show the reached round without a zero-game
  phrase.
- Renewed Ari Academy 1, Ivo Tate, and Dara Quick for three seasons. jojo's
  requested D2 wage was $5,606 per week. Negotiation settled at $4,350 for
  three seasons with a Starter promise. Promotion wages became a meaningful
  late-season cost without forcing the club to lose its star.

## 2026-08-21 English Chairman career

This is a new career on production commit `9bd5d79b`, played in the visible
built-in browser with Master Volume at 0. The goal is the fastest efficient D1
title while recording player-facing balance, pacing, clarity, fairness, and fun.

### Start through Week 4

- Created 18-year-old B-potential forward jobo. All 15 creation points went to
  SHO, raising it from 50 to 65. Aiko Tanaka became head coach for SHO and DEF
  training. Sibusiso Dlamini became assistant coach for PAS, TEC, PAC, and STA.
- Built the Level 1 Training Pitch at column 1, row 1, then the Level 1 Coaching
  Office at column 8, row 1. Signed 16-year-old C+ midfielder Finn Vale over the
  slightly stronger Cal Hart because Finn's Anchor archetype fits midfield and
  he has another development year.
- Training used one session per priority player. Jobo trained SHO in Weeks 1-3.
  He hit consecutive SUPER sessions in Weeks 2 and 3, each visibly awarding
  +7 SHO, and reached 82 SHO. Sol Reed trained DEF twice and reached 42. Sam
  Mitts trained REF once and reached 52.
- Before the first match, the saved XI had 38-rated Nora Vale behind 37-rated
  Sam Mitts and 46-rated Sol Reed behind 45-rated Ken Ash. Both were corrected.
  Treat the new-career default as a player-facing optimization trap until the
  intended current-strength-versus-potential choice is made clear.
- Beat Quartz FC 2-1 in Week 3. Balanced produced a 1-0 lead by 18 minutes.
  Save Energy protected a 2-1 lead, but four players were tired by minute 71.
  Four manual substitutions raised team energy from 48% to 70% and held the
  result. The tactical loop felt tense, fair, and useful.
- Jobo awakened Fire Torch after full time. The three-beat reveal and match
  example were clear and exciting. The accessibility tree repeated the same
  goal and power announcement about twelve times during animated goal beats;
  verify with a screen reader before grading severity.
- Week 4 checkpoint: fourth in D5, 1W-0D-0L, +1 goal difference, 3 points,
  $35,119, 27 TP, 505 fans, 16 players, $2,208 weekly player wages, Training
  Pitch L1, Coaching Office L1, and strongest-XI average 43.9 on Chairman.

### Observed open blocker outside this new career

- The existing deployed career could not open. The screen reported
  `Hero youth-s3-2 must be licensed or benched`. Its visible Back to title
  button returned to the same error after both semantic and pointer-style
  clicks. The save was not deleted or replaced.

### Balance and fun watchlist

- Consecutive 23% SUPER rolls made the created forward improve from 65 to 82
  SHO in two weeks. The moments were fun and readable, but this career is now a
  high-growth outlier. Measure whether it trivializes D5 before changing odds.
- Save Energy no longer showed an active marker immediately after manual
  substitutions. It was selected again before play continued. Reproduce before
  calling this the previously reported persistence bug.

### Weeks 4–10

- Beat Harbor Comets 1-0 in a watched Week 4 match, Cedar Crown 2-0 by Quick
  Result, Oakridge Owls 3-0 by Quick Result, and Meadow City 1-0 by Quick
  Result. Bramble opened 5W-0D-0L with four clean sheets. Hero-free D5 matches
  were good Quick Result candidates; they moved quickly without feeling free.
- The first manual Fire Torch test happened before the current ARMED control
  change was explained. Pressing ARMED produced `POWER WASTED`. This is known
  work in progress and is not a new finding. In the later Thunder match, two
  real `FIRE!` windows were pressed successfully. Both consumed the power, but
  neither scored.
- The Week 10 home tip still says `Powers fire on their own` and `There is no
  button`, while the match-day sheet offers a remembered MANUAL setting and the
  watched match exposes a FIRE button. This copy contradicts the current
  manual-power contract.
- The current condition rule rewards one drill per priority player. A single
  drill costs 8 condition and normal weekly recovery usually restores it. Two
  jobo drills in Week 5 left him at 84%, and he began Week 6 at 92%. Stacking
  drills creates visible condition debt without making routine one-drill weeks
  punitive. This is clearer and more usable than the old handoff rule.
- The guaranteed Four Without Losing interview gave +6 squad morale and 105%
  training for three weeks. It was better for an optimized run than the risky
  55% option, whose failure applied 75% training for three weeks. The choice
  had a real expected-value tradeoff without needing hidden math.
- SUPER growth remained unusually strong. Sol Reed jumped from 52 to 58 PAS,
  Sam Mitts jumped from 55 to 63 REF on a 5% roll, and Bo Hedges later gained
  +7 DEF on a 7% roll. Sam replaced Nora Vale, kept three straight clean
  sheets, and reached 81 REF by the Cup match. Bo reached 78 DEF. These spikes
  were exciting, but they made focused training much stronger than spreading
  sessions across the squad.
- Facility order was Training Pitch L1, Coaching Office L1, Stadium Stand L1,
  then Fan Shop L1 edge-adjacent to the Stand. The pairing visibly unlocked
  +10% merchandise income. The Week 8 home statement clearly broke out a
  $1,248 base gate at 200% for $2,496 and $251 merchandise plus adjacency for
  $276. This explanation was excellent.
- Started a second Stadium Stand in Week 8. Cash fell to $8,263, then the next
  home win and monthly advertising lifted it to $12,110. The aggressive build
  was risky but recoverable, so the early economy created a useful decision
  instead of a fake choice.
- Thunder Borough was far above the rest of D5. Bramble entered the Week 9
  match 5-0-0 with +8 goal difference; Thunder entered 5-0-0 with +23. Larry
  Alan's Super Speed scored the first equalizer, and Thunder won 3-1. Two other
  Larry goals were normal match goals, so the hero did not single-handedly
  create the whole margin.
- The Hero Cup immediately rematched Bramble with Thunder in Week 10. A 5-3-2
  Deep Counter, a natural fifth defender, and automatic Quick Result powers
  still lost 2-0. Losing twice to the dominant D5 club was credible. Drawing
  that same club in the no-second-chance Cup one week later felt harsh and
  removed Cup play before the squad could make a meaningful adjustment.
- Changing to 5-3-2 initially put natural midfielder Ravi Chan at DEF while
  natural defender Mae Thorn stayed on the bench. The formation change keeps
  existing starters rather than selecting a role-valid XI. This is another
  player-facing optimization trap; the manager must inspect every position
  after changing formation.

### Weeks 11–19

- Quick Result drew 2-2 with Neon and 2-2 with Moonlight, then later drew 0-0
  with Quartz. Those results kept the D5 promotion race close despite a much
  stronger trained core. Important run-in matches are now watched rather than
  simulated.
- Max Tanko awakened Super Strength after the Moonlight draw. The three-stage
  reveal was clear, funny, and exciting. The second Hero License was assigned
  immediately; the third permit cost $100,000, which was far outside the D5
  economy.
- The Week 13 leaders screen showed Larry Alan on 27 goals after eight league
  matches. Thunder reached +39 goal difference after 11 matches. One extreme
  club makes the title feel predetermined, but its wins against other clubs
  can help a player racing for the second promotion place.
- Beat Ferrous United 1-0 in a watched Week 15 match and Harbor Comets 1-0 in
  Week 17. Fire Torch fired automatically and scored the Harbor winner at 77
  minutes. Nine players were tired by full time even after three halftime
  substitutions. A normal home match against a weak, hero-free club consumed
  too much team energy.
- Save Energy repeatedly lost its active state after goals, halftime, power
  events, or substitutions. It had to be selected again during several
  watched matches. The effect is visible enough to change match management.
- Two Stadium Stands and two adjacent Fan Shops formed a strong, readable D5
  economy. The Harbor home win paid $4,773 gate and $818 merchandise. Empty or
  away weeks still lost about $600–$1,300, so the build order rewarded home
  fixtures without removing cash pressure.
- A Local immediate-starter FWD mission cost $2,750 and took three weeks. The
  report arrived in the final transfer week. The timing was understandable,
  but dispatching one week later would have made the paid report unusable.
- The report generated 23-year-old Zane Lane with estimated minimums of 144
  PAC, 133 SHO, and 134 TEC. His exact values were 158 PAC, 158 SHO, 158 TEC,
  69 PAS, 60 DEF, and 69 STA: 112 OVR, B- potential, and 17% SUPER. This is a
  severe D5 scouting balance outlier, not merely a lucky useful starter.
- Funding Zane required selling Max Tanko to Thunder for $27,285, Dario Flint
  to Quartz for $6,975, and Ravi Chan to Ferrous for $10,812. The roster floor
  correctly blocked a third sale until another outfield player was signed.
  Cheap scout result Kai Stone was signed for $5,591, then sold to Oakridge for
  $7,066 after Zane arrived. This bridge-signing path is legal, profitable, and
  gamey; Kai's unhappy departure line acknowledged the behavior well.
- Contract talks label Pitch Card as optional. In Kai's second round, changing
  wage and term did nothing when Make the offer was pressed. Selecting another
  Pitch Card made the same offer submit. This looks like a validation or input
  bug because no error explains why the optional control became required.
- Week 19 still showed `The scout came back short` after Zane had been signed
  from that shortlist. The bank-balance copy was stale and contradicted the
  completed transfer.
- A Week 19 team trip cost 34 TP and 10 condition per player for +1 to all six
  stats on all 13 players. That is about 78 total stat points for the same TP
  that buys four D5 drills. At 90% condition before a hero-free match, taking
  the trip was an obvious decision rather than a tradeoff.
- The saved 4-4-2 put Zane at DEF and natural MID Ken Ash at FWD. Changing to
  3-4-3 kept Zane at DEF. A direct starter-to-starter tap correctly swapped
  Zane and Ken, then Mae Thorn replaced Ken in defense. The feature works, but
  the instruction only mentions tapping a starter and `the replacement`, so
  the required starter-to-starter repair is not obvious.
- Zane's first match ended Cedar 0-9 Bramble. Zane scored five and jobo scored
  four while Save Energy was used for most of the match. One Local scout roll
  changed a one-point promotion race into a likely walkover. This result is
  decisive evidence that immediate-starter generation needs a division-aware
  ceiling or price that a D5 club cannot reach through ordinary sales.

### D5 finish and D4 opening

- Bramble won D5 at 14-3-1 with 74 goals for and 10 against. The post-Zane
  league results were 9-0, 8-0, 7-0, 8-0, 11-1, 10-0, and 5-1. Thunder had
  beaten Bramble 3-1 before the transfer; Bramble beat Thunder 8-0 afterward.
  Zane did not just improve the squad. He removed the division's competition.
- jobo finished with 40 goals and won Player, Hero, and club Player of the
  Season. His hero renewal ask was $910 per week. A rejected $500 offer and a
  $550 follow-up produced a $707 counter for three seasons with a Starter
  promise. The negotiation had a useful arc and a meaningful final cost.
- Season rollover added Cal Ward, Cal Stone, and Gio Oak to the senior roster
  without a decision, fee, or clear explanation. The squad rose from 13 to 16.
  All three were age 17 with three-year contracts. This is generous and useful,
  but it reads like unexplained save mutation rather than a club event.
- Zane displayed B- potential in D5 and C+ at the D4 rollover. If potential is
  recalculated with age, the grade change needs an explanation. Otherwise this
  looks like state drift.
- The academy then offered one more youth player at only $500. Cal Vale was
  signed as goalkeeper succession cover, filling the 17-player cap. His Sniper
  archetype boosts SHO, a stat a goalkeeper does not use. That is a weak and
  confusing academy combination.
- Built Dorm Level 1 for $6,000. Its +3 weekly recovery combines with the base
  +8 to restore one drill's -8 condition every week. This lets every core player
  drill once per week without long-term condition loss, making the Dorm an
  unusually strong early facility.
- Bought Defense and Stamina Tier 2 for $5,000 each. Defense drills on young
  Anchor Cal Stone produced +8 gains after position, archetype, Training Pitch,
  coach, and banked fractional bonuses. The detailed confirmation explains the
  stack well, but these gains make focused players scale very fast.
- A safe Week 2 story choice gave +55 fans and Training 105% for five weeks.
  Its guaranteed training value was better than the risky choice's expected
  training value, so the safe option was also the optimization choice.
- D4 opened with a 4-2 Quick Result win, then a 4-3 away loss in 3-4-3. A
  corrected 4-4-2 won the next match 2-1. The division immediately punished an
  open formation, which was a welcome difficulty step after the D5 blowouts.
- Switching 3-4-3 to 4-4-2 again kept player slots instead of natural roles.
  Gio Oak started in midfield and Finn Vale in defense until both were replaced.
  Formation changes require a full manual role audit every time.
- Ed Stone asked for a massage therapist. Granting it cut all squad drills to
  80% for two weeks; refusing cost only Ed 5 loyalty and 8 morale. Refusal was
  the clear optimization choice, so the request did not create a close tradeoff.
- The first D4 rival-hero match ended Orchard 1-8 Bramble in corrected 4-4-2.
  Zane scored seven and jobo scored once with Fire Torch. The reported rival
  hero did not create a visible highlight. Zane still overwhelms current-tier
  opposition even after the formation is made more defensive.

### D4 Season 2 finish

- Bramble finished third at 12-1-5, with 70 goals for and 39 against. Dovewell
  won with 51 points and Elm finished second with 48. The difficulty increase
  was welcome after D5, but the same extreme scorer still produced a very high
  goal total without securing promotion.
- Thunderbolt's sponsor target required eight clean sheets. Bramble managed
  only two despite four natural defenders with 93-108 DEF and a goalkeeper
  with 108 REF. The target did not match the division's high-scoring match
  model, so the sponsor paid nothing.
- A South America report produced midfielders whose useful attributes reached
  estimated ranges near 200. Their asking prices were roughly $360,000 to
  $488,000. One weak player remained affordable. D4 scouting therefore felt
  feast-or-famine instead of producing a credible upgrade ladder.
- A $4,000 detailed report disabled its purchase button but left every ability
  as a range. It did not reveal exact values or explain that no more detail was
  available.
- The game aborted twice during ordinary play. The first abort followed a
  detailed-report purchase and a drill; the second followed a Thunder Quick
  Result. Both actions had already persisted even though the recovery screen
  said the save was unchanged. That message is unsafe and false for these
  cases.
- The season-end ceremony showed an award prize of $6,160. The review then
  showed `Prize $9,000` and `Cash actually received $0`, while closing cash had
  still increased by about $7,100. The accounting and copy disagree.
- Gio Oak won Hero of the Season despite barely appearing. The award seems to
  value owning a power more than using it or contributing in matches.

### D4 Season 3 promotion

- A rapid scout dispatch exposed stale selection state. The mission screen
  showed `Immediate starter`, but Send charged the prior Bargain price of
  $5,500 and used the prior three-week duration. The report returned after the
  transfer window closed. Changing mission type must update the submitted
  mission atomically.
- Selling retiring Nora Vale did not clear her retirement inbox item. It
  remained every week. `The scout came back short` also persisted through a
  new season despite successful reports and more than $200,000 cash.
- Gio Marsh awakened Rally Cry after a 6-2 win. The reveal abruptly described
  CPR and chest compressions without an earlier health incident. It was
  tonally severe and confusing for this game's style.
- Awakening automatically benched Gio Marsh because he lacked a Hero License.
  After Gio Oak was unlicensed, the screen showed 1/2 permits. Selecting Gio
  Marsh offered `License and swap`, but confirming failed three times with
  `That is not possible right now, boss.` The bug blocked the new hero and his
  new power for the rest of D4.
- The Rally Cry demo briefly showed a valid `FIRE` button, then auto-fired
  before the browser could press it. During this run, ARMED was treated as
  read-only and was never pressed. Only FIRE is considered an allowed manual
  input while the manual-power changes are in progress.
- A Week 19 team trip asked for 1,475 TP and 10 condition from every player for
  +2 to all six attributes. TP had become abundant, but condition before a
  match remained valuable. The scaling made refusal clearly optimal.
- Quick Result variance was extreme with the same healthy 4-4-2: 6-2, 1-7,
  7-0, 2-3, 12-0, 6-0, 5-5, and other large swings. A squad with four elite
  defensive attributes still conceded 42 league goals. Defensive ratings do
  not feel proportionate to outcomes.
- One player request asked for a charter flight `before a cup tie` four weeks
  after Bramble had already been eliminated. The gameplay effect was still
  usable, but the context copy was stale.
- Bramble earned promotion in second at 12-3-3, scoring 82 and conceding 42.
  Yewtree won by eight points and beat Bramble 7-1 and 4-3. Yewtree felt like a
  credible superior club, but the route to second was much easier than the
  score volatility suggested.
- Empty-week drills on academy midfielder Jae Ward raised him from 50 to 57
  OVR. A final 7% SUPER roll gave +10 PAS. This was exciting, but 1,958 TP
  remained at rollover. Condition, not TP, is the real training limit, so TP
  income is far above useful spending.
- Promotion unlocked Tier 3 drills, rumored-Hero scouting, a third Hero
  License, and Level 3 coaches. These rewards clearly communicate the next
  optimization targets.
- Contract talks saved meaningful wages but repeatedly forced a Starter
  counteroffer. Bo Hedges renewed for three years at $348 per week, Gio Marsh
  at $701, and Zane Lane at $898. The negotiation is readable, but selecting a
  promise did not make the submitted offer acceptable; the agent still moved
  to a higher final wage with the same promise.

### D3 Season 4 opening

- Sponsor offer cards showed $2,400 and $2,376 per month, but the signing
  messages called the contracts $3,000 and $2,970. The Chairman club then
  received the smaller card values. The difficulty adjustment exists, but the
  two displayed contract values make the deal unclear.
- Green Bull's recurring Team Trip now asks for $50,000 and every current TP
  for +2 to all six attributes and -10 condition per player. With more than
  2,000 TP saved, its cost grows when the player saves well. Refusing it is
  overwhelmingly optimal. Coach Speech has the same all-current-TP problem
  for a single second-half +6 team boost.
- Academy midfielder Remy Vale rose from 52 to 59 OVR in three early drills.
  Two later batches raised him from 59 to 75 in three weeks: DEF 47 to 88,
  SHO 41 to 66, and TEC 64 to 93. The batches cost only 78 TP. Multiple safe
  drills plus youth, facility, coach, and SUPER bonuses make focused youth
  growth extremely fast while the club still holds about 2,000 TP.
- A D3 Bargain goalkeeper report produced a useful and affordable ladder.
  Nico Knox cost $45,057 and signed for $516 per week with a Starter promise.
  His exact REF was 158 and his OVR was 96, versus the previous starter's 41
  OVR and 108 REF. This report felt far more useful than the D4 outlier report,
  though one cheap scout mission still supplied a massive immediate upgrade.
- The third Hero License still cannot be assigned cleanly to a benched hero.
  Selecting Gio Oak at 2/3 permits says it will move him into the XI and bench
  an `unlicensed hero`, even though both current starting heroes are licensed.
  Cancelling is optimal because accepting risks weakening the starting XI.
- The D3 opener was a watched 0-1 home loss to Quarry. Quarry's two heroes
  visibly completed powers; the second power phase coincided with the only
  goal. Neither licensed Bramble hero visibly completed a power. The next two
  Quick Results were a 2-0 away win and a 2-2 home draw, so D3 immediately
  felt more competitive than D4.
- The first D3 home gate paid $38,116 after the three-stand multiplier. One
  home match almost covered the $45,057 goalkeeper fee. Facilities make home
  fixtures exciting, but the transfer budget is now much looser than the
  weekly wage and away-match economy suggest.
