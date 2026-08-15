# Targeted Scouting, Harder Transfers, and Lasting Stories

## Goal

Make scouting produce useful decisions without guaranteeing upgrades. Make stories affect football choices for several weeks instead of paying forgettable one-number rewards.

## Existing behavior to preserve

- Scouting and all career rolls stay deterministic from the saved career seed.
- Scout reports already show attribute and potential ranges based on the Scout Office.
- Contract talks already create trade-offs through fees, wages, promises, and competing facility or Green Bull spending.
- Player requests already stay in the Inbox until resolved.
- The same player cannot receive the same request twice in one season.
- Story target selection already shares one eligibility path for display, validation, and automatic selection.
- Rare and legendary stories currently resolve once per career.

The last four rules need regression guards. They do not need new parallel systems.

## 1. Targeted scouting

### Mission setup

Replace prebuilt scouting cards with three small selectors:

1. Region: Local, Europe, South America, Africa, or Asia.
2. Position: Any, Goalkeeper, Defender, Midfielder, or Forward.
3. Prospect type: Immediate Starter, Young Prospect, Specialist, Bargain, Rumored Hero, or Elite Prospect.

Rumored Hero keeps its existing D3 unlock and special-hero discovery path. Elite Prospect keeps its existing D2 unlock. Their promotion reward copy, prices, and deterministic shortlist rules remain active.

The mission button shows its exact price, duration, and expected report count before purchase.

### Price and time

- Region keeps the current base price.
- Every prospect type adds $1,000.
- Selecting a position adds $750 and one week.
- Any position adds no extra time or money.
- The current deterministic base duration remains two or three weeks.
- The existing first unaffordable scouting mission can still use the scout's one-time free favor.

No new currency or facility is added.

### Candidate ranking

The mission searches the existing generated player pool. It does not create a player for the request and does not guarantee an upgrade.

- Immediate Starter ranks players by improvement over the manager's current best player in the same position.
- Young Prospect ranks players aged 21 or younger by division-relative potential, then current ability.
- Specialist ranks players by their best position-relevant attribute compared with their other useful attributes.
- Bargain ranks players by current ability and potential per transfer-dollar.

The chosen position filters first. Prospect type then ranks the eligible pool. The mission seed shuffles a top candidate band before building the shortlist. This preserves uncertainty while making the selected type matter.

Remove the current 35% forced-upgrade injection. Better players must exist in the possible pool, but a mission can miss them.

### Save compatibility

Extend `ScoutFocus` with `{ kind: 'PROFILE'; prospectType; role? }`. New missions always store this legal focus. Add the same union member to the save codec. Existing saved `POSITION`, `AGE`, `ELITE_PROSPECT`, and `RUMORED_HERO` missions keep their current matcher and load unchanged. Rumored Hero and Elite Prospect selections may keep their existing focus kinds so their authored rules stay untouched.

Both filters are included in the deterministic mission seed.

## 2. Report lifecycle and potential uncertainty

### Expiry and dismissal

- Reports from weeks 1 to 4 expire when week 5 starts.
- Reports from weeks 5 to 18 expire when week 19 starts.
- Reports from weeks 19 to 30 expire when the season ends.
- The Scouting desk has a clear `Dismiss report` button.
- A report with active transfer talks cannot be dismissed until those talks end.
- Reports never block another mission.

Reports store the season and week completed. Old reports without this data expire on the first safe reconciliation after loading.

A completed mission appends its reports instead of replacing the previous batch. Every report stores its own completed season and week. A newer report for the same player replaces that player's older report. Scout and Deals adapters read the stored completion stamp instead of inventing the current week.

### One uncertainty source

The Scout report and Deals page read the same saved `ScoutReport` range.

- Owned players can still show known potential.
- A buy listing must never reveal more than its matching Scout report.
- No other Deals adapter may reconstruct exact potential for a target.

### Detailed report

- Scout Office Level 3 reveals exact potential in normal reports.
- At Levels 0 and 1, a paid detailed report takes two weeks.
- At Level 2, it takes one week.
- The fee is D5 $2,500, D4 $4,000, D3 $6,000, D2 $8,000, and D1 $10,000.
- Only one detailed report can run at a time.
- It must finish before the report expires. The UI disables an impossible purchase.
- Completion replaces that player's potential range with the exact value already known to the simulation.

This reuses the existing report record. It does not add a second scouting desk or a second player pool.

## 3. Transfer choices and selling

- Keep current player valuation, contract talks, wage demands, and promise rules. Do not add cash-relative prices or force an artificial sacrifice.
- Targeted reports make top players easier to seek, while their existing fee, wage, promise, facility, and Green Bull trade-offs provide the sacrifice.
- Listing a player in week 18 resolves bids immediately so the last transfer week works.
- A player with an active transfer request attracts one extra deterministic bidder. The request does not inflate the player's value.
- Older or weak players keep their current age-adjusted modest valuation.
- Focused tests cap the total proceeds from selling six weak older players so they can fund cleanup, not an elite rebuild.

## 4. Story cleanup

### Remove trivial outcomes

The following stories must no longer resolve with only cash, fans, TP, morale, or flags:

- `hero-commercial`
- `player-slump`
- `two-player-feud`
- `hero-school-visit`
- `milestone-unbeaten-run`
- `milestone-first-cup-win`
- `milestone-crowd-thousand`
- `rival-scout-duel`
- `leaking-stand-roof`
- `west-stand-reopening`
- `terrace-choir-forms`
- `terrace-choir-anthem`

