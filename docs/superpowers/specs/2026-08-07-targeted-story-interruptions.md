# Targeted Story Interruptions — Design Spec

**Status:** v6 — **APPROVED by both reviewers.** Attribute effects are denominated in **training sessions** (§6.1). Grok rounds 1–3 + sessions round 2; Fable rounds 1–2 + sessions round 2. Owner milestone rewrite 2026-08-07.
**Date:** 2026-08-07
**Owner decisions captured:** an attribute reward is worth **3–4 of that club's training sessions**, never a flat number; effects are otherwise **small and permanent**; **players, coaches and facilities in one build**; cut the **bottom 25** of the 50 shipped events and author **30** new ones; a coach must **show the bonuses it provides** once selected; **most stories are one card** — roughly one in four gets a part 2; **"Continue the story" only ever means a real part 2** — milestones are never tacked onto another story and appear on their own once earned (§5.3); **the milestone set is rewritten** — 4 cut, 3 kept, 3 new (§5.4).

---

## 1. What this is

A story interruption today is a card with two buttons and a weighted roll behind the risky one. It pays out in club money, fans, TP or squad morale. The manager reads it, picks, and the roster is identical afterwards.

This spec makes the interruption **point at something**. The card asks *who* or *what* before it asks *what you do*:

- **a player** — 12 openers
- **a coach** (head or assistant) — 8 openers
- **a facility** — 5 openers

The risky choice then moves something durable about that target — one attribute, its loyalty, its coaching output, how well the building works — a little, permanently, in the direction the story argues for. The safe choice moves the same thing less and cannot fail. **A risky failure takes something off the same target**, so a bad call is visible on the thing the manager pointed at.

Plus **5 sequels**, attached to 4 of those openers (`one-more-year-handshake` has a different sequel per branch). 25 openers + 5 sequels = **30 new events**.

The milestone set is rewritten alongside it (§5.4): 4 of the 7 recognition cards go, 3 stay, 3 new ones are authored. So the catalog moves **50 → 54**:

| | count |
|---|---|
| kept | 21 (12 ordinary + 3 milestones + 6 chain halves) |
| cut | 29 (25 ordinary + 4 milestones) |
| added | 33 (30 targeted + 3 milestones) |
| **total** | **54** |

## 2. Why

Three problems, all visible in the shipped catalog's own numbers:

1. **The choice is left-or-right, not who.** 8 of 50 events set `trigger.requiresPlayer` (`player-slump`, `homesick-youth`, `lottery-win`, `two-player-feud`, `agent-whispers`, `rival-bid-arrives`, `rival-bid-deadline-day`, `youth-coach-breakthrough`). The picker exists and works (`StoryEventScreen.tsx:311-388`). Nothing points at a coach or a facility, because there is no plumbing to.
2. **The payouts are interchangeable.** Across 50 events and 249 effects: 64 `morale`, 57 `fans`, 51 `flag`, 43 `money`, 33 `tp` — and **exactly one `statDelta`** (`youth-coach-breakthrough`). A shooting drill and a lost mascot costume pay in the same currency, so the story is decoration on a slot machine.
3. **Nothing durable lands on a person.** `morale` with no player selected falls back to the entire squad (`store.ts:2385-2393`). The one lever that touches an individual permanently — `statDelta` — is used once.

More events would not fix this. Consequences attached to something the manager chose, and can see afterwards on the player file, the coach card and the facility panel, would.

## 3. Non-goals

- **No new screen.** Coach and facility pickers are the existing player picker's pattern, inside `StoryEventScreen`.
- **No new currencies.** Money and Training Points only (CLAUDE.md).
- **No sim change.** Events resolve off the career's deterministic event roll (`deterministicCareerEventRoll`), never `src/sim`'s PRNG. `ENGINE_VERSION` is untouched; the golden replay is unaffected.
- **Not a stat faucet.** §7 states the expected season yield and it must stay under the training system's noise floor.
- **No facility destruction.** A failure degrades a building's *output*, never its level, and never removes it. See §6.3 for why.
- **The 3 surviving milestone cards keep their text.** Only *when and how* they are delivered changes (§5.3).

---

## 4. What gets cut, and why those 25

Ranked on one question: *does the card pose a decision, or a coin-flip with flavour on it?* These 25 are the ones where the two buttons differ only in variance.

| # | Event | Why it goes |
|---|---|---|
| 1 | `lightning-storm-training` | Third mystery card of the same shape; the danger is asserted, never felt. |
| 2 | `radioactive-pitch-repaint` | Fans-or-money either way. |
| 3 | `very-old-boot` | A magic boot that changes nobody's boots. |
| 4 | `team-bbq` | Morale-for-money; the safe branch is the risky branch with the variance removed. |
| 5 | `prank-war` | Interchangeable with `team-bbq`. |
| 6 | `lost-mascot-costume` | Fan payout with a costume drawn on it. |
| 7 | `kit-clash-fan-vote` | The fans design a kit that never appears in the game. |
| 8 | `rat-trophy-cabinet` | One joke, no decision. |
| 9 | `local-paper-hero-expose` | Media/fans payout, duplicated twice below. |
| 10 | `viral-goal-clip` | The hero-goal milestone covers this moment better. |
| 11 | `pundit-slams-tactics` | The tactics are never named, so the reply cannot be about them. |
| 12 | `popup-sponsor` | The sponsor system already owns money-for-dignity. |
| 13 | `homesick-youth` | **Returns** as `homesick-family-move` (loyalty). |
| 14 | `lottery-win` | Nothing about the player changes. |
| 15 | `agent-whispers` | Duplicated by `rival-bid-arrives`, which has real money in it. |
| 16 | `flu-wave` | Squad condition is the obvious point and it never touches condition. |
| 17 | `miracle-physio` | Same. |
| 18 | `ultras-ticket-prices` | Pretends at a lever the club-business screen actually owns. |
| 19 | `hundredth-fan` | Head of a two-event chain, both flavour. |
| 20 | `community-mural` | Tail of the same chain. |
| 21 | `training-drone` | TP payout with a drone drawn on it. |
| 22 | `sponsor-bonus-cheque` | Free money with a photograph. |
| 23 | `groundskeeper-award` | **Returns** as `the-grass-mix` (training pitch). |
| 24 | `saturday-radio-hour` | Third identical media/fans card. |
| 25 | `clean-bill-of-health` | **Returns** as `the-sleep-room` (dorm — the medical bay turned out not to be targetable, §6.3). |

**Also cut — 4 of the 7 milestone cards** (owner decision, 2026-08-07; replacements in §5.4): `milestone-first-win` ("a win is not a milestone, it is Saturday"), `milestone-first-hero-goal`, `milestone-statement-win`, `milestone-promotion-push`. Their entries in `CAREER_MILESTONES` (`career-events.ts:128-136`) and their earned-flag detectors go with them.

**Kept (20):** the 3 surviving `milestone-*` beats (`unbeaten-run`, `first-cup-win`, `crowd-thousand`); the three surviving chains (`rival-bid-arrives` → `rival-bid-deadline-day`, `leaking-stand-roof` → `west-stand-reopening`, `terrace-choir-forms` → `terrace-choir-anthem`); and `abandoned-lab-field-trip`, `haunted-scoreboard`, `meteor-shard-center-circle`, `mysterious-energy-salesman`, `hero-commercial`, `hero-school-visit`, `old-boy-comes-home`, `youth-coach-breakthrough`, `player-slump`, `two-player-feud`, `rival-scout-duel`.

### 4.1 Migration debt this creates — verified, not assumed

