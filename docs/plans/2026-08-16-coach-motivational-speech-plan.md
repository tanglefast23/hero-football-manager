# Plan — Head coach motivational speech (D3 unlock, half-time boost)

Date: 2026-08-16. Branch: `claude/coach-motivational-speech-0bbc30`. **Status: shipped.**

Built as written, after one round of council review. One addition made during the build that the plan did not name: the engine also refuses a speech stamped at or before `HALF_TICKS`, so a hand-edited replay cannot lift a squad for the whole match.

What was NOT verified: nothing renders these two surfaces in Jest — this project's UI tests read source text, because its Jest environment has no DOM or React Native. Reaching D3 week 2 in the web build to look at the button was not attempted. The button and the sheet are both existing components (`ActionButton` with its disabled state, `ConfirmationSheet`) given new props, so the risk is layout-level, not logic-level.

## What the owner asked for

1. New feature on **Club Office → Staff**. Introduced when the club reaches **D3**, explained by Bert in the **2nd week**.
2. Bert's line: you can spend training points on your head coach. Spend **all** your TP and the coach banks **one "motivational speech"** for half time.
3. A button under the **head coach** card: **"Train Coach · Speech"**.
   - Greyed out if TP was already spent that week. It must be the first spend of the week.
   - Costs **all** current TP. One tap = one banked speech.
4. If a speech is banked, a **half-time popup** asks whether to use it.
5. Yes → every player gets **double the Green Bull division gain**, for the **second half only**, then reverts.

Green Bull gains confirmed in [midseason-training.ts:26](src/game/midseason-training.ts:26): D5 +1, D4 +2, **D3 +3, D2 +4, D1 +5**. So the speech gives **D3 +6, D2 +8, D1 +10** to all seven stats. The owner's recollection was right.

**Naming, so nobody follows the wrong constant:** the +3/+4/+5 table is `GAIN_BY_DIVISION`, the gain of the **free Week 19 midseason** trip. The **paid** Green Bull trip is a flat `GREEN_BULL_TRAINING_GAIN = 2`. The owner named 3/4/5 and asked to double those, so the speech is 6/8/10 — a **new balance rule**, recorded in `docs/05-players-training-coaches.md`, not a restatement of an existing one.

## Assumptions I am proceeding on (flagged, not blocking)

- **A1 — No TP floor.** ~~Require one week's ambient TP.~~ Dropped on review: the owner asked only that it cost all TP, and a floor is invented policy. The rule is `trainingPoints > 0`.
- **A2 — Bank cap is 1.** "will have 1 motivational speech in the bank". Buying while holding one is blocked. The bank persists across weeks and seasons until used.
- **A3 — Watched matches only.** Quick Result has no half time and no popup, so a Quick Result leaves the speech **banked and unspent**. Nothing is lost, but a manager who always quick-results never uses the feature.
- **A4 — Head coach required.** No head coach, no button (the card the button hangs under does not exist). Bert's briefing waits for a head coach too, or he explains a control that is not on screen.
- **A7 — The bank belongs to the club, not the coach.** It is a top-level save field, so dismissing the head coach does not burn a paid-for speech. The fiction says "your coach banks one"; the bookkeeping says the club does. Sacking a coach to dodge that is not a trap worth building.
- **A5 — Boost is read at half time, from the club's division at that moment.** A speech banked in D3 and used after promotion pays the D2 rate.
- **A6 — Bert speaks at the desk**, exactly like the existing `green-bull-training` briefing does in D3 week 1, rather than being wired to the Staff board specifically. Same delivery, one week later.

## Architecture constraints this touches

- `src/sim/` and `src/game/` are pure, seeded, deterministic. A stat change decided mid-match **must** travel as a recorded `MatchInput`, or the replay diverges from the watched match.
- Adding an input kind is a sim change → **`ENGINE_VERSION` m2.3 → m2.4**, and both golden fingerprints must be rebaselined, because [runtime-golden.ts:51](src/sim/runtime-golden.ts:51) hashes `engineVersion` into the fingerprint. Play itself does not change: no new RNG draw, no altered tick.
- New copy ships in seven languages in the same commit. `content/assistant-guide.json` is held at **100% coverage in all six non-English locales** by gate 10.

