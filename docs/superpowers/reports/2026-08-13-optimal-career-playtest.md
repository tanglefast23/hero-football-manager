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
