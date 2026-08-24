---
title: "fix: Resolve eight PT-BR career findings"
type: fix
date: 2026-08-24
status: implemented-and-reviewed
spec: ../superpowers/specs/2026-08-24-eight-ptbr-career-findings-master-spec.md
implementation-base: ef59a615b99650ff9451f2455b404034772733d1
---

# Resolve Eight PT-BR Career Findings

## Outcome

Fix the six confirmed production defects from the PT-BR full-career report.
Keep the two already-fixed findings protected by regression tests.

The shipped result must:

- block paid training at the visible 999 ceiling;
- keep D1 and D2 Hero Cup opponents at D3 or stronger through the Round of 16
  when a legal survivor exists;
- explain whether a morale gift ended a transfer request;
- show unique shirt numbers across the active squad;
- give the repeatable story one full intervening season and prefer unseen stories;
- show one exact growth grade in Scout, Deals, and Squad;
- preserve the current Hero License lineup repair and Starter promise validation.

No new dependency, save migration, or `ENGINE_VERSION` bump is allowed.

## Council Round 1 Decisions

The first Council Audit used only Claude Opus 5 and Grok 4.6 at `xhigh`.
The revised spec accepts these proven findings:

- Visible 999 intentionally replaces hidden post-ceiling keeper development.
- Drill-row `gain` stays the clamped base line. The signed adjustment stays
  separate, and the confirmation states the exact ordinary result.
- The Round-of-32 D1-vs-D5 repair stays Round-of-32-only.
- The save codec already rejects duplicate explicit shirt numbers.
- Exact scouted grades must reach both the report identity and BUY listing.
- Keeper parity and drift rails belong in focused verification.

## Existing Patterns to Reuse

- `displayedValue` and `instantTrainingPreview` already own visible training math
  (`src/game/training.ts:150-230`).
- `roundOf32PairingOrder` already contains the protected-user opponent swap
  (`src/game/pyramid.ts:1437-1485`).
- `shouldWithdrawTransferRequest` already owns the withdrawal rule
  (`src/game/pyramid.ts:1100-1107`).
- `lastPlayerGiftResult` already publishes celebration data only after save
  (`src/application/store.ts:2690-2726`).
- `JERSEY_10` already reserves explicit number 10 and clears its former wearer
  (`src/game/contract-promises.ts:158-186`).
- `resolvedEventHistory` already records event ID, season, and week
  (`src/game/career-events.ts:1039-1061`).
- `playerGrowthGrade` is already imported by the market source adapter
  (`src/application/market-source-adapter.ts:22-24`).

## Step 0 — Establish the implementation baseline

- [x] Install the locked dependencies with `npm ci` in the clean branch.
- [x] Record the current `origin/main` commit in this plan before product edits.
- [x] Run the existing Finding 4 Hero License repair tests.
- [x] Run the existing Finding 8 Starter promise and market validation tests.
- [x] Run `src/application/__tests__/m4-event-balance.test.ts` before the event
      weighting change and keep its result for comparison.
- [x] Run the default one-seed `club-business-long-career-probe` before the event
      weighting change. Keep the output in temporary audit evidence, not source.

Baseline result: the five focused suites passed with 81 tests. The optional
long-career probe failed before product edits in both modes at Season 1, Week 4
because `assistant-coach-hire` remained in the inbox. Treat that exact failure as
the pre-existing comparison point, not as approval of the event-weight change.

Baseline commands:

```bash
npx jest src/game/__tests__/squad.test.ts src/game/__tests__/contract-promises.test.ts
npx jest src/application/__tests__/market-view-model.test.ts src/application/__tests__/market-source-adapter.test.ts
npx jest src/application/__tests__/m4-event-balance.test.ts
npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts
```

## Step 1 — Make visible 999 the paid-training ceiling

### Production changes

- [ ] In `src/game/training.ts`, replace the stored-only tap guard with
      `displayedValue(player, attribute) >= MAX_PLAYER_ATTRIBUTE`.
