# Character Creation & Training Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first-hire paper doll easier to browse, widen hairstyle choice, and make the locked-in weekly training plan tell the truth about what each player will actually gain — plus fix the onboarding bug where the seeded Training Pitch silently suppresses the "place your first facility" tutorial.

**Architecture:** Seven independent slices. The training-display work (Tasks 5–6) deliberately **projects by running the real resolver** — `resolveCareerTrainingWeek(state)` is pure and deterministic, so the view model diffs its output against current attributes instead of re-deriving the growth formula. That keeps the on-screen number identical to the number weekly settlement will deliver. The facility-tutorial fix (Task 7) marks the seeded pitch so guide logic can distinguish "the club came with this" from "the player built this."

**Tech Stack:** TypeScript (strict), React Native + Expo, NativeWind, Jest, zod (save codec), Node sprite generators (`scripts/*.mjs`).

---

## Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Existing saves survive the look-ID re-pack? | **No** — saves are disposable pre-launch. No migration code. |
| Hair / kit accent counts | **Hair 7 → 10. Kit accents stay 4.** 10×10 would have grown bundled sprite data ~2.7 MB → ~5.9 MB to give one player 600 looks. |
| Locked-plan attribute lines | **Only attributes the locked drills actually raise.** |
| Player already at cap | **Show it capped with no gain** — never print a `+3/week` the engine won't deliver. |
| Order vs the pixel-button spec | **This batch first.** The button spec (`726703c`) stays parked. |

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/ui/screens/CharacterCreationScreen.tsx` | Paper-doll + difficulty + name UI | 1, 2, 3 |
| `src/game/player-appearance.ts` | Look-ID packing, look counts | 3 |
| `src/game/types.ts` | `CreatedPlayerAppearance` | 3 |
| `src/game/onboarding/player-creation.ts` | Appearance defaults + validation | 3 |
| `src/persistence/game-state-codec.ts` | Save schema for appearance | 3 |
| `scripts/player-art-roster.mjs` | Hairstyle list, created-look generation | 3 |
| `src/application/view-models.ts` | Drill filtering, locked-plan projection | 4, 5, 6 |
| `src/ui/models.ts` | View-model types | 5, 6 |
| `src/ui/screens/SquadTrainingScreen.tsx` | Drill list + locked-plan panel | 5, 6 |
| `src/game/facilities.ts` | `FacilityBuilding.seeded` flag | 7 |
| `src/game/career.ts` | Seeds the starting pitch | 7 |
| `src/application/assistant-guide.ts` | Facility tutorial trigger | 7 |
| `content/assistant-guide.json` | Bert's copy | 8 |

---

### Task 1: Two-way appearance cycling

The paper doll only cycles forward, so reaching the previous option means wrapping all the way around. Add a back control.

**Files:**
- Modify: `src/ui/screens/CharacterCreationScreen.tsx:96-111` (call sites), `:247-271` (`AppearanceChoice`)
- Test: `src/ui/__tests__/character-creation-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('first-hire screen copy', ...)` block in `src/ui/__tests__/character-creation-copy.test.ts`:

```ts
  it('offers both directions on every paper-doll choice', () => {
    expect(source).toContain('onPrevious');
    expect(source).toContain('Previous');
    // every cycler must pass both handlers, so neither direction is forgotten
    expect(source.match(/onPrevious=/g)?.length).toBe(3);
    expect(source.match(/onNext=/g)?.length).toBe(3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/character-creation-copy.test.ts -t "both directions"`
Expected: FAIL — `Expected substring: "onPrevious"`.

- [ ] **Step 3: Replace `AppearanceChoice` with a two-way stepper**

In `src/ui/screens/CharacterCreationScreen.tsx`, replace the whole `AppearanceChoice` function (currently at `:247-271`) with:

```tsx
function AppearanceChoice({
  label,
  value,
  onPrevious,
  onNext,
}: {
  label: string;
  value: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <View className="min-h-11 flex-row items-center justify-between gap-2 border-2 border-ink/30 bg-white px-2 py-2">
      <Text className="min-w-0 flex-1 text-sm font-bold uppercase text-ink" numberOfLines={1}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label}`}
        onPress={() => {
          playManagementHaptic('select');
          onPrevious();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light"
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
      >
        <Text className="font-mono text-xl font-bold text-ink">‹</Text>
      </Pressable>
      <Text className="w-16 text-center font-mono text-sm font-bold text-violet-dark">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next ${label}`}
        onPress={() => {
          playManagementHaptic('select');
          onNext();
        }}
        className="h-11 w-11 items-center justify-center border-2 border-violet-dark bg-violet-light"
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : undefined })}
      >
        <Text className="font-mono text-xl font-bold text-ink">›</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Add a wrapping step helper and update the three call sites**

Add this helper immediately above `export function CharacterCreationScreen` in the same file:

```tsx
/** Wraps in both directions so ‹ from the first option lands on the last. */
function stepChoice(current: number, delta: -1 | 1, count: number): number {
  return (current + delta + count) % count;
}
```

