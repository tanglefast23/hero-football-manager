# Spec — the fifteen special heroes as named rivals

Date: 2026-08-08
Status: revision 5, after four review rounds
Builds on: `2026-08-08-superhero-homage-looks-spec.md` (the art, already merged)

## 1. The decision

The fifteen superhero looks currently join the general career pool and appear under
randomly generated names. They become **named characters** instead.

Owner's rules, confirmed:

1. The **strongest rival club in the active division** fields a fixed number of specials:
   D5 → 1, D4 → 1, D3 → 2, D2 → 3, D1 → 4. Eleven placed.
2. The specials are that club's **top-rated players**, and must be *clearly* ahead of the
   rest of the squad — not marginally — and strong in the stats their role actually uses.
3. The remaining **four are obtainable only through the top scouting report**.
4. Specials are **additive**: today's generic hero ramp is untouched.
5. Specials belong to the **division**, not to a club. Whichever club is strongest in D3
   this season fields D3's two.
6. **Never the user's club.** The strongest *rival* hosts them.
7. Each special is inserted as a **real character** — fixed name, role, power and face —
   rather than a power bolted onto an existing player.

## 2. The roster

Role is forced by the power (`ROLE_POOL` in `power-catalog.ts`); no shipped power is
goalkeeper-compatible, so no special is ever a keeper.

### Placed on the strongest rival (11)

| Div | Order | Hero | Look | Role | Power |
| --- | --- | --- | --- | --- | --- |
| D5 | 1 | Barry Allan | f171 | FWD | SUPER_SPEED |
| D4 | 1 | Scott Somers | f178 | FWD | THUNDER_STRIKE |
| D3 | 1 | Steve Rodgers | f174 | DEF | RALLY_CRY |
| D3 | 2 | James Howlitt | f177 | MID | PHASE_RUN |
| D2 | 1 | Bruno Bannor | f176 | DEF | SUPER_STRENGTH |
| D2 | 2 | Pete Parkin | f172 | MID | WEB_TRAP |
| D2 | 3 | Toni Starke | f173 | FWD | BLINK_RUN |
| D1 | 1 | Bruce Wain | f168 | DEF | SHADOW_MARK |
| D1 | 2 | Dinah Prince | f170 | MID | GRAVITY_WELL |
| D1 | 3 | Clark Kentley | f169 | FWD | FIRE_TORCH |
| D1 | 4 | Don Blaker | f175 | FWD | THUNDER_STRIKE |

"Order" is the strength rank inside the club: order 1 is the best player on the pitch.

### Scout-only (4)

| Hero | Look | Role | Power |
| --- | --- | --- | --- |
| Stefan Strangeway | f179 | MID | PORTAL_PASS |
| Tchalo Adaku | f180 | DEF | SHADOW_MARK |
| Arthur Currey | f181 | MID | ICE_RINK |
| Oliver Quinn | f182 | DEF | FUTURE_SIGHT |

These four never spawn on a club. `RUMORED_HERO` scouting is already gated to division 3
and above (`market.ts:150`), so they are unreachable until the user is deep in the climb —
which is the intended pacing, not a coincidence to be relied on silently.

Two powers repeat across the fifteen (THUNDER_STRIKE on Somers and Blaker, SHADOW_MARK on
Wain and Adaku). Accepted by the owner: the pairs sit far apart in the career and on
different acquisition routes.

## 3. Where this hooks in

The user only ever plays one division. Other tiers exist as `state.m2.pyramid` data and are
never rendered as opponents, so **only the active division's specials are materialised**.
Promotion is what makes the next set appear.

One shared pure function does the work at both season starts:

```
overlayDivisionSpecials({ clubs, players, lineups, division, userClubId })
  -> { clubs, players, lineups }
```

Call sites:

- **Season 1** — the end of `balanceOpeningDivision` (`full-career.ts:355`), *after* the
  42–50 strength ladder, the fixture pin and `strengthenFirstOpponent` have all run.
  `createLaunchCareerSetup` builds the launch squads from `content/clubs.json`, but
  `balanceOpeningDivision` is what finalises them, so it is the correct and only S1 hook.
  (An earlier draft named `launch.ts:419`. That is `reconcileCareerPlayerLooks`, the
  load-time look repair — not a materialisation site. Corrected.)
