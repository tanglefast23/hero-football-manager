# Fix Hero License state and lineup handoffs

**Date:** 2026-08-21
**Scope:** D3, D2, D1 Hero License failures from the full-career playtest
**Status:** implemented and verified in this change

> Historical implementation record. The 2026-08-24 six-findings master spec
> supersedes only the old rule that a relicensed former starter must stay
> benched. Manual license changes and later awakenings now preserve the existing
> `returnLineupSlot`, and relicensing restores that exact legal slot. Negotiated
> contract-license reclaims remain the explicit signed exchange described here.

## Problem

The career can own a valid permit, yet refuse to license or field the chosen
hero. The worst path combines three separate decisions:

1. who owns a Hero License;
2. who starts the next match;
3. which contract promise must be honoured.

The match-day license toggle currently tries to do all three. Licensing a bench
hero also tries to place that hero in the Starting XI. The lineup may already
have changed during the license update, so the second step can fail with
`That is not possible right now` or name the wrong displaced player.

Post-match awakenings add a fourth hidden decision. They automatically claim a
free permit, so a player can lose the last permit without choosing to spend it.

## Rules after this fix

1. `heroLicenseCap(state)` remains the only Hero License cap.
   - D5/D4 earn 2, D3/D2 earn 3, and D1 earns 4.
   - Bought permits are a floor, not an addition.
   - A D1 club may buy permit 5 and later permits.
   - No license action may use a hard-coded cap of 4.
2. A license and a Starting XI slot are separate.
   - Licensing a bench hero does not put them in the lineup.
   - Removing a starter's license may bench that starter to keep the XI legal.
   - Restoring that license does not force the hero back into an old slot.
   - The manager uses the normal lineup control to choose the final XI.
3. A direct license toggle never chooses a different hero's slot.
   - With free capacity, the chosen hero is licensed.
   - At full capacity, the player must first remove one existing license.
   - The action never infers or describes a displaced incoming starter.
4. A Starter or Captaincy promise may perform one atomic handoff.
   - The manager must select the exact licensed holder who gives up the permit.
   - A protected Starter or Captaincy promise cannot be displaced.
   - A selected starting holder gives the incoming player that exact slot.
   - A selected bench holder loses only the permit; normal promise enforcement
     places the incoming player without inventing a different license handoff.
   - If all holders are protected, that promise is unavailable before submit.
     Other contract options remain available.
5. The contract screen previews the selected result.
   - Every option names the outgoing holder and says `Starting XI` or `Bench`.
   - The warning names the selected holder and incoming player.
   - Copy is derived from the selected holder, never from a role guess.
6. A later random awakening never spends a Hero License.
   - The first story awakening remains the campaign's free licensed hero.
   - Every later new hero awakens unlicensed.
   - No existing player's license changes.
   - An awakened starter is benched with the existing deterministic safe
     replacement rule.
   - A protected promised starter is not selected when awakening would bench
     them.
   - The manager can assign a free permit after the reveal.

## Implementation

### 1. Remove the hidden incoming-lineup swap

Edit `src/application/store.ts` and `App.tsx`.

- Keep `selectCareerLicensedHeroes` as the one license-selection operation.
- Keep the live capacity check on `careerHeroLimit(career)`. It delegates to
  `heroLicenseCap(state)` and already accepts permit 5 and later permits. Do not
  replace it with a literal 4.
- Delete the second store step that searches for an unlicensed starter and
  forces the newly licensed bench hero into that slot.
- Delete the match-day confirmation that promises `License and swap`.
- Keep the existing full-cap refusal: `Unlicense one hero before assigning this
permit.`
- Keep the existing safe repair when a licensed starter loses their permit.
  This prevents an invalid XI and preserves old-save recovery.

This is the root fix for assigning a fifth permit, restoring a removed permit,
the wrong displaced-player copy, and the generic refusal after an exact choice.

### 2. Make awakening license-neutral

Edit `src/game/post-match-awakening.ts`.

- Remove `hasAvailableHeroLicense` from awakening eligibility and the result.
- Write `licensed: firstHero` for the new hero. This preserves the explicit
  first-story gift and leaves every later awakening unlicensed.
- Run the existing safe-bench path for every later awakened starter.
- Make `canSafelyAwaken` use the same unlicensed outcome for every awakening.
- Always exclude a fit starter with an active Starter or Captaincy promise,
  because the unlicensed awakening would bench them.
- License capacity may no longer suppress an awakening. Do not change the base
  chance, power selection, RNG calls, or match replay.

This is a career-state change, not a match-engine change. `ENGINE_VERSION` does
not move.

### 3. Make the contract handoff preview exact

