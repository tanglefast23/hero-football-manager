# Independent verification of `FINDINGS-lead.md`

## Phase 6 follow-up

- The owner approved the F-D14 product decision: every home Cup match earns a separately labelled gate in addition to any same-week home League gate. The rule is implemented with deterministic home/away and double-header cash coverage.
- F-D06 now passes on the final matching Release accessibility tree: a completed Gym plus 1×1 Dorm placement exposes 48/48 buttons, including `Blocked at column 1, row 1`.
- F-D07 now passes on the final matching Release accessibility tree: noninteractive ledger lines expose text semantics with combined label/amount and no disabled-button state.
- F-D08 remains contradicted as a missing-state defect; an explicit informational text role was added as optional semantic polish.
- F-D09–F-D13 were rechecked on the final Release. Guided names, Awakening presentation/content, current-week copy, and separate match-summary elements pass.
- Final installed/built bundle hash: `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e`.
- Synthesized VoiceOver speech remains an optional physical-device spot-check; the iOS Simulator cannot produce it.
- These follow-up dispositions do not rewrite the evidence classifications below; they record what happened after verification.

Date: 2026-07-21
Reviewer: independent static/evidence pass (no Simulator or Computer Use)
Build under test: `124c056e89c17ee16fef13765ca9fe60c101dc03`

## Scope and method

- The current repository `HEAD` is exactly the reported build-under-test commit, so current line evidence and the shipped source are the same revision.
- I read all of `/Users/joemacprom5/Documents/HFM-audit-2026-07-21/FINDINGS-lead.md`, inspected its cited screenshots, checked the relevant current source, and inspected the commit history where intent was material.
- I did not use a Simulator, accessibility dump, physical mouse, or game save. Runtime-only accessibility-role claims are therefore kept separate from behavior that the source and screenshots can prove.
- Focused existing tests passed: `story-recruitment-progression.test.ts`, `cup-match-flow.test.ts`, and `career.test.ts` (3 suites, 34 tests).
- No source or game state was changed by this pass.

## Executive result

The audit is mostly sound. Ten numbered claims are confirmed from the supplied evidence plus the shipped source: **F-D01–F-D05 and F-D09–F-D13**. Two runtime-role claims, **F-D06 and F-D07**, are credible but conflict with the JSX and need lead-device VoiceOver reproduction before changing code. **F-D08** overstates a harmless informational element as a state-announcement failure. **F-D14** correctly noticed that a home Cup tie adds no separate gate receipt, but the current code clearly implements that behavior and the product documents do not decide whether it should change; it should not be fixed as a bug without an owner decision.

Both carried claims hold:

1. The Week-one brief says “Sixteen hopefuls. One empty shirt,” while the story career deliberately starts at **15/17** after the created player signs.
2. The README says the current replay engine is `m1.10`; shipped code is `m1.11`.

## Claim-by-claim classification

