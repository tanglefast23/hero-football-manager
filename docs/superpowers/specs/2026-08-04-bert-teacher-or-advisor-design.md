# Bert as Teacher or Advisor

**Date:** 2026-08-04
**Status:** Design approved; ready to plan

Every factual claim about the current code below was read out of the tree on
2026-08-04 and is cited by file and line.

## Problem

Bert teaches. That is the whole of his job outside the story beats: 24 inbox
explainers, an objective line with arrows, a dozen one-shot lessons, and four
hard blocks on Advance Week that hold the first three weeks of a career shut
until the manager builds a training pitch, builds a coaching office, and answers
a youth intake.

For a first career this is the game. For a second one it is a stranger telling
you how to do your job, and worse than that — it *pushes the club in directions
the manager has not chosen*. The week-1–3 duties are not advice. They are a
locked turn button with a shopping list attached.

A manager who has won the Global League and the Hero Cup has proved they do not
need any of it.

## Goals

- After a device has finished the climb once, starting a new game asks whether
  Bert should teach this time.
- **Advisor** mode silences every teaching surface and lifts every block, while
  keeping Bert present wherever he carries a real decision or a story beat.
- **Teacher** mode is today's game, unchanged in every observable way.
- The choice is changeable mid-career from Settings.
- Nothing gets stuck. Advisor mode must be able to reach the end of the game.

## Non-goals

- **No change to season-1 feature pacing.** Scouting still unlocks in week 15,
  the cup guide in week 5, youth in week 2, in both modes
  (`src/game/story-progression.ts`). Opening the drip is a separate argument.
- **No New Game+ carryover.** The roadmap's item stays on the roadmap
  (`docs/10-roadmap.md:90`).
- **No `ENGINE_VERSION` bump.** Nothing in `src/sim/` is touched and nothing
  changes RNG consumption, so no golden-replay decision arises.
- No new Bert art, no new sprite work, no new copy for the 24 sequences.
- No second save slot. The game has one career at a time and that does not
  change here.

## What exists today

### Bert's surfaces

| Layer | Where | What |
|---|---|---|
| Opening walk-ons | `pendingAssistantGuideSequence` (`src/application/assistant-guide.ts:34`) | `management-intro` (S1W1), `desk-intro` (first fixture week) |
| Objective line | `currentAssistantObjective` (`src/application/assistant-guide.ts:351`) | "OPEN SQUAD." → "BUILD YOUR TRAINING PITCH." → "INBOX CLEAR. ADVANCE WEEK." |
| Inbox explainers | `dueAssistantInboxGuideSequences` (`src/application/assistant-guide.ts:69`) | 24 sequences, at most 3 delivered per week |
| Blocking duties | `outstandingInboxDuties` (`src/application/assistant-guide.ts:271`) | `coaching-office` + `youth-intake`, S1 weeks 1–3 |
| One-shot lessons | `AssistantGuideMilestone` (`src/game/assistant-guide.ts:37`) | condition gamble, matchday condition, quick-train, three facility combos, 3× speed, first cup exit, two fans beats |
| Desk tips | `showManagerTips` (`src/ui/screens/ClubHomeScreen.tsx:134`) | filters manager notes where `kind === 'tip'` |

### The four blocks

Three live in one function — `advanceCareer` in `src/application/store.ts`,
which calls the game ring's `advanceWeek` only after its gates pass:

| Block | Line | Guard |
|---|---|---|
| "Train a player before advancing the week." | 673 | requires `intro-complete` |
| Guided first week: tab, pitch, head coach | 675–703 | requires `intro-complete` |
| Weeks 1–3 duties hold the week shut | 752 | none — reads `dueAssistantInboxGuideSequences` directly |

The first two are guarded by `intro-complete`, a milestone banked only by
completing the `management-intro` walk-on. The third is not guarded by anything
Bert-shaped and is the one that must be lifted deliberately.

The fourth is not in the store at all. `App.tsx:1624` disables the button — and
its keyboard binding — whenever an objective is live and is not pointing at
Advance Week itself:

```ts
advanceWeekDisabled={store.saving
  || store.saveBlocked
  || (assistantObjective !== null && assistantObjective.target !== 'advance-week')}
```

It needs no gate of its own, because `assistantObjective` *is*
`currentAssistantObjective(...)`, which returns `null` for an Advisor career —
but it is a fourth way the button can refuse, and a design that only counted the
store's three would leave a veteran with a dead button if the objective were
ever resurrected. It is pinned by test rather than by a redundant condition.

