---
title: "HFM optimal browser playtest"
type: qa-handoff
date: 2026-08-14
status: handoff
---

# Hero Football Manager optimal browser playtest handoff

## Mission

Play Hero Football Manager as an expert manager. Win the Hero Cup in the fewest
seasons possible while testing balance, clarity, pacing, and fun.

Continue the current saved career unless Joe explicitly asks for a new game.
Do not reset, delete, or replace the save to make testing easier.

## Start in the built-in browser

1. Open Codex's built-in browser pane.
2. Navigate to `https://hero-football-manager.vercel.app/`.
3. Do not open external Chrome unless Joe explicitly asks.
4. Mute the page immediately if the browser tool provides a mute guard.
5. Open the game's Settings from the gear button.
6. Set Master Volume to `0` before doing anything else.
7. Confirm the volume is `0`, then return to the game.
8. Confirm the visible season, division, week, cash, TP, and current objective.
9. Record whether the career uses Cozy or Chairman difficulty.

The game must stay silent. Do not take over Joe's mouse, keyboard, or focus.
Use only the built-in browser controls for the playtest.

## Before advancing a week

Record the starting state:

- season, division, and week;
- league place and record;
- Hero Cup round;
- cash, TP, and fans;
- current facilities and construction;
- squad size and important player condition;
- sponsor objective progress; and
- any open player request, contract, transfer, or story decision.

Never advance a week until every useful action has been considered.

## Career checkpoints

Record a full checkpoint in Weeks 1, 4, 19, and 30 of every season. These
snapshots make season growth measurable instead of relying on memory.

Each checkpoint must include:

- full-squad strength;
- Starting XI average rating;
- every long-term player's role rating;
- cash and TP;
- facilities and active construction;
- total weekly player wages;
- squad size; and
- the current difficulty.

Use the Week 1 and Week 30 snapshots for season growth. Keep the Week 4 snapshot
separate because transfer-window changes can otherwise look like training
growth. If Week 1 was missed, label later growth as a conservative partial
measurement rather than a full-season result.

## Weekly optimal loop

Use this order every week:

1. Read new inbox items, player requests, sponsor progress, and story choices.
2. Check construction. Keep the one construction crew working whenever an
   affordable improvement exists.
3. Check scouting, transfers, contracts, and player sales.
4. Review condition and repair the Starting XI.
5. Spend TP on focused training.
6. Decide between Quick Result and a watched match.
7. Read the post-match report and change the next week's priorities.
8. Record bugs, copy problems, balance findings, and meaningful decisions.

## Training strategy

Concentrate TP on the best four or five players.

Prioritize players by:

1. potential;
2. Starting XI importance;
3. condition above 90;
4. a weak attribute that directly affects their role; and
5. a team weakness exposed by recent matches.

Train each priority player no more than twice per week. The exception is when
several following weeks have no matches. Spread those drills across any
attributes that affect the player's position; do not lock a player to only two
attributes over the career.

Role priorities:

- Goalkeepers: REF first, then PAS or PAC.
- Forwards: SHO first, then PAC or TEC.
- Midfielders: PAS and TEC first, then DEF, STA, or PAC.
- Defenders: DEF first, then STA or PAC.

If a priority player is at 90 condition or below, move to the next suitable
player. Do not spread TP evenly across reserves or irrelevant attributes.

Do not train only the star striker forever. Season 2 showed that midfield and
defense become the limiting units after promotion.

## Team Trip and Green Bull Training

Keep the automatic Team Trip in the early divisions:

- D5: +1 to every stored stat;
- D4: +2.

The whole squad loses 10 condition.

The trip removes every banked TP but gives the same stat reward. Under the
current rules, spend most or all TP before Week 19, then accept the trip when
the squad can absorb the condition loss.

From D3 onward, use the optional Green Bull Training button instead:

