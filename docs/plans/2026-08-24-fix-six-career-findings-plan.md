---
title: Fix Six Full-Career Findings
type: fix
date: 2026-08-24
status: delivery-pending
source_spec: docs/superpowers/specs/2026-08-24-six-career-findings-master-spec.md
branch: codex/fix-six-career-findings
---

# Fix Six Full-Career Findings

## Outcome

Fix the six player-facing findings from the Spanish full-career run:

1. Same-name players remain distinct and clear on every action surface.
2. Automatic lineup changes keep legal starters and choose replacements correctly.
3. Completed scout reports offer **Sign the player** and focus the exact Deals row.
4. Contract wage controls prove the existing stable 5% step.
5. Story of the Year ranks an unbeaten league-and-Cup double above routine events.
6. Resolved transfer requests disappear from the assistant inbox.

The reviewed master spec is authoritative. This plan turns it into bounded code and test steps.

## Scope guards

- Use immutable player IDs for every state change.
- Keep names as display text.
- Reuse existing lineup repair, return-slot, Market section, and inbox projection paths.
- Do not add a new identity service, lineup engine, season-story save field, or inbox lifecycle.
- Do not change player generation, economy balance, match simulation, RNG use, or `ENGINE_VERSION`.
- Do not run balance, soak, or replay rails.
- Do not include the unrelated `codex/request-downsides-cup-prize` commits.
- Keep Fable out of every Council run. The user authorized Grok 4.6 high and Opus 5 xhigh only.

## Existing patterns to reuse

- Hero License identity: `src/game/progression.ts`, `src/game/squad.ts`, and `src/application/store.ts` already use player IDs.
- Save identity: `src/persistence/game-state-codec.ts` already validates unique player IDs.
- Return behavior: `CareerPlayer.returnLineupSlot` is the persisted home-slot claim for injury and granted leave.
- Promise repair: `restoreCareerContractPromiseLineup` owns Starter and Captaincy restoration.
- Market navigation: `MarketScreen` already owns section state, scroll geometry, and guide focus.
- Scout-to-Deals identity: every completed report already maps to one BUY listing by player ID.
- Wage steps: `contractWageStep` and `marketNegotiationViewModel` already use the immutable opening ask.
- Transfer inbox: `homeProductAlerts` derives rows from the live roster and current `transferRequested`.
- Localization: game code emits facts; application and UI layers translate at the edge.

## Step 0 — Pre-implementation gates

- [x] Run the focused green baseline for squad, store, market, season recap, gifts, renewal, and inbox behavior (10 suites, 230 tests).
- [x] Run Council Audit on this plan with Grok 4.6 high and Opus 5 xhigh.
- [x] Verify every Council claim against current source.
- [x] Update this plan for confirmed findings only.
- [x] Mark the Council gate complete before changing product code.

Expected baseline command:

```sh
npx jest   src/game/__tests__/progression.test.ts   src/game/__tests__/squad.test.ts   src/game/__tests__/post-match-awakening.test.ts   src/game/__tests__/market.test.ts   src/game/__tests__/player-gifts.test.ts   src/game/__tests__/renewal-negotiation-repair.test.ts   src/application/__tests__/store.test.ts   src/application/__tests__/market-view-model.test.ts   src/application/__tests__/management-injury-lineup-view-models.test.ts   src/application/__tests__/default-career-journey.test.ts   --runInBand
```

### Council disposition

Grok 4.6 high and Opus 5 xhigh reviewed the sealed plan before product code
changed. Fable was not called.

- Accepted: define eligible lineup pools and validate after claim restoration.
- Accepted: retain an injury claim while a powered player remains unlicensed.
- Accepted: test promise restoration after formation changes.
- Accepted: wait for the Deals row layout and handle a missing BUY row without navigation.
- Accepted: copy every Story rank predicate into the plan.
- Accepted: record commit `2fcaecbb0` as the 5% wage-step authority before fixing the stale 1% document.
- Rejected: translate `GK`/`DEF`/`MID`/`FWD`. Current source and its translation test deliberately render these canonical role codes unchanged in every locale.
- Rejected: add duplicate labels to unrelated gifts, injuries, and recaps. The master spec bounds action surfaces, and the production lookup audit found no name-keyed player mutation.
- Rejected: add a second promise owner. `arrangeCareerLineupForFormation` already runs `restoreCareerContractPromiseLineup` and `buildCareerTeamDef` after arrangement.

## Step 1 — Prove ID-safe duplicate handling

### Files

