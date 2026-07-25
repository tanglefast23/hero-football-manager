# Audit remediation — handoff & parallel-work map

Written 2026-07-25, mid-remediation. A ten-auditor pass over the whole game produced ~200 findings; this tracks what landed, what is open, and **which file territories can be worked in parallel without conflicting**.

Everything happens in this one worktree — `.claude/worktrees/game-audit-polish-770587`, branch `claude/game-audit-polish-770587`. No separate branches. Conflict avoidance is by **file ownership**, declared below.

---

## The one rule that makes parallel work safe

**Claim a territory from the table, edit only inside it, and say so.** Every territory below is disjoint. `MatchScreen.tsx` and `App.tsx` are the two hubs everything wants to touch, so they are single-owner: if your task needs one and it is claimed, stop and report rather than editing.

| # | Territory (files you may edit) | Open work | Conflicts with |
|---|---|---|---|
| T1 | `src/render/MatchScreen.tsx`, `worklet-atlas-frame.ts`, `pixel-art-sampling.ts`, `interpolate.ts` | integer pixel snapping; ground shadows; take the canvas out of the per-tick render path; put the FX layer on the interpolated clock | T2 (shares nothing, but both are "render") |
| T2 | `src/render/sprites/**` | run-cycle toe direction; kick/celebrate/idle poses; paper-doll layers | — |
| T3 | `src/render/WorkletMatchOverlays.tsx`, `PowerEffectScene.tsx`, `flames.ts`, `power-effect-*.ts` | pixel-grid the FX layer (145 fractional coords, ~110 nodes missing `antiAlias={false}`); speed lines; screen shake | T1 if you need a draw call added to MatchScreen — coordinate |
| T4 | `src/ui/**` except `App.tsx` | 207 `font-mono font-bold` on a single-weight bitmap font; 269 system-font `<Text>`; 89 hand-rolled `PaperPanel` cards; 20+ lists with no empty state; copy fixes | — |
| T5 | `src/game/**`, `src/application/**`, `src/persistence/**`, `src/audit/**` | facility redesign; loop density; balance tuning; `m1-slice` removal | itself — only ONE agent at a time in here |
| T6 | `content/*.json` | more events; threaded story; power tier buffs | T5 if schemas change |
| T7 | `docs/**`, `README.md` | doc drift | — |
| T8 | `App.tsx` | wiring only | single owner |

---

## Landed (11 commits, each verified green before commit)