- [ ] Keep the stored-value clamp inside growth. Do not change drill costs,
      gains, modifier math, SUPER odds, injury odds, or RNG streams.
- [ ] Update the hidden-growth comments in `src/game/training.ts` and
      `src/application/displayed-attributes.ts` to name visible 999 as the paid
      drill boundary.
- [ ] In `src/application/view-models.ts`, set `atSafetyCeiling` from the visible
      `currentValue` and set row `gain` to `preview.baseAfter - currentValue`.
- [ ] In `src/ui/TrainingDrillModal.tsx`, render `MAX` instead of `+0` for a
      maxed row and use one localized maximum-state accessibility hint.
- [ ] Keep the base line and signed `trainingAdjustment`. Add one exact ordinary
      result line for the next drill before confirmation.
- [ ] Derive visible headroom and limit the repeat picker to
      `ceil(headroom / max(1, nextOrdinaryGain))`.
- [ ] Clamp `ordinaryBatchEstimate` to visible headroom and calculate the shown
      batch TP from the limited repeat count.
- [ ] Keep early SUPER and injury stops fail-soft. Only completed drills spend TP.
- [ ] Stop the watched repeat loop when `activeResult.displayedAfter` reaches 999.
- [ ] Prevent dismiss-to-skip from submitting the remaining batch after 999.
- [ ] In `src/application/store.ts`, stop a skipped batch after the completed
      resolution that reaches visible 999.
- [ ] In `src/audit/__tests__/keeper-display-drift-rail.test.ts`, stop the tap
      loop at visible 999. Keep the existing drift bound.

### Tests

- [ ] Add one engine regression proving a blocked maxed keeper spends no TP and
      changes no condition, nonce, promise debt, or player state.
- [ ] Invert the old stored-ceiling assertion in
      `src/application/__tests__/keeper-display-parity.test.ts` intentionally.
- [ ] Pin displayed 998 to a clamped `+1` base preview and exact ordinary result.
- [ ] Pin near-cap repeat count, ordinary estimate, and maximum quoted TP.
- [ ] Pin watched and skipped batches so completed drills survive and no extra
      drill starts after visible 999.
- [ ] Update source-level UI tests for `MAX`, the maximum hint, and the exact
      ordinary confirmation line.

Focused command:

```bash
npx jest src/game/__tests__/instant-training.test.ts src/game/__tests__/keeper-display-bonus.test.ts src/application/__tests__/keeper-display-parity.test.ts src/application/__tests__/training-stat-options.test.ts src/ui/__tests__/training-progress-render.test.ts src/audit/__tests__/keeper-display-drift-rail.test.ts src/application/__tests__/store.test.ts
```

## Step 2 — Extend the Hero Cup opponent floor through the Round of 16

### Production changes

- [ ] In `src/game/pyramid.ts`, extract only the protected-user opponent swap
      from `roundOf32PairingOrder`.
- [ ] Keep the existing Round-of-32 D1-vs-D5 avoidance pass unchanged.
- [ ] Apply the protected-user swap after Round-of-32 ordering.
- [ ] Apply the same swap after Round-of-16 `highLowPairingOrder`.
- [ ] Use explicit `round === 2` and `round === 3` branches. Keep rounds 4-6 on
      plain `highLowPairingOrder`.
- [ ] Run the swap only for a D1 or D2 user club.
- [ ] Prefer the weakest surviving D1-D3 opponent, then current paired order.
- [ ] Reject a candidate swap that would create a D1-vs-D5 fixture elsewhere.
- [ ] If no safe D1-D3 candidate survives, keep the base pairing.
- [ ] Perform at most one opponent-slot swap. Keep entrant count and RNG calls
      unchanged.

### Tests and canon

- [ ] Extend `src/game/__tests__/pyramid.test.ts` with forced D1 and D2 survivors
      through both relevant rounds.
- [ ] Assert D1-D3 opponent availability, entrant uniqueness, deterministic
      replay, valid home/away clubs, and unchanged D3-D5 behavior.
