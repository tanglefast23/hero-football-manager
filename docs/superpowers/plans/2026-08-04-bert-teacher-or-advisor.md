# Bert as Teacher or Advisor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a device has won both trophies, starting a new game asks whether Bert should teach; choosing Advisor silences every teaching surface and lifts the three blocks on Advance Week, while keeping him for every decision and story beat.

**Architecture:** One optional enum on `GameState` (`assistantMode`, absent = `'teacher'`), read through a single exported predicate `assistantTeaches(state)`. Four pure functions in the application ring return empty for Advisor, which cascades to nearly every surface; the remaining one-shots are gated at their `App.tsx` call sites. The unlock (`climbCompleted`) lives in `AppPreferences` because it is the only fact that must survive `startNewCareer()` erasing the save.

**Tech Stack:** TypeScript, React Native (Expo), zustand, zod, Jest (`testEnvironment: 'node'` — no DOM, no `react-native` import).

**Spec:** `docs/superpowers/specs/2026-08-04-bert-teacher-or-advisor-design.md`

---

## File Structure

**Create:**
- `src/ui/assistant-mode-choice.ts` — the prompt's copy and Bert moment, as a pure module so Jest can assert on it without a DOM
- `src/ui/screens/AssistantModeChoiceScreen.tsx` — the prompt screen
- `src/application/__tests__/assistant-mode.test.ts` — the four functions honour the mode
- `src/application/__tests__/assistant-mode-blocks.test.ts` — the three Advance Week blocks
- `src/application/__tests__/climb-completed-unlock.test.ts` — unlock set + backfill
- `src/ui/__tests__/assistant-mode-choice.test.ts` — copy module + App/Settings wiring assertions

**Modify:**
- `src/game/types.ts` — `AssistantMode` type, `assistantMode?` on `GameState`
- `src/game/assistant-guide.ts` — export `assistantTeaches`
- `src/persistence/game-state-codec.ts:925` — codec field
- `src/persistence/preferences-repository.ts` — add `climbCompleted`, retire `managerTipsEnabled`, schema version 8
- `src/application/assistant-guide.ts` — four early-returns
- `src/application/store.ts` — three blocks, `startNewCareer(seed, mode)`, `setAssistantMode`, unlock backfill
- `src/ui/SettingsOverlay.tsx` — the Bert row replaces the Manager's tips row
- `src/ui/screens/ClubHomeScreen.tsx` — unchanged prop, new source
- `App.tsx` — routing, one-shot gates, Settings wiring
- `src/ui/index.ts` — export the new screen

---

## Task 1: The mode on `GameState`

**Files:**
- Modify: `src/game/types.ts:698`
- Modify: `src/game/assistant-guide.ts`
- Modify: `src/persistence/game-state-codec.ts:925`
- Test: `src/persistence/__tests__/game-state-codec.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/persistence/__tests__/game-state-codec.test.ts`, inside the outermost `describe`:

```ts
  it('round-trips the assistant mode and defaults an old save to teacher', () => {
    const base = decodeGameState(encodeGameState(sampleState()));
    expect(base.assistantMode).toBeUndefined();
    expect(assistantTeaches(base)).toBe(true);

    const advisor = decodeGameState(
      encodeGameState({ ...sampleState(), assistantMode: 'advisor' }),
    );
    expect(advisor.assistantMode).toBe('advisor');
    expect(assistantTeaches(advisor)).toBe(false);
  });
```

Add `import { assistantTeaches } from '../../game/assistant-guide';` to the file's imports. If the existing suite names its fixture builder something other than `sampleState()`, use that name instead — do not invent a second builder.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/persistence/__tests__/game-state-codec.test.ts -t "assistant mode"`
Expected: FAIL — `assistantTeaches` is not exported.

- [ ] **Step 3: Add the type and the field**

In `src/game/types.ts`, above the `GameState` interface:

```ts
/**
 * Whether Bert teaches this career.
 *
 * `teacher` is the shipped game: 24 inbox explainers, the objective line, the
 * one-shot lessons, and the opening weeks that hold Advance Week until the desk
 * is clear. `advisor` keeps him for every decision and every story beat and
 * takes away everything that explains or enforces.
 */
export type AssistantMode = 'teacher' | 'advisor';
```

Then, immediately after the `difficulty?: DifficultyMode;` line at `src/game/types.ts:698`:

```ts
  /** Old saves omit this and are taught, exactly as they were. */
  assistantMode?: AssistantMode;
```

- [ ] **Step 4: Add the predicate**

At the top of `src/game/assistant-guide.ts`, change the import line to bring in the type, then add the predicate below the existing imports:

```ts
import type { AssistantMode, GameState } from './types';

/**
 * Whether Bert is teaching this career.
 *
 * THE ONLY PLACE THE MODE IS COMPARED. Every gate reads this rather than
 * testing the field inline, so `assistantTeaches` greps to the complete list of
 * surfaces the mode governs — which is how a teaching surface added later gets
 * found instead of silently firing for a manager who turned him off.
 */
export function assistantTeaches(
  state: Pick<GameState, 'assistantMode'>,
): boolean {
  return (state.assistantMode ?? 'teacher') === 'teacher';
}

export type { AssistantMode };
```

- [ ] **Step 5: Add the codec field**

In `src/persistence/game-state-codec.ts`, directly after the `difficulty` line at 925:

```ts
    assistantMode: z.enum(['teacher', 'advisor']).optional(),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/persistence/__tests__/game-state-codec.test.ts -t "assistant mode"`
Expected: PASS

- [ ] **Step 7: Verify `src/game` still exports cleanly**

Run: `npx tsc --noEmit`
Expected: no errors. If `assistantTeaches` is not reachable from `src/game/index.ts`, add it to that file's export list alongside the other `assistant-guide` exports.

- [ ] **Step 8: Commit**

```bash
git add src/game/types.ts src/game/assistant-guide.ts src/game/index.ts src/persistence/game-state-codec.ts src/persistence/__tests__/game-state-codec.test.ts
git commit -m "feat: record whether a career is taught"
```

---

## Task 2: The four functions honour the mode

