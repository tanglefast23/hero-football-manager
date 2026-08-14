---
date: 2026-08-14
topic: strategic-player-requests-and-sponsors
---

# Strategic Player Requests and Sponsors

## What We Are Building

Player requests will stop asking only for affordable cash. Granting a request
will instead cost availability, condition, or training output. The exact cost
will remain visible before the manager decides.

Sponsor offers will stop measuring ordinary season success. All three objective
families will use facts already stored on league fixtures and will reward a
specific tactical approach.

Pre-match sponsor challenges are not part of this pass.

Team Trip is also outside this pass. Its division-scaled reward and opportunity
to spend TP before Week 19 are intentional. The broad boost is meant to feel
temporarily overpowered without replacing focused training of long-term stars.

## Player Requests

Keep the current request IDs, titles, lines, art, cadence, loyalty rewards, and
refusal penalties. This preserves translated content and request history. Change
only the 18 money-based costs.

### Individual requests

Use absence for requests that take the player elsewhere:

- `cousins-wedding`: out 1 week
- `fix-my-old-pitch`: out 1 week
- `ship-my-car-over`: out 1 week
- `charity-match-back-home`: out 1 week

Use reduced personal training for requests that distract the player:

- `gift-for-my-bae`: 75% drill gains for 2 weeks
- `the-car`: 60% drill gains for 4 weeks
- `gold-boots`: 80% drill gains for 2 weeks
- `fly-my-mum-in`: 80% drill gains for 2 weeks
- `personal-chef`: 75% drill gains for 3 weeks
- `home-studio`: 65% drill gains for 3 weeks
- `matchday-barber`: 85% drill gains for 2 weeks
- `highlights-drone`: 75% drill gains for 2 weeks

This makes a star's request expensive even after club cash stops mattering.
Reserves remain cheaper to indulge because their training priority is lower.

### Squad requests

Use condition when the event consumes the squad's energy:

- `squad-headphones`: -6 squad condition; keep the +3 morale reward
- `dressing-room-speakers`: -6 squad condition; keep the +3 morale reward
- `bbq-at-my-place`: -8 squad condition

Use reduced squad training when the event consumes club time:

- `squad-massage`: 80% drill gains for 2 weeks; keep +8 condition
- `charter-the-plane`: 85% drill gains for 2 weeks; keep +4 condition
- `proper-team-photo`: 80% drill gains for 2 weeks; keep +3 morale

The benefit-bearing requests become real exchanges instead of cheap purchases.

## Sponsor Objectives

Replace the three generated objective families. Keep the Steady, Balanced, and
Bold payment profiles and deterministic offer rotation.

### Iron Wall

Keep clean sheets in league matches.

- Steady: 3
- Balanced: 5
- Bold: 7
- Chairman adds 1

This favors goalkeeper and defender training, lower energy use, and protecting
leads.

### Goal Rush

Score at least three goals in separate league matches.

- Steady: 3 matches
- Balanced: 5 matches
- Bold: 7 matches
- Chairman adds 1

Counting matches prevents one blowout from completing the goal. This favors
attacking formations, forward training, and aggressive live-match choices.

### Road Warriors

Earn league points in away matches.

- Steady: 6 points
- Balanced: 11 points
- Bold: 17 points
- Chairman adds 1

This makes away fixtures a separate priority. Protecting an away draw can be as
useful as chasing a risky win.

## Save Rules

- Never change an open player request. Apply the new request catalog after that
  request is granted, refused, or lapses.
- Keep existing request IDs so old history remains readable.
- Existing sponsor offers and signed contracts keep their snapshotted terms.
- Keep the three legacy sponsor objective kinds readable and settleable.
- Generate only the three new objective kinds from the next sponsor offer
  window.
- Keep the old translated sponsor labels as legacy copy. Add the three new
  labels in all seven languages.

## Acceptance Checks

- No generated player request has a money-only cost.
- Every Grant button states the full availability, condition, or training cost.
- Each sponsor objective is rebuilt only from persisted league fixtures.
- Reloading does not change objective progress, offers, or request outcomes.
- Existing careers load, and active legacy sponsor contracts still settle.
- Focused request, sponsor, persistence, content, translation, and TypeScript
  checks pass.
- The sponsor balance harness measures completion rates before targets ship.

## Decision

Use the existing request effects and persisted fixture scores. Do not add a new
event system, pre-match challenge system, or match-engine field in this pass.