---

## Step 1 — Sim: the `MOTIVATIONAL_SPEECH` input

Files: [src/sim/types.ts](src/sim/types.ts), [src/sim/match.ts](src/sim/match.ts).

- Add to `MatchInput`: `{ tick: number; kind: 'MOTIVATIONAL_SPEECH'; boost: number }`.
- `queueInput` validation: `requireControlledTeam(state)`; `boost` must be a safe integer in `1..20`; reject a second speech in the same match (scan `inputLog`). Replay data is a trust boundary, so this is validated, not assumed.
- `processCoachingInput`: for the controlled team, apply `boost` to all seven stored attributes of each of the 11 on-pitch defs **and** each bench def in `state.bench[team]`, clamped to `MAX_PLAYER_ATTRIBUTE` (999 — headroom is not a problem). Bench defs are included so a substitute who comes on afterwards is also lifted.
  - **Copy-on-write, never in-place.** `makePlayers` ([match.ts:128](src/sim/match.ts:128)) stores each `def` **by reference**, so `state.players[i].def` *is* `state.teams[team].players[i]`, and [envelopeFrom](src/sim/match.ts:517) serializes `state.teams` as the replay's starting squad. Mutating a def in place would bake the boost into the saved envelope's opening line-up, and the replay would then start pre-boosted **and** apply the input again — a silent divergence from the watched match. So: `player.def = { ...player.def, attrs: boosted }`. `state.bench` is already an independent deep copy ([match.ts:199](src/sim/match.ts:199)) and is safe either way; it gets the same treatment for symmetry. Nothing in the sim compares a `def` by identity, so replacing the object is safe.
  - The engine reads `player.def.attrs[stat]` live every tick ([engine.ts:227](src/sim/engine.ts:227)), so the lift takes effect on the next tick and lasts to the whistle. Career state is never touched: the match owns its copies.
- `validateEnvelope`: add a branch for the new kind before the `unknown input kind` throw, or a saved replay containing a speech fails to load. It also requires `opts.controlledTeam` (as every other coaching kind does) and rejects a second speech in one envelope, so a corrupt envelope is refused before anything runs rather than mid-replay.
- [replay-codec.ts](src/persistence/replay-codec.ts): its `inputSchema` is a **second, independent** zod whitelist of input kinds, run by `serializeReplayEnvelope` before every replay save. Without a `MOTIVATIONAL_SPEECH` variant (same `1..20` bound), every watched match that used a speech throws `InvalidReplayEnvelopeError` on save and shows the player a replay-save failure.
- **No new `MatchEvent` kind.** The banner is raised by the match screen, which already knows it queued the input. A new event kind would ripple into audio, commentary, the post-match ledger and every exhaustive switch for no player-visible gain.
- Bump `ENGINE_VERSION` to `m2.4`; rebaseline `EXPECTED_RUNTIME_GOLDEN` and `EXPECTED_GOAL_GOLDEN` with a comment recording *why* (version string only — RNG consumption, scores and event payloads unchanged). The **parity snapshot must NOT move**: it holds score, events and fingerprints and no engine version, so a change there would mean real behaviour drifted. Assert it is unchanged instead of regenerating it.

**Check:** `src/sim/__tests__/motivational-speech.test.ts` —
- a speech at half time raises the controlled team's second-half attrs by exactly `boost`, and leaves the opposing team untouched;
- the caller's `TeamDef` **and** `envelopeFrom(state).home/away` still hold the unboosted opening squad;
- an envelope round-trip (`envelopeFrom` → `runReplay`) reproduces the watched score and events exactly — the direct guard on the aliasing trap above;
- a second speech in one match throws.

## Step 2 — Game ring: buy, bank, spend

