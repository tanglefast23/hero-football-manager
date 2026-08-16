# The motivational speech cutscene — implementation plan

**Date:** 2026-08-16
**Branch:** `claude/motivational-speech-cutscene-306228`
**Builds on:** #170 (`e7851793`), which shipped the buy button, the bank, the
half-time sheet and the `MOTIVATIONAL_SPEECH` sim input.
**Revision:** round 2, after council review (Codex gpt-5.6-sol max + Fable 5 xhigh).

## What ships

Three things, in one commit.

1. **The bank stacks.** `coachSpeechBanked: boolean` becomes a count. One
   purchase per week still (the existing weekly training-point flag already
   enforces that), but they pile up instead of being refused at one.
2. **A running tally on the Staff board.** The head coach's card says how many
   speeches the club is holding.
3. **A four-second cutscene** when a speech is given at half time: thunder and
   a screen flash, the coach large in the middle talking, `+X` cards popping
   all over the screen, gospel under the whole thing, match music paused.

## Owner decisions taken 2026-08-16

- Bank stacks with **no cap**; still at most one purchase per week.
- The existing Yes/No sheet **stays**. Yes plays the cutscene; No keeps the
  speech banked.
- **No new pixel art.** The coach is his existing 24×29 `ManagementSprite`
  scaled up.
- The cutscene is a **hard 4s cap**. Taps only swap the bubble line; a fourth
  tap ends it early.

Two assumptions carried into this plan: the `+X` number is the existing
division boost (D3 +6, D2 +8, D1 +10 — it moves with division, not season),
and the 20 lines are authored as whole English sentences and translated whole,
cliché included.

## What is NOT in scope

- No sim change. `MOTIVATIONAL_SPEECH` already exists and already carries
  `boost`. **`ENGINE_VERSION` does not move** and neither golden fingerprint
  changes. If either moves, something in this plan was implemented in the wrong
  ring.
- Quick Result still has no half time and still leaves a banked speech unspent.
- No coach art, no new sprite sheet, no `sprites.json` regeneration (see
  `sprites-json-generator-drift`).

## Open item for the owner — audio provenance

Codex raised it and it is not a code question. The three supplied clips
(`thunder.wav`, `follower.webm`, `gospel-choir-heavenly-transition-3-186880.webm`)
ship inside a paid app. The gospel filename carries a stock-library ID. **Record
the licence and source for all three before release.** This does not block
implementation; it blocks shipping. Flagged to the owner, not resolved here.

---

## 1. The bank becomes a count

### 1.1 State and the pure ring

`src/game/types.ts:957`

```ts
- coachSpeechBanked?: boolean;
+ /** How many half-time speeches the club is holding. Absent means none. */
+ coachSpeechesBanked?: number;
```

`src/game/coach-speech.ts`

- `CoachSpeechBlockedReason`: **drop `'ALREADY_BANKED'`**. Nothing blocks on
  stock any more; `TRAINING_USED_THIS_WEEK` is what holds it to one a week.
- `CoachSpeechOffer.banked: boolean` → `bankedCount: number`.
- `buyCoachSpeech`: `coachSpeechesBanked: (state.coachSpeechesBanked ?? 0) + 1`,
  **but refuse the sale at the ceiling** — see §1.4. Never clamp: clamping takes
  the training points and hands back nothing.
- `spendCoachSpeech`: `Math.max(0, (state.coachSpeechesBanked ?? 0) - 1)`, and
  return `state` unchanged when the count is already 0. Its doc comment at
  `coach-speech.ts:141` still says spending "empties the bank" — reword, it
  decrements by one now.

**Trap to check while editing, not after:** `coachSpeechOffer` currently orders
its blocked reasons `ALREADY_BANKED → NO_HEAD_COACH → TRAINING_USED_THIS_WEEK →
NOT_ENOUGH_TP`. Removing the first entry must not change the relative order of
the other three, or a club with no coach and no points reports the wrong reason.

### 1.2 Persistence — the upgrade is explicit, not implied

Round 1 said "the schema is `.passthrough()` so nothing breaks". Codex is right
that this is not enough: **`.passthrough()` preserves the legacy key, it does
not populate the new one.** Left as-is, every save written by #170 silently
loses its banked speech.

`src/persistence/game-state-codec.ts` — accept both keys, then normalise:

```ts
coachSpeechesBanked: nonnegativeInteger.optional(),
// Legacy. #170 stored a single boolean; `true` was exactly one speech.
// Read on decode, never written again.
coachSpeechBanked: z.boolean().optional(),
```

