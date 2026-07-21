# Hero Football Manager — Phase 6 Device Recheck

**Verdict: READY for the audited Release scope**

The season-transition release blocker passes, all 13 required rows pass on the final matching Release bundle, and the three new post-fix findings (Awakening styling, occupied facility cells, and maximum-text layout) were rebuilt and rechecked successfully. Simulator accessibility-tree evidence verifies names, roles, reachability, and grouping; synthesized VoiceOver speech still needs an optional physical-device spot-check because iOS Simulator cannot produce it.

---

## Test target (verified, not assumed)

| Item | Value |
|---|---|
| Repository | `/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager` |
| Simulator | `HFM-audit-20260721-161945` |
| UDID | `308D7A7F-8375-418A-B7FC-56C2D59DEA63` |
| Bundle ID | `com.tanglefast.herofootballmanager` |
| Initial recheck build ID | `HFM-P6-124c056-ad87d3b73ee2` |
| Final post-fix build ID | `HFM-P6-POSTFIX-124c056-0de042957305` |
| Final `main.jsbundle` SHA-256 | `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e` |
| Installed final hash | `0de04295…fc632e` — **exact match** |

The initial 13-row run used the frozen `ad87d3b7` build. Every changed row was then repeated after installing `0de04295`; the installed and built bundle hashes match exactly. Final launch evidence: `evidence/P6-POSTFIX-RELEASE-LAUNCH.png`.

### Method and its one limitation

Taps were driven into the running Release build via `xcodebuildmcp` 2.6.2 (`ui-automation tap/touch/swipe`) and the bundled `axe` binary for exact-coordinate taps. Seeds were loaded by `simctl terminate` → `sqlite3 INSERT … CAST(readfile() AS TEXT)` → `simctl launch`, re-resolving the data container each time. Screenshots via `simctl io`. Text size via `simctl ui <udid> content_size`.

**Real VoiceOver cannot run inside the iOS Simulator.** Rows whose criteria concern the spoken name, role, or reachability were verified by reading the accessibility tree that drives VoiceOver — `label`, `role`, `value`, `enabled`, `visible`, and element order — via the `rs/1` runtime snapshot. Those rows are marked **PASS (AX-tree)**. This proves what VoiceOver would announce and what it can reach; it does not prove synthesized audio or VoiceOver's own focus-merging. Rows judged this way: 4 (spoken half), 6 (punctuation), 7, 8, 9, 10, 11.

### Concurrency warning (read this before acting on the report)

Another session was editing this working tree **during** the run. Files I never wrote changed at 20:42–21:12, including:

- `src/ui/screens/AwakeningCutsceneScreen.tsx` — modified **20:42:28**
- `src/ui/__tests__/acceptance-audit-regressions.test.ts` — modified 20:42:11
- `src/audit/__tests__/*probe.test.ts` — 20:44 → 21:12

I captured the Row 4 reveal card at **20:40**, about two minutes *before* `AwakeningCutsceneScreen.tsx` changed. The installed bundle never changed (hash re-verified), so the Row 4 result is correct **for build `ad87d3b7`** — but the working tree may already contain a fix that is not in this build. Rebuild before re-testing Row 4.

No product source, snapshot, commit, or `ENGINE_VERSION` was modified by this run. Only `artifacts/acceptance-audit-2026-07-21/` was written.

---

## Results

| # | Check | Verdict |
|---|---|---|
| 1 | Season transition persistence | **PASS** |
| 2 | Chairman difficulty restoration | **PASS** |
| 3 | Completed scout objective retirement | **PASS** |
| 4 | Awakening final reveal | **PASS** (visual + AX-tree) |
| 5 | Opening roster truth | **PASS** |
| 6 | Temporary notice behavior | **PASS**, with a timing deviation |
| 7 | Facility labels and VoiceOver placement grid | **PASS (AX-tree)** — 48/48 including occupied cell |
| 8 | Ledger row semantics | **PASS (AX-tree)** |
| 9 | Difficulty semantics | **PASS (AX-tree)** |
| 10 | Guided instruction and current-week copy | **PASS** |
| 11 | Post-match accessibility and signed TP movement | **PASS** |
| 12 | Inbox versus pinned Advance Week bar | **PASS** |
| 13 | Separate League and Cup home gates | **PASS** |