- it costs $50,000 in D3, $80,000 in D2, and $120,000 in D1;
- it requires at least one full week's TP income;
- it consumes all current TP;
- it gives every player +2 to every stored stat;
- it costs every player 10 condition; and
- it can be used once per week.

Spend useful excess TP first, but keep the required full-week minimum. Consider
the trip when broad squad growth is worth more than the focused drills and the
next fixtures leave enough recovery time.

This is an intentional, owner-approved optimization. Team Trip should feel like
a fun, slightly overpowered midseason reward. Its growth is broad rather than
focused, and many boosted players will eventually leave the club, so it does
not replace deliberate training of the long-term core. Do not report the low-TP
timing as a bug or remove it during a balance pass.

## Facility and money strategy

Complete tutorial-required facilities first.

Build the early income engine:

1. Build all three Level 1 Stadium Stands.
2. Build Level 1 Fan Shops where affordable.
3. Prefer a useful new Level 1 building over a weak commercial upgrade.
4. Upgrade commercial buildings only when the payback remains useful.

The third Stadium Stand is part of the optimal strategy. Do not cap the player
at two during this playtest. The D4 club used all three and still finished
fourth.

Once income is stable, convert cash into team strength immediately:

1. Training Pitch;
2. the facility supporting the current weakest unit;
3. Tech Center for weak midfield PAS and TEC;
4. Gym for PAC and STA;
5. Shooting Range when finishing limits results;
6. Keeper Court when goalkeeping limits results;
7. medical and recovery facilities when condition blocks training or lineups;
   and
8. Youth Field after immediate performance needs are covered.

Start Level 2 performance upgrades as soon as the division allows them. Level 3
facilities remain locked until D2. Their upgrade prices are 50% higher than the
earlier draft, while Level 2 prices stay unchanged. Drill upgrades cost $5,000
for Tier 2, $15,000 for Tier 3, $30,000 for Tier 4, and $60,000 for Tier 5.
Together with Green Bull Training, these are the approved later-career money
sinks. Do not add another sink unless the live D3 career still piles up cash.

Do not finish a season with a large unused balance while the construction crew
is idle. That was the main optimization error in Season 2.

## Transfers and squad management

Scout during every useful transfer window.

Buy only a major Starting XI improvement. Avoid expensive marginal upgrades.
Repair the weakest unit before adding another star to an already strong unit.

List dead weight early. Do not wait for the roster to become full.

Keep enough cover for:

- a legal Starting XI;
- a backup goalkeeper;
- injuries;
- player absences; and
- automatic substitutions.

Negotiate important renewals before the club loses leverage. Do not overpay a
reserve who can be replaced cheaply.

## Lineup and formation strategy

Use the strongest legal players for the selected formation. Correct the saved
XI when it retains a weaker player over a stronger available player.

Useful patterns from the real career:

- `4-4-2 Balanced` is a reliable Quick Result default.
- `3-4-3 Attack` is strong against weaker D5 clubs.
- `3-4-3 Attack` is less reliable against strong D4 clubs.
- `5-3-2 Deep Counter` is useful against elite opponents.
- Start defensively against a stronger club, then switch to Attack when the
  score requires it.

Avoid role mismatches unless the stronger player's advantage clearly exceeds
the mismatch penalty.

## Quick Result or watched match

Quick Result uses the same match engine. It is not inherently weaker. It runs
the unattended plan and automatically replaces tired players, but it removes
the manager's chance to change formation, playstyle, energy, or substitutions.

Use Quick Result when:

- the club has a clear strength advantage;
- the default formation and energy plan should be enough;
- no sponsor objective needs special behavior; and
- condition management is straightforward.

Watch live when:

- it is an important Hero Cup tie;
- the opponent is close or stronger;
- promotion depends on the result;
- a sponsor goal needs defensive or attacking behavior;
- condition management matters; or
- formation changes could rescue the result.

Time-saving shortcuts are encouraged when they do not reduce win efficiency:

- Tap outside a drill animation to skip it.
- Use Quick Result for safe matches.
- Skip previously viewed presentation sequences when the game allows it.

## Live-match tactics

Do not start ordinary matches on All Out.

All Out drains energy rapidly and can use every automatic substitution too
early. Start on Balanced or Save Energy unless there is a specific reason not
to.

During the match:

1. Watch the score, energy, and opponent strength.
2. Protect a lead when the opponent becomes dangerous.
3. Increase pressure when trailing.
4. Save All Out for a late emergency.

The strongest Season 2 example started `5-3-2 Deep Counter` with Save Energy
against Garnet. A later switch to `3-4-3 Attack` turned a 0-2 deficit into a
2-2 draw.

## Condition strategy

- Avoid training a priority player at 90 condition or below.
- Rotate a tired starter when the replacement is credible.
- Preserve condition before Hero Cup weeks.
- Do not use aggressive energy against weak opponents without a reason.
- Account for Team Trip's -10 condition before Week 19.
- Refuse an absence when it removes an essential starter before a major match.

When granting any timed absence, record the player's exact saved slot and
whether it was a starting slot. On the return week, verify that the player is
available and restored to that slot. The current occupant must move to the
bench, even if several different replacements used the slot during the absence.

## Player requests

Accept a player request only when its cost does not damage an important plan.

Refuse when it would:

- remove a key starter before a Cup or promotion match;
- reduce training for a current priority player;
- drain condition before a difficult fixture;
- break positional cover; or
- conflict with a sponsor objective.

Judge the loyalty and morale loss against the football cost. Do not grant every
request automatically.

Every unresolved request must remain in the inbox until a decision is made.
Opening or reading it must not remove the inbox item. Record a bug if the item
disappears early or the request cannot be reopened.

## Story interruptions

Check that each story's player wording matches its selection rule.

- A hard claim such as fastest, youngest, or most popular must automatically
  choose the matching player.
- If several players tie, a seeded random tie-break may choose among them.
- A general story may let the manager choose any eligible player.
- The preview, result, and story copy must describe the same target.

Record every mismatch across the full story catalog, not only the story that
first revealed the problem.

## Sponsors

Choose the objective that best fits the squad or creates an affordable strategy
change. Do not automatically choose the largest headline bonus.

For the tactical objective design:

- Iron Wall rewards clean sheets, GK/DEF training, and protecting leads.
- Goal Rush rewards three-goal matches, attacking formations, and early
  pressure.
- Road Warriors rewards away points, away-match preparation, and protecting a
  valuable away draw.

Track whether the selected objective truly changes training, lineup, or live
tactics. Record it as weak design if normal optimal play completes it without a
meaningful decision.

## Hero Cup planning

Hero Cup weeks are 10, 14, 18, 22, 26, and 29.

Plan backward from each Cup week:

- preserve condition;
- avoid unnecessary All Out use;
- delay nonessential player absences;
- train likely starters;
- finish useful construction before the tie; and
- watch close ties live.

League promotion matters, but Cup readiness takes priority when the mission is
the fastest Hero Cup win.

## What to record while playing

Save every running problem immediately in:

`docs/superpowers/reports/2026-08-13-optimal-career-playtest.md`

Use that file as the single source of truth across future sessions. Do not keep
bugs, typos, balance traps, or design ideas only in chat or memory.

Record:

- bugs and reproduction steps;
- typos and unclear wording;
- tutorial highlights that point at the wrong place;
- stale cards or incorrect navigation;
- UI inconsistencies;
- balance traps;
- dominant strategies;
- systems that fail to change the optimal plan;
- meaningful choices and why they mattered;
- boring or repetitive weeks;
- fun match moments;
- final league, Cup, economy, facility, and squad results; and
- how a casual player would likely perform differently.

Separate each item into one of these states:

- observed and open;
- recommendation only;
- implemented locally;
- verified fixed; or
- intentionally unchanged.