New file `src/game/coach-speech.ts` (pure), exported from [src/game/index.ts](src/game/index.ts).

- `COACH_SPEECH_UNLOCK_WEEK = 2`.
- `coachSpeechUnlocked(state)`: `highestDivisionReached(state) <= 3` — **ever** reached D3, so relegation does not repossess a feature the club earned — then `state.week >= COACH_SPEECH_UNLOCK_WEEK || coachSpeechIntroduced(state)`. The week gates only the **first** sight of the button, so Bert's briefing is never beaten to it by the control it explains. A plain `week >= 2` would hide the button in week 1 of *every* later season while the half-time popup still fired — the control and the popup would disagree for a week each season. `coachSpeechIntroduced` is `hasAssistantGuideSequenceCompleted(state, 'coach-speech') || !assistantTeaches(state)`; the second clause matters because an advisor-mode career never completes a briefing, and must not be locked out forever.
- `coachSpeechOffer(state)`: `{ trainingPointsCost, banked, blockedReason? }` where `blockedReason` is `'ALREADY_BANKED' | 'TRAINING_USED_THIS_WEEK' | 'NOT_ENOUGH_TP' | 'NO_HEAD_COACH'`. "Spent TP this week" is a **semantic predicate** over two flags: the existing `individualTrainingUsedFlag` ([training.ts:47](src/game/training.ts:47)) and a new `coachSpeechUsedFlag`. The speech does **not** set the drill flag — that flag's player-visible copy says *individual training* was used, and Green Bull would then tell the manager something false about why it is closed.
- `buyCoachSpeech(state)`: no-op when blocked; otherwise `trainingPoints: 0`, `coachSpeechBanked: true`, and append `coachSpeechUsedFlag(season, week)`. A boolean, not a counter: the bank holds at most one, and the type should say so.
- `coachSpeechBoost(state)`: `2 * midseasonTrainingGainForDivision(currentUserDivision(state.m2))`. Comments name that helper exactly: the *paid* Green Bull trip's own gain is the flat `GREEN_BULL_TRAINING_GAIN = 2`, so "the Green Bull gain" alone would send a future reader to the wrong constant.
- `spendCoachSpeech(state)`: clears the bank.

State: add `coachSpeechBanked?: boolean` to `GameState` ([types.ts](src/game/types.ts)) and `coachSpeechBanked: z.boolean().optional()` to the codec ([game-state-codec.ts:2030](src/persistence/game-state-codec.ts:2030), beside `trainingPoints`). Optional, so existing saves load unchanged.

**Check:** `src/game/__tests__/coach-speech.test.ts` — locked before D3 and before week 2; each blocked reason; a successful buy zeroes TP, banks one, and sets the week flag; boost is 6/8/10 by division.

## Step 3 — Store + view model

- [store.ts](src/application/store.ts): `buyCoachSpeech()` action, mirroring `dismissCoach` — `guarded`, `blockedInboxDutyForAction`, `requireCareer`, `set`, `queueCareerSave`.
- `finishWatchedMatch`: if `result.inputLog` contains a `MOTIVATIONAL_SPEECH`, run `spendCoachSpeech` on the career before it is stored. **Deriving the spend from the input log** rather than from a mid-match callback means the bank can never disagree with the replay, and no career save happens mid-match.
- [view-models.ts](src/application/view-models.ts): add `coachSpeech: { visible, banked, cost, blockedReason? }` to `ClubFinancesViewModel`, built from `coachSpeechOffer`. Blocked reasons resolve to catalog strings here, next to the existing `greenBullTraining.*` ones.

## Step 4 — Staff board button

[ClubFinancesScreen.tsx](src/ui/screens/ClubFinancesScreen.tsx): in `CoachCardSection`, when `coach.role === 'HEAD'` and the view model says visible, render an `ActionButton` under the dismiss button — label `clubFinances.trainCoachSpeech`, `disabled` + `visuallyDisabled` when blocked, with the reason shown beneath in the same muted style the Green Bull offer uses. `ActionButton` already supports both disabled flags.

