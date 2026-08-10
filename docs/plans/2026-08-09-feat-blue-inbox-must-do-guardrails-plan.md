---
title: "feat: Make blue inbox jobs true must-dos"
type: feat
date: 2026-08-09
status: ready-for-audit
---

# feat: Make blue inbox jobs true must-dos

## Outcome

In Bert Teacher mode, the four opening action jobs use one clear contract: blue plus a visible **MUST DO** label means the player must complete the named game action before Advance Week. Reading Bert's briefing, visiting the destination, cancelling a confirmation, backing out, or declining an alternative does not complete the job.

The four jobs are:

| Week | Job | Completion truth | Impossible-this-week rule |
|---|---|---|---|
| 1 | Build the Training Pitch | Training Pitch build has started | No legal placement, free crew, or cash: queue/non-blocking |
| 1 | Hire a Head Coach | `market.headCoach` exists | No eligible affordable candidate: queue/non-blocking |
| 2 | Sign a Youth Player | Current intake records a successful signing | No roster slot or affordable offer: queue/non-blocking |
| 3 | Build the Coaching Office | Coaching Office build has started | No legal placement, free crew, or cash: queue/non-blocking |

Advisor mode has no blue jobs, focused locks, or opening Advance Week gates.

## Confirmed Problem

The current code treats briefing completion as task completion:

- `App.tsx:1869-1876` calls `completeAssistantGuide` when Bert finishes speaking.
- `src/application/assistant-guide.ts:67-108` moves Head Coach from the market explainer to a second hire sequence.
- `src/game/assistant-guide.ts:384-506` persists the weekly three-row tranche, so the newly due second coach card can be deferred even though the Week 1 store gate remains.
- `src/application/store.ts:1066-1105` separately checks the real Head Coach state, then shows the vague `store.inboxItemLeft` notice.
- `src/application/assistant-guide.ts:220-315` currently derives Week 2–3 gates from due guide IDs, so finishing the Youth or Coaching Office briefing removes the gate without completing the action.
- `src/application/__tests__/assistant-guide.test.ts:474-505` explicitly encodes the old false-completion rule for Youth.

This explains both reported failures: Home can show zero open jobs while Advance Week still refuses the missing coach, and Week 2 can advance after reading Youth Intake without signing a youth.

## Review Synthesis

Grok 4.5 and Claude Opus 5 both confirmed five design requirements:

1. Re-evaluate job possibility after every relevant state change.
2. Veto navigation before the route, tab, section, or transaction changes.
3. Separate briefing delivery from real job completion.
4. Provide a deliberate **Back to Inbox** job-switch path instead of making reload the only escape.
5. Define Advisor and accessibility behavior explicitly.

Both reviewers suggested limiting the first release to the opening action jobs. The owner added Week 2 Youth signing, and the current product already treats Week 3 Coaching Office as an opening duty. The accepted scope is therefore these four jobs only. There are no `acknowledge` jobs in this release.

External web research is not needed. The change is local interaction policy with mature repository patterns, two requested independent model reviews, and no external API or unstable platform contract.

## Interaction State Machine

Add transient application state. Do not add save-schema fields.

```text
idle
  -> focused(jobId)                  player opens a blue job

focused(jobId)
  -> focused(jobId)                  blocked exit/action; Bert gives exact reminder
  -> choosing-required-job           Back to Inbox
  -> choosing-required-job           job completes and another blocking job remains
  -> idle                            job completes and no blocking job remains

choosing-required-job
  -> focused(jobId)                  player opens a remaining blue job
  -> choosing-required-job           unrelated navigation/action is vetoed
  -> idle                            no blocking job remains
```

Reload, new career, restore, discard, and season transition clear transient focus atomically. They do not change the durable game-state facts used to derive outstanding jobs. Outstanding-job derivation is the single source of truth. After every career mutation and on every focus or guard entry, a focused duty that is no longer blocking releases to `choosing-required-job` only when another blocker remains; otherwise it releases to `idle`.

## Guard Contract

### Navigation

Guard before mutation:

- Bottom tabs and desktop number shortcuts.
- Home, Back, native hardware Back, and browser history.
- Market docket tabs.
- Club Office tabs and Staff/Ledger shortcuts.
- Bert objective-strip routing.

