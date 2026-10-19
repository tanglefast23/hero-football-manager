# Post-run bug fixes — 2026-10-19

The completed six-season career remains pinned to 28386452. These fixes did not replay or alter that career.

## Confirmed defects fixed in source

- **AI hero identity:** a transferred power now survives pyramid sync, save/load, season rebuild, Cup opponents and market targets. Acquired ordinary players cannot take the buyer's generated power slots.
- **AI arrival licensing:** both normal and board-forced sales grant a free division license. A full buyer keeps the hero's power unlicensed. Licenses never require deleting an owned power.
- **Web atlas contexts:** normal and fallback atlases use Skia's CPU surface on web. Native retains its old offscreen path. Cached image lifetime is unchanged.

Generated powers keep their existing division ramp. Power tiers remain division-derived. Duplicate powers remain allowed. Special-hero hosts reserve licenses for named heroes and generated heroes before transferred heroes. An owned hero can be benched but does not lose his power.

The optional ownsPower field marks new transfers. Legacy foreign-id heroes preserve their currently saved power at sync. Original powers erased by an earlier season cannot be recovered. No save-schema or match-engine version bump is needed. An older build can read the optional fields, but can lose the carried power again at its next old-code season sync.

## Evidence

- The isolated browser used the production atlas builder and installed Skia/CanvasKit. Twenty-four unique looks created 24 WebGL contexts and eight context-loss events before the fix. The fixed path created zero. All 24 full-pixel SHA-256 hashes match. [Receipt](evidence/atlas-context-validation.json).
- A local QA export rendered the real MatchScreen with visible players. The clock reached six minutes before Pause match was pressed. This was a synthetic QA entry, not career progress. [Screenshot](evidence/atlas-fixed-match.png), [flow proof](evidence/atlas-fixed-match.json).
- Permanent tests cover both sale paths at free/full capacity, save validation, legacy identity, sold-back native identity, season transitions, active/off-division builders, market identity, special hosts, and unchanged native power generation.
- The full suite passed: 524 suites and 5,058 tests. One suite and one test were skipped. Three snapshots, TypeScript, changed-file formatting, the normal web export and desktop check passed. All six archived season ends passed 60 team checks without simulation. [Receipt](evidence/bug-fix-validation.json), [full test log](evidence/bug-fix-full-suite.log.gz).

Grok verified the other report items. The four earlier fixes remain present. No shipped path was found for the speculative same-source emergency-youth collision. Retirement ranking, owned-only drill tiers, trips, scripted shootouts and abstract Cup scores are intended rules or design questions. They were not silently rebalanced.

One launcher incident occurred: npm's Electron launcher stayed alive after printing successful checks. It had no Electron child. The lead stopped that wrapper and ran the same check directly through the Electron binary; it returned 0 and left no process. The browser tab and both temporary servers were closed. [Cleanup](evidence/bug-fix-cleanup.json).

Muse independently reviewed the web surface fix. Grok and Opus independently review the AI transfer fix. Their final dispositions are recorded in final-review-decisions.md.

## Design work awaits approval

The [final plan](../../docs/superpowers/plans/2026-10-19-balance-and-design-follow-up.md) incorporates separate Grok, Opus and Muse feedback. It proposes exact dates and clear Cup labels, lower-tier training choices, protected TP savings, saved skill-based shootouts, and controlled economy/Cup measurements. Numerical commercial or catch-up tuning needs a later measured proposal. The weekly queue is deferred.

No balance plan changes or release deployments have been made in this pass.