- **Season 2+** — in the season transition (`full-career.ts:181`), after
  `generatedActiveDivision` **and after the user's squad is joined to it**, i.e. over
  `[...activeUserPlayers, ...generated.players]` and the matching clubs and lineups, still
  before `assignDistinctPlayerLooks`. Running it on the generated opponents alone would
  hide the user's roster from §3.2, so a signed Barry Allan would quietly respawn on the
  new host.

Running last in season 1 is deliberate: the opening ladder, the pin and the +5 buff are the
most carefully tuned numbers in the game, and none of them should see a special. The
special is added on top of a finished division, which is what makes "additive" literally
true.

### 3.1 The third pipeline, and the strip rule

There is an implicit third path that a naive implementation breaks.
`synchronizeM2ActiveDivision` writes live `state.players` — specials included — back into
`m2.pyramid` for the active tier, and `planEndlessCareerSeasonTransition` reads those
pyramid squads back out as `generatedOpponentClubs`. Left alone, that causes three bugs:

1. Season 2's host ranking would count last season's specials, so the host becomes
   self-reinforcing — exactly what §4 sets out to avoid.
2. The same `special-*` id would arrive as an ordinary pyramid player *and* be re-added by
   the overlay, and `assignDistinctPlayerLooks` throws on a duplicate player id.
3. A relegated host would drag a D1 character down to D4, and inactive tiers would
   accumulate stale specials forever.

**Rule:** the overlay's first action is to **strip every `special-*` player that is not on
the user's club** from the incoming clubs, players and lineups. Specials are rebuilt from
scratch for the division being entered. A special the user has *signed* lives on the user's
club and is never stripped.

### 3.2 A signed special never re-spawns

Placed specials are ordinary transfer targets while their host is the active opponent, so
the user can buy Barry Allan. If placement then ran blindly, next season would rebuild
`special-f171` on the new host while the same id sits in the user's squad, and
`assignDistinctPlayerLooks` throws on a duplicate player id.

**Rule:** placement skips any `special-*` already present **on the user's club**. The host
simply fields one fewer — there is no substitute, and no other hero is promoted into the
empty slot. Signing a character takes them out of the rival pool for the rest of that save,
which is the reward for buying them.

### 3.3 Pyramid and market hygiene

Stripping inside the overlay is not enough on its own. `synchronizeM2ActiveDivision` writes
live `state.players` into `m2.pyramid` for the active tier, promotion and relegation then
move those squads between tiers, and `allCareerTransferTargets` walks **every** tier — so a
stale `special-*` row could be rebuilt by `pyramidCareerPlayer`, which does not carry a
stored power and would offer a powerless "Bruce Wain" from the wrong club at the wrong fee.

Two rules, both required:

1. `synchronizeM2ActiveDivision` **omits every `special-*` player when writing** the active
   tier back into the pyramid — the user's own signings included. Specials never enter
   pyramid data at all, which is the single cleanest choke point.

   Omitting the user's too, and not just the rivals', is deliberate. An earlier revision
   said "non-user", which contradicted acceptance criterion 13; the two cannot both hold,
   because a signed special is still a `special-*` row on the user's club. Nothing needs
   them there: the season transition rebuilds the user's squad from live `state.players`
   plus the lifecycle pass, never from pyramid data, and leaving marquee outliers out of
   the user club's pyramid `squadStrength` keeps rival difficulty scaling honest.
2. `allCareerTransferTargets` **skips `special-*` ids found in the pyramid walk**, as a
   belt over the brace. A special is only ever buyable as a live active-division player, or
   as one of the four unattached scout targets.

This supersedes the earlier "the pyramid is untouched" phrasing in §9, which was wrong:
the pyramid is deliberately *kept clean of* specials, which is a change to how it is
written, not an absence of one.

## 4. Choosing the host club

Per season, over the active division's clubs **excluding the user's**:

1. Rank by `clubSquadStrength` (`m2-career.ts:567`) — the mean `roleOverall` of the squad.
2. Highest wins. Ties break by `compareIds` on club id, so the choice is deterministic and
   a reload cannot move it.
3. The host is computed **before** the specials are added, so a club cannot be picked
   because it already hosts them — the selection would otherwise be self-reinforcing and
   the same club would hold the heroes for the whole career.

## 5. Building a special

### 5.1 Identity

Each special is a `CareerPlayer` with a stable id `special-<lookId>` (e.g. `special-f171`),
its fixed `name`, `role`, `power` and `lookId`, `licensed: true`, `onHeroWage: true`.
`powerTier` follows the existing generic ramp so specials are never weaker than the
ordinary heroes beside them: D5/D4 → 1, D3/D2 → 2, D1 → 3.

