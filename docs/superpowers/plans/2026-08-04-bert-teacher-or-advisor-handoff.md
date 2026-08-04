# Handoff: Bert as Teacher or Advisor — audit, then implement

**Date:** 2026-08-04
**For:** the next agent picking this up
**State:** design complete, one external audit absorbed, **zero code written**

---

## What this is

Bert is the game's tutorial assistant. Today he teaches everyone forever: 24
inbox explainers, an objective line with arrows, a dozen one-shot lessons, and
four separate ways to refuse an Advance Week during the opening weeks.

The owner wants a manager who has won both trophies to be **asked**, on the next
new game, whether Bert should teach at all. Two modes:

- **Teacher** — today's game, unchanged in every observable way.
- **Advisor** — no lessons, no arrows, no held weeks. He still walks on for
  every real decision and every story beat, including the ending.

Design is settled and owner-approved. Do not re-open it. Your job is to check
the work, then build it.

## Where things stand

| | |
|---|---|
| Worktree | `.claude/worktrees/bert-tutorial-toggle-a2c04c` |
| Branch | `claude/bert-tutorial-toggle-a2c04c` |
| Position | 3 ahead of `origin/main`, **2 behind** — rebase or merge before you finish |
| Commits so far | `5521c70` spec · `53702cf` plan · `24a3fef` audit corrections |
| Code changed | **none** — all three commits are documentation |

Read in this order:

1. `CLAUDE.md` — the ring architecture rules. They are the reason this feature
   is small; violating them is the main way to make it large.
2. `docs/superpowers/specs/2026-08-04-bert-teacher-or-advisor-design.md`
3. `docs/superpowers/plans/2026-08-04-bert-teacher-or-advisor.md` — nine TDD
   tasks with the actual code in every step.

---

## Your job, in two phases

**Phase 1 — audit.** Verify the plan against the code. Report to Joe. Stop.

**Phase 2 — implement.** Only after Joe signs off on the audit. Work the plan
task by task.

Do not merge the phases. The plan has already been wrong twice in ways that
would have wasted an implementation run, and both times the fix was cheaper
before any code existed.

---

## Phase 1: the audit

### This is the second audit, not the first

An external review already ran against `53702cf` and its findings are folded
into `24a3fef`. **Do not re-litigate these** — they are settled:

| Already found and fixed | |
|---|---|
| Task 1 tested a non-existent file/API | now `assistant-mode-codec.test.ts`, `serializeGameState`/`parseStoredGameState` |
| Task 9 compared week 2 against week 3 | now one shared advance |
| A fourth Advance Week gate in `App.tsx:1624` | documented, pinned by test, needs no code change |
| `guidedFirstWeek` was untested | Advisor case added that trains first |
| Preferences strip applied to v3/v4 rows that never had the key | limited to v5–v7 |
| Erase confirmation fired before a screen with a Back button | reordered |

| Already raised and deliberately kept | why |
|---|---|
| Mid-career switch to Teacher releases a backlog | The owner picked this option **with the cost stated in the option text**, over a no-backlog variant offered beside it. It is bounded at 14 items by construction, ~5 weeks worst case. Not a bug. Do not "fix" it. |
| A veteran who wiped a finished save before ship never gets the prompt | Real, documented, accepted. The Settings row is ungated, so they lose the question and not the feature. |

### What to check

Verify against the actual code. Cite `file:line` for anything you contradict.

1. **Is the surface list complete?** Grep every reference to
   `hasAssistantGuideMilestone`, `hasAssistantGuideSequenceCompleted`,
   `requestedAssistantSequenceId`, `conciergeFocus`, `AssistantObjective`,
   `guideOverlayVisible`. Report any teaching surface the plan does not gate.
   This is the highest-value check — a missed surface means Bert nags a manager
   who turned him off.
2. **Is there a fifth block?** The docs claim four ways to refuse an Advance
   Week. Find a fifth anywhere in the app — including keyboard bindings
   (`use-key-bindings.ts`, `management-key-bindings.ts`) and disabled-button
   props.
3. **Can any feature become unreachable?** Is anything reachable ONLY through a
   Bert guide sequence, with no tab, button, or inbox row of its own? The first
   audit cleared Requests, youth, scouting, transfers, leaders, cup and board
   protection. Re-check anything it did not name.
4. **Will every test in the plan actually fail before the fix?** Audit each for
   vacuity — the plan's own `intro-complete` trap is the template. A test that
   passes against a missing implementation is worse than no test.
5. **Does the preferences ladder hold?** Walk all seven version branches in
   `src/persistence/preferences-repository.ts` and confirm each produces an
   object that `PreferencesSchema.parse` accepts in `save()`. A missed strip or
   fill is a boot crash on a real user's settings row.
6. **Do the code snippets compile in context?** The plan quotes real edits.
   Check imports exist, names match, and the `App.tsx` declaration order works
   (`careerTeaches` is used at line 992 and must be declared above it;
   `beginNewCareer` is read by `startNewCareer`).
7. **Citations.** Spot-check ten `file:line` references, weighted toward ones
   the argument depends on.

### Output

One entry per finding, most severe first:

```
[SEVERITY: blocker | major | minor | nit]
CLAIM: what the doc says, quoted, with its location
REALITY: what the code does, with file:line
IMPACT: what breaks, concretely
FIX: the smallest change that resolves it
```

