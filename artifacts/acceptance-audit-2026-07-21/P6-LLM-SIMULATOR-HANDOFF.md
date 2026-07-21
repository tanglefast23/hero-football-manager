# Hero Football Manager — Phase 6 Simulator Recheck Handoff

You are the independent device QA operator. Test the already-built Release app; do not change product source, regenerate the app, update snapshots, commit, push, deploy, or change `ENGINE_VERSION`.

## Goal

Determine whether the post-audit fixes actually work in the real iOS Simulator. Automated tests and a successful build are supporting evidence only. Mark a row PASS only after performing the stated taps on the exact build and observing the expected player-visible or VoiceOver result.

## Frozen test target

- Repository: `/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager`
- Lead simulator: `HFM-audit-20260721-161945`
- Lead UDID: `308D7A7F-8375-418A-B7FC-56C2D59DEA63`
- Bundle ID: `com.tanglefast.herofootballmanager`
- Release build ID: `HFM-P6-124c056-ad87d3b73ee2`
- Built app: `/tmp/hfm-audit-cup-gates-20260721/Build/Products/Release-iphonesimulator/HeroFootballManager.app`
- Required embedded `main.jsbundle` SHA-256: `ad87d3b73ee2795567c3eb2a2db1bc42d49ff9f6f193fd51338500f48b691f7c`
- Existing launch evidence: `artifacts/acceptance-audit-2026-07-21/evidence/P6-CUP-GATE-RELEASE-HOME.png`

Before testing, verify the installed bundle rather than assuming it is current:

```sh
INSTALLED_APP="$(xcrun simctl get_app_container 308D7A7F-8375-418A-B7FC-56C2D59DEA63 com.tanglefast.herofootballmanager app)"
shasum -a 256 "$INSTALLED_APP/main.jsbundle"
```

If the hash does not match, stop and report **WRONG BUILD**. Do not silently rebuild or substitute a different simulator.

## Preferred simulator driver — verified live after this handoff was written

`xcodebuildmcp` 2.6.2 is installed in an npx cache and an existing daemon is live. A plain repo-local `npx --no-install xcodebuildmcp` may incorrectly report it missing or try the network, so discover/reuse the live cached package instead of trusting only that probe.

Verified package root on this host:

`/Users/joemacprom5/.npm/_npx/0d0ba08c6c224614/node_modules/xcodebuildmcp`

Verified capabilities:

- `build/cli.js` reports version `2.6.2` and exposes `ui-automation snapshot-ui`, element-ref taps/swipes/text entry, and screenshots.
- `bundled/axe describe-ui --udid …` returns the live simulator accessibility tree with role, label, value, enabled state, and frame.
- `bundled/axe tap -x N -y N --udid …` provides exact coordinate taps for the ADV-D01 overlap proof.
- `xcrun simctl ui … content_size` reports/changes the simulator text-size category.

Useful direct fallback commands:

```sh
XBMCP="/Users/joemacprom5/.npm/_npx/0d0ba08c6c224614/node_modules/xcodebuildmcp"
node "$XBMCP/build/cli.js" --version
"$XBMCP/bundled/axe" describe-ui --udid 308D7A7F-8375-418A-B7FC-56C2D59DEA63
"$XBMCP/bundled/axe" tap -x 200 -y 700 --udid 308D7A7F-8375-418A-B7FC-56C2D59DEA63
xcrun simctl ui 308D7A7F-8375-418A-B7FC-56C2D59DEA63 content_size
```

Do not stop or restart a daemon owned by another live session. If the CLI runtime reports a daemon conflict, use the raw bundled `axe` fallback or the already-working session rather than killing shared processes.

For rows 7, 8, 9, and 11, a matching-build accessibility-tree result may be recorded as **PASS (AX-tree evidence)** when it directly proves the requested count, role, label, enabled state, and grouping. Do not call synthesized speech or VoiceOver focus behavior verified; those remain **NOT VERIFIED audibly** without real VoiceOver on a physical device or a working host-control path.

## Loading a supplied save

The codec-validated starting states are in:

`/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/artifacts/acceptance-audit-2026-07-21/seeds/`

For each test, terminate the app, load the requested JSON into the one career slot, and relaunch. Resolve the data-container path again each time; installation can change it.

```sh
UDID="308D7A7F-8375-418A-B7FC-56C2D59DEA63"
BUNDLE_ID="com.tanglefast.herofootballmanager"
SEED="/absolute/path/to/the-requested-seed.json"
xcrun simctl terminate "$UDID" "$BUNDLE_ID"
APP_DATA="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
DB="$APP_DATA/Documents/SQLite/hero-football-manager.db"
sqlite3 "$DB" "PRAGMA wal_checkpoint(FULL); INSERT INTO career_saves (slot, schema_version, state_json) VALUES (1, 1, CAST(readfile('$SEED') AS TEXT)) ON CONFLICT(slot) DO UPDATE SET schema_version=excluded.schema_version, state_json=excluded.state_json;"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
```

After launch, use **Story → Continue** unless a row says otherwise. A generated seed is not proof; the required screen and behavior must be observed.

## Required checks

Run in this priority order. Record PASS, FAIL, or NOT VERIFIED for every row, with the exact action and actual result.

### 1. Season transition persistence — release blocker

- Seed: `season-end.json`
- Actions: Story → Continue → Begin the next season. Confirm Season 2 Week 1. Force-close the app, relaunch, Story → Continue.
- PASS only if it resumes Season 2 Week 1 with no save error and does not return to the Season 1 review.
- Capture before transition, Season 2, and post-relaunch Season 2 screenshots.

