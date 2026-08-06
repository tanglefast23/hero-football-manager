# Contract renewal audit and repair plan

Status: IMPLEMENTED 2026-08-06. Branch `claude/contract-renewal-audit-1be55f`.

Council: Codex (gpt-5.6-sol max), Claude Fable 5 (xhigh), Grok — two rounds.
Round 1: all three REVISE. Round 2: Grok APPROVED; Codex and Fable each returned narrow
required changes, all of which are applied above. The loop was stopped at two rounds rather
than three: every round-2 item was either a factual correction verified directly against
source (the x4-versus-License conflation, the absent walk-away message, `licensed`
preservation, the completion-path cap recheck) or a judgement already settled 2-1, so a
third round would have confirmed rather than discovered. The round-2 amendments are
therefore applied but not re-reviewed — flagged here rather than presented as unanimous
sign-off.

The end-of-season contract renewal was audited on 2026-08-06 by a main pass plus an
adversarial subagent. All 66 existing tests in the area pass, so every defect below is
an untested gap rather than a regression. Findings are merged and de-duplicated; each
was read end to end in source, and the ones marked *reproduced* were run.

## 1. What the feature is

At `phase === 'season-end'`, `seasonEndViewModel` (`src/application/view-models.ts:1049-1225`)
builds an id-ordered queue of user-club players with `contractSeasonsRemaining === 0`
who are not retiring. `canContinue` is false until the queue is empty, so the season
cannot roll over while a contract is unresolved.

For the queue head the screen offers two moves: open talks (`beginCareerRenewalTalks`)
or release (`releaseCareerPlayer`). Talks run the shared negotiation engine from
`src/game/market.ts`: a hidden weekly ask, up to three rounds, one promise per offer,
and an optional one-use pitch card from a dealt hand of three.

Pricing (`renewalContractAsk`, `market.ts:493`):

```
ask = wage
    × (1 + growthSinceSigning%)   // 0..300
    × (1 + fame%)                 // fame/4, capped 100
    × (1 + loyalty%)              // (50 − loyalty) × 0.4, signed, −20..20
    × personality                 // GREEDY 1.2, LOYAL 0.9, else 1.0
    × 4                           // any powered player not yet on a hero wage
// NOTE: the x4 condition is `power !== undefined && !onHeroWage` (market.ts:526).
// Licensing is irrelevant to it. The Hero LICENSE check is a different condition
// entirely -- `power !== undefined && !licensed` (contract-promises.ts:45) -- and the
// two must not be conflated, as an earlier draft of this plan did.
```

The offer is judged by `contractOfferValue` (`market.ts:585`), which scales the wage by
`(termSeasons − 1) × 3%` plus a promise percentage, against an ask that pitch cards move
by at most ±20%. Acceptance is `effectiveOffer >= effectiveAsk`. An offer below half the
*raw* ask is an insult and ends talks.

## 2. Findings

### P1-1 An insulting renewal offer throws a raw internal error and the penalty never lands *(reproduced)*

> **Fixed independently on `main` in #90** (2026-08-06), found in a live playtest with the
> same diagnosis. This branch keeps `main`'s `careerSquadNegotiationTarget` and dropped its
> own duplicate helper on rebase; the regression tests from both sides are retained, since
> they cover different halves (that the penalty lands, and that it lands exactly once).
> Two independent discoveries of the same defect within a day is itself the finding: the
> only reason it survived that long is that 66 green tests never exercised the reject path.


`applyCareerNegotiationConsequence` (`src/game/market-career.ts:156-190`) resolves the
player through `careerTransferTarget` (`market-career.ts:992-1020`), which matches only
`candidate.clubId !== state.userClubId` and explicitly skips the user club in the pyramid
loop. A renewal target is always on the user club, so it returns `undefined` and line 167
throws.

`store.submitRenewalOffer` (`src/application/store.ts:1947`) calls it on every
non-accepted round. `guarded()` catches the throw and renders `error.message` verbatim,
so the player sees:

> unknown negotiation player bramble-rovers-p12

