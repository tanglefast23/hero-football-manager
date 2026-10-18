# Opus independent review

Reviewer ffc0379b-d1a8-4565-8e1d-80144d1d3b10. Lead c9061292-5986-4d58-8753-3b12fcfa6919.
Read-only review of main b546276a plus the dirty fixes. No live browser, store, save, server, fixture simulation, balance run, or soak. Temporary in-memory checks were deleted.

## Verified

- The actual Week 8 shape reconstructed from the Week 9 copy refuses plain Ken OFF with no cover. Atomic Kai-for-Ken exchange keeps all 165 career player IDs. Assumption: Kai's return slot was 9.
- On the actual Season 1 end checkpoint, startNextSeason keeps 3-4-3 and the exact XI. The new repair path adds no players and keeps Ace at slot 10. The old arrange path moved Ace to 8 and reordered midfielders.
- Team-sheet sorting uses a filtered copy. The engine anchors, stored IDs, and simulation behavior remain unchanged. No ENGINE_VERSION bump is needed.
- One accessible Continue target remains after the training animation. SfxPressable maps accessible=false to web tabIndex=-1.
- The refusal regex matches the thrown error. All seven catalogs contain the new key.
- The thin-bench harness leaves the incoming hero fit. The view model counts only the user club's licenses.
- Focused tests use real slot, identity, and refusal assertions.

Verdict: no blocking defect in the four fixes or atomic exchange.

## Suggestions and lead decisions

1. LOW: repeated exchange dispatch can turn the incoming hero back off. Accepted. Store now returns when an exchange already has the incoming hero licensed. The test repeats the same dispatch and requires the same career reference and no error. A separate test verifies an exchange cannot act as OFF.
2. LOW/product decision: retirement backfill selects the first same-role reserve rather than the strongest. Deferred. Preserving custom slots reveals that existing selection policy. It did not occur at the tested Season 1 boundary. Changing the shared backfill would need a separate balance decision and check.
3. Optional copy nit: an injured incoming hero with no other cover can receive a refusal that recommends a benched hero. Behavior is safe and leaves the career unchanged. Deferred; no additional eligibility restriction or copy expansion was added in this fix.

## Lead verification

Both actual Week 9 and Week 20 checkpoints pass verify-license-repair.cjs: no new player IDs, no cash change, valid team, incoming hero starts, unsafe second removal refuses, source bytes unchanged, zero fixtures simulated. Browser synthetic thin-exchange preview changes licenses Ed->Pip, starts Pip in the vacated defender slot, benches Ed, and retains 16 visible squad entries. The first assertion incorrectly expected a natural FWD label without the out-of-position prefix; the corrected assertion reads the actual label. This was a QA assertion error, not a game defect.