### 2. Chairman difficulty restoration

- Seed: `fresh-chairman.json`
- Actions: Story → Continue to character creation; inspect the selected difficulty and open Settings if needed.
- PASS only if Chairman is selected/restored, never Cozy.

### 3. Completed scout objective retirement

- Seed: `active-scout-mission.json`
- Actions: Story → Continue; inspect the Home inbox and Market scout desk.
- PASS only if the obsolete “Send your first scout” objective is absent while the active mission remains visible and truthful.

### 4. Awakening final reveal

- Seed: `onboarding-reveal.json`
- Actions: Story → Continue; complete all awakening beats and pause on the settled final card.
- Visual PASS: player name, power, story copy, license state, and Continue action are readable on a styled panel with visible padding and no dark-on-dark text or clipping.
- VoiceOver PASS: focus the final card/control and confirm its spoken name includes the player, power, reveal copy, license state, and action.

### 5. Opening roster truth

- Start a replacement story only far enough to view the opening brief; do not complete character creation.
- PASS only if it says exactly: “Fifteen players. Two open shirts. Zero heroes.”
- Any 16-player/one-opening wording is FAIL.

### 6. Temporary notice behavior

- Use a safe action that produces a success/info notice, such as saving a valid weekly plan.
- PASS only if the notice clears after about four seconds without input, does not remain pinned over the HUD, and VoiceOver reads one clean terminal punctuation mark.
- Error notices are allowed to remain sticky.

### 7. Facility labels and VoiceOver placement grid (F-D06)

- Seed: `week-15.json`
- Open Club, select an affordable facility, and enter placement mode.
- Confirm the facility card/confirmation speaks the visible action, footprint, build time, costs, and the real blocker. It must not say “Need $0 more.”
- With VoiceOver on, inspect occupied and empty grid cells across all 8 × 6 positions.
- PASS only if placement cells remain reachable as buttons with “Build at…” or “Blocked at…” labels, including cells under existing building footprints, while building controls themselves are hidden during placement.
- Record the exact number of reachable grid-cell buttons. Expected: 48.

### 8. Ledger row semantics (F-D07)

- Seed: `week-15.json`
- Open Club → Accounts Office and focus a noninteractive row such as Weekly Wages with VoiceOver.
- PASS only if it is announced as informational text with label and amount, not “button,” “dimmed,” or another disabled-control role.

### 9. Difficulty semantics (F-D08 polish)

- From any saved career, open Settings and focus Career difficulty with VoiceOver.
- PASS only if it is announced as informational text and includes Cozy or Chairman. Do not file a missing-state defect if the value is present in the spoken name.

### 10. Guided instruction and current-week copy

- Seeds: `onboarding-first-match.json`, then `match-week.json`.
- On the guided Home screen, VoiceOver must include Bert’s instruction in the relevant tab’s spoken name and that tab must still activate.
- On a current-week fixture card, visible and spoken copy must direct the player to “Use Advance Week below” rather than implying the card itself advances.

### 11. Post-match accessibility and signed TP movement (ADV-D02)

- Reproduce a settlement where a saved training plan costs more TP than the match awards. The previous reliable path was: load `week-15.json`, assign one player, select three drills for a 37-TP plan, save, then settle the match/Cup sequence.
- PASS only if the metric is labelled `TP CHANGE` and a negative value is shown as `−23`-style signed movement, never `+−23` and never `TP EARNED` for a net loss.
- With VoiceOver, verify the result, each ledger line, net cash change, TP change, fans, Close, and Continue are separately reachable in sensible order. The full modal must not collapse into one “Close match summary” element.

### 12. Inbox versus pinned Advance Week bar (ADV-D01)

- Seed: `week-2.json`
- At SYSTEM text size, scroll the Home inbox until the Training Ground proposal is near the bottom bar. Repeat at the largest supported text size.
- Tap only a visibly exposed part of the proposal card.
- PASS if the card opens the proposal and no visible card area routes to Advance Week.
- FAIL only with a screenshot immediately before the tap, the exact tap coordinate, and proof that the coordinate was visibly inside the card but Advance Week fired. The retained old screenshots alone do not prove overlap.

### 13. Separate League and Cup home gates (approved F-D14 rule)

- Seed: `week-5.json`. In this state both the Week 5 league fixture and Play-in Cup tie are home matches.
- Actions: Story → Continue → Advance Week; finish or Quick Result the league match; continue to the Cup match; finish or Quick Result it; inspect the final statement.
- PASS only if the same weekly statement contains two separate positive ticket lines: `League home gate` and `National Cup Play-in home gate`.
- Also verify the cash arithmetic includes both gates exactly once. A Cup win prize, if earned, must remain a separate prize line.

## Evidence and reporting contract

- Save screenshots under `artifacts/acceptance-audit-2026-07-21/evidence/` with names beginning `P6-RECHECK-`.
- Write the completed table to `artifacts/acceptance-audit-2026-07-21/P6-device-recheck.md`.
- For each row include: seed/build/UDID, exact taps, expected result, actual result, evidence filename, force-close result where required, and PASS/FAIL/NOT VERIFIED.
- Do not call a source inspection, generated seed, test, build, app launch, or screenshot-only observation a device PASS.
- Do not alter historical Phase 0–5 evidence or rewrite old FAIL rows. This is a new post-fix recheck.
- If macOS interaction or VoiceOver control fails, state the exact blocker and leave only the affected rows NOT VERIFIED. Continue every independent row that remains safely testable.
- Final verdict is **READY** only if the season-transition blocker passes and no new P0/P1 defect is found. Otherwise report **NOT READY**, with the minimum remaining manual checks.