While focused, the required destination stays mounted. While choosing, Home stays mounted. A blocked attempt opens the exact translated Bert reminder without first changing tab, section, scroll target, or guide focus.

The central guard has an explicit allowlist. Settings, accessibility routes and controls, save recovery, required confirmation dialogs, and Back to Inbox remain available without clearing the durable duty. Ordinary hardware Back and browser history remain vetoed while they would leave the required destination.

### Transactions

Store actions are the final authority. While focused:

- Training Pitch permits only a Training Pitch build.
- Head Coach permits only a successful `HEAD` coach hire.
- Youth permits only a youth signing; `declineYouth()` is rejected.
- Coaching Office permits only a Coaching Office build.
- Builds of another type, upgrades, relocation, closure, scouting, transfers, sponsorship, wrong-role coach actions, and decline return with no cash or career mutation.

UI controls show the same restriction, but direct store tests prove the UI is not the only defence.

### Safe Job Switching

**Back to Inbox** clears only the selected focus and returns Home in `choosing-required-job`. It does not complete the job, clear a card, or enable Advance Week. Only another visible MUST DO job can leave the choosing state.

If no blocking job remains during a re-evaluation, choosing mode releases to `idle` immediately.

## Implementation Tasks

### 1. Add explicit opening job derivation

Modify `src/application/assistant-guide.ts`:

- Add a narrow `OpeningInboxDutyId` union and job descriptor table for the four jobs.
- Add pure helpers for completion, destination tab/section, objective key, reminder key, transaction reason key, and `canCompleteNow`.
- Make `outstandingInboxDuties` derive from real game state, not guide-completion flags.
- Include Week 1 Training Pitch and Head Coach.
- Require `youthIntake.signedPlayerIds.length > 0` for Youth completion; `declined` is not completion.
- Keep the current old-save wrong-construction recovery and Coaching Office affordability rule.
- Reconcile stale guide flags from completed domain state.
- Do not let `completeAssistantGuide(...)` complete any unfinished action job.
- Collapse Week 1 Head Coach to one durable duty. Stop emitting the deferred `head-coach-hire` row; keep any market explainer non-blue and non-blocking, and keep one Head Coach MUST DO card until `market.headCoach` exists. Replace the old two-step tests.

Use existing production validators/helpers for candidate eligibility, weekly-wage affordability, roster capacity, youth-offer affordability, facility cash, crew, build limit, and placement. Do not duplicate simplified affordability math if an existing view-model/game helper supplies the real result.

### 2. Make blocking jobs visible and scheduler-proof

Modify `src/application/view-models.ts` and `src/ui/models.ts`:

- Add explicit job metadata to `ClubAlertViewModel`; do not infer from `tone`.
- Build the four opening job cards from the outstanding-job derivation.
- Reserve their slots ahead of the ordinary three-card scheduler so an urgent notice cannot hide a blocking requirement.
- Keep one stable Head Coach card until a real hire; do not expose a disappearing explainer card followed by a deferred hire card.
- Add a visible translated `MUST DO` label.
- Give all non-job alerts a neutral cream/grey treatment. Red urgent cards remain red. Do not use blue for stories, injuries, retirement, tips, advice, build reminders, or ordinary guide explainers.
- Assert both invariants in tests: every blocker is visible, and every blue/MUST DO card is a blocker.

### 3. Add transient focused-job state and pre-navigation vetoes

Modify `src/application/store.ts`, `App.tsx`, and `src/ui/ManagementShell.tsx`:

- Add `inboxDutyFocus: null | { mode: 'choosing' } | { mode: 'focused'; dutyId: OpeningInboxDutyId }`.
- Add a translated, job-specific blocked-attempt state for Bert.
- Start focus before routing from the selected inbox card.
- Centralize a pre-navigation guard; do not clear guide or section state until it accepts the route.
- Keep keyboard shortcuts on the same guard path.
- Expose the persistent job objective and Back to Inbox control in the shell.
- After a successful job action, re-evaluate outstanding jobs. Return Home in choosing mode when another remains; otherwise clear focus after the current success presentation.
- Re-evaluate on every career mutation and at every focus/guard entry, including recovery and non-presenter paths. Never retain focus for a duty that is no longer outstanding.
- Reset focus on load/new/restore/discard/season transitions.
- Make Teacher Advance Week block if and only if `outstandingInboxDuties` is non-empty. Use the same job-specific Bert reminder as blocked navigation. Remove the old separate Week 1 Head Coach/pitch checks and stop using `store.inboxItemLeft` or generic Desk-not-clear copy for this flow.

