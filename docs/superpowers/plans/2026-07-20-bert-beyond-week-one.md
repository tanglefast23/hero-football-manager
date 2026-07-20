# Bert Beyond Week One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the assistant-manager tutorial (Bert Rudge) past Season 1 Week 1 so he introduces each management system the first time it becomes relevant, and leaves non-blocking "coaching notes" on the Home desk when the club is struggling.

**Architecture:** Two independent, separately-shippable mechanisms on top of the *existing* Bert machinery.
- **Part A — Feature briefings:** one-time, flag-gated *modal* sequences (reusing today's `AssistantGuideOverlay` + `eventFlags` milestone engine) that fire when a system first matters: opening the Market tab (scouting/transfers/coaches), first Club-tab visit after the training ground is built (facility levels + adjacency), and the first season-end where an awakened player's contract hits the wage cliff.
- **Part B — Coaching notes:** *non-blocking* Home-desk alerts, using the currently-unused violet `'event'` inbox tone, that surface contextual pointers when the club is struggling (thin cash cushion, poor form, slipping morale, run-down condition). These are pure functions of game state — no new persisted state.

Both parts only run in `careerMode === 'full'`, so the deterministic M1 test harness and balance rails are untouched.

**Tech Stack:** TypeScript (strict), React Native, Zustand store, Jest. Bert copy ships as zod-validated JSON in `content/`. Trigger logic lives in the pure `src/game` / `src/application` rings (no RN, no `Math.random`/`Date.now`).

---

## Design decisions (surfaced — change any before execution)

1. **Coaches are folded into one `market-intro` briefing** (a 4-page modal shown the first time the Market tab is opened), not a separate coach modal. Rationale: scouting, transfers, and coaches all live on the Market tab, so one briefing per tab keeps the "one relevant thing when it matters" cadence. *Alternative:* a separate `coach-intro` that fires when a coach is first affordable.
2. **The wage-cliff briefing fires on the Home tab** the first time an expired awakened player exists, reusing the existing management overlay. *Alternative:* render it inside the season-review screen (more plumbing — the overlay currently only mounts when `store.screen === 'management'`).
3. **Coaching notes are stateless / condition-based.** They show while the problem holds and self-clear when it improves; no dismiss button, no persisted "seen" flag, no save-codec change. *Alternative (out of scope for v1):* one-time dismissible "pro tips" — those would need a new persisted flag + a dismiss action.
4. **Notes use the unused violet `'event'` inbox tone, capped at ≤2 per week,** and are written to never coexist with the board's own urgent alert for the same problem (e.g. Bert's cash note only shows *before* cash goes negative, where the board's `financial-warning` takes over).
5. **Bert keeps his current `BertFullBody` pixel sprite.** The M4 portrait paper-doll upgrade is tracked separately and is out of scope here.

---

## File structure

**Part A — Feature briefings**
- Modify `src/game/assistant-guide.ts` — add new sequence IDs, milestones, and flag maps (pure model).
- Modify `src/content/schemas.ts` — widen the sequence-ID enum and the `sequences` length rule.
- Modify `content/assistant-guide.json` — add `market-intro`, `facilities-intro`, `renewal-cliff-intro` sequences (the copy).
- Modify `src/content/__tests__/content.test.ts` — update the exact sequence-ID list assertion.
- Modify `src/application/assistant-guide.ts` — extend `pendingAssistantGuideSequence` with the beyond-week-1 triggers + pure predicates.
- Verify only (no edit expected): `App.tsx` already renders whatever `pendingAssistantGuideSequence` returns for any management tab.

**Part B — Coaching notes**
- Create `src/game/assistant-advice.ts` — pure struggle-detection predicates + `assistantAdviceNotes(state)`.
- Create `src/game/__tests__/assistant-advice.test.ts` — predicate + prioritization + cap tests.
- Modify `src/application/view-models.ts` — append advice notes to the Home `alerts` array.
- Modify `App.tsx` — route `bert-tip-*` alert taps to the sensible tab.
- Modify `src/application/__tests__/*` (home view-model test) — assert notes appear/suppress correctly.

---

# PART A — Bert's feature briefings

### Task A1: Add the new sequences + milestones to the pure guide model

**Files:**
- Modify: `src/game/assistant-guide.ts`
- Test: `src/game/__tests__/assistant-guide.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/game/__tests__/assistant-guide.test.ts`

```ts
import {
  completeAssistantGuideSequence,
  hasAssistantGuideMilestone,
} from '../assistant-guide';
// (reuse whatever baseState() / makeState helper the file already defines)

test('market-intro milestone completes via its sequence and persists', () => {
  const state = baseState();
  expect(hasAssistantGuideMilestone(state, 'market-intro-complete')).toBe(false);
  const next = completeAssistantGuideSequence(state, 'market-intro');
  expect(hasAssistantGuideMilestone(next, 'market-intro-complete')).toBe(true);
  expect(next.eventFlags).toContain('guide:bert:market-intro-complete');
});

test('facilities-intro and renewal-cliff milestones complete independently', () => {
  let state = baseState();
  state = completeAssistantGuideSequence(state, 'facilities-intro');
  state = completeAssistantGuideSequence(state, 'renewal-cliff-intro');
  expect(hasAssistantGuideMilestone(state, 'facilities-intro-complete')).toBe(true);
  expect(hasAssistantGuideMilestone(state, 'renewal-cliff-complete')).toBe(true);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/game/__tests__/assistant-guide.test.ts -t 'market-intro milestone'`
Expected: FAIL — TS/compile error, `'market-intro'` not assignable to `AssistantGuideSequenceId`.

- [ ] **Step 3: Extend the model** in `src/game/assistant-guide.ts`

Add to the `AssistantGuideSequenceId` union:
```ts
export type AssistantGuideSequenceId =
  | 'management-intro'
  | 'squad-intro'
  | 'desk-intro'
  | 'market-intro'
  | 'facilities-intro'
  | 'renewal-cliff-intro';
```
Add to the `AssistantGuideMilestone` union:
```ts
export type AssistantGuideMilestone =
  | 'intro-complete'
  | 'squad-intro-complete'
  | 'first-training-complete'
  | 'desk-intro-complete'
  | 'first-week-advanced'
  | 'market-intro-complete'
  | 'facilities-intro-complete'
  | 'renewal-cliff-complete';
```
Add to `FLAG_BY_MILESTONE`:
```ts
  'market-intro-complete': 'guide:bert:market-intro-complete',
  'facilities-intro-complete': 'guide:bert:facilities-intro-complete',
  'renewal-cliff-complete': 'guide:bert:renewal-cliff-complete',
```
Add to `MILESTONE_BY_SEQUENCE`:
```ts
  'market-intro': 'market-intro-complete',
  'facilities-intro': 'facilities-intro-complete',
  'renewal-cliff-intro': 'renewal-cliff-complete',
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/game/__tests__/assistant-guide.test.ts`
Expected: PASS (all existing + new cases).

- [ ] **Step 5: Commit**

```bash
git add src/game/assistant-guide.ts src/game/__tests__/assistant-guide.test.ts
git commit -m "feat(bert): add market/facilities/renewal guide sequences to the model"
```

---

### Task A2: Author the new briefing copy + widen the content schema

**Files:**
- Modify: `src/content/schemas.ts:136-180`
- Modify: `content/assistant-guide.json`
- Test: `src/content/__tests__/content.test.ts:166-170`

The schema currently pins the sequence list to exactly the original three (`AssistantGuideSequenceIdSchema` enum + `sequences` `.length(3)` + a refinement that requires every enum ID to be present). Widening the enum makes each new ID **required** in content, so the enum and JSON change together.

- [ ] **Step 1: Update the failing content test** — `src/content/__tests__/content.test.ts` around line 166

```ts
    expect(content.assistantGuide.sequences.map(sequence => sequence.id)).toEqual([
      'management-intro',
      'squad-intro',
      'desk-intro',
      'market-intro',
      'facilities-intro',
      'renewal-cliff-intro',
    ]);
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest src/content/__tests__/content.test.ts -t 'assistant'`
Expected: FAIL — content still has 3 sequences / schema rejects new IDs.

- [ ] **Step 3: Widen the schema** in `src/content/schemas.ts`

Replace the enum (line ~136):
```ts
export const AssistantGuideSequenceIdSchema = z.enum([
  'management-intro',
  'squad-intro',
  'desk-intro',
  'market-intro',
  'facilities-intro',
  'renewal-cliff-intro',
]);
```
Change the `sequences` length rule (line ~172) from `.length(3)` to `.min(3)`:
```ts
  sequences: z.array(z.strictObject({
    id: AssistantGuideSequenceIdSchema,
    pages: z.array(AssistantGuidePageSchema).min(1).max(4),
  })).min(3),
```
Leave the `superRefine` block as-is — it already requires every enum option to be present, which now enforces the three new sequences too.

- [ ] **Step 4: Add the copy** to `content/assistant-guide.json` — append these three objects to the `sequences` array. **Schema limits: ≤4 pages/sequence, ≤2 body paragraphs/page, `focus: "assistant"` (no spotlight anchor needed).** Copy numbers are grounded in the real mechanics (coach = +10%/level; level-3 facility = ×2 training; wage cliff = ×4).

```json
    {
      "id": "market-intro",
      "pages": [
        {
          "kicker": "The market opens",
          "title": "Time to go shopping",
          "body": [
            "Right. The transfer market's open to us now. This is where you find players who aren't ours yet—and the coaches who make ours better.",
            "Everything in here costs real money, so we do it deliberately. Three doors—I'll walk you through them."
          ],
          "focus": "assistant",
          "buttonLabel": "Show me."
        },
        {
          "kicker": "Step one: scouting",
          "title": "Look before you buy",
          "body": [
            "You never sign a stranger. Pay a scout—a thousand and up—and in two or three weeks he brings back reports: stats, potential, sometimes a hidden power.",
            "One mission at a time. A better Scout Office sharpens the numbers he comes back with."
          ],
          "focus": "assistant",
          "buttonLabel": "And then?"
        },
        {
          "kicker": "Step two: the deal",
          "title": "No scouting, no signing",
          "body": [
            "Once a player's scouted you can open talks and make an offer with your pitch cards. Land it and you pay a fee plus their new wage.",
            "The window isn't always open, mind. And sign a hero, they jump to hero wages—same cliff as our own lads."
          ],
          "focus": "assistant",
          "buttonLabel": "Understood."
        },
        {
          "kicker": "The best coin you'll spend",
          "title": "Hire a coach",
          "body": [
            "A good coach earns his wage. Each level adds ten percent to training in his two specialties—a maxed one is half again the gains, every single week.",
            "A Motivator's different: he guards morale and lifts the lads on matchday. One coach at a time, so pick the gap that hurts most."
          ],
          "focus": "assistant",
          "buttonLabel": "Good to know."
        }
      ]
    },
    {
      "id": "facilities-intro",
      "pages": [
        {
          "kicker": "Bricks and mortar",
          "title": "The training ground's up",
          "body": [
            "Now the yard's open. Every building you raise here does one job—sharpens a kind of training, heals injuries faster, or brings in coin.",
            "You can only run one build at a time, so choose in the order of what's hurting."
          ],
          "focus": "assistant",
          "buttonLabel": "Go on."
        },
        {
          "kicker": "Levels matter",
          "title": "Upgrade what you use",
          "body": [
            "Each facility takes two upgrades. A maxed building doubles the training it governs—level three is worth twice level one.",
            "Don't spread thin. A single maxed pitch beats five half-built sheds."
          ],
          "focus": "assistant",
          "buttonLabel": "Right."
        },
        {
          "kicker": "The clever bit",
          "title": "Place them side by side",
          "body": [
            "Some buildings help each other when they share a wall. Gym by the dorm: fitter legs. Shop by the stand: more merch money. Medical by the pitch: fewer injuries.",
            "Plan the grid. Don't just plonk things down."
          ],
          "focus": "assistant",
          "buttonLabel": "Sharp. Thanks, Bert."
        }
      ]
    },
    {
      "id": "renewal-cliff-intro",
      "pages": [
        {
          "kicker": "The bill comes due",
          "title": "About that contract",
          "body": [
            "Your awakened lad's deal is up. Here's the sting: he signed as a nobody, but he'll re-sign as a hero—and hero wages run roughly four times the old ones.",
            "That bargain we've been living on? It ends the moment he renews."
          ],
          "focus": "assistant",
          "buttonLabel": "So what do I do?"
        },
        {
          "kicker": "Your call",
          "title": "Pay, haggle, or let go",
          "body": [
            "Meet the ask, talk him down with pitch cards, or let him walk and bank the wages. None of it's wrong—it depends what your books can carry.",
            "But you can't start next season with it hanging. Settle it."
          ],
          "focus": "assistant",
          "buttonLabel": "I'll decide."
        }
      ]
    }
```

- [ ] **Step 5: Run content + schema tests**

Run: `npx jest src/content/__tests__/content.test.ts`
Expected: PASS. If a body line exceeds `displayNameSchema`'s length cap, shorten it (keep ≤2 paragraphs).

- [ ] **Step 6: Commit**

```bash
git add src/content/schemas.ts content/assistant-guide.json src/content/__tests__/content.test.ts
git commit -m "feat(bert): author market/facilities/renewal briefing copy"
```

---

### Task A3: Fire the briefings when each system first matters

**Files:**
- Modify: `src/application/assistant-guide.ts`
- Test: `src/application/__tests__/assistant-guide.test.ts`

The existing `pendingAssistantGuideSequence` early-returns `null` outside Season 1 Week 1. Keep that first-week block **exactly as-is** (extract it into a helper so the beyond-week-1 logic reads cleanly), then add feature briefings after it. Each briefing is one-time (flag-gated) and only in full career.

- [ ] **Step 1: Write the failing tests** — append to `src/application/__tests__/assistant-guide.test.ts`

```ts
// Helper assumptions: fullCareerState() returns a careerMode:'full' GameState past week 1
// with onboarding complete. Adjust to the file's existing builders.

test('market-intro fires once when the Market tab is first opened', () => {
  const state = fullCareerState({ week: 3 });
  expect(pendingAssistantGuideSequence(state, 'market')).toBe('market-intro');
  expect(pendingAssistantGuideSequence(state, 'home')).toBeNull(); // wrong tab
  const seen = completeAssistantGuideSequence(state, 'market-intro');
  expect(pendingAssistantGuideSequence(seen, 'market')).toBeNull(); // never repeats
});

test('facilities-intro fires on Club tab only after the training ground is built', () => {
  const notBuilt = fullCareerState({ week: 3, trainingGroundBuilt: false });
  expect(pendingAssistantGuideSequence(notBuilt, 'club')).toBeNull();
  const built = fullCareerState({ week: 3, trainingGroundBuilt: true });
  expect(pendingAssistantGuideSequence(built, 'club')).toBe('facilities-intro');
});

test('renewal-cliff-intro fires on Home when an awakened contract has expired', () => {
  const state = fullCareerState({
    week: 30,
    heroPlayer: { power: 'FIRE_TORCH', onHeroWage: false, contractSeasonsRemaining: 0 },
  });
  expect(pendingAssistantGuideSequence(state, 'home')).toBe('renewal-cliff-intro');
  // a non-hero expiry, or an already-on-hero-wage player, does NOT trigger it
  const ordinary = fullCareerState({
    week: 30,
    heroPlayer: { power: undefined, onHeroWage: false, contractSeasonsRemaining: 0 },
  });
  expect(pendingAssistantGuideSequence(ordinary, 'home')).toBeNull();
});

test('feature briefings never fire in the m1-slice harness', () => {
  const slice = fullCareerState({ week: 3, careerMode: 'm1-slice' });
  expect(pendingAssistantGuideSequence(slice, 'market')).toBeNull();
});

test('first-week guided quick start is unchanged', () => {
  const s1w1 = baseFirstWeekState(); // existing builder used by current tests
  expect(pendingAssistantGuideSequence(s1w1, 'home')).toBe('management-intro');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/application/__tests__/assistant-guide.test.ts -t 'market-intro fires'`
Expected: FAIL — returns `null` (function ignores beyond-week-1 tabs).

- [ ] **Step 3: Implement the triggers** in `src/application/assistant-guide.ts`

Wrap the existing first-week body in `pendingFirstWeekSequence` (verbatim move — do not change its logic), and add the feature-briefing evaluator. Add these pure helpers and rewrite the exported entry point:

```ts
import {
  hasAssistantGuideMilestone,
  type AssistantGuideSequenceId,
  type GameState,
} from '../game';
import type { ManagementTab } from '../ui/models';

export function pendingAssistantGuideSequence(
  state: GameState,
  activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  const firstWeek = pendingFirstWeekSequence(state, activeTab);
  if (firstWeek !== null) return firstWeek;
  return pendingFeatureBriefing(state, activeTab);
}

// --- unchanged first-week logic, moved verbatim from the old body ---
function pendingFirstWeekSequence(
  state: GameState,
  activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  if (!isFirstCareerWeek(state)) return null;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return 'management-intro';
  if (activeTab === 'squad' && !hasAssistantGuideMilestone(state, 'squad-intro-complete')) {
    return 'squad-intro';
  }
  if (
    activeTab === 'home'
    && hasAssistantGuideMilestone(state, 'squad-intro-complete')
    && hasAssistantGuideMilestone(state, 'first-training-complete')
    && (state.facilities.trainingGroundBuilt || isTrainingGroundUnderConstruction(state))
    && !hasAssistantGuideMilestone(state, 'desk-intro-complete')
    && !hasAssistantGuideMilestone(state, 'first-week-advanced')
  ) {
    return 'desk-intro';
  }
  return null;
}

// --- beyond week 1 ---
function pendingFeatureBriefing(
  state: GameState,
  activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  if (state.careerMode !== 'full') return null;
  if (state.onboarding !== undefined && state.onboarding.stage !== 'complete') return null;

  if (
    activeTab === 'market'
    && !hasAssistantGuideMilestone(state, 'market-intro-complete')
  ) {
    return 'market-intro';
  }
  if (
    activeTab === 'club'
    && state.facilities.trainingGroundBuilt
    && !hasAssistantGuideMilestone(state, 'facilities-intro-complete')
  ) {
    return 'facilities-intro';
  }
  if (
    activeTab === 'home'
    && hasExpiredHeroContract(state)
    && !hasAssistantGuideMilestone(state, 'renewal-cliff-complete')
  ) {
    return 'renewal-cliff-intro';
  }
  return null;
}

/** An awakened player whose bargain contract has run out and has not yet moved to hero wages. */
function hasExpiredHeroContract(state: GameState): boolean {
  return state.players.some(player =>
    player.clubId === state.userClubId
    && player.power !== undefined
    && !player.onHeroWage
    && player.contractSeasonsRemaining === 0);
}
```
Keep the existing `isTrainingGroundUnderConstruction` and `isFirstCareerWeek` helpers. Leave `currentAssistantObjective` untouched (objectives stay a first-week-only concept).

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest src/application/__tests__/assistant-guide.test.ts`
Expected: PASS — new triggers fire once each, m1-slice is inert, first-week behavior identical (including the existing stale-save `null` cases).

- [ ] **Step 5: Commit**

```bash
git add src/application/assistant-guide.ts src/application/__tests__/assistant-guide.test.ts
git commit -m "feat(bert): trigger feature briefings beyond week one"
```

---

### Task A4: Verify the live overlay picks up the new sequences (no code expected)

**Files:**
- Verify: `App.tsx:498-503, 827-836` — resolves the sequence from `content.assistantGuide.sequences` and renders `AssistantGuideOverlay` for any management tab. New sequences are data, so this should "just work."

- [ ] **Step 1: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS. If `App.tsx` has an exhaustive `switch` on sequence IDs anywhere, add the three new cases; otherwise no edit.

- [ ] **Step 2: Manual smoke (device/sim), then commit any wiring fix**

Confirm: in a fresh full career, past week 1 — opening Market shows the market briefing once; visiting Club after the training ground completes shows the facilities briefing once; the season-end after your created striker's contract expires shows the wage-cliff briefing once. Each never repeats.

```bash
git commit -am "chore(bert): verify overlay renders new briefings" --allow-empty
```

---

# PART B — Bert's coaching notes (contextual desk advice)

### Task B1: Pure struggle-detection helpers

**Files:**
- Create: `src/game/assistant-advice.ts`
- Test: `src/game/__tests__/assistant-advice.test.ts`

Each note is `{ id, title, detail }`. `assistantAdviceNotes` returns **at most 2**, in priority order, and only in full career. Conditions are written so a note never coexists with the board's own urgent alert for the same problem.

- [ ] **Step 1: Write the failing test** — `src/game/__tests__/assistant-advice.test.ts`

```ts
import { assistantAdviceNotes } from '../assistant-advice';
// Reuse an existing full-career state builder from src/game/__tests__ helpers.

test('thin cash cushion warns before the board does', () => {
  const state = fullCareerFixture({ cash: 1000, weeklyWages: 500, consecutiveNegativeWeeks: 0 });
  const ids = assistantAdviceNotes(state).map(note => note.id);
  expect(ids).toContain('bert-tip-cash');
});

test('cash note is silent once cash is already negative (board takes over)', () => {
  const state = fullCareerFixture({ cash: -500, weeklyWages: 500, consecutiveNegativeWeeks: 2 });
  const ids = assistantAdviceNotes(state).map(note => note.id);
  expect(ids).not.toContain('bert-tip-cash');
});

test('three losses in the last five triggers the form note', () => {
  const state = fullCareerFixture({ lastResults: ['L', 'L', 'W', 'L', 'D'] });
  expect(assistantAdviceNotes(state).some(n => n.id === 'bert-tip-form')).toBe(true);
});

test('low morale warns only before a transfer request exists', () => {
  const unhappy = fullCareerFixture({ player: { name: 'Ree', morale: 20, transferRequested: false } });
  expect(assistantAdviceNotes(unhappy).some(n => n.id.startsWith('bert-tip-morale'))).toBe(true);
  const requested = fullCareerFixture({ player: { name: 'Ree', morale: 20, transferRequested: true } });
  expect(assistantAdviceNotes(requested).some(n => n.id.startsWith('bert-tip-morale'))).toBe(false);
});

test('at most two notes are returned', () => {
  const state = fullCareerFixture({
    cash: 1000, weeklyWages: 500, consecutiveNegativeWeeks: 0,
    lastResults: ['L', 'L', 'L', 'L', 'L'],
    player: { name: 'Ree', morale: 10, transferRequested: false, condition: 10, injuryWeeks: 0 },
  });
  expect(assistantAdviceNotes(state).length).toBeLessThanOrEqual(2);
});

test('m1-slice career produces no advice', () => {
  const state = fullCareerFixture({ careerMode: 'm1-slice', lastResults: ['L', 'L', 'L'] });
  expect(assistantAdviceNotes(state)).toEqual([]);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/game/__tests__/assistant-advice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `src/game/assistant-advice.ts`

```ts
import type { CareerPlayer, GameState, LeagueFixture } from './types';

export interface AdviceNote {
  id: string;
  title: string;
  detail: string;
}

const LOW_MORALE = 30;        // mirrors LOW_MORALE_THRESHOLD (pyramid.ts)
const LOW_CONDITION = 30;     // mirrors OVERTRAINING_CONDITION_THRESHOLD (player-wellbeing.ts)
const CASH_CUSHION_WEEKS = 4; // "less than a month of wages banked"
const FORM_WINDOW = 5;
const FORM_LOSS_TRIGGER = 3;
const MAX_NOTES = 2;

export function assistantAdviceNotes(state: GameState): AdviceNote[] {
  if (state.careerMode !== 'full') return [];
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) return [];
  const roster = state.players.filter(player => player.clubId === state.userClubId);
  const negativeWeeks = state.financialSafety?.consecutiveNegativeWeeks ?? 0;

  // Priority order: money, form, morale, condition. Cap at MAX_NOTES.
  const notes: AdviceNote[] = [];

  if (negativeWeeks === 0 && club.cash > 0 && club.cash < CASH_CUSHION_WEEKS * club.weeklyWages) {
    notes.push({
      id: 'bert-tip-cash',
      title: "Bert: the cushion's thin",
      detail: "Cash won't cover a month of wages. Nudge ticket prices up or trim a drill before the board starts asking questions.",
    });
  }

  if (recentLosses(state) >= FORM_LOSS_TRIGGER) {
    notes.push({
      id: 'bert-tip-form',
      title: 'Bert: results are slipping',
      detail: 'Three losses in five. Put training points into your starters, or scout some help.',
    });
  }

  const unhappy = firstMatch(roster, player =>
    player.morale <= LOW_MORALE && player.transferRequested !== true);
  if (unhappy !== undefined) {
    notes.push({
      id: `bert-tip-morale-${unhappy.id}`,
      title: `Bert: ${unhappy.name} is unsettled`,
      detail: "Morale's low but he hasn't asked to leave yet. Give him minutes—or a Motivator coach steadies the room.",
    });
  }

  const rundown = firstMatch(roster, player =>
    player.condition !== undefined && player.condition < LOW_CONDITION && player.injuryWeeks === 0);
  if (rundown !== undefined) {
    notes.push({
      id: `bert-tip-condition-${rundown.id}`,
      title: `Bert: ${rundown.name} is run down`,
      detail: "Condition's in the red. Ease his training this week or you'll be picking up an injury.",
    });
  }

  return notes.slice(0, MAX_NOTES);
}

function recentLosses(state: GameState): number {
  const played = state.fixtures
    .filter((fixture): fixture is LeagueFixture & { score: NonNullable<LeagueFixture['score']> } =>
      fixture.status === 'played'
      && fixture.score !== undefined
      && (fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId))
    .sort((left, right) => right.week - left.week || right.round - left.round)
    .slice(0, FORM_WINDOW);
  return played.reduce((losses, fixture) => {
    const home = fixture.homeClubId === state.userClubId;
    const ours = home ? fixture.score.homeGoals : fixture.score.awayGoals;
    const theirs = home ? fixture.score.awayGoals : fixture.score.homeGoals;
    return losses + (ours < theirs ? 1 : 0);
  }, 0);
}

function firstMatch(
  roster: readonly CareerPlayer[],
  predicate: (player: CareerPlayer) => boolean,
): CareerPlayer | undefined {
  return [...roster].sort((a, b) => a.name.localeCompare(b.name)).find(predicate);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest src/game/__tests__/assistant-advice.test.ts`
Expected: PASS.

- [ ] **Step 5: Export + commit**

Add `export * from './assistant-advice';` to `src/game/index.ts` (match the file's existing export style).

```bash
git add src/game/assistant-advice.ts src/game/__tests__/assistant-advice.test.ts src/game/index.ts
git commit -m "feat(bert): pure struggle-detection advice notes"
```

---

### Task B2: Surface the notes on the Home desk

**Files:**
- Modify: `src/application/view-models.ts:439-476` (the `homeViewModel` `alerts` array)
- Test: `src/application/__tests__/home-training-ground-inbox.test.ts` (or the nearest home view-model test)

- [ ] **Step 1: Write the failing test** — add to the home view-model test file

```ts
import { assistantAdviceNotes } from '../../game';

test('home inbox surfaces Bert advice as event-tone alerts', () => {
  const state = strugglingFullCareerState(); // thin cash, poor form, etc.
  const vm = homeViewModel(state);
  const bert = vm.alerts.filter(alert => alert.id.startsWith('bert-tip-'));
  expect(bert.length).toBeGreaterThan(0);
  expect(bert.every(alert => alert.tone === 'event')).toBe(true);
  // one alert per advice note
  expect(bert.length).toBe(assistantAdviceNotes(state).length);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx jest src/application/__tests__/home-training-ground-inbox.test.ts -t 'Bert advice'`
Expected: FAIL — no `bert-tip-*` alerts.

- [ ] **Step 3: Append advice to the alerts array** in `homeViewModel`

Add the import at the top of `src/application/view-models.ts`:
```ts
import { assistantAdviceNotes } from '../game';
```
Then extend the `alerts` array (after the `emergency-loan` entry, still inside the array literal at ~line 475):
```ts
    ...assistantAdviceNotes(state).map(note => ({
      id: note.id,
      title: note.title,
      detail: note.detail,
      tone: 'event' as const,
    })),
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx jest src/application/__tests__/home-training-ground-inbox.test.ts`
Expected: PASS. Also run `npx jest src/application/__tests__/` to confirm no snapshot of the alerts array broke.

- [ ] **Step 5: Commit**

```bash
git add src/application/view-models.ts src/application/__tests__/home-training-ground-inbox.test.ts
git commit -m "feat(bert): show coaching notes on the home desk"
```

---

### Task B3: Route note taps to the right tab

**Files:**
- Modify: `App.tsx:776-791` (`onOpenAlert` id-prefix switch)

- [ ] **Step 1: Add routing cases** to the `onOpenAlert` handler

Before the fallthrough `store.notify(...)`, add:
```ts
    if (id === 'bert-tip-cash') { store.openManagement('club'); return; }
    if (
      id === 'bert-tip-form'
      || id.startsWith('bert-tip-morale')
      || id.startsWith('bert-tip-condition')
    ) { store.openManagement('squad'); return; }
```
Use whatever the file's existing tab-navigation call is (mirror how `injury-`/`training-ground` ids navigate today — e.g. `store.openManagement(tab)` or `store.setActiveTab(tab)`).

- [ ] **Step 2: Typecheck + full suite**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Manual smoke, then commit**

In a struggling save, tap Bert's cash note → lands on Club/Finances; tap a form/morale/condition note → lands on Squad.

```bash
git add App.tsx
git commit -m "feat(bert): route coaching-note taps to the relevant tab"
```

---

## Self-review

- **Spec coverage:**
  - "Bert introduces the coach and how useful it is" → Task A2 `market-intro` page 4 (the +10%/level, ×1.5 at max, Motivator note).
  - "Explain other non-intuitive features" → `market-intro` (scout-before-you-buy, transfer window), `facilities-intro` (upgrade levels, adjacency pairs), `renewal-cliff-intro` (the ×4 wage cliff).
  - "Pointers when struggling — economy, losing too many games → needs training" → Task B1 `bert-tip-cash` (economy) and `bert-tip-form` ("put training points into your starters, or scout"), plus morale/condition nudges.
  - "Pro tips" → the coaching-note framework is the seam; the four seeded notes are the v1 set, extensible by adding predicates in `assistant-advice.ts`. (One-time dismissible tips are the flagged out-of-scope follow-up.)
- **Placeholder scan:** every code step shows real code; every JSON page is written out; no "TBD".
- **Type consistency:** `AssistantGuideSequenceId` / `AssistantGuideMilestone` unions, `FLAG_BY_MILESTONE`, and `MILESTONE_BY_SEQUENCE` all extended with the same three IDs (`market-intro`, `facilities-intro`, `renewal-cliff-intro`); `AdviceNote` shape `{ id, title, detail }` matches the `homeViewModel` mapping to `{ id, title, detail, tone: 'event' }`; `ClubAlertViewModel.tone` already includes `'event'`.
- **Test builders:** the tests above assume full-career state builders (`fullCareerState`, `fullCareerFixture`, `strugglingFullCareerState`). Before Task A3/B1, check `src/application/__tests__/assistant-guide.test.ts` and `src/game/__tests__/` for the existing builder and reuse it; if none is full-career-shaped, add a small local factory in the test file rather than inventing a shared one.

---

## Execution notes

- Part A and Part B are independent — ship A first (higher-value, reuses existing machinery) or B first; neither depends on the other.
- No `ENGINE_VERSION` bump: nothing here touches `src/sim/` or replay-affecting behavior.
- No save-codec change: no new persisted `GameState` fields (advice is derived; briefing state reuses existing `eventFlags`).
- Run the balance harness (`npm test` includes it) after Part B — the `careerMode !== 'full'` guard should keep deterministic M1 assertions byte-identical; if any balance snapshot moves, that guard has a leak.
