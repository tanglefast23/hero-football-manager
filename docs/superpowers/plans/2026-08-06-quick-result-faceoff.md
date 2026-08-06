# Quick Result Face-Off — Implementation Plan (v2 — Grok plan audit applied)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a 2-second VS face-off between the two clubs' best outfield players when the manager taps Quick Result, per `docs/superpowers/specs/2026-08-06-quick-result-faceoff.md` (the spec, Grok-approved 2026-08-06).

**Architecture:** Presentation only. `store.quickResult()` keeps every line of its simulation, settlement and save work unchanged and simply shows a new `'faceoff'` screen first, holding the screen it *would* have shown in `pendingPostFaceOffScreen`. Player selection and strike direction are pure functions of already-settled data in `src/application/quick-result-faceoff.ts`. `src/sim/` and `src/game/` are not touched and `ENGINE_VERSION` does not move.

**Tech stack:** TypeScript, React Native (plain `Animated`), react-native-skia (`Canvas`/`Atlas`), expo-audio, Jest (node env, transpile-only). Run `npx tsc --noEmit` at the end of EVERY task.

**Commit hygiene:** stage explicitly (`git add <paths>`) — never `-am`/`-A`. Commit after every task.

**Execution order: 1 → 2 → 3a → 4 → 5 → 3b → 6.** The store's *fields* land early (3a) because App needs them to compile; the store's *activation* lands last (3b) because App needs to exist before anything sets `screen: 'faceoff'`. See the ordering rule on Task 3a for what breaks otherwise.

**Asset already in the tree:** `assets/audio/sfx/quick-result-faceoff.m4a` (2.30s, mono 44.1kHz AAC, peak −0.6 dB, 0.25s fade tail), converted from the owner's `cuban.webm`.

---

### Task 1: Pure face-off model

**Files:**
- Create: `src/application/quick-result-faceoff.ts`
- Modify: `src/ui/models.ts` (add `QuickResultFaceOffViewModel` near `MatchDayBannerViewModel`)
- Test: `src/application/__tests__/quick-result-faceoff.test.ts`

- [ ] **Step 1: Failing tests.** Cover spec §11.1–11.6:
  - highest `roleOverall` outfield player wins the pick, and a keeper never does even when the keeper has the highest `roleOverall` in the eleven;
  - ties break on ascending player id, and repeated calls are stable;
  - an all-keeper eleven falls back to the best of any role; an empty eleven returns `null`;
  - `faceOffStrike('WIN' | 'LOSS' | 'DRAW')` → `'club' | 'opponent' | 'bounce'`;
  - the club side is index 0 (drawn left) whether the user's fixture is home or away;
  - the accessibility sentence names both players and both clubs.

- [ ] **Step 2: Implement.**

```ts
// src/ui/models.ts — pin this shape before writing either side of it.
export interface QuickResultFaceOffViewModel {
  /** [club, opponent]. The club is index 0 and is always drawn on the left. */
  sides: readonly [FaceOffSideViewModel, FaceOffSideViewModel];
  /** Who strikes the ball: 'club', 'opponent', or 'bounce' for a draw. */
  strike: 'club' | 'opponent' | 'bounce';
  /** The whole scene as one spoken sentence, minus the "Tap to skip." suffix. */
  accessibilityLabel: string;
}

export interface FaceOffSideViewModel {
  playerId: string;
  playerName: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  /** Passed straight to playerLookId in the component. */
  lookId?: string;
  clubName: string;
}
```

**Visual-id ownership:** the view model carries `playerId` / `role` / `lookId` and *not* a sprite key. `playerLookId(...)` is called in the component, exactly as `DrillSceneOverlay` does it. The pure ring must not know about the atlas.

```ts
// src/application/quick-result-faceoff.ts
import { roleOverall } from '../game/archetype-caps';   // the squad register's own metric
import type { PlayerDef, TeamDef } from '../sim/types';
import type { QuickResultFaceOffViewModel } from '../ui/models';

export type FaceOffStrike = 'club' | 'opponent' | 'bounce';

export function faceOffStrike(outcomeLabel: 'WIN' | 'DRAW' | 'LOSS'): FaceOffStrike { … }

/** Best outfielder in the eleven; keepers excluded, ties on ascending id. */
export function bestOutfieldPlayer(team: TeamDef): PlayerDef | null { … }

export function quickResultFaceOffViewModel(args: {
  clubTeam: TeamDef;
  opponentTeam: TeamDef;
  outcomeLabel: 'WIN' | 'DRAW' | 'LOSS';
}): QuickResultFaceOffViewModel | null { … }
```

  Rules, verbatim from the spec: never re-derive an overall; the club is always side 0; return `null` (not a throw) when either side has no players at all, so the caller can skip the scene.

- [ ] **Step 3: `npx tsc --noEmit`, run the new test file, commit.**

---

### Task 2: Audio cue

**Files:**
- Modify: `src/render/management-sfx.ts`
- Modify: `src/render/__tests__/management-sfx.test.ts`

