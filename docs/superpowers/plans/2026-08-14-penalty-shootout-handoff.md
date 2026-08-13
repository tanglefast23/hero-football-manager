---
title: "feat: Show Hero Cup penalty shootouts"
type: feat
date: 2026-08-14
status: handoff
---

# Hero Cup penalty shootout presentation handoff

## Goal

When a user-controlled Hero Cup tie finishes level, show the penalty shootout
that decided the recorded winner. Reuse the spirit and visual language of the
existing Quick Result face-off.

The shootout is presentation only. The match is already simulated, settled,
and saved before this screen appears.

## Owner decisions

- Show one shooter against the opposing goalkeeper.
- Alternate teams after every kick.
- Show `SCORE!` or `MISS!` over each attempt.
- Keep the running shootout score at the top.
- Reuse the existing Quick Result face-off player art and presentation style.
- A tap skips the whole shootout and moves to the normal result flow.
- Show the shootout after both Quick Result and a watched Hero Cup draw.
- Do not show it for league draws or AI-only Cup ties.

## Existing truth to preserve

The Cup already resolves tied scores correctly.

- `src/game/career.ts` uses `deterministicPenaltyWinner(...)` when Cup goals are
  level.
- `NationalCupResult.winnerClubId` stores the winner.
- `postMatchViewModel(...)` reads that recorded winner and returns `WIN` or
  `LOSS`, even when the displayed goals are level.
- `QuickResultFaceOff` already avoids calling a tied Cup score a draw.

Do not change the winner algorithm in this feature. Do not add shootout kicks
to the match score. Do not settle the Cup twice.

## Player flow

### Quick Result

```text
Tap Quick Result
  -> simulate, settle, and save exactly as today
  -> tied Hero Cup score: Penalty Shootout
  -> awakening when due
  -> post-match report
```

Skip the normal Quick Result face-off for this one case. The shootout replaces
it because it already provides the result presentation.

### Watched match

```text
Full-time whistle on a tied Hero Cup match
  -> settle and save exactly as today
  -> Penalty Shootout
  -> awakening when due
  -> post-match report
```

### Every other match

Keep the current path unchanged. A league draw still uses the existing
back-and-forth face-off on Quick Result.

## Pure view model

Add a pure application builder, beside `quick-result-faceoff.ts`.

Suggested file:

```text
src/application/penalty-shootout.ts
```

Suggested shape:

```ts
interface PenaltyShootoutViewModel {
  fixtureId: string;
  clubName: string;
  opponentName: string;
  winner: 'club' | 'opponent';
  kicks: readonly PenaltyKickViewModel[];
  finalClubScore: number;
  finalOpponentScore: number;
  accessibilityLabel: string;
}

interface PenaltyKickViewModel {
  id: string;
  shootingSide: 'club' | 'opponent';
  shooter: FaceOffSideViewModel;
  goalkeeper: FaceOffSideViewModel;
  outcome: 'score' | 'miss';
  clubScore: number;
  opponentScore: number;
}
```

Use the pre-settlement `TeamDef` snapshots already captured by the store.
Never rebuild the teams from the next match in a double-header week.

### Shooter selection

- Exclude goalkeepers.
- Rank starters by the same role-aware data already used by the game. Prefer
  shooting and technique for the order.
- Break ties by player id.
- Rotate through five shooters, then repeat the order during sudden death.
- If malformed data has no outfield player, skip the presentation safely.

### Goalkeeper selection

- Use the starting goalkeeper.
- If malformed data has none, use the highest-rated available starter.
- If a team is empty, skip the presentation safely.

## Kick sequence

The stored Cup result knows only the winner. It does not store individual
penalty kicks. Build a deterministic presentation sequence that agrees with
`winnerClubId`.

Requirements:

- Alternate teams after every attempt.
- Follow real clinch rules during the first five kicks per team.
- Continue in paired sudden-death kicks when still level.
- End only when both teams have taken the same number of kicks and one leads.
- Make the final winner match `winnerClubId`.
- Derive any variation from stable fixture data such as `careerSeed`,
  `matchSeed`, round, and fixture id with a separate presentation salt.
- Never use or advance the match engine PRNG.
- The same inputs must return the same kick list byte-for-byte.

The kicks are a dramatization of an already recorded winner. Do not imply that
the presentation rerolled or changed the result.

## Screen and animation

Suggested file:

```text
src/render/PenaltyShootout.tsx
```

Use the current `QuickResultFaceOff` patterns:

- `buildSpriteAtlas` with `buildFallbackAtlas` on failure;
- `playerLookId` for the shooter and goalkeeper;
- `snapSpriteScale` and `PIXEL_ART_SAMPLING`;
- a full-screen pitch treatment;
- a single full-screen `SfxPressable` for skip;
- a completion ref so timer and tap cannot advance twice; and
- the existing deferred Skia exports on web.

Do not refactor `QuickResultFaceOff` merely to remove a little duplication.
Extract a shared helper only when both components become smaller.

### Per-kick beat

Target about 650-800 ms per kick:

1. Shooter and goalkeeper appear in their places.
2. Ball travels toward goal.
3. Goalkeeper shifts or dives using existing frames and simple transforms.
4. `SCORE!` or `MISS!` pops over the action.
5. The score at the top updates.
6. The next pair replaces them.

Keep the user club score on the left. Label both club names. Show kick markers
under each score so misses remain readable after the large word disappears.

Reuse existing kick, goal, and save sounds when suitable. Do not add an audio
asset only to make this feature compile.

### Skip and reduced motion

- One tap skips the entire shootout.
- Skipping never changes the winner or settlement.
- Reduced Motion shows the final shootout score and winner without kick travel,
  holds briefly, then continues.
- Unmount stops every timer and one-shot sound started by this screen.

## Store integration

Add an ephemeral `shootout` screen and view model state. Hold the same
post-presentation destination currently held behind the face-off.

The career must already contain the settled Cup result before `shootout` is
shown. `completeShootout()` changes only app screen state. It must not save or
mutate the career.

Clear shootout app state on:

- new career;
- continue/load;
- developer-save restore;
- reset; and
- every transition that already clears face-off state.

If the view model cannot be built, go directly to the normal destination. A
decorative scene must never trap a completed match.

## Copy and accessibility

Add all new player-facing copy to all seven locales in the same change.

Required concepts:

- `PENALTY SHOOTOUT`
- `SCORE!`
- `MISS!`
- `SUDDEN DEATH`
- `TAP TO SKIP`
- a final spoken label naming both clubs, the shootout score, and the winner.

The screen is supplementary. The normal post-match report remains the durable
source for the match result.

## Tests

### Pure application tests

- Same inputs produce the same kick list.
- Kicks alternate sides.
- Running scores match every kick.
- The first-five clinch rule is legal.
- Sudden death ends only after a paired round.
- The final winner always matches `winnerClubId`.
- Shooter rotation and goalkeeper selection are deterministic.
- Empty or malformed teams return `null` instead of throwing.

### Store tests

- Quick Result on a tied user Cup match opens `shootout`.
- A watched tied user Cup match opens `shootout`.
- Cup wins decided in normal time do not open it.
- League draws keep their existing path.
- AI-only tied Cup matches never open it.
- The career, ledger, Fame, wellbeing, milestones, and save queues match the
  current settled result exactly.
- `completeShootout()` is idempotent and never saves.
- A double-header uses the teams from the match that just finished.
- Awakening still precedes the post-match report after the shootout.

### UI and contract tests

- Running score, club names, kick markers, and `SCORE!`/`MISS!` are present.
- One tap skips.
- Reduced Motion avoids travel animation.
- Web uses the deferred Skia surface.
- New copy exists in every locale.
- Existing Quick Result face-off tests remain green.

## Architecture gates

- Keep kick-sequence logic out of React and Skia.
- Do not import React Native into `src/game/` or `src/sim/`.
- Do not consume simulation RNG.
- Do not change `ENGINE_VERSION`; this feature does not alter match results.
- Run focused shootout, Cup-flow, face-off, screen-transition, and i18n tests.
- Run `npx tsc --noEmit`.

## Acceptance criteria

- [ ] Every tied user Hero Cup match visibly resolves through a shootout.
- [ ] Quick Result and watched matches show the same winner.
- [ ] The running shootout score is always visible.
- [ ] Each kick clearly reads `SCORE!` or `MISS!`.
- [ ] The sequence is deterministic and legally ordered.
- [ ] A tap skips without changing the career.
- [ ] League draws and normal Cup wins are unchanged.
- [ ] The post-match report still shows the level match score and the recorded
      Cup winner.
- [ ] All focused tests and TypeScript pass.

## Out of scope

- Changing penalty-winner odds.
- Adding penalties to the normal match score.
- Player-controlled aiming or saving.
- New currencies, rewards, or player progression.
- Reworking the normal Quick Result face-off.