**Files:**
- Modify: `src/application/assistant-guide.ts:34,69,271,351`
- Test: `src/application/__tests__/assistant-mode.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/assistant-mode.test.ts`:

```ts
import { useM1Store } from '../store';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import type { GameState } from '../../game/types';
import {
  currentAssistantObjective,
  dueAssistantInboxGuideSequences,
  outstandingInboxDuties,
  pendingAssistantGuideSequence,
} from '../assistant-guide';

/**
 * The mode, from the four functions that decide what Bert does.
 *
 * Both careers are built from the same seed, so any difference below is the
 * mode and nothing else.
 */
function openedCareer(): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  return useM1Store.getState().career!;
}

describe('a taught career', () => {
  it('has an opening walk-on, an objective, inbox firsts and a duty', () => {
    const career = openedCareer();
    expect(pendingAssistantGuideSequence(career, 'home')).toBe('management-intro');
    expect(dueAssistantInboxGuideSequences(career).length).toBeGreaterThan(0);

    // The objective only speaks after the intro has been watched, so bank the
    // milestone the walk-on would have banked. Without this the assertion below
    // passes for the wrong reason.
    useM1Store.getState().completeGuideMilestone('intro-complete');
    const introduced = useM1Store.getState().career!;
    expect(currentAssistantObjective(introduced, 'home')).not.toBeNull();
  });

  it('holds week two for the youth intake', () => {
    openedCareer();
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toContain('youth-intake');
  });
});

describe('an advised career', () => {
  it('has no walk-on, no objective and no inbox firsts', () => {
    const career = { ...openedCareer(), assistantMode: 'advisor' as const };
    expect(pendingAssistantGuideSequence(career, 'home')).toBeNull();
    expect(dueAssistantInboxGuideSequences(career)).toEqual([]);
    expect(currentAssistantObjective(career, 'home')).toBeNull();
  });

  it('never holds a week for a desk duty', () => {
    openedCareer();
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    const weekTwo = { ...useM1Store.getState().career!, assistantMode: 'advisor' as const };
    expect(outstandingInboxDuties(weekTwo)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/assistant-mode.test.ts`
Expected: FAIL — the advised career still returns `'management-intro'`, a non-empty due list, an objective, and `['youth-intake']`.

- [ ] **Step 3: Add the four early-returns**

In `src/application/assistant-guide.ts`, add `assistantTeaches` to the existing import block from `'../game'`, then add one guard as the first line of each function body.

`pendingAssistantGuideSequence` (line 34):

```ts
export function pendingAssistantGuideSequence(
  state: GameState,
  _activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  if (!assistantTeaches(state)) return null;
  if (isFirstCareerWeek(state)) {
```

`dueAssistantInboxGuideSequences` (line 69):

```ts
export function dueAssistantInboxGuideSequences(
  state: GameState,
): AssistantInboxGuideSequenceId[] {
  if (!assistantTeaches(state)) return [];
  if (state.market === undefined || state.m2 === undefined) {
```

`outstandingInboxDuties` (line 271):

```ts
export function outstandingInboxDuties(
  state: GameState,
): AssistantInboxGuideSequenceId[] {
  if (!assistantTeaches(state)) return [];
  if (state.season !== 1 || state.week > LAST_GATED_INBOX_WEEK) return [];
```

`currentAssistantObjective` (line 351):

```ts
export function currentAssistantObjective(
  state: GameState,
  activeTab: ManagementTab,
): AssistantObjective | null {
  if (!assistantTeaches(state)) return null;
  if (!isFirstCareerWeek(state)) return null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/application/__tests__/assistant-mode.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify no existing suite regressed**

Run: `npx jest src/application/__tests__/assistant-guide.test.ts src/application/__tests__/inbox-duty-gate.test.ts`
Expected: PASS. These build careers with no `assistantMode`, so every one of them is a Teacher career and must be untouched.

- [ ] **Step 5: Commit**

```bash
git add src/application/assistant-guide.ts src/application/__tests__/assistant-mode.test.ts
git commit -m "feat: silence Bert's teaching for an advised career"
```

---

## Task 3: Lift the three Advance Week blocks

**Files:**
- Modify: `src/application/store.ts:669-700,752`
- Test: `src/application/__tests__/assistant-mode-blocks.test.ts` (create)

The third block already lifts, because `outstandingInboxDuties` now returns `[]` for Advisor. The first two are guarded by `intro-complete` and would fall away on their own — they are gated explicitly anyway, per the spec, so a future change that banks the milestone cannot silently restore them.

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/assistant-mode-blocks.test.ts`:

```ts
import { useM1Store } from '../store';
import { DEFAULT_CREATION_RATINGS } from '../../game';

/**
 * The three walls on Advance Week, from the button's side.
 *
 * The Teacher cases bank `intro-complete` first. Two of the three walls are
 * guarded by that milestone and a headless career never watches the walk-on
 * that banks it — so without this line the Teacher assertions would pass
 * against a career that was never being blocked in the first place.
 */
function openedCareer(mode: 'teacher' | 'advisor') {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123, mode);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

describe('a taught opening still holds the week', () => {
  beforeEach(() => {
    openedCareer('teacher');
    useM1Store.getState().completeGuideMilestone('intro-complete');
  });

  it('refuses to advance before the first training', () => {
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(1);
    expect(useM1Store.getState().error).toBe('Train a player before advancing the week.');
  });

  it('holds week two for the youth intake', () => {
    useM1Store.getState().completeGuideMilestone('first-training-complete');
    useM1Store.getState().completeGuideMilestone('first-week-advanced');
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().inboxDutyReminder).toContain('youth-intake');
  });
});

describe('an advised opening never holds the week', () => {
  beforeEach(() => {
    openedCareer('advisor');
    useM1Store.getState().completeGuideMilestone('intro-complete');
  });

  it('advances with nothing trained and nothing built', () => {
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().error).toBeNull();
  });

  it('advances past week two with the youth intake unanswered', () => {
    useM1Store.getState().advanceCareer();
    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(3);
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
    expect(useM1Store.getState().error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/assistant-mode-blocks.test.ts`
Expected: FAIL — `startNewCareer` takes one argument, so `'advisor'` is rejected by the compiler and both advised cases behave as Teacher.