Normalisation rules, all four tested:

| Decoded | Result |
|---|---|
| `coachSpeechesBanked` present | it wins, legacy ignored |
| legacy `true`, no count | `1` |
| legacy `false`, no count | `0` (field omitted) |
| neither | `0` (field omitted) |

The legacy key is **dropped before the state is handed on and before the next
save**, so a save round-trips to the new shape once and never carries both.

**The seam already exists and is named.** `parseStoredGameState`
(`game-state-codec.ts:3061`) runs a chain of content-churn normalisers before
the migration ladder — `removeRetiredHeroSystems`, `removeRetiredWeeklyTraining`,
`migrateRetiredPowers`. Add `normalizeCoachSpeechBank(value)` to that chain,
before `migrateStoredGameState`, matching the existing comment's rule that
normalisers clean up retired fields so every migration rung sees normalised
input.

**Do not silently drop a malformed legacy value.** The normaliser runs before
zod (`parseStoredGameState` normalises, then validates), so deleting a
`coachSpeechBanked` that is neither boolean nor absent would hide corruption the
schema exists to catch. Rule: upgrade only a real `true`/`false`; leave anything
else in place for `z.boolean()` to reject. One malformed-save test.

### 1.4 The ceiling refuses the sale — it does not clamp it

`nonnegativeInteger` is built on `Number.isSafeInteger`
(`game-state-codec.ts:23-29`), so it already rejects `Infinity` and `NaN`. Do
not swap it for a looser number schema.

At `Number.MAX_SAFE_INTEGER` the increment has nowhere to go.
**`Math.min(MAX_SAFE_INTEGER, count + 1)` is the wrong answer** — Codex caught
that it takes every training point the club holds and adds no speech, which is
a silent robbery rather than a guard. Round 2 wrote that clamp; this replaces it.

Instead: a new blocked reason, checked with the others in `coachSpeechOffer`, so
`buyCoachSpeech` returns `state` untouched before any payment. A test asserts
training points, count and event flags are all unchanged at the ceiling.

Only a hand-edited save reaches this. The point is that the failure mode is
"nothing happened", not "you paid for nothing".

`nonnegativeInteger` is built on `Number.isSafeInteger` (`game-state-codec.ts:23-29`),
so it already rejects `Infinity` and `NaN`. The count is uncapped by owner
decision and that guard is the only thing standing between it and a corrupt
save — do not swap it for a looser number schema.

### 1.3 Callers

- `src/application/store.ts` and `src/application/__tests__/coach-speech-store.test.ts`
  — the test asserts `coachSpeechBanked` toggling a boolean; it becomes a count
  assertion.
- `App.tsx:2836` — `store.career?.coachSpeechBanked === true` becomes a check on
  the count **and** a head coach read once as a local. Do not call
  `hasHeadCoach` here; it does not narrow the type. The exact form is in §5.1.
- `src/game/__tests__/coach-speech.test.ts` — three assertions move to counts,
  plus **stacking tests**: buying in two different weeks banks two; spending one
  of two leaves one; declining leaves two.

---

## 2. The tally on the Staff board

`CoachSpeechViewModel` (`src/ui/models.ts`) gains `bankedCount: number`.
`coachSpeechViewModel` (`src/application/view-models.ts:1458`) fills it from
`offer.bankedCount`.

`ClubFinancesScreen.tsx` — the head coach card already renders one line under
the button: the price, or the blocked reason. Add the tally as its own line
**above** that one, so the count is visible whether or not the button is live:

```
Speeches banked: 3
Costs 24 TP · +6 to every attribute
```

New chrome key `coachSpeech.bankedTally` in `content/i18n/en.json` and all six
other catalogs. It renders when `bankedCount > 0`; at zero the line is absent
rather than saying "Speeches banked: 0", which reads as a fault.

**The tally must not need a plural rule in seven languages.** Use a
count-neutral form — `BANKED · {count}` — rather than "Speeches banked: {count}".
Six locales with six different plural systems is a lot of grammar to buy for one
number, and the neutral form sidesteps all of it.

### 2.1 Copy that still says the bank holds one

Three surfaces were written when one was the maximum. All change in this commit.

| Where | Says now | Why it changes |
|---|---|---|
| `content/i18n/en.json:2848` + 6 catalogs | `matchScreen.speechDetail`: "Your head coach has **one speech saved**…" | Simply false with a stack of three. Reword neutral in all seven. |
| `src/application/store.ts:1974` | comment: "The bank is **emptied**…" | It is decremented by one now. |
| `src/sim/match.ts:295` | comment: "One speech per match: **the club banks at most one**, and a second would stack a lift the career ring never sold." | The RULE stays — still one speech per match, the guard is untouched. Its stated REASON stops being true. Reword the justification only. |

