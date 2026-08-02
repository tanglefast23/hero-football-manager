# Player Requests — design

**Date:** 2026-08-01
**Status:** approved design, amended after audit 2026-08-01, ready for planning
**Scope:** one cycle, self-contained

From season 2 week 5, players start asking the manager for things. A second tab
on the Squad screen carries the ask; granting it costs money, weeks, or fresh
legs, and refusing it costs the player's regard. A new per-player **loyalty**
score records that regard and spends it at the negotiating table.

---

## 1. Why this shape

The management week is currently a builder's loop: train, buy, advance. Nothing
in it argues back. The squad is a spreadsheet of numbers that improve when paid
attention to, and the only thing that ever says no to the manager is the bank
balance.

Requests give the squad a voice with a price on it, and they do it without a new
currency, a new screen, or a new match mechanic. Every decision is the same
shape: *pay something real now, or owe something real later.*

**Two clocks, deliberately.** Refusing costs morale (fast, recovers on wins,
moves match attributes) and loyalty (slow, never recovers on its own, decides
renewals). One sting you feel on Saturday, one scar you meet at contract time.
Neither alone makes the decision interesting.

---

## 2. Loyalty

A new `CareerPlayer.loyalty`, an integer 0–100, **derived** from the career seed
and the player's id in the band **60–75** whenever the field is absent, and
persisted only once something moves it. It is visible on the player profile card from
week one of season one, with an `InfoTip`, and it is never gated.

**It has exactly one job: it moves the contract renewal ask.**

That is a constraint on implementation, not just a description. In particular it
must NOT feed `isUnderpaidPlayer` in `src/game/player-wellbeing.ts`, which also
calls `renewalContractAsk`: doing so would make every refusal quietly raise the
"fair wage" line, adding −2 morale a week and a faster transfer request that no
button on the decision card ever mentioned.

```
askMultiplier = 1 + (50 − loyalty) × 0.004
```

| Loyalty | Renewal ask |
| --- | --- |
| 100 | ×0.80 |
| 75 (typical start) | ×0.90 |
| 50 | ×1.00 |
| 25 | ×1.10 |
| 0 | ×1.20 |

**Below 30 loyalty the player will not re-sign at any price.** No renewal
negotiation is offered; they run the contract down and leave. Telegraphed by
rendering loyalty in `text-stamp` red below 40, the same red-means-warning
treatment the condition column already uses.

### Why visible from week one, not gated to season 2

The crafted hero starts on a one-season contract, so the **first renewal
negotiation happens at the end of season 1** — before Bert would ever mention
requests. A hidden number that silently decides your first contract talk is the
worst available option.

It also matches how this codebase already handles quiet modifiers. Personality
shifts the renewal ask by ±10–20% and the only place that is ever stated is an
`InfoTip` on the player card (`src/ui/screens/SquadTrainingScreen.tsx:59`).
Loyalty is the same shape: visible, tappable, never lectured.

Consequence: by S2 W5 the manager has watched these numbers sit still for 35
weeks, so Bert's briefing lands as *"that is what those were for"* rather than
*"here is a new stat."*

---

## 3. Who asks, and how often

The clock starts at **season 2, week 5**, the week Bert's briefing is delivered.
One pending request at a time; no new roll opens while one is unanswered.

### Eligibility

A player may be picked only if all hold:

- on the user's club
- `injuryWeeks === 0` and `awayWeeks === 0`
- at the club at least one full season (`seasonsAtClub >= 1`)
- not the player who made the previous request
- **not the club's only fit goalkeeper**, if the drawn request is an `ABSENCE`

`transferRequested` is deliberately **not** an exclusion (changed 2026-08-02;
it was one until then). Wanting a move and wanting a new gym are different
things. Measured over six seasons and three seeds on the production engine,
14–15 of a 16-man squad are legitimately listed by season 3 — not stale flags,
every one would ask again on that week's mood — and excluding them silenced the
tab for 43–52% of settled weeks, in stretches past 20 weeks, even for a manager
who granted every request on sight. The drought landed exactly when a
struggling club most needed the beat. Letting a listed player ask also gives
the manager the only lever that talks him round: a grant pays +5 morale toward
the mood at which he withdraws the transfer request.

### Weighting

Base weight 1, doubled once for each qualifier the player meets:

| Qualifier | Test |
| --- | --- |
| Name player | `fame >= 50` |
| Division goal leader | 1st or 2nd in the active division's `seasonGoalTallies` for the current season |

So an anonymous squad player is weight 1, a famous player or a division top
scorer is weight 2, and a famous division top scorer is weight 4.

