---
status: pending
priority: p2
issue_id: "002"
tags: [balance, economy, training, facilities, contracts]
dependencies: []
---

# Review Post-Season Two Economy Levers

## Problem Statement

Optimal play may create more cash than the club can use meaningfully from D4 onward.

Do not change the economy before the current optimal career finishes Season 2. Use its closing cash, remaining upgrades, and wage pressure to decide whether the surplus is temporary or persistent.

## Findings

- The optimal career rose from about $45,000 to about $87,000 during the D4 run-in while spending about $33,000 on facilities and staff changes.
- Three Stadium Stands and three Fan Shops make home matches worth about $21,000 net.
- Merchandise covers most current player wages.
- The club still has Level 2 and Level 3 facility upgrades ahead.
- D3 unlocks $70,000 of Tier 3 drill upgrades.
- Smart play should earn a useful cushion without making money meaningless.

## Proposed Solutions

### Option 1: Add Green Bull Training From D3

**Approach:** Add a Drills-screen button that triggers the existing group training trip on demand.

**Rules:**

- Unlock in D3 and remain available in D2 and D1.
- Require at least one full week's TP income.
- Consume all current TP.
- Cost $50,000 in D3, $80,000 in D2, and $120,000 in D1.
- Give every player +2 to all stats.
- Cost every player 10 condition.
- Allow one use per week.

**Pros:** Rewards strong finances with an exciting optional power-up.

**Cons:** Needs strict TP and weekly gates to prevent repeated or zero-TP use.

**Effort:** Medium

**Risk:** Medium

### Option 2: Raise Only Later Facility Upgrade Costs

**Approach:** Keep Level 1 build costs friendly. Raise selected Level 2 and Level 3 costs only if cash still piles up after Season 2.

**Pros:** Preserves Season 1 access and creates a midgame cash sink.

**Cons:** The single construction crew already limits spending speed.

**Effort:** Low

**Risk:** Medium

### Option 3: Raise Wages Through Promotion And Renewal

**Approach:** Keep signed contracts fixed. Add transparent promotion wage clauses and strengthen renewal demands as division, rating, and fame rise.

**Pros:** Adds recurring costs without breaking contract trust.

**Cons:** Needs careful testing around renewal affordability and fail-soft debt.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Finish Season 2 first. Then review the closing economy and decide whether to implement Green Bull Training alone or combine it with targeted facility and wage changes.

Do not nerf Fan Shops or Stadium Stands before this review.

## Technical Details

Likely affected areas:

- Drills screen and the existing Green Bull trip flow
- Weekly TP income and one-use-per-week state
- Facility Level 2 and Level 3 cost catalog
- Promotion and renewal wage calculation
- Save migration for any new weekly-use or contract-clause state
- Balance harness and long-career economy rails

## Acceptance Criteria

- [ ] Record Season 2 closing cash, wages, weekly income, facilities, and remaining upgrade costs.
- [ ] Decide whether the cash surplus remains after the facility-upgrade phase.
- [ ] Confirm Green Bull cannot be used with less than one full week's TP.
- [ ] Confirm Green Bull consumes all TP and is limited to once per week.
- [ ] Keep signed contract wages fixed between promotion or renewal events.
- [ ] Keep Level 1 facility costs unchanged unless new evidence shows a Season 1 problem.
- [ ] Run focused economy tests and the required balance rails for any chosen changes.

## Work Log

### 2026-08-14 - Added During Optimal D4 Playtest

**By:** Codex

**Actions:**

- Recorded the three preferred economy levers.
- Deferred implementation until the current career completes Season 2.

**Learnings:**

- Optimal income infrastructure is producing a large cushion.
- Later upgrades and D3 drill unlocks have not yet been tested against that cushion.