Because `set()` is never reached, the whole round is rolled back: the round counter does
not advance, status stays `OPEN`, and the −10 morale / −2 club-fame consequence
(`market.ts:672`) never applies. The panel's own copy — "An offer below half their ask
ends talks immediately" — is false for renewals. The transfer path shares the code and is
correct, which is why no test caught it.

Reproduced on a real career: `ask 76, offered 37 → INSULTED, consequence
{moraleDelta:-10, clubFameDelta:-2}`, then `applyCareerNegotiationConsequence(…,
'renewal')` throws `unknown negotiation player …`.

Secondary consequence: because the round is never consumed, this is a free
"would that have been accepted?" probe.

### P1-2 The panel's default opening offer is always an insult for a hero *(reproduced)*

`initialWeeklyWage` falls back to `openingWeeklyWage` (`market-view-model.ts:558`), which
`seasonEndViewModel` sets to the player's *current* wage (`view-models.ts:1217`). For an
powered player not yet on a hero wage the ask is at minimum `wage × 2.88` (×4, best case
0.8 loyalty × 0.9 LOYAL),
so half the ask always exceeds the current wage. Verified across 36 loyalty × growth × fame
combinations: all 36 return `INSULTED` on round one.

Combined with P1-1 this is the first renewal a new player ever sees — the crafted
onboarding hero — breaking on the first tap. The wage step is 50, so a realistic hero ask
of ~1,160 from 180 needs 20 taps of "+" with no accelerator and no "match the ask" action.

### P1-3 Term and promise silently reset on every negotiation round

The draft reset effect (`src/ui/screens/MarketScreen.tsx:796-804`) lists `roundLabel` in
its dependency array. `roundLabel` changes "Round 1 of 3" → "Round 2 of 3"
(`market-view-model.ts:537`), so after each counter-offer the effect re-runs
`setTermSeasons(min(2, maxTerm))` and `setPerk('GUARANTEED_STARTER')`. Its own comment says
the reset is meant to fire with the *target*, not the round.

Pick "3 years / Shirt #10", take a counter, raise the wage, offer again, and you sign a
2-year Guaranteed Starter deal you never chose — binding for the whole contract
(`contract-promises.ts:165-189` rejects any lineup that drops him) and it consumes a Hero
License.

### P1-4 An accepted renewal is discarded when the Hero License cap is full

`completeCareerRenewal` calls `applyCareerContractPromise` (`market-career.ts:606`), which
throws at `contract-promises.ts:52-54` when a starting promise for an unlicensed hero has
no free License. This runs *after* `submitContractOffer` already returned `ACCEPTED`, so
`guarded()` discards the agreed deal. The panel still reads "Round 1 of 3". Made much more
likely by P1-3, since the silently restored default is `GUARANTEED_STARTER`.

### P1-5 The headline wage is not the wage the agent asks for

Before talks open the card shows `renewalQuote(expiredPlayer, 4)` (`view-models.ts:1192`),
which is `progression.ts:97-99` — the current wage, or ×4 for a hero cliff, and nothing
else. On tapping "Meet the agent" the number becomes `renewalContractAsk`, which also
applies growth, fame, loyalty and personality.

Measured on unmodified squads: 13%, 20% and 24% low across three seeds; +56% with 40%
growth and fame 120; 720 shown against 1,160 real on a typical hero. This is the number the
manager uses to decide renew-versus-release.

### P1-6 Two permanently broken but fully enabled "Meet the agent" states

`SeasonEndScreen.tsx:349-369` renders and enables the button whenever
`renewalNegotiation === undefined`. Two states make it always throw:

- After "Close agent file", `closeCareerRenewalTalks` records the abandoned id and
  `beginCareerRenewalTalks` throws (`market-career.ts:522-524`): *"That agent has ended
  talks for this season. Renew or release at the next contract."* The copy is wrong —
  renewing is exactly what is no longer possible.
- Loyalty below 30 throws (`market-career.ts:530-533`). Reachable: denying player requests
  costs 3–5 loyalty each (`player-requests.ts`) from a 60–75 start.