### The existing toggle

`AppPreferences.managerTipsEnabled` (`src/persistence/preferences-repository.ts:47`)
ships with a Settings row labelled "Manager's tips"
(`src/ui/SettingsOverlay.tsx:304`). Its only consumer is
`ClubHomeScreen.tsx:134`, where it filters desk notes of `kind === 'tip'`. It
does not touch a single guide sequence, milestone, or block. Everything it
controls is a strict subset of what Advisor mode silences.

### Why nothing can get stuck

Three independent reasons, each verified:

1. **The game ring never reads a Bert flag to decide a transition.** The only
   files under `src/game/` that call `completeAssistantGuideMilestone` or
   `completeAssistantGuideSequence` are `assistant-guide.ts` itself and its own
   test. `runHeadlessFullCareer` (`src/game/headless.ts:31`) loops `advanceWeek`
   through whole careers with Bert never having spoken;
   `src/game/__tests__/full-career.test.ts` passes 17/17, including "runs four
   complete seasons through the endless management clock deterministically" and
   "closes stale open offers when an already-upgraded save resumes after Week 4"
   — the latter being the proof that an **unanswered youth intake expires
   cleanly**, which is exactly what happens once the week-1–3 duty stops forcing
   an answer.
2. **The onboarding spine is Bert-free.** `create-player → first-match →
   collapse → reveal → complete` is advanced by `addCreatedPlayer`, the played
   fixture, and `post-match-awakening.ts`. No Bert milestone appears in that
   chain.
3. **Every Bert surface is an overlay, never an exit.** Each is a
   `CharacterSpeechOverlay` with an `onDone`, layered over a screen that already
   works: `ClubLegacyScreen`'s `onChoose` fires with or without the walk-on, and
   `guided` is only a highlight. `guideOverlayVisible` (`App.tsx:1096`) is used
   solely to *suppress* other overlays, so with Bert silent it is `false` and
   nothing is hidden.

## Design

### The mode

```ts
export type AssistantMode = 'teacher' | 'advisor';
```

`assistantMode?: AssistantMode` on `GameState`, absent meaning `'teacher'` —
the same shape and the same reasoning as `difficulty?: DifficultyMode`
(`src/game/types.ts:698`, "Old saves omit this and are treated as Cozy").

**Teacher** is today's game with no observable change. **Advisor** silences the
teaching and lifts the blocks.

#### Why the save and not preferences

`src/application/store.ts` references preferences zero times: they are React
state in `App.tsx:454`, and the career store is a separate zustand store. The
Advance Week block lives in the store, so a preferences-held mode would have to
be threaded into the store — a new coupling, for one enum.

On `GameState`, the presentation and block decisions read it off the state they
already receive, with **zero signature changes**, staying pure and
headless-testable as `CLAUDE.md` requires. The due-guide derivation deliberately
does not: weekly stories and tips use the same logical inbox schedule, so
erasing due guides would change the game rather than merely hide Bert. It is
also per-career by the user's own framing: the question is asked when a career
starts.

Cost: one optional field in `game-state-codec.ts`, modelled exactly on
`difficulty: z.enum([...]).optional()` (`src/persistence/game-state-codec.ts:925`).

### What Advisor silences

Three functions return empty, and the rendered inbox filters its guide strand:

| Function | Advisor returns | Silences |
|---|---|---|
| `pendingAssistantGuideSequence` | `null` | `management-intro`, `desk-intro` |
| rendered Advisor inbox | no guide rows or guide metadata | all 24 explainers, while retaining logical weekly occupancy |
| `currentAssistantObjective` | `null` | objective line, arrows, guidance glow |
| `outstandingInboxDuties` | `[]` | the weeks 1–3 block |

Plus explicit early-outs on the two `intro-complete`-guarded store blocks. They
would fall away on their own, because Advisor never banks `intro-complete` — but
that is accidental correctness, and a future change that banks the milestone for
some other reason would silently restore a block nobody meant to keep. They are
gated on the mode.

Plus these one-shots, each currently a `!hasAssistantGuideMilestone(...)`
condition in `App.tsx`:

- `facilityComboReveal` (1028), `cupExitConsolationVisible` (1046),
  `tripleSpeedIntroVisible` (1050), `fansLessonVisible` (1063),
  `fansLedgerTourVisible` (1068)