**Division goal tallies already exist.** `generatedActiveDivision`
(`src/game/full-career.ts:283`) builds persisted `CareerPlayer` records for the
ten clubs in the active division and puts them in `state.players`;
`recordSeasonGoals` (`src/game/career.ts:1179`) runs over every fixture that
week, not only the user's. Rival goals are therefore already tallied. Nothing
new is required to rank them.

**Documented seam.** The qualifier list is a function returning
`readonly StarQualifier[]`. When the separate
[division-leaders](2026-08-01-division-leaders-design.md) work lands with
assists, tackles and saves, each new board becomes one more qualifier entry.
This design deliberately does not depend on that work and must not be blocked
by it.

### Cadence

The gap uses the eased drought ramp from `quietWeekEventChancePercent`
(`src/game/event-clock.ts:48`), offset by a floor so the window is exact: no
roll happens before `minWeeks` dry weeks, and the chance ramps from
`baseChancePercent` to certainty at `guaranteeWeeks`.

| | No star qualifier | Star on the books |
| --- | --- | --- |
| **Cozy** | 8–12 weeks | 6–10 weeks |
| **Chairman** | 6–10 weeks | 4–8 weeks |

`baseChancePercent` is 25. Owning stars is what makes the dressing room noisy.

---

## 4. Resolution

### The three paths

| | Chairman | Cozy |
| --- | --- | --- |
| **Grant** — one player | pay the cost · **+5 loyalty, +5 morale** | same |
| **Grant** — squad | pay the cost · **+2 loyalty, +5 morale** to every squad player | same |
| **Refuse** — one player | **−5 loyalty, −8 morale** | −3 loyalty, −4 morale |
| **Refuse** — squad | −2 loyalty, −3 morale to everyone | −1 loyalty, −2 morale |
| **Absence length** | as authored, 1–3 weeks | capped at 1 week |

Granting is never punished twice: a request costs money **or** weeks **or**
condition, never a combination.

Squad-wide deltas apply to every user-club player including the asker, who also
takes the individual delta — so the asker of a granted squad request nets
+7 loyalty.

### Lapse

- **Week N** — the request appears; the Requests tab glows and the Squad tab in
  the bottom rail wears a marker.
- **Week N+1**, still unanswered — an urgent one-shot
  `AssistantInboxProductAlert` states the exact penalty:
  *"Rojas is still waiting. Leave it and you lose 5 loyalty and 8 morale."*
- **Week N+2**, still unanswered — it lapses as a refusal at **exactly the
  stated cost**.

Full price, not a discount. The manager was told the number; making the ignored
path cheaper than the decided path would be the wrong lesson.

### Affordability

The Grant button disables unless the club can pay in full, reading *"Not enough
in the books."* Refuse always stays live, so the feature can never softlock a
failing club.

**Not the difficulty cash floor.** Every other discretionary purchase in the
game guards on `club.cash < cost` (scouting at `market-career.ts:209`, youth
signings, transfers, drill upgrades); the fail-soft floor exists for
obligations a manager cannot avoid — wages and upkeep — not for luxuries.
Spending past zero would also record a negative `balanceAfter`, which
`cashTransactionSchema` rejects, producing a career that cannot be saved.

### Cancellation

A pending request cancels silently, with no loyalty or morale change, if the
asker is sold or retires, or when the season ends. The request clock resets at
season rollover.

Being transfer-listed does **not** cancel it (changed 2026-08-02, with the
eligibility rule above). A bad fortnight between the ask and the answer used to
void a card the manager was still looking at. Leaving the club is the only
thing that invalidates an ask.

---

## 5. The 30 requests

Five cost archetypes. Art is a pair of names from the shared 16×16 sprite
vocabulary in `src/ui/event-pixel-sprites.ts`; **21 of the 30 compose entirely
from existing sprites** and only 9 new ones are needed (marked **new**).

### Money — one player · `N × their weekly wage`

