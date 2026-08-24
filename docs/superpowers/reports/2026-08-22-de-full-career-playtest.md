---
title: 'German full-career optimal playtest'
type: qa-report
date: 2026-08-22
status: complete-with-ending-crash
locale: de
---

# German full-career optimal playtest

Fresh Cozy career on merged main `2fcaecbb`, played in the built-in browser from
an isolated local origin. The production Season 3 save was not replaced.

## Starting state

- Bramble Rovers, Season 1, D5, Week 1.
- $53,000, 12 TP, 15 players, two free Hero Licenses.
- Created forward Kai Sturm: 55 Pace, 60 Shooting, other stored stats 50.
- Master volume 0%; Quick Result enabled.
- Completion requires both the D1 title and the Hero Cup.

## Running findings

- The first two D5 fixtures both ended in 0-3 defeats: Quartz FC at home and
  Harbor Comets away. The team was improving each week, but the opening level
  still felt intentionally severe even on Cozy.
- The natural-role lineup persisted after a manual change. Milo Oak remained
  in defense for the next match. The initial bench choice was defensible only
  if the selector heavily values 100% condition over his stronger attributes;
  keep watching this before calling it a lineup bug.
- **Bug — formation change rebuilt the wrong goalkeeper.** Switching from
  4-4-2 to 3-4-3 in Week 8 started Nora Vale (38 overall, 51 REF, 100%
  condition) and benched Sam Mitts (38 overall, 70 REF, 92% condition). Both
  were natural-role goalkeepers. An eight-point condition edge should not
  outweigh a 19-point gap in the position's primary attribute. Manual swapping
  worked. Switching again to 5-3-2 in Week 9 reproduced the same bug, even
  after Sam's REF had risen to 73.
- The Week 3 first-match awakening worked. Kai Sturm received Gravity Pull and
  automatically occupied one of two Hero Licenses.
- TP use followed the handoff. Week 3 spent 21/21, Week 4 spent 21/27, and Week
  5 spent 35/36 across forward, midfield, defense, goalkeeper, and stamina.
- Facility order followed the handoff: Training Pitch, Coaching Office, then a
  Stadium Stand. Two Stand/Fan Shop pairs, a Dorm, and a Scout Office followed
  before specialist training buildings. Leila Haddad joined as assistant coach
  for defensive training.
- German copy has been clear and complete so far. No English leakage or visible
  text overflow has appeared through Week 5.
- The Week 5 finance page calls the under-construction Stadium Stand "Nicht
  gebaut". This is not wrong, but "Im Bau" would describe the state more clearly.
- Results through Week 8: L 0-3, L 0-3, W 1-0, W 2-1, L 0-1. The attacking
  3-4-3 experiment against last-place Meadow City produced no goals and a loss;
  4-4-2 remains the safer Quick Result baseline.
- Results from Weeks 9-16: L 0-4, Cup W 4-0, W 3-0, W 3-2, Hero Cup L 0-12,
  W 4-0, W 1-0. The stored 5-3-2 became effective once the natural-role lineup
  and both available Hero Licenses were correct.
- **Balance concern — early Hero Cup draw.** The Week 14 round-of-32 opponent
  was Zephyr Vanguard from D2, three divisions above the D5 club. The 0-12
  result was not competitive. Cross-division Cup variety is good, but this draw
  gave a developing first-season club no practical chance to participate.
- The late-scout warning works. A Week 16 three-week mission opened a clear
  confirmation explaining that the report would miss the deadline and expire.
  Choosing `Warten` safely returned to mission setup. A two-week mission could
  then be sent for a Week 18 return.
- German copy remains complete through Week 16. No English leakage or visible
  text overflow has appeared. The scout deadline warning was especially clear.
- **Bug — the scouting recovery path still breaks at the deadline.** The safe
  two-week Week 16 mission returned in Week 18 with three reports. Every report
  still showed only wide attribute ranges, every $2,500 detail report was
  disabled because it would return too late, and no player had a signing action.
  The $4,750 mission therefore could not produce a midseason transfer.