| ID | Classification | Independent finding | Root cause and proposed fix assessment | Lead-audit overlap |
|---|---|---|---|---|
| F-D01 | **CONFIRMED FROM STATIC/EVIDENCE** | With an active project, `affordable` becomes false while `affordabilityShortfall` remains 0. The accessibility label consequently says “Need $0 more,” while the visual path suppresses that message. | Root cause is correct: `src/application/view-models.ts:321-343` and `src/ui/screens/ClubFinancesScreen.tsx:826-893`. Smallest safe fix is not merely a shortfall guard: compose the label from `blockedReason` and add “Need …” only when `affordabilityShortfall > 0`. This preserves the truthful crew-busy reason. | New accessibility defect; the lead audit already proved the visual busy state works. |
| F-D02 | **CONFIRMED FROM STATIC/EVIDENCE** | `R-09-toast-45s.png` shows the success notice covering the Money/TP/settings header. The render path has no timer; notices clear only through `clearNotice`. | Root cause is correct: `App.tsx:1247-1254`, `App.tsx:1475-1503`, and `src/application/store.ts:1232-1241`. Add a cleanup-safe timer for `info`/`success` only (about four seconds); keep errors sticky. Moving it below the HUD is a useful additional layout defense, not required to fix persistence. | New. The toast is visible in lead screenshots but was not filed there. |
| F-D03 | **CONFIRMED FROM STATIC/EVIDENCE** | The label always appends `“. Tap to dismiss.”` at `App.tsx:1494`. All built-in notices inspected already end in punctuation, so they produce the observed doubled stop. | Fix suggestion is correct but the title “every toast” is slightly too broad because the public `notify(message)` path accepts arbitrary text. Normalize the trimmed message: append a stop only when it does not already end in `.`, `!`, or `?`, then append ` Tap to dismiss.` | New; naturally shares a fix/test with F-D02. |
| F-D04 | **CONFIRMED FROM STATIC/EVIDENCE** | The visible `LET THEM BUILD` button is named “Close construction confirmation” in `src/ui/FacilityProjectNotice.tsx:70-74`; the visible label is absent from its accessible name. | The proposed construction fix is correct: begin the name with “Let them build,” then add the purpose. The ranked dossier overreaches when it says Quick Result is the same: `src/ui/screens/FixtureMatchDayScreen.tsx:246-249` names it “Simulate this match with quick result,” which **does contain** the visible label. “Watch match” and “Save weekly plan” do have similar static mismatches at `FixtureMatchDayScreen.tsx:255-259` and `SquadTrainingScreen.tsx:576-581`, but those extra cases were not device-reproduced. | New. |
| F-D05 | **CONFIRMED FROM STATIC/EVIDENCE** | The build-card visual contains footprint and duration at `ClubFinancesScreen.tsx:863-868`, while the accessibility label at `:828-832` omits both. | Root cause and fix direction are correct. Include natural speech such as “2 by 2 footprint. Builds in 3 weeks,” plus cost, upkeep, adjacency clue, and the actual blocker. Test the final composed label rather than only view-model booleans. | New. |
| F-D06 | **PLAUSIBLE BUT NEEDS LEAD-DEVICE REPRO** | The report says 8 of 48 cells expose non-button roles. However every cell uses the identical `Pressable` and `accessibilityRole={placementActive ? 'button' : 'none'}` at `ClubFinancesScreen.tsx:489-533`; there is no per-cell branch that explains the eight coordinates. | No verified source root cause exists. Do not change the grid until the lead reproduces with actual VoiceOver focus/announcement on the listed cells and a known-good cell. The dossier’s later addition that “all drill controls” have this problem is a separate, unsupported expansion. If confirmed, investigate native accessibility flattening/layout rather than conditionally patching coordinates. | New, and not safely actionable yet. |
| F-D07 | **PLAUSIBLE BUT NEEDS LEAD-DEVICE REPRO** | The runtime report says ledger rows are disabled Buttons, but source explicitly sets role `text` when no callback exists at `ClubFinancesScreen.tsx:291-311`; `App.tsx:1042-1065` does not pass `onOpenLedgerLine`. | The likely problem is using a disabled `Pressable` for noninteractive rows despite asking for a text role. Reproduce first. If confirmed, render a plain accessible `View`/text row when no handler exists and a `Pressable` only when the row is actionable. | New. |
| F-D08 | **CONTRADICTED** | The element is informational, not a control, and its accessible name already includes the state: `accessibilityLabel={\`Career difficulty ${difficultyLabel}\`}` at `src/ui/SettingsOverlay.tsx:219-224`. “Value is none” does not mean Cozy is unannounced; Cozy is in the name. The reported native “Image” role may be a semantic oddity, but the claimed missing state is contradicted by the shipped name. | Do not file as a state-announcement defect. If VoiceOver really says “image,” setting `accessibilityRole="text"` would be a small semantic polish, but it does not block or hide the current difficulty. | New, but should not enter Phase 5 as a defect. |
| F-D09 | **CONFIRMED FROM STATIC/EVIDENCE** | `R-17-home-cue-check.png` visibly shows the cue. The cue is a child of a tab `Pressable` that already owns the accessible name (`ManagementShell.tsx:239-257`), while the cue is itself marked accessible (`TutorialTapCue.tsx:54-60`). The parent control will group/swallow child content on iOS. | The corrected root cause is substantially right. Fold the guide instruction into the parent name, e.g. “Squad tab. Bert says: open Squad.” The player-impact sentence overstates “cannot progress”: the available “Squad tab” is still announced and tappable, so an exploring user can progress, but the required tutorial instruction is missing and the primary Advance action remains disabled until they discover it. Keep the accessibility severity high without calling it a hard technical lock. | Related to lead row `P3-GUIDE-01`, but that row concerns dismissal/drag and is NOT VERIFIED; this accessible-name defect is additional. |
| F-D10 | **CONFIRMED FROM STATIC/EVIDENCE** | `R-00-current-state.png`, `R-14-three-assigned.png`, and `R-16-circuit-added.png` show the guide card obscuring ledger/table/plan information. It is absolute with `zIndex: 40` at `TutorialTapCue.tsx:83-88`. | The visual occlusion is real. The assertion that the cue itself caused taps to miss is not supported: it has `pointerEvents="none"` at `TutorialTapCue.tsx:59`, so it cannot intercept touches. A safe fix needs per-target placement/reserved space or measured collision avoidance; a blanket pointer-events change is neither relevant nor safe. | New visual defect. The lead audit encountered the guide but did not file its placement. |
| F-D11 | **CONFIRMED FROM STATIC/EVIDENCE** | Both screenshots show “THIS WEEK” paired with disabled “ADVANCE TO FIXTURE WEEK.” The source unconditionally uses that future-tense copy whenever `matchdayReady` is false at `src/ui/screens/ClubHomeScreen.tsx:67-96`. | The defect is copy/state parity, not that the disabled card must directly start the match. The current loop intentionally uses the bottom Advance Week action to enter Match Day. Smallest safe wording: visible “USE ADVANCE WEEK BELOW”; accessible “This week’s fixture is X versus Y. Use Advance Week below to prepare Match Day.” Do not enable a second transition path as part of this fix. | New, though the lead audit already exercised the surrounding Home/match-day loop. |
| F-D12 | **CONFIRMED FROM STATIC/EVIDENCE** | This combines two real defects. Accessibility: beat 3 is one button named only “Continue after the hero awakening,” so its grouped child name/power/story/license text is omitted (`AwakeningCutsceneScreen.tsx:338-365`). Visual: `M-09` and `M-10`, plus the lead’s `P3-AWAKENING-REVEAL.png`, show the story text flush to the edges and dark-on-dark after settling. | The accessibility fix is straightforward: the beat-3 accessible name must include player, power, reveal copy, license state, and action. The audit’s visual root cause is wrong: source already specifies `margin: 14`, `padding: 16`, a gold hero background, and dark text at `AwakeningCutsceneScreen.tsx:511-530`. The screenshot shows that the **entire parent Pressable style is missing**, not that padding was never authored; child text styles still apply. This strongly points to the custom `SfxPressable` style-composition boundary (`src/ui/components/SfxPressable.tsx:11-23`). The safest local fix is to put the panel layout/background/border on an inner native `View` or otherwise flatten/verify the wrapper style, then recheck all three beats. | The near-black reveal duplicates confirmed lead defect #4 / `P3-AWAKE-01`; the missing accessibility content is a new facet. |
| F-D13 | **CONFIRMED FROM STATIC/EVIDENCE** | The full-screen outer `Pressable` owns the name “Close match summary” and wraps the entire panel at `src/ui/PostMatchSummaryModal.tsx:45-83`; the rich ledger is nested under it at `:122-179`. This structure explains the reported single opaque element. | Root cause is correct. Split the dismiss backdrop from the modal content: an absolutely positioned, accessibility-hidden backdrop may handle outside taps; the panel should be a plain modal `View` with its explicit X/Continue buttons. Expose each ledger row with a combined label. | New accessibility defect. It does not contradict the lead’s PASS for visible arithmetic/settlement correctness. |
| F-D14 | **NOT A DEFECT/EXPECTED** *(pending product decision)* | Static fact: Cup ties do **not** create gate receipts. `settlementLines` searches only `state.fixtures` for one played home league fixture (`src/game/career.ts:515-536`). Cup fixtures live in the separate M2 cup state, and the Cup path settles the week then adds only a win prize (`career.ts:707-750`, `:920-952`). The focused Cup-flow test passes and asserts the prize, not Cup tickets (`src/game/__tests__/cup-match-flow.test.ts:24-61`). | The observed single $1,200 line is therefore exactly the shipped model: it came from the home league fixture, not the home Cup tie. **Inference, not proof of intent:** this may be a legacy once-per-week economy decision rather than a deliberate Cup exclusion; no canonical doc explicitly says Cup gates are free. Do not patch during acceptance cleanup. Ask the owner whether home Cup ties should produce a second/aggregated gate. If yes, add a balance-reviewed double-header test and make the ledger say which/ how many matches paid. | Same settlement already passed in lead row `P3-WATCH-03`; this is an intent question, not a contradictory arithmetic failure. |