Do not mark a finding fixed until the player-visible behavior is verified.

Take a screenshot when a visual bug cannot be explained clearly with text.

## Playtest discipline

- Play the deployed build unless Joe asks for a local URL.
- Do not edit code merely because a problem was observed.
- Log findings first. Implement only when Joe asks.
- If code changes deploy during the career, preserve the existing save and
  verify whether migration reaches it.
- After each deployment, record the tested commit or deployment identifier.
  Reload the deployed page, reopen the same save, and confirm season, week,
  division, cash, and TP before continuing.
- Do not invent results when the browser cannot prove them.
- Do not infer balance from one surprising match. Record the sample size.
- Finish and report the current season before making another broad balance
  change, unless a blocker makes later results misleading.
- If the club stays in a division, test the repeat season before weakening its
  strongest opponents. Player growth may turn the same division into a very
  different challenge.
- Keep the browser silent for the whole session.
- Continue until the requested season ends, the Hero Cup is won, or Joe stops
  the test.

## Mid-playtest balance blockers

Do not continue collecting results after a bug or total imbalance makes the
rest of the career misleading.

1. Log the problem and the last trustworthy week in the running report.
2. If a code fix can preserve the current save, implement and verify the fix.
3. Ship the fix to the build being tested, refresh the built-in browser, load
   the same saved career, confirm its season and week, then continue.
4. If the broken feature is avoidable, skip that feature and keep testing the
   rest of the game. Record exactly what was skipped and why.
5. If neither path preserves useful results, stop before resetting the career
   and ask Joe what to do.

Never silently continue through a blocker that invalidates later balance data.
Never reset the save merely to make the test easier.

## Intended promotion pace

- Every non-user club in the full pyramid grows each offseason: 2.5% on Cozy
  and 5% on Chairman. This is fixed season growth, never scoreline or
  user-strength rubber-banding.
- The current Season 2 run has a conservative measured baseline of 59 squad
  strength in Week 4 and 70 at the finish: +11, or 18.6%. Week 1 was not
  captured, which is why future runs must use the checkpoint rules above.
- An optimal manager may clear an early division in one season.
- A casual manager should usually earn promotion within two seasons per
  division. Two seasons is a fair progression grind, not a balance failure.
- Difficulty should rise gradually as the club climbs.
- D1 and the Hero Cup may take three seasons. This should be the longest final
  challenge, not the normal pace for earlier divisions.
- Narrow extreme scorelines without making the average opponent stronger. A
  casual club may enter D4 later with a better squad than this test career had.

## Season-end report

At every season end, add a clearly titled `Season N review` section to the
running report. Also give Joe the same concise report in chat.

Report:

- league position, wins, draws, losses, goals for, and goals against;
- Hero Cup result;
- ending cash, TP, fans, and squad size;
- facilities built and upgraded;
- transfers, sales, and important contracts;
- strongest players and training distribution;
- sponsor result;
- requests that changed the optimal plan;
- whether money remained meaningful;
- whether the season was too easy for optimal and casual players;
- whether each week offered enough to do; and
- the most important bugs and balance recommendations.

State what worked, what did not work, and what should change. Separate observed
evidence from suggestions.

## Division-end report

When the club leaves a division, add a clearly titled `D# division review`
section to the running report. Also give Joe the same concise report in chat.

Report:

- seasons spent in the division;
- best and worst league finishes;
- squad strength on arrival and promotion;
- facilities and economy on arrival and promotion;
- tactics and training plans that worked;
- systems or strategies that stopped working;
- difficulty for an optimal player and a likely casual player;
- whether the intended promotion pace was met;
- fun, variety, and repetition across the division; and
- bugs, balance changes, and design suggestions specific to that division.

## Separate work

Penalty-shootout presentation has its own handoff:

`docs/superpowers/plans/2026-08-14-penalty-shootout-handoff.md`

Do not fold that implementation into a normal playtest session.
