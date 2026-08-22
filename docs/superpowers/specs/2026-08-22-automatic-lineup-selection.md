---
date: 2026-08-22
topic: automatic-lineup-selection
status: reviewed
---

# Automatic Lineup Selection

## Problem

Automatic lineup selection can leave strong natural-role players on the bench.
It can also place a forward in a defender slot while defenders remain available.

Observed examples include:

- Licensed hero Bo Hedges, rated 81, benched for a rated-44 defender.
- Forward Jae Gray starting in defence while three defenders were benched.
- Kai Hart benched for weaker defenders.

Manual swaps work. The automatic result is the broken path.

## Player Contract

When the game automatically selects a Starting XI, it must:

1. Fill each formation slot with an available player whose natural role matches that slot.
2. Rank matching players by their current role rating after condition is applied.
3. Prefer a licensed hero when two matching players have the same conditioned role rating.
4. Use player ID ascending as the final deterministic tie-break.
5. Use an out-of-role outfield player only after every natural-role pool has filled as many matching formation slots as it can.
6. Keep a goalkeeper in the goalkeeper slot. An outfielder can never be the automatic goalkeeper fallback.

An available player is fit, not away, legally selectable, and not already assigned to another slot. A powered player must hold an active Hero License.

The selector uses this fixed procedure:

1. Build one available-player pool for each natural role.
2. Reserve same-role slots for available players with active Starter or Captaincy promises. Older promises win first, then player ID ascending.
3. Fill every remaining natural-role slot from its matching pool. Rank by conditioned role rating descending, licensed hero first on an exact tie, then player ID ascending.
4. Walk any empty outfield slots in formation-slot order. Rank every remaining outfielder by conditioned rating for the vacant slot's role, then the same hero and player-ID tie-breaks.
5. Assign each player at most once.

## When It Runs

The automatic selection runs when:

- The manager selects a formation, including the formation already selected.
- A new season starts, using the manager's saved active formation.

A manual swap remains manual. Ordinary weekly settlement must not replace a legal manager-picked XI just because another player has a higher rating.

Existing system repair remains narrow after injury, leave, retirement, sale, awakening, or a Hero License change. It repairs unavailable or illegal starters without replacing the rest of a legal manager-picked XI.

## Contract Promises

An active Starter or Captaincy promise must be honoured in the player's natural role when that player is currently available.

- Promised players reserve same-role slots before ordinary players or fallback players are selected.
- Older active promises win first. Player ID ascending breaks promises made in the same season.
- A promise never places a player in a different role.
- If every same-role slot is reserved by an older active promise, the newer promise remains temporarily unhonoured. The lineup stays legal and role-correct.
- An injured, away, or unlicensed powered promise holder is skipped until available again.

## Fallback Rule

Fallback is allowed only after all natural-role pools have filled as many matching slots as possible.

- Each empty outfield slot may use one remaining available outfielder.
- Fallback ranks the candidate's conditioned rating for the vacant slot's role, then licensed hero on an exact tie, then player ID ascending.
- A thin squad must still fail soft through the existing emergency-youth path where that path already applies.
- If no available goalkeeper remains after existing lineup repair, automatic selection is rejected and the current lineup stays unchanged. It never places an outfielder in goal.
- If no legal player can fill every outfield slot, automatic selection is rejected and the current lineup stays unchanged.

## Acceptance Criteria

- [ ] An 81-rated available defender starts ahead of a 44-rated available defender when condition does not reverse their order.
- [ ] A licensed defender hero wins an exact conditioned-rating tie against a regular defender.
- [ ] A forward cannot occupy a defender slot while any available defender remains unselected.
- [ ] Selecting the current formation rebuilds the Starting XI.
- [ ] A new season rebuilds the Starting XI for the saved active formation.
- [ ] Condition can make a fresher, weaker player the correct automatic choice.
- [ ] Injured, away, and unlicensed powered players are excluded.
- [ ] Starter and Captaincy promises never create an out-of-role starter.
- [ ] Each genuine outfield role shortage uses one legal out-of-role fallback per empty slot.
- [ ] A player is never assigned to more than one slot.
- [ ] Automatic selection cannot replace the goalkeeper with an outfielder.
- [ ] Repeated selection from the same state produces the same eleven and slot order.

## Non-goals

- No tactical chemistry score.
- No power-specific combat-value model.
- No change to manual swap freedom between outfield positions.
- No automatic weekly replacement of a legal manager-picked XI.