**`src/sim/match.ts` gets a comment edit and nothing else.** No behaviour, no
tuning, no RNG movement, so `ENGINE_VERSION` does not move. If the diff to that
file contains anything other than comment text, stop.

**Delete `coachSpeech.blocked.ALREADY_BANKED` from all seven catalogs**
(`en.json:2838` and `:4039` in each of the six). Gate 1 is a subset check — it
never flags a key English no longer has, so this orphan would sit there forever.

---

## 3. The twenty lines

New content file, modelled on **`content/fulltime-blame-lines.json`** — the flat
`{ schemaVersion, lines }` shape, whose `FulltimeBlameLinesSchema`
(`schemas.ts:1431`) is the right template. (Round 1 named
`fulltime-coach-lines.json`; that file is pooled by category and is the wrong
model.)

`content/coach-speech-lines.json`

```json
{ "schemaVersion": 1, "lines": ["…", "…"] }
```

### 3.1 Line length — reuse the 64-character cap

Both reviewers caught that seven round-1 lines were 65–71 characters against a
`ceremonyLineSchema` capped at 64 (`schemas.ts:1359`).

**Reviewers disagreed on the fix and this plan overrules Codex.** Codex proposed
a dedicated 80-character schema. This plan shortens the lines instead and reuses
`ceremonyLineSchema` unchanged. Reason: every other bubble-line file in the repo
is bounded at 64 for a documented reason — "one speech bubble, one phone"
(`schemas.ts:1447`). This copy is literally one speech bubble, on a phone,
inside a four-second cutscene. An 80-character cap would make this the only
line file that can overflow its own bubble.

`CoachSpeechLinesSchema`: `strictObject({ schemaVersion, lines:
z.array(ceremonyLineSchema).length(20) })` plus `addDuplicateIssues`, exactly as
`FulltimeBlameLinesSchema` does.

The English set — all 20 measured at ≤ 64 characters, no duplicates:

1. Second half is ours. Dig deep. Nothing left at the whistle.
2. You have earned this. Fortitude. That is the word. Fortitude.
3. Heads up, chests out. Leave it all out there. Every one of you.
4. One more push. Show me character. That is all I am asking.
5. They are tired. We are not. Grind them down. Grind them down.
6. This is the moment. Believe. Look at each other and believe.
7. No passengers. Work rate wins this. Work rate and nothing else.
8. Forty-five minutes. Give me everything. Then give me a bit more.
9. Pride. That is what this is about now. Play for the badge.
10. Take the game to them. Be brave on the ball. Not reckless.
11. Win your battles. Every duel, every yard. That is the game.
12. We stay together. Togetherness. Nobody drops their head.
13. Hunger. I want to see hunger. Want it more than they do.
14. Control what you can control. The rest sorts itself out.
15. Nobody gave us this. Earn it. Earn every minute of it.
16. Trust the process. It is working. Keep doing what we practised.
17. Leave nothing behind. No regrets in that dressing room after.
18. Composure. Heads clear, feet fast. Composure wins this one.
19. They will break. Keep knocking. Persistence. Keep knocking.
20. Look around you. That is your team. Play for each other.

### 3.2 The five tables a new content file has to be added to

Miss one and CI names the file. All five, in one commit:

| File | Edit |
|---|---|
| `src/content/schemas.ts` | `CoachSpeechLinesSchema` + the bundle entry |
| `src/content/load.ts` | import the JSON, add `coachSpeechLines` |
| `src/content/__tests__/content.test.ts` | the file's own validation case |
| `src/i18n/content-strings.ts` | `put(\`coach.speech.${proseSlug(line)}\`, line)` |
| `src/i18n/__tests__/gates.test.ts` | `SOURCE_BY_PREFIX['coach.speech.']`, `COVERAGE_FLOOR['coach-speech-lines.json']` at 100 ×6, **and** `FLOOR_HIGH_WATER` at the same |

`SOURCE_BY_PREFIX` already holds `'coach.fulltime.'` and `'coach.blame.'`;
longest-prefix-wins means `'coach.speech.'` does not collide. `COVERAGE_FLOOR`'s
keys are asserted **equal** to the set of `SOURCE_BY_PREFIX` values, so the two
edits are not independent — one without the other fails.