- **Contract controls use percentage steps.** Kai Sturm's early renewal used
  $50 steps because that was about five percent of his asking wage. Later
  renewals scaled to $70, $200, and $430 steps as asking wages increased.

## D5 season review

- Finished second and earned promotion: 12 wins, 0 draws, 6 losses, 36 points,
  54 scored and 22 conceded.
- The turning point was a disciplined 4-4-2 with Kai and Dario trained for
  shooting, Ravi and Gio for passing, and Milo for defense. Its late results
  included 7-0, 10-1, 2-0, 7-0, and 6-0 wins.
- TP discipline held. Useful drills consumed nearly every weekly grant. The
  Week 19 Green Bull trip used exactly that week's 36 TP and gave all 15 players
  +1 to every attribute; it was excellent value, not a hoarding artifact.
- Useful money was spent on two Stand/Fan Shop pairs, Dorm, Scout Office, Youth
  Field, Strength Room, Shooting Range, and Technique Lab. One weak reserve was
  sold before the midseason deadline. Cash was not left idle.
- Fun: the visible late-season power curve and promotion race felt rewarding.
  The head-to-head 2-0 win over second-place Neon was a strong climax.
- Not fun: scouting charged meaningful money but could not produce a signing.
  The D2 Cup draw and 0-12 exit felt like a foregone conclusion.
- German copy remained readable and natural through the full D5 season. No
  English leakage or layout overflow was visible.

## D4 running review

- **Bug — unexplained season-reset players remain.** Season 2 began with two
  new 17-year-old forwards, Cal Ash and Gio Oak, already in the 17-player squad.
  No inbox item, youth decision, or season-review copy explained their arrival.
  Cal was sold to make room for the actual youth intake.
- **Bug — automatic lineup still benches a better natural-role player.** Youth
  midfielder Nico Moss (49 overall, 100% condition) was benched for Ken Ash
  (46 overall, 100% condition) in the first D4 match sheet. Manual swapping
  worked and then persisted.
- **Bug — German finance copy leaks English.** The Week 4 finance report used
  `Current Sponsor · Sponsor monatlich` inside an otherwise German screen.
- The season reset correctly preserved the chosen 4-4-2 and Sam Mitts in goal.
  The earlier poor-formation reset did not reproduce.
- Scouting failed again in the first D4 window. A Week 1 two-week mission
  returned in Week 3, but every report still had wide ranges, every detail
  report was disabled as too late, and no signing action existed. This makes
  the Scout Office and mission fee a repeated dead end, not a one-off deadline
  mistake.
- D4 opened with four losses: 2-3, 3-4, 2-4, and 2-4. The matches were closer
  than the earlier first-season D5 losses, but repeated defensive training and
  a 5-3-2 did not yet stop four-goal concessions. Mae Thorn awakened after the
  fourth loss, creating a useful defensive-license choice.

### D4 Season 2 result

- Relegation removal worked. Bramble finished ninth at 3-2-13, with 11 points,
  42 goals scored, and 69 conceded. The review said `GERETTET` and kept the
  club in D4.
- This was better than relegation. The team was improving late in the season,
  so replaying D5 would have removed challenge and delayed useful D4 upgrades.
- The Week 19 Team Trip was excellent value when used correctly. It consumed
  the current 46 TP and gave every player +2 to every attribute.
- By season end, all seven drills were Level 2. The club also had all three
  stands, all three fan shops, and every unlocked training facility at least
  at Level 1.

### D4 Season 3 result

- Bramble won D4 at 14-1-3. It scored 73, conceded 34, and finished on 43
  points. The final title decider was a 5-2 away win over second-place Opal.
- The second D4 season was a strong recovery story. First-half losses kept the
  race uncertain. Regular drills, the Team Trip, and facility upgrades then
  produced a clear second-half surge.
- Fun: the three-way promotion race stayed close until the final weeks. The
  last match still decided the title even though promotion was already safe.
