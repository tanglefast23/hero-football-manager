# Local Advertising Income — design

**Date:** 2026-08-06
**Status:** approved design, ready for planning
**Scope:** one cycle, copy and content only — no economy numbers move

A Division 5 club banks money every fourth week that the game names after a
feature the club does not have yet. The line reads "Chairman sponsor target" on
Chairman and "Monthly sponsor fee" on Cozy. Both names are wrong: the club has
no sponsors, and "Chairman" is a difficulty mode leaking into the club's
fiction. The only place that explains the money at all calls it a "basic
sponsor" and does not appear until Season 3.

This cycle renames that income to something a football fan recognises, states
its cadence in the label, and gives it a glossary entry. Nothing about the
economy moves.

---

## 1. What exists today

The money comes from one fallback branch in `settlementAwards`
(`src/game/career.ts`). Every fourth week — `state.week % 4 === 0`, so weeks 4,
8, 12 … 28, seven payments in a 30-week season — the settlement asks for the
club's monthly sponsor income. When the club holds managed sponsor contracts it
emits one line per sponsor. When it holds none it emits a single flat line:

```ts
label: state.difficulty === 'CHAIRMAN'
  ? 'Chairman sponsor target'
  : 'Monthly sponsor fee',
```

**The gate is `activeContracts.length === 0`, not a division test.** In normal
play that is the never-promoted D5 club — `managedSponsorCapacity` returns 0 for
D5, so `createSeasonSponsorship` builds an empty portfolio and no contract lines
exist — but the two are not the same condition, and a club relegated back to D5
from D4 keeps its capacity and its contracts. Implementers must branch on the
contracts, never on the division. D5's `sponsorMonthlyFee` is 3,000,
and `currentActualMonthlySponsorIncome` scales it by
`difficultyRules(state).sponsorIncomePercent` — 100 on Cozy, 80 on Chairman.

**The amount is therefore a constant while the player can see it: $3,000 on
Cozy, $2,400 on Chairman.** It never scales, because the moment the club reaches
D4 the branch stops running and named sponsor lines replace it.

Three gaps follow:

1. **The names are wrong.** The club has no sponsor, so "sponsor fee" describes
   a feature that unlocks two divisions later. "Chairman" names the difficulty
   mode, not anything in the club's world.
2. **The cadence looks arbitrary.** Four weeks is a month and seven payments are
   a season, but nothing in the UI says "monthly", so weeks 4, 8 and 12 read as
   a rule the player is expected to memorise.
3. **Almost nothing explains the money, and what does arrives two seasons
   late.** The glossary's "Club & competitions" category holds Money, Fans,
   Facility, Upkeep and D5–D1 — no income terms. The only assistant sequence
   that teaches income is `sponsor-desk`, which fires at D4, after this line is
   gone. For Seasons 1 and 2 a D5 club has no sponsorship panel at all:
   `clubSponsorshipViewModel` returns `undefined` when
   `!managed && state.season < 3`.

The word leaks into two further surfaces a D5 player can see. The four-week
forecast in `clubOperatingOutlook` (`src/application/view-models.ts`):

```ts
facts.push('Sponsor payment');                       // weeks 4, 8, 12 …
if (facts.length === 0) facts.push('No match or sponsor payment');
```

And, from Season 3, the unmanaged branch of the Club Buzz panel in
`ClubFinancesScreen.tsx`, which is the one and only place the game ever tells
the player what this money is:

```tsx
<PaperPanel kicker="Basic sponsor" title="The crowd is talking" stamp="LIVE">
  Your basic sponsor pays {formatCurrency(sponsorship.actualMonthlyIncome)} each month.
```

That sentence is the whole explanation: it calls a sponsor that does not exist
"basic", arrives in Season 3, and is buried inside a card about social
following. It does get one thing right — "each month" — which is the framing
this cycle makes consistent everywhere.

## 2. The decision

The income becomes **local advertising** — the anonymous pitchside hoardings a
small club sells to businesses in its town.