- `src/application/view-models.ts`
- `src/application/market-view-model.ts`
- The smallest existing market/squad model type file only if a label field is required.
- `src/application/__tests__/store.test.ts`
- Focused view-model and codec tests.

### Work

- [x] Add the Cal Moss regression before production changes.
- [x] Create two user-club players with the same name and distinct IDs.
- [x] Prove Hero License toggles, powers, promises, lineup membership, and save round-trip remain ID-specific.
- [x] Re-run the production lookup audit. Replace a name-keyed mutation only if the test or trace finds one.
- [x] Add one application-layer display-label helper in `src/application/name-copy.ts`.
- [x] Keep unique names unchanged.
- [x] For duplicates, add canonical `GK`/`DEF`/`MID`/`FWD`, then shirt number, then the shortest unique player-ID prefix of at least four characters.
- [x] Use the helper on match-day lineup and bench, Hero License, contract-license reclaim, scout-report, and Deals actions where visible players collide.
- [x] Do not mutate or persist `player.name`.
- [x] Confirm the missing display disambiguation on the `cebf07e4` base. This was current-source behavior, not a stale build.

### Checks

- Same-name players change independently by ID.
- Same-name and same-role fallbacks remain guaranteed distinct.
- Accessibility labels use the same disambiguated visible label.
- Existing saves load without migration.

## Step 2 — Correct automatic lineup and Hero License return

### Files

- `src/game/squad.ts`
- `src/game/post-match-awakening.ts`
- `src/game/__tests__/squad.test.ts`
- `src/game/__tests__/post-match-awakening.test.ts`
- `src/game/__tests__/contract-promises.test.ts`
- `src/application/__tests__/store.test.ts`

### Work

- [x] Add failing tests for the reported bad swaps and relicensing flow.
- [x] In formation retention, rank surplus legal starters by promise, conditioned natural-role rating, licensed exact-tie, existing slot, then player ID.
- [x] Fill an empty slot from its matching natural-role pool first.
- [x] Define each pool as currently unused, available, legal players only.
- [x] Use an out-of-role outfielder only when that slot's natural-role pool is empty.
- [x] Never use a goalkeeper as outfield fallback or an outfielder in goal.
- [x] In narrow repair, rank by natural role, conditioned slot rating, licensed exact-tie, then player ID.
- [x] Keep `restoreCareerContractPromiseLineup` as the promise owner after repair.
- [x] When a fit starting hero loses a license through manual selection or awakening, record the existing slot only when no home-slot claim exists.
- [x] Do not write, overwrite, or clear the claim during a Hero License action while the player is injured or away.
- [x] On relicensing, restore the valid claim after ordinary repair and promise restoration.
- [x] Refuse displacement of a protected promise holder and retain the valid claim.
- [x] Clear the claim only after successful return, invalid formation-role mapping, or roster departure.
- [x] Consume a claim only when its player is available and, when powered, licensed; a refused legal claim survives.
- [x] Route awakening benching through the same non-relief repair comparator and return-claim behavior.
- [x] Keep negotiated contract-license reclaim as the existing signed slot exchange; it must not create a return claim.
- [x] When promised players overfill one role, keep the existing priority: earliest `agreedSeason`, then lowest player ID.
- [x] Run promise restoration after formation arrangement, then validate the final composed XI with the promise assertion and `buildCareerTeamDef`.
- [x] Keep the existing guarded `formationCannotBeFilled` failure and unchanged lineup.

### Checks

- Legal starters stay.
- The lowest conditioned unprotected surplus starter leaves first.
- A forward cannot start in defence while a defender is available.
- Relicensing restores the legal former starter without a manual swap.
- Injury and leave claims survive license toggles.
- An unlicensed hero recovering from injury stays benched and keeps the claim until relicensed.
- Protected promises stay honored.
- Formation changes still honor required promises.
- A later awakening creates the same valid return claim, then relicensing restores the player.
- A negotiated license reclaim does not create a return claim.
- Same-role promise overcommit honors `agreedSeason`, then player ID.
- Same state gives the same ordered IDs.

## Step 3 — Add **Sign the player**

### Files

- `src/ui/screens/MarketScreen.tsx`
- `content/i18n/en.json`
- `content/i18n/de.json`
- `content/i18n/es.json`
- `content/i18n/fr.json`
- `content/i18n/id.json`
- `content/i18n/pt-BR.json`
- `content/i18n/vi.json`
- One focused Market UI contract test.

### Work