## The two carried claims

### C-01 — stale opening roster count

**Classification: CONFIRMED FROM STATIC/EVIDENCE.**

The production story rule is unambiguous:

- `src/game/story-progression.ts:3` sets `STORY_STARTING_ROSTER_SIZE = 15`.
- Story onboarding trims the user club to 14 before the created player (`src/game/onboarding/story-onboarding.ts:31-61`), then adds that player (`:121-143`) for 15 total.
- The story-specific capacity becomes 17 through the created-player slot (`src/game/youth-intake.ts:49-55`).
- The focused regression proves the intended journey: 15 after creation, 16 after Youth, 17 after the scout signing (`src/application/__tests__/story-recruitment-progression.test.ts:45-65`, `:140-176`).
- Canonical UI doc 08 says the story begins at 15/17 (`docs/08-ui-ux.md:47-55`).

The stale player-facing line is `src/ui/screens/NewGameWelcomeScreen.tsx:148`:

> Sixteen hopefuls. One empty shirt. Zero heroes.

Recommended replacement:

> Fifteen players. Two open shirts. Zero heroes.

This is the only early player-facing stale count found. The nearby “2 empty licenses” is about Hero Licenses, not roster places, and is valid. The full-roster Bert copy in `content/assistant-guide.json:259-270` correctly describes 17/17. `docs/05-players-training-coaches.md:72-75` should eventually clarify that 16 is the base content roster for launch clubs while the story user club is deliberately trimmed to 15/17; it is documentation ambiguity, not a second player-facing defect.