`expiredContract` carries no loyalty field, so there is no advance signal in either case,
and the queue only ever presents `expiredPlayers[0]`, so a stuck head blocks everyone
behind him. Release remains available, so neither is a softlock.

### P2-7 A three-round walk-away has no penalty *(downgraded — partly misdiagnosed)*

Round-1 review corrected this. The walk-away **is** surfaced: `outcomeLabel`
(`market-view-model.ts:577`) renders "Three rounds passed. The agent walked." inline in
the panel. What is missing is the store-level message: `store.ts:1949-1954` gates it on
`consequence.market !== negotiated`, which is true only for an insult, so a three-round
walk-away sets `error: null` and produces **no** global message at all. The only message
that channel ever emits is the insult one — and it emits it on the `error` channel while
describing a penalty, which is the wrong channel for both cases.

Corrected in round 2: an earlier draft of this plan claimed the walk-away message existed
and was merely misrouted. It does not exist.

The fix is outcome-specific messaging: a counter gets the existing inline feedback only, a
walk-away gets a notice with no penalty, and an insult gets a warning notice that states the
penalty actually applied.

The absent *penalty* is correct behaviour, not a defect: `docs/06-economy.md:42` assigns
morale and fame damage to insulting offers only. Inventing a walk-away penalty would be an
unapproved balance change with no specified magnitude, and `submitContractOffer` is shared
with transfers, so it would silently repricing transfer walk-aways too.

Reduced to: route the existing message through the right channel. No penalty.

### P2-12 The promotion reward advertises a Hero License the renewal cannot use

Newly found in review. The season-end screen renders the promotion reward panel
(`view-models.ts:1068-1074`) announcing the new division's unlocks, but
`contractPromiseHeroLimit` (`contract-promises.ts:265-274`) reads `highestDivisionReached`,
which is `Math.min(currentUserDivision, recorded)` (`promotion-progression.ts:110-113`) —
and promotion is not applied to `m2` until `startNextSeason`, after renewals run. So a club
promoted to D3 is told two panels above that it has earned a third License, then renews
against a cap of 2.

The renewed contract begins next season, when the License exists, so the projected cap is
the correct one to negotiate against.

### P2-13 Exclusive promises are unguarded across the expiry queue

Newly found in review. Captaincy and Shirt #10 are single-holder roles, but nothing stops
two players in the same queue each being promised them. The second silently strips the
first (`contract-promises.ts:79-80`), leaving an active, permanently unhonourable promise
on the first player's contract. Multiple concurrent `TRAINING_PRIORITY` debts have no
defined ordering either.

Starting-XI promises are already fail-soft (enforcement caps at 1 GK + 10 outfield in
seniority order, `contract-promises.ts:181-184`), so those need no new work.

### P2-14 There is no way to leave open talks without spending rounds

Newly found in review. Once talks are open the panel offers only "Make the offer". The
only exits are exhausting three rounds or deliberately insulting the agent. "Close agent
file" appears only after the negotiation has already ended.

### P2-8 Whole branches of the season-end screen are dead code

`view-models.ts:1202-1203` hardcodes `decision: 'pending'` and `requiresNegotiation: true`.
Unreachable as a result: the term picker and "Renew deal" button
(`SeasonEndScreen.tsx:303-348`), the `shortTermReason` line, the "Renewed / Next wage"
metrics (`:370-375`), `onSelectContractTerm` / `onRenewContract` (`App.tsx:1872-1873`),
`store.setContractTerm`, the whole `store.renewPlayer` action (`store.ts:1885-1917`) and
the `selectedContractTerm` slice. `StatusChip label={contract.decision}` (`:266`) is a
permanently red PENDING chip that never flips.

The cost is not tidiness: **there is no way to simply accept the asking price.** Four
expired squad players means four three-round negotiations.

### P2-9 Promise side effects fire silently and the copy describes none of them

`market-view-model.ts:165-170` is the entire user-facing description of the four promises.
What actually happens (`contract-promises.ts`):