App wiring: new `onTrainCoachSpeech` prop, handled in [App.tsx](App.tsx) with `requestConfirmation` (it spends every TP, so it gets the same commit sheet as other irreversible club decisions) → `store.buyCoachSpeech()`.

## Step 5 — Half-time popup

[MatchScreen.tsx](src/render/MatchScreen.tsx):

- New props: `motivationalSpeech?: { boost: number }` (present only when one is banked and the club is watching a real fixture).
- In the event loop where `HALF_TIME` is already handled ([MatchScreen.tsx:1982](src/render/MatchScreen.tsx:1982)): if the prop is set and the prompt has not been shown, set a `speechPrompt` state, add the `'halftime-speech'` pause reason to `AutomaticMatchPauseReason` ([match-pause.ts](src/render/match-pause.ts)), and set `pauseAfterPublish = true` — the shape the first-match tutorial already uses at [MatchScreen.tsx:2159](src/render/MatchScreen.tsx:2159), including the publish-then-freeze ordering comment.
- **Break the catch-up loop on the tick that emits `HALF_TIME`.** A slow frame simulates several ticks before events are handled, so without a break the second half is already minutes old when the popup appears and the boost lands late. The loop stops, the accumulator is cleared, that frame publishes, then the pause takes effect.
- Render the existing `ConfirmationSheet` ([ConfirmationSheet.tsx](src/ui/components/ConfirmationSheet.tsx)) — it already gives a titled yes/no with a focus trap, Escape handling and reduced motion. Confirm → `recordCoachingInput({ tick: match.tick + 1, kind: 'MOTIVATIONAL_SPEECH', boost })` and a banner via `appendNewestFour`; cancel → nothing. Either way the pause reason is cleared and play resumes.
  - The banner uses `appendNewestFour`, **not** `pushInputBanner`: the latter needs a `MatchBannerSubject`, and that union exists so a *repeatable* control's newer banner replaces its older one. A speech happens once, like a goal or half time, so it stacks and needs no subject.
- The speech is *not* offered when `presentationOnly`, in the power-showcase clip, or in the dev-harness QA entries.

## Step 6 — Bert's briefing

- [content/assistant-guide.json](content/assistant-guide.json): new sequence `coach-speech`, `focus: 'assistant'`, no `inbox`/`destination`. **Two pages of one body line each, not one page of two** — [content.test.ts:776](src/content/__tests__/content.test.ts:776) pins every sequence except `management-intro` and `green-bull-training` to one body line per page, each at most 200 characters.
- [content.test.ts:666](src/content/__tests__/content.test.ts:666) also pins the full ordered list of sequence ids; add `coach-speech` there in the same position it takes in the enum.
- [assistant-beats.tsx](src/ui/dev-harness/entries/assistant-beats.tsx): the dev harness keeps its own id list, label and group colour. A new sequence missing from it is invisible to QA.
- [schemas.ts](src/content/schemas.ts): add `'coach-speech'` to `AssistantGuideSequenceIdSchema` **and** to `SCREEN_DELIVERED_SEQUENCE_IDS` — an id in the enum but not in that list is treated as an inbox sequence and the zod refinement then demands inbox copy and a destination.
- [assistant-guide.ts](src/game/assistant-guide.ts): add `'coach-speech'` to `AssistantGuideSequenceId`.
- [application/assistant-guide.ts:61](src/application/assistant-guide.ts:61): a second screen-delivered branch beside the Green Bull one — `phase === 'manage' && coachSpeechUnlocked(state) && hasHeadCoach(state) && !hasAssistantGuideSequenceCompleted(state, 'coach-speech')`. The head-coach clause stops Bert explaining a button that is not on screen; the shared unlock predicate means a manager who reaches the office late still gets the lesson the first time the button could be pressed.
- [bert-beat-moments.ts](src/ui/bert-beat-moments.ts): authored faces `['explaining', 'encouraging']`, matching the Green Bull pair.