- [x] Add `market.signThePlayer`, `market.a11y.signPlayerFromReport`, and `market.scoutedPlayerUnavailable` to every locale.
- [x] Render **Sign the player** before **Dismiss report** on ranged and exact reports.
- [x] Stop report-card propagation in the button handler.
- [x] Keep `onSignPlayer(playerId)` internal to `MarketScreen`.
- [x] Store one local `focusedScoutedPlayerId` and switch to `TRANSFERS`.
- [x] Find the BUY row by exact player ID.
- [x] Before switching sections, keep Scout open and announce the localized unavailable message if no exact BUY row exists.
- [x] Reuse the screen's measurement and `scrollTo` pattern on the matching row's first layout pass.
- [x] Highlight with a non-color border and `accessibilityState={{ selected: true }}`.
- [x] After scrolling, move accessibility focus to the row or announce its disambiguated label.
- [x] Animate only when reduced motion is off; keep a static highlight when it is on.
- [x] When the window is closed, still focus the exact disabled BUY row without starting talks.
- [x] Do not call `onTransferAction`, spend money, or open talks.
- [x] Clear focus after a transfer action, missing listing, later manual section change, or screen unmount.

### Checks

- Same-name scout targets focus the correct ID.
- The internal switch keeps focus.
- A later manual section change clears focus.
- Screen-reader users receive focus or an announcement after the scroll.
- A closed window shows the exact disabled row and does not bypass the transfer rule.
- A missing listing keeps Scout open and announces the localized error.
- Long locale labels wrap with the existing minimum touch height.

## Step 4 — Prove the 5% wage step

### Files

- `src/game/__tests__/market.test.ts`
- `src/application/__tests__/market-view-model.test.ts`
- The smallest existing Market UI source-contract test.
- `docs/06-economy.md`

### Work

- [x] Add or keep `$10,000 -> $500` and low-ask `$50` helper tests.
- [x] Prove plus and minus controls use `viewModel.wageStep`.
- [x] Prove the step remains stable after a counter round because `weeklyAsk` is immutable.
- [x] Make no production arithmetic change when those tests pass.
- [x] Correct the stale canonical economy text from 1% to 5%.
- [x] Record that accepted recovery commit `2fcaecbb0` explicitly made 5% authoritative and left `docs/06-economy.md` stale.
- [x] Confirm the `cebf07e4` base already uses 5%; the fixed-$50 playtest build was stale.

## Step 5 — Rank Story of the Year

### Files

- `src/application/view-models.ts`
- `src/application/__tests__/default-career-journey.test.ts`
- All seven locale catalogs.

### Work

- [x] Add one private pure story selector beside `seasonEndViewModel`.
- [x] Derive it from existing recap facts only.
- [x] Rank: unbeaten double, double, perfect league title, unbeaten league title, league title, Cup win, promotion, authored event, none.
- [x] Define unbeaten double as played, no loss, first place, and Cup winner.
- [x] Define double as first place and Cup winner.
- [x] Define perfect league title as played, won equals played, no draws, no losses, and first place.
- [x] Define unbeaten league title as played, no losses, and first place.
- [x] Define Cup-plus-promotion as Cup win because it ranks higher.
- [x] Treat an unbeaten non-champion Cup winner as Cup winner or promotion, never a double.
- [x] Use `cupResultKey === 'recap.cupWinners'`.
- [x] For an old recap with no `cupResultKey`, use the approved authored-English compatibility fallback `cupResult === 'Winners'`; never parse translated display text.
- [x] Add the new headline keys in all seven locales.
- [x] Keep `memorableEventId` unchanged for history.

### Checks

- The reported D1 unbeaten double beats `Lo ha pedido por escrito`.
- Each rank beats every lower rank.
- No title or Cup result is inferred from localized display text.

## Step 6 — Prove transfer-request cleanup

### Files

- `src/application/__tests__/management-injury-lineup-view-models.test.ts`
- `src/game/__tests__/player-gifts.test.ts`
- `src/game/__tests__/renewal-negotiation-repair.test.ts`
- `src/game/__tests__/assistant-guide.test.ts`
- Production state transition only if a regression fails.

### Work

- [x] Extend the existing Ty Brooks route-level regression through `homeViewModel`.
- [x] Prove active `transferRequested` creates one row for the exact player ID.
- [x] Prove false flag or roster departure removes it in the same week.
- [x] Prove renewal and qualifying gift routes clear it.
- [x] Prove a non-qualifying gift and ordinary player-request resolution do not clear it.
- [x] Prove weekly delivery flags cannot recreate a resolved row.
- [x] Prove dismissal hides an active row only for the current week and it returns next week.
- [x] Prove two same-name players keep independent request rows by ID.
- [x] Do not add OPEN, RESOLVED, or ARCHIVED inbox state.
- [x] Change production only after the scheduler regression proved dismissed live rows were not filtered.