- [ ] Keep the existing Round-of-32 D5-vs-D2 rail green.
- [ ] Run that rail with protected D1 and D2 user IDs.
- [ ] Pin quarter-final, semi-final, and final pairing as unchanged.
- [ ] Update `docs/02-core-loop.md` with the D1/D2 floor in the Round of 32 and
      Round of 16.

Focused command:

```bash
npx jest src/game/__tests__/pyramid.test.ts src/game/__tests__/cup-match-flow.test.ts src/game/__tests__/cup-giant-killing.test.ts
```

## Step 3 — Explain the transfer-request result of a gift

### Production changes

- [ ] Export `transferRequestWithdrawalMorale(personality)` beside
      `shouldWithdrawTransferRequest` in `src/game/pyramid.ts`.
- [ ] Make `shouldWithdrawTransferRequest` reuse that helper.
- [ ] Add this optional discriminated result to `PlayerGiftResult`:

```ts
transferRequestOutcome?:
  | { status: 'WITHDRAWN' }
  | { status: 'STILL_ACTIVE'; moraleTarget: number };
```

- [ ] Populate it in `src/game/player-gifts.ts` only when the player had an
      active request before the gift.
- [ ] Carry the result through `src/application/store.ts` without changing the
      save-before-celebration gate.
- [ ] Add the same field to `PlayerGiftCelebrationViewModel` in `src/ui/models.ts`.
- [ ] In `src/ui/PlayerGiftCelebration.tsx`, build one localized status string
      and reuse it for final-beat visible copy, the control label, and the live
      accessibility announcement.
- [ ] Extend `src/ui/dev-harness/entries/player-gift.tsx` with production-backed
      withdrawn and still-active cases.

### Tests

- [ ] Pin no prior request, exact threshold, below threshold, and above threshold.
- [ ] Pin Greedy 25 to 45 as still active with target 50.
- [ ] Pin Fiery reaching 45 as withdrawn.
- [ ] Prove the store publishes the outcome only after the career save succeeds.
- [ ] Prove visible and accessibility copy use the same outcome.

Focused command:

```bash
npx jest src/game/__tests__/player-gifts.test.ts src/game/__tests__/pyramid.test.ts src/application/__tests__/player-gift-store.test.ts src/ui/__tests__/player-gift-celebration.test.ts
```

## Step 4 — Derive unique active-squad shirt numbers

### Production changes

- [ ] Add one local pure helper in `src/application/view-models.ts`.
- [ ] Build player order from Starting XI slots, then the unsorted
      `rosterForClub(state, state.userClubId)` result.
- [ ] Reserve all persisted `shirtNumber` values first.
- [ ] Give unassigned starters their unused slot number when possible.
- [ ] Give unassigned bench players their unused active-squad position when
      possible, then the lowest unused positive number.
- [ ] Build the map once in `matchDayViewModel` and once in
      `squadTrainingViewModel`. Both calls use the same unsorted roster and
      lineup IDs, never `orderedRoster` or a UI sort. Key it by player ID.
- [ ] Make `SquadPlayerViewModel.shirtNumber` required and use the map for every
      Squad row, starter, and bench player.
- [ ] In `src/ui/screens/SquadTrainingScreen.tsx`, show a number even when the
      player is not captain and has no visible promise label.
- [ ] Keep `src/game/contract-promises.ts` and the save codec unchanged.

### Tests

- [ ] Test through the public Matchday and Squad view models. Do not export the
      helper for tests.
- [ ] Pin a promised number 10, fallback number-10 collision, promised bench
      holder, lineup swap, duplicate names, and input-state immutability.
- [ ] Assert every active-squad number exists and is unique.
- [ ] Assert Matchday and Squad return the same number for each player ID from
      the same state, including a career with an onboarding-created player.

Focused command:

```bash
npx jest src/application/__tests__/management-injury-lineup-view-models.test.ts src/application/__tests__/name-copy-translates.test.ts src/ui/__tests__/info-tips-and-team-sheet.test.ts
```