| Promise | Copy today | Actual consequence |
|---|---|---|
| Starter | "A place in the first XI." | Lineup edits that drop him are refused for the whole contract; consumes a Hero License if he is an unlicensed hero |
| Captaincy | "The armband and the room." | Strips the armband from the current captain, unnamed and unannounced; also consumes a License |
| Training | "First call on focus drills." | Blocks every other player's drills until 5 drills are spent on him (`training.ts:188-194`) |
| Shirt #10 | "The famous number." | Wipes the #10 off whoever currently wears it |

### P2-10 Renewals normally land under the quoted ask

`contractOfferValue` inflates the offer by term and promise, and pitch cards cut the ask by
up to 20%. Measured floor with 3 years + Starter and no card: 92% of ask (true floor ~86% at
that granularity); with two loved cards, ≈69%. The marquee hero wage cliff is negotiable
from ×4 down to about ×2.8. Flagged as a design question, not a defect: the "Weekly wage
request" headline is a ceiling, not a price, and nothing says so.

### P3-11 Clarity gaps

- `moodFace` (`ಠ_ಠ / >_< / •_• / ^_^ / ★_★`) is computed at `market-view-model.ts:566`,
  typed at `market-models.ts:166`, and rendered by nothing.
- Pitch card affinity is hidden before play. Personality is shown, the loved/hated mapping
  is not, and a hated card is +10% and one of three rounds.
- `pitchLeverageLabel` states a percentage while no number on screen moves; it applies to a
  hidden `effectiveAsk`.
- Loyalty appears in no tip and no glossary entry, yet below 30 it blocks renewal at any
  price. The only explanation is an InfoTip on the squad card.
- No dev-harness entry exists for the renewal screen.

## 3. What holds up

Stated because it bounds the work.

- **No softlock exists.** `releaseCareerPlayer` (`squad.ts:379-453`) is fail-soft: with no
  roster cover it fabricates a role-correct emergency youth rather than refusing. "Let
  player leave" renders in both live branches. Every dead end above still reaches
  `canContinue`.
- **Save/load is clean.** A mid-negotiation career round-trips byte-identically, including
  history records, `abandonedRenewalNegotiationIds`, `contractPromise`, `loyalty` and
  `priorityDrillsRemaining`. The codec rejects talks referencing a non-user-club player.
- **The hero ×4 does not compound.** `completeCareerRenewal` sets `onHeroWage`, so the
  second renewal prices off the signed wage (measured ask1 304 → signed 304 → ask2 260).
- **Pitch-card farming is closed**, terms never exceed the career, and there is no payroll
  drift or negative-wage path.

## 4. Decisions taken

Round-1 council: Codex (gpt-5.6-sol max), Claude Fable 5 (xhigh), Grok. All three returned
REVISE. Both decisions survive, one of them rescoped.

**D1 — Promise strength is shown as a letter grade plus an adjective.** Owner's choice,
picked over a raw percentage and over a score out of 100. Rendered `A · Huge`, `B · Big`,
`C · Solid`, `D · Small`.

Council: Codex "the right owner choice", Fable "keep it", Grok "wrong instrument, reject".
**Kept, 2-1.** The dissent is not dismissed — all three converged on the *same* underlying
risk, which is that A–D reads as overall quality when A is also the promise that costs the
club the most. The three mitigations below are effectively Grok's counter-proposal folded
into the owner's chosen instrument, so the dissent is answered rather than overruled:

- The column is captioned **"Value to agent"** — the grade rates bargaining pull, never
  desirability to the manager.
- The squad-consequence line (P2-9) sits at equal prominence in the same row, so cost is
  never subordinate to grade.
- Term's invisible 0/3/6% stacking gets one plain line under the term picker
  ("Longer deals sweeten the offer") rather than a second grading system.

Derived, not hand-written: `contractPerkPercent` is exported from `market.ts` and
`contractOfferValue` consumes it. Thresholds (`>=10` A, `>=8` B, `>=6` C, else D) get their
own test — Codex correctly notes that a future rebalance could collapse several promises
into one grade rather than re-grading cleanly, and the test should make that visible.