Add the pool to `src/i18n/__tests__/content-strings.test.ts` beside the existing
line pools, so the flattening itself is asserted.

### 3.3 The keys must be READ, not just written

Both reviewers flagged this and CLAUDE.md calls it the most common defect in
this codebase's history. Writing the keys is half the job.

**The cutscene never renders an authored English string.** It resolves each line
through the catalog:

```ts
const localizedLines = useMemo(
  () => loadLaunchContent().coachSpeechLines.lines.map(
    (line) => t(`coach.speech.${proseSlug(line)}`)
  ),
  [t],
);
```

`t` comes from `useCopy()`, which already merges `contentStrings()` and falls
back to English for an untranslated key. The component picks its random line
from `localizedLines`, never from the raw JSON. A test asserts the resolved pool
has 20 entries and that a non-English locale returns at least one string that
differs from its English source.

### 3.4 Voice and the glyph gate

`coach.` is already in `BODY_PREFIXES` (`src/i18n/voice.ts:32`), so
`coach.speech.*` is **body** voice: platform sans, not glyph-gated. Vietnamese
is free of the 102-glyph constraint here. The chrome key `coachSpeech.bankedTally`
is display voice and **is** gated — compose its Vietnamese from glyphs the
shipped face carries, and check the UPPERCASED form too.

### 3.5 Translations

All 20 lines into es, pt-BR, fr, de, id, vi, in the same commit. This is the
half of the task that has been dropped twice; it is not a follow-up.

---

## 4. Audio

Three source files the owner supplied. All three are longer than the cutscene,
so all three are trimmed on import. **Already encoded into the worktree** at the
durations below.

| Source | Length | Ships as | Treatment |
|---|---|---|---|
| `~/Downloads/thunder.wav` | 8.5s stereo PCM | `assets/audio/sfx/speech-thunder.m4a` | first 2.8s (the strike is at t=0), 0.5s fade, 96k mono AAC |
| `…/sounds/follower.webm` | 5.9s Opus | `assets/audio/sfx/coach-voice.m4a` | whole clip, 96k mono AAC — the coach's talking voice |
| `…/sounds/gospel-choir-…-186880.webm` | 10.6s Opus | `assets/audio/music/speech-gospel.m4a` | first 4.2s, 0.8s fade-out tail, 112k stereo |

Then, in this order: `node scripts/audio/normalize-levels.mjs --dry-run` to read
the plan, then the write pass, then `npm run audio:levels:check`.
**Never audition these by ear** — assert on player state and the levels check
(`qa-preview-audio-hygiene`).

`scripts/audio/levels.json` is rewritten by the normalise pass. It is an
expected generated byproduct of this change and is committed with it.

Note on sequencing: the levels script discovers assets by **source-code
reference** (`normalize-levels.mjs:238-249`). The three files are invisible to it
until `coach-speech-audio.ts` requires them, so write the module first, then
normalise.

New module `src/render/coach-speech-audio.ts`, modelled on
`awakening-audio.ts` + `bert-voice.ts`, registered with `registerAudioOwner`:

- `initCoachSpeechAudio()` / `teardownCoachSpeechAudio()` / `setCoachSpeechMasterVolume()`
- `playSpeechThunder()`
- `startSpeechGospel()` / `stopSpeechGospel()` — music bed, half volume like
  every other bed in this codebase
- `playCoachVoice(durationMs)` — **exactly one seek per line.** This is the
  constraint `bert-voice.ts:17-25` calls out: iOS cancels a pending
  `AudioPlayer` seek when the next arrives, so a voice re-seeked on a timer
  plays only its first sound. A tap starts a new line and therefore one new
  seek; the mouth-flap animation must not re-seek.
- `stopCoachSpeechAudio()` — silences the voice and the gospel and drops every
  pending timer and seek token. Called from `finish()` only.
- `teardownCoachSpeechAudio()` — also releases the native players. Called from
  the cutscene's unmount cleanup only. See the table in §5.4: these two are not
  interchangeable, and unmount needs the releasing one.

**Wire the volume.** `setCoachSpeechMasterVolume(devVolume)` goes beside the
existing setters at `App.tsx:1321`. Without it the cutscene ignores the
manager's volume setting entirely — the one thing every other audio owner in
this codebase does and a new one is easy to forget.

Fail-soft throughout: headless Jest has no `expo-audio` and no DOM
(`jest-env-has-no-dom-or-rn`), so every call is wrapped and warns once.

### 4.1 The match theme

`startTheme()` / `stopTheme()` in `src/render/audio.ts` are the existing pause
and resume.