## Step 5 — Cool down the repeatable story and prefer unseen stories

### Production changes

- [ ] In `src/application/event-selection.ts`, find the latest matching history
      season for each repeatable random-deck candidate.
- [ ] Allow it when no history exists or
      `state.season - latestResolvedSeason >= 2`.
- [ ] Double the rarity weight only when `resolvedEventHistory` exists and the
      candidate has no matching entry.
- [ ] On a history-less save, give a repeatable candidate normal weight and no
      cooldown until a post-update resolution creates history.
- [ ] Keep candidate ID order, both current roll calls, and their stream names.
- [ ] Do not change guaranteed, milestone, recognition, or follow-up lanes.
- [ ] Do not add content fields, counters, save fields, or reset logic.

### Tests and measurement

- [ ] Pin same-season and next-season rejection, second-season eligibility,
      multiple history rows, missing history, unseen double weight, and no
      candidates.
- [ ] Build cooldown fixtures like production: history contains the repeatable
      event while `resolvedEventIds` omits it. Replace the old resolved-ID-only
      re-offer test so it cannot certify the cooldown.
- [ ] Keep the cross-engine ordering test green.
- [ ] Update `docs/07-events.md` with the cooldown and unseen weight rule.
- [ ] Re-run `src/application/__tests__/m4-event-balance.test.ts` and compare it
      with the baseline result.
- [ ] Re-run the default one-seed long-career probe and compare its story flow
      with the baseline. Do not claim a new statistical balance threshold.

Focused command:

```bash
npx jest src/application/__tests__/event-selection.test.ts src/application/__tests__/m4-event-balance.test.ts
npm run test:probe -- src/audit/__tests__/club-business-long-career-probe.test.ts
```

## Step 6 — Use the canonical exact growth grade across market surfaces

### Production changes

- [ ] Add `potentialGrade` to adapter-produced `ScoutedPlayerIdentitySource` in
      `src/application/market-view-model.ts`.
- [ ] Populate it with `playerGrowthGrade(player)` in
      `src/application/market-source-adapter.ts`.
- [ ] Keep `potentialGrade` beside `potentialRange` on scouted BUY listings.
- [ ] Let `scoutPotentialLabel` accept an optional growth grade.
- [ ] Use the grade only when `minimum === maximum`. Broad reports remain ranges.
- [ ] Pass the identity grade to exact Scout Reports and the listing grade to
      exact Deals rows.
- [ ] Fail tests if an adapter-produced known exact report or listing reaches
      the raw-grade fallback.
- [ ] Keep raw potential as the SUPER percentage input.

### Tests

- [ ] Replace the current test that expects scouted BUY listings to drop the
      grade.
- [ ] Pin exact Scout Report equals the linked BUY listing before signing.
- [ ] Pin the same player equals Squad after signing without advancing a week.
- [ ] Pin broad reports, valuation, SUPER chance, and sort order as unchanged.

Focused command:

```bash
npx jest src/application/__tests__/market-source-adapter.test.ts src/application/__tests__/market-view-model.test.ts src/application/__tests__/archetype-cap-view-model.test.ts src/ui/__tests__/squad-potential-labels.test.ts
```

## Step 7 — Complete copy, proof-only findings, and runtime review

- [ ] Add only the new training and gift keys to all seven
      `content/i18n/*.json` catalogs.
- [ ] Keep raw interpolation values in store and game layers.
- [ ] Re-run Finding 4 Hero License repair tests unchanged.
- [ ] Re-run Finding 8 Starter promise tests unchanged.
- [ ] Review the Training modal at displayed 998 and 999.
- [ ] Review both gift transfer-request outcomes.
- [ ] Review Matchday and Squad with a promised number 10 outside slot 10.
- [ ] Review exact Scout, linked Deals, and Squad grades for one player.
- [ ] Capture quiet background-browser screenshots for the changed UI surfaces.
- [ ] Destroy the page, close the test tab, stop only the server started for the
      review, and run the project listener audit.