Then stop and give Joe the list. If a section is sound, one line and move on —
do not pad, and do not invent findings to look thorough. Say explicitly when you
could not verify something without running code.

---

## Phase 2: implementation

Only after sign-off.

### The loop, per task

The plan is nine tasks, each already broken into 2–5 minute steps with real
code. For each:

1. Write the failing test **exactly as written in the plan**.
2. Run it. Confirm it fails, and fails for the stated reason. A test that passes
   here means the plan is wrong — stop and say so.
3. Make the minimal change.
4. Run it. Confirm it passes.
5. Run the neighbouring suites the task names.
6. `npx tsc --noEmit`.
7. Commit with the plan's message. **Local only.**

Do not batch tasks. Do not skip the "verify it fails" step — it is the only
thing standing between you and a suite of tests that assert nothing.

### Commands

```bash
npx jest                                    # everything
npx jest path/to/file.test.ts               # one suite
npx jest path/to/file.test.ts -t "name"     # one case
npx tsc --noEmit                            # typecheck
```

There is no lint script. `npm test` is `jest`.

### Definition of done

- All nine tasks complete, each committed.
- `npx jest` green.
- `npx tsc --noEmit` clean.
- `src/sim/__tests__/__snapshots__/parity-replay.test.ts.snap` **unchanged**.
- Branch rebased or merged onto `origin/main` (2 commits behind at handoff).
- Nothing pushed, nothing merged to main — see the standing rule below.

---

## Traps that will bite you

These cost previous sessions real time. Read them before you start, not after.

**1 · Five other worktrees share this repo.** `git worktree list` shows six. A
test failure you did not cause may be pre-existing from another session's work
in the shared tree. **Re-run any "pre-existing" failure against your own base
commit before fixing it**, and never `git add -A` from the repo root — stage the
exact paths the task names.

**2 · Jest has no DOM and no React Native.** `testEnvironment: 'node'`, no
jsdom, and `require('react-native')` throws. This is why the plan puts copy in
plain `.ts` modules and pins UI wiring by reading source text with
`readFileSync`. Do not try to render a component in a test; do not add jsdom.

**3 · The `intro-complete` vacuity trap.** Two of the four Advance Week blocks
are guarded by a milestone that a headless career never banks, because nothing
watches the walk-on that banks it. A Teacher-mode test that omits
`completeGuideMilestone('intro-complete')` passes **without the career ever
having been blocked**, and would green an implementation that forgot the mode
gate entirely. Every Teacher case in the plan banks it explicitly. Keep it.

**4 · Function-form `style` on a `Pressable` breaks iOS only.** Zero height, no
taps, renders fine on web and in the browser preview. Two confirmed hits in this
codebase already. Task 7 creates a new screen — use string `className` only, and
if you must use `style`, pass an object, never `({ pressed }) => ...`.

**5 · NativeWind's rem is 14pt on native, not 16.** Every `text-`, `w-`, `gap-`
class renders at 87.5% of its browser value, and text scales up to 1.6× with the
reader's iOS text size. Do not tune the new screen's spacing against a web
preview and call it done.

**6 · Do not touch `src/sim/`.** `ENGINE_VERSION = 'm2.0'` at
`src/sim/match.ts:27`. This feature changes no simulation, so the golden replay
snapshot must not move. **If `parity-replay.test.ts.snap` changes, stop** — you
have altered the engine, and updating that snapshot without a version decision
is explicitly forbidden by `CLAUDE.md`.

**7 · The preferences repository is a seven-version ladder.**
`PreferencesSchema` is a `z.strictObject`, so a stored row carrying a retired
key fails to parse. Only v5, v6 and v7 rows ever carried `managerTipsEnabled`;
v3 and v4 predate it, and destructuring it off those types is a compile error.
Several existing tests in that file assert `schema_version` 7 and must be moved
to 8 — update them, do not delete them.

**8 · The prompt is a `landingView`, not an `M1Screen`.** It renders before a
career exists, so it cannot be a store screen. `App.tsx:183` is the union to
extend.

**9 · Copy rules.** Any user-facing text must never show the player a penalty or
a negative modifier — name what they receive, not what they lose. Bert's pose
must match his line, chosen from the approved set in `src/ui/bert-poses.ts`
(the plan picks `sizing-you-up`, which is right for a veteran being asked this).

**10 · If you open a web preview, mute it immediately** and close the tab and
kill any server when you finish. The web build autoplays looping music and
browser tabs outlive your turn — a forgotten preview plays game audio through
the Mac speakers indefinitely.

---

## Standing rules from the owner

- **Do not commit or push unless Joe explicitly asks.** The plan's per-task
  commits are local checkpoints and are pre-authorised as part of executing the
  plan. Pushing, opening a PR, or merging to main is **not** — ask first.
- Give the answer first, then the reasoning. State uncertainty plainly.
- Push back when an approach is risky or likely to create maintenance problems.
  Do not agree with a bad instruction to be agreeable.
- Verify with the strongest practical check before claiming work is complete. If
  tests fail, say so and show the output.
- Make the smallest change that solves the real problem. No unrelated
  refactoring, no speculative features.

## What not to do

- Do not re-open the settled design decisions listed above.
- Do not change season-1 feature pacing. Scouting stays week 15 in both modes;
  that is an explicit non-goal.
- Do not build New Game+ carryover. It is on the roadmap, not in this plan.
- Do not add a second save slot.
- Do not "improve" the plan's tests into something that passes more easily.
