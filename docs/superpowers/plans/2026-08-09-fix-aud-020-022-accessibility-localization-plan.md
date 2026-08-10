---
title: "fix: close AUD-020 through AUD-022"
type: fix
date: 2026-08-09
status: implemented
---

# Close AUD-020 through AUD-022

## Objective

Close three P2 release-audit findings without changing match simulation, replay
data, save schemas, or authored game balance:

1. AUD-020: character walk-ons expand narrow web viewports while the character
   arrives and leaves.
2. AUD-021: a global 1.6 Dynamic Type cap overrides the player's selected text
   size, and two visible controls are below the 44-point target.
3. AUD-022: the hardcoded-prose gate permits 71 source literals, the recovery
   screen is English-only, two German settings labels are incorrect, and many
   money values still use an English-only formatter.

## Verified baseline

- `CharacterSpeechOverlay` positions its visual children with positive
  `translateX` values under an absolute-fill `View` that does not clip overflow.
  The full-screen `Pressable` must remain the input owner; only its noninteractive
  visual layer needs clipping.
- `App.tsx` assigns `Text.defaultProps.maxFontSizeMultiplier = 1.6`, so the cap
  applies before individual screens can reflow.
- `SeasonPodiumScreen` gives Skip 6 points of vertical padding and no explicit
  minimum height. `LanguageButton` uses `min-h-9`, which is below the project's
  explicit 44-point acceptance contract on web and native.
- The authoritative AST gate reports `71 (ceiling 71)`. The old
  `scripts/i18n/prose-report.mjs` reports only six because it implements an older,
  weaker scan. The gate list contains real copy, deliberate English fallbacks,
  persisted identifiers, QA names, developer diagnostics, and CSS/browser query
  strings. These classes must be separated; lowering the number without making
  the scanner more accurate would only replace one false signal with another.
- `ScreenErrorBoundary.tsx` is explicitly exempt and contains five English
  literals. A hook cannot run in the error-boundary class, but a function wrapper
  can read the current catalog and pass resolved strings to the class.
- `content/i18n/de.json` currently says `Einstellungen zu` and
  `Einstellungen auf`; the correct action labels are `Einstellungen schließen`
  and `Einstellungen öffnen`.
- `src/i18n/format-number.ts` already owns deterministic locale-aware grouping.
  `src/ui/components/Scorecard.tsx` and several application files still own
  comma-only or `toLocaleString()` money paths that ignore the selected locale.
- The worktree already contains unrelated changes in `App.tsx`, persistence,
  Settings, tests, and `supabase/`. This work must preserve those changes and
  avoid bulk rewrites of the dirty files.

## Implementation

### 1. Clip the walk-on visual viewport

Files:

- `src/ui/CharacterSpeechOverlay.tsx`
- focused UI contract test under `src/ui/__tests__/`

Actions:

1. Keep the absolute-fill `Pressable` as the full-screen input and accessibility
   surface.
2. Add `overflow: 'hidden'` to the absolute-fill, `pointerEvents="none"` visual
   child that owns the bubble, character, and shadow. Do not clip the input
   surface or change the arrival/rest/departure geometry.
3. Add a source-level regression contract that identifies the clipped visual
   layer, not an unrelated nested view.
4. In the web harness, measure `documentElement.scrollWidth`, `body.scrollWidth`,
   and the visible root width during arrival, speaking, and departure at 320,
   390, and 430 CSS pixels. Each phase must keep page width equal to viewport
   width and must not cause horizontal page movement.
5. Commit a repeatable browser audit command that performs those nine phase and
   width checks against the harness and exits nonzero on overflow. The source
   contract remains a secondary guard; it is not the acceptance proof.

### 2. Restore uncapped Dynamic Type and 44-point actions

Files:

- `App.tsx`
- `src/ui/screens/SeasonPodiumScreen.tsx`
- `src/ui/components/LanguageButton.tsx`
- relevant accessibility/layout tests

Actions:

1. Remove the mutation of `Text.defaultProps` and its 1.6 constant. Do not replace
   it with a different global cap.
2. Inventory every existing `maxFontSizeMultiplier`. Remove the caps from the
   Advance Week action, Settings action, and management tab actions. Keep local
   caps only for developer save-slot glyphs, resource counters, and measured
   fixed table/register headers. Record each retained fixed-data exception in
   its component, rather than restoring a global policy.
