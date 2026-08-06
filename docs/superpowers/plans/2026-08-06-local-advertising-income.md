# Local Advertising Income Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Division 5 passive monthly income from "sponsor" language to
"local advertising" across every player-visible surface, state its monthly
cadence in the label, and give it a glossary entry.

**Architecture:** Copy and content only. Seven files change; not one number,
threshold, cadence or difficulty rate moves. The settlement branch that produces
this income is gated on `activeContracts.length === 0`, so D4+ clubs with real
sponsors keep the existing sponsor wording. Two Buzz strings are shared with D4+
clubs and are reworded to drop the actor rather than branched.

**Tech Stack:** TypeScript (strict), React Native + NativeWind, Jest, zod-validated
JSON content under `content/`.

**Spec:** `docs/superpowers/specs/2026-08-06-local-advertising-income-design.md`

---

## Before you start

Read the spec. The one thing you must not get wrong:

**The branch is `activeContracts.length === 0`, NOT a division check.** In normal
play that is the never-promoted D5 club, but a club relegated from D4 back to D5
keeps its managed contracts and must keep saying "sponsor". Never write
`division === 5` or `highestDivisionReached === 5` anywhere in this work.

Commands used throughout:

```bash
npx jest <path> -t "<test name>"
```

```bash
npx tsc --noEmit
```

## File structure

| File | Responsibility in this change |
|---|---|
| `src/game/career.ts` | Emits the settlement ledger line — the label itself |
| `src/application/view-models.ts` | Builds the four-week outlook fact strings |
| `src/ui/screens/ClubFinancesScreen.tsx` | Finances metric, empty docket, unmanaged Buzz panel |
| `src/ui/components/PostMatchBuzzCard.tsx` | Buzz payout line + accessibility label |
| `content/assistant-guide.json` | Bert's `sponsor-buzz` sequence copy |
| `content/glossary.json` | New term + amended Money definition |
| `src/ui/dev-harness/entries/club-business.tsx` | Two scenario notes naming "basic sponsor" |

---

### Task 1: Rename the settlement ledger line

**Files:**
- Modify: `src/game/career.ts:928-945`
- Test: `src/persistence/__tests__/sponsor-settlement-integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('sponsor settlement integration', …)`
block, after the last existing test. It uses the file's existing helpers
(`reachWeekFour`, `settleManageWeek`, `sponsorLines`) — do not redefine them.

```ts
  test('labels the unmanaged D5 monthly income as local advertising in both modes', () => {
    const cozy = sponsorLines(settleManageWeek(reachWeekFour('COZY')));
    expect(cozy).toEqual([expect.objectContaining({
      label: 'Local advertising (monthly)',
      amount: 3_000,
    })]);

    const chairman = sponsorLines(settleManageWeek(reachWeekFour('CHAIRMAN')));
    expect(chairman).toEqual([expect.objectContaining({
      label: 'Local advertising (monthly)',
      amount: 2_400,
    })]);
  });
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx jest src/persistence/__tests__/sponsor-settlement-integration.test.ts -t "local advertising"
```

Expected: FAIL. The received label is `'Monthly sponsor fee'` for Cozy and
`'Chairman sponsor target'` for Chairman. **The amounts 3,000 and 2,400 must
already match** — if an amount is wrong, stop and re-read the spec before
touching anything, because this task changes no numbers.

- [ ] **Step 3: Update the existing assertion that names the old label**

At `src/persistence/__tests__/sponsor-settlement-integration.test.ts:92`, replace:

```ts
    expect(paid.some(line => line.label === 'Chairman sponsor target')).toBe(false);
```

with a check that the managed path emits neither the old label nor the new one:

```ts
    expect(paid.some(line => (
      line.label === 'Chairman sponsor target' || line.label === 'Local advertising (monthly)'
    ))).toBe(false);
```

- [ ] **Step 4: Collapse the difficulty branch**