Keep their IDs when milestones or follow-up flags already refer to them. Rewrite each choice so its main consequence changes a football or club-management decision for two to six weeks. Small cash, fan, or morale changes may support the lasting consequence, but may not be the whole outcome.

### Timed consequence coverage

The event catalog must contain at least one real consequence at every exact length:

- 2 weeks: a player rest, absence, or personal training modifier.
- 3 weeks: a player slump, injury risk, or squad training modifier.
- 4 weeks: the existing Youngster's Trial Abroad absence and return growth.
- 5 weeks: a temporary player or squad training bonus or penalty.
- 6 weeks: a temporary facility closure or facility performance penalty.

Add only two reusable effect types:

- `trainingModifier`: player or squad, percentage, and weeks remaining. Apply it through the existing player-request drill multiplier path.
- `facilityClosure`: chosen facility and weeks remaining. A closed facility gives no benefit, clearly shows its remaining closure time, and counts down during weekly settlement.

Timed request and story training effects survive the season transition and keep counting down. Facility closures are legal for any completed facility selected by the shared eligibility path. An active scouting mission uses the Scout Office level snapshotted when it began, so a later closure cannot change its result size.

Use existing `absence`, `injury`, permanent stat trade, and facility income effects where they already fit.

The Four Without Losing risky failure must apply a real three-week downside. It must not award TP.

## 5. Eligibility and repetition guards

- If copy identifies the youngest, quickest, or most famous player, the automatic target rule must match.
- A story requiring an under-21 player cannot appear without a player aged 20 or younger.
- Every manager-selectable target must pass the same role, age, hero, coach, or facility rule used during resolution.
- Ties stay deterministic from the career seed.
- The same player and request pair stays limited to once per season.
- A rare or legendary story cannot set `repeatable: true` in validated content.
- The same rare or legendary story stays limited to once per career.
- Opening Requests does not resolve or clear the request. The Inbox count stays until a choice is made.

## 6. Scaled story money

Use one shared helper for direct story cash previews and application.

- Positive fixed rewards scale from the existing sponsor anchor for the current division.
- Negative fixed penalties scale from the same anchor.
- Preserve the authored sign and relative size.
- Division floors keep a story meaningful: D5 $500, D4 $1,000, D3 $2,000, D2 $3,500, D1 $5,000.
- Division caps prevent a fixed story from becoming a hidden financial disaster: D5 $5,000, D4 $8,000, D3 $12,000, D2 $18,000, D1 $25,000.
- Major risk effects may use up to 10% of current positive cash. Existing percentage effects remain percentage effects.
- A club with no cash never loses money it does not have.
- Transfer fees, wages, facility income percentages, and real player sales stay in their own systems.

Persist the resolved cash delta with the pending outcome. Reloading cannot reroll or recalculate it after club cash changes.

## 7. Delayed callbacks

Add one persisted callback queue for short, non-branching follow-ups.

Each callback stores its stable ID, due season and week, source event, speaker type, optional player or coach ID, English fallback line, and localized line key. A missing player or coach safely drops that callback.

Required callbacks:

- The youngster returns from the four-week trial and comments on the improvement.
- The veteran thanks the manager after the two-week rest.
- A player denied leave returns after two weeks with one deterministic positive or unhappy line.
- Bert comments after the club begins rebuilding from the facility fire.

Player and coach callbacks reuse `CharacterSpeechOverlay` with the existing running player or management sprite. Bert reuses the existing Bert briefing walk-on. The callback has no choices and no extra reward. Dismissal removes only that callback and saves immediately.

## 8. Localization and copy

- Add every new label, status, error, and callback to all seven supported catalogs.
- Translate every rewritten or added event title, body, choice, headline, and outcome in all six non-English event locale files. The event localization gate stays at 100%.
- Use neutral player wording where grammar would otherwise require a guessed gender.
- Keep labels short enough for the existing mobile Scouting and Deals cards.
- Run the localization parity and format checks.

## 9. Acceptance checks

### Scouting

- Each region, position, and prospect type changes the mission seed and result order deterministically.
- New filters affect price and time exactly once.
- No mission guarantees a better player.
- Every division's generated pool can contain each prospect type.
- Existing Rumored Hero and Elite Prospect promotion rewards and discovery paths still work.
- Window and season boundaries expire the correct reports.
- Two missions' reports coexist and expire independently; a repeat player keeps only the newer report.
- Dismiss removes only the selected report and cannot corrupt active talks.
- Deals and Scout report potential labels match before and after a detailed report.
- Old and new saved missions and reports pass an encode/load round trip.

### Transfers

- Week 18 listings can receive and accept bids.
- Transfer-requested players receive one extra bidder, not a higher quote.
- Six weak older sales cannot fund an elite rebuild.
- Existing negotiation promises and wage demands still apply.

### Stories and requests

- No listed trivial story has a one-number-only outcome.
- The catalog proves exact 2, 3, 4, 5, and 6-week consequences.
- Closed facilities stop providing benefits and reopen on the correct week.
- Timed training effects apply once per drill and expire on the correct week.
- A timed effect started in week 28 survives rollover and expires on its authored week.
- Eligibility, deterministic tie, one-request-per-season, Inbox persistence, and once-per-career rules have regression tests.
- Every required callback appears once, survives save/load, and uses the correct visible speaker.
- Story cash preview, result animation, saved cash, and financial history show the same resolved number.

## 10. Verification

Run focused Jest suites for market, market career, source adapters, persistence, event selection, event flow, facilities, player requests, view models, and the new callback UI. Run localization checks and `npx tsc --noEmit`.

Do not run balance or soak rails during this implementation. The full career playtest remains the requested balance check.
