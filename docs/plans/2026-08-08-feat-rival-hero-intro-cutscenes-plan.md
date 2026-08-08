---
title: 'feat: Add first-meeting rival hero intro cutscenes'
type: feat
date: 2026-08-08
status: implemented
---

# Add first-meeting rival hero intro cutscenes

## Overview

Add a short, once-per-career reveal before Match Day whenever the live opponent currently
owns one of the five division-headline rival heroes. The production scene keeps the hero
centred near the bottom on their supplied pixel-art backdrop beneath a persistent localized
`DIVISION RIVAL` banner and large player name, reveals their real Super Power in the existing
animated title-card language while they demonstrate it, removes the card after three seconds,
then shows the selected funny taunt for a second skippable three-second beat. Five bookmarkable
Dev Harness cases make the whole sequence replayable without advancing a career.

The full behavior is defined in
`docs/superpowers/plans/2026-08-08-rival-hero-intro-cutscenes-spec.md` revision 7. This plan
does not expand the feature to other special heroes or the match simulation.

## Resolved owner decisions

- [x] Record the five owner-selected taunts in the specification.
- [x] Preserve the powerless first onboarding match and treat Barry's Super Speed reveal as
      a teaser.
- [x] Bundle the five owner-supplied 2048×2048 pixel-art backdrops.
- [x] Add a localized `DIVISION RIVAL` banner above the hero through both beats.
- [x] Use the supplied 155 BPM hip-hop track as a dedicated `37.16s` rival-scene loop.
- [x] Report Barry on the first tutorial team sheet while preserving its powerless match.
- [x] Put the player's name between `DIVISION RIVAL` and the power card, with no duplicate
      name inside the card.
- [x] Demonstrate each rival's real power before speech, with whole-screen tap-to-skip and a
      three-second automatic advance for both beats.
- [x] Use Bert's dialogue chatter for every taunt, then play the fixed character laugh one
      second after that chatter ends.

## Current behavior and seams

- `src/game/special-heroes.ts` is the canonical source for stable hero ID, name, look, role,
  placement order, and power. The five requested heroes are exactly the order-1 placed
  special in D5 through D1.
- `src/game/career.ts::activeCareerMatchday` already selects the exact fixture Play or
  Quick Result will run next and is league-first on double-header weeks.
- `GameState.eventFlags` is an open, persisted string list, so hero-specific completion
  flags need no save migration or schema-version bump.
- `App.tsx` currently builds the lineup screen whenever `store.screen === 'matchday'`, then
  can mount the Cup mismatch Bert warning over it. The rival scene must become the first
  derived Match Day presentation and suppress the other blocking presentations until done.
- `src/application/store.ts::quickResult` only checks the persisted screen, and
  `watchMatch` has no equivalent screen check. Both need a pending-intro guard; Match Day
  navigation through `setActiveTab` needs the same protection.
- `PlayerRunSprite`, `PowerTitleTakeover`, `powerCutInPresentation`,
  `CharacterSpeechOverlay`, and `speech-bubble.tsx` already supply the production sprite,
  power identity, and speech language. Reuse them rather than drawing harness-only copies.
- The first D5 fixture is deliberately against Barry Allan's host, while the onboarding
  match teams are currently stripped of powers. That is why the Barry decision above is a
  product gate, not an implementation detail.

## Invariants and non-goals

- Trigger from the featured hero's **live membership on the current opponent**, never from
  division or hard-coded club ID.
- Persist one flag per stable hero ID only after the taunt is finished. Duplicate completion
  is harmless; interruption writes nothing.
- Keep `store.screen === 'matchday'`; do not add a persisted screen enum or save migration.
- Preserve league-first double-header routing, Cup settlement, onboarding, and every
  existing Match Day entry route; restore the underlying menu bed after the rival override.
- Do not touch `src/sim`, RNG consumption, balance tuning, replay bytes, or `ENGINE_VERSION`
  under the recommended Barry policy.
- Keep Atlas batching for matches; the single out-of-match character continues to use the
  purpose-built `PlayerRunSprite`.
- No new dependency, haptic, currency, or additional background artwork beyond the five
  owner-supplied assets. The only new audio is the approved rival music cue and five fixed
  owner-supplied laugh derivatives.
- Do not commit, push, deploy, or publish as part of this plan unless Joe separately asks.

## Implementation phases

### Phase 1 — Lock typed copy and pure career rules

- [x] Copy the five approved backgrounds into `assets/images/rival-hero-intros/` with stable
      hero-keyed filenames; keep the original 2048×2048 PNG pixels unchanged.
