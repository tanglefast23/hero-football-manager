# Division Leaders — design

**Date:** 2026-08-01
**Status:** approved design, ready for planning
**Scope:** Cycle 1 of 2

A live leaderboard for the ten clubs in your current division, with one award per
position line. Cycle 2 adds the end-of-season awards ceremony and its Training
Point prizes; this document covers only what has to exist before that can be
built.

---

## 1. Why this shape

The player watches matches but has no sense of where their squad sits among the
other nine clubs beyond the league table. The table ranks clubs. Nothing ranks
players, so a striker on eleven goals is indistinguishable from one on three.

Four categories, one per position line, so every player type in the squad has
something to chase:

| Board | Metric | Eligible role |
| --- | --- | --- |
| Strikers | Goals | `FWD` |
| Midfielders | Assists | `MID` |
| Defenders | Tackles won | `DEF` |
| Keepers | Saves | `GK` |

Only two of these are real-world headline awards. The set is chosen for the
one-per-position property, not for realism, and the boards are named by position
so the filter is honest: the striker board is the leading *forward*, not the
leading scorer outright.

**Accepted consequence.** A midfielder who tops the division for goals wins
nothing. This is deliberate — an unfiltered goals board would be won by forwards
in almost every season, which would leave the midfield category as the only one
whose winner was ever in doubt.

---

## 2. Coverage

The board covers **the ten clubs in the user's current division**, league
fixtures only.

Rival rosters exist only for the active division. `generatedActiveDivision`
(`src/game/full-career.ts`) builds persisted players for those ten clubs, and a
division change rebuilds `state.players` as `[user players, ...new rivals]` —
the previous division's players cease to exist. There is therefore no such thing
as a cross-division or all-time rival stat that resolves to a name, and the
design does not pretend otherwise.

Cup fixtures are recorded but excluded from the board. A division leaderboard
that counted goals scored against clubs from other divisions would not be a
division leaderboard.

---

## 3. Engine — assists become real

Nothing in the sim emits an assist today. Measurement (appendix A) established
that assists cannot be honestly reconstructed after the fact: requiring the pass
and the goal to belong to the same passage of play yields 0.15–0.37 per match,
roughly three to seven per club per season. The only reconstruction that
produces leaderboard-sized numbers credits passes that the opposition
interrupted, sometimes more than a minute of match time earlier.

So the engine tracks it directly.

**Mechanism.** `MatchState` holds a pending assist: the stable player id of the
last teammate to hold the ball before the current holder. On `GOAL`, the event
carries `assistedById?: string`.

**Rules.**

- The pending assist clears when the **opposition gains possession** — a won
  tackle, a keeper catch. An opponent event that does not change possession (a
  failed tackle, an opposition shot that misses while the ball stays with the
  attacking side) does not clear it. Clearing too eagerly rebuilds the
  starvation problem inside the engine.
- The credited player resolves through the existing base-player helper
  (`decoyCloneAt(state, index)?.sourceIdx ?? index`, `src/sim/entities.ts:56`),
  so a decoy clone's touch credits the hero it came from. This follows the
  convention `SHOT` already uses to separate the credited player (`by`) from the
  entity that physically acted (`actor`).
- A player cannot assist their own goal.

**Why a stable id rather than a slot index.** Every other match event addresses
players by slot, and consumers rewind substitutions to resolve ownership at the
right moment. That works when the event and the credited action are
simultaneous. An assist is not: measurement shows the crediting touch is
routinely 25+ ticks before the goal, so a substitution can land in between, and
a slot resolved at goal time would credit whoever replaced the real assister.
Emitting `def.id` removes the whole class of bug.

**Version.** No RNG is consumed and no behaviour changes, so replays stay
deterministic — but the event stream changes and the golden replay snapshot
moves. `ENGINE_VERSION` goes **`m2.0` → `m2.1`** (`src/sim/match.ts:26`). The
snapshot is updated as a consequence of that decision, never ahead of it.

---

## 4. Engine → career — one fold for four stats

`goalsFrom(match)` (`src/game/matchday.ts:127`) generalises to
`contributionsFrom(match)`, returning per player: goals, assists, tackles won,
saves.

It keeps the existing substitution rewind. That logic is subtle and already
correct: reading slot owners from the starting lineup credits a substitute's
goal to the player he replaced, and reading from the final state makes the
mirrored mistake. Rewinding `SUBSTITUTION` events backwards from the final state
is the only correct answer, and it now applies to all four metrics rather than
just goals.

**Tackles** count `style: 'standing' | 'slide'` only. `style: 'power'` is
excluded — measurement shows power tackles reach 1.90 per match in D1 (6% of all
won tackles), enough to decide a close race, and the defender award should be
about defending rather than about which power a defender happens to hold.

**Saves** come from `SAVE` events, whose `by` is the keeper's slot
(`src/sim/engine.ts:1709`).