Replace the three `<AppearanceChoice ... />` elements (currently `:96-110`) with:

```tsx
              <AppearanceChoice
                label="Skin tone"
                value={`${appearance.skinTone + 1} / 6`}
                onPrevious={() => setAppearance(current => ({ ...current, skinTone: stepChoice(current.skinTone, -1, 6) as CreatedPlayerAppearance['skinTone'] }))}
                onNext={() => setAppearance(current => ({ ...current, skinTone: stepChoice(current.skinTone, 1, 6) as CreatedPlayerAppearance['skinTone'] }))}
              />
              <AppearanceChoice
                label="Hair"
                value={`${appearance.hairstyle + 1} / 7`}
                onPrevious={() => setAppearance(current => ({ ...current, hairstyle: stepChoice(current.hairstyle, -1, 7) as CreatedPlayerAppearance['hairstyle'] }))}
                onNext={() => setAppearance(current => ({ ...current, hairstyle: stepChoice(current.hairstyle, 1, 7) as CreatedPlayerAppearance['hairstyle'] }))}
              />
              <AppearanceChoice
                label="Kit accent"
                value={`${appearance.kitAccent + 1} / 4`}
                onPrevious={() => setAppearance(current => ({ ...current, kitAccent: stepChoice(current.kitAccent, -1, 4) as CreatedPlayerAppearance['kitAccent'] }))}
                onNext={() => setAppearance(current => ({ ...current, kitAccent: stepChoice(current.kitAccent, 1, 4) as CreatedPlayerAppearance['kitAccent'] }))}
              />
```

Note: the hair count of `7` becomes `10` in Task 3. Leave it at `7` here so this task stays independently correct.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/ui/__tests__/character-creation-copy.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/CharacterCreationScreen.tsx src/ui/__tests__/character-creation-copy.test.ts
git commit -m "feat: cycle paper-doll choices in both directions"
```

---

### Task 2: Rename the name panel to "Name"

**Files:**
- Modify: `src/ui/screens/CharacterCreationScreen.tsx:143`
- Test: `src/ui/__tests__/character-creation-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the same `describe` block:

```ts
  it('labels the registration panel simply', () => {
    expect(source).toContain('title="Name"');
    expect(source).not.toContain('Name on the shirt');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/ui/__tests__/character-creation-copy.test.ts -t "registration panel"`
Expected: FAIL — `Expected substring: "title=\"Name\""`.

- [ ] **Step 3: Change the title**

In `src/ui/screens/CharacterCreationScreen.tsx:143`, change:

```tsx
        <PaperPanel kicker="Registration card" title="Name on the shirt" stamp="Required" className="mt-5">
```

to:

```tsx
        <PaperPanel kicker="Registration card" title="Name" stamp="Required" className="mt-5">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/ui/__tests__/character-creation-copy.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens/CharacterCreationScreen.tsx src/ui/__tests__/character-creation-copy.test.ts
git commit -m "feat: rename the first-hire name panel to Name"
```

---

### Task 3: Ten hairstyles

Widens `hairstyle` from 7 to 10 options. Kit accents stay at 4. Created looks go 168 → 240, so the packed look ID changes from `skin × 28 + hair × 4 + accent` to `skin × 40 + hair × 4 + accent`. **Existing saves are intentionally not migrated.**

The three new styles — `braidcrown`, `locs`, `topknot` — already exist in the sprite generator's feature vocabulary and are named in `docs/11-art-style.md` Rule 1B, so no new pixel art is required.

**Files:**
- Modify: `scripts/player-art-roster.mjs:238-240`, `src/game/player-appearance.ts:11,16,21`, `src/game/types.ts:16`, `src/game/onboarding/player-creation.ts:95`, `src/persistence/game-state-codec.ts:185`, `src/ui/screens/CharacterCreationScreen.tsx` (hair count)
- Test: `src/render/sprites/__tests__/portraits.test.ts:39-51`

- [ ] **Step 1: Write the failing test**

In `src/game/__tests__/`, create `created-appearance.test.ts`:

```ts
import { CREATED_PLAYER_LOOK_COUNT, createdAppearanceLookId } from '../player-appearance';

describe('created player appearance packing', () => {
  it('packs ten hairstyles and four kit accents per skin tone', () => {
    expect(CREATED_PLAYER_LOOK_COUNT).toBe(240);
    expect(createdAppearanceLookId({ skinTone: 0, hairstyle: 0, kitAccent: 0 })).toBe('c000');
    expect(createdAppearanceLookId({ skinTone: 0, hairstyle: 9, kitAccent: 3 })).toBe('c039');
    expect(createdAppearanceLookId({ skinTone: 1, hairstyle: 0, kitAccent: 0 })).toBe('c040');
    expect(createdAppearanceLookId({ skinTone: 5, hairstyle: 9, kitAccent: 3 })).toBe('c239');
  });

  it('gives every combination a distinct look id', () => {
    const ids = new Set<string>();
    for (let skinTone = 0; skinTone < 6; skinTone += 1) {
      for (let hairstyle = 0; hairstyle < 10; hairstyle += 1) {
        for (let kitAccent = 0; kitAccent < 4; kitAccent += 1) {
          ids.add(createdAppearanceLookId({
            skinTone: skinTone as 0,
            hairstyle: hairstyle as 0,
            kitAccent: kitAccent as 0,
          }));
        }
      }
    }
    expect(ids.size).toBe(240);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/game/__tests__/created-appearance.test.ts`