- [x] Create `content/rival-hero-intros.json` with `schemaVersion: 1` and exactly the five
      owner-selected `{ heroId, taunt }` records.
- [x] Add `RivalHeroIntroCatalogSchema` and its exported inferred types in
      `src/content/schemas.ts`; require the exact five allowed IDs, a unique record per ID, a
      trimmed non-empty taunt no longer than 160 characters, and no unknown fields.
- [x] Register the catalog in `src/content/load.ts` and `LaunchContentSchema` without
      duplicating hero name, look, role, or power in the JSON.
- [x] Add `src/game/rival-hero-intro.ts` with:
  - a fixed career-progression list of the five eligible order-1 hero IDs,
  - `rivalHeroIntroFlag(heroId)`,
  - `pendingRivalHeroIntro(state)`, using `activeCareerMatchday` and live opponent
    membership,
  - `completeRivalHeroIntro(state, heroId)`, idempotent after a duplicate delivery and
    otherwise valid only for the currently pending hero.
- [x] Export the pure rule through `src/game/index.ts`.
- [x] Add `src/game/__tests__/rival-hero-intro.test.ts` covering the exact eligible roster,
      league and Cup opponents, league-first double headers, unrelated/user-owned/lower-order
      heroes, host changes, interruption, duplicate completion, and one flag per hero.
- [x] Add a content contract test proving the five content IDs still resolve to the five
      order-1 canonical specials with their expected look and power.

Phase 1 succeeds when malformed/missing copy fails at launch parsing, all trigger behavior
is deterministic and headless, old saves need no migration, and no component knows how to
identify a rival hero on its own.

### Phase 2 — Build the localized presentation seam and guarded Match Day flow

- [x] Add `src/application/rival-hero-intro.ts` with one production view-model builder that
      joins a canonical pending hero to its validated taunt and resolves
      `rivalHeroIntro.<heroId>.taunt` through `copyOrEnglish`. Expose the same builder by hero ID
      for the Dev Harness so the harness cannot hand-assemble production inputs.
- [x] Flatten the five English lines in `src/i18n/content-strings.ts` and register the new
      `rival-hero-intros.json` prefix/source in the 100% content-prose coverage gate.
- [x] Add faithful taunt translations for `es`, `pt-BR`, `fr`, `id`, `de`, and `vi` under
      `rivalHeroIntro.<heroId>.taunt`; keep hero names unchanged and reuse existing localized
      power names.
- [x] Add only the short banner/accessibility/hint keys the screen actually needs to every
      locale catalog, including localized `DIVISION RIVAL`. Do not duplicate `SUPER POWER`,
      power names, or existing speech hints.
- [x] Extend the `M1Store` interface and implementation with
      `completeRivalHeroIntro(heroId)`: call the pure completion function, update the career,
      and queue the normal career save.
- [x] Refuse `quickResult`, `watchMatch`, and Match Day's `setActiveTab` escape while
      `pendingRivalHeroIntro(career)` is non-null. Add the missing ordinary `screen ===
'matchday'` guard to `watchMatch` at the same time.
- [x] Add store integration coverage proving:
  - first-match Barry blocks both match actions and Match Day Back until completion,
  - completion queues persistence, remains on the same persisted Match Day, and re-derives
    the next presentation (another rival, Cup Bert, condition warning, or lineup),
  - a second completion is harmless,
  - a league intro on a double-header does not consume a different Cup rival's intro,
  - the complete double-header path settles only the league match, remains on Match Day,
    derives the Cup opponent's unseen hero, blocks the second team sheet, and writes that
    second hero's flag only after their own taunt,
  - a stale duplicate completion for hero A cannot consume a now-pending hero B,
  - the existing intro → lineup → Quick Result/watch → face-off/awakening → postmatch chain
    still settles correctly.
- [x] Where unrelated existing store tests intentionally begin downstream at Match Day,
      mark the relevant intro seen through a small shared **test-only** helper. Keep at least
      one unmodified end-to-end opening flow to prove production gating; never disable the
      selector globally in tests.

Phase 2 succeeds when every route into Match Day sees the same pending hero, no stale action
can bypass them, completion persists once, and all English/translated prose resolves from
one authored source.

### Phase 3 — Build the two-beat production screen

- [x] Add a tiny screen-reader-state hook beside `use-reduced-motion.ts`, using
      `AccessibilityInfo.isScreenReaderEnabled()` plus the live change subscription. Treat the
      initial unknown state conservatively (no timed dismissal until the promise resolves
      false), and clean up safely after unmount.
