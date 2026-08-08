# Grok audit — rival hero intro cutscene spec

Date: 2026-08-08
Target: `2026-08-08-rival-hero-intro-cutscenes-spec.md`, draft 1
Reviewer: Grok 4.5, high reasoning effort, completed read-only named-file audit
Reconciliation: verified against the current repository by Codex

## Verdict

The core once-per-hero design survived review. Four presentation contracts needed to be
made explicit; one suggested extra persistence marker was rejected because the normal game
flow cannot reach the state it was intended to repair. The accepted clarifications are in
spec revision 2.

## Confirmed and addressed

1. **Double-header fixture order needed to be stated.** Grok treated this as undefined from
   the spec alone. The current `activeCareerMatchday` contract already selects the exact
   next playable fixture and is explicitly league-first on a double-header week
   (`src/game/career.ts`). Revision 2 now names that rule and the post-league Cup
   re-evaluation. The implementation blocker was overstated, but the spec ambiguity was
   real.
2. **Back and accessibility-dismiss semantics were missing.** Revision 2 makes the scene
   blocking, maps hardware Back/accessibility escape through the same staged advance as a
   tap, treats process close as an uncompleted cancellation, and requires store protection
   for leaving Match Day.
3. **A timed power card was too short for screen-reader focus.** Revision 2 disables the
   auto timer whenever a screen reader is active and requires explicit activation.
4. **The overlay priority needed one owner.** The draft listed the right ordering, but did
   not say explicitly that it is a single derived Match Day presentation slot. Revision 2
   now does, preventing rival, Bert, and condition scenes from mounting together.

## Rejected after repository verification

Grok suggested persisting a second “armed but unfinished” hero marker in case the player
closes the app mid-scene and the hero changes clubs before the next load. That state is not
reachable in ordinary play once the specified guards are applied: no Match Day navigation
or match-start action can run while the intro is pending, and a process close reloads the
same persisted Match Day, fixture, opponent, and roster. Host changes happen at a later
season boundary, which cannot be reached without settling this match. A second marker would
add save-state complexity without protecting a real path, so revision 2 states the
invariant instead.

## Coverage

Grok reviewed only the bounded specification file, as requested by the audit wrapper. It
did not inspect repository code. Codex verified the findings against the active fixture
selection, Match Day store actions, current overlay priority, and persisted `eventFlags`
model before accepting or rejecting them.