## Step 7 — Reconcile reviewed documents

### Files

- `docs/superpowers/specs/2026-08-22-automatic-lineup-selection.md`
- `docs/plans/2026-08-21-fix-hero-license-state-and-lineup-plan.md`
- `docs/06-economy.md`
- This plan and the master spec.

### Work

- [x] Mark the older full-XI rebuild rule as superseded by starter-preserving formation selection.
- [x] Mark the older “relicensing stays benched” rule as superseded by valid home-slot restoration.
- [x] Keep unrelated accepted Hero License and contract-handoff rules unchanged.
- [x] Check off each completed implementation task in this plan.

## Step 8 — Verification and runtime QA

### Automated

- [x] Run every changed focused Jest suite.
- [x] Run locale parity, placeholder, prose, and glyph checks.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run format:check`.
- [x] Do not claim lint; this repository has no lint script.
- [x] Do not run balance, soak, or replay rails.

### Runtime

- [x] Use production application and game harnesses with explicit duplicate player IDs.
- [x] Verify independent Hero License toggles and clear duplicate labels in the production store harness.
- [x] Verify formation preservation and automatic relicensing return in the production game harness.
- [x] Verify **Sign the player** opens Deals and highlights the exact player in headless Chromium.
- [x] Verify a `$10,000` ask moves by `$500` in the production Market harness.
- [x] Verify the unbeaten-double headline in the production season-end harness.
- [x] Verify a resolved transfer request disappears without advancing a week in the production home-view harness.
- [x] Capture before/after evidence for the changed Market UI without audio or foreground focus.
- [x] Record the tested base SHA, surface, viewport, and build provenance below.
- [x] Destroy the page, stop only the server started for QA, and audit listeners.

Runtime evidence: uncommitted branch diff on base `cebf07e4`; `agent-browser`
0.27.0; headless Chromium; 900×700; `EXPO_PUBLIC_DEV_HARNESS=1`; real
`MarketScreen` and production view model; Chromium launched with `--mute-audio`
and the page guard; zero page errors after the nested-button fix; no listener
remained on QA port 4178. The temporary harness wiring and worktree symlinks
were removed. Evidence:
`docs/superpowers/specs/2026-08-24-market-scout-report-cta.png` and
`docs/superpowers/specs/2026-08-24-market-sign-player-focus.png`.

## Step 9 — Final audits and delivery

- [x] Run Grok 4.6 high audit on the complete branch against `origin/main`.
- [x] Verify every Grok claim locally.
- [x] Apply confirmed in-scope fixes.
- [x] Re-run affected checks.
- [x] Review the final diff for unrelated files and secrets.
- [ ] Commit only this plan, both Council spec files, implementation, tests, and reconciled docs.
- [ ] Push `codex/fix-six-career-findings`.
- [ ] Open a PR to `main` with summary, exact checks, Council status, Grok status, and UI evidence.

Grok 4.6 high completed normally. Three findings were confirmed and fixed:

- Match-day duplicate labels now use only real shirt numbers. Missing shirts use the stable ID suffix.
- Formation changes clear a home-slot claim when that slot now belongs to another natural role.
- The Deals row no longer groups its transfer button into an inaccessible parent node. The existing action owns the selected state.

The three affected suites passed: 54 tests. TypeScript and `git diff --check` also passed.

## Risks and guards

- **Stale-build reports:** require a current SHA and reproducible state before changing working behavior.
- **Shared return slot:** never let license actions erase injury or leave claims.
- **Promise conflict:** validate the candidate lineup after promise restoration.
- **Same-name targets:** use IDs for action and labels only for presentation.
- **UI focus:** keep focus local and non-persisted.
- **Old saves:** add no required field and do not rewrite valid player data.
- **Concurrent work:** stay inside the isolated worktree and stage explicit paths.

## Complete when

- [x] All six findings have a verified fix or a proved current-source disposition.
- [x] Every new player action uses immutable IDs.
- [x] All focused tests, TypeScript, formatting, and runtime checks pass.
- [x] Council Audit ran before product implementation.
- [x] Final Grok Audit completed and all confirmed findings were resolved.
- [ ] The branch is pushed and the PR URL is recorded here.
