# Grok audit — rival hero intro implementation plan

Date: 2026-08-08
Targets:

- `docs/plans/2026-08-08-feat-rival-hero-intro-cutscenes-plan.md`
- `docs/superpowers/plans/2026-08-08-rival-hero-intro-cutscenes-spec.md`, revision 3

Reviewer: Grok 4.5, high reasoning effort, completed read-only named-file audit
Reconciliation: verified against the current repository by Codex

## Verdict

The plan covered the feature architecture, persistence rule, hard-cut handoff, and primary
accessibility strategy, but five acceptance paths were under-specified. All five findings
were confirmed and corrected in the audited plan.

## Confirmed and addressed

1. **Post-intro destination was contradictory.** One Phase 2 test said completion
   immediately restored the lineup, while both the spec and Phase 3 require re-evaluating
   another rival, Cup Bert, condition warning, then lineup. The plan now requires staying
   on the same Match Day and asserting whichever presentation is actually next.
2. **Speech backgrounding was not pinned.** The power beat already restarted safely, but
   the plan did not forbid AppState transitions from completing/dismissing speech. The pure
   sequence tests now require speech to remain blocking until explicit input and forbid
   AppState from writing the completion flag.
3. **Double-header coverage stopped too early.** Flag isolation alone did not prove the Cup
   opponent was re-derived after the league half settled. The plan now tests the complete
   league-intro → league settlement → Cup-intro → second team-sheet sequence.
4. **Competing overlays were described but not inventoried.** The plan now names the
   `guideOverlayVisible` family, condition warning, locally-owned character surfaces,
   ordinary notices, and the few global safety/modality surfaces that deliberately keep
   higher priority.
5. **The power card's accessible contract was not testable enough.** The plan now requires
   a single button named with hero plus localized power, its continue-to-taunt hint, the
   full speech announcement and existing hints, hidden decoration, and phase focus transfer
   on iOS, Android, and web.

## Coverage

Grok compared the bounded implementation plan with the bounded revision-3 specification.
It did not inspect repository code. Codex verified each finding against the current Match
Day routing, `ScreenTransition`, root overlay composition, `CharacterSpeechOverlay`, and
store action flow before revising the plan.