Expected: FAIL — `expect(168).toBe(240)`.

- [ ] **Step 3: Widen the type in two places**

`src/game/types.ts:16` — change:

```ts
  hairstyle: 0 | 1 | 2 | 3 | 4 | 5 | 6;
```

to:

```ts
  hairstyle: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
```

`src/game/player-appearance.ts:16` — apply the identical change to `CreatedAppearanceChoice.hairstyle` (note this one is `readonly`):

```ts
  readonly hairstyle: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
```

- [ ] **Step 4: Re-pack the look ID**

`src/game/player-appearance.ts:11` — change `export const CREATED_PLAYER_LOOK_COUNT = 168;` to:

```ts
export const CREATED_PLAYER_LOOK_COUNT = 240;
```

`src/game/player-appearance.ts:19-23` — change the doc comment and the multiplier:

```ts
/** Maps the editable paper-doll controls onto the dedicated 240-look paper-doll atlas. */
export function createdAppearanceLookId(appearance: CreatedAppearanceChoice): string {
  const index = appearance.skinTone * 40 + appearance.hairstyle * 4 + appearance.kitAccent;
  return `c${String(index).padStart(3, '0')}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/game/__tests__/created-appearance.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Widen validation and the save schema**

`src/game/onboarding/player-creation.ts:95-97` — change:

```ts
  if (!Number.isSafeInteger(value.hairstyle) || value.hairstyle < 0 || value.hairstyle > 6) {
    throw new Error('Hairstyle choice must be from 0 to 6');
  }
```

to:

```ts
  if (!Number.isSafeInteger(value.hairstyle) || value.hairstyle < 0 || value.hairstyle > 9) {
    throw new Error('Hairstyle choice must be from 0 to 9');
  }
```

`src/persistence/game-state-codec.ts:185` — change:

```ts
      hairstyle: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
```

to:

```ts
      hairstyle: z.union([
        z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
        z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9),
      ]),
```

- [ ] **Step 7: Add the three hairstyles to the sprite roster**

`scripts/player-art-roster.mjs:238-240` — change:

```js
const CREATED_HAIRSTYLES = [
  'flattop', 'curls', 'shaved', 'sidefringe', 'ponytail', 'afro', 'mohawk',
];
```

to:

```js
const CREATED_HAIRSTYLES = [
  'flattop', 'curls', 'shaved', 'sidefringe', 'ponytail', 'afro', 'mohawk',
  'braidcrown', 'locs', 'topknot',
];
```

No other change is needed in this file — `CREATED_PLAYER_LOOKS` already derives its length and indices from `CREATED_HAIRSTYLES.length`.

- [ ] **Step 8: Update the hair count in the UI**

In `src/ui/screens/CharacterCreationScreen.tsx`, in the `Hair` cycler added in Task 1, change all three `7`s to `10`:

```tsx
              <AppearanceChoice
                label="Hair"
                value={`${appearance.hairstyle + 1} / 10`}
                onPrevious={() => setAppearance(current => ({ ...current, hairstyle: stepChoice(current.hairstyle, -1, 10) as CreatedPlayerAppearance['hairstyle'] }))}
                onNext={() => setAppearance(current => ({ ...current, hairstyle: stepChoice(current.hairstyle, 1, 10) as CreatedPlayerAppearance['hairstyle'] }))}
              />
```

- [ ] **Step 9: Update the portrait packing test**

`src/render/sprites/__tests__/portraits.test.ts:39-51` — change the helper's multiplier and the hairstyle loop bound:

```ts
    const createdId = (skinTone: number, hairstyle: number, kitAccent: number) => (
      `c${String(skinTone * 40 + hairstyle * 4 + kitAccent).padStart(3, '0')}`
    );
```

and:

```ts
    for (let hairstyle = 1; hairstyle < 10; hairstyle += 1) {
```

- [ ] **Step 10: Regenerate the sprite and portrait data**

```bash
node scripts/generate-sprites.mjs && node scripts/generate-portraits.mjs
```

Expected: both complete without throwing. `generate-portraits.mjs` asserts every resting portrait is pixel-unique — if it throws `player resting portraits must all be unique`, one of the three new hairstyles renders identically to an existing one at portrait crop; swap that name for another from the vocabulary in `scripts/player-art-roster.mjs` (e.g. `twists`, `quiff`, `headwrap`) and re-run.

Confirm the data grew as expected:

```bash
ls -la src/render/sprites/sprites.json src/render/sprites/portraits.json
```

Expected: both larger than before (roughly +40%; sprites.json ~1.6 MB → ~2.0 MB).