**D2 — Restore the quick-renew path, as a promise-free transaction.** Owner delegated the
call. Restoring rather than deleting is confirmed by all three reviewers; the *scope* is cut
on a 2-1 council split (Codex and Grok for promise-free, Fable for keeping the promise with
a disclosure line).

The deciding evidence is a defect in the existing code rather than a taste question:
`store.renewPlayer` hard-codes `JERSEY_10` (`store.ts:1904-1910`) under a comment claiming
it has "no squad management consequence", but `JERSEY_10` strips the #10 from its current
wearer (`contract-promises.ts:70-80`). Several quick renewals in one season-end therefore
leave multiple players holding an active #10 promise while only the last actually wears the
shirt. A one-tap button must not do that silently, and disclosing it is worse than not
doing it.

Final shape: **Sign now = full ask + chosen term + no promise.** Promises, pitch cards and
any price below the ask stay in the negotiation. Rationale for no cap and no surcharge
(Codex and Fable agreeing, Grok not objecting): forgoing the 8–31% negotiated discount *is*
the convenience premium, and a second rule would do the same job worse.

Implementation constraint from Codex, adopted: do **not** add a persisted `NONE` perk —
that drags in type, codec, migration and round-trip work. Implement quick sign as a direct
domain transaction that renews wage and term without calling `applyCareerContractPromise`.

**Stale promise revival — mandatory, found in round 2.** Season-end only decrements
`contractSeasonsRemaining` (`career.ts:670-677`); nothing clears `contractPromise`. An
expired player still carries the previous contract's promise object, inert only because
`hasActiveCareerContractPromise` requires `contractSeasonsRemaining > 0`
(`contract-promises.ts:24`). A promise-free quick sign that spreads `...player` and restores
a positive term therefore **revives the old perk** — Hero License claim, lineup lock,
captaincy or #10 semantics, and any leftover `priorityDrillsRemaining`. The negotiated path
is immune only incidentally, because `applyCareerContractPromise` overwrites the field.

**Do not implement this as a parallel transaction.** Round 2 established that the phrase
"a direct domain transaction that renews wage and term" is itself a trap: an implementer
following it literally ships two defects.

- **The gates disappear.** The old `renewPlayer` inherited four checks from
  `beginCareerRenewalTalks` (`market-career.ts:520-533`): season-end phase, no concurrent
  talks, the abandoned-agent season lock, and the loyalty < 30 refusal. A standalone
  transaction skips all four — most seriously making a player who "will not re-sign at any
  price" signable in one tap. `renewalBlockedReason` disabling the button is UI, not the
  invariant.
- **The stale promise revives**, as above.

Correct shape: extract `completeCareerRenewal`'s core into a shared function taking
`perk?: ContractPerk`, and implement quick sign as a `market-career.ts` function that runs
the same four gates, prices through the same `careerRenewalWeeklyAsk` helper, and calls that
core with no perk. Not a second path that can drift.

The core must clear `contractPromise` and zero `priorityDrillsRemaining` when no perk is
given, and must **not** reuse `clearCareerContractPromise` (`contract-promises.ts:199-207`)
to do it — that helper also strips `isCaptain` and `shirtNumber`, which would silently
demote a re-signed captain. Only the binding promise ends; the armband stays.

`licensed` must also be preserved. It is a separate squad assignment, not a property of the
promise, and clearing it here would silently bench a hero (`buildTeamDef` refuses a lineup
containing an unlicensed powered player).

Everything else carries over verbatim: `weeklyWage`, `contractSeasonsRemaining`,
`onHeroWage`, `signingStatTotal`, `transferRequested: false`, the `checkedAdd` payroll
delta, and `assertContractTermFitsCareer`.

Tests: quick sign refuses a loyalty-blocked player and an abandoned-agent player; an expired
player still holding a prior `GUARANTEED_STARTER` or an unfinished `TRAINING_PRIORITY` debt
ends with no active promise and no revived debt; a re-signed captain keeps the armband.

Also corrected: D2 was previously justified partly as "bypasses P1-1 and P1-4". All three
reviewers rejected that framing. It is a convenience path, not a mitigation; the negotiation
bugs are fixed on their own merits.