### 4. Lock target screens and direct actions

Modify `src/ui/screens/MarketScreen.tsx`, `src/ui/screens/ClubFinancesScreen.tsx`, and the relevant store actions:

- Lock Market to `COACHES` for Head Coach and `YOUTH` for Youth.
- Lock Club to `facility` for Training Pitch and Coaching Office.
- Intercept Market/Club sub-tab changes before local state changes.
- Disable Youth decline while the required job is outstanding and add a store-level no-mutation rejection.
- Reject the wrong facility type and every upgrade/relocate/close action during a facility job.
- Reject wrong-role coach hires and unrelated market transactions during coach/youth focus.
- Preserve Settings, accessibility, save recovery, required confirmations, and the dedicated Back to Inbox action.

### 5. Replace generic reminders with translated exact copy

Add keys to all seven catalogs:

- `content/i18n/en.json`
- `content/i18n/es.json`
- `content/i18n/pt-BR.json`
- `content/i18n/fr.json`
- `content/i18n/id.json`
- `content/i18n/de.json`
- `content/i18n/vi.json`

Each job needs direct catalog entries for:

- Card title and detail where the current content key cannot stay stable.
- Persistent objective.
- Blocked-navigation Bert title/body.
- Blocked-transaction reason.
- Back to Inbox label, hint, and accessibility label.
- MUST DO label and accessible card state.

Remove the hard-coded English `Desk not clear` reminder in `App.tsx`. Do not rely on English fallback for any new job-flow key. Keep placeholders identical across catalogs and pass character-budget, glyph, voice, and copy-width gates.

Use this English source table. Translations must preserve the job meaning, not translate word by word.

| Job | Objective | Bert title | Bert blocked body | Transaction reason |
|---|---|---|---|---|
| Training Pitch | `BUILD THE TRAINING PITCH.` | `Training Pitch first` | `We still need to start the Training Pitch, boss. Finish this job before you leave the Facility board.` | `Build the Training Pitch before you use the works crew for anything else.` |
| Head Coach | `HIRE A HEAD COACH.` | `Coach still needed` | `We still need to hire a head coach, boss. Finish the hire before you leave the Coaches desk.` | `Hire a head coach before you do other club business.` |
| Youth | `SIGN A YOUTH PLAYER.` | `Youth signing still needed` | `We still need to sign one youth player, boss. Pick one before you leave the Youth desk.` | `Sign one youth player. Do not decline this intake.` |
| Coaching Office | `BUILD THE COACHING OFFICE.` | `Coaching Office first` | `We still need to start the Coaching Office, boss. Finish this job before you leave the Facility board.` | `Build the Coaching Office before you use the works crew for anything else.` |

Shared source copy:

- MUST DO: `MUST DO`
- Back control: `BACK TO INBOX`
- Back hint: `Switch to another required inbox job.`
- Accessible card state: `{title}. Must do before Advance Week. {detail}`

When Advance Week is pressed with multiple jobs, select the first job in stable week order and use its exact Bert title/body. After that job clears, the next job remains visibly blue and receives its own exact reminder if needed.

Update `docs/08-ui-ux.md`: replace the obsolete “Week 1 only; nothing else is blocked” sentence with the four-job Teacher policy, dynamic possibility rule, Advisor exception, and Back to Inbox behavior.

### 6. Tests first, then implementation verification

Update or add focused tests in:

- `src/application/__tests__/assistant-guide.test.ts`
- `src/application/__tests__/inbox-duty-gate.test.ts`
- `src/application/__tests__/store.test.ts`
- `src/application/__tests__/assistant-mode.test.ts`
- `src/application/__tests__/assistant-mode-blocks.test.ts`
- `src/application/__tests__/home-training-ground-inbox.test.ts`
- `src/ui/__tests__/web-confirmation-and-guidance.test.ts`
- `src/ui/__tests__/coach-hiring-guidance.test.ts`
- `src/ui/__tests__/facility-placement-guidance.test.ts`
- `src/i18n/__tests__/gates.test.ts`

