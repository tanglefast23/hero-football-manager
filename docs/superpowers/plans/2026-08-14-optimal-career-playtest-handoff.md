---
title: 'HFM optimal browser playtest'
type: qa-handoff
date: 2026-08-21
status: current
---

# Hero Football Manager optimal browser playtest handoff

## Mission

Play as an expert manager. Win D1 and the Hero Cup in the fewest seasons
possible. Both trophies are required to complete the main journey.

Optimize the current saved career unless Joe asks for a new game. Never reset,
delete, or replace a save to make the test easier.

The test must also record:

- bugs and reproduction steps;
- balance problems;
- what feels fun or boring;
- what feels fair or unfair;
- each season and division; and
- anything that could improve the game.

## Start in the built-in browser

1. Open Codex's built-in browser pane.
2. Use the URL Joe gives you. Otherwise use the current visible game tab.
3. Keep the browser visible when Joe wants to watch.
4. Mute the page immediately.
5. Set Master Volume to `0` in Settings.
6. Confirm season, division, week, difficulty, cash, TP, fans, and objective.
7. Confirm the save is the intended career before changing anything.

Do not use Joe's mouse or keyboard. Do not open external Chrome unless Joe
asks.

## The correct weekly loop

Use this order every week:

1. Read the inbox, requests, sponsor progress, stories, and contract warnings.
2. Note the cash needed for known wages, renewals, and the next planned transfer.
3. Start or upgrade every useful unlocked building that the remaining cash can
   afford. Keep the construction crew working.
4. During a transfer window, open Scouting and Deals. Check reports, bids,
   contracts, expiring players, and dead weight.
5. Rebuild the best legal Starting XI. Match players to their natural roles.
6. If Green Bull is useful and affordable, book it before any drill.
7. Spend useful TP. Rotate through all relevant players and attributes.
8. Choose Quick Result or a watched match from the real risk of the fixture.
9. Read the full result and financial report.
10. Record findings and set the next week's training, transfer, and build goals.

The core rules are:

- Spend useful TP every week.
- Rotate through all relevant players and attributes.
- Enter Green Bull with a small TP bank.
- Upgrade every useful unlocked building.
- Keep only enough cash for known wages, renewals, and the next planned transfer.

Never hoard TP or cash without a named short-term purpose. Record that purpose
and the amount reserved. If the purpose disappears, spend the reserve that week.

## Optimization gates

Do not advance until these checks pass:

- **TP:** no useful affordable drill remains, unless condition or an imminent
  Green Bull booking gives a specific reason to wait.
- **Cash:** no useful affordable building, drill-tier upgrade, coach upgrade, or
  planned signing beats the known reserve needs.
- **Lineup:** every starter is the best legal role fit after condition, promises,
  licenses, injuries, and absences.
- **Transfer window:** Scouting and Deals were both checked.
- **Green Bull:** it was considered before the first drill in D3-D1.
- **Match plan:** formation, energy, powers, and Quick Result choice fit the
  opponent and sponsor goal.

If a gate is skipped, mark that season as imperfect optimization. Correct it at
the next safe chance. Do not use that season as clean balance evidence.

## TP and training strategy

TP exists to become player strength. A large bank is usually a play error.

Train the long-term Starting XI, useful rotation players, and high-value youth.
Do not spend on players marked for sale unless a short-term match need justifies
it.

Rotate drills across the attributes each player's role uses:

- GK: REF first when saves are weak, then PAC, PAS, and STA.
- DEF: DEF first, then STA and PAS. Add PAC when recovery speed is weak.
- MID: PAS and TEC first, then STA, DEF, PAC, or SHO for the player's job.
- FWD: SHO first, then PAC and TEC. Add PAS, STA, or DEF when the role needs it.

Do not train only the created forward. The full career showed that midfield,
defense, goalkeeping, and credible substitutes become the limits later.

Use these training rules:

- Spend useful TP each week instead of waiting for a future perfect drill.
- One drill per core player is a useful starting pattern, not a hard cap.
- Use the batch picker when condition and the schedule allow it.
- Use the displayed condition and injury preview. Do not reuse old fixed
  condition thresholds.
- Preserve condition for a close league match or Cup tie.
- Use empty weeks to train prospects and weak supporting attributes.
- Buy useful drill tiers when they unlock. Higher tiers are more TP-efficient.
- Respect Training Priority promises before spending on anyone else.
- Stop drilling a maxed or match-irrelevant attribute.

SUPER sessions are exciting variance. Record them, but do not treat a lucky
player's growth as the normal pace.

## Team Trip and Green Bull

### D5-D4 Team Trip

The Week 19 Team Trip consumes all current TP, gives broad squad growth, and
costs condition. It is optional when the choice screen allows refusal.

Normal weekly spending should leave a small TP bank before the trip. Do not
save TP for it. Accept it when the broad gain beats the remaining TP and the
next fixture can absorb the condition cost. Refuse it when that trade is poor.

Do not call the trip bad value because TP was hoarded before it.

### D3-D1 Green Bull

Green Bull is the intended later-career money sink. It gives every player +2 to
all stored stats, consumes current TP, costs 10 condition, and becomes more
expensive after each use.

Use it like this:

1. End the prior week with little unused TP.
2. Check Green Bull at the start of the new week.
3. Book it before any individual drill when its broad gain is efficient.
4. Keep enough cash only for known liabilities and the next planned transfer.
5. After Green Bull, resume normal weekly drills when the rules allow them.

Green Bull needs at least one full week of ambient TP at booking. Keep that
minimum unspent during the booking week. A Training Pitch or coach upgrade
raises the minimum immediately.

Do not carry hundreds or thousands of TP into Green Bull. Its all-current-TP
cost punishes hoarding and makes the test data misleading.

Compare repeated Green Bull use with facilities, drill tiers, contracts, and
transfers. Record the real choice. Do not assume that saving cash is optimal.

Motivational Speeches also spend all current TP and must be bought before a
drill. Buy one only for a planned watched match where its second-half boost can
change an important result. Quick Result cannot use it.

## Facility and money strategy

Cash exists to create growth, income, and wins. A rich club with idle
construction is not optimized.

Use this flexible order:

1. Complete required onboarding facilities.
2. Build the Training Pitch and Coaching Office TP engine.
3. Build two Stadium Stands and two adjacent Fan Shops before any miscellaneous
   skill facility.
4. Build enough Dorm recovery to support the training and rotation plan.
5. Build or upgrade the facility for the weakest important unit.
6. Upgrade the Scout Office before paying for high-value uncertain reports.
7. Upgrade the Youth Field when youth can still enter the long-term squad.
8. Upgrade every other useful unlocked building to its current maximum.

Build the third Stadium Stand and third Fan Shop later, when another income
upgrade beats the next training or recovery upgrade.

The order may change for an urgent renewal, a major Starting XI transfer, or a
clear condition problem. Record the reason. Do not use old fixed cash floors
such as `$10,000` after the real liabilities are known.

At every construction decision:

- inspect all unlocked upgrades, not only empty plots;
- check the Training Pitch and role-training facilities;
- check every Stadium Stand and Fan Shop level;
- keep the crew working when a useful project is affordable; and
- revisit Level 1 buildings after promotion unlocks higher levels.

Do not finish a season with large unused cash while useful upgrades remain.

## Coaches, drills, and facilities as one plan

Stack bonuses deliberately:

- hire the best affordable head coach and assistant;
- match coach specialties to the next training block;
- improve the matching facility;
- buy the matching drill tier; and
- train several relevant players while the stack is useful.

Replace weak coaches when the new weekly TP and training bonus repay the wage
and severance. A vacant staff slot is rarely optimal.

## Scouting, transfers, and squad management

Open Scouting and Deals during every transfer-window week. Dispatch early
enough for the report and contract to finish before the window closes.

Use mission types deliberately:

- Immediate Starter for the weakest current role.
- Young Prospect for a long-term core player.
- Specialist for a missing role attribute.
- Bargain when cash is the real limit.

Current playing strength should reach at most one division above the club.
Potential may reach at most two divisions above. Record a balance bug when a
scout breaks either limit.

Before signing:

- compare the player with the current starter in the same role;
- include the transfer fee, wage, promise, and Hero License need;
- confirm there is a legal roster slot;
- confirm the exact report is current; and
- prefer a major improvement over an expensive marginal one.

List dead weight early. Keep a backup goalkeeper and credible same-role cover.
Do not keep weak filler only because the game added it automatically.

Create all needed academy roster slots before signing the first youth. Signing
one youth may close the remaining offers.

Renew important players before leverage disappears. Later hero renewals are
real costs, but a rich club should not carry a huge reserve without a specific
contract due.

## Hero Licenses

Buy useful permits when they unlock and are affordable. License the heroes that
most improve the real Starting XI.

Licensing and lineup selection are separate decisions:

- licensing a benched hero must not force them into the XI;
- unlicensing a starter may safely repair the XI;
- restoring a license must work when capacity is free; and
- a Starter promise must name and preview the exact license handoff.

Do not accept a Starter promise without a valid permit plan. Awakening after the
first story hero should not silently consume the remaining permit.

Record the active licensed set before and after every handoff. A license bug can
invalidate later match and balance evidence.

## Lineup and tactics

Use the strongest legal natural-role XI. The game has repeatedly kept players
in old slots after a formation change. Audit every slot after changing shape or
starting a new season.

Useful defaults, not rigid rules:

- `4-4-2 Balanced` is a stable Quick Result baseline.
- Use `5-3-2 Deep Counter` against a much stronger club.
- Use `3-4-3 Attack` when a weaker opponent can be pressured safely.
- Change shape and playstyle when the score makes the original plan wrong.

Do not start ordinary matches on All Out. Use Balanced or Save Energy first.
Save All Out for a late need.

Keep an energy mode selected until the manager changes it. Record a bug if a
goal, power, halftime, or substitution resets it.

In MANUAL power mode, press only a visible `FIRE` control. `ARMED` is status,
not an allowed press. Quick Result always uses automatic powers.

## Quick Result or watched match

Quick Result uses the same match engine and saves time. Use it when the club has
a clear advantage and no live tactical decision is likely to matter.

Watch when:

- the opponent is close or stronger;
- promotion, D1, or the Cup depends on the result;
- a sponsor target needs a specific tactic;
- condition and substitutions matter;
- a Motivational Speech is planned; or
- player-visible match behavior needs testing.

Use `3x` speed when it preserves the evidence. Skip repeated presentations when
the game allows it.

## Division lessons

### D5

The early facility economy can create useful risk. TP must still be spent each
week. A single scout far above the division can erase all competition, so check
the one-division current-strength limit.

### D4

Open formations became less reliable, which was a good difficulty step.
Defensive ratings did not always produce defensive results. Compare sponsor
goals with actual clean-sheet and scoring rates before judging them fair.

### D3

Green Bull, higher drill tiers, better staff, and home income form the main
growth loop. Use all of them. Measure whether the transfer market still matters
after broad Green Bull growth.

### D2

Money requests, renewals, facilities, permits, and Green Bull should compete for
cash. Test the real trade instead of carrying a safety fortune. Watch Cup draws
for extreme opponents and growth spikes.

### D1

The clean objective is both the D1 title and the Hero Cup. Optimize facilities,
TP, Green Bull, staff, permits, contracts, and lineup before recommending weaker
opponents or lower wages.

The previous long D1 run hoarded TP and cash. Its bugs and copy findings remain
valid. Its career-speed, salary-pressure, and rival-strength conclusions are
not clean optimal-play balance evidence.

The current D1 growth rule is:

- a D1 club with no league losses gets no offseason D1 growth;
- after at least one league loss, Chairman growth is 3%; and
- after at least one league loss, Cozy growth is 1%.