- [ ] **Step 11: Run the full suite**

Run: `npm test`
Expected: PASS. Any failure naming `c0` look IDs means a fixture hard-codes an old packed ID — update the fixture to the new packing, do not revert the multiplier.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: offer ten created-player hairstyles"
```

---

### Task 4: Hide drill tiers that are not yet unlockable

Locked tier-2/3 drills currently render greyed with "Tier 2 drills unlock in D4 · County League." They should not appear until the division unlocks them. Affordability is deliberately *not* a reason to hide — a drill you cannot currently pay for must stay visible.

`trainingDrillBlockedReason` (`src/game/promotion-progression.ts:119`) returns a reason **only** for division locks, so filtering on it is exactly right.

**Files:**
- Modify: `src/application/view-models.ts` (the function building `drills`)
- Test: `src/application/__tests__/training-tier-unlocks.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/training-tier-unlocks.test.ts`:

```ts
  it('hides division-locked drills instead of listing them greyed', () => {
    const state = createCareer(createLaunchCareerSetup(413));
    const model = squadTrainingViewModel(state);

    expect(model.drills.length).toBeGreaterThan(0);
    expect(model.drills.every(drill => drill.lockedReason === undefined)).toBe(true);
    expect(model.drills.some(drill => drill.name.includes('II'))).toBe(false);
  });
```

Ensure the file's imports include `createCareer`, `createLaunchCareerSetup`, and `squadTrainingViewModel`; add whichever are missing, matching the import style already used in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/training-tier-unlocks.test.ts -t "hides division-locked"`
Expected: FAIL — locked drills are present, so `every(... === undefined)` is `false`.

- [ ] **Step 3: Filter locked drills out of the view model**

`src/application/view-models.ts:1264-1269` — replace:

```ts
    drills: drills.map(drill => drillViewModel(
      drill,
      selected.has(drill.id),
      state,
      assignedPlayerIds,
    )),
```

with:

```ts
    // Division-locked tiers stay hidden until the club can actually reach them.
    // Drills the club merely cannot afford this week stay visible on purpose.
    drills: drills
      .map(drill => drillViewModel(
        drill,
        selected.has(drill.id),
        state,
        assignedPlayerIds,
      ))
      .filter(drill => drill.lockedReason === undefined),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/application/__tests__/training-tier-unlocks.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. If a test asserts a locked drill is *listed*, update it to assert the drill is absent — hiding is the new intended behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/application/view-models.ts src/application/__tests__/training-tier-unlocks.test.ts
git commit -m "feat: hide division-locked training drills until they unlock"
```

---

### Task 5: Show what each locked-in drill improves

`gainLabel` (`"+3 PAC"`) is already computed for every drill but is dropped at the UI boundary — `lockedPlan.drills` picks only `id | name`.

**Files:**
- Modify: `src/ui/models.ts:334`, `src/application/view-models.ts` (locked-plan construction), `src/ui/screens/SquadTrainingScreen.tsx:606-611`
- Test: `src/application/__tests__/weekly-plan-summary.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/weekly-plan-summary.test.ts`:

```ts
  it('carries each locked drill gain label into the saved plan panel', () => {
    let state = createCareer(createLaunchCareerSetup(413));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const drill = trainingContent().drills[0];
    state = setCareerTrainingPlan(state, [roster[0].id], [drill]);

    const model = squadTrainingViewModel(state);
    expect(model.lockedPlan?.drills[0]?.gainLabel).toMatch(/^\+\d+ [A-Z]{3}/);
  });
```

Match the existing imports in that file for `createCareer`, `createLaunchCareerSetup`, `setCareerTrainingPlan`, `squadTrainingViewModel`, and the training content accessor; add any that are missing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/weekly-plan-summary.test.ts -t "gain label"`
Expected: FAIL — `gainLabel` is `undefined` (and TypeScript reports it is not on the picked type).

- [ ] **Step 3: Widen the view-model type**

`src/ui/models.ts:334` — change:

```ts
    drills: readonly Pick<FocusDrillViewModel, 'id' | 'name'>[];
```

to:

```ts
    drills: readonly Pick<FocusDrillViewModel, 'id' | 'name' | 'gainLabel'>[];
```

- [ ] **Step 4: Populate it**

`src/application/view-models.ts:1292-1295` — replace:

```ts
        drills: savedPlan.drills.map(savedDrill => ({
          id: savedDrill.id,
          name: drills.find(drill => drill.id === savedDrill.id)?.name ?? savedDrill.id,
        })),
```

with:

```ts
        drills: savedPlan.drills.map(savedDrill => ({
          id: savedDrill.id,
          name: drills.find(drill => drill.id === savedDrill.id)?.name ?? savedDrill.id,
          gainLabel: Object.entries(savedDrill.gains)
            .map(([attribute, gain]) => `+${gain} ${attribute.toUpperCase()}`)
            .join(' · '),
        })),