In `src/game/career.ts`, inside `settlementAwards`, replace:

```ts
            label: state.difficulty === 'CHAIRMAN'
              ? 'Chairman sponsor target'
              : 'Monthly sponsor fee',
```

with:

```ts
            label: 'Local advertising (monthly)',
```

- [ ] **Step 5: Run the tests and make sure they pass**

```bash
npx jest src/persistence/__tests__/sponsor-settlement-integration.test.ts
```

Expected: PASS, whole file.

- [ ] **Step 6: Commit**

```bash
git add src/game/career.ts src/persistence/__tests__/sponsor-settlement-integration.test.ts
git commit -m "feat: rename the D5 monthly income ledger line to local advertising"
```

---

### Task 2: Branch the four-week outlook facts

The function is named `fourWeekOperatingOutlook` (the spec calls it
`clubOperatingOutlook` — the spec is wrong on the name, the code is right).

**Files:**
- Modify: `src/application/view-models.ts:419-479`
- Test: `src/application/__tests__/club-finances-transactions.test.ts:145-160`

- [ ] **Step 1: Update the existing outlook assertions to the new strings**

In `src/application/__tests__/club-finances-transactions.test.ts`, replace:

```ts
      expect.objectContaining({
        periodLabel: 'S1 · W4', detail: 'Away league game · no gate · Sponsor payment',
        net: baseline + 3_000,
      }),
      expect.objectContaining({
        periodLabel: 'S1 · W5', detail: 'No match or sponsor payment', net: baseline,
      }),
```

with:

```ts
      expect.objectContaining({
        periodLabel: 'S1 · W4', detail: 'Away league game · no gate · Advertising payment',
        net: baseline + 3_000,
      }),
      expect.objectContaining({
        periodLabel: 'S1 · W5', detail: 'No match or advertising payment', net: baseline,
      }),
```

The `net` values are unchanged and must stay unchanged.

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx jest src/application/__tests__/club-finances-transactions.test.ts -t "operating outlook"
```

Expected: FAIL on the detail strings only. If a `net` value also fails, stop —
something other than copy changed.

- [ ] **Step 3: Branch the two fact strings on managed contracts**

In `src/application/view-models.ts`, inside `fourWeekOperatingOutlook`, add the
flag just after the existing `sponsorIncome` line:

```ts
  const sponsorIncome = currentActualMonthlySponsorIncome(state, club);
  const managed = state.clubBusiness.sponsorship.activeContracts.length > 0;
```

Then replace:

```ts
    if (SPONSOR_PAYMENT_WEEKS.includes(week as typeof SPONSOR_PAYMENT_WEEKS[number])) {
      net += sponsorIncome;
      facts.push('Sponsor payment');
    }
    if (facts.length === 0) facts.push('No match or sponsor payment');
```

with:

```ts
    if (SPONSOR_PAYMENT_WEEKS.includes(week as typeof SPONSOR_PAYMENT_WEEKS[number])) {
      net += sponsorIncome;
      facts.push(managed ? 'Sponsor payment' : 'Advertising payment');
    }
    if (facts.length === 0) {
      facts.push(managed ? 'No match or sponsor payment' : 'No match or advertising payment');
    }
```

- [ ] **Step 4: Add a test proving a managed club keeps the sponsor wording**

Append this test to the same `describe` block that holds the outlook test in
`src/application/__tests__/club-finances-transactions.test.ts`.

Add this import at the top of the file if it is not already there:

```ts
import type { SponsorContractSnapshot } from '../../game/club-business-types';
```

The outlook only reads `activeContracts.length`, so the test hand-builds one
minimal contract rather than calling `createSeasonSponsorship` — that helper
needs `SponsorRules`, which lives on `state.sponsorRules`, not on
`SponsorshipState`, and none of it is relevant here.

```ts
  test('keeps sponsor wording in the outlook once managed contracts exist', () => {
    const initial = createCareer(createLaunchCareerSetup(20260806));
    const contract: SponsorContractSnapshot = {
      contractId: 'test-slot0',
      sponsorContentId: 'continuity',
      sponsorName: 'Test Sponsor',
      offerLine: 'Test terms.',
      season: 1,
      slot: 0,
      nominalMonthlyFee: 4_000,
      provisional: false,
    };
    const managed = {
      ...initial,
      clubBusiness: {
        ...initial.clubBusiness,
        sponsorship: { activeContracts: [contract], offers: [], portfolioSeason: 1 },
      },
    };

    const details = clubFinancesViewModel(managed).operatingOutlook.weeks
      .map(week => week.detail)
      .join(' | ');
    expect(details).toContain('Sponsor payment');
    expect(details).not.toContain('dvertising');
  });