- [ ] **Step 1: Append `'quick-result-faceoff'` LAST** in both `ExplicitManagementSfxKey` and `MANAGEMENT_SFX`, with the "appended last so existing player indices stay stable" comment the neighbouring entries carry.
- [ ] **Step 2: Add `playQuickResultFaceOffSfx()` and `stopQuickResultFaceOffSfx()`**, modelled on `playMatchDayBugleSfx` / `stopMatchDayBugleSfx`.
- [ ] **Step 3: Update the test's positional pins** — the base catalog goes 24 → 25 cues, so:
  - `toHaveLength(30)` → `toHaveLength(31)`; `toHaveLength(60)` → `toHaveLength(62)`;
  - `mockPlayers[30 + 16]` → `[31 + 16]`; `mockPlayers[30 + 2]` → `[31 + 2]`;
  - `uiClickPool` `[2, 24, 25, 26]` → `[2, 25, 26, 27]`;
  - `statStepPool` `[17, 27, 28, 29]` → `[17, 28, 29, 30]`.
  These indices are pinned deliberately; they are the guard that catches an accidental catalog reorder.
- [ ] **Step 4: `npx tsc --noEmit`, run `management-sfx.test.ts`, commit.**

---

### Task 3a: Store fields and action — INERT

> **Ordering rule for this plan, and the reason for the split.** `quickResult` must not set `screen: 'faceoff'` until App can render it. App's screen chain ends in a bare `else` that renders `ManagementShell`, and no exhaustive `M1Screen` switch exists, so `tsc` would stay green while Quick Result silently dropped the manager on the desk with a settled career and a stranded `postMatch`. `tsc` passing is therefore NOT a sufficient gate for this feature. The activation step is Task 3b, and it lands only after Task 5.

**Files:**
- Modify: `src/application/store.ts`
- Test: `src/application/__tests__/quick-result-faceoff-store.test.ts`

- [ ] **Step 1: Failing tests** for the inert surface:
  - `completeFaceOff()` moves to the held screen and clears both fields; a second call is harmless; a call while `screen !== 'faceoff'` mutates nothing at all;
  - a loaded career, a new career and a developer-save restore never carry `faceOff`.
