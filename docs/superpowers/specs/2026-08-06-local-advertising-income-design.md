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

That branch runs only while the club's best-ever division is D5.
`managedSponsorCapacity` returns 0 for D5, so `createSeasonSponsorship` builds an
empty portfolio and no contract lines exist. D5's `sponsorMonthlyFee` is 3,000,
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

The label row is `<Text className="flex-1 text-base text-ink">` with no line
clamp in both `PostMatchSummaryModal` and `ClubFinancesScreen`, so long labels
wrap rather than clip. At 27 characters this fits one line at default text size
and wraps gracefully for players using large iOS text.

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

### 3.3 The glossary

One new entry in the `club` category, placed after **Money**:

> **Local advertising** — Money from the hoardings around your pitch, paid every
> fourth week. It is a fixed amount while your club is in Division 5. Reach
> Division 4 and real sponsors take the boards over, replacing it with deals you
> choose.

The existing **Money** entry reads "It is earned from sponsors, tickets, prizes,
and player sales" — sponsors again, to a player who has none. It becomes
"advertising, tickets, sponsors, prizes, and player sales".

### 3.4 The Season 3 Buzz panel

The unmanaged branch in `ClubFinancesScreen.tsx` stops inventing a sponsor:

- Kicker `"Basic sponsor"` → `"Local advertising"`.
- `"Your basic sponsor pays {amount} each month."` → `"Your pitchside boards pay
  {amount} each month."`

The following sentence — "Wins, goals and hero moments now make that deal worth
more twice a season" — describes the Buzz payout, which is a separate `buzz`
ledger kind, so it keeps working. It becomes "…make them worth more twice a
season" to agree with the new subject.

The panel's `title` ("The crowd is talking"), `stamp`, heading and Buzz card are
untouched; this is the Buzz feature's card, and local advertising is only the
one line inside it that was misnamed.

### 3.5 What does not change

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

## 4. Files touched

| File | Change |
|---|---|
| `src/game/career.ts` | Collapse the difficulty branch to the single label |
| `src/application/view-models.ts` | Branch the two outlook strings on managed contracts |
| `src/ui/screens/ClubFinancesScreen.tsx` | Rekicker and reword the unmanaged Buzz panel line |
| `content/glossary.json` | Add the entry, amend the Money definition |
| `src/ui/dev-harness/entries/club-business.tsx` | Scenario note says "Season 3 basic sponsor" |

## 5. Testing

Three existing assertions reference the old strings and move with them:

- `src/persistence/__tests__/sponsor-settlement-integration.test.ts:92` —
  asserts the flat line is absent once managed contracts exist.
- `src/application/__tests__/club-finances-transactions.test.ts:150,154` — the
  outlook detail strings for a payment week and a quiet week.
- `src/application/__tests__/club-finances-transactions.test.ts:220` — a ledger
  fixture using `'Monthly sponsor fee'`.

`src/ui/__tests__/club-business-ui.test.ts` covers the club business screen and
should be checked for the Buzz panel copy before editing.

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
