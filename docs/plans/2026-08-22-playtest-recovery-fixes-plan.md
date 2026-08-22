---
title: Playtest Recovery Fixes Implementation Plan
date: 2026-08-22
status: implemented
---

# Playtest Recovery Fixes Implementation Plan

## Goal

Fix the six player-facing problems found during the Indonesian recovery run:

1. Automatic lineup selection uses the wrong roles.
2. Detailed scout reports can be disabled when they are still useful.
3. Sponsor challenges appear against the league leader.
4. Contract wage buttons move in fixed-looking increments.
5. Indonesian screens can show English labels.
6. Hero License refusal copy hides the active contract promise.

Keep scout-report expiry unchanged. Reports intentionally expire when their transfer window closes. The late-scout warning must explain that consequence before money is spent.

## 1. Automatic lineup selection

**Files:** `src/game/squad.ts`, `src/game/contract-promises.ts`, `src/application/store.ts`, `App.tsx`, and focused squad/store tests.

- Make `arrangeCareerLineupForFormation` implement the reviewed selection order.
- Build one pool per natural role from players who are fit, not away, legally selectable, not already assigned, and licensed when powered.
- Reserve natural-role slots for available Starter and Captaincy promise holders. Older promises win first, then player ID ascending. Skip unavailable promise holders.
- Fill each natural-role pool by conditioned role rating.
- Prefer a licensed hero only on an exact rating tie, then use player ID ascending.
- After every natural-role pool is used, walk empty outfield slots in formation-slot order. Pick the remaining player's conditioned rating for each vacant role, then use the same hero and player-ID tie-breaks.
- Never use an outfielder in goal or assign one player twice.
- Return the current state when a full legal XI cannot be built.
- Remove the current-formation no-op in `selectFormationPreset` so selecting it rebuilds the XI.
- Let `advanceCareer` accept the saved formation when it starts a new season, then arrange the new-season XI once.
- Stop contract-promise restoration from replacing a different-role player. If no same-role slot is available, leave the newer promise unhonoured.
- Keep ordinary injury repair narrow. It replaces only an unavailable starter and preserves a legal manual XI.

**Checks:** strongest natural-role player, condition reversal, licensed-hero tie, deterministic repeat, same-role promise seniority, unavailable promise exclusion, genuine shortage fallback, no duplicate player, no goalkeeper fallback, current-formation reselect, and saved formation at season start. Include the reported case where available defenders prevent a forward from starting in defence. Exclude injured, away, and unlicensed powered players.

## 2. Scouting recovery path

**Files:** `src/application/market-view-model.ts`, `src/ui/market-models.ts`, `App.tsx`, locale catalogs, and focused market tests.

- Enable a detailed report whenever any displayed value is still a range.
- Remove the Scout Office Level 3 and potential-only gates. The game engine already supports this purchase.
- Keep the existing active-report, cash, and expiry checks.
- Show the exact reason when the detailed-report button is disabled.
- Add the mission duration and a `returnsAfterCurrentWindow` flag to the existing scout choice view model.
- Before a late in-window mission starts, use the existing confirmation sheet.
- Explain that the scout returns after registration closes and that the report expires before the next window.
- Offer `Scout anyway` and `Wait`. Do not silently block the choice.

**Checks:** Level 3 range report is purchasable, exact report is not, insufficient money explains the block, Week 17 two-week mission warns, and an on-time mission starts directly.

## 3. Sponsor challenge fairness

**Files:** `src/game/sponsors.ts` and focused sponsor tests.

- Reuse the existing league-table calculation.
- Return no weekly sponsor challenge when the next opponent currently leads the division.
- Keep both existing challenge choices for every other opponent.
- Do not add a second opponent-strength model. The leader rule covers the reported unfair case with one stable rule.

**Checks:** leader fixture has no challenge; non-leader fixture still offers both choices.

## 4. Percentage contract controls

**Files:** `src/game/market.ts` and focused market/view-model tests.

- Change `contractWageStep` to 5% of the original weekly ask.
- Round to the nearest $10 and keep the existing $50 minimum.
- Continue deriving every press from `negotiation.weeklyAsk`, so repeated presses do not compound.
- Keep the current dynamic button labels.

**Checks:** low asks retain the $50 floor; larger asks use the stable 5% step in both game and view-model tests.

## 5. Indonesian copy

**Files:** `src/application/view-models.ts`, all seven locale catalogs, and focused i18n tests.

- Replace the hard-coded `Balanced` matchday label with a catalog key.
- Add a translated value to every shipping catalog.
- Correct clear English leftovers in Indonesian where the term is not an accepted football or interface loanword.
- Keep names, abbreviations, placeholders, and normal Indonesian loanwords unchanged.
- Use the existing prose, key-parity, content-coverage, and glyph checks. Do not add a parallel localization scanner.

**Checks:** Indonesian matchday tactics contain no English `Balanced` label; all catalogs contain the new key; existing localization gates pass.

## 6. Hero License promise explanation

**Files:** `src/game/squad.ts`, all seven locale catalogs, and focused promise tests.

- Read the blocking player's active Starter or Captaincy promise.
- Emit a promise-specific localized error key with player name and agreed season.
- Explain the exact promise, when it was agreed, why a starting hero needs a Hero License, and that the promise must end or be replaced first.
- Use the existing error surface. Do not add a Bert dialog for one refusal.

**Checks:** Starter and Captaincy refusals use different keys, include the agreed season, and still prevent an illegal license removal.

## Verification

Run only focused checks for the changed systems:

```text
npx jest src/game/__tests__/squad.test.ts src/game/__tests__/contract-promises.test.ts
npx jest src/game/__tests__/market.test.ts src/game/__tests__/market-career.test.ts src/application/__tests__/market-view-model.test.ts
npx jest src/game/__tests__/sponsors.test.ts src/application/__tests__/store.test.ts
npx jest src/i18n/__tests__/catalog.test.ts src/i18n/__tests__/locales.test.ts src/i18n/__tests__/no-hardcoded-prose.test.ts src/i18n/__tests__/content-strings.test.ts
npx tsc --noEmit
```

This changes deterministic management rules, but not the match simulation. Do not bump `ENGINE_VERSION`. Run no match balance soak.