### Design changes requiring owner sign-off

Two items below change canon rather than repair it, and are called out rather than absorbed:

- **The renewal ask becomes public before talks (P1-5 + D2).** `docs/06-economy.md:38`
  makes the ask hidden, and `market-view-model.test.ts:236` protects that behaviour by
  name. The asymmetry is defensible — a manager plausibly knows what their own player
  wants, and does not know what a stranger at another club wants — but it is a documented
  design change: doc 06 and the README decision log must be updated, and the existing test's
  scope narrowed to transfers rather than deleted.
- **Signed hero wages bottom out at ×1.99**, not the ×2.8 first reported, against doc 06's
  advertised ×3–5 (P2-10). The correction came from measuring rather than reasoning: the
  hero ×4 is not the only multiplier, and loyalty (−20% at maximum) plus a LOYAL
  personality (−10%) cut the ask *before* term, promise and pitch cards cut it again —
  `4 × 0.8 × 0.9 × (0.8 / 1.16) ≈ 1.99`. Reaching it needs a hero with no growth and no
  fame since signing plus two loved cards; any real development returns the multiple above
  ×2.5.

  **RESOLVED — owner accepted ×1.99, no floor** (2026-08-06). A loyal, well-managed hero
  being cheap to keep rewards the manager who kept him loyal and played the cards well.
  ×4 stays the price of convenience and of negotiating badly, so the cliff still bites
  anyone who does not work at it, and ×3–5 is now documented as describing the *ask*
  rather than the signed wage. `hero-renewal-floor.test.ts` pins the floor against silent
  drift; the balance rail remains the right instrument before any future retune.

## 5. Proposed changes

Re-sequenced on unanimous council advice: domain first, UI last, and the defect set ships
together rather than as independently releasable slices. The reason is R1 below.

**R1 — the release gate.** Fixing P1-1 *arms* the insult penalty that currently throws and
rolls back harmlessly. Until P1-2 is also fixed, the panel's default opening offer is a
guaranteed insult, so step 1 alone would convert a harmless error into −10 morale, −2 club
fame and a season-long renewal lock on the onboarding hero. **P1-1 and P1-2 must land in the
same release.** All three reviewers raised this independently; it was the plan's worst hole.

1. **Central helpers and failing tests first.** Extract the ask computation out of
   `beginCareerRenewalTalks` as `careerRenewalWeeklyAsk`; add a projected renewal Hero
   License cap helper (P2-12) used by both UI and domain; add a promise-availability helper.
   Write the failing tests before the fixes.
2. **Fix P1-1 and P1-2 together.** Resolve a renewal's player from the user club instead of
   `careerTransferTarget`. Seed the panel's opening wage **derived from** the ask — roughly
   70% of it, rounded to the wage step, safely above the insult line at half — plus a
   "Use opening ask" control and a hold-to-repeat stepper accelerator.

   The control is named "Use opening ask", not "Match the ask": once a hated pitch card has
   raised `pitchInfluencePercent`, the raw opening ask is no longer what the agent currently
   requires (`market.ts:632`), so a button promising to "match" would lie.

   *Not* seeded at the ask itself. Reviewers split here and the safer reading won: seeding
   at the ask makes the panel's primary button an instant full-price accept that also
   attaches whatever promise the draft defaults to, so one mis-tap signs at list price *and*
   spends a Hero License — strictly worse than Sign now rather than a duplicate of it. A 70%
   seed cannot accept even with a loved card on round one (0.70 × 1.16 = 0.81, against a
   0.90 effective-ask floor after one −10% card), so "Make the offer" keeps meaning
   *negotiate* while Sign now remains the only one-tap accept. The test asserts the
   invariant — strictly above half-ask, strictly below round-one acceptance — rather than
   the constant, so retuning the seed cannot silently reintroduce either trap.

   The seed rule is not hero-only: a maxed-growth, famous, GREEDY non-hero's ask reaches
   ~9.6× wage, so the current-wage seed insults there too. Tests: an insulting renewal
   applies −10 morale / −2 club fame exactly once and moves to `REJECTED`; the default
   opening offer is never an insult, covering both a powered player off hero wage and an
   extreme-growth non-hero; and the default offer never auto-accepts.