The id is keyed to the hero, not the club, so a special that moves to a different host
next season is the same character rather than a duplicate.

Every other `CareerPlayer` field mirrors `opponentCareerPlayer` (`full-career.ts:486`) so
no consumer meets an undefined it does not expect: `age` 26, `potential` 5,
`potentialCeiling` via `developmentPotentialCeiling`, `consistency` 90,
`contractSeasonsRemaining` 3, `archetype: 'All-Rounder'`, `personality: 'Professional'`
(authored characters get stated defaults rather than "whatever the neighbours have"),
`condition` 100, `morale` 70, `fame` 0,
`seasonsAtClub` 0, `retirementAge` 36, `retirementAnnounced` false,
`consecutiveLowMoraleWeeks` 0, `injuryWeeks` 0, and `signingStatTotal` summed from the
final attributes. `weeklyWage` uses `generatedPlayerWeeklyWage(attrs, division)`.

### 5.2 "Clearly better", as a number

`roleOverall` is the mean of `pac/sho/pas/def/tec/sta` and is **identical for DEF, MID and
FWD** — the role does not weight it. So "better for the role" cannot come out of the
overall; it has to be built into the spread. Both halves are specified.

Let `base` = the highest `roleOverall` among the host club's ordinary players, computed
before insertion. For `N` specials ordered 1..N (1 = strongest):

```
target(i) = base + 8 + 3 * (N - i)
```

So D1's four sit at `base+17, +14, +11, +8`. The weakest special is 8 clear of the best
ordinary player, and consecutive specials are 3 apart — enough that the top-N ranking is
never a coin flip, which is what the owner asked for.

### 5.3 Role-shaped attributes

Each role has an offset vector that sums to zero, so applying it to a flat `target` leaves
the mean — and therefore `roleOverall` — exactly at `target`:

| Role | pac | sho | pas | def | tec | sta |
| --- | --- | --- | --- | --- | --- | --- |
| FWD | +10 | +16 | −4 | −22 | +6 | −6 |
| MID | 0 | −14 | +16 | −6 | +12 | −8 |
| DEF | +2 | −24 | −2 | +20 | −4 | +8 |

A striker therefore peaks at shooting and pace and is poor defensively; a defender is the
mirror. `MAX_PLAYER_ATTRIBUTE` is 999 and attributes must be ≥ 1, so clamping is only a
risk at the very bottom of the range. **Clamping must not silently move the overall**: if
any attribute clamps, the surplus is redistributed across the unclamped attributes and the
result is re-checked, so `roleOverall(role, attrs) === target` is an invariant the code
asserts rather than hopes for.

`ref` is a required attribute and is **not** part of the outfield `roleOverall`, so it is
set to `target` for tidiness rather than left unset — an omitted `ref` fails
`assertAttributeValue`.

**Clamping conserves the sum, or fails loudly.** `MAX_PLAYER_ATTRIBUTE` is 999 and the
floor is 1, so only the floor is reachable (FWD `def = target - 22` needs `target < 23`,
far below any real division band). The procedure is nonetheless exact, because "roughly
right" would silently break acceptance criteria 2 and 3:

1. Compute `attrs[a] = target + offset[a]` for the six outfield attributes.
2. Clamp each into `[1, MAX_PLAYER_ATTRIBUTE]`, accumulating the total drift.
3. Redistribute the drift across the attributes that did **not** clamp, in a fixed
   per-role order so two implementers produce identical attributes — most characteristic
   first: FWD `sho, pac, tec, sta, pas, def`; MID `pas, tec, pac, sta, def, sho`;
   DEF `def, sta, pac, tec, pas, sho`. Points that must be *added* go to the front of that
   list, points that must be *removed* come off the back, so paying for a clamp sharpens
   the role profile instead of flattening it. Repeat until the six sum exactly to
   `6 * target`.
4. Assert `roleOverall(role, attrs) === target`. If the drift cannot be absorbed, throw —
   never ship a special that is not the rating it claims to be.

Step 4 is an assertion in production code, not only in tests, because a silently wrong
rating is indistinguishable from a balance decision.

### 5.4 Insertion