`FixtureResult` gains `contributions`. The existing `scorerPlayerIds` stays:
career validation checks it against the scoreline
(`src/game/career.ts:1174`), and that invariant is worth more than removing a
little redundancy. A test asserts the two can never disagree about who scored.

---

## 5. Persistence

`PlayerSeasonGoalTally` widens:

```ts
interface PlayerSeasonStatLine {
  season: number;
  playerId: string;
  clubId: string;
  competition: 'league' | 'cup';
  goals: number;
  assists: number;
  tacklesWon: number;
  saves: number;
}
```

Keyed by `season:playerId:clubId:competition`.

**`clubId` is stamped at record time, not resolved at read time.** Players
transfer mid-season. Without it, a player sold in January has his first-half
goals silently re-attributed to his new club, and any historical row for a
player who has since left `state.players` becomes unattributable.

The board reads `competition: 'league'`. The season recap's existing Golden Boot
sums both competitions, so nothing that works today changes.

**This breaks old saves.** Acceptable under the standing decision that breaking
saves is fine until TestFlight.

---

## 6. Season end — snapshot, then prune

Two things happen at the season transition, in this order.

**Snapshot.** The **top three** of each of the four categories are denormalised
into `SeasonRecap`. This is the bridge to Cycle 2: the awards ceremony and any
future records hall read these snapshots, not raw stat rows.

Three rather than one because the ceremony reveals third and second before the
winner, and by the time it runs the rival rows behind those placings may have
been pruned. Widening the snapshot here is far cheaper than making the ceremony
read rows that are no longer guaranteed to exist.

```ts
interface DivisionAwardPlacement {
  playerId: string;
  playerName: string;
  clubId: string;
  value: number;
}
```

**Not `SeasonRecapAward`.** That shape is `{playerId, playerName, label,
detail}` — no club and no number, with the figure surviving only inside a
display string like `"12 saves"`. The ceremony has to render a club beside every
placing, and a records hall has to compare values numerically to answer "is this
a new record". Reusing the existing shape would mean parsing prose to get a
number back.

`clubId` rather than a club name because names are already durable: `m2.pyramid`
persists all fifty clubs with their names (`src/game/pyramid.ts:28`) and only
`squad` is regenerated on a division change. So the id resolves to a name
forever, and the snapshot stays narrow.

**Podium ties at the cut line.** The board's shared-rank rule answers what a tie
looks like; it does not answer what happens when four players tie for third. The
podium caps at three entries, ordered by player id. A ceremony that reveals a
fourth "third place" would be worse than an arbitrary but stable cut.

**Prune.** Stat rows are dropped when their `playerId` appears in neither
`state.players` nor `state.retiredPlayers`.

Retired players must be spared explicitly. They leave `state.players` at the
season transition, so a rule keyed on that array alone would delete the career
record of the user's own retired heroes — the players the club legacy screen
exists to remember.

The order matters and the reasoning is worth recording, because both halves in
isolation are wrong:

- Pruning alone loses history Cycle 2 needs, irrecoverably — once a division
  changes, the deleted rivals cannot be regenerated.
- Retaining raw rows alone does not preserve history either. A kept row for a
  vanished rival has an unresolvable name, so a records hall built on raw rows
  renders `p_10423 · 22 goals`. Names only survive if they are captured while
  the player still exists.

Snapshot-then-prune keeps what is actually needed and discards what cannot be
rendered. It also fixes a latent issue: today's tallies are never pruned and
accumulate orphan rows every season.

---

## 7. League tab — three progressive tabs

| Tab | Appears when | Derived from |
| --- | --- | --- |
| LEAGUE | always | — |
| CUP | the first cup exists | `m2.nationalCups.length > 0` |
| LEADERS | three weeks after the first cup match | earliest cup fixture week + 3 |

Both unlocks are **derived, never persisted**. No new save state, and no way for
a stored flag to drift out of sync with the thing it describes.

The cup currently renders as a section inside the League screen; it moves into
its own tab. The tab strip stays hidden while only one tab is available, so
nothing changes visually before the cup arrives around week 10.

`M2LeagueViewModel` gains a `leaders` view model: four boards, top five each,
with position, player name, club name, value, and an `isUserPlayer` flag.
Players on equal values share a displayed rank (two players on 11 goals are both
2nd, and the next player is 4th). Their order within the tie is by player id, so
the board is deterministic rather than dependent on roster iteration order.

**Mid-season transfers.** Stat rows are keyed per club, so a player who moves
between two clubs in the same division has two rows for that season. The board
sums his rows and displays his current club. Without this he appears twice, each
time with a partial total, and neither entry is his real tally.

The five-tab bottom bar is untouched. These are sub-tabs within the League
screen, so the number-key bindings and the desktop width clamp are unaffected.

### The existing cup guide beat moves with it