- Balance: a small TP bank makes Team Trip feel strong rather than punitive.
  Entering with 46 TP produced a large, clear team-wide gain.
- Facilities reached Level 2 for all three stands, all three fan shops, the
  Strength Room, Shooting Range, Keeper Area, and the Technique Lab upgrade in
  progress. This made home income and targeted drills feel connected.
- **German copy leak:** the title celebration displayed `YOU WON THE LEAGUE!`
  inside an otherwise German presentation.
- **Review copy issue:** after a title-winning 14-1-3 season, the review still
  said no single story shaped the season.

## D3 running review

- The first five league matches were all wins: 2-0, 3-2, 5-0, 3-0, and 4-1.
  The D3 opening therefore feels challenging but fair after optimized D4 play.
- Green Bull worked as the intended money sink. A Week 6 visit cost $50,000
  and 43 TP, then gave all 15 players +2 to every attribute. Its next displayed
  price rose to $75,000.
- Three Level 2 stands are extremely strong. The first two D3 home wins earned
  $41,382 and $43,224 in gate receipts. This supports building stands and shops
  before miscellaneous facilities.
- **Bug — season-reset filler players remain.** D3 began with Paz Flint and Cal
  Hart without explanation. The squad had room before they appeared. Both were
  sold, and their fees funded wages and useful upgrades.
- **Bug — detailed scouting still cannot produce a signing.** A Week 1
  three-week mission returned in Week 4. All three reports only showed ranges,
  detail reports were disabled because the window would close, and no signing
  action existed. Selling players before the report created two empty squad
  slots, so squad capacity was not the cause.
- **Bug — automatic lineup still ignores a newly licensed hero.** Activating
  Mae Thorn as the third licensed hero left her on the bench behind lower-rated
  Ty Brooks. A manual same-role swap worked and persisted.
- **Contract issue:** Ravi's negotiation controls used $70 steps, which is
  about five percent of his $1,310 asking wage. This confirms percentage-based
  steps are present in this build. However, the final counteroffer included a
  `Stammplatz` promise after the visible offer was made without a promise.
- **German copy leak persists:** monthly finance reports still use
  `Current Sponsor 1` and `Current Sponsor 2` beside `Sponsor monatlich`.
- **Cup volatility:** Bramble beat Zircon 3-2 away in the league, then lost 3-4
  at home to the same club in the Hero Cup preliminary round.

### D3 Season 4 result

- Bramble finished third at 12-2-4. It scored 59, conceded 31, and earned 38
  points. Alder and Elm both promoted on 39 points.
- The season missed promotion by one point despite a +28 goal difference. The
  final 1-1 draw at first-place Alder left Bramble second, but Elm won its last
  match and moved ahead.
- Fun: the promotion race was excellent. Week 28 was a 3-1 home win over the
  leader, and Week 30 still decided all three top positions.
- Frustrating but fair: the margin was extremely small, but the decisive
  defeats were visible results against strong opponents. No relegation meant
  the close season still felt like progress rather than lost time.
- League form was much more stable than the Cup: 12 wins from 18 matches, with
  a 7-2 league revenge win over Zircon after the preliminary Cup loss.
- Green Bull was used four times at $50,000, $75,000, $100,000, and $125,000.
  The rising price made each trip a real money decision while home-match income
  kept later visits possible.
- All seven drill paths reached Level 3. Because each Level 3 drill costs 17 TP,
  weekly TP often left a 9-12 point remainder. Carryover fixed this on the next
  week, when three drills could usually be completed.
- **Balance spike:** a Week 21 home loss, 4-5 to one-hero Lumen, came directly
  after a $100,000 Green Bull trip. The same optimized team also beat comparable
  opponents by five or more goals. D3 Quick Result variance remains wide.
- **Review copy issue persists:** the review said no story shaped a 38-point
  promotion chase decided on the final day.
- **Contract bug reproduced twice:** final counteroffers for Ravi and Kai added
  a `Stammplatz` promise even though the visible offers were sent without a
  promise. The percentage steps themselves worked: Ravi used $70 steps and Kai
  used $200 steps, both close to five percent of the original asking wage.