- [x] Add a small pure sequence/timing module for `power → speech → done`, including the
      no-auto-advance policy under screen-reader use, rapid-tap protection, and restart-on-
      foreground policy for an interrupted power beat. Both visible beats auto-advance after
      three seconds for sighted play; backgrounding speech cancels its audio and timer, then
      foregrounding restarts that full hold. Cover both phases with focused node tests and
      prove AppState transitions never call `completeRivalHeroIntro` while hidden.
- [x] Extend `CharacterSpeechOverlay` only where required:
  - optional `characterCentreRatio` with today's 0.8 placement as the default,
  - optional hidden-character mode so the rival screen can keep one parent-owned hero
    mounted while reusing the canonical bubble/tap treatment and opting into instant copy,
  - an opt-in safe-dismiss route so Android Back and accessibility escape call the same
    internal `advance` state machine as a tap.
    Existing call sites and visual placement must remain byte-for-byte equivalent in intent.
- [x] Add `src/ui/RivalHeroIntroScreen.tsx`:
  - full-screen hero-specific supplied art from one typed static asset map, rendered without
    smoothing through shared portrait and landscape composition presets, with solid black
    only as a defensive render fallback,
  - one integer-scaled `PlayerRunSprite`, centred and grounded near the bottom, translated
    as a crisp unit for the power showcase and returned to centre for speech,
  - a localized pixel-comic `DIVISION RIVAL` banner and large player name directly above
    the card, persisting through both beats without adding a focus target,
  - `PowerTitleTakeover` with `ending={false}`, canonical power colour/name/glyph, and an
    outer exit animation, with the duplicate player name hidden inside this scene only,
  - a three-second power/card beat and three-second speech beat, each with whole-screen
    tap-to-advance plus automatic advance,
  - a production-effect showcase: Barry dashes left/right, Scott strikes a room console,
    Steve rallies a nearby coach, Bruno pounds a heavy impact block, and Bruce shadow-marks
    a stuffed teddy bear,
  - no timed dismissal while a screen reader is active,
  - centred, instant full-copy `CharacterSpeechOverlay` bubble after the card is fully gone,
  - Reduced Motion that preserves both information beats without spatial motion,
  - hardware Back and accessibility escape mapped through the same staged advance as taps,
  - `AppState` cancellation plus a full power-beat restart when the app resumes from the
    background,
  - one accessible power-card button named with the hero plus localized power, with a hint
    that activation continues to the taunt,
  - a modal speech target that announces the full taunt and reuses the existing show-full /
    tap-to-finish hints,
  - explicit focus transfer on iOS/Android/web and decorative backdrop, sprite, rails,
    shadow, and duplicate visual text hidden from the accessibility tree.
- [x] Add one static rival-voice owner with five character-matched laughs. Start Bert's
      existing dialogue chatter with the speech bubble, start the assigned laugh one second
      after the chatter stops, cancel queued audio when a tap skips the beat, respect master
      volume/AppState, and release every player on root teardown.
- [x] Add the owner-supplied hip-hop bed through the existing menu-audio owner:
  - trim its silent tail at the eight-bar `12.3866s` turnover,
  - crossfade 120 ms into the next downbeat and repeat the phrase three times for a
    `37.16s`, `-20 LUFS` loop,
  - override the ordinary screen bed only while the production rival screen is mounted,
    including in the Dev Harness, then restore the latest requested theme.
- [x] Keep the first onboarding simulation powerless while counting Barry's real opponent
      membership on Home/Match Day instead of presenting the contradictory “0 rival heroes.”
- [x] In `App.tsx`, derive the pending hero/view model before Cup mismatch copy, then select
      exactly one Match Day presentation in this order:
      `rival intro → Cup mismatch Bert → low-condition warning → lineup`.
- [x] Inventory and enforce the current root composition while the rival slot is active:
  - gate the entire `guideOverlayVisible` family, including Cup mismatch, assistant
    sequences, and Bert notices,
  - defer `MatchdayConditionWarning`,
  - prove signing/request/coach/facility/postmatch character surfaces remain excluded by
    their non-Match-Day screen/action predicates,
  - defer any ordinary feedback notice that would cover the scene,
  - preserve the existing higher priority of the language offer, confirmation sheet, and
    persistent save-failure warning; their background-hiding/modal behavior must keep the
    rival scene out of the accessibility tree while they own focus.
- [x] Keep the lineup component unmounted during the rival scene, key the rival screen by
      `heroId`, pass that expected ID into the store completion action, and add the rival screen
      to the light Status Bar condition.