- `lowConditionMatchdayStarter` (1446)
- `conditionWarningSeen` / `guideQuickTrain` on `SquadTrainingScreen` (1676–1682)
- the `club-legacy` auto-request at `App.tsx:992` — reached through
  `requestedAssistantSequenceId`, not through the due-sequence list, so it needs
  its own gate
- desk tips, via `showManagerTips` at `App.tsx:1853`

Milestone flags are still **written** in Advisor mode wherever the underlying
event happens (`trainPlayer` banks `first-training-complete` regardless,
`src/application/store.ts:1275`). Only presentation is suppressed. This keeps a
mid-career switch to Teacher from re-teaching things the manager has done.

### What stays in both modes

The awakening cutscene, story events, player-request walk-ons, rookie and
academy arrivals, the coach overlay, board ultimatums, retirement and legacy
decisions, championship celebrations, and the endgame — including the true
ending, where Bert is the one talking to the manager. The `create-player` gate
(`src/application/store.ts:663`) stays: that is the onboarding spine, not
teaching.

The rule: **if it carries a decision or a story beat, he stays. If it explains
or enforces, he goes.**

The inbox itself keeps running. `scheduleAssistantInboxWeek` still delivers
product alerts and still writes their delivery and acknowledgement flags. It
also allocates deterministic logical slots to newly due hidden guides so weekly
story and tip cadence does not jump merely because Bert is hidden. Once a guide
has consumed that Advisor slot, a separate namespaced suppression flag keeps it
from occupying every later week. Its ordinary queued flag remains, so switching
back to Teacher still delivers the accepted backlog. The `HomeViewModel` removes
only guide rows and guide metadata; an alert is the club telling the manager
something happened, which is the half of the desk Advisor is meant to keep.

### The prompt

Pressing "Take the keys" on `NewGameWelcomeScreen` routes, for veterans only, to
a short screen before player creation: Bert stood there, one question, two
buttons. A first-timer goes straight to player creation exactly as today.

The chosen mode is passed to `startNewCareer(seed, mode)` and baked into the new
career.

### The Settings row

`managerTipsEnabled` is retired. Its row becomes a Bert row reading
`TEACHER` / `ADVISOR`, writing to the career through a new store action.