```

This mirrors the `gainLabel` construction already used by `drillViewModel` at `:1680-1682`. It reads from the *saved* plan's drills rather than the catalog, so a drill that later becomes unavailable still describes itself correctly.

- [ ] **Step 5: Render it**

`src/ui/screens/SquadTrainingScreen.tsx:606-611` — change the locked drill row to show the gain beneath the name:

```tsx
                {viewModel.lockedPlan.drills.map(drill => (
                  <View key={drill.id} className="flex-row items-center gap-3 border border-ink/20 bg-paper px-2 py-2">
                    <DrillIcon drillId={drill.id} selected />
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-bold uppercase text-ink" numberOfLines={1}>{drill.name}</Text>
                      <Text className="mt-1 font-mono text-sm font-bold text-violet-dark" numberOfLines={1}>{drill.gainLabel}</Text>
                    </View>
                  </View>
                ))}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/application/__tests__/weekly-plan-summary.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/models.ts src/application/view-models.ts src/ui/screens/SquadTrainingScreen.tsx src/application/__tests__/weekly-plan-summary.test.ts
git commit -m "feat: show what each locked-in drill improves"
```

---

### Task 6: Show each trainee's real weekly attribute gain

For every player in the locked plan, show the attributes the plan raises as `PAC 33/60 +3/week`, and `PAC 60/60 · At cap` when no gain will land.

**The displayed gain must be the realized gain, not the drill's nominal gain.** `src/game/training.ts:375` scales every drill by age, archetype, facility and diminishing-returns multipliers, adds a banked coach bonus, then clamps to the archetype cap — so a "+3 PAC" drill rarely delivers exactly +3. `resolveCareerTrainingWeek(state)` is pure and deterministic, so the view model runs it once and diffs.

**Files:**
- Modify: `src/ui/models.ts:332-337`, `src/application/view-models.ts`, `src/ui/screens/SquadTrainingScreen.tsx:593-600`
- Test: `src/application/__tests__/training-cap-feedback.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/training-cap-feedback.test.ts`:

```ts
  it('projects each trainee gain from the real resolver, and zeroes it at the cap', () => {
    let state = createCareer(createLaunchCareerSetup(413));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const drill = trainingContent().drills[0];
    const trainedAttribute = Object.keys(drill.gains)[0] as 'pac';

    state = setCareerTrainingPlan(state, [trainee.id], [drill]);
    const model = squadTrainingViewModel(state);
    const progress = model.lockedPlan?.players[0]?.trainingProgress ?? [];

    // only attributes the plan raises appear
    expect(progress).toHaveLength(Object.keys(drill.gains).length);

    const line = progress.find(entry => entry.label === trainedAttribute.toUpperCase());
    expect(line).toBeDefined();
    expect(line?.value).toBe(trainee.attrs[trainedAttribute]);

    // the projection equals what settlement will actually deliver
    const resolved = resolveCareerTrainingWeek(state).players
      .find(player => player.id === trainee.id)!;
    expect(line?.weeklyGain).toBe(resolved.attrs[trainedAttribute] - trainee.attrs[trainedAttribute]);
    expect(line?.atCap).toBe(line?.weeklyGain === 0);
  });
```

Add imports for `resolveCareerTrainingWeek` (from `../../game`) and any of `createCareer`, `createLaunchCareerSetup`, `setCareerTrainingPlan`, `squadTrainingViewModel`, `trainingContent` not already imported in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/training-cap-feedback.test.ts -t "real resolver"`
Expected: FAIL — `trainingProgress` does not exist on the picked player type.

- [ ] **Step 3: Add the view-model type**

In `src/ui/models.ts`, add above `SquadTrainingViewModel`:

```ts
export interface LockedTrainingProgressViewModel {
  label: 'PAC' | 'SHO' | 'PAS' | 'DEF' | 'TEC' | 'STA' | 'REF';
  /** Attribute value before this week's settlement. */
  value: number;
  /** Personal archetype cap for this attribute. */
  cap: number;
  /** Exactly what weekly settlement will add. Zero when capped or ineligible. */
  weeklyGain: number;
  atCap: boolean;
}
```

Then change `lockedPlan.players` (`:333`) from:

```ts
    players: readonly Pick<SquadPlayerViewModel, 'id' | 'name' | 'role' | 'lookId'>[];
```

to:

```ts
    players: readonly (Pick<SquadPlayerViewModel, 'id' | 'name' | 'role' | 'lookId'> & {
      trainingProgress: readonly LockedTrainingProgressViewModel[];
    })[];
```

- [ ] **Step 4: Add the projection helper**

In `src/application/view-models.ts`, add this helper immediately above `function drillViewModel(` (currently at `:1675`):