- [x] Mark `RivalHeroIntroScreen` as non-animated in the app's `ScreenTransition` policy so
      both entry and exit hard-cut. Test that the fading-screen mechanism never leaves a visible
      rival over an interactive lineup.
- [x] Add focused source/pure tests for card-before-bubble ordering, the exact five-asset
      mapping plus black fallback,
      canonical power-card reuse, default-preserving speech placement, screen-reader timing,
      the exact power-card accessible name/hint, speech announcement/hints, focus transfer,
      Back/escape stages, both AppState phases, Reduced Motion, and every item in the root
      overlay inventory above.

Phase 3 succeeds when the character is visually continuous through both beats, the power
card is completely gone before speech begins, assistive technology never loses timed
content, and the ordinary Match Day screen remains unchanged after handoff.

### Phase 4 — Put all five production scenes in the Dev Harness

- [x] Add `src/ui/dev-harness/entries/rival-hero-intro.tsx` with the five stable cases
      `barry-allan`, `scott-somers`, `steve-rodgers`, `bruno-bannor`, and `bruce-wain`.
- [x] Render the real view-model builder and `RivalHeroIntroScreen` for every case. Source
      identities, looks, powers, and selected taunts from validated production data.
- [x] Add entry-owned Full / Reduced Motion, Replay, and Hide-controls buttons using
      `DevHarnessButton` and static control styles. Completion in the harness restarts or shows
      the replay control; it never writes a career flag.
- [x] Register one import and one entry in `src/ui/dev-harness/registry.ts`, placed with the
      other Match presentations.
- [x] Add a source-level harness contract test proving all five bookmarkable IDs exist and
      the entry renders the production component/builder rather than a visual replica.

Phase 4 succeeds when these cold-load URLs work:

- `http://localhost:3000/#/dev/rival-hero-intro/barry-allan`
- `http://localhost:3000/#/dev/rival-hero-intro/scott-somers`
- `http://localhost:3000/#/dev/rival-hero-intro/steve-rodgers`
- `http://localhost:3000/#/dev/rival-hero-intro/bruno-bannor`
- `http://localhost:3000/#/dev/rival-hero-intro/bruce-wain`

## Verification sequence

- [x] Run the new pure game, content, sequence, store, App-ordering, and harness tests first.
- [x] Run the affected existing opening-career, Cup double-header, Cup warning,
      Quick Result, watched-match, rival-preload, i18n-gate, and menu-audio tests.
- [x] Run `npx tsc --noEmit` and a targeted format check over every new feature file.
- [ ] Bring the repository-wide format check to green. It remains red on the pre-existing
      812-file baseline; no unrelated bulk rewrite was made.
- [ ] Run the full Jest suite serially and fix only regressions caused by this feature.
- [x] Run the static web export and confirm no content/schema/bundle failure.
- [x] Start the local web preview through the normal project path, immediately mute all
      media, inspect all five deep links in Full Motion, and inspect Barry in Reduced Motion.
- [x] Capture visual evidence for 320-point portrait and a short/wide layout; inspect
      banner/card/hero/bubble separation, shared bottom-anchored responsive framing, pixel
      scaling, long-taunt wrapping, focus order, tap skip, and Replay. The black fallback is
      source-tested.
- [ ] During one run, background and foreground the app/browser during the power hold and
      verify the card restarts instead of silently advancing to speech.
- [ ] Exercise one real seeded career through rival intro → lineup → match action and verify
      reload before completion replays while reload after completion does not.
- [x] Close the dedicated browser QA session after muting it. The already-running shared
      development server was not started or stopped by this task.
- [x] Confirm the final diff contains no `src/sim` or `ENGINE_VERSION` change and report any
      check not actually run as **NOT VERIFIED**.

Verification notes (2026-08-08):

- Focused rival-scene, localization, transition, and responsive-composition coverage passes:
  7 suites / 46 tests.
- Affected Match Day integration coverage passes: 4 suites / 64 tests.
- Existing special-hero/scouting coverage passes: 3 suites / 42 tests.
- TypeScript and a Dev-Harness-enabled static web export pass.
- The full Jest run is **NOT VERIFIED** green: it was stopped after 32 minutes after finding
  pre-existing failures in `pixel-bible-geometry.test.ts` (unrelated sprite geometry
  baselines). No feature regression surfaced before it was stopped.
- Manual app/background interruption and a real persisted-career reload are **NOT VERIFIED**;
  their state rules are covered by focused pure/store tests.

## Acceptance criteria

- [x] Exactly Bruce Wain, Bruno Bannor, Steve Rodgers, Scott Somers, and Barry Allan receive
      the scene, with their canonical looks and powers.