The `national-cup` beat is built on today's single-page layout: it sets
`destination: "league-cup"` and `focus: "national-cup"`, and `M2LeagueScreen`
responds by *scrolling* to the cup section (`guideNationalCup`,
`src/ui/screens/M2LeagueScreen.tsx:46`). Once the cup is a tab, "show me the
bracket" must **switch tabs**, not scroll — and the `TutorialTapCue` anchoring
moves with it.

Migrating that beat is part of this cycle's League work, not a follow-up. A test
asserts the guide destination lands on the CUP tab. Leaving it out would ship a
restructure that silently breaks a working onboarding step.

---

## 8. Bert

A `division-leaders` entry in `content/assistant-guide.json`, mirroring the
`national-cup` beat at line 359, with `destination: "league-leaders"`.

Content, not code — new game content ships as data.

---

## 9. Testing

- **Assist attribution** over hand-built event logs: substituted assister,
  substituted scorer, rebound, turnover, decoy-clone touch, power goal,
  own-goal-adjacent cases.
- **Determinism**: same seed produces byte-identical stat lines.
- **Golden replay**: snapshot updated once, as a consequence of the
  `m2.0 → m2.1` decision.
- **Cross-check**: `contributions` goals reconcile with `scorerPlayerIds`.
- **Codec**: round-trip on the new save shape.
- **View model**: ranking, ties, role filtering, and a division where a board
  has no qualifying players.
- **Assist yield rail, in CI.** A test that sims ~20 real matches and asserts
  assists land in the expected band (~2.0–2.8 per match), so a later balance
  change cannot silently starve the midfielder board.

  It cannot live in `MINI_BALANCE_RAILS`. That harness never runs the sim —
  `scoreFixture` (`src/game/balance.ts:242`) fabricates scorelines from a
  `mulberry32` goal roll, so it produces no events and has no assists to
  measure. It also cannot be the probe: the probe is opt-in
  (`STAT_YIELD_PROBE=1`, excluded from the normal suite), and a guard that only
  runs when someone remembers to run it is precisely what "silently" means.
  Measured cost is roughly 0.17s per match, so twenty seeds is a few seconds.

- **Probe**: kept as a permanent opt-in measurement for diagnosis when the rail
  does trip.

---

## 10. Out of scope (Cycle 2)

The end-of-season awards ceremony is designed separately in
[2026-08-01-division-awards-ceremony-design.md](2026-08-01-division-awards-ceremony-design.md).

Cycle 1 owes it exactly one thing: the top-three snapshot described in section 6.
Everything else in the ceremony — reveal order, walk-ons, quote pools, the
Training Point prize and its count-up — is self-contained and needs no further
support from this cycle.

---

## Appendix A — measurement

`src/audit/__tests__/stat-yield-probe.test.ts`, production-generated squads.
The file defaults to 90 matches per division; these figures were taken at 60:

```bash
STAT_YIELD_PROBE=1 STAT_YIELD_MATCHES=60 npm run test:probe -- src/audit/__tests__/stat-yield-probe.test.ts
```

Per match, both teams:

| Division | Goals | Assists (same move) | Assists (last pass) | Tackles won | Power tackles | Saves |
| --- | --- | --- | --- | --- | --- | --- |
| D5 | 2.10 | 0.15 | 2.05 | 21.30 | 0.00 | 4.68 |
| D3 | 3.88 | 0.37 | 2.47 | 27.63 | 0.00 | 5.88 |
| D1 | 4.70 | 0.25 | 2.80 | 30.43 | 1.90 | 6.53 |

Recency of the crediting pass under the loose rule: **0%** of credited passes
landed within 10 ticks of the goal; in D1 and D3 only 49% landed within 25 ticks
(one tick is roughly 2.7 seconds of match time). This is what established that
post-hoc assist reconstruction credits passes unrelated to the goal, and why the
engine tracks assists directly instead.

Per club over an 18-match season these volumes give a Golden Boot around 8–12
goals in D5, a first-choice keeper around 42–59 saves, and 190–275 tackles won
spread across a back line — enough spread for every board to rank meaningfully.

---

## Appendix B — decisions and their reasons

| Decision | Reason |
| --- | --- |
| Four categories, one per position | Every player type has something to chase |
| Boards named by position | The role filter makes "top scorer" untrue otherwise |
| Saves, not clean sheets | Clean sheets collapse the GK and DEF awards into one, and always go to the best team's keeper |
| Tackles exclude `style: 'power'` | 6% of D1 won tackles; enough to decide a race on power ownership |
| Assists tracked in-engine | Post-hoc reconstruction measured at 0.15–0.37/match, or dishonest |
| Stable id, not slot, for assists | The crediting touch precedes the goal by 25+ ticks; a substitution can land in between |
| League only on the board | Cup goals cross divisions |
| Cup still recorded | Preserves today's season-recap Golden Boot behaviour |
| Derived tab unlocks | No new save state, no drift |
| Snapshot before prune | Neither pruning nor retention preserves history alone |