```ts
/**
 * Projects next week's training by diffing the real resolver's output, so the
 * number shown is exactly the number weekly settlement will deliver. Copying
 * the growth formula here would silently drift from src/game/training.ts,
 * where age, archetype, facility, diminishing-returns and coach-bonus
 * multipliers all reshape a drill's nominal gain.
 *
 * Takes the already-resolved roster so the caller resolves once per screen,
 * not once per player.
 */
function lockedTrainingProgress(
  resolvedRoster: readonly CareerPlayer[],
  player: CareerPlayer,
  drills: readonly CareerTrainingDrill[],
): LockedTrainingProgressViewModel[] {
  const trainedAttributes = new Set(
    drills.flatMap(drill => Object.keys(drill.gains)),
  ) as Set<keyof CareerPlayer['attrs']>;
  if (trainedAttributes.size === 0) return [];

  const resolvedPlayer = resolvedRoster.find(candidate => candidate.id === player.id);
  const caps = playerAttributeCaps(player);

  return [...trainedAttributes].map(attribute => {
    const value = player.attrs[attribute];
    const weeklyGain = resolvedPlayer === undefined
      ? 0
      : Math.max(0, resolvedPlayer.attrs[attribute] - value);
    return {
      label: attribute.toUpperCase() as LockedTrainingProgressViewModel['label'],
      value,
      cap: caps[attribute],
      weeklyGain,
      atCap: weeklyGain === 0,
    };
  });
}
```

Add to the existing import from `../game`: `resolveCareerTrainingWeek`, `playerAttributeCaps`, and the types `CareerPlayer` and `CareerTrainingDrill` if not already imported. Add `LockedTrainingProgressViewModel` to the existing import from `../ui/models`.

- [ ] **Step 5: Resolve once and attach the projection**

`src/application/view-models.ts:1283-1291` — replace:

```ts
        players: savedPlan.assignedPlayerIds.flatMap(playerId => {
          const player = playerById.get(playerId);
          return player === undefined ? [] : [{
            id: player.id,
            name: player.name,
            role: player.role,
            ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
          }];
        }),
```

with:

```ts
        players: savedPlan.assignedPlayerIds.flatMap(playerId => {
          const player = playerById.get(playerId);
          return player === undefined ? [] : [{
            id: player.id,
            name: player.name,
            role: player.role,
            ...(player.lookId === undefined ? {} : { lookId: player.lookId }),
            trainingProgress: lockedTrainingProgress(resolvedRoster, player, savedPlan.drills),
          }];
        }),
```

`resolvedRoster` must be computed once, before the returned object literal. Add this line alongside the other locals near the top of the same function (immediately before the `return {` that begins at roughly `:1230`):

```ts
  // Resolved once per screen: the projection below diffs against it per player.
  const resolvedRoster = resolveCareerTrainingWeek(state).players;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest src/application/__tests__/training-cap-feedback.test.ts`
Expected: PASS.

- [ ] **Step 7: Render the lines**

`src/ui/screens/SquadTrainingScreen.tsx:593-600` — change the locked player row to:

```tsx
                {viewModel.lockedPlan.players.map(player => (
                  <View key={player.id} className="flex-row items-center gap-3 border border-ink/20 bg-paper px-2 py-2">
                    <View className="border-2 border-b-4 border-ink bg-blue-light px-1 pt-1">
                      <PixelPortrait playerId={player.id} role={player.role} lookId={player.lookId} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-bold text-ink" numberOfLines={1}>{player.name}</Text>
                      {player.trainingProgress.map(entry => (
                        <Text
                          key={entry.label}
                          className="mt-1 font-mono text-sm font-bold text-ink/70"
                          numberOfLines={1}
                        >
                          {entry.label} {entry.value}/{entry.cap}{' '}
                          <Text className={entry.atCap ? 'text-stamp' : 'text-pitch-dark'}>
                            {entry.atCap ? '· At cap' : `+${entry.weeklyGain}/week`}
                          </Text>
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/models.ts src/application/view-models.ts src/ui/screens/SquadTrainingScreen.tsx src/application/__tests__/training-cap-feedback.test.ts
git commit -m "feat: show each trainee's real weekly attribute gain in the locked plan"
```

---

### Task 7: Stop the seeded Training Pitch from suppressing the facility tutorial

**This is a live onboarding bug.** `src/game/career.ts:110-113` seeds a completed Level-1 Training Pitch into every full-career launch save. `src/application/assistant-guide.ts:85` gates the tutorial on `buildings.length === 0`, so `facility-placement` is **never** due on a new career. Worse, `:165-167` backfills it as *already complete* because a building exists. The player never sees "Place your first facility."

Fix: mark the seeded pitch, and make guide logic count only player-built facilities.

**Files:**
- Modify: `src/game/facilities.ts` (building type), `src/game/career.ts:116-131`, `src/application/assistant-guide.ts:85,165-167`, `src/persistence/game-state-codec.ts:263-273`
- Test: `src/application/__tests__/assistant-guide.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/application/__tests__/assistant-guide.test.ts`:

```ts
  it('still asks the player to place their first facility despite the seeded pitch', () => {
    const state = createCareer(createLaunchCareerSetup(413));
    const seeded = state.facilities.grid?.buildings ?? [];

    expect(seeded).toHaveLength(1);
    expect(seeded[0]?.type).toBe('training-pitch');
    expect(seeded[0]?.seeded).toBe(true);
    expect(dueAssistantInboxGuideSequences(state)).toContain('facility-placement');
  });
```