**Checked, not assumed:** `MatchScreen.tsx:1189` calls `startTheme()`
unconditionally on mount and `stopTheme()` on unmount. There is no
music-off branch to respect — muting runs through the global `setMasterVolume`
(`App.tsx:1321`), so a muted manager already has the theme "playing" at volume
0. A symmetric `stopTheme()` / `startTheme()` around the cutscene therefore
cannot turn music back on for someone who turned it off.

**Only `finish()` restores the theme.** Unmount must not — MatchScreen's own
cleanup already runs `stopTheme()` and `teardownAudio()` (`MatchScreen.tsx:1190`),
and a stray `startTheme()` after it would set `themeWanted` true against a
torn-down player. This is the rule in §5.4's table; it is repeated here because
"restore what you stopped, in the cleanup that stopped it" is the normal React
habit and it is wrong in this one place.

---

## 5. The cutscene

New component `src/render/MotivationalSpeechCutscene.tsx`. Render ring, because
it owns audio; `src/ui` may not.

**It wraps `CharacterSpeechOverlay`. It does not reimplement it.**

Rounds 1 and 2 of this plan refused that reuse, on the grounds that the
overlay's walk-on geometry was the wrong shape for a centre-screen slam. **That
was wrong, and Codex raised it three times before it was checked.** The walk-on
is opt-out. The overlay already ships every option this cutscene needs:

| Prop | What it gives us |
|---|---|
| `instant` | places character and bubble at once, no walk-on, no exit walk |
| `characterCentreRatio={0.5}` | centre of the screen instead of a fifth in |
| `hideCharacter` | the overlay draws no sprite; the wrapper draws its own big coach |
| `typewriter` | the reveal, `RevealingLine` boundary included |
| `focusOnMount`, `handleAccessibilityEscape` | focus and Escape, already correct |
| `reduceMotion` | the whole-line-at-once path |
| `onLineChange`, `onDone` | the hooks the wrapper needs |

`RivalHeroIntroScreen.tsx:403` already uses exactly this combination —
`instant`, `hideCharacter`, `characterCentreRatio={0.5}`, `focusOnMount`,
`handleAccessibilityEscape` — with its hero drawn externally. This cutscene is
the same shape with a coach instead of a hero.

**Taps come free, via the line list.** The wrapper passes a pool of **four**
lines, sampled without replacement from the 20 and pre-shuffled. The overlay's
own tap-to-advance then produces the specified behaviour exactly:

| Spec | What the overlay does |
|---|---|
| first bubble is random | `shuffled[0]` |
| each tap shows a different random line | advance to `shuffled[1..3]` |
| never repeats the line showing | sampling without replacement |
| the 4th tap ends the cutscene early | advancing past the last line fires `onDone` |

So the wrapper writes no tap handler, no reveal system, no focus trap and no
Escape route. It owns only what is genuinely new: the flash, the `+X` cards, the
audio, the big coach sprite, and the 4000ms cap.

**Do not pass `autoAdvanceMs`.** The bubble must hold until tapped; the hard cap
is the wrapper's own 4000ms timer calling `finish()`. `autoAdvanceMs` would
instead march the lines along on a timer, which is a different feature.

This deletes what would have been sections 5.4–5.6 of a hand-rolled version.
Everything below is what remains genuinely new.

### 5.1 Props, and the club with no head coach

```ts
{
  boost: number;              // the +X on every card
  coachName: string;
  coachPortraitId: string;
  reduceMotion: boolean;
  onDone: () => void;
}
```

Both reviewers found the hole: `hasHeadCoach` gates only **buying**. A club can
bank a speech, dismiss the coach (`App.tsx:3525`, clearing `headCoach` at
`market-career.ts:1681`), and still reach half time — today's prompt fires on the
bank alone (`App.tsx:2835`).

**Rule: the stock survives, the offer waits.** A club with no head coach keeps
its speeches and is not asked. Hiring a coach makes them available again.

**Do not gate on `hasHeadCoach(state)`.** It returns a plain `boolean`
(`coach-speech.ts:70`), so it does not narrow `market.headCoach` to defined, and
the two required props would still need a non-null assertion to compile. Read
the coach once and build the prop from that local:

```ts
const headCoach = store.career?.market?.headCoach;
const speech =
  headCoach !== undefined && (store.career?.coachSpeechesBanked ?? 0) > 0
    ? {
        boost: coachSpeechBoost(store.career),
        coachName: headCoach.name,
        coachPortraitId: headCoach.portraitId ?? headCoach.id,
      }
    : undefined;
```