This was chosen over unrelated grassroots income (clubhouse bar takings, a
supporters' club cheque) because of what happens at D4. The line does not
persist after promotion; it is replaced by named sponsor lines. Advertising
boards are the thing a sponsor actually buys, so the replacement reads as an
upgrade of one relationship rather than one income silently vanishing and
another appearing. A clubhouse bar that stops paying the week you get promoted
would be a new hole, not a fix.

Making the D5 income survive promotion and stack with sponsors was rejected: it
hands every D4+ club extra money every month, which moves the promotion economy
and the balance-harness assertions for a copy problem.

## 3. What changes

Every surface that says "sponsor" to a Division 5 club, and its disposition:

| Surface | Seen by | Disposition |
|---|---|---|
| Settlement ledger label | D5, every 4th week | Rename (§3.1) |
| Four-week outlook facts | D5, always | Branch on contracts (§3.2) |
| `Match, sponsor & prize` metric | D5, always | Reword neutrally (§3.3) |
| Empty-ledger docket copy | D5, before first settlement | Reword neutrally (§3.3) |
| Club Buzz panel, unmanaged branch | D5, Season 3+ | Rename (§3.4) |
| Buzz payout card + Bert sequence | D5 **and D4+**, Season 3+ | Drop the actor (§3.5) |
| Glossary | Anyone who looks | New entry (§3.6) |
| Onboarding "get sponsors" | Season 1 intro | **Out of scope** (§3.7) |
| Random `category: "sponsor"` events | Any division | **Out of scope** (§3.7) |

Two of these are shared with D4+ clubs, where "sponsor" is the correct word.
Those are reworded to drop the actor rather than branched, so one string stays
true at every division — see §3.5.

### 3.1 The settlement label

The Cozy/Chairman split collapses to one label for both modes:

```
Local advertising (monthly)
```

Chairman players see $2,400 where Cozy players see $3,000. They never see the
other mode's number, so the smaller figure needs no in-fiction excuse, and the
difficulty stops being named in the club's ledger.

"Revenue" is deliberately absent. The panel is titled MATCH STATEMENT and every
row in it is money, so the word carries no information. `(monthly)` stays
parenthesised so it reads as a schedule note rather than part of the name.

Neither label row sets a line clamp, so long labels wrap rather than clip:
`PostMatchSummaryModal` uses `<Text className="flex-1 text-base text-ink">`,
while `ClubFinancesScreen` puts the flex on the wrapping `View` and renders
`<Text className="text-base text-ink">`. At 27 characters the label fits one
line at default text size and wraps gracefully at large iOS text sizes.

### 3.2 The outlook copy

`clubOperatingOutlook` gains the same `managed` test the sponsorship view model
already uses — `state.clubBusiness.sponsorship.activeContracts.length > 0` — and
branches its two fact strings on it:

| Condition | Payment week | Quiet week |
|---|---|---|
| No contracts (D5) | `Advertising payment` | `No match or advertising payment` |
| Managed contracts (D4+) | `Sponsor payment` | `No match or sponsor payment` |

D4+ clubs keep the existing strings, which are correct for them.

These facts are per-week rows in a week-by-week forecast, so they deliberately
omit `(monthly)` — the cadence is already visible in the column beside them.
Only the ledger label, which appears alone with no schedule around it, carries
the parenthetical.

### 3.3 The Club Finances chrome

Two strings on the Club Finances screen say "sponsor" to every D5 club from
Season 1, before any of the sponsor machinery exists. Both are shared with D4+
clubs, so both are reworded neutrally rather than branched.

**The variable-income metric** (`ClubFinancesScreen.tsx`, currently
`label="Match, sponsor & prize"`) summarises `VARIABLE_INCOME_KINDS` —
`tickets`, `sponsor`, `buzz`, `prize`. It becomes:

```
Match, deals & prize
```

"Deals" covers an advertising deal and a sponsor deal equally, so the metric is
true in both worlds and keeps its current three-part shape.

**The empty-ledger docket**, shown before the first week of a season settles,
currently reads "Wages, gate receipts, sponsor money and upkeep land here as
each week is played." It becomes:

```
Wages, gate receipts, upkeep and every payment land here as each week is played.
```

### 3.4 The Season 3 Buzz panel

The unmanaged branch in `ClubFinancesScreen.tsx` stops inventing a sponsor:

- Kicker `"Basic sponsor"` → `"Local advertising"`.
- `"Your basic sponsor pays {amount} each month."` → `"Your pitchside boards pay
  {amount} each month."`

The following sentence — "Wins, goals and hero moments now make that deal worth
more twice a season" — describes the Buzz payout, which is a separate `buzz`
ledger kind, so it keeps working. It becomes "…make them worth more twice a
season" to agree with the new subject.

The panel's `title` ("The crowd is talking"), `stamp` and heading are untouched;
this is the Buzz feature's card, and local advertising is only the one line
inside it that was misnamed.

### 3.5 The Buzz payout copy — drop the actor

Two Buzz strings credit the payout to sponsors. Unlike everything above, these
reach **D4+ clubs too**, where sponsors genuinely exist and the wording is
correct. They are not branched. Branching would need a second set of strings in
`content/assistant-guide.json`, which has no per-division mechanism, and would
leave two copies of one sentence to drift apart.

Instead both drop the actor. Buzz pays out; who funds it goes unstated, which is
true at every division:

**`PostMatchBuzzCard.tsx`** — the visible line and its accessibility label:

| Now | Becomes |
|---|---|
| `Sponsors paid {amount} · Buzz reset to 0` | `Buzz paid out {amount} · reset to 0` |
| `Sponsors paid {amount} and Buzz reset to zero.` | `Buzz paid out {amount} and reset to zero.` |

**`content/assistant-guide.json`**, the `sponsor-buzz` sequence:

| Field | Now | Becomes |
|---|---|---|
| `inbox.detail` | "…and sponsors are watching." | "…and it is starting to pay." |
| `pages[0].body[0]` | "…build Buzz. Sponsors pay it out twice each season." | "…build Buzz. It pays out twice each season." |

The sequence `id` stays `sponsor-buzz`. It is an internal identifier, persisted
in `eventFlags` as delivery evidence, and renaming it would strand existing
saves' guide progress for no player-visible gain.

`src/content/__tests__/content.test.ts` pins the body string verbatim and moves
with it.

### 3.6 The glossary

One new entry in the `club` category, placed after **Money**:

> **Local advertising** — Money from the hoardings around your pitch, paid every
> fourth week. It is a fixed amount while your club is in Division 5. Reach
> Division 4 and real sponsors take the boards over, replacing it with deals you
> choose.

The existing **Money** entry reads "It is earned from sponsors, tickets, prizes,
and player sales" — sponsors again, to a player who has none. It becomes
"advertising, tickets, sponsors, prizes, and player sales".

### 3.7 What does not change

- The amount, the four-week cadence, and the 80% Chairman rate.
- The D4 handoff to named sponsor contracts.
- The `kind: 'sponsor'` ledger type. It is internal, never rendered, and
  renaming it would churn the persistence codec and its tests for no player-
  visible gain.
- `ENGINE_VERSION`. Nothing here touches the match engine, its RNG consumption,
  or any simulated value, so no replay is affected.

An assistant beat teaching the boards at the first payment was considered and
cut. The `(monthly)` tag answers the cadence question at the moment the money
lands, and the glossary answers the source question for anyone who looks; a new
guide sequence would cost a sequence id, `content/assistant-guide.json` copy and
a Bert expression pairing for a third telling of the same fact.

Two more "sponsor" strings are deliberately left alone:

**The Season 1 onboarding line** — Bert's "All you gotta do is win games, gain
fans, get sponsors. Not hard right?" (`content/assistant-guide.json`, pinned by
`src/render/__tests__/bert-voice.test.ts`). It describes the job ahead, not the
club's current income, and getting sponsors is a real thing the manager will do
at D4. It is correct as written.