The special is **added** to the host club's squad, not swapped in. Generated squads are 16
(`SQUAD_ROLES`: 2 GK, 5 DEF, 5 MID, 4 FWD), so a host runs 17–20. Adding rather than
replacing is what makes "additive" true, and it means a host that loses the specials next
season is left with exactly the squad it always had rather than a hole where a replaced
player used to be.

**Specials are placed at the front of the club's player array, not appended.**
`startingEleven` (`full-career.ts:563`) takes the *first* N of each role in array order —
it does not sort by rating:

```ts
const take = (role, count) => players.filter(p => p.role === role).slice(0, count).map(p => p.id);
[...take('GK', 1), ...take('DEF', 4), ...take('MID', 4), ...take('FWD', 2)]
```

A squad is 2 GK / 5 DEF / 5 MID / 4 FWD and the XI is 1/4/4/2, so an *appended* special
becomes the 6th defender, the 6th midfielder or the 5th forward — and never starts. The
feature would silently not happen while every count-based test still passed. Prepending
makes `filter` yield them first, so they are always in the XI.

**The host's lineup is rebuilt with `startingEleven(hostPlayers)` after insertion, at both
call sites.** Prepending alone is not sufficient, because neither call site's lineup comes
from the post-overlay array: season 1 copies `club.startingLineup` verbatim out of
`content/clubs.json` (`launch.ts:129`), and season 2+ builds lineups inside
`generatedActiveDivision` *before* the overlay runs. An implementer who mutates only
`players` ships a benched Barry Allan while acceptance criterion 11 sits unsatisfied in the
spec. The overlay returns `lineups`, and the host's is regenerated.

The club's `weeklyWages` is recomputed after insertion, and the acceptance tests assert the
specials are in the starting eleven rather than merely in the squad.

## 6. Reserving the faces

Today f168–f182 are in the general assignable pool, so an ordinary generated player can
wear Bruce Wain's cowl. That has to stop: a face is now an identity.

- Add `SPECIAL_HERO_LOOK_IDS` (f168–f182) to `player-appearance.ts`.
- `assignDistinctPlayerLooks` never hands a reserved id to a player that is not a special.
- The **assignable** field pool returns to 168 (f00–f167). `FIELD_PLAYER_LOOK_COUNT`
  stays 183 as the count of shipped field looks; a separate
  `ASSIGNABLE_FIELD_LOOK_COUNT = 168` drives allocation. Conflating the two is what makes
  this subtle: `isPlayerLookIdForRole` must still *accept* f168–f182, because specials
  carry them and saves persist them.

## 7. The four scout-only heroes

They are on no club, so the existing transfer machinery cannot see them. Three contained
additions:

1. **An unattached sentinel.** `CareerPlayer.clubId` is non-optional and
   `completeCareerTransfer` reads it as the seller, so the four carry
   `clubId: SPECIAL_UNATTACHED_CLUB_ID` (`'unattached'`), an id no `ClubState` ever uses.
2. `scoutableCareerPlayers` (`market-career.ts:1200`) appends the four when the user's
   division is ≤ 3, skipping any already present in `state.players`.
3. `careerTransferTarget` resolves a `special-*` id that matches no club to
   `{ player, sellingClubDivision: 1, active: false }`. `active: false` matters: completion
   *appends* the signed player rather than map-replacing an existing row.

`sellerCanSpare` must short-circuit to `true` for an unattached target — it asks whether
the selling club still has cover at that position, and there is no selling club. Its
existing fall-through already returns `true` for an unknown id; the spec requires that to
be made explicit rather than relied on as an accident.

The transfer fee is paid by the user and credited to nobody. That is deliberate — it is a
money sink, and the alternative (crediting a club that does not exist) is worse.

Their attributes use the §5.2/§5.3 construction with `base = 120`, the top of
`DIVISION_STRENGTH_BANDS[1]`, and **`count = 1, order = 1`** — each is built standalone at
`base + 8 = 128`, not as a ranked quartet, because they are never teammates and there is no
club ranking for them to sit in. They carry `powerTier: 3` and
`generatedPlayerWeeklyWage(attrs, 1)`, matching the `sellingClubDivision: 1` they are
priced at, so a marquee signing costs and pays like one.

### 7.1 Making them actually reachable

`rumoredHeroShortlist` only surfaces a hero when a 25% rumor roll succeeds, and the hero
bucket contains **every** powered transfer target — by D3 that is dozens of generic
opponent heroes, so an unbiased pick would surface a scout-only special almost never.
"All four are reachable" would be a claim the code does not support.