Edit `src/ui/market-models.ts`, `src/application/market-view-model.ts`,
`src/ui/screens/MarketScreen.tsx`, and all seven locale catalogs.

- Add one localized consequence line to each reclaim option.
- For a starting holder: `{holder} leaves the Starting XI. {incoming} takes
that exact slot.`
- For a bench holder: `{holder} gives up the permit. {incoming} enters the
Starting XI through the contract promise.`
- Show the consequence only for the selected option.
- Replace the generic warning that can name or imply the wrong player.

Do not add another modal or a new license state machine.

### 4. Keep contract-promise guards at the transaction boundary

Add the missing regression cases first, then change these files only if one
proves a gap:

- `src/game/contract-promises.ts`
- `src/game/market-career.ts`
- `src/application/contract-promise-projection.ts`

The traced flow already validates the same cap used by match day, requires the
chosen reclaim holder, excludes protected holders, and applies the transfer only
after the agent accepts. The new tests must still prove the observed paths:

- A selected starting holder gives the incoming hero that exact slot.
- A selected bench holder loses the permit without inventing a second license
  handoff.
- Protected holders never appear as reclaim choices.
- When all holders are protected, only the unsafe Starter and Captaincy options
  are disabled. Another contract option can still submit.

Keep the shared guards when those tests pass. Do not duplicate them in the
screen.

## Tests

Add the smallest regression set that covers the career failures.

1. `src/application/__tests__/store.test.ts`
   - Remy Ash is unlicensed on a full bench and the XI has all 11 slots. A D1
     club with cap 5 and four active licenses can assign him. The XI is unchanged.
   - Removing a licensed starter repairs the XI. Restoring that license succeeds,
     keeps the hero benched, and keeps the repaired XI legal.
   - A full cap still asks for one license to be removed first.
2. `src/game/__tests__/post-match-awakening.test.ts`
   - The first story awakening remains licensed.
   - A later awakening with free capacity remains unlicensed.
   - At a full cap, the awakening still occurs and the exact set of licensed
     player IDs is unchanged.
   - A protected promised starter is not selected.
   - A different non-protected starter can awaken, is benched, and the next team
     builds.
3. Contract regression tests prove the handoff instead of relying only on the
   existing green suite.
   - Exact chosen-holder handoff.
   - A chosen bench holder does not cause a second inferred handoff.
   - Protected promises cannot be reclaimed.
   - An all-protected cap disables only unsafe starting promises.
   - Free capacity needs no reclaim choice.
4. `src/application/__tests__/market-source-adapter.test.ts`
   - The selected option's preview names the exact outgoing and incoming
     players for both Starting XI and Bench cases.
5. `src/application/__tests__/hero-license-purchase.test.ts`
   - Permit 5 remains part of the real shared cap after save round-trip.

Run:

```bash
npx jest src/application/__tests__/store.test.ts \
  src/game/__tests__/post-match-awakening.test.ts \
  src/game/__tests__/contract-promises.test.ts \
  src/game/__tests__/market-career.test.ts \
  src/application/__tests__/market-source-adapter.test.ts \
  src/application/__tests__/hero-license-purchase.test.ts --runInBand
npx tsc --noEmit
```

This changes progression state, so run the focused career balance rails only if
the existing focused tests show a measured balance contract changed. Do not run
the full soak suite by default.

## Browser acceptance

Use a Dev Harness fixture, not the user's stopped career.

1. Show a D1 club with permit cap 5, four licensed heroes, a full XI, and Remy
   Ash unlicensed on the bench. Tapping Remy changes the counter to `5 / 5` and
   does not change the Starting XI.
2. Remove a starter's permit, then restore it after the safe bench repair. Both
   actions succeed, the restored hero remains benched, and the XI stays legal.
3. At a full cap, select a Starter promise and choose a holder. The visible
   preview names that exact holder and the exact lineup effect.
4. Confirm that a protected holder is absent and an all-protected set disables
   the promise with a clear reason.
5. Show an awakening at a full cap. The new hero is unlicensed and the exact
   existing licensed-player set is unchanged.

## Not in scope

- No permit price or division-cap rebalance.
- No change to the four-tile desktop match rail.
- No match simulation, power firing, or replay change.
- No automatic best-XI feature beyond the existing safe replacement.
- No migration that rewrites valid player choices.

## Done when

- Five owned permits can produce five licensed heroes.
- Free capacity never rejects the selected hero.
- Removing and restoring a permit cannot dead-end the career.
- Direct license changes never force an incoming lineup slot.
- Contract handoffs use and preview the exact selected holder.
- Protected promises block only the unsafe promise, not the career.
- Later random awakenings never consume a permit.
- Focused tests, TypeScript, and the Dev Harness acceptance path pass.