**Random `category: "sponsor"` events** — `popup-sponsor`, `hero-commercial` and
friends still hand D5 clubs sponsor storylines. That is the events system
choosing its fiction, not this income line being misnamed, and it is a separate
call. This cycle does not claim a D5 manager never hears the word "sponsor" —
only that the money they bank every month stops pretending to be one.

## 4. Files touched

| File | Change |
|---|---|
| `src/game/career.ts` | Collapse the difficulty branch to the single label (§3.1) |
| `src/application/view-models.ts` | Branch the two outlook strings on managed contracts (§3.2) |
| `src/ui/screens/ClubFinancesScreen.tsx` | Metric label, empty docket, unmanaged Buzz panel (§3.3, §3.4) |
| `src/ui/components/PostMatchBuzzCard.tsx` | Payout line and accessibility label (§3.5) |
| `content/assistant-guide.json` | `sponsor-buzz` inbox detail and body (§3.5) |
| `content/glossary.json` | Add the entry, amend the Money definition (§3.6) |
| `src/ui/dev-harness/entries/club-business.tsx` | Scenario note says "Season 3 basic sponsor" |

## 5. Testing

Existing assertions that reference the old strings and move with them:

- `src/persistence/__tests__/sponsor-settlement-integration.test.ts:92` —
  asserts the flat line is absent once managed contracts exist. Extend it to ban
  `'Local advertising (monthly)'` as well, so the managed path stays covered.
- `src/application/__tests__/club-finances-transactions.test.ts:150,154` — the
  outlook detail strings for a payment week and a quiet week.
- `src/application/__tests__/club-finances-transactions.test.ts:220` — a ledger
  fixture using `'Monthly sponsor fee'`.
- `src/content/__tests__/content.test.ts:518` — pins the `sponsor-buzz` body
  string verbatim.

`src/ui/__tests__/club-business-ui.test.ts` covers the club business screen and
should be checked for the Buzz panel copy before editing.

Tests that assert on amounts by `kind: 'sponsor'` rather than by label — such as
`src/game/__tests__/m4-difficulty-recap.test.ts` — must stay green untouched.
They are the evidence that this cycle moved no money.

New tests extend the files that already own this ground rather than starting a
new one: settlement labels go in `sponsor-settlement-integration.test.ts`,
outlook and ledger strings in `club-finances-transactions.test.ts`, and content
copy in `content.test.ts`.

New coverage:

1. A D5 career settling week 4 emits exactly one income line labelled
   `Local advertising (monthly)`, on both Cozy and Chairman, with amounts 3,000
   and 2,400.
2. A club with managed contracts emits no such line, and its outlook still says
   `Sponsor payment`.
3. A Season 3 D5 club — the one case that renders the unmanaged Buzz panel —
   shows the local advertising wording and no longer says "sponsor". The
   `d5-buzz-0` dev-harness scenario is the manual check for this.
4. The glossary passes its existing zod validation with the new entry.

Because no number moves, the balance harness assertions and the golden replay
snapshot must both pass unchanged. A diff in either means the change was not
copy-only.