## Quality Gates

Run the focused commands in each step first. Then run:

```bash
npx jest src/game/__tests__/squad.test.ts src/game/__tests__/contract-promises.test.ts
npx jest src/application/__tests__/name-copy-translates.test.ts src/application/__tests__/training-copy-translates.test.ts src/i18n/__tests__/catalog.test.ts src/i18n/__tests__/gates.test.ts
npx jest src/audit/__tests__/training-leverage-rails.test.ts
npx tsc --noEmit
npm run format:check
```

Run the repository test suite without excluded probe suites before the commit.
Do not run large multi-seed soak jobs unless a focused balance gate fails.

## Implementation Result

Implementation completed on 2026-08-25.

- Both Council Audit rounds used only Claude Opus 5 and Grok 4.6 at `xhigh`.
- The six production fixes landed without a dependency, save migration, or
  `ENGINE_VERSION` change.
- Findings 4 and 8 remained proof-only and their existing regressions passed.
- Grok 4.6 completed a 36-turn `xhigh` review and found two training edge cases.
  Both were confirmed, fixed, and protected by focused tests.
- The full Jest gate passed 515 suites and 4,923 tests. One configured test and
  one suite remained skipped.
- TypeScript, Prettier, and `git diff --check` passed after the Grok fixes.
- Quiet browser proof covered both gift outcomes and active-squad shirt numbers.
  Exact training-boundary and cross-surface grade behavior are covered by the
  focused view-model and source regressions.
- The optional long-career probe reproduced its baseline Season 1, Week 4
  `assistant-coach-hire` inbox failure in both modes. No new probe failure
  appeared.

## Acceptance Criteria

- [x] A displayed-999 player cannot start or continue a paid drill.
- [x] A maxed drill says `MAX`, not `+0`.
- [x] A near-cap confirmation states the exact ordinary visible result.
- [x] D1 and D2 users receive a D1-D3 Cup opponent in R32 and R16 when one
      survives.
- [x] Gift feedback says `WITHDRAWN` or `STILL_ACTIVE` with the exact target.
- [x] Hero License lineup repair still keeps the strongest legal natural-role
      replacement and restores the original hero when legal.
- [x] Every active-squad shirt number is present and unique; promised 10 keeps 10.
- [x] The repeatable story cannot return until the second season after resolution.
- [x] Unseen random-deck stories have double their normal rarity weight.
- [x] Exact Scout, linked Deals, and Squad grades agree for the same state.
- [x] Illegal Starter promises remain disabled with their exact localized reason.
- [x] No save migration, dependency, or `ENGINE_VERSION` change exists.
- [x] All focused tests, measured rails, TypeScript, and format checks pass.

## Risks and Controls

- Visible-999 keeper training changes progression intentionally. The parity test
  and always-on drift rail must document the new boundary.
- Cup pairing changes deterministic fixtures. Tests must prove one copy of every
  survivor and stable output for identical input.
- Gift outcome data is transient. The existing save-before-celebration check must
  stay intact.
- Derived shirt numbers must follow saved roster order, not the current UI sort.
- Event weight changes move deterministic selections. Keep the same streams and
  compare measured event-rate checks before and after.
- Exact growth grades are presentation only. Raw potential still controls SUPER.

## References

- Master spec:
  `docs/superpowers/specs/2026-08-24-eight-ptbr-career-findings-master-spec.md`
- Keeper parity decision being superseded:
  `docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md:402-460`
- Current Gift flow and save ordering:
  `docs/superpowers/plans/2026-08-23-player-gifting.md:56-119`
- Cup playtest rule:
  `docs/superpowers/plans/2026-08-14-optimal-career-playtest-handoff.md:358-369`
- Cross-season cooldown lesson:
  `docs/superpowers/specs/2026-08-01-player-requests-design.md:147-168`
- Event measurement gate:
  `docs/superpowers/specs/2026-08-07-targeted-story-interruptions.md:377-395`