Add imports for `createCareer`, `createLaunchCareerSetup`, and `dueAssistantInboxGuideSequences` if the file does not already have them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/application/__tests__/assistant-guide.test.ts -t "seeded pitch"`
Expected: FAIL — `seeded` is `undefined` and `facility-placement` is absent.

- [ ] **Step 3: Add the flag to the building type**

In `src/game/facilities.ts`, find the interface describing a placed building (the record with `id`, `type`, `level`, `x`, `y`) and add:

```ts
  /** True only for facilities the club was founded with, never player-built. */
  seeded?: true;
```

- [ ] **Step 4: Mark the seeded pitch**

`src/game/career.ts:123-130` — change the tail of `addStartingTrainingPitch` to stamp the flag:

```ts
  const grid = advanceFacilityConstruction(project).grid;
  return {
    ...state,
    facilities: {
      trainingGroundBuilt: true,
      grid: {
        ...grid,
        buildings: grid.buildings.map(building => ({ ...building, seeded: true as const })),
      },
    },
  };
```

- [ ] **Step 5: Count only player-built facilities in the guide**

`src/application/assistant-guide.ts:85` — change:

```ts
  if (buildings.length === 0) {
```

to:

```ts
  const playerBuilt = buildings.filter(building => building.seeded !== true);
  if (playerBuilt.length === 0) {
```

In the `else` branch immediately below, change the `facility-upgrade` condition's `buildings.some(...)` to `playerBuilt.some(...)` so the upgrade prompt also ignores the founding pitch.

`src/application/assistant-guide.ts:165-167` — change the backfill:

```ts
  if ((state.facilities.grid?.buildings.filter(building => building.seeded !== true).length ?? 0) > 0) {
    next = completeAssistantGuideSequence(next, 'facility-placement');
  }
```

- [ ] **Step 6: Persist the flag**

`src/persistence/game-state-codec.ts:263-273` — add `seeded` to the building schema, after `y`:

```ts
      seeded: z.literal(true).optional(),
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest src/application/__tests__/assistant-guide.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS. A test asserting `facility-placement` is *not* due on a fresh career encodes the bug — update it to expect the tutorial.

- [ ] **Step 9: Commit**

```bash
git add src/game/facilities.ts src/game/career.ts src/application/assistant-guide.ts src/persistence/game-state-codec.ts src/application/__tests__/assistant-guide.test.ts
git commit -m "fix: seeded training pitch no longer suppresses the facility tutorial"
```

---

### Task 8: Tell the player the Training Pitch came free

Even with Task 7, nothing explains why a pitch already exists. Add one page to Bert's opening sequence, next to the existing money warning.

**Files:**
- Modify: `content/assistant-guide.json:24-62` (`management-intro`)
- Test: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/content/__tests__/content.test.ts`, inside the existing top-level `describe`:

```ts
  it('explains the founding training pitch during the opening sequence', () => {
    const intro = loadContent().assistantGuide.sequences
      .find(sequence => sequence.id === 'management-intro');
    const bodies = intro?.pages.flatMap(page => page.body) ?? [];

    expect(bodies.some(line => line.includes('Training Pitch'))).toBe(true);
  });
```

Use whichever content accessor the file already uses in place of `loadContent()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/content/__tests__/content.test.ts -t "founding training pitch"`
Expected: FAIL — `expect(false).toBe(true)`.

- [ ] **Step 3: Add the page**

In `content/assistant-guide.json`, inside the `management-intro` `pages` array, insert this object between the "The books bite" page and the "Know your doors" page:

```json
        {
          "kicker": "What you inherited",
          "title": "One pitch, already yours",
          "body": [
            "The board left you a Level 1 Training Pitch. It's built, it's paid for, and it hands you 10 Training Points every week.",
            "That's what pays for drills. Everything else on the grounds, you build yourself."
          ],
          "focus": "assistant",
          "buttonLabel": "Good to know"
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/content/__tests__/content.test.ts`
Expected: PASS. If zod rejects the page, compare the key names against a neighbouring page — `kicker`, `title`, `body`, `focus`, `buttonLabel` are the required shape.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. A test asserting `management-intro` has exactly 3 pages must become 4.

- [ ] **Step 6: Commit**

```bash
git add content/assistant-guide.json src/content/__tests__/content.test.ts
git commit -m "feat: explain the founding training pitch in Bert's intro"
```

---

### Task 9: Stepper consistency pass

Added after Task 1's code review. Task 1 replaced one row-sized tap target with two buttons, which was correct, but it left the screen with two different stepper conventions and six near-duplicate closures. Resolve all three review findings **consistently across every stepper on the screen**, not just the paper-doll rows.

**Must run after Task 3**, which rewrites the same three call sites.

**Files:**
- Modify: `src/ui/screens/CharacterCreationScreen.tsx`
- Test: `src/ui/__tests__/character-creation-copy.test.ts`

- [ ] **Step 1: Collapse the duplicated closures**

The three paper-doll rows currently pass six near-identical inline closures of the shape
`setAppearance(current => ({ ...current, key: stepChoice(current.key, delta, count) as Cast }))`.
The file already solves this exact "same shape, different field" problem for the six numeric stats with a single `adjust(stat, delta)` function at `:58`. Add the matching helper inside `CharacterCreationScreen`, above `adjust`:

```tsx
  function cycleAppearance(
    key: keyof CreatedPlayerAppearance,
    delta: -1 | 1,
    count: number,
  ): void {
    setAppearance(current => ({
      ...current,
      [key]: stepChoice(current[key], delta, count),
    }) as CreatedPlayerAppearance);
  }
```

Then reduce each call site to, for example:

```tsx
              <AppearanceChoice
                label="Skin tone"
                value={`${appearance.skinTone + 1} / 6`}
                onPrevious={() => cycleAppearance('skinTone', -1, 6)}
                onNext={() => cycleAppearance('skinTone', 1, 6)}
              />
```

Use counts 6 (skin tone), **10** (hair — Task 3 has landed by now), 4 (kit accent).

- [ ] **Step 2: Put the current value back into the accessible name**

Task 1 traded a combined announcement ("Skin tone, 3 / 6. Tap for next.") for two bare labels ("Previous Skin tone"). A screen-reader user swiping directly onto a button no longer hears where they are. In `AppearanceChoice`, change the two labels to include the value:

```tsx
        accessibilityLabel={`Previous ${label}, currently ${value}`}
```

```tsx
        accessibilityLabel={`Next ${label}, currently ${value}`}
```

Apply the same treatment to the six numeric stat steppers at `:191-221`, whose labels are currently `Decrease ${copy.label}` / `Increase ${copy.label}` with no value:

```tsx
                  accessibilityLabel={`Decrease ${copy.label}, currently ${value}`}
```

```tsx
                  accessibilityLabel={`Increase ${copy.label}, currently ${value}`}
```

- [ ] **Step 3: Write the test**

Append to `src/ui/__tests__/character-creation-copy.test.ts`:

```ts
  it('announces the current value on every stepper button', () => {
    expect(source).toContain('currently ${value}');
    expect(source).toContain('currently ${value}');
    // no stepper may announce itself without its value
    expect(source).not.toMatch(/accessibilityLabel=\{`(Previous|Next) \$\{label\}`\}/);
    expect(source).not.toMatch(/accessibilityLabel=\{`(Decrease|Increase) \$\{copy\.label\}`\}/);
  });

  it('cycles appearance through one shared helper', () => {
    expect(source).toContain('function cycleAppearance');
    expect(source.match(/cycleAppearance\('/g)?.length).toBe(6);
    // the duplicated inline spread closures are gone
    expect(source).not.toContain('setAppearance(current => ({ ...current, skinTone:');
  });
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/ui/__tests__/character-creation-copy.test.ts`
Expected: PASS.

- [ ] **Step 5: Decide the tap target deliberately**

The third finding was that the row shrank from one large target to two 44pt buttons. Both buttons meet the 44-point minimum and this now matches the numeric steppers exactly, so **no change is required** — but confirm by eye on device that the rows do not feel fiddly. If they do, widen the buttons rather than restoring a whole-row `Pressable`, which would re-introduce an ambiguous tap zone between two directional controls.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`
Expected: PASS, except the known pre-existing README engine-marker failure.

```bash
git add src/ui/screens/CharacterCreationScreen.tsx src/ui/__tests__/character-creation-copy.test.ts
git commit -m "refactor: one appearance cycler and value-bearing stepper labels"
```

---

## Final verification

- [ ] **Run the full suite**

Run: `npm test`
Expected: PASS, no skips.

- [ ] **Check the app on web**

Run: `npx expo start --web`

Confirm by eye:
1. First-hire screen: `‹`/`›` on all three paper-doll rows; hair reads `n / 10`; panel titled "Name".
2. Squad → Training: no "Tier 2 drills unlock in…" rows.
3. Save a plan, then check the "Locked in" panel shows `+3 PAC` under each drill and `PAC 33/60 +3/week` under each trainee.
4. Start a fresh career: Bert's intro includes "One pitch, already yours", and "Place your first facility" appears in the inbox.

- [ ] **Check on iOS**

NativeWind renders differently on native than web, so confirm the same four points in the simulator before calling this done.

## Notes for the implementer

- **No lint step exists.** The user's global config mentions `npm run lint:fix` and `check-nativewind-style-collisions.mjs`; neither is present in this repo. `npm test` plus reading the diff is the gate.
- **Never import `Pressable` from `react-native-gesture-handler`** — NativeWind silently ignores every `className` if you do. Always `react-native`.
- `src/sim/` and `src/game/` stay pure: no React Native, Expo, `Math.random`, or `Date.now`. Task 3, 6 and 7 touch `src/game/` — keep them deterministic.
- None of these tasks change match-engine behaviour or RNG consumption, so **`ENGINE_VERSION` does not need a bump**.