- **No kept event chains into a cut one.** Checked programmatically across all 50 `nextEventId` values.
- **No kept event's trigger requires a flag that only a cut event sets.** Same check; the intersection is empty.
- `hundredth-fan` → `community-mural` is the worked example in four test files (`src/application/__tests__/store.test.ts`, `src/game/__tests__/career-events.test.ts`, `src/game/__tests__/career-milestones.test.ts`, `src/content/__tests__/content.test.ts`). Repoint them at `rival-bid-arrives` → `rival-bid-deadline-day`, which survives.
- `src/application/__tests__/event-selection.test.ts` names `team-bbq`, `prank-war`, `miracle-physio`, `training-drone` as sample ids. Same treatment.
- `src/ui/event-pixel-art.ts` maps art objects per event id. Cut events lose their entries; any sprite left with no referent goes in the same commit (`assets/audio/sfx/README.md` states the rule for audio; the same discipline applies here).
- **i18n is the biggest mechanical job.** Roughly 8 prose strings per event per locale. −29 events ≈ −230 strings/locale; +33 ≈ +265. Across seven locales that is ~3,000 string operations. Gate 1 (key parity) covers chrome only; event prose is content, tracked by gate 10 coverage — it will report honestly rather than fail silently.

---

## 5. The shape of a targeted interruption

### 5.1 Flow

```
weekly draw ──▶ event card
                  │
                  ├─ trigger.requiresPlayer   → PLAYER INVOLVED card, tap → squad list
                  ├─ trigger.requiresCoach    → COACH INVOLVED card, tap → head/assistant   ← new
                  └─ trigger.requiresFacility → FACILITY INVOLVED card, tap → building list  ← new
                  │
            (choice buttons disabled until a target is picked — the existing rule,
             StoryEventScreen.tsx:396)
                  │
        ┌─────────┴─────────┐
     SAFE                RISKY
   guaranteed,        weighted roll
   small, positive    ┌────┴────┐
                   success   failure
                   larger    takes from
                   gain      the same target
```

The gate already exists for players (`store.ts:2322-2324` throws if `requiresPlayer` and nothing is selected). Coaches and facilities extend the same pattern, including the throw.

### 5.2 One card or two

**Default is one card.** 21 of the 25 openers resolve and return to the desk.

**4 chains only**, and every sequel fires on exactly one branch — so a part 2 always means a specific thing happened. `GameEventSchema.body` is a single string, so a chain that reads differently after a win and after a loss is **two sequel ids**, not one event with two bodies:

| Opener | Sequel | Fires on |
|---|---|---|
| `the-ladder-fortnight` (coach) | `what-he-brought-back` | risky **success** only |
| `hometown-testimonial` (player) | `the-old-club-calls` | risky **failure** only |
| `volunteer-work-party` (facility) | `the-plaque` | risky **success** only |
| `one-more-year-handshake` (player) | `the-promise-kept` / `the-promise-broken` | success → kept · failure → broken |

Chained events inherit and **lock** the target (`offerCareerEvent(..., carriedPlayerId)` → `playerLocked: true`), so part 2 is unarguably about the same person. §9 extends this to coach and facility ids.

### 5.3 Milestones stop being stapled to other stories — owner decision, 2026-08-07

**"Continue the story" must only ever mean a real part 2.**

Today it does not. `withCareerMilestoneRecognition` (`career-events.ts:391-406`) takes any earned-but-unseen milestone and writes it into the just-resolved event's `resolvedNextEventId`, so the engine appends an unrelated recognition card to whatever story ended. `outcomeHasFollowUp` (`view-models.ts:1288`) cannot tell that from an authored sequel, so the button promises a continuation and delivers a different story — off a failure screen, where it reads as the consequence of the choice.

The stapling existed for a real reason: milestones are gated on achievements, and if they had to wait for the ordinary **18% weekly roll** the manager would be congratulated for a week-9 goal in week 15. That reason survives; the mechanism does not.

**The change:**