Add one narrow UI behavior test if source-contract tests cannot prove the local Market/Club tab veto.

Mandatory interaction tests must cover native hardware/browser Back veto before route change, and one translated screen-reader announcement plus focus restoration after a blocked control. These are not optional source-contract checks.

## Acceptance Tests

1. Week 1 shows exactly two blue MUST DO jobs. Advance Week cannot pass.
2. Finishing either Bert briefing clears nothing.
3. Training Pitch focus rejects other builds, upgrades, relocation, closure, every exit path, and direct-store bypasses with identical cash and career state.
4. A cancelled Head Coach hire leaves the card, focus, and gate. A successful head-coach hire clears them.
5. Back to Inbox returns Home, keeps the unfinished job visible, and permits only another required job.
6. Week 2 Youth viewing, Bert completion, cancelled signing, Back, and decline do not clear the job. Only a successful signing clears it.
7. Direct `declineYouth()` is rejected with no state or cash mutation while the required job is outstanding.
8. Week 3 Coaching Office clears at build start, not briefing completion or screen visit.
9. Blocked mouse, touch, keyboard, hardware-Back, and browser-history attempts keep the same tab and section.
10. Bert names the exact unfinished job; screen readers receive the translated announcement and focus returns to the attempted control.
11. Reload clears transient focus but retains the visible job and Advance Week gate.
12. Impossible or unaffordable jobs are neutral/non-blocking. They become blue/blocking if later possible.
13. Wrong-opening-build saves can advance until the crew is free, then the Training Pitch job resumes.
14. A previously declined legacy Youth intake does not receive an impossible job.
15. Advisor mode has no blue jobs, focus locks, or opening job gates on the same fixtures.
16. Every non-job inbox card is non-blue.
17. Every new job-flow key exists directly and non-empty in all seven shipped catalogs.

## Verification Commands

Run the smallest checks first, then the full relevant gate:

```bash
npx jest --runInBand \
  src/application/__tests__/assistant-guide.test.ts \
  src/application/__tests__/inbox-duty-gate.test.ts \
  src/application/__tests__/store.test.ts \
  src/application/__tests__/assistant-mode.test.ts \
  src/application/__tests__/assistant-mode-blocks.test.ts \
  src/application/__tests__/home-training-ground-inbox.test.ts \
  src/ui/__tests__/web-confirmation-and-guidance.test.ts \
  src/ui/__tests__/coach-hiring-guidance.test.ts \
  src/ui/__tests__/facility-placement-guidance.test.ts \
  src/i18n/__tests__/gates.test.ts
npx tsc --noEmit
```

Then use the Dev Harness or a fresh Teacher career to verify at desktop and 390×844:

1. Week 1: open Coach, cancel, try Home, see exact Bert reminder, Back to Inbox, switch to Training Pitch, try a wrong facility, build the pitch, hire the coach.
2. Week 2: open Youth, cancel, try decline, try Back, then sign a youth.
3. Week 3: open Coaching Office, try another facility, then start the office.
4. Repeat the same fixtures in Advisor mode.
5. Repeat one focused exit with keyboard and browser/native Back.

Immediately mute any web preview. Close the preview and stop the server after QA.

## Risks And Mitigations

- **Deadlock from stale eligibility:** derive from production validators and re-evaluate after every mutation.
- **Hidden blocker:** reserve job cards outside the three-row scheduler and assert blocker/card parity.
- **UI-only bypass:** reject in store before mutation and assert state/cash identity.
- **Hard focus trap:** Back to Inbox permits required-job switching without releasing the week gate.
- **Old-save trap:** preserve wrong-build recovery and waive already declined Youth intakes.
- **Translation fallback:** key-parity and direct-entry assertions for all seven catalogs.
- **Guide regression:** briefing delivery stays independent from completion; action state alone clears the job.

## Non-Goals

- No all-career conversion of injuries, retirement, financial notices, sponsor lessons, scouting lessons, or other guide cards into must-do jobs.
- No save-schema migration for focused UI state.
- No simulation, RNG, balance, or replay change; `ENGINE_VERSION` must not change.
- No Advisor-mode tutorial gate.