```

`portfolioSeason: 1` matters — `currentActualMonthlySponsorIncome` throws if the
portfolio season does not match `state.season`, and a fresh career is in
season 1.

- [ ] **Step 5: Run the tests and make sure they pass**

```bash
npx jest src/application/__tests__/club-finances-transactions.test.ts
```

Expected: PASS, whole file.

- [ ] **Step 6: Commit**

```bash
git add src/application/view-models.ts src/application/__tests__/club-finances-transactions.test.ts
git commit -m "feat: say advertising, not sponsor, in the D5 four-week outlook"
```

---

### Task 3: Reword the Club Finances chrome

Two strings shown to every D5 club from Season 1. Both are shared with D4+
clubs, so both are reworded neutrally rather than branched.

**Files:**
- Modify: `src/ui/screens/ClubFinancesScreen.tsx:714` and `:1130`

Neither string is pinned by any test today — verified with a repo-wide grep.

- [ ] **Step 1: Reword the variable-income metric**

Replace:

```tsx
              label="Match, sponsor & prize"
```

with:

```tsx
              label="Match, deals & prize"
```

- [ ] **Step 2: Reword the empty-ledger docket**

Replace:

```tsx
            detail="Wages, gate receipts, sponsor money and upkeep land here as each week is played."
```

with:

```tsx
            detail="Wages, gate receipts, upkeep and every payment land here as each week is played."
```

- [ ] **Step 3: Confirm no test pinned either string**

```bash
npx jest src/ui/__tests__/club-business-ui.test.ts
```

Expected: PASS. That suite asserts on source-text patterns (refs, nativeIDs,
class names), not on this copy.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/ClubFinancesScreen.tsx
git commit -m "feat: drop sponsor wording from the Club Finances chrome"
```

---

### Task 4: Rename the Season 3 Buzz panel line

The unmanaged branch of the sponsorship panel — the only place the game has ever
explained this money, and it calls it a "basic sponsor".

**Files:**
- Modify: `src/ui/screens/ClubFinancesScreen.tsx:816-820`

- [ ] **Step 1: Replace the kicker and the sentence**

Replace:

```tsx
        <PaperPanel kicker="Basic sponsor" title="The crowd is talking" stamp="LIVE">
          <Text className="text-sm leading-5 text-ink/70">
            Your basic sponsor pays {formatCurrency(sponsorship.actualMonthlyIncome)} each month.
            Wins, goals and hero moments now make that deal worth more twice a season.
          </Text>
```

with:

```tsx
        <PaperPanel kicker="Local advertising" title="The crowd is talking" stamp="LIVE">
          <Text className="text-sm leading-5 text-ink/70">
            Your pitchside boards pay {formatCurrency(sponsorship.actualMonthlyIncome)} each month.
            Wins, goals and hero moments now make them worth more twice a season.
          </Text>
```