1. **Delete the stapling.** `withCareerMilestoneRecognition` goes; `resolvedNextEventId` becomes authored-only. `outcomeHasFollowUp` is then true only for a genuine part 2, and no copy change is needed — "Continue the story" becomes true again.
2. **A milestone is offered on its own card, ahead of the random deck.** A persisted `pendingMilestones: { eventId: string; selectedPlayerId?: string }[]` is appended to at weekly settlement, in `CAREER_MILESTONES` order, by the same detectors that set the flags today. `eventOfferForWeek` drains its head. This is a queue, not a re-scan of earned flags every week — cheaper and with no recomputation edge cases (Grok's suggestion, adopted).
3. **An earned milestone is immediate.** It bypasses the clear-desk and previous-story gates. It does not roll the random-story chance and does not reset `weeksWithoutEvent`. The exact rules matrix is:

| | fires on a busy desk? | rolls the 18%? | resets `weeksWithoutEvent`? | blocked the week after a story? |
|---|---|---|---|---|
| **milestone offer** | **yes** | **no** | **no** | **no** |
| random deck | no | yes | yes | yes |
| **milestone resolve** | — | — | **no** | — |
| random resolve | — | — | yes (unchanged, `store.ts:2391-2393`) | — |

The two "no"s in the milestone row are the point: a milestone delays the random story by occupying the week, but the drought ramp keeps climbing underneath, so the deck fires as soon as the queue empties. **Both the offer path and the resolve path must be changed** — fixing only the offer leaves milestone resolution zeroing the counter at `store.ts:2391-2393`.

4. **One milestone card at a time.** If one result earns several milestones, their cards drain back-to-back before the manager returns to the desk.
5. **A milestone carries a target only when the milestone is about a person.** `store.ts:1587` currently passes the *previous* story's `selectedPlayerId` into the injected milestone and `offerCareerEvent` locks it (`career-events.ts:286-290`) — so a slumping striker gets welded onto a hero-goal card. That inheritance is deleted. In its place: a milestone whose detector identifies a player (only `milestone-hat-trick`) is queued **with that player's id**, engine-set and locked. Everything else is queued with no target.
6. **A banked-but-unseen milestone on an old save.** The queue is new, so a career that earned `crowd-thousand` last week and has not been shown the card would have an empty queue and never see it. On load, the queue is **seeded once** from `banked flags − resolvedEventIds` for the three surviving milestones, so nothing already earned is silently swallowed. (Breaking old saves is acceptable in development per `save-migrations-deferred`, but this one costs a single line and avoids a confusing hole.)
7. **A scorer who leaves before recognition.** The hat-trick entry carries a player id and the card has no picker, so `offerCareerEvent`'s drop-the-departed-player rule would leave a `requiresPlayer` card that can never be resolved. Instead the **queue entry is dropped** when its carried player is no longer at the club.
8. **Cut milestones must not strand a save.** `reconcilePendingStoryEvent` (`event-selection.ts:137-145`) already drops a pending event whose id is unknown, which is the migration path for a career mid-way through one of the four removed cards. The queue field is new and absent on old saves, meaning "nothing pending".

### 5.4 The milestone set — rewritten

**Cut (4).** `first-win` (winning a game is Saturday, not an achievement), `first-hero-goal`, `statement-win` (3-goal margin), `promotion-push` (8 wins in a season).

**Kept (3).** `unbeaten-run` (4 without losing) · `first-cup-win` (any Hero Cup tie won) · `crowd-thousand` (home gate passes 1,000). Text unchanged.

**New (3).**

| id | Earned by | Detectable from |
|---|---|---|
| `milestone-hat-trick` | one player scores **3 in a single match** | `FixtureResult.scorerPlayerIds` (`types.ts:280-283`) — see the settlement note below |
| `milestone-heavy-defeat` | the club loses a match by **6 goals or more** | fixture scores, same scan as `userLeagueResults` (`career-events.ts:208`) |
| `milestone-merch-surge` | the **first TRENDING MERCHANDISE surge** in a Financial Report | the persisted ledger reveal `{ source: 'merch', surge: true }` (`types.ts:352-357`, schema `game-state-codec.ts:113`) |

**The hat-trick must be caught at settlement, not by scanning fixtures later.** `scorerPlayerIds` is on **`FixtureResult`** — the settlement *input* (`types.ts:280-283`) — not on `LeagueFixture`, which keeps only `score: { homeGoals, awayGoals }` (`types.ts:268-278`). Scorers exist while the week is being settled (`matchday.ts:198-207`, consumed by the fame path at `career.ts:757`) and are gone afterwards. So the detector runs **inside weekly settlement**, off the live result, and enqueues `{ eventId: 'milestone-hat-trick', selectedPlayerId: <scorer> }`. It counts **user-club scorers only** — rival fixtures settle through the same result shape, and without the restriction a rival hat-trick would enqueue a card whose target then fails the at-the-club check and gets dropped. Right outcome, wrong reason; the clause makes it intentional. A later re-scan cannot work, and a spec that implied one would have shipped a milestone that never fires.

**Still to verify in the plan:** `scorerPlayerIds` is documented as present "when the full simulation result is available". Quick Result runs the same engine through the same adapter, so it should be populated on both paths — the plan must *check* rather than assume, because a hat-trick scored on a Quick Result week would otherwise be silently lost.

#### The three new cards

**`milestone-hat-trick` — "Three in One Afternoon"** · *player-targeted, engine-chosen, locked*
> He took the match ball home. He has not put it down since, and the shop wants to know if it can have it back.

- **Safe** — Frame it for the clubhouse wall. **+6 morale, +8 fame**
- **Risky** — Put him up for the division's Player of the Month.
  - *win (60)* — He wins it and it is read out at the ground. **+14 fame, +8 morale, +3 sessions SHO**
  - *loss (40)* — He reads every word written about him and stops looking up. **−8 morale, −1 session PAS**

The one milestone that carries a player. The card shows the PLAYER INVOLVED panel with the scorer already filled in and no picker, exactly as a locked chain target does today.

**`milestone-heavy-defeat` — "Six"** · *club-level, devastating*
> The scoreboard operator turned it off with ten minutes left. Nobody asked him to turn it back on.

- **Safe** — Say nothing until Monday. **+3 squad morale**
- **Risky** — Watch all ninety minutes together, tomorrow morning.
  - *win (55)* — They find four things and fix three. **+10 squad morale, +8 TP**
  - *loss (45)* — The video does what the result did, only slower. **−10 squad morale, −60 fans**

The first milestone that is not a celebration. It exists because the recognition system currently only notices good weeks, and a 6-goal defeat is the most memorable thing that can happen to a small club.

**`milestone-merch-surge` — "It Sold Out"** · *club-level, funny, a callback*
> The shop has sold out of something and the accountant would like you to know what. Four hundred mugs with the groundskeeper's face on them.

- **Safe** — Reorder exactly the same number. **+$400, +40 fans**
- **Risky** — Order ten times as many.
  - *win (60)* — The second batch goes in a fortnight and he has started signing them. **+$1,800, +160 fans**
  - *loss (40)* — Four thousand mugs. The groundskeeper has stopped coming in. **−$900, −30 fans**

Fires on the first TRENDING MERCHANDISE surge, so the card is a direct answer to a banner the manager has just watched in the Financial Report.

---

## 6. Effect vocabulary

### 6.1 Player effects

| Effect | Status | Range in this catalog | Applied |
|---|---|---|---|
| `statDeltaSessions` | **new** — the denomination for every event authored by this feature | **+1 session safe · +3 (rarely +4) risky win · −1 risky loss** | resolved at apply time, then `career-events.ts:444-453`, clamp 1..999 |
| `morale` | exists (±100) | +3 safe, +5..8 win, −6..8 loss | `career-events.ts:441`, clamp 0..100 |
| `injury` | exists (1..8 weeks) | 1–2 weeks, failure branches only | `career-events.ts:436` |
| `loyalty` | **new** | +4..5 safe, +10..15 win, −10 loss | `adjustLoyalty` (`loyalty.ts`), **never** a raw field write — `undefined` means "initial loyalty" and writing over it destroys that |
| `condition` | **new** | +8 safe, +20 win, −10 loss | new branch, clamp 0..100, defaulting like `player-requests.ts:477-479` |
| `fame` | **new** | +8 safe, +12..20 win | new branch, clamp 0..999 (`FAME_CEILING`) |
| `injuryDelta` | **new** | −2..−1 only, heal | `max(0, current + weeks)` — see defect 2 |
| `squadMorale` | **new** | ±3..10 | every user-club player; **explicit**, never the accidental "no player selected" path |
| `statDelta` | **exists, and stays** | not used by any new event | the kept `youth-coach-breakthrough` carries a flat `+2 SHO` and must keep validating. The type is not removed; new content simply never authors it. Converting that one legacy value is a separate owner call, not a side effect of this feature |

#### Why attribute effects are counted in training sessions, not points

**Owner decision, 2026-08-07: an attribute reward is worth what 3–4 training sessions would give *that club*, or it is meaningless.**

The outfield drill ladder is **+4 / +7 / +11 / +16 / +22** per tier for 10 / 15 / 21 / 28 / 36 TP (`content/training.json`). A club's weekly TP runs from 24 (D5, no pitch) to 108 (L3 pitch plus coaches), so one season buys roughly **288** attribute points at tier 1 and **~1,980** at tier 5.

Against that, a flat `+2` is:

| | one season's training | a flat +2 | **3 sessions** |
|---|---:|---:|---:|
| tier-1 club | +288 | 0.7% | **4.2%** |
| tier-5 club | +1,980 | **0.1%** | **3.3%** |

A fixed number decays to nothing exactly as the club grows into the content. A session-denominated one is worth the same *fraction* of a season at every tier — the only way the reward keeps meaning what the story says it means.

So the effect carries **sessions**, and the engine resolves it **from the drill the club actually owns**, never from a table copied into the effect code:

```ts
const pathId = pathForAttribute(attribute);                // TRAINING_PATHS, training-paths.ts:37
const drill  = resolveTrainingDrillForPath(state, pathId);  // training-paths.ts:144
const points = sessions * drill.gains[attribute];
// then the existing statDelta clamp, career-events.ts:444-453
```

`ownedTrainingTier` (`training-paths.ts:79`) reads `ownedTrainingTiers` (`types.ts:868`) and returns tier 1 for an absent path, so this needs no new persistence.

**Resolving through the content rather than a constant is load-bearing.** A frozen `4/7/11/16/22` table in the effect code would ship wrong numbers the day `content/training.json` moves — and it would be wrong *today*, for keepers.

**Attribute → path is one-to-one.** `TRAINING_PATHS` gives each of the seven attributes its own path (`sprints`, `finishing`, `rondo`, `duels`, `first-touch`, `circuit`, `keeper-drills`). Do **not** use `trainingFacilityType` (`training.ts:564`) — that groups attributes by which *facility* multiplies them (the gym serves PAC and STA), which is a different question and would resolve the wrong drill.

**The keeper ladder is half the outfield one, deliberately:**

| tier | outfield | `keeper-drills` (REF) |
|---|---:|---:|
| 1 | +4 | **+2** |
| 2 | +7 | **+4** |
| 3 | +11 | **+6** |
| 4 | +16 | **+8** |
| 5 | +22 | **+11** |

So `the-penalty-gauntlet`, the one REF story, pays **+6 to +33** on a 3-session win, not +12 to +66. That falls out of the content automatically — which is exactly why the resolution reads it rather than restating it.

**Base gain only — the facility, coach, archetype and SUPER multipliers are all excluded.** Verified: `applyPlayerEffect` (`career-events.ts:443-451`) adds and clamps 1..999 and nothing else; every multiplier lives in `applyInstantGrowthModifiers` (`training.ts:323+`), which this path never enters. A 2× facility plus a level-5 specialist would otherwise turn "three sessions" into six, and an event that compounds with every other investment is the thing the caps exist to prevent. The honest consequence, stated rather than buried: to a fully-built club a 3-session reward is worth nearer 1.5 of its actual sessions. It still scales 5.5× across the ladder, which is the point.

**Range (outfield):** 1 session +4 → +22 · 3 sessions +12 → +66 · 4 sessions +16 → +88. **REF is half of each.**

**Losses are capped at −1 session, and floored proportionally.** An earlier draft allowed −2 "rarely"; at tier 5 that is **−44 on one attribute**, against a clamp floor of 1 rather than the player's starting value — so a squad player with 35 PAC could be gutted by one bad call at a club whose *path tier* he never personally benefited from (the owned tier is the club's, not the player's). `crossbar-until-dark`'s −2 becomes −1.

Even at −1 session the degenerate case survives: −22 against a 35 PAC youth is 63% of the attribute. So a negative resolves as

```
loss = min( sessions × gain, floor(currentValue / 4) )   // never more than a quarter of what he has
```

For a developed player this changes nothing — at 88 SHO the quarter is 22, so a −22 loss lands in full. It bites only where the spec's own principle ("moves something durable **a little**") would otherwise be violated: the young, the newly signed, the player who never had the stat to lose. **Owner call, flagged rather than assumed** — the brutal version is a legitimate choice, and it is one clamp line to remove.

Five engine defects this build must fix, all found in the survey and confirmed by the audit:

1. **Only the first effect of each of `morale`/`injury`/`statDelta` is read** (`store.ts:2350-2352`), while `money`/`tp`/`fans` are summed. **Decision: the content gate rejects duplicates** rather than the engine summing them. The shipped catalog has zero duplicates, so this costs nothing and removes a silent-drop class entirely.
2. **`injury` sets absolute weeks** (`career-events.ts:455`), so a 1-week event injury can *shorten* a 4-week absence. `injury` becomes `max(current, weeks)` and is **setback-only**. Healing gets its own effect, `injuryDelta`, because `max()` cannot heal — this is what `the-old-club-calls` needs and the v1 spec had no mechanism for.
3. **`injury` and `statDelta` are silently dropped with no player selected** (`store.ts:2360`). The content gate makes that unreachable by requiring `requiresPlayer` on any event that uses a player effect.
4. **Squad-wide morale is currently implicit** — it happens when an event has a `morale` effect and no player is selected (`store.ts:2385-2393`). Every §8 line that says "squad morale" uses the new explicit `squadMorale` type instead, so a targeted event can hit both the player *and* the room without the engine guessing.

   **This is a migration, not an addition.** Kept events that apply `morale` with no `requiresPlayer` depend on that fallback today, including the haunted scoreboard, the surviving milestones, and the choir pair. The decision: **migrate every one of those outcomes to `squadMorale` and delete the fallback entirely**, in the same commit. A gate rule then makes `morale` on an event without `requiresPlayer` a build failure, so the implicit path cannot come back. Half-fixing it — new type for new content, fallback left for old — would leave two ways to say the same thing and a defect that reads as intentional.
5. **Club TP and coach TP read identically in prose.** Every §8 line is spelled as either `{type:'tp'}` (club Training Points) or `{type:'coachBoost', facet:'tp'}` (that coach's weekly TP). In §8.2 the safe branches marked **+1 TP** are club TP; only lines that say *"his week produces…"* are coach TP.

### 6.2 Coach effects — one new type, three facets

Coach model (verified): two slots, `headCoach` / `assistantCoach`; level **1–5**; exactly **two distinct specialties** from ATTACK / DEFENSE / FITNESS / TECHNIQUE / GOALKEEPING / MOTIVATOR. Head gives **+10% training per level** on matching specialties and **10 + 2×level** weekly TP; assistant gives **+5%/level** and **5 + level** TP; MOTIVATOR cancels **5%/level** (head) or **2.5%/level** (assistant) of negative morale.

Level is **not** the lever. One head level is +10% training *and* +2 TP — an event handing that out is a free hire. Instead a hired coach carries a small permanent **boost record**, additive on top of level:

```ts
// on the persisted coach
boosts?: {
  trainingPercent?: number;   // ±, added to the specialty training bonus
  weeklyTp?: number;          // ±, added to weekly TP
  motivatorHalfLevels?: number; // ±, integer half-levels, only if they hold MOTIVATOR
}
```

| Facet | Per event | Lifetime cap per coach | What it is worth |
|---|---|---|---|
| `trainingPercent` | ±3 or ±5 | **−10 .. +10** | at most one extra head-coach level, ever |
| `weeklyTp` | ±1 or ±2 | **−4 .. +4** | at most two assistant levels of TP |
| `motivatorHalfLevels` | ±1 | **−2 .. +2** | one head level of Motivator |

Motivator is counted in **half-levels, not percent**, because that is the shape of the plumbing: `coachMotivatorStrengthHalfLevels` (`coach-weekly.ts:26-39`) returns an integer — 2 per head level, 1 per assistant level. A percent field would have to be converted back and would round wrong.

Caps are enforced by clamping at apply time, not by trusting content. A coach who leaves takes their boosts with them: boosts live on the coach record, not the club, so firing and re-hiring resets them — which is itself a decision.

#### The validator that makes this dangerous

**`applyCareerCoachTrainingModifier` hard-rejects any training scale outside 100..175** (`coach-weekly.ts:160`) — it throws, it does not clamp. Two ways a naive boost bricks a career, both permanent because boosts cannot be removed:

- An L5 head + L5 assistant sharing a specialty already sums to **exactly 175**. Any positive `trainingPercent` on top throws on **every training action** from then on.
- An L1 assistant alone is 105; a −10 boost gives 95, below the floor, and throws the same way.

So the boost is **not** merely added. The summed scale is **clamped into the validator's own 100..175 band before it is handed over**:

```
scale = clamp(100, 175, baseScale + boost.trainingPercent)
```

This is also the honest balance answer: a club already running two level-5 specialists gains nothing from another +5%, and a negative boost bottoms out at "no coach benefit" rather than making a coached club worse than an uncoached one. The cap table above bounds what content may *author*; this clamp bounds what the engine can *produce*. The plan must add a test that pins both bounds, because the failure mode is a thrown exception in the training path, not a wrong number.

One lateral effect, no power creep:

- **`coachSpecialty`** — swap one of the coach's two specialties for a named other. Same count, same level; only *where* the +10%/level lands moves. Used by exactly one event (`the-keeper-week`).

### 6.3 Facility effects — typed per benefit, never level

The facility survey is unambiguous: there is **no damage, wear, condition or downgrade concept in the game**. `level` only goes up (build/upgrade) or vanishes entirely (`closeFacility`, which deletes the building and refunds half the capital). Levels are division-gated — L2 from D5, **L3 only after reaching D2** (`promotion-progression.ts:181-189`).

So a facility event never touches `level`.

**v1 rejected one universal `outputBonusPercent`.** The audit was right that a single knob over seven different benefit formulas is both hard to word for the player and factually broken in one place: the Medical Bay's *level* shortens recovery **weeks** (`medicalBayRecoveryWeeks`, `player-wellbeing.ts:193-200`), while injury *chance* reduction is **adjacency-only** (Medical Bay + Training Pitch, `facilities.ts:195-200`). A percent knob on "injury chance" would have invented a lever the building does not have.

Instead, **four typed effects, each named for the thing the player already reads on the facility card**:

| Effect | Targets | Stored on the building as | Applies to |
|---|---|---|---|
| `facilityTpBonus` | training-pitch | `tpBonusPercent` −15..+20 | the pitch's TP contribution (28/level), `career.ts:1580-1600` |
| `facilityTrainingBonus` | gym · tech-center · shooting-range · keeper-court · training-pitch | `trainingBonusPercent` −15..+20 | the training multiplier's **bonus part**: `1 + (mult − 1) × (100 + b)/100` |
| `facilityRecoveryBonus` | dorm | `recoveryBonus` −2..+3 | flat points on top of `12 + 4×level` (`player-wellbeing.ts:277-281`) — a flat number, because a percent of "4 per level" rounds to nothing |
| `facilityIncomeBonus` | fan-shop · stadium-stand | `incomeBonusPercent` −15..+20 | that shop's/stand's own contribution to the summed income (`career.ts:1160-1190`, `1118-1128`) |

**Not targetable in v1:** medical-bay (integer weeks are too coarse — a ±1 is a 25–50% swing), scout-office (a shortlist size), coaching-office (a boolean unlock), youth-field (its main benefit is the seasonal `createOffer` path around `youth-intake.ts:353-354`, not the emergency line, and it fires once a year — too slow to feel).

Scaling the *bonus part* rather than the total matters: a −15% gym at a club with **no** gym must leave the multiplier at exactly 1.0, never below.

**The aggregator trap, which v1 got wrong.** Facility benefits read the **max operational level of a type** (pitch, gym, dorm, medical, youth) or the **sum of levels across copies** (fan shop, stadium stand — up to 3 each). Storing a bonus on one `PlacedFacility` without touching those aggregators would show a boosted building whose numbers never move — a trust break, not a crash. So:

- **Single-copy types** (build limit 1, `facilities.ts:79-82`): the aggregator reads the bonus off the same building it took the level from. Unambiguous.
- **Income types** (up to 3 copies): each building contributes `levels × (100 + itsOwnBonus)/100`, summed. A boosted shop raises only its own share.

Facility events additionally require **an operational building of that type** — `requiredFacility` today only checks the building exists in the grid, ignoring `isFacilityOperational` (`event-selection.ts:200-208`), so a half-built pitch satisfies it. That is a bug this build fixes: a story about the floodlights cannot fire at a stand that is still scaffolding.

---

## 7. Balance envelope

Event cadence, from the shipped tuning (`content/events.json`): **18%** in a quiet week, easing to certainty after **6** dry weeks, never two weeks running, and only on a desk-clear week. Over a 30-week season that lands **≈8 events** on a club whose desk is usually clear (the audit's simulated mean; v1's "5–7" was low). With 30 of 54 events targeted and rarity weights roughly even, expect **4–5 targeted events per season** — and fewer in a season carrying several milestones, since those occupy weeks without rolling.

At the numbers in §6, with risky success weighted 55–70%:

| Channel | Expected per season | Compare against |
|---|---|---|
| Attributes | **≈3.5 sessions' worth**, spread across 2–3 different players — **+14 points at tier 1, +77 at tier 5** (outfield; REF half) | a season buys ≈**288** points at a 24-TP tier-1 club and ≈**1,980** at a 108-TP tier-5 one, so this is **4–5% of one season's training at either end of the career arc** |
| Loyalty | +10 to +25 on one or two players | renewal threshold is 30; a full season of results moves it more |
| Coach output | one facet, once, inside its lifetime cap (±10pp training · ±4 TP · ±2 motivator half-levels) | one head-coach level is +10pp training, +2 TP, +2 motivator half-levels |
| Facility output | one building, ±3–10%, inside its typed cap | one training level is +25pp (L1→L2) or **+50pp** (L2→L3) of multiplier |
| Injuries | ≈0.5 injuries/season from failures, 1–2 weeks | overtraining below 30 condition already rolls 12–70% |

**The gate:** `npx jest --testPathIgnorePatterns='[]' src/audit/__tests__/club-business-long-career-probe.test.ts` — the probe that drives `src/audit/club-business-long-career-harness.ts`. The override is required: `*-probe.test.ts` is excluded from the default run by `testPathIgnorePatterns`, so it is **not** part of CI and will not catch a regression on its own — the plan must run it by hand, before and after. That is the command, and §9.2b is why it must be updated first: unchanged, it would pass while exercising none of this. If they move, the numbers here are wrong, not the harness. The plan schedules a harness run before and after the content lands, and states both.

**Read that row as a career arc, not a single club.** It pairs low TP with tier 1 and high TP with tier 5, which is how a career actually moves — the pitch that buys the TP and the drills that spend it are bought together. Hold TP fixed and the ratio does swing: a 108-TP club still on tier-1 drills trains 1,296 points a season, so +14 is 1.1%; a 24-TP club that somehow owns tier 5 trains 440, so +77 is 17.5%. Neither is a normal career, but the second is the shape to watch for in the harness — a club that buys drills far ahead of its TP income.

**Ceiling check.** Worst case — every event fires, every risky choice wins, all season, ten seasons — the caps bind: a coach cannot exceed +10pp training / +4 TP / +2 motivator half-levels (one head-coach level in each); a building cannot exceed +20%; attributes accrue, at the absolute worst, ~4–5% of a season's training per season — the session denomination is what holds that ratio flat as the club climbs, where a flat number would have decayed from 0.7% to 0.1%. There is no unbounded channel.

---

## 8. The 30 stories

Format: **target** · story · safe · risky win · risky loss. Weights are the risky split (win/loss).

### 8.1 Player — 12 openers

| id | Story | Safe | Risky win | Risky loss | w |
|---|---|---|---|---|---|
| `sprint-the-postman` | The postman claims he is faster than your quickest player, and has told everyone. | Timed runs, privately. **+1 session PAC** | Race him at half time in front of the ground. **+3 sessions PAC, +5 morale, +60 fans** | He pulls up in front of everybody. **−1 session PAC, injury 1wk** | 60/40 |
| `crossbar-until-dark` | He wants to stay until he hits the bar ten times. It is already dark. | Ten minutes, then home. **+1 session SHO** | Leave the floodlights on. **+4 sessions SHO** | Nine hundred shots, no rhythm left. **−1 session SHO, −12 condition** | 55/45 |
| `the-rondo-circle` | The squad has invented a rondo where one player never gets out of the middle. | Run it properly, everyone rotates. **+1 session PAS** | Leave him in there all week. **+3 sessions PAS, +6 morale** | He stops trying to win it back. **−1 session PAS, −8 morale** | 60/40 |
| `mark-the-hero` | Your defender asks to spend the week marking your own hero in training. | Half an hour a day. **+1 session DEF** | Every session, no help. **+3 sessions DEF, +6 morale** | The hero embarrasses him daily. **−1 session DEF, −10 morale** | 55/45 |
| `futsal-night` | The local futsal league is short a player and the hall is very small. | One friendly game. **+1 session TEC** | Sign him up for the whole run. **+3 sessions TEC, +8 fame** | A concrete floor and a bad landing. **injury 2wk** | 60/40 |
| `the-double-session` | He has asked, in writing, to train twice a day. | One session, done well. **+1 session STA** | Both, all week. **+4 sessions STA** | He trains himself into the treatment room. **−15 condition, injury 1wk** | 55/45 |
| `the-penalty-gauntlet` *(keeper only)* | The squad wants forty penalties at your keeper, right now. | Ten, then stop. **+1 session REF** | All forty, no breaks. **+3 sessions REF, +6 morale** | He stops reading them and starts guessing. **−1 session REF, −8 morale** | 60/40 |
| `hometown-testimonial` ⛓ | His first club wants him for a testimonial on a Sunday. | Send a signed shirt. **+4 loyalty** | Let him play the whole ninety. **+12 loyalty, +8 fame** | He limps off after twenty minutes. **injury 2wk, +5 loyalty** | 65/35 |
| `homesick-family-move` | A young player misses home, his dog, and one specific bakery. | Pay for a weekend home. **+5 loyalty, −$300** | Move the family near the ground, club pays. **+14 loyalty, +6 morale, −$900** | They come, they hate it, they go back. **−6 morale, −$900** | 70/30 |
| `one-more-year-handshake` ⛓ | His agent wants a number. He wants to know he will play. | A fair word and no promises. **+5 loyalty** | Promise him the shirt. **+15 loyalty, +6 morale** | He repeats the promise to the press. **−10 loyalty, −6 squad morale** | 60/40 |
| `the-cameras-want-him` | A regional show wants a full day with your most watchable player. | Twenty minutes at the ground. **+8 fame** | Give them the whole day. **+20 fame, +$600, +90 fans** | The edit makes him look ridiculous. **+8 fame, −8 morale** | 60/40 |
| `the-specialist-camp` | A recovery camp in the hills has one place left this week. | A week of light work. **+8 condition** | Send him up the mountain. **+22 condition, +4 morale, −$700** | Altitude, bad sleep, worse legs. **−$700, −6 condition** | 65/35 |

### 8.2 Coach — 8 openers

| id | Story | Safe | Risky win | Risky loss | w |
|---|---|---|---|---|---|
| `the-badge-course` | A coaching course runs Tuesdays for six weeks. It clashes with training. | Evening module only. **+1 TP** | Send him properly, miss the Tuesdays. **+5% training** | Six Tuesdays gone, one certificate. **−1 TP** | 65/35 |
| `the-ladder-fortnight` ⛓ | A club two divisions up will let one of your staff shadow them for a fortnight. | Ask for their session notes. **+1 TP** | Send him for the fortnight. **+5% training** | He returns with a system nobody here can run. **−3% training** | 60/40 |
| `assistant-takes-the-week` | Your assistant asks for one week running everything. | Give him a session. **+1 club TP** | Give him the week — his weeks produce more from now on. **+2 coach TP, +5 squad morale** | The week has no plan in it. **−1 coach TP, −6 squad morale** | 60/40 |
| `the-motivator-experiment` | He wants to try a speech, in the dark, with the lights off. | Let him speak, lights on. **+3 squad morale** | Lights off. **+1 motivator half-level, +8 squad morale** | The squad cannot look at each other for a week. **−1 motivator half-level, −6 squad morale** | 55/45 |
| `the-keeper-week` | Your keeper has nobody to work with and one of your staff used to keep goal. | An hour a week. **+1 TP** | Retrain him properly. **swap one specialty → GOALKEEPING** | He remembers less than he thought. **−2 TP** | 60/40 |
| `back-one-drill` *(needs both hired)* | Head and assistant have designed the same drill differently and will not budge. Back one of them. | Split the week between the two. **+1 TP** | Run the coach you picked, all week, in front of the other. **+5% training (that coach)** | It does not work and everyone watched it not work. **−3% training (that coach), −5 squad morale** | 55/45 |
| `the-clipboard-fire` | Twelve seasons of session notes went up with the boiler. | Print what the club has on file. **+1 club TP** | Rebuild the lot from memory this month. **+2 coach TP, +3pp training** | The rebuilt notes are half invention. **−5pp training** | 55/45 |
| `sports-science-salesman` | A man with a laptop can measure things nobody has asked to measure. | Take the free trial. **+1 TP** | Buy the system. **+5% training, −$1,500** | The numbers never mean anything. **−$1,500, −2 TP** | 55/45 |

### 8.3 Facility — 5 openers

| id | Story | Safe | Risky win | Risky loss | w |
|---|---|---|---|---|---|
| `the-grass-mix` *(training-pitch)* | The groundskeeper has a mix of his own and a small regional award to justify it. | Buy the mix the league recommends. **+3% pitch TP** | Let him lay his own. **+8% pitch TP, +40 fans** | It comes up in patches by October. **−8% pitch TP** | 60/40 |
| `volunteer-work-party` ⛓ *(any targetable)* | Forty supporters, one weekend, a great deal of enthusiasm and no qualifications. | Accept materials, hire the trade. **+3% to that building, −$500** | Hand them the keys for the weekend. **+10% to that building, +120 fans** | It is charming and it is wrong. **−5% to that building, −$400** | 60/40 |
| `donated-equipment` *(gym / tech-center / shooting-range / keeper-court)* | A crate arrives from a club that has gone up. Nobody can name half of it. | Keep what you recognise. **+3% training** | Install all of it. **+10% training** | Two machines nobody can use, in the way. **−5% training** | 60/40 |
| `the-sleep-room` *(dorm)* | The physio wants to change how the dorm works, not what is in it — blackout blinds, no screens after ten. | One change at a time. **+1 recovery** | Let her rebuild the whole night. **+3 recovery, +4 squad morale** | Nobody sleeps for a fortnight. **−2 recovery** | 60/40 |
| `floodlight-night` *(stadium-stand / fan-shop)* | A friendly under lights, with the shop open late and the choir invited. | Open the shop an hour early instead. **+3% income, +50 fans** | Put on the whole night. **+10% income, +200 fans, +$500** | Half the lights fail at kickoff. **−5% income, −$600** | 60/40 |

### 8.4 The 5 sequels

| id | Parent | Fires on | Story | Effects |
|---|---|---|---|---|
| `what-he-brought-back` | `the-ladder-fortnight` | risky success | He is running their pressing drill and the squad is arguing about it in the car park. | Safe: keep what works **+1 TP** · Risky win: rebuild the week around it **+3pp training, +5 squadMorale** (a coach sequel has no selected player, so it must be `squadMorale` or the §6.1.4 gate fails) · loss: it does not survive contact **−3% training** |
| `the-old-club-calls` | `hometown-testimonial` | risky **failure** | His first club knows the injury happened at their testimonial, and would like to help. | Safe: accept their physio's help **`injuryDelta` −1** · Risky win: let them pay for the specialist **`injuryDelta` −2, +8 loyalty** · loss: a second opinion, a longer absence **`injury` 3 weeks** (absolute; `max(current, 3)` — content cannot author "current+1") |
| `the-plaque` | `volunteer-work-party` | risky success | The work party want their names on the wall. All forty of them. | Safe: one plaque, one line **+60 fans** · Risky win: all forty names **+200 fans, +4% to the same building** (dorm branch: **+1 recovery** — every type in the map needs an authored value) · loss: three names misspelled, in brass **−40 fans** |
| `the-promise-kept` | `one-more-year-handshake` | risky **success** | He has played every week since, and would like it in the contract now rather than in June. | Safe: honour what was said **+6 loyalty** · Risky win: put it in writing **+15 loyalty, +5 morale** · loss: he reads the small print **−8 loyalty** |
| `the-promise-broken` | `one-more-year-handshake` | risky **failure** | He has not played, the press printed what you said, and his agent has the cutting. | Safe: admit it and apologise **+4 loyalty, −4 squad morale** · Risky win: start him Saturday regardless **+12 loyalty, +6 morale** · loss: he is not ready and it shows **−12 loyalty, −8 squad morale** |

⛓ = has a sequel.

### 8.5 Coverage check

Attributes touched: PAC, SHO, PAS, DEF, TEC, STA, REF — **all seven**, one opener each. Loyalty: 3 openers + 3 sequels. Condition: 1. Fame: 1 (+2 as secondary). Coach facets: training ×5, coach TP ×2 (`assistant-takes-the-week`, `the-clipboard-fire` — every other "+1 TP" is club TP), motivator ×1, specialty swap ×1. Facilities: pitch (TP), any (the work party), training buildings, dorm (recovery), income buildings — every targetable facility effect type represented.

---

## 9. Schema and save changes

### 9.1 Content schema (`src/content/schemas.ts`)

```ts
// trigger
requiresCoach?: boolean
requiresFacility?: FacilityType[]      // narrowed list; empty/absent = any targetable
requiresPlayerRole?: 'GK'              // the penalty gauntlet needs a keeper

// EventEffectSchema — new variants
{ type: 'statDeltaSessions', attribute: Attribute, sessions: int -1..4 }   // losses capped at -1
{ type: 'loyalty',      amount: int -25..25 }
{ type: 'condition',    amount: int -30..30 }
{ type: 'fame',         amount: int -50..50 }
{ type: 'injuryDelta',  weeks: int -3..-1 }        // heal only; setbacks use `injury`
{ type: 'squadMorale',  amount: int -15..15 }      // explicit, replaces the accidental fallback
{ type: 'coachBoost',   facet: 'training',  amount: int -5..5 }    // percentage points
{ type: 'coachBoost',   facet: 'tp',        amount: int -2..2 }    // weekly TP
{ type: 'coachBoost',   facet: 'motivator', amount: int -2..2 }    // HALF-LEVELS, not percent
{ type: 'coachSpecialty', to: CoachSpecialty }
{ type: 'facilityTpBonus',       percent: int -15..20 }
{ type: 'facilityTrainingBonus', percent: int -15..20 }
{ type: 'facilityRecoveryBonus', amount:  int -2..3 }
{ type: 'facilityIncomeBonus',   percent: int -15..20 }

// The "any targetable building" wire form — one effect, one branch per type,
// the engine applies the branch matching the selected building. Authored only
// by `volunteer-work-party` and `the-plaque`.
{ type: 'facilityBonusByType', byType: {
    'training-pitch':  { type: 'facilityTpBonus',       percent: 10 },
    gym:               { type: 'facilityTrainingBonus', percent: 10 },
    'tech-center':     { type: 'facilityTrainingBonus', percent: 10 },
    'shooting-range':  { type: 'facilityTrainingBonus', percent: 10 },
    'keeper-court':    { type: 'facilityTrainingBonus', percent: 10 },
    dorm:              { type: 'facilityRecoveryBonus', amount:   3 },
    'fan-shop':        { type: 'facilityIncomeBonus',   percent: 10 },
    'stadium-stand':   { type: 'facilityIncomeBonus',   percent: 10 },
} }
```

**Existing schema rules every new event must satisfy** — these are already enforced and would fail CI on day one if the authored stories ignored them. §8's tables give the *design*; the authored JSON must additionally carry:

| Rule | Where |
|---|---|
| a risky choice's **outcome[0] must set a success `flag`** | `schemas.ts:495-498` — all 50 shipped risky choices do |
| a risky win must author a **`successHeadline`** | `schemas.ts:499-501` |
| outcome weights **total exactly 100**; a risky choice has **exactly 2** outcomes, success first | `schemas.ts:489-494` |
| `category` is a fixed enum with **no coach or facility member** | `schemas.ts:506` — coach stories file under `club`, facility stories under `club`, player stories under `player`. Do not extend the enum for taxonomy's sake |
| `trigger.season` maxes at **2** | `schemas.ts:512` — read as "first eligible season", document per event |
| every event needs an **art key** and an `EVENT_OBJECTS` entry | `src/ui/event-pixel-art.ts:44` |
| a choice that spends cash needs **`minMoney`**, or it is offered to a club that cannot pay | pattern already in `eventChoiceUnavailableReason`; applies to **every branch that can spend**: `sports-science-salesman` (−$1,500), `homesick-family-move` (−$900), `the-specialist-camp` (−$700), `floodlight-night` (−$600 on the loss), `volunteer-work-party` (−$500 and −$400), `milestone-merch-surge` (−$900 on the loss). A risky branch's *loss* costs count too — the gate must read every outcome, not just the safe one |

New content-gate rules (fail the build, not the runtime):

1. Any outcome using a player effect ⇒ its event sets `requiresPlayer`. Same for coach (`requiresCoach`) and facility (`requiresFacility`) effects.
2. **No outcome carries two effects of the same singular type** — `morale`, `squadMorale`, `injury`, `injuryDelta`, `statDelta`, **`statDeltaSessions` (per attribute)**, `condition`, `loyalty`, `fame`, `coachBoost` (per facet), and each facility effect type. This is the §6.1 defect-1 decision: reject, don't sum.
3. Every `nextEventId` names an event whose **target kind matches its parent's**, so a chain cannot hand a facility story a player.
4. A coach event's authored `coachBoost` per facet must not exceed the lifetime cap on its own. The apply-time clamp is the backstop, not the design.
5. `injuryDelta` may only appear on an event that can follow an `injury` — today, only `the-old-club-calls`.

**A facility story that targets "any building" dispatches by type.** `volunteer-work-party` and its sequel `the-plaque` are the only ones, and the targetable set mixes percent effects with the dorm's flat one. The authored outcome therefore carries a **map**, not a single effect: `{ pitch: facilityTpBonus, gym|tech|range|court: facilityTrainingBonus, dorm: facilityRecoveryBonus, shop|stand: facilityIncomeBonus }`, and the engine applies the entry matching the selected building's type. The dorm's numbers are **+1 / +3 / −2 recovery**, not percentages. A gate rule requires an entry for every type the event's `requiresFacility` list admits.

**`coachSpecialty` needs one rule, stated:** the swap replaces the coach's **second** specialty (the array is ordered and exactly two, `coach-weekly.ts:173-174`), and the content gate rejects a swap whose `to` the coach already holds. `the-keeper-week` needs the guard in **two** places, because they answer different questions:

- **offer time** — the event leaves the deck only when *every* hired coach already holds GOALKEEPING (eligibility can ask no more than that);
- **pick time** — a coach who already holds it **cannot be selected in the picker**. This is the load-bearing one: without it, resolving the swap produces `[GOALKEEPING, GOALKEEPING]` and `validateCoach` throws on two distinct specialties (`coach-weekly.ts:173-174`).

**Eligibility, so a targeted event is never a dead card.** `requirementsMet` / `requirementFailure` (`event-selection.ts:200-208`) gains: no coach hired ⇒ `requiresCoach` events leave the deck; no **operational** building of a listed type ⇒ that facility event leaves the deck; no keeper in the squad ⇒ `requiresPlayerRole: 'GK'` leaves the deck. `back-one-drill` additionally requires **both** slots filled, which means it cannot appear before the Coaching Office is built — intended, and stated so it is not read as a bug.

### 9.2 Persistence (`src/persistence/game-state-codec.ts`)

- `PlacedFacility` gains the four optional typed fields from §6.3 — `tpBonusPercent?`, `trainingBonusPercent?`, `recoveryBonus?`, `incomeBonusPercent?`. Absent means 0. Old saves load unchanged. (There is no single `outputBonusPercent`; v1's universal knob was dropped.)
- Coach record `boosts?: {...}` — optional, absent means none. Old saves load unchanged.
- `pendingEvent.selectedCoachRole?: 'HEAD'|'ASSISTANT'` and `selectedFacilityId?: string`, mirroring `selectedPlayerId` / `playerLocked`.
- `GameState.pendingMilestones?: { eventId: string; selectedPlayerId?: string }[]` — the §5.3 queue. New top-level field; `gameStateSchema` is `.passthrough()`, so old saves load with it absent, meaning "nothing pending", and it is seeded once on load per §5.3.6.

Both additions are **optional fields on existing records**, and every relevant codec node is `.passthrough()` (`pendingEventSchema` `game-state-codec.ts:779-791`, buildings `:349-361`, `coachCandidateSchema` `:1019-1037`), so this is genuinely not a breaking save change. (Per `save-migrations-deferred`, breaking saves is acceptable in development anyway — this design does not need to.)

**A carried target can vanish between chapters.** `offerCareerEvent` already silently drops a carried player who has left the club (`career-events.ts:276-286`). The same rule extends to both new target kinds: a coach fired, or a facility closed, between part 1 and part 2 means the sequel is not offered at all rather than offered against a target that no longer exists.

**Application path for every new effect — stated, not left to the implementer:**

| Effect | Goes through |
|---|---|
| `statDeltaSessions` | `pathForAttribute(attribute)` → `resolveTrainingDrillForPath(state, pathId)` → `sessions × drill.gains[attribute]` → the negative floor below → the existing `statDelta` clamp (`career-events.ts:444-453`). **Base gain only**; never `applyInstantGrowthModifiers`. `pathForAttribute` is **not an exported symbol today** — implement it as a one-liner over `TRAINING_PATHS` (`training-paths.ts:37`), which is one-to-one, rather than reaching for `trainingFacilityType` |
| `loyalty` | `adjustLoyalty` / `playerLoyalty` (`src/game/loyalty.ts`). `player.loyalty` is **optional** (`types.ts:130`, and its own comment forbids touching the field directly) and `undefined` means "initial loyalty" — a raw write destroys that distinction |
| `condition` | optional too (`types.ts:124`); default before adjusting exactly as `player-requests.ts:479` does — `(player.condition ?? 100)` |
| `fame` | `player.fame`, clamped to `FAME_CEILING` (`pyramid.ts:193`) |
| `coachBoost.training` | summed into the scale in `careerCoachTrainingModifiers`, then clamped by the §6.2 rule before `applyCareerCoachTrainingModifier` sees it |
| `coachBoost.tp` | `careerCoachWeeklyTrainingPoints` (`coach-weekly.ts:76-87`) |
| `coachBoost.motivator` | `coachMotivatorStrengthHalfLevels` (`coach-weekly.ts:26-39`) — integer half-levels |
| facility effects | the four aggregators named in §6.3 |

### 9.2b The audit harness is not optional

`src/audit/club-business-long-career-harness.ts` **duplicates `resolveContentEvent` wholesale** (≈lines 627-756), including the `requiresPlayer` gate, effect application and follow-up handling. It is the only instrument in the repo that actually plays story events across a long career — the CI balance rails are sim-side and never touch this feature.

Left untouched it would silently ignore every new effect type and never select a coach or facility target, and it would still go green. That is the "harness passes while measuring nothing" trap this repo has hit before. The plan must:

1. update the harness's event application to cover all new effect types and all three target kinds,
2. state what it must exercise (at minimum: one of each target kind resolved, caps hit, the milestone lane drained), and
3. treat §7's balance claim as **unverified until the harness reports it** — "the CI balance harness passes unchanged" is close to vacuous for this feature on its own.

### 9.3 UI (`src/ui/screens/StoryEventScreen.tsx`)

- **COACH INVOLVED** card, same shape as PLAYER INVOLVED. Once selected it shows, as the owner asked, **what the coach actually provides**: name, role, level, both specialty chips, `+X% training on <specialties>`, `+N TP/week`, Motivator line if held, and any existing boosts as a separate `+X% (earned)` line so the story's effect is legible next time.
- **FACILITY INVOLVED** card: name, level, operational status, current effect line (reuse `facilityEffectLabel`, `view-models.ts:1078-1116`) and whichever of the four typed bonuses is non-zero, worded as the effect it changes ("+8% training", "+2 recovery"), never as a raw field.
- Both reuse the picker interaction, the disabled-until-chosen rule, and the a11y label pattern already written for players.
- The reward strip (`eventRewardItems`, `view-models.ts:3561`) gains rows for the new effects. Per `never-show-the-player-a-penalty`, a loss is phrased as what happened to the target ("Two weeks out", "The mix came up patchy"), never as "−8%".

---

## 10. Testing

| Area | Test |
|---|---|
| Content gate | every new rule in §9.1, one failing fixture each |
| Caps | applying +5% training six times lands on +10, not +30 |
| Facility scaling | a −10% gym on a club with no gym leaves the multiplier at exactly 1.0 |
| Injury | `max(current, weeks)` — a 1-week event cannot shorten a 4-week absence |
| Duplicate effects | two `statDelta` — or two `statDeltaSessions` on the same attribute — in one outcome **fails the content gate**; the engine never sums |
| Operational check | a facility event cannot fire at a building under construction |
| Chains | the sequel inherits and locks the same target |
| Milestones | never appear as a follow-up of another event; offered as their own card on the next desk-clear week, in `CAREER_MILESTONES` order, carrying no target — except `milestone-hat-trick`, which carries the actual scorer, locked |
| Dry counter | resolving a milestone does **not** zero `weeksWithoutEvent` — pinned in `store.ts` **and** in the audit harness's mirror of it, because both zero it unconditionally today |
| Coach scale bounds | an L5+L5 shared-specialty pair plus a positive boost clamps to 175 and does **not** throw; an L1 assistant plus a −10 boost clamps to 100 and does not throw |
| Vanished targets | a sequel whose carried coach was fired, or whose carried facility was closed, is not offered |
| Hat-trick detection | a settled week where one player scored 3 enqueues the milestone **with that scorer**; the same result via Quick Result enqueues it identically |
| `squadMorale` migration | no event in the shipped catalog carries a `morale` effect without `requiresPlayer` — the implicit fallback is gone and the gate rejects its return |
| Any-facility dispatch | `volunteer-work-party` on a dorm applies **+3 recovery**, on a fan shop **+10% income**, on the pitch **+10% pitch TP** |
| Specialty swap | a coach already holding GOALKEEPING is **not selectable in the picker** (offer-time eligibility only hides the card when *every* coach holds it); a swap always replaces the second specialty; no swap can produce two identical specialties |
| Button copy | "Continue the story" appears only when the resolved outcome authored a `nextEventId` |
| Balance | `src/audit/club-business-long-career-harness.ts`, updated per §9.2b, run before and after with both numbers reported — the sim-side CI rails do not exercise this feature |
| i18n | gates 1–10 across seven locales |
| Sessions resolution | an outfield 3-session win is +12 at tier 1 and +66 at tier 5; the **same authored sessions on REF are +6 and +33**, because `keeper-drills` is half — the test that catches a hardcoded ladder |
| Negative floor | a −1-session loss on a 35-PAC youth takes 8, not 22; on an 88-SHO senior it takes the full 22 |
| Determinism | same seed + same choices ⇒ identical career, with the new effects applied |

## 11. Open questions — and the default if they go unanswered

Both auditors recommended shipping the defaults below rather than blocking on them; the plan adopts each unless the owner says otherwise.


1. ~~Coach boosts leave with the coach~~ — **closed**: both auditors read it as a clean, intentional rule. Firing a boosted coach to hire a higher-level one stays a real trade-off.
2. **`the-penalty-gauntlet` needs `requiresPlayerRole: 'GK'`.** Worth the schema addition for one event, or re-write it as an outfield story? · *Default: keep the schema addition — the picker filter it implies is reusable.*
3. **`back-one-drill` requires both slots filled**, so it cannot fire before the Coaching Office is built. Acceptable, or should it degrade to a single-coach story? · *Default: keep the both-coaches gate.*
4. ~~Facility output percent as one knob~~ — **resolved in v2**: four typed effects, medical bay and youth field dropped as targets (§6.3).
5. **25 openers vs 21 kept** puts targeted events at just over half the deck. Is 4–5 targeted events a season enough for the mechanic to be noticed, or should rarity weights favour them in the first two seasons? · *Default: even weighting at launch, measured by the harness before any tilt.*
6. **Session rewards use the base drill gain, not the player's actual gain.** A club with 2× facilities and a level-5 specialist gets nearer 1.5 of its own sessions from a "3-session" reward. Deliberate — the alternative compounds with every other investment — but it is the one place the wording and the arithmetic differ, so name it or reword the cards.
7. **`milestone-heavy-defeat` can fire in a career's worst week**, on top of the board's own reaction to a thrashing. Is that piling on, or is that the point? · *Default: ship as written — both auditors read it as a real design choice, not a hole.*
