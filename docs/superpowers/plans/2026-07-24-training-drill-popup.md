# Training Drill Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drill picking happens in a popup the moment a player is assigned to training, drill cards show `current/cap CODE` instead of "N to cap", and the Training Focus section + scroll-cue machinery are deleted.

**Architecture:** All display logic stays in the headless application layer (`squadTrainingViewModel` gains `current`/`cap`/`shortCode` and a role filter). A new `TrainingDrillModal` UI component follows the `PostMatchSummaryModal` house pattern. `SquadTrainingScreen` owns one new boolean (popup open) and a pure `trainingBadgeAction` helper decides what a badge tap does. Store actions are untouched.

**Tech Stack:** Expo/React Native + NativeWind, Jest (headless view-model tests + source-string UI tests).

**Spec:** `docs/superpowers/specs/2026-07-24-training-drill-popup-design.md`

---

### Task 1: View-model fields (`current`, `cap`, `shortCode`) + role filter

**Files:**
- Modify: `src/ui/models.ts` (~line 326, `TrainingSlotStatOption`)
- Modify: `src/application/view-models.ts` (~line 1269, `selectedPlayerStatOptions` builder)
- Modify: `src/application/__tests__/training-tier-unlocks.test.ts:63` (7 options → 6)
- Test: `src/application/__tests__/training-stat-options.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/application/__tests__/training-stat-options.test.ts`:

```ts
import { loadLaunchContent } from '../../content';
import { createCareer, playerAttributeCaps } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training stat options', () => {
  const content = loadLaunchContent();
  const state = createCareer(createLaunchCareerSetup(20260724, undefined, content, 'full'));
  const roster = state.players.filter(player => player.clubId === state.userClubId);

  it('reports current value, personal cap, and short code for each option', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const options = squadTrainingViewModel(state, content, outfielder.id, []).selectedPlayerStatOptions!;
    const duels = options.find(option => option.pathId === 'duels')!;

    expect(duels).toMatchObject({
      shortCode: 'DEF',
      current: outfielder.attrs.def,
      cap: playerAttributeCaps(outfielder).def,
      room: playerAttributeCaps(outfielder).def - outfielder.attrs.def,
    });
  });

  it('hides keeper drills from outfield players and finishing from goalkeepers', () => {
    const outfielder = roster.find(player => player.role !== 'GK')!;
    const keeper = roster.find(player => player.role === 'GK')!;
    const outfieldOptions = squadTrainingViewModel(state, content, outfielder.id, []).selectedPlayerStatOptions!;
    const keeperOptions = squadTrainingViewModel(state, content, keeper.id, []).selectedPlayerStatOptions!;

    expect(outfieldOptions).toHaveLength(6);
    expect(outfieldOptions.some(option => option.pathId === 'keeper-drills')).toBe(false);
    expect(keeperOptions).toHaveLength(6);
    expect(keeperOptions.some(option => option.pathId === 'finishing')).toBe(false);
  });
});
```

Note the `'full'` career mode argument — without it these tests pass vacuously (known trap).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/training-stat-options.test.ts`
Expected: FAIL — `shortCode`/`current`/`cap` missing from options, lengths are 7 not 6.

- [ ] **Step 3: Extend the type in `src/ui/models.ts`**

Replace the `TrainingSlotStatOption` interface (~line 326) with:

```ts
export interface TrainingSlotStatOption {
  pathId: string;
  /** Display label for the stat, e.g. "Defense". */
  label: string;
  /** Attribute code for the compact current/cap line, e.g. "DEF". */
  shortCode: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';
  /** Best unlocked drill tier's title, e.g. "Duels III". */
  drillName: string;
  /** Best unlocked tier's gain for this stat. */
  gain: number;
  /** The selected player's current value in this stat. */
  current: number;
  /** The selected player's personal cap for this stat. */
  cap: number;
  /** Cap minus the selected player's current value; may be negative. */
  room: number;
  atCap: boolean;
}
```

- [ ] **Step 4: Build the fields in `src/application/view-models.ts`**

Replace the `selectedPlayerStatOptions` builder (~line 1269–1284) with:

```ts
    ...(selectedPlayer === undefined ? {} : {
      selectedPlayerStatOptions: TRAINING_PATHS
        .filter(path => selectedPlayer.role === 'GK'
          ? path.attribute !== 'sho'
          : path.attribute !== 'ref')
        .map(path => {
          const drill = resolveTrainingDrillForPath(state, path.pathId);
          const gain = drill.gains[path.attribute] ?? 0;
          const current = selectedPlayer.attrs[path.attribute];
          const cap = playerAttributeCaps(selectedPlayer)[path.attribute];
          return {
            pathId: path.pathId,
            label: path.label,
            shortCode: path.attribute.toUpperCase() as TrainingSlotStatOption['shortCode'],
            drillName: drillName(drill.id),
            gain,
            current,
            cap,
            room: cap - current,
            atCap: cap - current <= 0,
          };
        }),
    }),
