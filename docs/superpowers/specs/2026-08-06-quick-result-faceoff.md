# Quick Result Face-Off — Design Spec

**Status:** v2 (Grok audit round 1 applied)
**Date:** 2026-08-06
**Owner decisions captured:** best player = highest-rated **outfield** player; a draw makes the ball **bounce back and forth** between the two; a tap **skips**; **Quick Result only** (never before a watched match).

---

## 1. What this is

Quick Result currently resolves a match with no picture at all: the manager taps it and the Financial Report appears. The match — the thing the whole week is about — happens in a single frame of nothing.

This spec adds a **two-second face-off**: the club's best outfield player and the opponent's best outfield player, stood on the pitch either side of the ball, with a large **VS** between them. The horn cue plays. Then whoever actually won the match kicks the ball past the other one, and the game moves on to whatever screen it was going to show anyway.

It is presentation only. It reads a result that has already been simulated and changes nothing about it.

## 2. Non-goals

- **Not a match.** It shows no score, no minute, no events. The Financial Report and the post-match ledger still own the result.
- **Not on the watched path.** A watched match already opens with the kickoff whistle and, in the cup, the Hero Cup title card. A third opener there would be noise.
- **No new art and no kit chrome.** It uses the existing player sprite atlas (bodies come from `lookId` via `playerLookId`) and the existing ball, at the drill scene's scale. `TeamDef` carries no kit colours — match kits are synthesised per side in `src/render/team-kit-ui.ts` — and this scene does not use them. Identity is carried by the sprite, the player's name and the club's name, which is enough for two seconds.
- **No RNG.** Nothing here consumes the sim's PRNG or any other random source. Same seed and same inputs still produce a byte-identical career.

## 3. Trigger and placement in the flow

Today:

```
FixtureMatchDayScreen ──[Quick Result]──▶ store.quickResult()
                                            simulates, settles, saves
                                            screen := 'awakening' | 'postmatch'
```

After:

```
FixtureMatchDayScreen ──[Quick Result]──▶ store.quickResult()
                                            simulates, settles, saves  (UNCHANGED)
                                            faceOff := <view model>
                                            pendingPostFaceOffScreen := 'awakening' | 'postmatch'
                                            screen := 'faceoff'
                                                │
                                    2s, or a tap
                                                ▼
                                          store.completeFaceOff()
                                            screen := pendingPostFaceOffScreen
                                            faceOff := null
```

The whole simulation, the settlement, the awakening resolution and both save queues run exactly as they do now, in the same call, in the same order. The only change is which screen is shown first. This matters: **the scene needs the result to know who kicks the ball**, so it cannot run before the simulation, and running the simulation twice is not an option.

`completeFaceOff()` **must not save or mutate the career.** It moves a screen and clears two app-state fields; that is all. Everything durable was already queued inside `quickResult`.

A **dedicated screen** is used rather than an overlay laid over the destination, so the awakening cutscene's timers and audio cannot start underneath a scene the manager is still watching, and the Financial Report's slot animation cannot run out of sight.

### 3.1 Why not the alternatives

| Approach | Rejected because |
|---|---|
| Overlay while `screen` is already `'awakening'`/`'postmatch'` | The destination screen's timers, animations and audio start underneath the overlay. The awakening in particular owns a music bed and beat timers. |
| Local state inside the match-day screen | By the time Quick Result returns, the career has left `phase: 'matchday'` and that screen is gone. |
| Re-deriving the winner from goals | Breaks on a cup tie level after 90 minutes; see §5. |

### 3.2 Failure behaviour

If the view model cannot be built for any reason (a club with no outfield players, a missing sprite atlas), `quickResult` sets `screen` directly to `'awakening' | 'postmatch'` as it does today and skips the scene. Likewise, if `screen === 'faceoff'` is ever reached with `faceOff === null`, App renders the destination screen instead. A decorative overlay must never be able to block a settled result from reaching the manager.

### 3.3 Reload semantics

`faceOff` and `pendingPostFaceOffScreen` are **app state, never persisted** — the same argument as `inboxDutyReminder`. They are cleared on load, on new career and on developer-save restore.

A relaunch during the scene therefore resumes through the existing `resumeScreen`, which returns `'awakening'` when an awakening is pending, `'matchday'` when a second fixture is still open, and `'management'` otherwise. **It never returns `'postmatch'`** — `postMatch` is app state and is already lost on any kill mid-ledger today. The face-off neither improves nor worsens that, and this spec does not promise to restore it. The horn never replays.

## 4. Choosing the two players

**Rule:** the player in the fixture's starting eleven with the highest `roleOverall`, excluding goalkeepers.