The `portraitId ?? id` fallback matches `view-models.ts:1489`. TypeScript
narrows `headCoach` for free, so nothing is asserted. Add a test for
bank-with-no-coach: no prompt, bank unchanged.

### 5.2 The coach talks with no new art — and does not change face

`management-sprites.json` ships six expressions for each of 32 coaches: `rest`,
`joy`, `cry`, `point`, `field`, `field-cheer`. All 32 have both `point` and
`joy` (verified). Alternate **`point` ↔ `joy`** on a ~130ms interval and he
reads as talking.

**The legend trap, found by Codex and confirmed.** Retired players who become
coaches carry `portraitId: \`legend-${legend.playerId}\`` (`market.ts:1587`),
which is **not** in the sprite sheet. `fallbackSpriteKey`
(`ManagementSprite.tsx:74-85`) hashes the **whole** key including the expression,
so `coach:legend-42:point` and `coach:legend-42:joy` resolve to two *different*
stand-in coaches. The flap would morph a legend between two strangers eight
times a second.

Fix: resolve the portrait identity **once**, before animating, from a single
fixed key (`coach:<id>:rest`), then reuse that resolved id for both expressions
so only the expression alternates.

`ManagementSprite.tsx` keeps both `sheet` and `fallbackSpriteKey` module-private
(`ManagementSprite.tsx:10`, `:74`), so the cutscene cannot reach either.

**Export one shared resolver from `ManagementSprite.tsx` and call it from both
places** — `resolveCoachPortraitId(portraitId): string`. `fallbackSpriteKey`
then uses it too, so there is exactly one hash in the codebase. Do NOT copy the
hash into the cutscene; a second copy that drifts is a bug nothing catches, and
its symptom is a coach who changes face only for legends.

`src/ui/components/ManagementSprite.tsx` therefore joins the touched-file list.

A test covers a `legend-*` portraitId and asserts both expression keys resolve
to the same coach.

`ManagementSprite` at `width={24*8}` gives 192×232pt of whole-multiple pixel art
— it floors the scale itself, so passing a multiple of 24 avoids a sub-pixel
downscale.

### 5.3 Timeline — hard 4000ms

| t (ms) | What |
|---|---|
| 0 | `stopTheme()`; `startSpeechGospel()`; `playSpeechThunder()`; white full-screen flash at opacity 1 |
| 0–450 | flash fades to 0; coach scales 0.6 → 1.0 and settles |
| 150 | first bubble (random line) types in; `playCoachVoice(…)`; mouth flap starts |
| 400–3600 | `+X` cards pop at random positions, staggered ~180ms — about 16. Each: scale 0.5 → 1.15 → 1.0 over 160ms, hold 500ms, fade 200ms |
| 3600–4000 | overlay fades out |
| 4000 | `stopSpeechGospel()`; `startTheme()`; `onDone()` |

The gospel runs the **whole** cutscene and stops at 4000ms, not 3600 — round 1
put the two in one ambiguous row and Codex was right to read it as a bug.

`Math.random` is legal here — render ring, not `src/sim` or `src/game`, and
nothing about card positions or line choice is recorded. The recorded input was
written by the sheet before the cutscene opened.

**Card positions are generated once** into a `useRef`/`useMemo`, never during
render. A re-render must not teleport a card that is mid-animation.

Animations use `Animated` with `useNativeDriver` where the property allows.
**Do not put `className` on an `Animated` wrapper** — NativeWind ignores it
(`nativewind-animated-classname-ignored`). Note `native-driver-is-js-on-web`:
on web this runs on the JS thread, which is why the card count stays at ~16.

### 5.4 The voice, and the one thing unmount must NOT do

The overlay owns the taps; the wrapper only reacts to them. `onLineChange`
fires with the index of the line now showing, **including the first** — that is
the single hook for `playCoachVoice(bertVoiceDurationMs(line))`, one seek per
line, exactly as `BertBriefingWalkOn.tsx:145` already does it. The mouth flap
runs on its own interval and never re-seeks.

**Finishing and unmounting are different events.** Round 2 collapsed them into
one `finish()` and Codex was right that this is a bug: `finish()` restarts the
match theme and calls `onDone()`, and doing either while MatchScreen is tearing
down fights `MatchScreen.tsx:1190`, which is already running `stopTheme()` and
`teardownAudio()` in its own cleanup.