3. Give the podium Skip control explicit `minWidth: 44` and `minHeight: 44` in
   React Native points. Let its label wrap or grow instead of reducing the hit
   target.
4. Give the title Language control explicit `minWidth: 44` and `minHeight: 44`
   in React Native points. Keep the hit surface at least 44 points on both axes;
   apply shrink or wrapping behavior to its text child so long endonyms and
   large type expand vertically without pushing the title page sideways.
5. Make the language picker panel vertically scrollable when seven rows plus
   scaled text exceed the available height. Preserve its modal semantics and
   per-locale display faces.
6. Add a source inventory test that rejects a global cap, rejects local caps on
   player actions, documents the retained fixed-data/developer exceptions,
   asserts both explicit 44-by-44-point contracts, and asserts the narrow-screen
   reflow/scroll structure.
7. Verify the title and podium at a normal scale and at an iOS accessibility
   category. Browser pixel sizes are supporting evidence only; the acceptance
   unit for native controls is React Native points.

### 3. Make the localization gate honest and hard-zero

Files:

- `src/i18n/hardcoded-prose.ts`
- `src/i18n/__tests__/no-hardcoded-prose.test.ts`
- `scripts/i18n/prose-report.mjs`
- each source file still reported by the authoritative scanner
- all seven `content/i18n/*.json` catalogs

Actions:

1. Classify all 71 current results before changing the ceiling:
   - player-facing copy moves to catalog keys;
   - pure-ring or persisted English fallbacks keep their English value and their
     existing key/params contract, with a structural sibling or the documented
     `@i18n-fallback` marker;
   - developer diagnostics, media queries, DOM selectors, QA fixtures, and
     product-defined player/club names are excluded by narrow structural rules,
     not by a broad UI-directory exemption.
   The saved inventory is the review checklist. Its only intersection with the
   current dirty source is the four power-QA player names at `App.tsx:312-315`;
   classify those as product-defined QA names without editing that dirty block.
   Dirty Settings is not in the offender list.
2. Move visible literals such as BUILD, PLAYED, movement labels, and the
   language-offer English escape label and accessibility label through `t(...)`.
   The English escape remains English in every catalog by design, but it is no
   longer an untracked source literal.
3. Replace the stale report's duplicate scanner with one authoritative result
   path so the report and Jest gate cannot disagree again.
4. Remove the `ScreenErrorBoundary` exemption. Keep the class as the catcher,
   wrap it in a function component that resolves catalog strings, and pass the
   heading, recovery explanation, technical-detail label, button label, and
   accessibility label into the class. Keep raw error details untranslated.
5. Set `MAX_REMAINING` to `0` only after the authoritative list is empty. Add a
   negative-control test that proves a new visible source literal fails the
   scanner.
6. The six non-English catalogs already contain unrelated edits. Patch only the
   new exact keys and the two German settings values, then compare each catalog's
   pre-existing diff before and after this work. Do not regenerate or reorder a
   full catalog.

### 4. Route formatted numbers and money through the active locale

Files:

- `src/i18n/format-number.ts`
- `src/i18n/use-copy.ts`
- `src/ui/components/Scorecard.tsx`
- affected UI and application consumers
- number-format and representative screen/store tests

Actions:

1. Extend the catalog-bound `CopyFn` with deterministic, locale-bound integer
   and money helpers. Keep positive-sign handling in the central formatter so
   `+$1.234`, `-$1.234`, and `$1.234` cannot diverge by screen.
2. Replace `Scorecard`'s comma-only formatter, bare `toLocaleString()` calls,
   and local `$...` formatters on player-visible paths with the locale-bound
   helper. Components that already have `t` use the bound helper. Pure view-model
   builders use their injected `CopyFn`; `GameApp` uses its current catalog copy.
   Build the complete consumer inventory first from `Scorecard` formatter
   imports, local `formatMoney`/`formatCurrency` definitions, `toLocaleString`,
   and literal currency assembly in `src/ui`, `src/application`, and `App.tsx`.
3. Do not import React or UI state into `src/game`. Game-ring values remain raw
   numbers or English fallbacks paired with keys and params; formatting happens
   in the application/UI consumer.
4. Keep stat codes, player names, club names, fictional brands, and raw technical
   error details unchanged. They are product data, not translated prose.
5. Add cross-locale tests for English and German grouping on positive, negative,
   signed, and zero money, plus representative notices, accessibility labels,
   financial rows, and confirmation copy.