### C-02 — README engine version

**Classification: CONFIRMED FROM STATIC/EVIDENCE.**

- `src/sim/match.ts:14` exports `ENGINE_VERSION = 'm1.11'`.
- `README.md:14` still says `m1.10`.
- The adjacent match comment at `src/sim/match.ts:11-13` also still describes the prior `m1.10` release even though commit `090068e` explicitly bumped the engine to `m1.11`.

This is documentation drift only. Update the README and the nearby comment to `m1.11`; do **not** bump `ENGINE_VERSION` or regenerate replays for a documentation fix.

## Duplication and scope corrections

- **Awakening:** F-D12’s visual darkness/contrast is the same confirmed player-visible defect already in the lead report. Treat it as one defect with two facets: missing panel styling/contrast and missing VoiceOver content. Do not count it twice.
- **Match summary:** the lead report’s PASS covers visible math and persistence. F-D13 is an independent accessibility-structure defect and does not reverse that PASS.
- **Fixture card, toast, tutorial cue:** these are new findings relative to the current lead report. The screenshots already captured them incidentally.
- **F-D04’s expansion:** Quick Result is not another label-in-name failure because its accessible name contains “quick result.” Watch Match and Save Weekly Plan are static candidates for the same cleanup but were not part of the observed construction repro.
- **F-D06’s expansion:** the ranked dossier adds “all drill controls” without supplying the same stable role evidence. Keep it out of the confirmed defect until separately reproduced.
- **F-D10’s tap claim:** the card obscures information, but `pointerEvents="none"` means it cannot itself consume touches.
- **F-D14:** do not combine “one ledger line” and “missing Cup receipts” into a confirmed economy bug. The former is proven; the latter is a product-rule decision.

## Priority order for lead-device reproduction after Phase 4

These are ordered by how much runtime evidence would change the safe fix:

1. **F-D06 grid roles:** compare one reported bad cell and one good cell with VoiceOver, not only an AX dump; verify focus, announced role, and activation. This is the biggest source/evidence conflict.
2. **F-D07 ledger rows:** have VoiceOver focus Weekly Wages and confirm whether it says “dimmed button” despite the requested text role. This decides whether the component must stop using disabled `Pressable`.
3. **F-D09 guided tab:** on fresh Week 1 Home, confirm the Squad tab’s spoken name omits “Open Squad”; after the fix, confirm the instruction is in the parent tab name and the tab still activates once.
4. **F-D12 awakening:** on settled beat 3, inspect VoiceOver focus and confirm the spoken name includes the player and power after the fix; visually verify margin, padding, gold panel, contrast, and no clipping on all three beats.
5. **F-D13 summary:** verify the result, each statement line, net change, TP/fans, X, and Continue are independently reachable in sensible order after restructuring.
6. **F-D01/F-D04:** during active construction, confirm no “Need $0 more,” confirm the crew-busy reason is spoken, and confirm “Let them build” is in the button name.
7. **F-D02/F-D03:** time one success notice to dismissal, confirm it does not cover the HUD for longer than the chosen window, and inspect the final spoken punctuation.

F-D08 needs no retest unless the team chooses the optional text-role polish. F-D11, C-01, and C-02 are deterministic copy fixes. F-D14 needs an owner rule, not another device run.

## Recommended Phase 5 grouping

To keep fixes small and tests focused:

1. **Accessibility-label parity:** F-D01, F-D03, F-D04, F-D05, F-D09, plus the accessibility half of F-D12.
2. **Overlay semantics/layout:** F-D02, F-D12 visual panel, F-D13.
3. **Truthful copy/docs:** F-D11, C-01, C-02.
4. **Hold for reproduction:** F-D06 and F-D07.
5. **Hold for product decision:** F-D14.

None of these fixes requires an `ENGINE_VERSION` bump.