Focused transition tests cover perfect and one-loss seasons on both
difficulties. Recheck it in a live D1 rollover. Do not infer it from points or
draws.

## Known regression checks

Recheck these paths during normal play. Do not force extra seasons only to reach
them.

- Drill and Quick Result atlases now free their temporary CanvasKit surfaces,
  snapshots, and paints. Recheck a long web session for `Aborted()` errors. If
  one still occurs, the error must not claim the save is unchanged unless the
  action truly rolled back. Check the persisted state before retrying.
- Save Energy and other energy modes must survive goals, halftime, powers, and
  substitutions.
- A formation change and season reset must select strong players in valid roles.
- Season rollover must explain every added youth or filler player.
- Scouting must submit the visible filter, price, and travel time. A detailed
  report must reveal the promised detail.
- Signing a scouted player must clear stale `came back short` copy.
- A high transfer bid must either complete or explain the real blocker.
- A Pitch Card is optional only when the offer can submit without selecting one.
- Contract promise choices must use clear radio groups and show their effect.
- Hero License capacity, handoffs, protected promises, and awakening must follow
  the rules in the Hero Licenses section.
- D4 sponsor goals must fit results that are realistically possible in D4.
- D2 and D1 opponent, sponsor, and hero information must agree across screens.
- From D2 onward, verify that money-based player requests use the intended
  three-times cost and that Cup draws do not use opponents below D3.
- The final penalty presentation must be skippable.
- D1 must not say clubs earn promotion. A dominant perfect-season club must be
  recognized in the season review.

## What to record

Keep the running record in:

`docs/superpowers/reports/2026-08-13-optimal-career-playtest.md`

Record each finding as one of:

- observed and open;
- recommendation only;
- implemented locally;
- verified fixed; or
- intentionally unchanged.

For every bug, include the exact screen, action, expected result, actual result,
and whether the save advanced. Never trust an error message that says the save
did not change. Recheck season, week, cash, TP, training, scouting, and match
results before retrying an action.

Record full checkpoints in Weeks 1, 4, 19, and 30:

- league place and record;
- Cup round;
- cash, TP, fans, and weekly wages;
- full-squad and Starting XI strength;
- facilities, levels, and construction;
- coaches and drill tiers;
- squad size, roles, condition, heroes, and permits;
- transfers, contracts, requests, and sponsor progress; and
- TP and cash reserved, with the exact reason.

## Season and division reports

At every season end, report:

- league record, goals, place, and Cup result;
- ending cash, TP, wages, fans, and squad size;
- all facility, staff, and drill upgrades;
- Green Bull and Team Trip use;
- training distribution and strongest players;
- transfers, sales, contracts, permits, and sponsor result;
- what was fun, boring, fair, or unfair;
- bugs and balance findings; and
- whether every optimization gate was followed.

When leaving a division, also report:

- seasons spent there;
- squad and economy on arrival and departure;
- the strategy that worked;
- the strategy that stopped working;
- difficulty for an optimal and likely casual player;
- whether promotion pace felt fair; and
- the division-specific changes worth making.

Separate observed evidence from recommendations.

## Playtest validity and stop rules

- Keep the browser silent and visible when Joe wants to watch.
- Do not invent results that the browser cannot prove.
- Do not call one lucky SUPER session or one strange score a balance trend.
- Log a bug before fixing it. Implement only when Joe asks.
- Preserve the same save after a compatible fix.
- Verify player-visible behavior before marking a bug fixed.
- Stop if a crash, save mutation, license blocker, or total imbalance makes later
  evidence unreliable.
- If a safe fix ships, reload the same save, confirm its state, and continue.
- Continue until both D1 and the Hero Cup are won, or Joe stops the test.

Language problems are part of the playtest. Record untranslated text, wrong
football terms, broken number agreement, clipped copy, and inconsistent labels.
Keep all seven locale catalogs aligned when Joe asks for a copy fix.