**Rule:** the hero bucket is **partitioned** into unsigned scout-only specials and generic
heroes, each partition shuffled independently, and the specials placed first. Partitioning
before the shuffle matters: `rumoredHeroShortlist` currently shuffles the whole bucket and
takes index 0, so a plain sort would be undone by the very next line. The 25% rumor roll
still gates the payoff, so the find stays rare and earned — but when it pays out, it is one
of the four.

## 8. Balance risk — measured, with a decision rule

This is the part that most deserves scrutiny, and one measurement has already been taken.

**Measured fact:** the user's first league fixture is *always* against the strongest rival.
Across seeds 20260720, 12345 and 999, week 3 is `thunder-borough` at squad strength 51
(after `strengthenFirstOpponent`'s +5) against a user club pinned to 40. That is not a
coincidence of seeding — `pinOpeningLeagueOpponents` places the hardest club in the slot
the opener draws, and `strengthenFirstOpponent` then buffs whoever that is.

So placing D5's special on the strongest rival means **Barry Allan plays in the user's
first league fixture** (week 3; weeks 1-2 are pre-league), on a club already tuned to be the hardest in the division, while
D5 has deliberately had zero opponent heroes so the player's first awakening is the only
one on the pitch (`power-catalog.ts:55`).

That is what the owner asked for, and it ships as specified. It is not shipped blind:

- The full balance harness under `src/audit` must pass.
- Season-1 and season-2 promotion rates are measured over the harness's existing seed set
  **before and after**, and reported with numbers.
- **Decision rule, fixed in advance:** if season-2 promotion for a manager who trains and
  builds drops below the rail the ramp work established, the fix is applied in this order —
  (a) lower D5's `target` margin from +8 to +4, (b) host the *second*-strongest rival in
  D5 only, (c) move Barry Allan to D4 and leave D5 hero-free. A rail is never loosened to
  accommodate the hero.

Rails that assert "D5 has no opponent heroes" are not rails about balance; they encode the
old rule and are rewritten, with the change called out in the commit.

Also note the D1 host ends up with 4 specials *plus* its 2–3 generic heroes, and a squad of
20. That is intended under "additive", and worth seeing before it ships.

## 9. Out of scope

- Specials appearing in divisions the user is not playing. They exist only in the active
  division, and §3.3 keeps them out of pyramid data entirely.
- Any change to the generic ramp in `generatedClubHeroCount`.
- Bespoke dialogue, cut-ins or commentary for named heroes.
- The sim, `ENGINE_VERSION`, or golden replays. Powers already exist; this only decides who
  carries them.

## 10. Acceptance criteria

1. In every division, the strongest rival club fields exactly the specials assigned to that
   division **except any already signed to the user's club**, and they are the top-N by
   `roleOverall` at that club.
2. The weakest special is ≥ 8 clear of the best ordinary player at its club, and specials
   are 3 apart per step of `order`. Note the edge case: targets are computed from the
   division's fixed `order`, so if D1's order-2 has been signed away the remaining three
   sit at `base+17/+11/+8` and two *present* specials are 6 apart. That is intended —
   renumbering would make a character's rating shift because a different character was
   bought.
3. `roleOverall(role, attrs)` equals the computed target exactly, clamping included.
4. Each role's peak attribute is the role's own: FWD `sho`, MID `pas`, DEF `def`.
5. **Placement** never selects the user's club. A special on the user's roster can only
   have arrived by transfer — this is ownership, not hosting, and the two must not be
   conflated in the test.
6. No ordinary player anywhere wears a reserved look.
7. The host club is stable across a save/reload and re-derived at each season boundary.
8. All four scout-only heroes are reachable through a `RUMORED_HERO` mission at division
   ≤ 3, signable once, and never offered twice.
9. `npx tsc --noEmit` and the full Jest suite pass, including `src/audit`.
10. Promotion rates before/after are reported, not assumed.
11. Specials appear in the host's **starting eleven**, not merely its squad.
12. Entering season 2 in the same division rebuilds the specials from scratch: no duplicate
    player id, and the host is re-derived from ordinary strength alone.
13. A relegated or promoted club never carries a special with it, and no `special-*` row
    ever appears in `m2.pyramid`.
14. Buying a placed special removes them from the rival pool permanently: the next season's
    host fields one fewer, and the character is never duplicated.