| id | Title | Line | N | Art |
| --- | --- | --- | --- | --- |
| `gift-for-my-bae` | Something with diamonds | "Something with diamonds in it. She'll know if it's fake." | 3 | money-bag + star-sparkle |
| `the-car` | The car | "I've seen the one. It's yellow." | 12 | **new** sports-car + money-bag |
| `gold-boots` | Custom gold boots | "My initials on the heel." | 4 | boot + star-sparkle |
| `fly-my-mum-in` | Fly my mum in | "Every home game. She's never seen me play." | 5 | ticket + letter |
| `personal-chef` | A personal chef | "I can't eat what's in that canteen." | 6 | **new** chef-hat + burger |
| `home-studio` | A studio at home | "I've got bars, boss. I need a booth." | 8 | **new** microphone + tv |
| `cousins-wedding` | My cousin's wedding | "I said I'd pay. Loudly. In front of everyone." | 7 | envelope + money-bag |
| `matchday-barber` | Matchday barber | "I can't go out there like this." | 3 | **new** scissors + scarf |
| `highlights-drone` | A highlights drone | "My agent says I need content." | 4 | drone + camera |
| `fix-my-old-pitch` | Fix my old pitch | "The one I grew up on. New fence, new nets." | 3 | cone + banner-flag |

### Money — whole squad · `N × the club's weekly wage bill`

| id | Title | Line | N | Grant bonus | Art |
| --- | --- | --- | --- | --- | --- |
| `squad-massage` | Massage therapist | "The lads are stiff. Get someone in." | 0.5 | **+8 condition, all** | **new** massage-table + tape-roll |
| `squad-headphones` | Squad headphones | "Everyone. Matching. It's a unity thing." | 0.4 | **+3 morale, all** | **new** headphones + shirt |
| `charter-the-plane` | Charter the plane | "Six hours on a coach before a cup tie?" | 0.8 | **+4 condition, all** | **new** plane + ticket |
| `dressing-room-speakers` | Dressing room speakers | "The ones in there are a war crime." | 0.4 | **+3 morale, all** | **new** speaker + party-hat |
| `bbq-at-my-place` | Barbecue at my place | "Everyone's coming. You're paying." | 0.3 | — | spatula + party-hat |

### Absence — `awayWeeks`

| id | Title | Line | Weeks | Art |
| --- | --- | --- | --- | --- |
| `bahamas-fortnight` | Two weeks in the Bahamas | "Sun. Sea. Don't call me." | 2 | **new** palm-tree + sunglasses |
| `sisters-wedding` | My sister's wedding | "It's abroad. I'm giving a speech." | 1 | envelope + letter |
| `film-cameo` | A film cameo | "They want me on set. I have a LINE." | 2 | camera + sunglasses |
| `national-call-up` | National call-up | "My country called. I'm going." | 2 | banner-flag + ticket |
| `grandmothers-birthday` | Grandmother's birthday | "She's ninety. I'm going home." | 1 | letter + dog |
| `silent-retreat` | A silent retreat | "A month in the mountains. No football." | 3 | rain-cloud + tuning-fork |

### Condition — whole squad, applied immediately on granting

| id | Title | Line | Delta | Art |
| --- | --- | --- | --- | --- |
| `one-big-night-out` | One big night out | "The whole squad. One night. Trust me." | −10 | drink-can + party-hat |
| `carnival-weekend` | Carnival weekend | "It's once a year and we're ALL going." | −8 | banner-flag + party-hat |
| `all-night-tournament` | All-night tournament | "Video games. Dressing room. Till four." | −6 | tv + drink-can |

### Training — drill gains multiplied for a spell

| id | Title | Line | Effect | Art |
| --- | --- | --- | --- | --- |
| `my-own-guru` | My own guru | "He trains me my way for a month." | that player ×0.5 for 4 weeks | tuning-fork + cone |
| `ease-off-the-lads` | Ease off the lads | "They're cooked, boss." | squad ×0.6 for 2 weeks | cone + rain-cloud |

### Cut from v1 — the four status requests

`give-me-the-armband`, `i-want-the-ten`, `start-me-every-week` and
`train-me-first` were designed and then cut on the owner's call after an audit.
All four collide with live contract-promise machinery in
`src/game/contract-promises.ts`:

- `CAPTAINCY` and `JERSEY_10` set `isCaptain` / `shirtNumber` **and** write
  `contractPromise`, which holds a single object per player. A request moving
  the badge would strip `isCaptain` from a player who still held the promise —
  the badge would lie while the starting guarantee kept binding.
- `CAPTAINCY` is also in `STARTING_PROMISES`, so promising the armband silently
  promises a starting place. A request "for the armband" would have granted far
  more than a badge.
- `pendingTrainingPriorityHolder` resolves with `find()` over roster order. A
  second debt source beside the contract one would gate training on whichever
  player happened to sort first, reporting the wrong drills remaining.
- The season-bounded starting guarantee had an off-by-one that left the final
  league week uncovered.

Cutting them removes the entire `contractPromise` interaction surface from this
feature. Four replacements take their place, none needing a new sprite or a new
cost kind:

| id | Title | Line | Cost | Art |
| --- | --- | --- | --- | --- |
| `ship-my-car-over` | Ship my car over | "It's been in a container for six months." | 4× wage | briefcase + ticket |
| `charity-match-back-home` | A match back home | "One game in my old town. I'm not asking twice." | 6× wage | banner-flag + letter |
| `proper-team-photo` | A proper team photo | "A real photographer. Not your phone." | 0.5× bill, +3 morale | camera + shirt |
| `agent-in-the-room` | My agent sits in | "He watches training now. He has notes." | their drills ×0.7, 3 wks | briefcase + tactics-board |

If the status requests are ever revived they belong in their own cycle, with
their own tests, after captaincy has a mechanical effect worth competing for.

---

## 6. Presentation

### The tab row

Two equal-width tabs on the Squad screen, drawn exactly like the league's
division selector (`src/ui/screens/M2LeagueScreen.tsx:54`): `flex-1`,
`border-2 border-b-4`, `font-pixel` uppercase, selected wearing `border-blue-dark`
on `bg-blue-light`, 2pt press translate.

```
┌───────────────────┬───────────────────┐
│      DRILLS       │     REQUESTS  ●   │
└───────────────────┴───────────────────┘
```

**Before S2 W5 the tab row does not render at all.** The Squad screen looks
exactly as it does today. The row appearing is part of what makes the briefing
feel like it unlocked something.

`DRILLS` is an honest label: the screen holds `roster`, `player-file` and
`drill-shop` sections, and the lineup is set on the matchday screen.

### The glow, in two steps

A glow that cannot be seen from another screen is useless, so it is a
breadcrumb:

1. **Bottom rail** — the Squad tab wears a small marker dot.
2. **Requests sub-tab** — wears the full `GUIDED_ALERT_GLOW`
   (`src/ui/guidance-glow.ts`), the same blue halo guided inbox rows use.

### The sequence

1. **They walk on.** `CharacterSpeechOverlay` + `PlayerRunSprite`, the identical
   rig behind the new-signing hello, so it already reads as house language. The
   speech bubble carries the request's authored line.
2. **The card.** A modal with the composed pixel artwork, the ask, and two
   buttons with their prices printed on them:
   `GRANT · Out 2 weeks · +5 loyalty` / `REFUSE · −5 loyalty · −8 morale`.
3. **The outcome.** Result line plus reward chips through the existing
   `EventRewardArt`, then they walk off. Nothing to dismiss.

Bert never explains the numbers, because the buttons carry them.

### The tab's contents

The pending request card if there is one; below it a short ledger of recent
decisions — *"Bought Rojas a car · S2 W12 · −38,400"* — so the tab is not blank
most weeks and the manager's history of saying no is visible. Empty state uses
the shared `EmptyDocket`: *"No requests · The dressing room is quiet. It won't
last."*

### Bert's briefing

One page, delivered through the inbox like every other M2 sequence — not as an
Advance Week interrupt. Matches the length of `head-coach-market`.

```json
{
  "id": "player-requests",
  "inbox": {
    "title": "A WORD FROM THE DRESSING ROOM",
    "detail": "One of yours wants a favour."
  },
  "destination": "squad-requests",
  "pages": [{
    "kicker": "The dressing room",
    "title": "They want things now",
    "body": [
      "Players with a name start asking for things. A gift, a spa day, two weeks in the sun.",
      "Say yes, it costs you now. Say no, it costs you at contract time — they remember."
    ],
    "focus": "squad-requests",
    "objective": "OPEN THE REQUESTS TAB.",
    "buttonLabel": "Let's hear it."
  }]
}
```

Beat pairing in `src/ui/bert-beat-moments.ts`:
`'player-requests': ['confiding', 'pointing-out']` — dressing-room gossip, then
he points at the tab.

---

## 7. Architecture

### New files

| File | Job |
| --- | --- |
| `content/player-requests.json` | The 30 requests plus tuning; zod-validated in `src/content/schemas.ts` |
| `src/game/player-requests.ts` | **Pure.** Eligibility, weighted pick, pricing, grant/refuse/lapse, effect ticking |
| `src/game/loyalty.ts` | **Pure.** Initial roll, clamping, renewal multiplier |
| `src/application/player-request-view-model.ts` | State → view model |
| `src/ui/screens/SquadRequestsPanel.tsx` | The tab's contents |
| `src/ui/PlayerRequestWalkOn.tsx` | `CharacterSpeechOverlay` wrapper |
| `src/ui/PlayerRequestDecisionCard.tsx` | The decision modal |