The row is **hidden when no career is loaded**, following the existing
`hallOfFame` prop convention in `SettingsOverlay.tsx:113` ("Omit to hide the
row: with no career loaded there is no record to open"). The new-game prompt
covers that moment instead.

Switching back to Teacher mid-career lets the skipped explainers arrive from
that point on, at the existing cap of three per week
(`MAX_ASSISTANT_INBOX_ITEMS_PER_WEEK`, `src/game/assistant-guide.ts:100`).

The backlog is bounded well below the 24 sequences in the catalog.
`dueAssistantInboxGuideSequences` reports what is *currently* relevant, and its
coach, scouting, transfer and board strands are `else if` chains contributing
one item each — so the function can emit **at most 14 at once, by
construction**, and that ceiling needs a club simultaneously carrying an injury,
a loan, a transfer request, a retirement, a legacy and a board ultimatum. Five
weeks is the worst case; the ordinary case is two or three. This is a bound read
off the code, not a measurement of play.

Accepted as designed: a manager who turns the teacher back on is asking for
help, and the queue drains at a rate the inbox was already built to handle. If
that proves wrong in play, the smallest fix is to complete every currently-due
sequence at the moment of the switch — Bert then explains only what happens
next, and never what the manager already did without him.

### The unlock

`AppPreferences.climbCompleted: boolean`, default `false`. It must live in
preferences because it is the one fact that has to **survive `startNewCareer()`
erasing the save** — the completion proof today is `TRUE_ENDING_SEEN_FLAG` and
`state.hallOfFame`, both inside `GameState`.

Set in two places:

1. When the endgame celebration completes (`store.completeEndgameCelebration`,
   `src/application/store.ts:1018`, reached from `App.tsx:1550`).
2. **Backfilled on career load** when the loaded save already carries
   `TRUE_ENDING_SEEN_FLAG`. Without this, anyone who finished the climb before
   this ships never sees the prompt.

**A known hole, accepted.** The backfill can only read a career that still
exists. A player who finished the climb and then started a fresh career *before
this ships* has already erased the only proof, and no durable device-level
signal survives it — the Hall of Fame record lives in the same save. Their
`climbCompleted` stays false and they are never asked.

The cost is bounded to the *asking*. Because the Settings row is available to
every player with a career loaded and is not gated on `climbCompleted`, such a
veteran can still put Bert in the corner from Settings in the first minute of
the new career. They lose the prompt, not the feature. Buying more than that
would mean writing a device-level trophy record we have no reason to keep
otherwise, which is a worse trade than one missed question.

## Data changes

### `GameState`

`assistantMode?: AssistantMode`, optional, absent = `'teacher'`. Codec entry
mirrors `difficulty`. No validation beyond the enum; no cross-field refinement.

### `AppPreferences`

- **Add** `climbCompleted: boolean`, default `false`.
- **Remove** `managerTipsEnabled`.

`PreferencesSchema` is a `z.strictObject`, so a stored row carrying the retired
key fails the new schema. The repository already has a version ladder for
exactly this (`PREFERENCES_SCHEMA_VERSION = 7` with six older branches,
`src/persistence/preferences-repository.ts:13–19`). Bump to `8` and add a branch
for version-7 rows parsed by

```ts
PreferencesSchema.omit({ climbCompleted: true })
  .extend({ managerTipsEnabled: z.boolean() })
```

which drops the retired key and fills `climbCompleted: false`. Every older
branch gains `climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted` and loses
its `managerTipsEnabled` line.

A damaged row is already handled: `loadPreferencesFailSoft`
(`src/application/preferences.ts:22`) resets to defaults with a warning rather
than blocking a career. The worst case for a preferences failure is a veteran
losing the unlock, not losing a save.

## Testing

Headless and deterministic, per `CLAUDE.md`.

**Mode behaviour** (`src/application/__tests__/assistant-guide.test.ts`): the
three presentation/block functions return empty for an Advisor career, due
guides remain mode-neutral, and the rendered Advisor desk contains no guide
rows or guide metadata.

**The blocks** (store tests): a fresh Advisor career at S1W1 advances the week
with nothing trained, nothing built, off the home tab, and with the youth intake
unanswered. Each case is paired with the Teacher career that still refuses it,
so the opening is pinned as unchanged. The Teacher cases must bank
`intro-complete` first — see Risks.

**Reaching the end**: an Advisor career runs for four seasons without a Bert
gate. A Teacher reference career from the same seed completes each delivered
tutorial tranche; after every entered management week a mode-neutral projection
including event state matches. Advisor changes presentation and gating only;
guide flags and the mode field are the only excluded state.

**Persistence**: `assistantMode` round-trips through the codec and defaults to
`'teacher'` when absent. `climbCompleted` round-trips, defaults `false`, and a
stored version-7 row containing `managerTipsEnabled` migrates to version 8 with
`climbCompleted: false` and the retired key gone.

**The unlock**: completing the endgame sets `climbCompleted`; loading a career
that already carries `TRUE_ENDING_SEEN_FLAG` backfills it.

**Wiring** (source-assertion style, following
`src/ui/__tests__/manager-tip-navigation.test.ts`): `App.tsx` gates each listed
one-shot on the mode, and the Settings row is omitted when no career is loaded.

## Risks

**A missed teaching surface.** The list above was assembled by grepping every
`hasAssistantGuideMilestone`, `hasAssistantGuideSequenceCompleted` and
`requestedAssistantSequenceId` reference, but a surface added after 2026-08-04
will default to firing in Advisor mode. Mitigation: the mode is read through one
exported predicate rather than compared inline, so the call sites are greppable.

**Preferences ladder regression.** Retiring a key from a `strictObject` touches
six existing migration branches, and only three of them (v5, v6, v7) ever
carried the key — v3 and v4 predate it, so stripping it there is a compile
error. Mitigation: the round-trip test above, plus the repository's existing
per-version tests, several of which assert `schema_version` 7 and must be
updated to 8.

**Vacuous block tests.** Two of the four blocks are guarded by `intro-complete`,
which a headless career never banks because nothing watches the walk-on that
banks it. A Teacher-mode test that omits `completeGuideMilestone('intro-complete')`
passes without the career ever having been blocked, and would green an
implementation that forgot the mode gate entirely. Every Teacher case banks it
explicitly.

**Mid-career Teacher backlog.** Accepted, above.
