---
date: 2026-08-09
topic: blue-inbox-must-do-guardrails
---

# Blue Inbox Must-Do Guardrails

## What We Are Building

Blue inbox cards will have one stable meaning: an opening Teacher-mode job the manager must clear before Advance Week. The rule will use explicit job data, not a color check. A blue job must declare how it clears and must be possible to clear in the current week. Read-only news, calendar notes, and advice will use a neutral non-job treatment and will never block time.

Opening a blue job starts a focused Bert job. Bert explains the task, opens the exact destination, keeps the current objective visible, and prevents unrelated navigation or transactions until the task clears. If the player presses Home, Back, another tab, or an unrelated action before completion, the app vetoes the action before route or game state changes. Bert then states the exact unfinished requirement on the still-mounted task screen. Settings, accessibility controls, save recovery, required confirmation steps inside the job, and an explicit **Back to Inbox** job-switch action remain available.

## Why This Approach

Color-only gating is unsafe. The current blue palette covers real tasks, explainers, recurring injuries, retirement notices, and optional build reminders. Some cannot be resolved in the current week. Blocking all current blue cards would deadlock careers.

An explicit job contract keeps the visible promise while preserving fail-soft progression. It also lets tests prove that every blocking card has a completion rule and an available action.

## Key Decisions

- **Blue means must-do:** only the four declared opening action jobs use the blue action treatment: Training Pitch, Head Coach, Youth signing, and Coaching Office.
- **Action completion only:** each job clears only after its named game-state result exists. A screen visit, closed briefing, or rejected alternative never satisfies a job.
- **Re-evaluate availability:** a job blocks only while its required action is possible and affordable now. Re-evaluate after every relevant game-state change. Otherwise it queues or uses a neutral non-blocking treatment until it becomes possible.
- **Focused job state is transient:** the selected job is app state, not save data. Reloading removes the focus lock but not the durable inbox job or Advance Week gate.
- **Briefing is not completion:** finishing Bert's explanation must never remove an action job. Guide delivery and job completion are separate facts.
- **Completion is durable:** game state remains the source of truth for action jobs. A focused job auto-releases only when its completion predicate becomes true.
- **Opening jobs are action jobs:** Training Pitch clears when its build starts; Hire a Coach clears when a head coach is hired. Clicking one prevents work on the other until the selected job clears.
- **Youth Intake is an action job:** it clears only when a youth player is signed. While the Week 2 job is outstanding, decline is unavailable because it would destroy the only completion path. An old save that already declined must remain fail-soft and must not gain an impossible job.
- **Coaching Office is an action job:** it clears when construction starts. It blocks only when the club has the cash and a free works crew.
- **Defence in depth:** the shell blocks unrelated tabs, target screens block unrelated controls, and store actions reject bypass attempts without spending cash or changing state.
- **Teacher only:** Advisor mode has no blue job treatment, task focus, or opening task gate. Its news and ordinary routes remain available.
- **Recovery first:** old saves with a wrong active construction keep the existing fail-soft path. The current build can finish before the Training Pitch job resumes.
- **Safe job switching:** Back to Inbox clears only the transient focus and returns Home. It does not complete the job or enable Advance Week.
- **Accessible veto:** blocked controls remain focusable, expose the exact job reason as disabled/help text, and announce Bert's reminder without losing the player's prior focus.

## Acceptance Shape

1. With two blue opening jobs, Advance Week is unavailable.
2. Selecting Training Pitch opens Club > Facility, keeps Bert's `BUILD YOUR TRAINING PITCH` objective visible, and rejects every other facility transaction.
3. Selecting Hire a Coach opens Market > Coaches and rejects navigation or transactions outside the coach task. Finishing Bert's briefing does not remove the card.
4. Pressing Home, Back, or another tab before hiring opens a short Bert reminder that says the head coach is still required and leaves the Coaches screen active.
5. Back to Inbox returns Home and permits selecting another blue job, but the first job remains open and Advance Week remains blocked.
6. Completing the selected job returns control, removes that card, and leaves every other possible blue job available.
7. Advance Week becomes available only when no possible blocking blue job remains.
8. In Week 2, opening Youth Intake without signing, closing Bert, pressing Back, or trying to decline does not clear the card or enable Advance Week. Only a completed youth signing clears it.
9. A wrong active build, insufficient cash, no eligible coach, no roster slot, or an unaffordable youth offer cannot create a blocking job. The job resumes if it becomes possible later.
10. Every declared blocking job has tests for completion, rejected alternatives, dynamic affordability, Advisor behavior, direct-action bypasses, reload recovery, keyboard and Back navigation, and accessible blocked-state feedback.

## Review Synthesis

Grok 4.5 and Claude Opus 5 both required dynamic availability, a pre-navigation veto, explicit Advisor behavior, and an in-flow escape from focused mode. This design accepts those findings. Their suggested two-job limit is expanded only to the four existing opening duties because the owner confirmed that Week 2 Youth signing must use the same real-completion rule and the current game already gates Week 3 Coaching Office.

The selected flow returns Home after a completed job so the remaining required cards and Advance Week state are visible immediately.

## Next Step

Run independent Grok 4.5 and Claude Opus 5 design reviews, then synthesize their verified findings into the implementation plan.