- **The metric is `roleOverall(role, attrs)` from `src/game/archetype-caps.ts`** — the same function the squad register's overall column uses. Do not re-derive a total from the attributes; a second definition of "best" would disagree with the one the manager reads everywhere else.
- The pool is the **starting eleven** in the `TeamDef` the matchday built (`currentMatchday(state).teams`), not the whole squad — the face-off is between players who actually played. `buildTeamDef` produces exactly eleven with slot 0 always the keeper, so "exclude GK, take the best of the rest" is always well defined in production.
- Goalkeepers are excluded. A keeper dribbling a ball past a striker reads wrong, and the keeper is not what the club is proud of.
- **Ties break on player id, ascending**, so the same fixture always picks the same two faces.
- Defensive fallbacks, for a malformed eleven that production cannot currently produce: if every player is a keeper, take the best of any role; if the eleven is empty, return null and the scene does not run (§3.2).

Each side contributes: player id, display name, role and `lookId` — everything `playerLookId` needs — plus the club's name.

## 5. The outcome

**Source of truth: `postMatch.result.outcomeLabel`**, the `'WIN' | 'DRAW' | 'LOSS'` the post-match view model has already computed inside `quickResult`.

This is deliberate. `FixtureResult` carries goals only, and a cup tie level after 90 minutes is still a win or a loss — it is settled on the recorded penalty winner, which `postMatchViewModel` already resolves. Re-deriving the winner from `homeGoals`/`awayGoals` in this scene would call every penalty shoot-out a draw. Reusing the label means there is one definition of who won and no cup edge case to get wrong.

| `outcomeLabel` | What the scene does |
|---|---|
| `WIN` | Our player strikes; the ball travels **left → right past the opponent** and off the far edge. |
| `LOSS` | Their player strikes; the ball travels **right → left past our player** and off the near edge. |
| `DRAW` | Neither wins the duel: the ball is **struck back and forth between the two**, ending in the middle. |

The club is always drawn on the **left**, whatever the venue. The manager's team occupying a fixed side is worth more than modelling home and away here.

## 6. Composition

```
┌──────────────────────────────────────────────┐
│                (pitch green, centre circle)  │
│                                              │
│   ┌────────┐          ███  ███        ┌────┐ │
│   │ player │          ███████         │pl. │ │
│   │ sprite │           █████          │spr.│ │
│   └────────┘            ███           └────┘ │
│   OUR NAME              VS            THEIRS │
│   BRAMBLE ROVERS      ●              MOONLIGHT│
└──────────────────────────────────────────────┘
```

- **Background:** the pitch, in the match renderer's turf colours, with a centre circle — the drill stage's treatment, full screen.
- **Sprites:** both players drawn from the existing atlas at the drill scene's player magnification (~4x, snapped through `snapSpriteScale` so a source texel is a whole number of device pixels — `docs/11-art-style.md` requires this). The art has only front-facing `run0/run1` frames, so **both players face the camera**, stood opposite each other. Do not promise side profiles the atlas cannot draw.
- **VS:** the game's pixel font, the largest type on the screen, centred, with a hard drop shadow. It slams in at a slight rotation and settles — the one moment of drama the scene has.
- **Names:** each player's name under their sprite in the pixel font, with the club name beneath it, one step down and dimmed. Nothing else — no ratings, no positions.
- **Ball:** the atlas ball sprite, on the ground between them, at the drill scene's ball scale.
- The atlas is built through the same `buildSpriteAtlas` / `buildFallbackAtlas` path the drill scene uses, so an atlas failure degrades to the fallback rather than throwing.

## 7. Timing (2.0s)

| ms | Beat |
|---|---|
| 0–320 | Pitch is there from frame one. Both players slide in from their own edges; VS punches in from 1.6× to 1.0 with a small overshoot. |
| 320–1150 | Hold. Players play their two-frame idle at the drill scene's 130ms cadence. |
| 1150–1700 | The strike. The ball leaves the winner's feet and crosses; on a draw it is struck twice, out and back, finishing in the middle. |
| 1700–2000 | Fade to the next screen. |

The SFX (`quick-result-faceoff.m4a`, 2.3s with a fade tail) starts on mount and is stopped on unmount, so a skip cuts it.

**Reduce Motion:** no slide-in, no idle cycle, no ball travel. Both players, the VS and the ball are drawn in their final positions and held for **1.2s**. The scene still says who the two players are and still ends on its own. `reduceMotion` reaches the component from `preferences.reduceMotion` in `App.tsx`, the same path the drill scene and the awakening use.

## 8. Skip

The whole screen is one Pressable. A tap ends the scene immediately: it stops the cue and calls `completeFaceOff()`. The label "TAP TO SKIP" sits in a corner, matching the drill scene's wording.

Completion is **idempotent at both ends**: a `finished` ref in the component (the `DrillSceneOverlay` `completedRef` pattern) and a no-op in the store when `screen !== 'faceoff'` or `faceOff === null`. A tap landing in the same frame as the timer cannot advance two screens.