```

Add `TrainingSlotStatOption` to the existing type import from `'../ui/models'` if it isn't already imported.

- [ ] **Step 5: Fix the option-count expectation**

In `src/application/__tests__/training-tier-unlocks.test.ts:63`, the role filter now always drops exactly one path:

```ts
    expect(model.selectedPlayerStatOptions).toHaveLength(TRAINING_PATHS.length - 1);
```

- [ ] **Step 6: Run the application test suite**

Run: `npx jest src/application`
Expected: PASS (including `training-stat-options`, `training-tier-unlocks`, `training-cap-feedback` — `sprints`/pac is never filtered, so cap-feedback still passes).

- [ ] **Step 7: Commit**

```bash
git add src/ui/models.ts src/application/view-models.ts src/application/__tests__/training-stat-options.test.ts src/application/__tests__/training-tier-unlocks.test.ts
git commit -m "feat: stat options carry current/cap/shortCode and filter by role"
```

---

### Task 2: `trainingBadgeAction` pure helper

**Files:**
- Create: `src/ui/training-badge-action.ts`
- Test: `src/ui/__tests__/training-badge-action.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/training-badge-action.test.ts`:

```ts
import { trainingBadgeAction } from '../training-badge-action';

describe('training badge action', () => {
  it('manages an already-assigned player without toggling', () => {
    expect(trainingBadgeAction(true, 3, 3)).toBe('manage');
    expect(trainingBadgeAction(true, 1, 3)).toBe('manage');
  });

  it('assigns and opens the drill picker while a slot is free', () => {
    expect(trainingBadgeAction(false, 0, 3)).toBe('assign-and-pick');
    expect(trainingBadgeAction(false, 2, 3)).toBe('assign-and-pick');
  });

  it('rejects a fourth player when every slot is taken', () => {
    expect(trainingBadgeAction(false, 3, 3)).toBe('reject-full');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/training-badge-action.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/ui/training-badge-action.ts`:

```ts
export type TrainingBadgeAction = 'manage' | 'assign-and-pick' | 'reject-full';

/**
 * Decides what a tap on the roster's train badge does. `manage` reopens the
 * drill popup for an assigned player (never toggles); `assign-and-pick` adds
 * the player then opens the popup; `reject-full` forwards to the store so the
 * slot-limit toast fires without opening the popup. Locked players never get
 * here — their badge is disabled.
 */
export function trainingBadgeAction(
  isAssigned: boolean,
  assignedCount: number,
  maxSlots: number,
): TrainingBadgeAction {
  if (isAssigned) return 'manage';
  if (assignedCount >= maxSlots) return 'reject-full';
  return 'assign-and-pick';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/ui/__tests__/training-badge-action.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/training-badge-action.ts src/ui/__tests__/training-badge-action.test.ts
git commit -m "feat: pure helper deciding what a train-badge tap does"
```

---

### Task 3: `TrainingDrillModal` component

**Files:**
- Create: `src/ui/TrainingDrillModal.tsx`
- Modify: `src/application/__tests__/weekly-plan-summary.test.ts` (~line 106, the stat-picker source test)

- [ ] **Step 1: Repoint the stat-picker source test (failing first)**

In `src/application/__tests__/weekly-plan-summary.test.ts`, replace the whole `it('shows each stat option\'s drill name before its gain and its room to cap, greying out capped stats', ...)` block with:

```ts
  it('shows each drill option\'s name, the player\'s current/cap, and the gain, greying out capped stats', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    expect(source.indexOf('{option.drillName}')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('{option.drillName}')).toBeLessThan(source.indexOf('{option.gain} {option.label}'));
    expect(source).toContain('{option.current}/{option.cap} {option.shortCode}');
    expect(source).not.toContain('to cap');
    expect(source).toContain('disabled={option.atCap}');
    expect(source).toContain('accessibilityRole="radio"');
    expect(source).toContain('onPress={() => onPickDrill(playerId, option.pathId)}');
    expect(source).toContain('label="Remove from training"');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/weekly-plan-summary.test.ts`
Expected: FAIL — `TrainingDrillModal.tsx` does not exist.

- [ ] **Step 3: Create the component**

Create `src/ui/TrainingDrillModal.tsx`:

```tsx
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SfxPressable as Pressable } from './components/SfxPressable';
import { ActionButton } from './components/Scorecard';
import type { TrainingSlotStatOption } from './models';

export interface TrainingDrillModalProps {
  playerId: string;
  playerName: string;
  options: readonly TrainingSlotStatOption[];
  /** The player's committed drill path, when one is already picked. */
  currentPathId?: string;
  onPickDrill: (playerId: string, pathId: string) => void;
  onRemoveFromTraining: (playerId: string) => void;
  onDismiss: () => void;
  reduceMotion?: boolean;
}

/** Bottom-anchored drill picker that opens the moment a player joins training. */
export function TrainingDrillModal({
  playerId,
  playerName,
  options,
  currentPathId,
  onPickDrill,
  onRemoveFromTraining,
  onDismiss,
  reduceMotion = false,
}: TrainingDrillModalProps) {
  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
        <View className="flex-1 justify-end px-3 pb-3">
          <Pressable
            accessible={false}
            style={StyleSheet.absoluteFill}
            onPress={onDismiss}
          >
            <View className="flex-1" style={{ backgroundColor: 'rgba(36,31,46,0.62)' }} />
          </Pressable>
          <View
            accessibilityViewIsModal
            className="w-full overflow-hidden border-2 border-b-4 border-ink bg-paper"
            style={{ maxHeight: '92%' }}
          >
            <View className="flex-row items-center justify-between border-b-2 border-ink bg-paper-dark px-4 py-3">
              <View className="flex-1 pr-3">
                <Text className="font-mono text-sm font-bold uppercase text-blue-dark">Training focus</Text>
                <Text className="mt-1 font-pixel text-xl uppercase text-ink" numberOfLines={1}>{playerName}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close training focus for ${playerName}`}
                onPress={onDismiss}
                className="h-11 w-11 items-center justify-center border-2 border-ink bg-white"
              >
                <Text className="font-mono text-lg font-bold text-ink">×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
              <View className="gap-2">
                {options.map(option => {
                  const isCurrent = option.pathId === currentPathId;
                  return (
                    <Pressable
                      key={option.pathId}
                      accessibilityRole="radio"
                      accessibilityLabel={`Train ${playerName} in ${option.label}`}
                      accessibilityHint={`${option.drillName}. Gains ${option.gain} ${option.label}. Currently ${option.current} of ${option.cap}.`}
                      accessibilityState={{ checked: isCurrent, disabled: option.atCap }}
                      disabled={option.atCap}
                      onPress={() => onPickDrill(playerId, option.pathId)}
                      className={option.atCap
                        ? 'flex-row items-center justify-between border-2 border-ink/20 bg-white px-3 py-3 opacity-40'
                        : isCurrent
                          ? 'flex-row items-center justify-between border-2 border-violet-dark bg-violet-light px-3 py-3'
                          : 'flex-row items-center justify-between border-2 border-ink/30 bg-white px-3 py-3'}
                      style={({ pressed }) => ({ opacity: pressed && !option.atCap ? 0.65 : undefined })}
                    >
                      <View className="min-w-0 flex-1 pr-2">
                        <Text className="text-base font-bold uppercase text-ink" numberOfLines={1}>{option.drillName}</Text>
                        <Text className="mt-0.5 font-mono text-sm font-bold text-ink/60" numberOfLines={1}>
                          {option.current}/{option.cap} {option.shortCode}
                        </Text>
                      </View>
                      <Text
                        className={isCurrent ? 'font-mono text-base font-bold text-violet-dark' : 'font-mono text-base font-bold text-ink'}
                        numberOfLines={1}
                      >
                        +{option.gain} {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View className="border-t-2 border-ink/15 px-4 py-3">
              <ActionButton
                label="Remove from training"
                variant="danger"
                compact
                accessibilityLabel={`Remove ${playerName} from this week's training slots`}
                onPress={() => onRemoveFromTraining(playerId)}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
```

Note: the old "At cap" copy is gone on purpose — `39/39 PAC` explains itself, and the source test pins `not.toContain('to cap')`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/application/__tests__/weekly-plan-summary.test.ts`
Expected: PASS on the repointed picker test. (Other tests in this file read `SquadTrainingScreen.tsx` and still pass — the screen is untouched so far.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/TrainingDrillModal.tsx src/application/__tests__/weekly-plan-summary.test.ts
git commit -m "feat: TrainingDrillModal drill picker with current/cap display"
```

---

### Task 4: Rewire `SquadTrainingScreen` — popup in, section out

**Files:**
- Modify: `src/ui/screens/SquadTrainingScreen.tsx`
- Modify: `App.tsx` (~line 1273, pass `reduceMotion`)
- Modify: `src/ui/__tests__/first-training-guidance.test.ts`
- Modify: `src/ui/__tests__/squad-two-column.test.ts`

- [ ] **Step 1: Update the source-string tests first (failing)**

In `src/ui/__tests__/first-training-guidance.test.ts`, first test block — delete these lines:

```ts
    expect(source).toContain("'relative mt-20 gap-2 border-4 border-blue-dark bg-blue-light p-1'");
    expect(source).toContain('const showScrollCue = guideStat && !statPickerVisible;');
    expect(source).toContain('ref={statPickerRef}');
    expect(source).toContain('detail="Pick a stat"');
    expect(source).not.toContain('detail="Pick a drill"');
```

and add in their place:

```ts
    expect(source).toContain('label="Tap the number"');
    expect(source).toContain('detail="Pick a drill"');
    expect(source).toContain('setDrillPickerOpen(true)');
    expect(source).not.toContain('detail="Pick a stat"');
    expect(source).not.toContain('statPickerRef');
    expect(source).not.toContain('measureInWindow');
```

In `src/ui/__tests__/squad-two-column.test.ts`:
- In the test `'derives the roster and training-focus weights from view-model content counts'`: rename to `'derives the roster weight from view-model content counts'` and replace the line
  `expect(source).toContain('2 + (viewModel.selectedPlayerStatOptions?.length ?? 1)');`
  with
  `expect(source).not.toContain('selectedPlayerStatOptions?.length');`
- In the test `'keeps the guide mt-20 wrapper literals byte-identical'`: delete the assertion pinning `'relative mt-20 gap-2 border-4 border-blue-dark bg-blue-light p-1'` (the stat-picker wrapper) if present, keep the roster wrapper literal.

Run: `npx jest src/ui/__tests__/first-training-guidance.test.ts src/ui/__tests__/squad-two-column.test.ts`
Expected: FAIL — screen still has the old picker.

- [ ] **Step 2: Rewire the screen**

In `src/ui/screens/SquadTrainingScreen.tsx`:

**2a. Props:** add `reduceMotion?: boolean` to `SquadTrainingScreenProps` (default `false` in the destructure).

**2b. Delete the scroll-cue machinery** (all in the main component):
- `statPickerRef`, `visibilityFrameRef`, `statPickerVisible` state
- `measureTrainingGuideVisibility`, `scheduleTrainingGuideVisibility`
- both `useEffect`s that call/reset them (keep the slot-limit toast effect)
- `const showScrollCue = ...` and the `showScrollCue ? <TutorialTapCue label="Scroll down" ... />` block
- `onLayout={scheduleTrainingGuideVisibility}` on the root `View` and `ScrollView`, `onScroll={scheduleTrainingGuideVisibility}`, `scrollEventThrottle={16}`
- the whole `TrainingFocusSection` function, its props interface, and its `sections` entry
- now-unused imports: `RefObject`, `isTutorialTargetVisible` (keep `TUTORIAL_TAP_CUE_*` constants — still used)

**2c. Add popup state + handlers** (in the main component, after `squadSort` state):

```tsx
  const [drillPickerOpen, setDrillPickerOpen] = useState(false);

  const handleTrainingBadgePress = useCallback((playerId: string) => {
    const player = viewModel.players.find(candidate => candidate.id === playerId);
    if (player === undefined) return;
    const action = trainingBadgeAction(
      player.slotNumber !== undefined,
      viewModel.players.filter(candidate => candidate.slotNumber !== undefined).length,
      viewModel.maxSlots,
    );
    if (action === 'manage') onSelectPlayer(playerId);
    else onTogglePlayerAssignment(playerId);
    if (action !== 'reject-full') setDrillPickerOpen(true);
  }, [viewModel.players, viewModel.maxSlots, onSelectPlayer, onTogglePlayerAssignment]);
```

with imports:

```tsx
import { trainingBadgeAction } from '../training-badge-action';
import { TrainingDrillModal } from '../TrainingDrillModal';
```

**2d. Tutorial cue target** (after `guideStat`):

```tsx
  const drillCuePlayerId = guideStat && !drillPickerOpen
    ? sortedPlayers.find(player => player.slotNumber !== undefined
        && !viewModel.slots.some(slot => slot.playerId === player.id))?.id
    : undefined;
```

Pass `drillCuePlayerId` into `RosterSection` (new optional prop `drillCuePlayerId?: string`).

**2e. RosterSection changes:**
- Replace the `onTogglePlayerAssignment` prop with `onPressTrainingBadge: (playerId: string) => void`; the badge `Pressable` calls `onPress={() => onPressTrainingBadge(player.id)}`.
- Badge accessibility: role becomes `"button"`; label becomes
  `player.trainingLocked ? \`${player.name} is locked into training by a contract promise\` : isAssigned ? \`Change or remove ${player.name}'s training drill\` : \`Add ${player.name} to this week's training slots\``;
  state becomes `{{ disabled: player.trainingLocked === true }}` (drop `checked`).
- Add the drill cue on the matching row, mirroring the existing `guideConciergePlayer` pattern:

```tsx
              const guideDrillPlayer = player.id === drillCuePlayerId;
```

row style: `style={guideConciergePlayer || guideDrillPlayer ? { marginTop: TUTORIAL_TAP_CUE_RESERVED_SPACE } : undefined}`

and next to the existing concierge cue block:

```tsx
              {guideDrillPlayer ? (
                <TutorialTapCue
                  label="Tap the number"
                  detail="Pick a drill"
                  style={{
                    left: '50%',
                    marginLeft: -TUTORIAL_TAP_CUE_WIDTH / 2,
                    top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,
                  }}
                />
              ) : null}
```

**2f. Render the popup** (inside the root `View`, after the ScrollView / toast blocks):

```tsx
      {drillPickerOpen && selectedPlayer && selectedPlayer.slotNumber !== undefined && viewModel.selectedPlayerStatOptions ? (
        <TrainingDrillModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          options={viewModel.selectedPlayerStatOptions}
          currentPathId={viewModel.slots.find(slot => slot.playerId === selectedPlayer.id)?.pathId}
          onPickDrill={(playerId, pathId) => {
            onSelectTrainingStat(playerId, pathId);
            setDrillPickerOpen(false);
          }}
          onRemoveFromTraining={playerId => {
            onTogglePlayerAssignment(playerId);
            setDrillPickerOpen(false);
          }}
          onDismiss={() => setDrillPickerOpen(false)}
          reduceMotion={reduceMotion}
        />
      ) : null}
```

**2g. App.tsx:** at the `<SquadTrainingScreen` call site (~line 1273) add `reduceMotion={reduceMotion}`.

- [ ] **Step 3: Run the UI test suites**

Run: `npx jest src/ui src/application`
Expected: PASS — including the repointed tests from Step 1.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint:fix`
Expected: clean (no unused-import leftovers from the deletion).

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/SquadTrainingScreen.tsx App.tsx src/ui/__tests__/first-training-guidance.test.ts src/ui/__tests__/squad-two-column.test.ts
git commit -m "feat: drill popup replaces Training Focus section on the squad screen"
```

---

### Task 5: Full verification + visual QA

**Files:** none new.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS. If any test not touched above reads the deleted picker literals, update it to the new reality (grep first: `grep -rn "Pick a stat\|statPicker\|selectedPlayerStatOptions" src --include="*.test.ts"`).

- [ ] **Step 2: Static web export for visual QA**

The dev server can't boot in worktrees; the static export works:

```bash
npm run export:web && cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm dist/canvaskit.wasm 2>/dev/null || true; npx serve dist -l 4173
```

(Check `package.json` for the exact `export:web` script name and prior canvaskit copy path used in this repo.)

- [ ] **Step 3: Verify in the browser (preview tools)**

- Phone width (375pt): Squad tab → tap "+" on a player → popup appears immediately, no scrolling; cards read `30/39 DEF` style; pick a drill → popup closes, badge numbered.
- Tap the badge again → popup reopens, current drill in violet, "Remove from training" present and working.
- Fill 3 slots, tap a 4th "+" → toast, no popup.
- Desktop width (≥960pt): same flow; Training Focus section gone from both columns.
- Screenshot proof for the user.

- [ ] **Step 4: Final commit if QA fixes were needed**

```bash
git add -A && git commit -m "fix: visual QA follow-ups for training drill popup"
```

---

## Self-review notes

- **Spec coverage:** flow (Task 4 · 2c/2f), popup + current/cap + filter + remove (Tasks 1, 3), deletions (Task 4 · 2b), tutorial cue (Task 4 · 2d/2e), testing (Tasks 1, 2, and source tests in 3–4), visual QA (Task 5). At-cap disabled styling carried into the modal card classes (Task 3 · Step 3).
- **Types:** `TrainingSlotStatOption` fields used in Task 3 match Task 1's interface; `trainingBadgeAction(isAssigned, assignedCount, maxSlots)` signature consistent between Tasks 2 and 4.
- The badge role change (checkbox → button) is intentional: tap no longer toggles, it opens the popup.
