---
status: pending
priority: p3
issue_id: "001"
tags: [characters, copy, i18n, saves]
dependencies: []
---

# Add Internal Character Pronouns

## Problem Statement

Generic dialogue cannot use gendered pronouns safely because players and coaches do not store pronouns.

Neutral copy solves today's visible bugs. A future internal field would support gendered dialogue without guessing from names.

## Findings

- The current transfer and story templates can avoid pronouns.
- A binary `sex` field is not the value the copy system needs.
- `pronouns: 'he' | 'she' | 'they'` directly models the words used by dialogue.
- Adding the field affects deterministic generation, saved careers, players, coaches, and localization.

## Proposed Solutions

### Option 1: Keep All Generic Copy Neutral

**Approach:** Continue writing templates without gendered pronouns.

**Pros:** No schema or save changes.

**Cons:** Limits character-specific writing.

**Effort:** Low

**Risk:** Low

### Option 2: Add Internal Pronouns

**Approach:** Store `he`, `she`, or `they` on every generated player and coach. Use neutral copy when the value is missing.

**Pros:** Supports correct character-specific dialogue.

**Cons:** Requires deterministic assignment, save migration, and localization helpers.

**Effort:** Medium

**Risk:** Medium

## Recommended Action

Defer until gendered character dialogue is planned. Then implement Option 2 with `they` as the old-save fallback.

## Technical Details

Likely affected areas:

- Player and coach types
- Deterministic player and coach generators
- Career save migration
- Story and negotiation copy helpers
- Localization tests

## Acceptance Criteria

- [ ] Every generated player and coach receives deterministic pronouns.
- [ ] Existing saves load with a safe neutral fallback.
- [ ] Dialogue uses one shared pronoun-copy helper.
- [ ] Missing pronouns never produce incorrect gendered copy.
- [ ] Determinism, save migration, and localization tests pass.

## Work Log

### 2026-08-14 - Added During Career Playtest

**By:** Codex

**Actions:**

- Recorded the future internal field after gendered transfer copy appeared for Tia Dock.
- Kept the current fix neutral to avoid a rushed schema change.

**Learnings:**

- Neutral copy is sufficient for current generic templates.
- Internal pronouns will help when character-specific dialogue becomes a design goal.