- [ ] **Step 2: Add `'faceoff'` to the `M1Screen` union.**
- [ ] **Step 3: Add `faceOff: QuickResultFaceOffViewModel | null` and `pendingPostFaceOffScreen: M1Screen | null`** to the store state, with the "app state, never persisted — same argument as `inboxDutyReminder`" comment.
- [ ] **Step 4: Declare `completeFaceOff: () => void` on the `M1Store` interface** alongside `dismissInboxDutyReminder`, and implement it: a no-op unless `screen === 'faceoff'`; otherwise sets `screen` to `pendingPostFaceOffScreen ?? 'postmatch'` and nulls both fields. **It must not save or mutate the career.**
- [ ] **Step 5: Clear both fields everywhere `postMatch` is cleared on a career-identity change** — initial state, `initializePersistence`, `discardUnreadableSave`, `restoreBackupSave`, `restoreDeveloperSave`, `startNewCareer`, `continueCareer`, and the reset near the end of the file. *(The same audit was applied to `matchDayBanner` on 2026-08-06 — keep the three fields' clear sets identical.)*
- [ ] **Step 6: `quickResult` is NOT touched in this task.** Nothing sets `faceOff`; the field exists and is always null. Quick Result behaves exactly as it does today.
- [ ] **Step 7: `npx tsc --noEmit`, run the store tests, commit.**

---

### Task 4: The overlay component

**Files:**
- Create: `src/render/QuickResultFaceOff.tsx`

- [ ] **Step 1: Build the scene** per spec §6/§7. Structure follows `DrillSceneOverlay`:
  - a full-screen `SfxPressable` whose `onPress` calls the idempotent `finishOnce` (`completedRef` pattern);
  - a Skia `Canvas` with the pitch fill + centre circle, then an `Atlas` carrying both player sprites and the ball;
  - the atlas built through `buildSpriteAtlas(Skia, [ourVisualId, theirVisualId])` inside a `try`/`catch` falling back to `buildFallbackAtlas` — **atlas failure still shows the scene**, it does not skip it *(Grok note 1: the store never preflights Skia; §3.2's skip is only for a null pure view model)*;
  - player magnification through `snapSpriteScale` at the drill scene's nominal 4.1, ball at 3.1;
  - the `VS` in the pixel font with a slam-in spring;
  - a **visible `TAP TO SKIP` label** in a corner, in the drill scene's wording and treatment — the skip must be discoverable by eye, not only through the accessibility label;
  - names + club names under each sprite;
  - `playQuickResultFaceOffSfx()` on mount, `stopQuickResultFaceOffSfx()` in the effect's cleanup.
- [ ] **Step 2: Timings** — 2000ms total under motion, 1200ms static under Reduce Motion, with the beat table's four phases. `useNativeDriver: true` throughout.
- [ ] **Step 3: Accessibility label** = the sentence from the view model, plus "Tap to skip."
- [ ] **Step 4: `npx tsc --noEmit`, commit.**

---

### Task 5: App and chrome integration

**Files:**
- Modify: `App.tsx`
- Modify: `src/render/menu-audio.ts`
- Modify: `src/render/__tests__/menu-audio.test.ts` (if it enumerates screens)

- [ ] **Step 1: Mount the overlay** in the screen chain: `store.screen === 'faceoff' && store.faceOff !== null` renders `<QuickResultFaceOff … reduceMotion={reduceMotion} onDone={store.completeFaceOff} />`.
- [ ] **Step 2: Fail-soft branch** for `screen === 'faceoff' && faceOff === null`: fall through to `pendingPostFaceOffScreen` when set, else awakening if `career.awakening.pending !== undefined`, else postmatch if `postMatch !== null`, else management. Never a blank screen. *(Grok note 3.)*
- [ ] **Step 3: StatusBar** — add `'faceoff'` to the light-chrome condition beside `'watched'` and `'awakening'`.
- [ ] **Step 4: `menuThemeForScreen`** — `'faceoff'` joins `'welcome' | 'matchday' | 'postmatch'` on the `'opening'` bed, so the music does not stop for two seconds between two screens that both play it.
- [ ] **Step 5: Pin it.** Add an explicit assertion to `menu-audio.test.ts`: `expect(menuThemeForScreen('faceoff', 0)).toBe('opening')`. Without a named pin this silently regresses to `null` — a two-second music gap mid-flow — the moment anyone reorders that function.
- [ ] **Step 6: `npx tsc --noEmit`, commit.**

---

### Task 3b: Activate the face-off — lands AFTER Task 5

**Files:**
- Modify: `src/application/store.ts`
- Modify: `src/application/__tests__/quick-result-faceoff-store.test.ts`

This is the commit that switches the feature on, and it is deliberately last among the feature tasks: by now App renders `'faceoff'` and fails soft on a null one, so no intermediate commit can strand the manager.

- [ ] **Step 1: Failing tests.** Spec §11.7 and §11.9–11.13:
  - `quickResult` leaves `career`, `postMatch` and both save queues exactly as they are today, and sets `screen: 'faceoff'` with the awakening/postmatch choice in `pendingPostFaceOffScreen`;
  - a cup tie level on goals but decided on penalties produces `WIN`/`LOSS`, never the bounce;
  - a league draw does produce the bounce;
  - **double-header week:** league Quick Result → `completeFaceOff()` → post-match → `continueAfterMatch` → the cup matchday is still reachable, and a second Quick Result while `screen !== 'matchday'` still returns early;
  - **the onboarding first match** (spec §11.13) still runs settlement → awakening (when one fires) → post-match, with the face-off only ahead of that chain and never inside it.

- [ ] **Step 2: Build the face-off from the PRE-SETTLEMENT capture.**

  `quickResult` already destructures `const { kind, fixture, fixtures, teams } = currentMatchday(before)` at the top of the call. **Use that `teams`, that `fixture`, and `before.userClubId`.** Pair them with `postMatch.result.outcomeLabel`.

  **Never re-enter `currentMatchday` after `completeMatchday`.** Two distinct ways that breaks:
  - on a league-only week the career has left `phase: 'matchday'`, and `currentMatchday` **throws** — turning a decorative scene into a crash on a settled match;
  - on a **double-header week** the career is still `phase: 'matchday'` on the *cup* fixture, so it would return the **cup's** teams and name the wrong two players for a league face-off.

  Both are silent-wrong rather than loud-wrong, which is why this step is spelled out rather than left to judgement.

- [ ] **Step 3: Set the screen.** When the view model is non-null, `screen: 'faceoff'` and hold the previous destination in `pendingPostFaceOffScreen`. When it is null, set the destination directly — byte-identical behaviour to today on that path.
- [ ] **Step 4: `npx tsc --noEmit`, run the store tests, commit.**

---

### Task 6: Full verification

- [ ] **Step 1: `npx tsc --noEmit`** — clean.
- [ ] **Step 2: `npx jest`** — the whole suite green. Expect nothing but the deliberately-updated `management-sfx.test.ts` pins to move.
- [ ] **Step 3: Golden replay** — confirm the snapshot is untouched. If it moved, something reached the sim ring and the change is wrong; do not update it.
- [ ] **Step 4: Device or web QA** — one Quick Result on a league week (win, loss and draw if reachable) and one on a cup week. Confirm the horn stops on a skip, the bed does not gap, and Reduce Motion holds a static card. **Mute the web preview on load and close the tab afterwards** (project QA hygiene rule).
- [ ] **Step 5: Commit only if verification produced fixes** — a verification pass with no file changes has nothing to commit.

---

## Wording note carried from the audit

Spec §4 says the pool is the starting eleven, described as "players who actually played". Quick Result forces auto-subs, so a bench player may genuinely have played. The pool stays the starting eleven — that is the product decision — but **do not name the concept "participants" in code**, because a `participantPlayerIds` list already exists in the awakening path and means something different. *(Grok note 4.)*