The panel's `title`, `stamp`, surrounding heading and the `BuzzCard` below are
untouched.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/ClubFinancesScreen.tsx
git commit -m "feat: name the Season 3 D5 income panel local advertising"
```

---

### Task 5: Drop the actor from the Buzz payout copy

**These two strings also reach D4+ clubs, where sponsors genuinely exist.** They
are NOT branched — both drop the actor so one string stays true at every
division.

**Files:**
- Modify: `src/ui/components/PostMatchBuzzCard.tsx:23` and `:48`
- Modify: `content/assistant-guide.json` (the `sponsor-buzz` sequence)
- Test: `src/content/__tests__/content.test.ts:518`

- [ ] **Step 1: Update the content test pin first**

In `src/content/__tests__/content.test.ts`, replace:

```ts
            "We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. Sponsors pay it out twice each season.",
```

with:

```ts
            "We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. It pays out twice each season.",
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx jest src/content/__tests__/content.test.ts -t "sponsor-buzz"
```

Expected: FAIL — the content JSON still has the old sentence.

If `-t "sponsor-buzz"` matches nothing, run the whole file; the assertion lives
in a test whose name does not contain the sequence id.

- [ ] **Step 3: Update the two `sponsor-buzz` strings in the content JSON**

In `content/assistant-guide.json`, find the object with `"id": "sponsor-buzz"`.

Replace:

```json
"detail": "The team has a real following now, and sponsors are watching."
```

with:

```json
"detail": "The team has a real following now, and it is starting to pay."
```

Replace:

```json
"We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. Sponsors pay it out twice each season."
```

with:

```json
"We're famous enough to have a proper social media following now. Goals, wins and hero moments build Buzz. It pays out twice each season."
```

**Leave the sequence `id` as `sponsor-buzz`.** It is an internal identifier
persisted in `eventFlags` as delivery evidence; renaming it strands existing
saves' guide progress for no player-visible gain.

- [ ] **Step 4: Run the content test to verify it passes**

```bash
npx jest src/content/__tests__/content.test.ts
```

Expected: PASS, whole file.

- [ ] **Step 5: Reword the Buzz payout card**

In `src/ui/components/PostMatchBuzzCard.tsx`, replace the accessibility label
line:

```tsx
      : `Sponsors paid ${formatCurrency(buzz.payout)} and Buzz reset to zero.`,
```

with:

```tsx
      : `Buzz paid out ${formatCurrency(buzz.payout)} and reset to zero.`,
```

and the visible line:

```tsx
            Sponsors paid {formatCurrency(buzz.payout)} · Buzz reset to 0
```

with:

```tsx
            Buzz paid out {formatCurrency(buzz.payout)} · reset to 0
```

- [ ] **Step 6: Typecheck and run the UI suite**

```bash
npx tsc --noEmit
```

```bash
npx jest src/ui
```

Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/PostMatchBuzzCard.tsx content/assistant-guide.json src/content/__tests__/content.test.ts
git commit -m "feat: credit the Buzz payout to Buzz instead of sponsors"
```

---

### Task 6: Add the glossary entry

**Files:**
- Modify: `content/glossary.json:106` (the `club` category)
- Test: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append this to the top-level `describe` block in
`src/content/__tests__/content.test.ts`. That file already imports
`loadLaunchContent`, and `src/content/load.ts` exposes the glossary as
`glossary: glossaryJson` with the shape `{ categories: [{ id, title, entries:
[{ term, definition }] }] }`.

```ts
  test('explains local advertising in the club glossary', () => {
    const club = loadLaunchContent().glossary.categories
      .find(category => category.id === 'club');
    const entry = club?.entries.find(term => term.term === 'Local advertising');
    expect(entry?.definition).toContain('every fourth week');
    expect(entry?.definition).toContain('Division 4');

    const money = club?.entries.find(term => term.term === 'Money');
    expect(money?.definition).toContain('advertising');
  });
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
npx jest src/content/__tests__/content.test.ts -t "local advertising"
```

Expected: FAIL — the entry does not exist.

- [ ] **Step 3: Add the entry and amend Money**

In `content/glossary.json`, in the `club` category, replace the Money entry:

```json
        { "term": "Money", "definition": "The club-capacity currency used for wages, transfers, facilities, scouting, and events. It is earned from sponsors, tickets, prizes, and player sales." },
```

with the amended Money entry followed by the new one:

```json
        { "term": "Money", "definition": "The club-capacity currency used for wages, transfers, facilities, scouting, and events. It is earned from advertising, tickets, sponsors, prizes, and player sales." },
        { "term": "Local advertising", "definition": "Money from the hoardings around your pitch, paid every fourth week. It is a fixed amount while your club is in Division 5. Reach Division 4 and real sponsors take the boards over, replacing it with deals you choose." },
```

Match the file's existing one-entry-per-line formatting exactly.

- [ ] **Step 4: Run the tests and make sure they pass**

```bash
npx jest src/content/__tests__/content.test.ts
```

Expected: PASS, whole file — including the existing zod schema validation.

- [ ] **Step 5: Commit**

```bash
git add content/glossary.json src/content/__tests__/content.test.ts
git commit -m "feat: add the local advertising glossary entry"
```

---

### Task 7: Update the dev-harness notes and run the full sweep

**Files:**
- Modify: `src/ui/dev-harness/entries/club-business.tsx:46` and `:48`

- [ ] **Step 1: Reword both scenario notes**

Replace:

```tsx
  { id: 'd5-buzz-0', label: 'D5 Buzz 0', note: 'Season 3 basic sponsor; managed offers stay locked.' },
```

with:

```tsx
  { id: 'd5-buzz-0', label: 'D5 Buzz 0', note: 'Season 3 local advertising; managed offers stay locked.' },
```

Replace:

```tsx
  { id: 'd5-buzz-100', label: 'Buzz 100', note: 'The capped meter and maximum basic-sponsor payout.' },
```

with:

```tsx
  { id: 'd5-buzz-100', label: 'Buzz 100', note: 'The capped meter and maximum Buzz payout.' },
```

- [ ] **Step 2: Prove no player-visible "sponsor" is left on the D5 path**

```bash
grep -rn "sponsor" src/ui/screens/ClubFinancesScreen.tsx src/ui/components/PostMatchBuzzCard.tsx --include="*.tsx" -i | grep -v "sponsorship\.\|sponsorSlot\|sponsor-slots\|SponsorHeading\|ActiveSponsorCard\|SponsorOffer\|sponsorBuzz\|sponsorDesk\|sponsorPercent\|chairmanPercent\|ClubSponsorshipViewModel\|SponsorSlotViewModel"
```

Expected: only matches inside the **managed** branch (real sponsor slots, offers,
contract totals), which are correct. Any hit in the unmanaged branch or in
always-visible chrome is a miss — fix it before continuing.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

```bash
npx jest --silent
```

Expected: PASS. Pay attention to two things:

1. **`src/game/__tests__/m4-difficulty-recap.test.ts` must pass untouched.** It
   asserts amounts by `kind: 'sponsor'` rather than by label, so it is the
   evidence this cycle moved no money. If it fails, a number changed and the
   change is no longer copy-only — stop and investigate.
2. **The golden-replay snapshot must not change.** If jest reports an obsolete
   or failing snapshot, stop. Nothing here touches the match engine, so a
   snapshot diff means something unintended happened. Do NOT update the snapshot.

Per the repo's worktree conventions, re-run any failure once on a clean checkout
before assuming this change caused it — several sessions share this tree.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dev-harness/entries/club-business.tsx
git commit -m "chore: update dev-harness notes for local advertising"
```

---

## Definition of done

- [ ] Every surface in the spec's §3 table is either changed or explicitly out of scope
- [ ] `npx tsc --noEmit` is clean
- [ ] `npx jest` is green, including `m4-difficulty-recap.test.ts` untouched
- [ ] No golden-replay snapshot was updated
- [ ] `ENGINE_VERSION` in `src/sim/match.ts` is unchanged
- [ ] No `division === 5` or `highestDivisionReached` check was added anywhere