3. **Promise invariants in the domain (P1-4, P2-12, P2-13).** Reject an unfulfillable perk
   at *offer submit* so an ACCEPTED negotiation can never fail to complete — UI disabling is
   not the invariant. Scope the License check to powered-and-unlicensed players only, use
   the projected cap, cover the transfer path (`market-career.ts:505` has the identical
   accept-then-throw), and guard Captaincy / Shirt #10 against a second concurrent holder.
   The projected cap must reach `applyCareerContractPromise` itself, which re-checks
   capacity at completion (`contract-promises.ts:45-55`) — validating only at offer submit
   would leave the completion path throwing against the old cap, which is the P1-4 bug
   again one layer down. Projection also has to count both sides: exclude licensed players
   already known to retire at the imminent transition, and keep counting unresolved expired
   players until they are actually released.
   Also block knowingly impossible starting-XI promises before a round is consumed — a
   second promised goalkeeper, or an eleventh promised outfielder. The existing fail-soft
   (`contract-promises.ts:219-223`) stays for legacy and corrupt saves, but newly recording
   a promise the game cannot honour is a defect rather than a graceful degradation.
   Default the draft promise to a legal one when Starter is unavailable.
   Concurrent `TRAINING_PRIORITY` needs a stated policy: `pendingTrainingPriorityHolder`
   picks with `.find()` (`contract-promises.ts:118`), so today a second debt resolves in
   array order rather than by any rule. Hard-block a second active training debt at offer
   submit, for symmetry with Captaincy and #10. Scarcity is surfaced on the queue head with
   a reason naming the current holder; id order stays the documented tie-break and queue
   navigation is explicitly not built in this repair.
   Existing saves carrying an already-stranded Captaincy or #10 promise are left alone —
   healing them needs a product policy (void, compensate, reassign) this plan should not
   invent, and 1–3 season contracts age the strands out.
4. **Draft lifecycle (P1-3).** Three distinct transitions, not one effect:
   - negotiation `id` changes → initialise the whole draft for the new target;
   - `round` changes → **preserve** term and promise, refresh the suggested wage, clear only
     the spent pitch card (keeping it re-submits a used card and the engine throws,
     `market.ts:627`);
   - remount after save/load → restore term and promise from
     `negotiation.history.at(-1)?.offer` rather than defaults.
   Never key on display text such as `roundLabel`. `useContractDraft` is shared with the
   transfer screen (`MarketScreen.tsx:150`), so both paths are covered by these tests.
5. **View models (P1-5, P1-6, P2-8, P2-10).** Real ask as `quotedWeeklyWage`, relabelled
   "Agent's opening ask" with a line saying term, promises and pitch cards can close it
   lower. Replace `decision` / `requiresNegotiation` with `renewalBlockedReason`. Fix the
   wrong engine copy at `market-career.ts:523`.
6. **Rebuild the pending branch, and land D1 and D2.** One pending state: the ask, a term
   picker, **Sign now**, **Meet the agent ▸**, **Let player leave**, with both renew actions
   disabled and the reason shown when blocked. Full-width promise rows carrying grade and
   consequence under a "Value to agent" caption. Quick sign gets tap guarding, a success
   notice, term reset and queue feedback to match the negotiated path
   (`store.ts:1940-1942`). Update the dev-harness entries that pass the deleted props
   (`promotion-transition.tsx:173`, `club-business.tsx:169`).
7. **Docs and canon.** `docs/06-economy.md` for the visible ask and Sign now, README
   decision log, narrow the hidden-ask test to transfers, glossary entry for loyalty.
8. **Polish.** P2-7 channel fix (no penalty), `moodFace` rendering with an accessible
   non-kaomoji label, pitch-card affinity hint, and a renewal dev-harness entry.

### "End talks" (P2-14) — specified

An unlabelled close is a trap in both directions, so the semantics are fixed here rather
than left to implementation.