`SquadTrainingScreen.tsx` is already 1,015 lines. The requests panel gets its
own file; the screen gains only the tab row and a branch.

### Touched files

- `src/game/types.ts` — `loyalty`, `awayWeeks` on `CareerPlayer`;
  `playerRequests` on `GameState`
- `src/persistence/game-state-codec.ts` — schemas;
  **`GAME_SCHEMA_VERSION` 2 → 3**
- `src/game/market.ts` — loyalty factor into `renewalContractAsk`
- `src/game/lineup.ts`, `src/game/squad.ts` — `awayWeeks` blocks selection
  exactly as `injuryWeeks` does
- `src/game/contract-promises.ts` — starting-promise enforcement must exempt
  away players as well as injured ones, and
  `pendingTrainingPriorityHolder` must accept a request-granted priority
- `src/game/training.ts` — drill gain multiplier
- `src/game/career.ts` — weekly tick: roll, effect countdown, `awayWeeks`
  countdown, lapse
- `src/game/assistant-guide.ts`, `content/assistant-guide.json`,
  `src/ui/bert-beat-moments.ts` — the briefing
- `src/ui/event-pixel-sprites.ts` — 9 new 16×16 sprites
- `src/ui/screens/SquadTrainingScreen.tsx` — the tab row and the profile card's
  new loyalty tile

### Persisted state

```ts
interface PlayerRequestState {
  weeksSinceRequest: number;
  pending?: PendingPlayerRequest;
  effects: ActiveRequestEffect[];
  history: ResolvedPlayerRequest[];   // capped, newest first
  lastAskingPlayerId?: string;
}

interface PendingPlayerRequest {
  requestId: string;
  playerId: string;
  askedSeason: number;
  askedWeek: number;
  /** Cost snapshot taken when the request opened, so wage changes cannot move the price. */
  costAmount?: number;
  /** True once the week-2 inbox warning has fired. */
  warned: boolean;
}
```

The cost snapshot matters: without it, a renewal or a wage rise between the ask
and the answer would silently change the number printed on the card.

### Three rules this must respect

**Purity.** `src/game/` takes no React Native, no `Math.random`, no `Date.now`.
Every roll goes through a `deterministicCareerEventRoll`-shaped helper seeded on
`careerSeed`/`season`/`week`, so save-and-reload can never re-roll who asks or
what they want.

**`awayWeeks`, not `injuryWeeks`.** Reusing the injury field would let the
Medical Bay shorten a beach holiday and make the UI announce a striker is
"recovering" from the Bahamas. Separate field, same selection block, its own
`ON LEAVE · 2 WEEKS` chip.

**No `ENGINE_VERSION` bump.** `src/sim/` is untouched. The career layer feeds
the engine different condition, morale and lineups, but the engine's behaviour
and RNG consumption are identical, so golden replays stay valid.
`GAME_SCHEMA_VERSION` does go to 3.

---

## 8. Balance harness

Requests move money and condition, so the CI harness needs an explicit stance or
its existing assertions drift.

- The headless harness runs with requests **auto-refused** — deterministic, no
  cash movement, existing assertions hold unchanged.
- One new probe measures a grant-everything career across a season, so the true
  cost of always saying yes is a measured number rather than an estimate.

---

## 9. Testing

**Pure engine** (`src/game/__tests__/player-requests.test.ts`)
- cadence ramp: no roll before `minWeeks`, certainty at `guaranteeWeeks`, both
  difficulties, both star states
- fame and goal-leader weighting, including the 4× compound case
- eligibility exclusions, especially the only-fit-goalkeeper absence guard
- pricing for all six cost kinds, including a negative-cash club
- grant / refuse / lapse deltas at both difficulties
- effect expiry and `awayWeeks` countdown
- cancellation on sale, retirement and season rollover, and its survival of a
  transfer request

**Loyalty** (`src/game/__tests__/loyalty.test.ts`)
- initial roll stays within 60–75 and is seed-stable
- clamping at 0 and 100
- renewal multiplier at the table boundaries
- the below-30 no-renewal rule

**Persistence** — codec round-trip for `playerRequests`, `loyalty` and
`awayWeeks`; rejection of out-of-range values.

**View model** — the S2 W5 gate, the glow condition, the disabled Grant button
when unaffordable.

---

## 10. Out of scope

- Giving the captain's armband a mechanical effect, and with it the four
  status requests cut above
- Assists, tackles and saves as star qualifiers — these arrive with
  [division-leaders](2026-08-01-division-leaders-design.md) and slot into the
  qualifier list without changing this design
- Rival clubs having their own request pressure
- Requests during the cup or between seasons