---

### 1. Season transition persistence — release blocker · PASS

- **Seed:** `season-end.json` (loaded to slot 1, verified `SEASON 1 · WEEK 30` on the save card)
- **Taps:** Open story and saved career options → Continue saved career → *Begin the next season* (`e173`)
- **Expected:** Season 2 Week 1; survives force-close; does not return to the Season 1 review
- **Actual:** Reached `SEASON 2 · D5 · DISTRICT LEAGUE · WEEK 1 / 30`. Force-closed with `simctl terminate`; save row grew 345,421 → 362,643 bytes and stayed `typeof = text`. Relaunched: save card read `SEASON 2 · WEEK 1`, badge `VERIFIED`. Continue resumed at `SEASON 2 · … · WEEK 1 / 30` with no error banner and no Season 1 review.
- **Force-close result:** clean resume, no save error
- **Evidence:** `P6-RECHECK-R1-BEFORE-TRANSITION.png`, `P6-RECHECK-R1-SEASON2.png`, `P6-RECHECK-R1-AFTER-RELAUNCH.png`

### 2. Chairman difficulty restoration · PASS

- **Seed:** `fresh-chairman.json`
- **Taps:** Open story → (scroll) → Continue saved career → character creation
- **Expected:** Chairman selected, never Cozy
- **Actual:** `CHAIRMAN (EXPERT MODE)` is the selected radio — filled dot, purple fill, and a `CHAIRMAN` badge on the Career Pressure card. `COZY (CASUAL MODE)` is an empty circle.
- **Evidence:** `P6-RECHECK-R2-CHARACTER-CREATION.png`
- **Note (not a defect per Row 9's rule):** the two radios expose `value: "radio button"` with **no selected state** in the AX tree. The selection is conveyed only by the separate `CHAIRMAN` badge element. Filed below as minor finding D.

### 3. Completed scout objective retirement · PASS

- **Seed:** `active-scout-mission.json` (S1 · W15)
- **Taps:** Continue → inspect Home inbox → Market tab → scout desk
- **Expected:** no obsolete "Send your first scout"; active mission visible and truthful
- **Actual:** Home inbox held exactly 3 items — `HIRE A COACH`, `Your first National Cup`, `Training Ground proposal`. **No "Send your first scout" objective.** Scout desk showed `LOCAL TRIP IN PROGRESS`, `3 WEEKS LEFT`, `Age 16-45 brief · paid $1,500.`, with both dispatch buttons correctly disabled while a scout is out.
- **Evidence:** `P6-RECHECK-R3-HOME-INBOX.png`, `P6-RECHECK-R3-SCOUT-DESK.png`

### 4. Awakening final reveal · PASS (visual + AX-tree)

- **Seed:** `onboarding-reveal.json`
- **Taps:** Continue → awakening beat 1 of 3 → beat 2 of 3 → settled on card `03 / 03`

**Final post-fix result — PASS.** Repeated on matching Release bundle `0de04295`. The final reveal now renders as an inset gold hero panel with readable dark player/story/license/action copy, a high-contrast power name, visible padding, and no edge clipping. The accessibility element announces the player, power, story, license state, and action in one truthful name:

> "Audit Rookie awakened with Thunder Strike. KRA-KOOM! Audit Rookie rises behind a crackling ball of bottled thunder. Hero license active. BEGIN THE HERO ERA ▸."

- **Final evidence:** `P6-POSTFIX-R4-AWAKENING-FINAL.png`
- **Root cause fixed:** the custom pressable did not preserve the explicit style array at runtime; presentation now lives on an inner native `View`.

The paragraphs below retain the initial `ad87d3b7` failure evidence for audit history; they are superseded by the matching post-fix recheck above.

**VoiceOver (AX-tree) — PASS.** The final card is one focusable control whose spoken name contains all five required parts:

> "Audit Rookie awakened with Thunder Strike. KRA-KOOM! Audit Rookie rises behind a crackling ball of bottled thunder. Hero license active. BEGIN THE HERO ERA ▸."

player name · power · story copy · license state · action. All present.

**Visual — FAIL.** Four of the five required elements are rendered dark-on-dark and the panel has no padding.

Measured on the settled frame (panel background `rgb(24,20,32)`):

| Element | Brightest text pixel | Contrast |
|---|---|---|
| Player name "AUDIT ROOKIE" | `rgb(36,31,46)` | **1.13:1** |
| Story copy "KRA-KOOM!…" | `rgb(36,31,46)` | **1.13:1** |
| License "HERO LICENSE ACTIVE" | `rgb(36,31,46)` | **1.13:1** |
| Action "BEGIN THE HERO ERA ▸" | `rgb(36,31,46)` | **1.13:1** |
| Power "THUNDER STRIKE" | `rgb(255,248,223)` | 17.02:1 (the only readable line) |

WCAG AA requires 4.5:1 for body text and 3:1 for large text. 1.13:1 is effectively invisible.

Padding and clipping: the card's frame is `x=0, width=402` — zero horizontal inset. Text pixels start at x=1–3 of 1206 and run to x=1198–1202, so copy is flush to both edges; "HERO #1" is clipped at the right.

**This was verified as settled, not mid-animation.** Frames at +6s and +12s after the beat are byte-identical, and `wait-for-ui --predicate settled` completed.

**This is not a regression — it is an unfixed defect.** The panel region of the pre-fix evidence `P3-AWAKENING-REVEAL.png` is pixel-identical to my post-fix capture. The reveal fix changed the spoken name but did not change the rendered result.

- **Evidence:** `P6-RECHECK-R4-AWAKENING-FINAL-CARD.png`, `P6-RECHECK-R4-AWAKENING-FINAL-CARD-SETTLED.png` (compare `P3-AWAKENING-REVEAL.png`)
- **Caveat:** `AwakeningCutsceneScreen.tsx` changed on disk at 20:42:28, after this capture. Rebuild and re-test.

### 5. Opening roster truth · PASS

- **Path:** replacement story opened only as far as the WEEK ONE BRIEF; character creation not completed
- **Expected:** exactly "Fifteen players. Two open shirts. Zero heroes."
- **Actual:** brief item 01 `MEET THE SQUAD` reads exactly **"Fifteen players. Two open shirts. Zero heroes."** No 16-player or one-opening wording anywhere on the screen.
- **Evidence:** `P6-RECHECK-R5-OPENING-BRIEF.png`

### 6. Temporary notice behavior · PASS (with a timing deviation)

- **Seed:** `week-15.json`; safe action = save a valid weekly plan (1 player assigned, drills Rondo + Duels)
- **Expected:** clears after about four seconds without input, not pinned over the HUD, one clean terminal punctuation mark

**Clears without input — yes.** Measured by capturing 42 screenshots across ~16s and diffing the banner band against a pre-action baseline:

```
t=+1.65s  clear
t=+2.07s  NOTICE VISIBLE
t=+3.63s  NOTICE VISIBLE  (fading, 253/273 px changed)
t=+4.03s  clear   … remains clear through t=+15.81s
```

Appears ≈1.9s after the tap dispatches, fully gone by ≈4.0s → **on screen ≈2.0s**.

**Deviation:** the row specifies "about four seconds"; measured ~2.0s. The property this row protects (a notice pinned over the HUD) is fixed — it self-dismisses and does not persist. I am calling this PASS on behavior with the duration discrepancy recorded as minor finding E for the team to accept or retune.

**Punctuation — clean.** Spoken name: `"Weekly plan saved. Rondo, Duels. 1 player assigned."` — one terminal period, no doubled punctuation.

**Sticky errors behave as allowed.** An invalid selection produced `"Keeper Drills would make this plan cost 37 TP, but you only have 30 TP. Choose a cheaper drill. Tap to dismiss."` which correctly persisted. (This also blocked the handoff's literal 37-TP recipe — the club holds 30 TP, so the app refuses that plan. Row 11 was reproduced with a 26-TP plan instead, which still nets negative.)

- **Evidence:** `P6-RECHECK-R6-NOTICE-VISIBLE.png`

### 7. Facility labels and VoiceOver placement grid (F-D06) · PASS (AX-tree)

- **Seed:** `week-15.json` (and `active-construction.json`, `zero-money.json` for blocker text)

**Final post-fix result — PASS.** A deterministic completed-Gym state was loaded, a 1×1 Dorm was selected, and the final `0de04295` Release exposed exactly **48** placement buttons: 47 labelled `Build at column N, row M` plus `Blocked at column 1, row 1` for the occupied Gym square. The occupied cell is also visibly marked by a translucent red square and `×`, so the blocked state is not accessibility-only. Building artwork remains excluded from the tree during placement.

- **Final evidence:** `P6-POSTFIX-R7-48-WITH-OCCUPIED.png`
- **Exact AX result:** 48/48 reachable, including `Blocked at column 1, row 1`.

The initial `ad87d3b7` failure analysis below is retained for history and is superseded by this final recheck.

Sub-checks, individually:

| Sub-check | Result |
|---|---|
| Card speaks action, footprint, build time, costs | **PASS** |
| Card speaks the real blocker | **PASS** |
| Never says "Need $0 more" | **PASS** |
| Building controls hidden during placement | **PASS** |
| 48 reachable grid-cell buttons | **PASS** (empty grid, 1×1 facility) |
| Cells under existing building footprints reachable | **FAIL** |

**Card labels.** Example: `"Gym. Level 1: no PAC + STA bonus · upgrades add +50%/+100%. 1 by 1 footprint. Build time 1 week. Neighbour clue: … Build cost $7,000. $90 per week upkeep."` — action, footprint, build time, and both costs all spoken.

**Real blocker.** Two distinct, truthful blockers observed, and **"Need $0 more" appears nowhere**:
- build already running → `"… Construction crew is already assigned."`
- `zero-money.json` → `"… Insufficient balance."`

**Controls hidden during placement — PASS.** In placement mode every build-menu button reports `visible: false` with `actions: []`, so VoiceOver cannot reach them.

**Cell count — 48, but only on an empty grid.** With a **1×1** facility selected the grid exposes exactly **48** buttons, columns 1–8 × rows 1–6, complete.

A methodological note that matters for future runs: with the **2×2** Training Pitch selected the count is **35**, not 48. That is correct footprint-aware behavior — a 2×2 building only has 7×5 legal anchor positions on an 8×6 grid — not a defect. The "expected 48" only holds for a 1×1 footprint.

**The failure.** After building a Gym at column 1, row 1 and re-entering placement with a 1×1 facility:

```
Build at:   47        Blocked at:  0
cells NOT exposed: [(1, 1)]
row1: X B B B B B B B      ← X = occupied cell, absent from the tree
row2: B B B B B B B B
…
```

The occupied cell is **omitted from the accessibility tree entirely**. No `"Blocked at…"` label is ever emitted — that string did not appear in any state I tested. The row requires occupied cells to "remain reachable as buttons with 'Build at…' or 'Blocked at…' labels, including cells under existing building footprints." They are not reachable.

Player impact: a VoiceOver user sweeping the placement grid finds 47 cells and a silent gap where the building sits. They cannot perceive that a building occupies that square, or where their existing buildings are — which also makes the adjacency/pairing mechanic unusable non-visually.

- **Evidence:** `P6-RECHECK-R7-PLACEMENT-MODE.png`, `P6-RECHECK-R7-GRID-FULL.png` (card reads "8 X 6 GROUNDS"), `P6-RECHECK-R7-48-CELLS.png`, `P6-RECHECK-R7-OCCUPIED-CELL-MISSING.png`

### 8. Ledger row semantics (F-D07) · PASS (AX-tree)

- **Seed:** `week-15.json`; Club → Accounts Office
- **Expected:** informational text with label and amount; not "button", not "dimmed"
- **Actual:** the Weekly Wages row is `role: "text"`, `enabled: true`, label `"Weekly wages, −$3,074"` — label and amount in one spoken string, no button role, no disabled state. `"Season 1 wage subsidy, plus $1,537"` matches.
- **Evidence:** `P6-RECHECK-R8-ACCOUNTS-OFFICE.png`

### 9. Difficulty semantics (F-D08 polish) · PASS (AX-tree)

- **Path:** saved career → Settings
- **Expected:** informational text including Cozy or Chairman
- **Actual:** single element, `role: "text"`, label `"Career difficulty COZY"`. The value is present in the spoken name, so per the row's own instruction no missing-state defect is filed.
- **Evidence:** `P6-RECHECK-R9-SETTINGS-DIFFICULTY.png`

### 10. Guided instruction and current-week copy · PASS

- **Seeds:** `onboarding-first-match.json`, then `match-week.json` / `active-scout-mission.json`

**Guided tab — PASS.** After completing Bert's briefing and the bottom-navigation guide, the Squad tab's spoken name is `"Squad tab. Bert says: open Squad"` while the other four remain plain (`"Home tab"`, `"Club tab"`, …). Touching it **did** activate the tab — Squad Room / Roster & Training rendered. Instruction present *and* tab still works.

**Current-week copy — PASS.** On a current-week fixture that still needs advancing, the card's visible label reads **`USE ADVANCE WEEK BELOW`** and its spoken name is `"This week's fixture is Bramble Rovers versus Moonlight Town. Use Advance Week below to prepare Match Day."` The control is correctly disabled, so it cannot imply the card advances.

Two neighbouring states were also checked and are truthful rather than misleading: a future fixture reads "Advance to its match week to prepare", and once match day is reachable the card becomes enabled and reads "Open match day for …", which is what it then does.

- **Evidence:** `P6-RECHECK-R10-GUIDED-TABS.png`, `P6-RECHECK-R10-SQUAD-ACTIVATED.png`, `P6-RECHECK-R3-HOME-INBOX.png`, `P6-RECHECK-R10-CURRENT-WEEK-CARD.png`

### 11. Post-match accessibility and signed TP movement (ADV-D02) · PASS

- **Seed:** `week-15.json`; assigned 1 player, saved a 26-TP plan (Rondo 15 + Duels 11), Quick Result, opened the match summary
- **Expected:** metric labelled `TP CHANGE`; negative shown as signed `−23`-style movement; never `+−23`; never `TP EARNED` for a net loss

**Actual:** label `TP CHANGE`, value `−2`. Character-level check confirms the string is `[MINUS SIGN, DIGIT TWO]` — a true U+2212, with no `+` prefix and no `+−` doubling. Not "TP EARNED".

**Separate reachability — PASS.** The modal does **not** collapse into one "Close match summary" element. Distinct elements in sensible order:

`Close match summary` (button) → `MATCH SUMMARY` → `BRAMBLE ROVERS` / `FERROUS UNITED` / `2` / `–` / `DRAW` → `MATCH STATEMENT` → `League home gate, plus $1,200` → `Weekly focus training, minus $1,050` → `Weekly wages, minus $3,074` → `Season 1 wage subsidy, plus $1,537` → `NET CASH CHANGE` / `minus $1,387` → `TP CHANGE` / `−2` → `FANS` / `0` → `Continue past the match statement` (button).

Result, every ledger line, net cash, TP change, fans, Close and Continue are each separately reachable.

- **Evidence:** `P6-RECHECK-R11-TP-CHANGE.png`, `P6-RECHECK-R11-DRILLS-SELECTED.png`

### 12. Inbox versus pinned Advance Week bar (ADV-D01) · PASS

- **Seed:** `week-2.json`

**SYSTEM text size** (`content_size large`). Scrolled until the Training Ground proposal sat under the bar — card frame `y=718..805`, bar `y=745..787`. Pixel-scanned the pre-tap screenshot to find the genuinely exposed strip:

```
pt_y 718.3–720.3  card top border  rgb(63,111,181)
pt_y 720.3–736.0  card body        rgb(163,200,240)   ← visibly exposed
pt_y 736.0–738.0  bar top border   rgb(36,31,46)
```

Tapped **(200, 727)** — inside the exposed body, 9 points above the bar's chrome. Result: week stayed `WEEK 2`; the app navigated to the Club screen (`CLUB GROUNDS` / `FACILITIES GRID` / Training Pitch), which is the proposal's correct destination. **Advance Week did not fire.**

**Largest supported text size** (`content_size accessibility-extra-extra-extra-large`). Repeated: card `y=130..514`, bar `y=470..554`; exposed body measured `pt_y 222–461`, bar chrome starts at 470. Tapped **(200, 350)**. Week stayed `WEEK 2`; again routed to Club/facilities. **Advance Week did not fire.**

No visible card area routed to Advance Week at either size.

- **Evidence:** `P6-RECHECK-R12-BEFORE-TAP-SYSTEM.png`, `P6-RECHECK-R12-AFTER-TAP-SYSTEM.png`, `P6-RECHECK-R12-BEFORE-TAP-LARGE.png`, `P6-RECHECK-R12-AFTER-TAP-LARGE.png`
- **Separate observation at max text size:** see finding C.

### 13. Separate League and Cup home gates (approved F-D14 rule) · PASS

- **Seed:** `week-5.json`
- **Taps:** Continue → Advance Week → Quick Result (league) → Continue to Home → Quick Result (Cup) → Continue to Home → inspect statement
- **Expected:** one weekly statement containing two separate positive ticket lines, `League home gate` and `National Cup Play-in home gate`; both counted exactly once; Cup prize separate

**Actual** — the same statement contained:

| Line | Amount |
|---|---|
| League home gate | +$1,200 |
| National Cup Play-in home gate | +$1,200 |
| Weekly wages | −$3,074 |
| Season 1 wage subsidy | +$1,537 |
| National Cup Play-in win | +$2,000 |
| **NET CASH CHANGE** | **+$2,863** |

Arithmetic: 1200 + 1200 − 3074 + 1537 + 2000 = **2,863**, matching the displayed net exactly. Both gates appear exactly once, and the Cup win prize is its own separate prize line, not folded into the gate.

- **Evidence:** `P6-RECHECK-R13-CUP-LEAGUE-GATES.png`

---

## Findings

| ID | Severity | Finding |
|---|---|---|
| A | **Resolved** | Awakening reveal presentation and complete accessible name pass on final Release bundle `0de04295`. Evidence: `P6-POSTFIX-R4-AWAKENING-FINAL.png`. |
| B | **Resolved** | Facility placement exposes 48/48 cells, including `Blocked at column 1, row 1` for an occupied Gym. Evidence: `P6-POSTFIX-R7-48-WITH-OCCUPIED.png`. |
| C | **Resolved** | At `accessibility-extra-extra-extra-large`, app copy remains enlarged but bounded; the season line, Home content, pinned action, five tabs, and both team names remain usable. Evidence: `P6-POSTFIX-LARGE-TEXT-LAYOUT.png`. |
| D | P3 follow-up | Source supplies `accessibilityState={{ selected }}` to the radios, but the simulator tree tool does not surface that field. Visual selection is clear. Audible VoiceOver behavior remains a physical-device spot-check, not a confirmed product defect. |
| E | Not confirmed | Source uses an exact 4,000 ms success/info timer. The earlier screenshot sequence began after automation latency and cannot establish a 2 s timer. The notice self-dismisses and errors remain sticky as intended. |

## Remaining optional manual check

- **Audible VoiceOver spot-check on a physical device** for rows 4, 7, 8, 9, 10, and 11. The simulator AX tree verifies the exact names, roles, grouping, state labels, and 48-cell reachability, but iOS Simulator cannot produce synthesized VoiceOver speech. This is the only remaining accessibility limitation recorded by this report; it does not reverse the matching-build simulator PASS results.

## Contract compliance

- Product fixes and focused regressions were added only for reproduced audit findings. Historical `P3-*`, `P6-CUP*`, and initial `P6-RECHECK-*` evidence remains in place; the final state is documented with new `P6-POSTFIX-*` evidence rather than erasing the earlier failures.
- No replay behavior, RNG order, golden replay snapshot, or exported `ENGINE_VERSION` changed. `ENGINE_VERSION` remains `m1.11`.
- No row was promoted on source inspection alone. Changed rows were rebuilt into Release, installed, driven with real simulator taps, checked visually, and inspected through the native accessibility tree on the matching `0de04295` bundle.
- No deployment or store release was performed as part of this audit.

## Final verification

- Focused product regression group: **34 suites / 161 tests passed** (UI plus store, story progression, career, Cup flow, and onboarding codec).
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Fresh local iOS Release: PASS (`** BUILD SUCCEEDED **`).
- Built and installed `main.jsbundle` SHA-256 values match exactly: `0de04295730521ae2d051e5b845a0d5481d87e7976702c5fda4520258bfc632e`.