### D3 Season 5 result

- Bramble won D3 at 17-1-0 with 52 points and a +96 goal difference. The only
  dropped points were a 2-2 draw in the final match.
- This season was too easy after the close Season 4 promotion race. League
  wins included 10-0, 8-1, 8-0, 7-0, and 6-0. Optimized drills, Green Bull,
  and retained player growth caused a sharp one-season snowball.
- The Hero Cup run produced the best upset so far. Bramble drew 3-3 with D1
  Cinder Swifts and won the shootout 3-2. Redmarch Albion then ended the run
  2-0 in the round of 16.
- Green Bull cost $150,000 and then $175,000. It remained a useful money sink.
  TP was spent every week; Level 3 drills cost 17 TP and carryover supported
  two or three drills each week.
- **Bug — more unexplained filler players.** Milo Flint, Finn Flint, and Cal
  Ward appeared at the season reset without a story. Two were sold immediately.
- **Bug — stale transfer-request notification.** The inbox said Ravi wanted a
  transfer because of poor morale. His player page showed 46% morale, and the
  Requests tab had no active request or decision path.
- **Accessibility bug — stale resource labels.** After drills, the visible TP
  number changed but the button's accessible name continued to announce the
  old TP amount.
- **German copy issue:** the fire-event risk text stacked `Chance` and `Risiko`
  in one sentence, making the 70% outcome hard to parse.

## D2 season review

- Bramble finished second at 16-0-2 with 48 points and a +71 goal difference.
  Ashford won the division with 51 points and +74. Bramble handed Ashford its
  only loss, 3-2 away in the final match.
- The two league losses were both 1-2: away at Hollow and home to Ashford.
  This made D2 the best-balanced division. The top clubs could punish mistakes,
  but optimized play still earned promotion in one season.
- Bramble won the Hero Cup. Results were 7-1 Ember, 9-0 Northgate, 3-1 Inkwell,
  4-1 Redmarch, 3-0 Vellum, and 1-0 Verdant in the final.
- The Cup run felt excellent. The 1-0 final was tense after several dominant
  rounds, and beating Redmarch answered the prior season's 0-2 elimination.
- All seven drills reached Level 4. Four key paths were bought immediately,
  with the remaining paths bought as home income arrived.
- Green Bull was used at $200,000, $225,000, and $250,000. The rising price
  forced real timing choices without making the money sink unusable.
- D2 wages created about a $12,000 weekly loss before matches. Three Level 2
  stands and shops made home weeks strongly profitable, so salaries were a
  constraint rather than a punishment.
- **Bug — automatic lineup remained wrong.** The first D2 sheet started
  lower-rated Gio Vale over newly signed A-potential defender Ivo Gray. A
  manual same-role swap fixed the lineup and persisted.
- **Bug — season reset added three unexplained fillers.** Eli Ash, Nico Cole,
  and Ivo Ward appeared without story copy. Two surplus fillers were sold.
- **Bug — contract controls had stale accessible names.** The visible player,
  wage, and selected term changed, but the action button continued announcing
  Sam Mitts or Ravi Chan and the old one-year term.
- **German copy leak:** finance reports continued to show `Current Sponsor 1`,
  `Current Sponsor 2`, and `Current Sponsor 3`.

## D1 season review

- Bramble won D1 in its first attempt with a perfect 18-0-0 record: 54 points,
  98 goals scored, 11 conceded, and a +87 goal difference.
- Bramble also won a second consecutive Hero Cup. It beat Zephyr 5-0, Hollow
  6-0, Verdant 5-0, Tarn 5-0, and Cinder 7-0. The Cup aggregate was 28-0.
- The D1 title was mathematically secure after Week 28. The final league match
  was a 7-0 away win over Vellum.
- Tarn was not overpowered in this run. Bramble beat it 4-1 away, 5-0 at home,
  and 5-0 in the Cup semifinal. Ashford lost 7-0 and 4-0.