## Step 7 — Copy in seven languages, same commit

- `content/assistant-guide.json` English + the two flattened `bert.guide.coach-speech.page1.body{1,2}` keys translated into es, pt-BR, fr, de, id, vi. Gate 10 holds this file at 100% per locale; an untranslated line turns CI red naming the file.
- `content/i18n/en.json` plus all six catalogs: button label, four blocked reasons, the purchase confirmation sheet (title/detail/confirm/cancel), the half-time sheet (kicker/title/detail/confirm/cancel), and the match banner. Gate 1 fails on any English key a locale is missing.
- Vietnamese: the button label, the banner, and **both sheet titles as well as the kicker** render in the pixel face and are uppercased, so they must stay inside the shipped Handjet glyph set (gate 5 reads the face's cmap). Compose every new vi display string from characters already present in `content/i18n/vi.json`.
- No id is translated. Blocked reasons stay enum values; only their labels are looked up.

## Step 8 — Verification

Headless first, per the project's QA rules:

```bash
npx tsc --noEmit && npx jest src/sim src/game src/persistence src/application src/i18n src/content src/render src/ui
```

Every one of those directories owns a test the change can break: `src/persistence` pins both codecs' field lists, `src/game/__tests__/architecture.test.ts` enforces ring purity on the new pure module, `src/render` exercises the match-pause machinery this reuses, and `src/ui` covers the Staff board.

Then the golden/parity suites for the version bump, and the i18n gates. No browser or simulator is needed: nothing here is a rendering or audio claim beyond a reused modal. If a visual check is wanted afterwards, it is the Browser pane with the mute guard as the very next call, and teardown in the same turn.

## Step 9 — The files that are easy to forget

- [README.md:19](README.md:19) states the current engine version, and [acceptance-audit-regressions.test.ts:279](src/ui/__tests__/acceptance-audit-regressions.test.ts:279) asserts the README matches `ENGINE_VERSION`. It must say **m2.4**.
- [docs/05-players-training-coaches.md](docs/05-players-training-coaches.md): record the speech as a new balance rule, with its 6/8/10 table and where the numbers come from.
- [docs/03-match-engine.md](docs/03-match-engine.md) or the match doc that lists live coaching inputs: the speech is a fifth recorded input.
- [src/ui/models.ts:920](src/ui/models.ts:920) owns the `ClubFinancesViewModel` **type**; `view-models.ts` only builds it.
- Stored **m2.3 replays become unsupported** by the version bump — `parseStoredReplayEnvelope` already raises `UnsupportedReplayEngineError` and the app degrades gracefully. Career saves are untouched; only saved replays are affected.

## Council review (round 1, one round by owner instruction)

Codex (gpt-5.6-sol, max) and Fable 5 (xhigh) both returned REVISE. Both independently found the envelope-aliasing trap and the missing `replay-codec.ts` whitelist; both found the seasonal re-lock. Findings adopted above, with two declined:

- **Declined — "double Green Bull means +4".** Codex is right that the *paid* trip is a flat +2, but the owner named 3/4/5 (the midseason table) and asked to double those. The owner's numbers win; the plan now says plainly that 6/8/10 is a new rule.
- **Declined — narrow the engine's boost bound to the exact production values.** A `1..20` integer bound is a corruption guard. Pinning it to {2,4,6,8,10} would turn any future balance tweak into a replay-compatibility break.
- **Deferred — a paired deterministic balance probe across D3–D1.** Worth doing, but it measures a rule the owner has already set, so it does not gate the build.

## Deliberately not doing

- No half-time offer in Quick Result (A3) — that is a separate design decision about whether Quick Result should ask before it runs.
- No stacking, no multiple speeches, no assistant-coach variant.
- No new match event kind, no new commentary line, no new SFX cue (the management SFX test indexes cues by position; adding one breaks eight tests for a sound nobody asked for).