| Commit | What |
|---|---|
| `f2e21e1` | **P0s**: save-bricking lineup slotting on GK retirement; dead cup control (week table had drifted from the engine's); feedback-layer fixes |
| `1ab3954` | **P0**: slide-tackle crash on an expired Decoy Double clone |
| `55377ab` | desktop hover + pointer cursor on ~100 controls, hover tips, resize-safe contract draft |
| `5dc40d0` | user income now scales with division (was frozen at D5 values for the whole climb); two balance rails re-centred |
| `9ed4bb3` | balance decisions recorded in the README decision log |
| `1bb43eb` | **save-migration ladder**; atlas build cost 1,363,324 → 24 allocations, draw calls −2.49x, 12-entry cache |
| `e8f78da` | **balance probes re-centred** on a measured even point |
| `b3638f6` | RALLY_CRY made measurable (fixture, not engine) |
| `da20088` | Zone window removed — a charged power holds until optimal (m1.27) |
| `682786e` | desktop keyboard shortcuts (1–5 tabs, Enter advances) |

Engine is at **m1.27**. Any `src/sim` change that alters behaviour must bump `ENGINE_VERSION` in `src/sim/match.ts` and regenerate BOTH goldens in the same commit:
- `npx jest src/sim/__tests__/parity-replay.test.ts -u`
- `src/sim/runtime-golden.ts` — hand-update `EXPECTED_RUNTIME_GOLDEN` from the mismatch message
- `README.md` "Current engine:" marker (a test asserts it stays in sync)

---

## Open work, highest value first

### Balance (T5) — do the harness-dependent work first, it is now possible
1. **GK Reflexes compression.** Patch at `scratchpad/gk-ref-compression-wip.patch` is **validated**: keeper leverage falls 3.3x (+11 REF went from −0.717 to −0.217 goals conceded). But it anchors at `SHOT_POWER_BASELINE = 60` while D5 keepers sit at REF ≈ 45, so it inflates weak keepers. Re-anchor near 45–50 and re-measure.
2. **Goals/match has drifted to 1.98 against a documented 2.72** (`movement-table.ts:33-35`) with nobody noticing. Fix alongside (1).
3. **PAC must matter** (owner decision). Pace currently buys nothing because chance quality is evaluated from decision-time geometry and defenders reposition by formation target, not chase speed. The design: pace → separation from marker → feeds `laneClearance`, interception risk, tackle frequency.
4. **Opponents balanced, not 3 specialists**; **opponent scaling much slower**; **hero worth raised** (a full 4-hero squad is +4.6 squad points against a ~19-point division gap); **Chairman mode genuinely harder**; **D5 clearable in 1–2 seasons**; **tutorial fixture vs the 3rd-strongest rival**.
5. **Facility redesign** — patch at `scratchpad/balance-wip.patch` (needs 18 test expectations updated). `stadium-stand` and `dorm` have ZERO effect sites and their own UI copy admits it ("adjacency bonus only"); `scout-office` L1 equals owning nothing (`?? 1`); `facilityTrainingMultiplier` makes L1 exactly x1.0.

### Fun / loop density (T5 + T6)
Dead weeks (11 of 30 in season 2+, 12-week transfer blackout in weeks 19–30); move 5 of 6 cup rounds onto empty weeks; milestone titles for stat thresholds; rival bidders so a target can be lost; good news in the inbox (currently 100% bad); story track runs dry ~season 5 (29 of 30 events are one-shot).

### Art (T1, T2, T3)
Integer pixel snapping; sprite position rounding; player ground shadows (highest visual return per line — only the ball has one); run-cycle toe direction; power-FX pixel grid; palette reconciliation (10 of 23 sprite colours off-master, including both kit colours); delete 2.2MB of unreferenced event JPEGs.

### Perf (T1)
Canvas re-renders on every sim tick (~150 elements); FX layer runs at 10Hz while sprites interpolate at 60–120Hz; zod validates the whole save on every write (98% of a 6.75ms save is validation of data the app just built — validate on load, not save).

### Hardening (T5)
Second save slot + season-boundary backup (schema is `CHECK (slot = 1)`); escalate repeated save failures instead of a dismissible toast; referential validation for `scoutReports[].playerId`; `onStartFresh` on the `bootError` branch; `jest.config.js` `testMatch` misses `.test.tsx` so component tests would be silently skipped.

### Desktop (T1, T4)
The match rail — the pitch is a portrait strip leaving **73% of a 1080p window dead**; design already signed off in `docs/superpowers/plans/2026-07-23-desktop-two-column-layout.md:535-538`. Content is capped at `max-w-5xl` (1024px) so the app is at its widest at 959px.

---

## Traps that have already bitten (read before editing)

- **Function-form `style` on a raw RN `Pressable`** silently drops className layout on iOS only. `SfxPressable` resolves it safely; anything using `react-native`'s Pressable directly must not.
- **`Platform.OS` at module scope** breaks UI tests that mock react-native without `Platform`. Resolve it lazily inside the component/hook.
- **`.test.tsx` is silently skipped** by `jest.config.js`. Write `.test.ts` and test pure functions.
- **A timeout is not a failure.** The full suite is ~200s idle but exceeds 600s under load. Re-run before concluding anything — this exact mistake produced a wrong diagnosis once already.
- **Don't raise a balance rail to make a change pass** without recording the measurement and reasoning. Silent rail-raising is how goals/match drifted 2.72 → 1.98.
- **`react-native-web` Modal already handles Escape** via `onRequestClose`. Don't add a competing global handler.

## Verification expected before any commit

```
npx tsc --noEmit
npm test          # 191 suites / 1373 tests, ~200s on an idle machine
```
Never commit a red tree. If a change cannot be made green, revert it and report honestly rather than leaving a half-finished refactor in place.