- D1 was much too easy for this optimized squad. The first half ended 9-0, and
  the only close league result was a 2-1 away win at Kestrel after Green Bull.
  The strongest opponents did not create a title race.
- The team reached this power level through weekly TP spending, all Level 4
  drills, four Level 5 drill upgrades, repeated Green Bull use, and four active
  Hero Licenses. Kai's Shooting and Mae's Defense both reached the 999 cap.
- Green Bull was used whenever cash safely covered the next weekly bill. Late
  prices reached $300,000, $325,000, and $350,000. This kept cash moving while
  avoiding an emergency loan.
- D1 wages were not the cause of the old long journey. Weekly player wages were
  $22,520, and the normal pre-match weekly loss was about $13,000-$14,000.
  Home gates regularly restored more than $120,000. Negotiating Kai from an
  $8,658 ask to $5,971 for three seasons also mattered.
- The D1 economy felt fair. Salaries limited pre-season upgrades, but strong
  home income funded later Level 5 drills and Green Bull sessions.
- **Bug — automatic lineup still preferred roster order.** Cal Oak, rated 53,
  started over Ivo Moss, rated 74, at equal role suitability. The game also left
  newly licensed Ivo Ward on the bench until a manual swap.
- **Bug — two more unexplained fillers.** Ari Lane and Cal Oak appeared at the
  D1 season reset. A youth signing then filled the final legitimate squad slot.
- **Bug — money-themed requests do not show money costs.** Requests for a
  drone, golden shoes, and diamonds only applied training multipliers. If D2+
  money requests are meant to cost triple, the current choices do not expose
  that rule or any money amount.
- **Good license behavior:** the fourth permit activated Ivo Ward without an
  error. Later awakenings correctly said they were waiting for a license and
  did not consume one automatically.

## Critical ending bug

- **The true-ending screen crashes after the perfect D1 season.** Returning
  from the Week 30 result produced this player-facing error:
  `inputRange must be monotonically non-decreasing
  0,0.21999999999999997,0.88,0.040000000000000036,1`.
- The error screen was entirely English in the German career.
- The error said the last action might already be saved. Returning to the title
  showed `Saison 7 · Woche 30`, confirming the win had persisted.
- Reloading and continuing the save reproduced the same crash. The D1 title and
  Hero Cup were won in simulation, but the player cannot view the final D1
  celebration or true-ending presentation.
- The web log points to `DeferredEndgameCelebrationScreen` in
  `src/ui/DeferredSkiaSurfaces.web.tsx`, rendered through `ScreenTransition` in
  `src/ui/components/ScreenTransition.tsx`. The ending animation builds an
  `inputRange` where the fourth value, about 0.04, comes after 0.88. The range
  must be sorted or the animation phases must use separate interpolations.

## German localization and layout summary

- Most German gameplay copy was readable and natural. Long request text,
  transfer details, training confirmations, and match sheets fit the desktop
  layout without visible clipping.
- Repeated English leaks remained in high-value screens: `YOU WON THE LEAGUE!`,
  `Current Sponsor`, and the full ending-crash recovery screen.
- Several controls exposed stale accessible names after their visible text had
  changed. This affected TP and cash headers, contract player names, contract
  terms, contract wages, and some post-animation buttons.

## Final verdict

- Completion reached in Season 7: D1 champion and Hero Cup champion.
- Efficient route: D5 promotion, two D4 seasons, two D3 seasons, one D2 season,
  and one D1 season.
- Best division: D2. It gave optimized play a strong but fair one-season test.
- Weakest balance: the second D3 season and D1. Both became rout-heavy after
  the optimized economy and training loop compounded.
- Best feature: Green Bull. It converted excess cash and current-week TP into a
  visible squad-wide gain without needing a third currency.
- Highest-priority fixes: the D1 ending crash, automatic lineup selection,
  scouting's unusable signing path, unexplained filler-player creation, stale
  contract accessibility text, and remaining German-English copy leaks.