| Event | Callers | What it does |
|---|---|---|
| `finish()` | 4000ms timer, the overlay's `onDone` (fourth tap), `onRequestClose` | idempotent via `finishedRef`; `stopCoachSpeechAudio()`, `startTheme()`, `onDone()` once |
| unmount cleanup | React only | cancel timers and animations, `teardownCoachSpeechAudio()`. **Never `onDone()`, never `startTheme()`.** |

`teardownCoachSpeechAudio()` releases the native players; `stopCoachSpeechAudio()`
only silences them. The cleanup is the named caller for teardown — round 2
declared the function and never called it.

A test asserts unmount mid-cutscene calls neither `onDone` nor `startTheme`.

### 5.5 The modal boundary, reduced motion, and accessibility

**Wrap the whole cutscene in `CrossPlatformModal`.** It supplies Android
hardware Back and web Escape through `onRequestClose`
(`CrossPlatformModal.web.tsx:54`, `:80`); pass `onRequestClose={finish}`.

`onAccessibilityEscape` belongs on the inner accessible control, not on the
modal — which is what `CharacterSpeechOverlay`'s own `handleAccessibilityEscape`
prop already wires up. Set that flag and let the overlay do it.

`useReducedMotion()` already exists. When set: no flash (a single 250ms dim
instead of a white strobe — a full-screen white flash is a photosensitivity
risk, not a taste question), no scale pops on the cards, and no mouth flap. The
bubble's whole-line-at-once path comes from passing `reduceMotion` straight
through to the overlay. Same 4000ms, same audio, same taps.

The `+X` cards are decorative: `accessibilityElementsHidden` /
`importantForAccessibility="no-hide-descendants"`, so a screen reader gets the
coach's line rather than sixteen numbers.

### 5.6 Wiring into the match

`MatchScreen.tsx`, in `answerSpeechPrompt(true)`.

**Order: sheet closes, then cutscene opens.** Use the existing
`onAfterConfirmDismiss` hook on `ConfirmationRequest`
(`ConfirmationSheet.tsx:32`) — "runs after a confirmed sheet has fully left the
accessibility tree". The half-time sheet is already a `ConfirmationSheet`
(`MatchScreen.tsx:3896`), so the hook is available where it is needed.
Opening the cutscene in the confirm handler would start the
flash and the thunder behind a native modal that is still dismissing. The match
stays paused across the whole handover.

The cutscene opens **only if `recorded` is true** — the existing guard exists so
a refused input cannot announce a second half that did not change, and a
cutscene is a louder version of that same lie.

**The pause reason gets exactly one release path.** Extract
`releaseSpeechPause()`: deletes `'halftime-speech'` and calls
`syncPauseReasons()`, idempotent. Call it from three places:

| Path | When |
|---|---|
| Cancel | immediately, as today |
| Confirm, `recorded === false` | immediately — **no cutscene opens, so no `onDone` ever fires** |
| Confirm, `recorded === true` | from the cutscene's `onDone` |

Round 1 moved the release into `onDone` "for the confirm path" and left the
refused-input case with no release at all. Both reviewers caught it; that match
would have stayed paused forever.

Keep the banner. It is what the manager sees when the cutscene has faded.

---

## 6. Dev harness

Add a `motivational-speech` entry under `src/ui/dev-harness/entries/` **and
register it in `src/ui/dev-harness/registry.ts`** — an entry file alone does
nothing. The entry needs a replay control and a reduced-motion toggle, because
it is the only way to exercise the timing without reaching half time of a D3
match.

Two harness traps recorded in memory apply: `dev-harness-reels-by-category`
(the harness shows one category) and `dev-harness-vfx-freeze-is-deliberate`.

---

## 7. Verification

Headless first — that answers nearly all of it.

```bash
npx tsc --noEmit
npx jest src/game/__tests__/coach-speech.test.ts \
         src/application/__tests__/coach-speech-store.test.ts \
         src/persistence src/i18n src/content src/render src/ui
```

Then, before commit — the full run is in the block, not just in the prose:

```bash
npm run format:check
npm run audio:levels:check
npx jest src/sim/__tests__/motivational-speech.test.ts src/sim/__tests__/runtime-golden.test.ts
npx jest src
npm run web:first-load:check
```

**On the full `npx jest src` — this plan overrules Codex.** Codex asked to drop
it because CLAUDE.md warns off suites like `m2-managed-recovery-soak` and the
balance rails. That warning is scoped to "UI, copy, art or audio-only work".
This change edits `GameState` and the persistence codec, which is exactly the
class of change those suites exist to catch. The full run happens **once**,
before commit, and the focused list above is what the edit loop uses.

Tests this change owes, beyond the ones already named:

- the 4000ms stop, and the fourth tap finishing early
- `finish()` called twice fires `onDone` once
- **unmount mid-cutscene calls neither `onDone` nor `startTheme`**
- refused input releases the pause
- a `legend-*` portraitId resolves both expressions to the same coach
- one voice seek per line
- teardown on unmount releases the players
- bank-with-no-head-coach shows no prompt
- stacking: two banked, one spent, one left
- the four save-normalisation rules, plus a round trip
- **the pause is released on the real MatchScreen half-time path.** The isolated
  cutscene harness cannot prove this — it does not own the pause set. Assert it
  where `releaseSpeechPause` actually runs, in a MatchScreen test or a
  MatchScreen harness case, for all three callers.

Expected to need attention:

- **`web:first-load:check` will likely fail.** 20 lines × 7 locales plus a new
  component is JS the first load pays for. #170 already had to re-ratchet.
  Measure `origin/main` the same way before moving the number, so the diff says
  how much is inherited and how much is this branch — that is the shape the last
  re-ratchet took and it is the honest one.
- **Golden fingerprints must NOT move.** `runtime-golden` and the parity
  snapshot both stay put. A moved fingerprint means sim state changed and the
  bug is in this branch, not in the snapshot.

What cannot be verified headlessly: how the cutscene looks and sounds. Jest here
has no DOM and no React Native, so its UI tests read source text. Per
`browser-pane-is-zero-width-and-mutes` the pane cannot prove audio at all. The
honest report is the dev-harness entry driven silently in the browser pane —
confirming three line swaps, the fourth-tap dismissal and the timed dismissal —
plus the levels check for the audio, and an explicit statement that nobody has
listened to it. Do not claim otherwise.

**The harness cannot prove the pause release.** It renders the cutscene alone
and does not own MatchScreen's pause set, so a green harness run says nothing
about it. That claim belongs to the MatchScreen test named above, and nowhere
else.

## 8. Docs

The bank wording changes from one speech to a count. Update
`docs/05-players-training-coaches.md:68` and `docs/03-match-engine.md:7`, and the
stale single-speech comment in `MatchScreen.tsx`.

## 9. Files touched

| File | Change |
|---|---|
| `src/game/types.ts` | `coachSpeechBanked` → `coachSpeechesBanked` |
| `src/game/coach-speech.ts` | count, drop `ALREADY_BANKED` |
| `src/game/__tests__/coach-speech.test.ts` | counts + stacking |
| `src/persistence/game-state-codec.ts` | count field + `normalizeCoachSpeechBank` in the `parseStoredGameState` chain |
| `src/ui/components/ManagementSprite.tsx` | export `resolveCoachPortraitId`, use it in `fallbackSpriteKey` |
| `src/sim/match.ts` | **comment only** — the one-per-match reason. No behaviour, no `ENGINE_VERSION` bump |
| `src/application/view-models.ts` | `bankedCount` |
| `src/application/store.ts`, its test | count + the "bank is emptied" comment |
| `src/ui/models.ts` | `bankedCount` on the view model |
| `src/ui/screens/ClubFinancesScreen.tsx` | tally line |
| `App.tsx` | count > 0 + `headCoach` local; coach name + portrait; volume setter |
| `src/render/MatchScreen.tsx` | `onAfterConfirmDismiss`, `releaseSpeechPause`, stale comment |
| `src/render/MotivationalSpeechCutscene.tsx` | **new** |
| `src/render/coach-speech-audio.ts` | **new** |
| `assets/audio/sfx/speech-thunder.m4a`, `coach-voice.m4a` | **new** |
| `assets/audio/music/speech-gospel.m4a` | **new** |
| `scripts/audio/levels.json` | regenerated byproduct |
| `content/coach-speech-lines.json` | **new**, 20 lines |
| `content/i18n/*.json` ×7 | 20 lines ×6, `coachSpeech.bankedTally`, neutral `matchScreen.speechDetail`, drop `ALREADY_BANKED` |
| `src/content/schemas.ts`, `load.ts`, `__tests__/content.test.ts` | new file wired |
| `src/i18n/content-strings.ts`, `__tests__/gates.test.ts`, `__tests__/content-strings.test.ts` | prefix + both floor tables + pool |
| `src/ui/dev-harness/entries/…`, `registry.ts` | **new** entry, registered |
| `docs/05-players-training-coaches.md`, `docs/03-match-engine.md` | count wording |
| `scripts/web/verify-first-load-budget.mjs` | re-ratchet if it fails |