- [x] The live opponent/hero relationship—not club, division, season, or fixture ID—arms the
      scene.
- [x] Each hero completes once per career; interruption, duplicate delivery, old saves, user
      ownership, host movement, Cup-first meetings, and double headers follow the spec.
- [x] Power card, speech, Back/escape, screen reader, and Reduced Motion behavior matches the
      exact two-beat contract.
- [x] Rival, Bert, condition, and lineup presentations never mount over one another.
- [x] Play, Quick Result, and Match Day Back cannot bypass pending story copy.
- [x] All authored prose is typed, validated, localized, and guarded at 100% coverage.
- [x] All five supplied backdrops resolve through one typed hero-keyed mapping, retain crisp
      pixel rendering, use the same orientation-specific zoom/X/Y composition, and fall back
      safely to black.
- [x] The localized `DIVISION RIVAL` banner, large player name, and nameless power card form
      one compact identity stack through both beats without creating a third phase or focus
      stop.
- [x] Every rival demonstrates their canonical power against the requested deterministic
      target before speech; both beats auto-advance after three seconds and whole-screen taps
      advance them sooner without skipping unseen content.
- [x] All five production scenes are directly bookmarkable, replayable, and visually usable
      in the Dev Harness.
- [x] Existing onboarding, Cup, audio, save, deterministic replay, and match results remain
      unchanged under the recommended Barry teaser policy.
- [x] The first tutorial team sheet reports one rival hero, while focused tests still prove
      both simulated teams carry no powers for that fixture.
- [x] The dedicated rival bed owns both cutscene beats, loops at `37.16s`, respects the menu
      master/lifecycle controls, and restores the underlying theme without overlap.
- [x] Every taunt uses Bert's normal dialogue chatter, then its fixed rival laugh one second
      after chatter ends; all five cues are normalized to the project's SFX target.

## Risks and mitigations

- **First-match expectation mismatch:** Barry's card names a power the onboarding match
  disables. The approved teaser policy preserves that match; tests must prevent a hidden
  balance or replay change.
- **Downstream test breakage:** the new guard correctly blocks many test fixtures that jump
  straight to Match Day. Use explicit seen flags in unrelated tests, not a test-only product
  bypass.
- **Overlay collision:** derive one presentation slot before building Cup/condition scenes;
  do not stack absolute overlays and rely on z-index.
- **Interactive lineup under a fading rival:** opt the rival screen out of whole-screen
  dissolves on both entry and exit.
- **Rapid taps / duplicate callbacks:** use a small phase reducer and done ref, and keep pure
  completion idempotent.
- **Assistive focus stolen by the timer:** screen-reader state disables auto-advance.
- **Timer expires while suspended:** cancel the card sequence on background and replay that
  beat from its beginning on foreground.
- **Hero flicker between beats:** keep one parent-owned sprite mounted and let the speech
  overlay render only the bubble.
- **Locale drift:** English remains in the content file, translations remain in locale
  catalogs, and the new source starts at the existing 100% high-water mark.
- **Backdrop drift:** one typed backdrop map owns all five static `require()` calls; do not
  scatter asset paths or fallback colours through the component.

## References and research

- Product specification:
  `docs/superpowers/plans/2026-08-08-rival-hero-intro-cutscenes-spec.md`
- Reconciled Grok specification audit:
  `docs/superpowers/plans/2026-08-08-rival-hero-intro-cutscenes-spec-grok-audit.md`
- Canonical rivals: `src/game/special-heroes.ts`
- Active fixture order: `src/game/career.ts`
- Once-only persisted story precedent: `src/game/cup-mismatch-warning.ts`
- Store Match Day actions: `src/application/store.ts`
- Existing Match Day composition: `App.tsx`
- Production hero sprite: `src/render/PlayerRunSprite.tsx`
- Production power card/presentation: `src/render/PowerTitleTakeover.tsx`,
  `src/render/power-cut-in.ts`
- Production speech behavior: `src/ui/CharacterSpeechOverlay.tsx`,
  `src/ui/speech-bubble.tsx`
- Typed content and localization gates: `src/content/schemas.ts`, `src/content/load.ts`,
  `src/i18n/content-strings.ts`, `src/i18n/__tests__/gates.test.ts`
- Dev Harness contract: `README.md`, `src/ui/dev-harness/registry.ts`,
  `src/ui/dev-harness/entries/awards-ceremony.tsx`
- No external research was needed; this feature is governed by current repository
  contracts and owner-provided product behavior.