6. Add a repository guard that rejects bare `toLocaleString()` and local
   player-visible currency assembly in UI/application code. Permit only explicit
   pure-ring fallback or developer-fixture cases, each documented at its site.

### 5. Correct German settings copy

Files:

- `content/i18n/de.json`
- catalog tests

Actions:

1. Change `settings.open` to `Einstellungen öffnen`.
2. Change `settings.close` to `Einstellungen schließen`.
3. Assert both values so a later automated translation pass cannot restore the
   noun-plus-particle mistranslation.

## Acceptance criteria

- [x] At 320, 390, and 430 CSS pixels, a web character walk-on does not increase
      page width during arrival, speaking, or departure.
- [x] No global Dynamic Type maximum remains.
- [x] Podium Skip and the title Language control have explicit 44-by-44-point
      minimum hit areas and remain usable with large text.
- [x] The seven-row language picker remains reachable when large text makes it
      taller than the screen.
- [x] `allOffenders()` returns zero and the gate ceiling is zero.
- [x] The prose report and Jest gate report the same count.
- [x] Error recovery, its action, and its accessibility copy use the selected
      catalog; only the raw technical message remains raw.
- [x] German Settings open/close actions use correct verbs.
- [x] Player-visible formatted money and grouped integers follow the selected
      locale, including notices and accessibility labels.
- [x] No `src/game` dependency on React Native, Expo, or UI state is added.
- [x] No `ENGINE_VERSION` bump or golden replay update is needed because no sim
      behavior or RNG consumption changes.
- [x] Existing unrelated worktree changes remain intact.

## Verification

1. `npx tsc --noEmit`
2. `npx jest src/i18n --runInBand`
3. focused Jest suites for walk-ons, title language, podium, error recovery,
   store notices, financial display, and accessibility contracts
4. `node scripts/i18n/prose-report.mjs`
5. `npx jest --runInBand`
6. Export and serve the web build; mute immediately; run the committed automated
   walk-on phase audit at 320, 390, and 430 pixels; close the tab and stop the
   server after QA
7. Native check for 44-point controls and an accessibility Dynamic Type category

### Verification result

- `npx tsc --noEmit`: passed.
- The focused AUD, formatter, application, ceremony, event, and 44-point suites
  passed together: 14 suites and 136 tests.
- `node scripts/i18n/prose-report.mjs`: passed with `hardcoded prose remaining: 0`.
- `node scripts/qa/aud-020-walk-on-overflow.mjs`: passed arrival, speaking, and
  departure at 320, 390, and 430 pixels. Browser media was muted and both the
  browser and Metro were stopped after the run.
- A full Jest run is currently blocked by unrelated dirty catalog work:
  `content/i18n/pt-BR.json` adds `clubFinances.tapHereToPlace` over its existing
  boxed-copy budget. The AUD hard-zero prose gate itself passes.
- The exact 44-point React Native style contracts and large-text reflow structure
  are covered by source tests. A simulator visual smoke was not run in this turn.

## Risks and controls

- Removing a global font cap can expose fixed-height assumptions outside the
  three cited screens. The implementation must not hide those failures with a
  new cap. Record and repair any player-action layout reached by focused QA.
- Changing all formatters at once can double a sign or currency symbol. Central
  signed-value tests land before consumer migration.
- The prose list contains intentional English data. Translating persisted enums
  or fallbacks would break matching and language switching. Classify first and
  retain keys/fallbacks instead of translating at the source.
- `App.tsx` is already dirty. Use narrow patches against inspected blocks and
  review its final diff against the pre-existing diff before verification.

## Non-goals

- No translation of player names, club names, stat/role codes, or fictional
  sponsor brands.
- No rewrite of the visual art, walk speed, speech timing, match engine, season
  economy, or save format.
- No commit, push, merge, deployment, TestFlight upload, or production change.

## Grok 4.5 review record

High-effort, read-only plan audit completed on 2026-08-09. Grok returned five
findings. All five were verified locally and incorporated:

1. Language now requires a 44-by-44-point minimum, not height alone.
2. The hardcoded-prose inventory now names its dirty-file intersection and the
   catalog diff-preservation rule.
3. Walk-on overflow now needs a repeatable browser command that fails on real
   scroll-width growth in all nine width/phase combinations.
4. Dynamic Type now includes a complete local-cap inventory and explicit
   retained-exception policy.
5. Locale-aware formatting now includes a full consumer inventory and a
   repository guard against reintroducing host-locale/bare currency formatting.