## 9. Accessibility and chrome

- The Pressable's accessibility label reads the whole scene as one sentence: `"<our player>, <our club>, against <their player>, <their club>. Tap to skip."`
- The scene is never the only way to learn anything: the result, the scorers and the money all arrive on the screens after it.
- **StatusBar:** `'light'`, joining `'watched'` and `'awakening'` in App's light-chrome list — the scene is a full-screen dark pitch.
- **Menu bed:** `menuThemeForScreen('faceoff', …)` returns `'opening'`, the same bed `'matchday'` and `'postmatch'` return. Leaving it unlisted would return null and stop the bed for two seconds between two screens that both play it — an audible gap in the middle of the flow. The horn plays over the bed, as every other one-shot does.
- Opening Settings is not offered on this screen. It lasts two seconds and every control it would reach is on the screen after it.

## 10. Where the code lives

| Ring | File | Contains |
|---|---|---|
| pure | `src/application/quick-result-faceoff.ts` (new) | `bestOutfieldPlayer(team)`, `faceOffStrike(outcomeLabel)`, `quickResultFaceOffViewModel(...)`. No React, no Skia, no timers. Lives beside the other view-model builders. |
| view model | `src/ui/models.ts` | `QuickResultFaceOffViewModel` |
| app | `src/application/store.ts` | `M1Screen` gains `'faceoff'`; state gains `faceOff` and `pendingPostFaceOffScreen`; API gains `completeFaceOff()`. Both fields cleared in the initial state, on `startNewCareer`, on `continueCareer` and on `restoreDeveloperSave`. |
| app | `App.tsx` | A `store.screen === 'faceoff' && store.faceOff !== null` branch mounting the overlay; the StatusBar light-chrome list. |
| render | `src/render/QuickResultFaceOff.tsx` (new) | The overlay: Skia canvas, Animated timings, SFX, skip. |
| render | `src/render/menu-audio.ts` | `'faceoff'` joins the `'opening'` bed. |
| audio | `src/render/management-sfx.ts` | `'quick-result-faceoff'` cue **appended last** (the catalog's index contract), plus `playQuickResultFaceOffSfx()` / `stopQuickResultFaceOffSfx()`. |

`src/sim/` and `src/game/` are not touched at all. `ENGINE_VERSION` does **not** move: no sim behaviour, tuning or RNG consumption changes.

## 11. Tests

**Pure module (headless):**

1. Picks the highest `roleOverall` outfield player and never a goalkeeper, even when the keeper is the highest-rated player in the eleven.
2. Ties break on player id, and the pick is stable across repeated calls.
3. Falls back to the best player of any role when an eleven is all keepers; returns null for an empty eleven.
4. `WIN` → club strikes, `LOSS` → opponent strikes, `DRAW` → the bounce.
5. The club is on the left whether the fixture is home or away.
6. The accessibility sentence names both players and both clubs.

**Store:**

7. `quickResult` leaves `career`, `postMatch` and both save queues exactly as they are today, and sets `screen: 'faceoff'` with the awakening/postmatch choice held in `pendingPostFaceOffScreen`.
8. `completeFaceOff()` moves to the held screen and clears both fields; calling it twice is harmless; calling it while `screen !== 'faceoff'` is a no-op that mutates nothing.
9. **A cup tie level on goals but decided on penalties never produces the draw animation** — the store's `postMatch.result.outcomeLabel` is `WIN`/`LOSS` and the scene follows it.
10. **A league draw does produce the bounce.**
11. **Double-header week:** league Quick Result → face-off completes → post-match → `continueAfterMatch` → the cup matchday is still reachable, and a second Quick Result while `screen !== 'matchday'` still returns early.
12. A career loaded from disk, a new career and a developer-save restore never come back with `faceOff` set.
13. The onboarding first match still routes settlement → awakening (when one fires) → post-match, with the face-off only ahead of that chain.

**Audio catalog:**

14. `management-sfx.test.ts`'s player count moves **30 → 31** and the rapid-voice pool indices shift by one again. The named-key `Map` lookups are unaffected at runtime; only the test's positional pins move.

## 12. Open risks

- **Two seconds on every Quick Result.** Quick Result exists to save time, and this spends some of it. Mitigated by the tap-to-skip and by keeping the scene genuinely short; if it grates in play, the honest fix is to cut the hold, not to add a setting.
- **The sprite atlas has no kicking pose.** The strike is conveyed by the ball's motion and a small lunge on the striker's sprite, not by a kick frame. If that reads as weak, a derived kick pose in `slide-tackle.ts`'s style is the follow-up, not a blocker.
- **Android hardware back during the scene.** The scene ends itself in two seconds and the app has no global back handler for these screens, so back is a no-op rather than a dead end. Left as-is.