- [ ] **Step 3: Widen `startNewCareer`**

In `src/application/store.ts`, change the interface entry at line 244:

```ts
  startNewCareer: (seed?: number, assistantMode?: AssistantMode) => void;
```

Add `AssistantMode` to the type imports from `'../game/types'` (or from `'../game'` if that is where the file's other game types come from — match the file's existing import).

Then in the implementation at line 476, thread it into the created career:

```ts
  startNewCareer(seed, assistantMode) {
    guarded(set, () => {
      if (get().persistenceLoadError !== null) {
        throw new Error('Resolve the save-load error before replacing this career.');
      }
      const replacedCareer = get().career;
      const career = beginStoryOnboarding(createCareer({
        ...createLaunchCareerSetup(
          seed ?? generateCareerSeed(),
          undefined,
          launchContent,
        ),
        playerRequestRules: launchContent.playerRequests,
      }));
      const opened = assistantMode === undefined
        ? career
        : { ...career, assistantMode };
      set({
        career: opened,
```

and change the two later references in that action from `career` to `opened`:

```ts
      queueNewCareerSave(get, set, opened, replacedCareer);
```

Leave the existing comment above `beginStoryOnboarding` in place — it explains why player requests are attached here and is still true.

- [ ] **Step 4: Gate the two milestone-guarded blocks**

In `src/application/store.ts`, add `assistantTeaches` to the existing import from `'../game'`. Then in `advanceCareer`, replace the block starting at line 669:

```ts
      if (
        assistantTeaches(career)
        && hasAssistantGuideMilestone(career, 'intro-complete')
        && !hasAssistantGuideMilestone(career, 'first-training-complete')
      ) {
        throw new Error('Train a player before advancing the week.');
      }
      const guidedFirstWeek = assistantTeaches(career)
        && hasAssistantGuideMilestone(career, 'intro-complete')
        && hasAssistantGuideMilestone(career, 'first-training-complete')
        && !hasAssistantGuideMilestone(career, 'first-week-advanced');
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/application/__tests__/assistant-mode-blocks.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the opening is unchanged for everyone else**

Run: `npx jest src/application/__tests__/inbox-duty-gate.test.ts src/application/__tests__/default-career-journey.test.ts src/application/__tests__/store.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/store.ts src/application/__tests__/assistant-mode-blocks.test.ts
git commit -m "feat: let an advised career advance its own weeks"
```

---

## Task 4: Change the mode mid-career

**Files:**
- Modify: `src/application/store.ts`
- Test: `src/application/__tests__/assistant-mode-blocks.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/assistant-mode-blocks.test.ts`:

```ts
describe('changing his job mid-career', () => {
  it('persists the new mode on the career', () => {
    openedCareer('teacher');
    expect(useM1Store.getState().career?.assistantMode).toBe('teacher');

    useM1Store.getState().setAssistantMode('advisor');
    expect(useM1Store.getState().career?.assistantMode).toBe('advisor');

    useM1Store.getState().setAssistantMode('teacher');
    expect(useM1Store.getState().career?.assistantMode).toBe('teacher');
  });

  it('does nothing when no career is loaded', () => {
    useM1Store.setState(useM1Store.getInitialState(), true);
    useM1Store.getState().setAssistantMode('advisor');
    expect(useM1Store.getState().career).toBeNull();
    expect(useM1Store.getState().error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/assistant-mode-blocks.test.ts -t "mid-career"`
Expected: FAIL — `setAssistantMode` is not a function.

- [ ] **Step 3: Add the store action**

In `src/application/store.ts`, add to the interface beside `startNewCareer`:

```ts
  /** Settings' Bert row. A no-op with no career: there is nothing to advise. */
  setAssistantMode: (assistantMode: AssistantMode) => void;
```

And the implementation, next to `completeGuideMilestone`:

```ts
  setAssistantMode(assistantMode) {
    guarded(set, () => {
      const career = get().career;
      if (career === null) return;
      if ((career.assistantMode ?? 'teacher') === assistantMode) return;
      const next = { ...career, assistantMode };
      set({ career: next, error: null });
      queueCareerSave(get, set, next);
    });
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/application/__tests__/assistant-mode-blocks.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/store.ts src/application/__tests__/assistant-mode-blocks.test.ts
git commit -m "feat: let Settings change Bert's job mid-career"
```

---

## Task 5: The unlock in preferences

**Files:**
- Modify: `src/persistence/preferences-repository.ts`
- Modify: `src/application/preferences.ts`
- Test: `src/persistence/__tests__/preferences-repository.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/persistence/__tests__/preferences-repository.test.ts`, inside the outermost `describe`. Match the file's existing helper for building a fake database and seeding a row — read the top of the file first and reuse it rather than writing a second one.

```ts
  it('defaults a fresh install to a locked climb', async () => {
    const repository = await createPreferencesRepository(createFakeDatabase());
    const preferences = await repository.load();
    expect(preferences.climbCompleted).toBe(false);
    expect('managerTipsEnabled' in preferences).toBe(false);
  });

  it('migrates a version 7 row by dropping the tips flag and locking the climb', async () => {
    const database = createFakeDatabase();
    await database.runAsync(
      `INSERT INTO app_preferences (slot, schema_version, preferences_json) VALUES (?, ?, ?)`,
      [
        'primary',
        7,
        JSON.stringify({
          formationPresets: ['4-4-2', '4-3-3', '5-3-2'],
          autoPowers: false,
          masterVolume: 1,
          reduceMotion: false,
          hudSide: 'left',
          hapticsEnabled: true,
          textScale: 1,
          highContrast: false,
          colorSafeKits: true,
          cutInMode: 'full',
          managerTipsEnabled: false,
          seenPowerCutIns: [],
          autoSubs: false,
          squadSort: null,
        }),
      ],
    );

    const repository = await createPreferencesRepository(database);
    const preferences = await repository.load();
    expect(preferences.climbCompleted).toBe(false);
    expect('managerTipsEnabled' in preferences).toBe(false);
  });

  it('round-trips a completed climb', async () => {
    const repository = await createPreferencesRepository(createFakeDatabase());
    const preferences = await repository.load();
    await repository.save({ ...preferences, climbCompleted: true });
    expect((await repository.load()).climbCompleted).toBe(true);
  });
```

The three `formationPresets` values above must be real `FormationId`s that the file's other fixtures already use, and must be distinct — `PreferencesSchema` refines on uniqueness. Copy them from an existing fixture in the same file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: FAIL — `climbCompleted` does not exist on `AppPreferences`.

- [ ] **Step 3: Change the shape**

In `src/persistence/preferences-repository.ts`, in `AppPreferences` (line 36), **delete** `managerTipsEnabled: boolean;` and add:

```ts
  /**
   * Whether this device has ever finished the climb.
   *
   * It lives here rather than on the career because it is the one fact that has
   * to outlive `startNewCareer()` wiping the save — the completion proof itself
   * (`TRUE_ENDING_SEEN_FLAG`, `hallOfFame`) is inside `GameState`.
   */
  climbCompleted: boolean;
```

In `DEFAULT_APP_PREFERENCES` (line 55), delete `managerTipsEnabled: true,` and add `climbCompleted: false,`.

In `PreferencesSchema` (line 82), delete `managerTipsEnabled: z.boolean(),` and add `climbCompleted: z.boolean(),`.

- [ ] **Step 4: Extend the version ladder**

At the top of `src/persistence/preferences-repository.ts`, change line 13 and add the new constant:

```ts
const PREFERENCES_SCHEMA_VERSION = 8;
```
```ts
const AUTO_SUBS_PREFERENCES_SCHEMA_VERSION = 6;
const MANAGER_TIPS_ROW_SCHEMA_VERSION = 7;
```

Every schema in the `pick`/`omit` ladder is now derived from a `PreferencesSchema` that no longer has `managerTipsEnabled`, so each older schema needs it added back — those rows really do contain it. Replace the ladder definitions (lines 109–136) with:

```ts
const RetiredTipsShape = { managerTipsEnabled: z.boolean() };

const LegacyPreferencesSchema = PreferencesSchema.pick({
  formationPresets: true,
  autoPowers: true,
  masterVolume: true,
});
const M2PreferencesSchema = PreferencesSchema.pick({
  formationPresets: true,
  autoPowers: true,
  masterVolume: true,
  reduceMotion: true,
  hudSide: true,
});
const M4PreferencesSchema = PreferencesSchema.omit({
  seenPowerCutIns: true,
  autoSubs: true,
  squadSort: true,
  climbCompleted: true,
});
const CutInHistoryPreferencesSchema = PreferencesSchema.omit({
  autoSubs: true,
  squadSort: true,
  climbCompleted: true,
});
const ManagerTipsPreferencesSchema = PreferencesSchema
  .omit({ autoSubs: true, squadSort: true, climbCompleted: true })
  .extend(RetiredTipsShape);
const AutoSubsPreferencesSchema = PreferencesSchema
  .omit({ squadSort: true, climbCompleted: true })
  .extend(RetiredTipsShape);
const ManagerTipsRowSchema = PreferencesSchema
  .omit({ climbCompleted: true })
  .extend(RetiredTipsShape);
```

- [ ] **Step 5: Fill the new field in every migration branch**

In each of the six existing branches in `load()` (lines 173–300), the `migrated` object spreads `legacy.data`. Two edits per branch:

- Every branch that currently writes `managerTipsEnabled: DEFAULT_APP_PREFERENCES.managerTipsEnabled,` — delete that line.
- Every branch gains `climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,`.

The four branches whose schema now carries the retired key (`M4`, `CutInHistory`, `ManagerTips`, `AutoSubs`) must also strip it, because `PreferencesSchema.parse` in `save()` is a `strictObject` and would reject it. Destructure it away rather than spreading it through — for the `AutoSubs` branch:

```ts
      if (row.schema_version === AUTO_SUBS_PREFERENCES_SCHEMA_VERSION) {
        const legacy = AutoSubsPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const { managerTipsEnabled: _retired, ...carried } = legacy.data;
        const migrated: AppPreferences = {
          ...carried,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
```

Apply the same `const { managerTipsEnabled: _retired, ...carried }` shape to the `M4`, `CutInHistory` and `ManagerTips` branches. The `Legacy` and `M2` branches pick so few fields that they never carry it, and only need the `climbCompleted` line added and their `managerTipsEnabled:` line removed.

- [ ] **Step 6: Add the version 7 branch**

Directly above the final `if (row.schema_version !== PREFERENCES_SCHEMA_VERSION)` check (line 302):

```ts
      if (row.schema_version === MANAGER_TIPS_ROW_SCHEMA_VERSION) {
        const legacy = ManagerTipsRowSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const { managerTipsEnabled: _retired, ...carried } = legacy.data;
        const migrated: AppPreferences = {
          ...carried,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          // A device that has finished the climb re-earns the prompt from its
          // own save on the next load — see the backfill in Task 6.
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
```

- [ ] **Step 7: Run the tests**

Run: `npx jest src/persistence/__tests__/preferences-repository.test.ts`
Expected: PASS. Every pre-existing case in this file must still pass; if one asserts on `managerTipsEnabled`, delete that assertion — the field is retired, not renamed.

- [ ] **Step 8: Fix the two compile sites**

Run: `npx tsc --noEmit`
Expected: errors in `src/application/preferences.ts` (nothing to change — it spreads) and `App.tsx` + `src/ui/SettingsOverlay.tsx`. Leave the App and Settings errors for Task 8; they are fixed there. If `src/application/preferences.ts` reports an error, it is because `defaultPreferences()` clones array fields explicitly — `climbCompleted` is a boolean and needs no clone, so no change is required there.

- [ ] **Step 9: Commit**

```bash
git add src/persistence/preferences-repository.ts src/persistence/__tests__/preferences-repository.test.ts
git commit -m "feat: remember that this device finished the climb"
```

---

## Task 6: Set and backfill the unlock

**Files:**
- Modify: `src/application/store.ts:1018`
- Test: `src/application/__tests__/climb-completed-unlock.test.ts` (create)

The store cannot write preferences — it has no reference to them. It exposes the fact, and `App.tsx` mirrors it in Task 8.

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/climb-completed-unlock.test.ts`:

```ts
import { useM1Store } from '../store';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { TRUE_ENDING_SEEN_FLAG } from '../endgame-celebration';

function openedCareer() {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

describe('the climb, as the app can read it', () => {
  it('is unfinished for a new career', () => {
    openedCareer();
    expect(useM1Store.getState().climbCompleted).toBe(false);
  });

  it('is finished once the career carries the true ending', () => {
    openedCareer();
    const finished = {
      ...useM1Store.getState().career!,
      eventFlags: [...useM1Store.getState().career!.eventFlags, TRUE_ENDING_SEEN_FLAG],
    };
    useM1Store.setState({ career: finished });
    expect(useM1Store.getState().climbCompleted).toBe(true);
  });

  it('is unfinished again once a fresh career replaces it', () => {
    openedCareer();
    useM1Store.setState({
      career: {
        ...useM1Store.getState().career!,
        eventFlags: [...useM1Store.getState().career!.eventFlags, TRUE_ENDING_SEEN_FLAG],
      },
    });
    expect(useM1Store.getState().climbCompleted).toBe(true);

    // Proof the flag cannot be the app's memory: the wipe takes it with it.
    openedCareer();
    expect(useM1Store.getState().climbCompleted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/climb-completed-unlock.test.ts`
Expected: FAIL — `climbCompleted` is not on the store state.

- [ ] **Step 3: Expose the fact as a selector**

`climbCompleted` is **derived, never stored**. A copy on the store state would be a second thing to keep in sync with `eventFlags`, and zustand cannot host a getter that survives `set()`. Add a plain exported function near the other exported helpers at the bottom of `src/application/store.ts`:

```ts
/**
 * Whether the loaded career has finished the climb.
 *
 * Derived from the career rather than stored, so it cannot drift. `App.tsx`
 * mirrors it into `AppPreferences.climbCompleted`, which is what survives the
 * next `startNewCareer()` and decides whether the new-game prompt appears.
 */
export function careerClimbCompleted(
  state: { career: GameState | null },
): boolean {
  return state.career?.eventFlags.includes(TRUE_ENDING_SEEN_FLAG) ?? false;
}
```

`TRUE_ENDING_SEEN_FLAG` is already imported in this file (line ~119). The parameter is typed structurally on purpose: the store's own interface is `M1Store` at line 199 and is **not exported**, so `Pick<M1Store, 'career'>` would force an export this function does not need.

- [ ] **Step 3b: Point the test at the selector**

In `src/application/__tests__/climb-completed-unlock.test.ts`, change all four `useM1Store.getState().climbCompleted` reads to `careerClimbCompleted(useM1Store.getState())` and add:

```ts
import { careerClimbCompleted, useM1Store } from '../store';
```

replacing the existing `useM1Store` import line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/application/__tests__/climb-completed-unlock.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/store.ts src/application/__tests__/climb-completed-unlock.test.ts
git commit -m "feat: expose whether the loaded career finished the climb"
```

---

## Task 7: The prompt

**Files:**
- Create: `src/ui/assistant-mode-choice.ts`
- Create: `src/ui/screens/AssistantModeChoiceScreen.tsx`
- Modify: `src/ui/index.ts`
- Test: `src/ui/__tests__/assistant-mode-choice.test.ts` (create)

Jest here has no DOM and cannot render React Native, so the copy lives in a plain module and the test asserts on that — the same split `matchday-condition.ts` uses for `MatchdayConditionWarning`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/assistant-mode-choice.test.ts`:

```ts
import {
  ASSISTANT_MODE_CHOICE,
  assistantModeChoiceAccessibilityLabel,
} from '../assistant-mode-choice';
import { BERT_MOMENTS } from '../bert-poses';

describe("the question Bert asks a manager who has won everything", () => {
  it('offers exactly the two jobs, teacher first', () => {
    expect(ASSISTANT_MODE_CHOICE.options.map(option => option.mode))
      .toEqual(['teacher', 'advisor']);
  });

  it('names what each choice costs, not just what it is called', () => {
    for (const option of ASSISTANT_MODE_CHOICE.options) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.detail.length).toBeGreaterThan(0);
      expect(option.accessibilityLabel).toContain(option.label);
    }
  });

  it('uses a pose from the approved set', () => {
    expect(Object.keys(BERT_MOMENTS)).toContain(ASSISTANT_MODE_CHOICE.moment);
  });

  it('reads the whole question aloud in one label', () => {
    const label = assistantModeChoiceAccessibilityLabel();
    expect(label).toContain(ASSISTANT_MODE_CHOICE.line);
    expect(label).toContain(ASSISTANT_MODE_CHOICE.options[0].label);
    expect(label).toContain(ASSISTANT_MODE_CHOICE.options[1].label);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/assistant-mode-choice.test.ts`
Expected: FAIL — cannot find module `../assistant-mode-choice`.

- [ ] **Step 3: Write the copy module**

Create `src/ui/assistant-mode-choice.ts`:

```ts
import type { AssistantMode } from '../game/types';
import type { BertMomentId } from './bert-poses';

export interface AssistantModeOption {
  readonly mode: AssistantMode;
  readonly label: string;
  readonly detail: string;
  readonly accessibilityLabel: string;
}

export interface AssistantModeChoiceCopy {
  readonly kicker: string;
  readonly line: string;
  /**
   * He is asking a manager who has won both trophies whether they still want
   * him explaining things. Sceptical and arms crossed is the honest read of
   * that moment — he already knows the answer and is asking anyway.
   */
  readonly moment: BertMomentId;
  readonly options: readonly [AssistantModeOption, AssistantModeOption];
}

export const ASSISTANT_MODE_CHOICE: AssistantModeChoiceCopy = {
  kicker: 'Before you take the keys',
  line: "You have done this before. Do you want me explaining it again, or just staying out of your way?",
  moment: 'sizing-you-up',
  options: [
    {
      mode: 'teacher',
      label: 'Teach me again',
      detail: 'Bert explains every first and holds the opening weeks until the desk is clear.',
      accessibilityLabel: 'Teach me again. Bert explains every first and holds the opening weeks until the desk is clear.',
    },
    {
      mode: 'advisor',
      label: 'Stay out of my way',
      detail: 'No lessons, no arrows, no held weeks. He still brings you every decision.',
      accessibilityLabel: 'Stay out of my way. No lessons, no arrows, no held weeks. He still brings you every decision.',
    },
  ],
};

/** The whole question as one string, for a screen reader landing on the page. */
export function assistantModeChoiceAccessibilityLabel(): string {
  return [
    ASSISTANT_MODE_CHOICE.line,
    ...ASSISTANT_MODE_CHOICE.options.map(option => option.accessibilityLabel),
  ].join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/__tests__/assistant-mode-choice.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the screen**

Create `src/ui/screens/AssistantModeChoiceScreen.tsx`:

```tsx
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AssistantMode } from '../../game/types';
import { ActionButton } from '../components/Scorecard';
import { ChalkboardBackdrop } from '../components/ChalkboardStage';
import { BertFullBody } from '../BertFullBody';
import { useLayoutMode } from '../layout/use-layout-mode';
import {
  ASSISTANT_MODE_CHOICE,
  assistantModeChoiceAccessibilityLabel,
} from '../assistant-mode-choice';

export interface AssistantModeChoiceScreenProps {
  onChoose: (mode: AssistantMode) => void;
  onBack: () => void;
}

/**
 * The question a veteran is asked on the way into a new career.
 *
 * Only reachable once the device has finished the climb; a first career never
 * sees it and goes straight to player creation, exactly as before.
 */
export function AssistantModeChoiceScreen({
  onChoose,
  onBack,
}: AssistantModeChoiceScreenProps) {
  const wide = useLayoutMode() === 'twoColumn';

  return (
    <SafeAreaView className="flex-1 bg-pitch-dark" edges={['top', 'left', 'right', 'bottom']}>
      <ChalkboardBackdrop wide={wide} />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          accessible
          accessibilityLabel={assistantModeChoiceAccessibilityLabel()}
          className={wide
            ? 'w-full max-w-[1180px] flex-1 self-center px-10 pb-8 pt-8'
            : 'flex-1 px-5 pb-4 pt-6'}
        >
          <Text className={wide
            ? 'font-pixel text-sm uppercase tracking-[4px] text-gold-light'
            : 'font-pixel text-xs uppercase tracking-[3px] text-gold-light'}
          >
            {ASSISTANT_MODE_CHOICE.kicker}
          </Text>

          <View className="mt-8 flex-row items-end gap-4">
            <BertFullBody pointing={false} moment={ASSISTANT_MODE_CHOICE.moment} />
            <View className="flex-1 border-2 border-ink bg-white p-4">
              <Text className="text-base leading-6 text-ink">
                {ASSISTANT_MODE_CHOICE.line}
              </Text>
            </View>
          </View>

          <View className="mt-8 gap-4">
            {ASSISTANT_MODE_CHOICE.options.map(option => (
              <View key={option.mode} className="gap-2">
                <ActionButton
                  label={option.label}
                  accessibilityLabel={option.accessibilityLabel}
                  onPress={() => onChoose(option.mode)}
                  variant={option.mode === 'advisor' ? 'paper' : 'hero'}
                />
                <Text className="px-1 text-sm leading-4 text-paper/70">{option.detail}</Text>
              </View>
            ))}
          </View>

          <View className="mt-8">
            <ActionButton
              label="‹ Back"
              accessibilityLabel="Back to the new game screen"
              onPress={onBack}
              variant="paper"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Do **not** use a function-form `style` prop on any `Pressable` in this file. Function-style on a Pressable renders zero-height and untappable on iOS only — it has bitten this codebase twice.

- [ ] **Step 6: Export the screen**

In `src/ui/index.ts`, add the export beside the other screens:

```ts
export { AssistantModeChoiceScreen } from './screens/AssistantModeChoiceScreen';
export type { AssistantModeChoiceScreenProps } from './screens/AssistantModeChoiceScreen';
```

Match the file's existing export style — if it re-exports with `export *`, no edit is needed.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the known `App.tsx` / `SettingsOverlay.tsx` errors from Task 5, fixed in Task 8.

- [ ] **Step 8: Commit**

```bash
git add src/ui/assistant-mode-choice.ts src/ui/screens/AssistantModeChoiceScreen.tsx src/ui/index.ts src/ui/__tests__/assistant-mode-choice.test.ts
git commit -m "feat: ask a veteran what Bert is for"
```

---

## Task 8: Wire it into the app

**Files:**
- Modify: `App.tsx:183,454,588,992,1028,1046,1050,1063,1068,1373,1446,1676-1682,1853,1981,1999`
- Modify: `src/ui/SettingsOverlay.tsx:110,183,304-312`
- Test: `src/ui/__tests__/assistant-mode-choice.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/ui/__tests__/assistant-mode-choice.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Source assertions, in the style of `manager-tip-navigation.test.ts`: Jest has
 * no DOM here, so the wiring is pinned by reading it rather than rendering it.
 */
describe('the app wires the mode to every teaching surface', () => {
  const app = readFileSync(join(__dirname, '../../../App.tsx'), 'utf8');
  const settings = readFileSync(join(__dirname, '../SettingsOverlay.tsx'), 'utf8');

  it('gates each one-shot lesson on the mode', () => {
    for (const surface of [
      'facilityComboReveal',
      'cupExitConsolationVisible',
      'tripleSpeedIntroVisible',
      'fansLessonVisible',
      'fansLedgerTourVisible',
    ]) {
      const declaration = app.slice(app.indexOf(`const ${surface}`));
      expect(declaration.slice(0, declaration.indexOf(';'))).toContain('careerTeaches');
    }
  });

  it('routes veterans through the choice and first-timers past it', () => {
    expect(app).toContain('AssistantModeChoiceScreen');
    expect(app).toContain("landingView === 'assistant-mode'");
    expect(app).toContain('preferences.climbCompleted');
  });

  it('has retired the manager tips preference', () => {
    expect(app).not.toContain('managerTipsEnabled');
    expect(settings).not.toContain('managerTipsEnabled');
  });

  it('hides the Bert row when no career is loaded', () => {
    expect(settings).toContain('assistantMode?:');
    expect(settings).toContain('onSetAssistantMode?:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/assistant-mode-choice.test.ts`
Expected: FAIL on every case in the new describe.

- [ ] **Step 3: Replace the Settings row**

In `src/ui/SettingsOverlay.tsx`, replace `managerTipsEnabled: boolean;` (line 110) with:

```ts
  /**
   * Omit both to hide the row: with no career loaded there is nothing to
   * advise, and the new-game prompt covers that moment instead. Same convention
   * as `hallOfFame` above.
   */
  assistantMode?: AssistantMode;
  onSetAssistantMode?: (mode: AssistantMode) => void;
```

Add `import type { AssistantMode } from '../game/types';` to the file's imports. Replace `managerTipsEnabled,` in the destructured props (line 183) with `assistantMode,` and `onSetAssistantMode,`, and delete `onToggleManagerTips` from both the props type and the destructure.

Replace the Manager's tips `Pressable` (lines 302–312) with:

```tsx
              {assistantMode !== undefined && onSetAssistantMode !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={assistantMode === 'teacher'
                    ? 'Bert is teaching. Tap to have him stay out of your way.'
                    : 'Bert is staying out of your way. Tap to have him teach.'}
                  onPress={() => onSetAssistantMode(
                    assistantMode === 'teacher' ? 'advisor' : 'teacher',
                  )}
                  className="min-h-12 flex-row items-center justify-between border-2 border-ink bg-paper-dark px-3 py-2"
                >
                  <Text className="font-pixel text-sm uppercase text-ink">Bert</Text>
                  <Text className="font-pixel text-base uppercase text-blue-dark">
                    {assistantMode === 'teacher' ? 'TEACHER' : 'ADVISOR'}
                  </Text>
                </Pressable>
              ) : null}
```

- [ ] **Step 4: Add the landing view and the derived predicate**

In `App.tsx`, change line 183:

```ts
type LandingView = 'title' | 'story' | 'settings' | 'assistant-mode';
```

Add near the other derived values, after `store.career` is in scope (beside `guideOverlayVisible` at line 1096 is fine, but it must be declared before its first use at line 992 — put it directly after the `preferences` state at line 454's block, reading the store):

```ts
  /** Whether Bert teaches this career. One read, so the gates below agree. */
  const careerTeaches = store.career === null || assistantTeaches(store.career);
```

Import it: `import { assistantTeaches } from './src/game/assistant-guide';` — or add to the existing import block from `'./src/game'` if that is how the file imports game symbols.

- [ ] **Step 5: Gate the one-shots**

Six edits in `App.tsx`, each adding `careerTeaches &&` to an existing condition:

`club-legacy` auto-request (line 992):
```ts
    if (
      store.screen === 'legacy'
      && careerTeaches
      && store.career !== null
```

`facilityComboReveal` (line 1028):
```ts
  const facilityComboReveal = !careerTeaches || store.screen !== 'management' || store.career === null
    ? undefined
```

`cupExitConsolationVisible` (line 1046):
```ts
  const cupExitConsolationVisible = careerTeaches
    && store.screen === 'postmatch'
```

`tripleSpeedIntroVisible` (line 1050):
```ts
  const tripleSpeedIntroVisible = careerTeaches
    && store.screen === 'watched'
```

`fansLessonVisible` (line 1063) and `fansLedgerTourVisible` (line 1068): the same `careerTeaches &&` as the first condition of each.

`lowConditionMatchdayStarter` (line 1446):
```ts
    if (careerTeaches && !hasAssistantGuideMilestone(store.career, 'match-condition-warning-seen')) {
```

`SquadTrainingScreen` (lines 1676–1682):
```ts
            conditionWarningSeen={!careerTeaches || (store.career !== null
              && hasAssistantGuideMilestone(store.career, 'condition-warning-seen'))}
            onConditionWarningShown={() => store.completeGuideMilestone('condition-warning-seen')}
            guideQuickTrain={careerTeaches
              && store.career !== null
              && store.career.season === 1
              && store.career.week >= QUICK_TRAIN_LESSON_WEEK
              && !hasAssistantGuideMilestone(store.career, 'quick-train-seen')}
```

`conditionWarningSeen` is "has been seen, so do not show it" — an advised career passes `true` so the lesson never fires.

- [ ] **Step 6: Route the prompt**

Replace `toggleManagerTips` (lines 586–589) with nothing — delete the callback. Then change `startNewCareer` (line 973) so the veteran path stops at the question:

```ts
  const startNewCareer = useCallback(() => {
    const begin = () => {
      if (preferencesRef.current.climbCompleted) {
        setLandingView('assistant-mode');
        return;
      }
      store.startNewCareer();
    };
    if (!store.hasSavedCareer) {
      begin();
      return;
    }
    requestConfirmation({
      title: 'Replace saved career?',
      detail: 'Starting over permanently erases the current career and its match replays.',
      confirmLabel: 'Erase and start over',
      tone: 'danger',
      onConfirm: begin,
    });
  }, [requestConfirmation, store.hasSavedCareer, store.startNewCareer]);
```

Add the screen branch directly above the `store.screen === 'welcome'` branch (line 1373):

```tsx
  } else if (store.screen === 'welcome' && landingView === 'assistant-mode') {
    screen = (
      <AssistantModeChoiceScreen
        onChoose={mode => {
          setLandingView('title');
          store.startNewCareer(undefined, mode);
        }}
        onBack={() => setLandingView('title')}
      />
    );
```

and change the existing welcome branch's condition to `store.screen === 'welcome' && landingView !== 'assistant-mode'` if it does not already exclude other landing views by ordering. Import `AssistantModeChoiceScreen` from `'./src/ui'`.

- [ ] **Step 7: Mirror the unlock into preferences**

Add beside the other effects (near line 987):

```ts
  /**
   * Banks the climb where it survives the next new game. The career's own proof
   * is erased by `startNewCareer()`, so it is mirrored the moment it is true —
   * including on load, which is what backfills a device that finished the climb
   * before this shipped.
   */
  useEffect(() => {
    if (!careerClimbCompleted(store)) return;
    if (preferencesRef.current.climbCompleted) return;
    savePreferences({ ...preferencesRef.current, climbCompleted: true });
  }, [savePreferences, store.career]);
```

Import `careerClimbCompleted` from `'./src/application/store'`.

- [ ] **Step 8: Wire Settings and the desk**

At line 1853, replace `showManagerTips={preferences.managerTipsEnabled}` with:

```tsx
            showManagerTips={careerTeaches}
```

At lines 1981 and 1999, replace `managerTipsEnabled={preferences.managerTipsEnabled}` and `onToggleManagerTips={toggleManagerTips}` with:

```tsx
          assistantMode={store.career === null
            ? undefined
            : store.career.assistantMode ?? 'teacher'}
          onSetAssistantMode={store.career === null ? undefined : store.setAssistantMode}
```

- [ ] **Step 9: Run the tests**

Run: `npx jest src/ui/__tests__/assistant-mode-choice.test.ts src/ui/__tests__/manager-tip-navigation.test.ts`
Expected: the new file PASSES. `manager-tip-navigation.test.ts` will FAIL — it asserts `showManagerTips={preferences.managerTipsEnabled}`, which is exactly the line this task retires. Update its assertion to `showManagerTips={careerTeaches}` and keep the rest of the file, which still pins the `ClubHomeScreen` end of the wiring.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add App.tsx src/ui/SettingsOverlay.tsx src/ui/__tests__/assistant-mode-choice.test.ts src/ui/__tests__/manager-tip-navigation.test.ts
git commit -m "feat: route the veteran's choice and silence the lessons it turns off"
```

---

## Task 9: Prove an advised career is the same game

**Files:**
- Test: `src/application/__tests__/assistant-mode.test.ts`

Advisor changes presentation and gating only. If it changes the simulation, something reached into the wrong ring.

- [ ] **Step 1: Write the failing tests**

Two claims. First, that the simulation is untouched — driven through the store, because that is the ring the gates live in. Second, that the game ring never reads the field at all, which is what makes the first claim structural rather than a lucky seed.

`runHeadlessFullCareer(setup: CareerSetup, completedSeasons: number)` builds its own state via `createCareer(setup)` and cannot be handed a mode, so it is not the instrument here. Do not change it — it is shared with the balance rails and the audit probes.

Append to `src/application/__tests__/assistant-mode.test.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function careerAfterWeeks(mode: 'teacher' | 'advisor', weeks: number): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(4242, mode);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  for (let advanced = 0; advanced < weeks; advanced += 1) {
    useM1Store.getState().advanceCareer();
    if (useM1Store.getState().inboxDutyReminder !== null) {
      useM1Store.getState().dismissInboxDutyReminder();
      break;
    }
    if (useM1Store.getState().screen === 'week-review') {
      useM1Store.getState().continueWeekReview();
    }
  }
  return useM1Store.getState().career!;
}

describe('advice costs the manager nothing', () => {
  it('leaves the club in the same financial position on the same seed', () => {
    // Two weeks: the last point both careers reach, because week three is where
    // the taught career hits the youth-intake duty and stops.
    const taught = careerAfterWeeks('teacher', 2);
    const advised = careerAfterWeeks('advisor', 2);

    expect(advised.week).toBe(taught.week);
    expect(advised.clubs.map(club => club.cash)).toEqual(taught.clubs.map(club => club.cash));
    expect(advised.trainingPoints).toBe(taught.trainingPoints);
    expect(advised.players.map(player => player.id))
      .toEqual(taught.players.map(player => player.id));
  });

  it('is invisible to the game ring', () => {
    // The structural claim. `assistantMode` is a presentation and gating
    // concern, so only its own declaration and its own predicate may name it
    // inside src/game — anything else means a gate reached into the simulation.
    const gameDir = join(__dirname, '../../game');
    const mentions = readdirSync(gameDir)
      .filter(name => name.endsWith('.ts'))
      .filter(name => readFileSync(join(gameDir, name), 'utf8').includes('assistantMode'));

    expect(mentions.sort()).toEqual(['assistant-guide.ts', 'types.ts']);
  });
});
```

Add `import type { GameState } from '../../game/types';` to the file's imports if Task 2 did not already add it.

- [ ] **Step 2: Run the tests**

Run: `npx jest src/application/__tests__/assistant-mode.test.ts -t "advice costs"`
Expected: PASS, 2 tests. A failure in the first means an Advisor gate changed the simulation; a failure in the second names the file that reached into the game ring. Fix the cause, never the assertion.

- [ ] **Step 3: Run the whole suite**

Run: `npx jest`
Expected: PASS. Expect nothing to fail; this branch touches no sim code, so `ENGINE_VERSION` is untouched and the golden replay must be unchanged. If the golden-replay snapshot moves, stop — something entered `src/sim/` that should not have.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/application/__tests__/assistant-mode.test.ts
git commit -m "test: pin an advised career to the taught simulation"
```

---

## Self-review notes

**Spec coverage.** Mode on `GameState` → Task 1. Four functions → Task 2. Three blocks → Task 3. Mid-career switch → Task 4. `climbCompleted` + retiring `managerTipsEnabled` + the version ladder → Task 5. Unlock set and backfilled → Tasks 6 and 8 step 7. The prompt → Tasks 7 and 8 step 6. Settings row hidden with no career → Task 8 steps 3 and 8. One-shot gates → Task 8 step 5. Nothing-gets-stuck → Task 3 and Task 9.

**Naming, fixed at definition.** `AssistantMode`, `assistantMode`, `assistantTeaches(state)` (game ring, takes state), `careerTeaches` (the `App.tsx` local), `careerClimbCompleted(state)` (store selector), `climbCompleted` (preference), `setAssistantMode` (store action). Task 8's source assertions grep for `careerTeaches`, which is the name Task 8 step 4 defines.

**Known trap, pinned deliberately.** Two of the three Advance Week blocks are guarded by `intro-complete`, which a headless career never banks because nothing watches the walk-on. A Teacher-mode block test that omits `completeGuideMilestone('intro-complete')` passes without ever being blocked. Task 3's `beforeEach` banks it and says why.
