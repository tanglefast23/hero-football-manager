---
title: Blue inbox must-do guardrails
type: feature
date: 2026-08-09
status: implemented
---

# Blue inbox must-do guardrails

## Outcome

In Teacher mode, a blue inbox card is a real opening job. The week cannot
advance until the requested game action succeeds. Reading or dismissing Bert
does not complete the job.

## Required jobs

| Week | Duty ID | Completion fact |
| --- | --- | --- |
| 1 | `facility-placement` | Training Pitch construction has started |
| 1 | `head-coach-market` | `market.headCoach` exists |
| 2 | `youth-intake` | At least one youth player was signed |
| 3 | `coaching-office` | Coaching Office construction has started |

The Youth decline action does not complete the Week 2 duty.

## Review synthesis

Claude Opus 5 and Grok agreed on these controls:

1. Derive completion from durable game state, not briefing flags.
2. Check that a job is possible now before it can hold the week.
3. Keep one explicit `Back to Inbox` escape.
4. Block navigation before tab or section state changes.
5. Recheck focus after each successful job action.
6. Keep Advisor mode free of these gates.
7. Reserve blue inbox styling for actionable must-do jobs.
8. Translate every new player-facing and accessibility string.

The final Grok audit also required exact job-specific Bert reminders, a
scheduler-proof `MUST DO` marker, direct store-action guards, and tests for
briefing dismissal, Youth decline, wrong transactions, and navigation escape.

## State model

The focused job is transient application state:

```ts
type InboxDutyFocus =
  | null
  | { mode: 'choosing' }
  | { mode: 'focused'; dutyId: OpeningInboxDutyId };
```

It is not saved. The actual job remains recoverable because completion is
derived from the career.

## Navigation rules

1. Home with open jobs is the choosing state.
2. Selecting a blue card focuses that duty and opens its required board.
3. Bottom tabs and internal board tabs cannot leave the required board.
4. A blocked attempt keeps the current screen mounted and opens the exact Bert
   reminder for the focused duty.
5. `Back to Inbox` returns Home and keeps all unfinished jobs open.
6. Settings and recovery controls remain available.

## Action rules

- Training Pitch focus allows only a Training Pitch build.
- Head Coach focus allows only a head-coach hire.
- Youth focus allows only a successful signing. Decline is blocked.
- Coaching Office focus allows only a Coaching Office build.
- Direct store actions enforce the same rules as the UI.
- If another required job remains after success, return to Home in choosing
  state. If none remains, release the focus.

## Fail-soft rules

A duty holds the week only when the real transaction can succeed now. The
check uses the pure game transaction so cash, coach eligibility, roster space,
the works crew, and facility placement stay aligned with the action button.

Old saves with a declined Youth intake are waived because the intake is closed
and cannot be reopened safely. Old saves with the wrong opening construction
can advance while the works crew is occupied, but other possible duties still
apply.

## Copy contract

Each duty has translated `objective`, `title`, and `body` keys. Shared copy
includes `MUST DO`, `BACK TO INBOX`, and a must-do accessibility label.

Shipping locales:

- English
- Spanish
- Brazilian Portuguese
- French
- German
- Indonesian
- Vietnamese

## Verification

Automated checks must prove:

1. Week 1 needs both real jobs.
2. Completing a Bert sequence does not clear a real job.
3. Youth decline leaves the intake open in the guarded flow.
4. Youth sign clears the duty.
5. Week 3 needs Coaching Office construction to start.
6. Wrong facility and assistant-coach actions are rejected.
7. Normal navigation is blocked while focused.
8. `Back to Inbox` changes focused state to choosing state.
9. Advisor mode has no must-do marker or gate.
10. All seven locale gates and the full application suite pass.