Reusing `closeCareerRenewalTalks` records the abandoned id and locks renewal for the season
(`market-career.ts:616-631`) — far too harsh for a "let me think" tap. But clearing
`renewalTalks` *without* recording the id is worse: the negotiation is keyed on a
season-stable id, so reopening deals the identical ask and cards with the round counter back
at zero, turning the three-round limit into unlimited rounds.

Therefore: **suspend and resume.** The action collapses the panel without touching the
negotiation record, so rounds, mood, pitch influence and spent cards all persist and
reopening continues the same conversation. The queue head stays pinned, which costs nothing
— the head must be resolved before the season rolls over regardless.

One consequence for step 3: quick sign's "no concurrent talks" gate must **supersede** rather
than throw when the open talks belong to the same player. Signing at the ask is a deliberate
end to that negotiation, so it closes the record and completes. Talks belonging to a
different player still throw.

A separate, explicitly confirmed "walk away for the season" may be offered later; it is not
in this repair.

### Carried-over UI hazard

`SeasonEndScreen.tsx:317` — inside the dead branch being resurrected — uses a function-form
`style` on a `Pressable`. That pattern renders zero-height and untappable on iOS only, and
has already broken this repo twice. It was never device-tested because the branch never
rendered. Step 6 must convert it to a static style, and the rebuilt branch needs device QA
rather than browser-pane QA alone.

### Advisory

The submit-time perk guard needs `GameState`, so `submitCareerRenewalOffer`
(`market-career.ts:561-574`) and its transfer twin both change signature. Small, but the new
tests target that seam.

Non-negotiables: `src/game` stays pure TypeScript, no RN/Expo imports, no `Math.random` or
`Date.now`; balance-harness assertions stay green; nothing touches `src/sim`, so
`ENGINE_VERSION` does not move. No save migration is needed provided quick sign is a direct
no-promise transaction and every new UI field stays derived; an open negotiation's stored
`weeklyAsk` must be preserved on load, never recomputed.

### Checked and deliberately out of scope

- **Board ultimatum / forced sale.** Candidates require `contractSeasonsRemaining > 0`
  (`board-ultimatum.ts:101`), so an expired player can never be force-sold, and
  `releaseCareerPlayer` already reconciles the candidate list (`squad.ts:424`). A regression
  test for renew-and-release under an active ultimatum is cheap insurance; no fix needed.
- **Competing starting-XI promises.** Already fail-soft: enforcement caps at 1 GK + 10
  outfield in seniority order and an overcommitted promise is left unhonoured rather than
  deadlocking (`contract-promises.ts:181-184, 219-223`).
- **Narrowing the negotiated discount** (P2-10) — balance work, gated behind the proposed
  rail, not part of a correctness repair.

## 6. Round-2 questions

1. **D2 shape.** Quick sign is now a promise-free direct transaction. Does skipping
   `applyCareerContractPromise` entirely leave any invariant unmet that the negotiated path
   satisfies — `onHeroWage`, `signingStatTotal`, `transferRequested`, payroll — or is
   omitting only the promise genuinely sufficient?
2. **Projected License cap (P2-12).** Using the post-promotion cap at season end is a real
   behaviour change: the contract starts next season, and the screen already advertises the
   reward. Fable judged the current conservative behaviour defensible; Codex judged the
   projected cap correct. Adopted Codex's reading — is that right, and does any other
   consumer of `highestDivisionReached` need the same projection for consistency?
3. **Exclusive promises (P2-13).** Blocking a second Captaincy or #10 promise is proposed as
   a hard rejection at offer submit. Should an existing holder's promise instead be
   transferable with explicit confirmation, and what happens to a promise already stranded
   in an existing save?
4. **Step 2 scope.** P1-1 and P1-2 must ship together. Is the "Match the ask" control enough
   to make the negotiation path usable, or does the opening wage need to seed at the ask
   itself — which would make the first tap an instant accept and arguably duplicate Sign now?
5. **Anything still missed**, particularly around multi-player queues, the arbitrary id
   ordering that decides which of two unlicensed powered players can claim the last License, and
   whether queue navigation should be offered rather than a forced order.
