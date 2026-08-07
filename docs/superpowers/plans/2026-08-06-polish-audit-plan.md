# Polish Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. This plan produces a REPORT, not product-code changes —
> rule 6 of the spec (no fixes during the audit) overrides any instinct to repair what you find.

**Goal:** Execute the adversarial polish audit defined in `2026-08-06-polish-audit-spec.md`
against build `96f45b1f` and deliver `2026-08-06-polish-audit-report.md` (scorecard, findings,
10 blockers, fix plan, retest protocol, red-team artifacts) plus three committed measurement
harnesses.

**Architecture:** Evidence flows from four surfaces (static web export, iOS Simulator Release
build, headless Node probes, asset forensics) into a findings ledger, which the red-team pass
hardens into the report. The physical-device tier is pre-registered as blocked (phone offline).
Plan-level review: Grok + Opus council before execution; report-level review: Grok after.

**Tech Stack:** Expo 57 / RN 0.86 / TS; chrome-devtools MCP + claude-in-chrome for web driving;
`xcrun simctl` + xcodebuild (Release-iphonesimulator); jest probes (`npm run test:probe`);
ffmpeg/ffprobe/ImageMagick forensics; `gh` for the PR.

**Status:** APPROVED — Revision 4 (2026-08-07). Council per owner instruction: Grok +
Opus 5 (Codex excluded mid-run by the owner; its partial round killed and discarded).
Grok: REVISE→REVISE→APPROVED (approved revision 2). Opus 5 (xhigh): REVISE→APPROVED
(approved revision 3; its four non-blocking nits are folded into this revision 4 —
lockfile-drift guard, controlledMatchOptions in the probe, de-duplicated probe flag, 22
overlays). Grok was not re-consulted after revision 2 per sticky-approval protocol.
Post-implementation report review: Grok only.

---

## Fixed paths and names (used consistently below)

- Build under test: `96f45b1f` (branch fast-forwarded from `aed2bc78` to origin/main on
  2026-08-07; the two new commits touch i18n catalogs and UI only — no `src/sim`/`src/game`)
- `WT` = `/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/.claude/worktrees/contract-renewal-audit-1be55f`
- `MAIN` = `/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager` — **read-only to this
  audit**: it is the tree Joe's phone server ships from and may sit at any commit. The only
  permitted access is COPYING `ios/` out of it. Never build, pod-install, pull, or delete
  anything inside MAIN.
- `SCRATCH` = the session scratchpad directory (bulk captures, DerivedData; never committed)
- `EVID` = `WT/artifacts/polish-audit-2026-08-06/` (committed evidence: PNGs, JSON, tables)
- Ledger = `SCRATCH/findings-ledger.md` (working notes; the report is its curated form)
- Branch: `claude/polish-audit-plan-d7cfff` — commits happen ONLY here
- Sim: create `HFM-Polish-20260806` from the iPhone 17 device type; layout sweeps additionally
  boot iPhone 17 Pro Max, iPhone 17e, iPad Pro 11-inch (M5); every booted sim is shut down at
  the end of the session that booted it

## What we are NOT doing

> **Owner revision, 2026-08-07 (supersedes the first bullet):** after the evidence phases,
> FIX the findings on this branch and verify each fix on real surfaces (chrome-devtools web,
> iOS simulator, Vercel), iterating until every axis reachable from this machine meets a high
> 10/10 polish standard; then Grok audits the finished work, then commit + PR. The remaining
> guardrails below still hold (canon fence, no sim-ring changes without an ENGINE_VERSION
> decision, balance harness green, i18n catalogs complete for any new string).

- ~~No product-code fixes~~ (superseded above) — still no balance changes, and no
  ENGINE_VERSION bump (nothing sim-affecting ships here).
- No physical-device runs (offline; would need Joe + approval), no store-asset production,
  no Steam/Electron scaffolding, no new dependencies (`npx serve` uses the npx cache — the
  established recipe; nothing is added to package.json).
- No re-litigating canon (spec rule 9): canon collisions go to report §8.2b.

---

### Task 0: Preflight and surface stand-up (spec Phase 0) — est. 35–50 min

**Files:** none created except `EVID/surface-log.md`.

- [ ] **Step 1: Verify worktree + branch are what the spec says**

Run: `cd "$WT" && git rev-parse --abbrev-ref HEAD && git rev-parse HEAD && git status --short`
Expected: `claude/polish-audit-plan-d7cfff`, `96f45b1f…`, only the audit docs untracked.

- [ ] **Step 2: TWO fresh static web exports, into SCRATCH**

```bash
cd "$WT" && npm run export:web && mv dist "$SCRATCH/dist-clean"          # ship-parity build
EXPO_PUBLIC_DEV_HARNESS=1 npm run export:web && mv dist "$SCRATCH/dist-harness"
node scripts/qa/ipad-pwa-audit.mjs --dist "$SCRATCH/dist-clean"
```
Both exports are built fresh HERE — never reuse a preflight `dist/` (no commit stamp inside;
unverifiable provenance). They land in `$SCRATCH`, not the worktree: `.gitignore` covers only
`dist/` and `tsconfig.json` excludes only `dist`, so renamed copies inside the worktree would
put two 26MB minified trees under `npx tsc --noEmit` (the pre-commit guard) and into
`git status`.
Expected: both exports exit 0 with `index.html`, `_expo/`, `canvaskit.wasm`; the ipad harness
exits 0 (a FAIL is itself an audit finding, record it). The harness flag is inlined at bundle
time (App.tsx:253) and makes DevHarnessApp the ROOT of `dist-harness` — that build contains
authored states ONLY, no playable game. Perf/pacing/cold-start/bundle-weight evidence comes
ONLY from `dist-clean`; ALL live-play evidence (including every mid-match interaction) also
comes from `dist-clean`.

- [ ] **Step 3: Serve both WITH ship headers, open muted, prove the gates**

Vercel ships `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
credentialless` on every response (`vercel.json`) — cross-origin isolation changes wasm/OPFS
capability, so a bare `npx serve` is NOT ship parity. Write this `serve.json` into BOTH
scratch dirs, then serve:
```json
{ "headers": [ { "source": "**", "headers": [
  { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
  { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" } ] } ] }
```
`npx serve "$SCRATCH/dist-clean" -l 4173` and `npx serve "$SCRATCH/dist-harness" -l 4174`,
PIDs recorded in `$SCRATCH/serve-pids.txt`.
Open `http://localhost:4173` via chrome-devtools MCP (fallback: claude-in-chrome; last resort:
browser pane with its traps acknowledged). Immediately run in page:
`document.querySelectorAll('audio,video').forEach(el => el.muted = true)`.
Phase-0 gates, all recorded in the surface log:
1. `crossOriginIsolated === true` on 4173 (if false, scope every parity claim accordingly);
2. harness gate both ways: `4174/#/dev` renders the harness menu; 4173 boots the game and
   `#/dev` does nothing there;
3. **career persistence, empirically**: start a career on 4173, hard-reload — does it
   survive? The code says it should (SQLite over OPFS, `src/persistence/persistent-storage.ts`;
   `requestPersistentStorage()` at App boot), and `DEVELOPER_MODE_AVAILABLE = true`
   (`src/ui/release-surface.ts:28`) ships a save/load slot rail in static web exports — the
   sanctioned way to hold mid-career states. Record the observed behavior; Task 4 and axis H
   both key off this result.
Record which Chrome surface is actually in use (the browser pane forces phone layout). If a
serve dies between phases (session reaper), `curl -s` the port before each capture batch and
restart the dead one.

- [ ] **Step 4: Vercel parity check**

Run: `curl -sI -m 8 https://hero-football-manager.vercel.app | head -3` → HTTP 200.
Vercel deploys origin/main = `96f45b1f` = this branch. Re-verify origin/main hasn't advanced
(`git fetch origin main --quiet && git rev-parse origin/main`); if it has, note the drift in
the surface log and keep auditing `96f45b1f` from the local exports — do not chase the tip
mid-audit. Expect `#/dev` to be DEAD on Vercel (no harness flag in the production export).

- [ ] **Step 5: Build the Release sim app via the WORKTREE recipe (MAIN is read-only)**

The recorded recipe's traps, all honored here: `ios/devbuild` (1.7G) and `ios/simbuild`
(7.4G) are stale products that must NOT be copied; `ios/build/generated` (ReactCodegen, 248K)
MUST be copied; the worktree `node_modules` is systematically thinner than main's
(expo-modules-jsi, PrivacyInfo files, RN scripts), so main's is rsync'd over it — read-only
extraction from MAIN, same standing as the `ios/` copy; the poisoned cache is
`node_modules/expo-modules-jsi/apple/.DerivedData` in the BUILD tree; and `| tail` masks the
exit code, so the build logs to a file and the exit code is checked explicitly.

```bash
rsync -a --exclude devbuild --exclude simbuild "$MAIN/ios/" "$WT/ios/"   # includes build/generated
# node_modules sync is valid ONLY while the lockfiles are byte-identical (recorded recipe
# precondition — MAIN may move mid-audit):
cmp -s "$MAIN/package-lock.json" "$WT/package-lock.json" \
  && rsync -a "$MAIN/node_modules/" "$WT/node_modules/" \
  || { echo "LOCKFILE DRIFT — recording in surface log; npm ci instead"; npm ci; }
rm -rf "$WT/node_modules/expo-modules-jsi/apple/.DerivedData"
cd "$WT" && export LANG=en_US.UTF-8
# pod install inside "$WT/ios" ONLY if xcodebuild demands it; on pod drift delete the
# COPY's Podfile.lock (never MAIN's), then pod install again.
xcodebuild -workspace ios/HeroFootballManager.xcworkspace -scheme HeroFootballManager \
  -configuration Release -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO \
  -derivedDataPath "$SCRATCH/DerivedData" build > "$SCRATCH/xcodebuild.log" 2>&1; \
  echo "EXIT:$?"; tail -5 "$SCRATCH/xcodebuild.log"
```
Expected: `EXIT:0` + `** BUILD SUCCEEDED **` (10–25 min; MAIN's phone loop never disturbed).
Record the built .app's on-disk size (`du -sh …/HeroFootballManager.app`) — the 60MB-budget
proxy (label: proxy; an IPA differs).

- [ ] **Step 6: Boot the audit sim BY UDID and install**

```bash
SIM_UDID=$(xcrun simctl create HFM-Polish-20260806 "iPhone 17") && \
  echo "$SIM_UDID" > "$SCRATCH/sim-udid.txt" && xcrun simctl boot "$SIM_UDID"
xcrun simctl install "$SIM_UDID" "$SCRATCH/DerivedData/Build/Products/Release-iphonesimulator/HeroFootballManager.app"
xcrun simctl launch "$SIM_UDID" com.tanglefast.herofootballmanager
xcrun simctl io "$SIM_UDID" screenshot --type=png "$EVID/boot-title.png"
```
Every later simctl call addresses `$SIM_UDID`, never the name — parallel sessions have
clobbered by-name lookups before. Expected: title screen PNG. (Simulator MCP `attach`
optional — Joe is not watching live.)

- [ ] **Step 7: Confirm the device tier is blocked and say so**

Run: `xcrun xctrace list devices 2>&1 | sed -n '/Devices Offline/,+2p'`
Expected: `Joes iphone` offline. Write `EVID/surface-log.md`: one line per surface
(web-local / web-vercel / sim / node-probes / device / forensics), status, and the axis coverage
map (spec §8.0 source). **Report phase status to the user before continuing.**

### Task 1: Inventory (spec Phase 1) — est. 20 min

**Files:** `EVID/inventory.md`.

- [ ] **Step 1: Screen graph.** Read `src/ui/ManagementShell.tsx` (tab structure) and list:
25 files in `src/ui/screens/`, shell overlays/modals in `src/ui/*.tsx` (22), match layer
(`src/render/MatchScreen.tsx` + overlays), dev-harness entries (`src/ui/dev-harness/entries/`,
14 files). Draw the graph as an indented list with transition notes (push/modal/replace).

- [ ] **Step 2: Denominators.** Run and record exact counts:
```bash
cd "$WT" && grep -rln "Pressable" src/ui src/render --include="*.tsx" | wc -l   # files: ~50
grep -rn "<Pressable" src/ui src/render --include="*.tsx" | wc -l               # sites
grep -rn "withTiming\|withSpring\|withSequence\|withRepeat" src --include="*.ts*" | grep -v __tests__ | wc -l
grep -rn "Easing\." src --include="*.ts*" -l | grep -v __tests__ | wc -l
find assets/audio -type f | wc -l                                               # 94
grep -rn "playCue\|playSfx\|play(" src/render/management-sfx.ts src/render/menu-audio.ts | wc -l
```
Record sites-with-pressed-state vs total Pressables (grep `({ pressed })` and `pressed &&`)
— this ratio is axis A/B's headline denominator.

- [ ] **Step 3: Write `EVID/inventory.md`** with the graph + counts table. Report progress.

### Task 2: Static audit (spec Phase 2) — est. 45–60 min

**Files:** ledger entries only (no repo changes).

- [ ] **Step 1: Run every §6 grep** exactly as written in the spec, one finding-candidate per
hit cluster, into the ledger with `file:line`. Zero-hit rows get recorded as zero (they feed
"axis is clean" proofs).

- [ ] **Step 2: Read the anchor files** (spec Phase 2 list: animation.ts,
match-screen-styles.ts, management-sfx.ts, menu-audio.ts, haptics.ts, haptic-cues.ts,
pixel-art-sampling.ts, pixel-grid.ts, interpolate.ts, count-up.ts, team-kit-ui.ts,
match-control.ts, match-speed.ts, `scripts/generate-sprites.mjs`). For each: note the
mechanism, the timing constants, and whether a shared UI timing table exists or durations are
scattered (grep `duration:` literals across `src/ui`/`src/render`, tally distinct values).

- [ ] **Step 3: Asset pipeline checks.**
```bash
node -e "const s=require('./src/render/sprites/sprites.json');..."   # inspect atlas padding/extrusion fields
find art -name '*.png' -exec magick {} -format "%f %k %wx%h\n" info: \; | sort -k2 -n | tail -15
```
(Adjust the sprites.json path to the actual atlas metadata location found in Step 2's read of
`generate-sprites.mjs`.) Record palette outliers and any padding absence.

- [ ] **Step 4: i18n leftovers.** Spot-grep for hardcoded English in `src/ui`/`src/render`
outside the catalog (pattern: quoted multi-word strings in JSX text position, excluding
testIDs/keys). Sample 30 hits max, verify 5 deepest, ledger the class.

### Task 3: Harnesses + runtime measurement (spec Phase 3) — est. 90–120 min (sim seeding + 4-device sweep dominate)

**Files:**
- Create: `scripts/qa/polish/raf-recorder.js`
- Create: `scripts/qa/polish/audio-forensics.mjs`
- Create: `src/audit/__tests__/frame-budget-probe.test.ts`
- Output: `EVID/frametime-*.json`, `EVID/audio-forensics.md`, `EVID/frame-budget.json`,
  `EVID/deadframes.txt`

- [ ] **Step 1: Write the RAF recorder** (injectable; hidden-guard makes browser-pane freezes
un-fakeable):

```js
// scripts/qa/polish/raf-recorder.js
// Injected into the running web build (chrome-devtools evaluate_script). A page that is
// document.hidden freezes RAF and would fake a perfect record — hiddenFrames>0 voids the run.
// Usage: inject file, play the scenario, then call window.__rafReport() and save the JSON.
(() => {
  if (window.__rafRecorder) return 'already-running';
  const rec = { deltas: [], hiddenFrames: 0, start: performance.now(), stop: false };
  window.__rafRecorder = rec;
  let last = performance.now();
  function frame(t) {
    if (rec.stop) return;
    if (document.hidden) rec.hiddenFrames += 1;
    rec.deltas.push(t - last);
    last = t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__rafReport = () => {
    rec.stop = true;
    const d = [...rec.deltas].sort((a, b) => a - b);
    const q = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))];
    const sum = d.reduce((a, b) => a + b, 0);
    return {
      frames: d.length, hiddenFrames: rec.hiddenFrames,
      wallMs: Math.round(performance.now() - rec.start),
      meanMs: +(sum / d.length).toFixed(2), p95Ms: +q(0.95).toFixed(2),
      p99Ms: +q(0.99).toFixed(2), over33ms: d.filter((x) => x > 33).length,
      longestMs: +d[d.length - 1].toFixed(1),
    };
  };
  return 'recording';
})();
```

- [ ] **Step 2: Run three web frametime records** (each ≥20s), ALL on `dist-clean` (4173 —
the only perf-valid build; `#/dev` does not exist there): idle title screen; mid-match from a
live career played on that build, watched at 1× speed; the fulltime transition (the
KNOWN-DEFERRED freeze — capture the stall length as the player feels it on web). Save each
`__rafReport()` JSON to `EVID/frametime-<scenario>.json`. Validity: every record has
`hiddenFrames: 0`; re-run in real Chrome if not.

- [ ] **Step 3: chrome-devtools performance trace** during 30s of match on `dist-clean`:
record long tasks (>50ms) with attributed source, forced reflows, and re-render storms
(React profiler marks if present). Specifically attribute tasks belonging to the
rival-preload pump — it runs DURING the watched match (`use-rival-preload.ts`:
`TICKS_PER_BURST = 8`, `WATCHING_FLOOR_MS = 6`, and a `setTimeout` fallback assuming
`FALLBACK_BUDGET_MS = 6` where `requestIdleCallback` is absent — verify which path the web
build takes). The pump's per-frame cost is axis-E evidence in its own right. Screenshot the
trace summary to `EVID/`.

- [ ] **Step 4: Write the audio forensics sweep**:

```js
// scripts/qa/polish/audio-forensics.mjs
/**
 * File-level audio truth for the polish audit: peak/RMS headroom and duration for every
 * shipped cue. No loopback device exists on this Mac, so file-level analysis is the
 * authoritative audio-level surface (spec §3.1-F).
 *   node scripts/qa/polish/audio-forensics.mjs [--dir assets/audio] [--out artifacts/polish-audit-2026-08-06/audio-forensics.md]
 * Requires ffmpeg/ffprobe on PATH. Exits 1 if any file peaks above -0.1 dBFS.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i === -1 ? d : args[i + 1]; };
const dir = path.resolve(flag('--dir', 'assets/audio'));
const out = path.resolve(flag('--out', 'artifacts/polish-audit-2026-08-06/audio-forensics.md'));

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = path.join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(m4a|wav|mp3)$/i.test(name)) yield p;
  }
}
const rows = [];
for (const file of walk(dir)) {
  const stderr = execFileSync('ffmpeg', ['-hide_banner', '-i', file, '-af',
    'astats=metadata=1:measure_overall=Peak_level+RMS_level:measure_perchannel=none',
    '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }).toString?.() ?? '';
  // execFileSync returns stdout; capture stderr via options instead:
  rows.push(file);
}
// NOTE (execution step): ffmpeg writes astats to stderr — invoke with
// { stdio: ['ignore','ignore','pipe'] } and read error.stderr, or spawnSync and read
// .stderr. Parse "Overall.Peak level" and "Overall.RMS level" dB values, plus duration via
// ffprobe -show_entries format=duration. Emit a markdown table sorted by peak, flag
// peak > -0.1 dBFS, exit 1 on any flag.
```
The committed version must actually parse stderr (spawnSync) — the note above is the
implementation instruction; finish it before first run and verify against one known file:
`stat-step-tap.m4a` is documented peak-maxed and MUST appear at the top of the peak table
(this is the harness's own sanity check).

- [ ] **Step 5: Run the sweep + spectrograms.**
Run: `node scripts/qa/polish/audio-forensics.mjs` → `EVID/audio-forensics.md`.
Then spectrogram the repeated-action cues (stat-step-tap, ledger ticks, menu taps):
`ffmpeg -i assets/audio/sfx/<cue> -lavfi showspectrumpic=s=1024x512 "$EVID/spec-<cue>.png"` —
variant/pitch-spread proof for axis G.

- [ ] **Step 6: Write the Node frame-budget probe**:

```ts
// src/audit/__tests__/frame-budget-probe.test.ts
/**
 * Polish-audit frame-budget probe (spec surface C). Measures the JS cost the UI thread must
 * absorb, in PRODUCTION shape. The old "fulltime sims 4 rivals synchronously" premise is
 * stale: a rival-preload pump ships (src/ui/use-rival-preload.ts → createPreloadPump →
 * createFixtureResolver, chunked advance; matchday.ts:334 falls back to
 * quickResultForFixture ONLY for fixtures the pump didn't finish). So this probe measures:
 *   1. per-tick cost histogram of a WATCHED user match — WITH powers and production
 *      policies (the game never runs a power-free, policy-free match);
 *   2. the resolver's chunked advance cost — the pump's per-burst span (8 ticks/burst);
 *   3. the COLD WORST CASE: quickResultForFixture × 4 back-to-back, labeled cold — the
 *      player who taps instantly to Quick Result before the pump has run.
 * Node timings are order-of-magnitude honest for device (project record: ~3.5x slower on
 * phone-class Hermes). Writes artifacts/polish-audit-2026-08-06/frame-budget.json; asserts
 * only that the probe ran — machine speed never gates CI.
 * Run: npm run test:probe -- src/audit/__tests__/frame-budget-probe.test.ts
 */
import { performance } from 'node:perf_hooks';
import { createMatch, tick } from '../../sim/match';
import { createFixtureResolver, quickResultForFixture } from '../../game/matchday';
import { controlledMatchOptions } from '../../game/match-policy';
// Team/fixture construction: copy openingTeams() from strength-gap-probe.test.ts (same
// directory) but DROP its withoutPowers() wrappers — production matches carry powers.
// Fixture + teamsByClubId shapes: lift from the createFixtureResolver call sites in
// src/game/matchday.ts / its tests. Keep validateTeamDef passing.

const MAX_TICKS = 20_000; // hard guard — a match is ~2k ticks of 100ms, nowhere near this
const RIVAL_POLICIES = { homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY' } as const;

describe('frame-budget probe', () => {
  it('measures per-tick, pump-chunk, and cold-worst-case spans', () => {
    const { user, opponent } = openingTeamsWithPowers();
    // 1. watched-match tick histogram, exact production shape for a controlled match
    //    (controlledMatchOptions: firing policy + controlledTeam + formation —
    //     src/game/match-policy.ts:20-27)
    const state = createMatch(1234, user, opponent, controlledMatchOptions(0, '4-4-2'));
    const tickMs: number[] = [];
    let guard = 0;
    while (state.phase === 'play' && guard < MAX_TICKS) {   // phase: 'play'|'fulltime'
      const t0 = performance.now();
      tick(state);
      tickMs.push(performance.now() - t0);
      guard += 1;
    }
    expect(guard).toBeLessThan(MAX_TICKS);  // ends by fulltime, never by the guard
    // 2. pump-chunk spans: resolver over 4 rival fixtures, advanced 8 ticks per burst
    //    (TICKS_PER_BURST in use-rival-preload.ts) — record each burst's ms until done
    // 3. cold worst case: quickResultForFixture × 4 back-to-back, one timed span, labeled
    // write EVID frame-budget.json:
    //   { tickCount, meanTickMs, p99TickMs, worstTickMs,
    //     burstCount, meanBurstMs, worstBurstMs, resolverTotalMs, coldWorstCase4xMs }
    expect(tickMs.length).toBeGreaterThan(0);
  });
});
```
(`state.phase` verified against `src/sim/types.ts`; `openingTeams()` minus `withoutPowers`
verified against `strength-gap-probe.test.ts:76-77`; policies verified against
`matchday.ts:69-70`; the pump constants against `use-rival-preload.ts:15-28`. The bounded
guard means a wrong end condition fails loudly instead of hanging jest.)

- [ ] **Step 7: Run the probe.**
Run: `npm run test:probe -- src/audit/__tests__/frame-budget-probe.test.ts`
(the script already ends in `--runTestsByPath`; passing it twice is tolerated but
non-conventional). Expected: PASS, `EVID/frame-budget.json` written. The resolver/burst and
cold-worst-case numbers land in the ledger; the fulltime-freeze entry is re-framed around
what ships now — pump chunks during the match + residual settle — with the 4× figure
explicitly labeled COLD-WORST-CASE, and tagged KNOWN-DEFERRED only if the residual is still
player-felt.

- [ ] **Step 8: Sim choreography capture.** On the audit sim (`$SIM_UDID`) — the `#/dev`
harness never mounts in a native Release build (App.tsx:250–253), so states are reached by
PLAYING, with two named tools:
- **State unlock (minutes, not hours):** the recorded native-gate seeding path — build the
  wanted career state headlessly in jest (`serializeGameState`), then inject it into the sim
  app's data container:
  `C=$(xcrun simctl get_app_container "$SIM_UDID" com.tanglefast.herofootballmanager data)`
  → `INSERT OR REPLACE INTO career_saves … CAST(readfile(...) AS TEXT)` into
  `$C/Documents/SQLite/hero-football-manager.db`, then relaunch the app.
- **Input driver:** the iOS Simulator MCP (`control` tool: tap/swipe/text/screenshot,
  headless, available this session). Fallbacks if it misbehaves: xcodebuildmcp's axe
  coordinate-tap (historically gated behind a `sudo xcode-select` = needs Joe) or
  computer-use on Simulator.app. If ALL drivers fail, T3 coverage degrades to
  screenshot-only states reachable from a seeded save at launch — say so in the surface log
  rather than silently shrinking the sweep.
Run onboarding once (or seed past it), advance to match day, then record kickoff → first
goal → fulltime (HEVC), then:
`ffmpeg -i cap.mov -vf "mpdecimate,showinfo" -f null - 2>&1 | grep -c drop > "$EVID/deadframes.txt"`
plus tblend difference spikes around the goal moment (choreography beats, hitstop presence).
Screenshot suite: same 6 key screens (title, club home, squad, match, fulltime report, league
table) on all four sim devices → `EVID/layout-<device>-<screen>.png` (safe-area + density
judgments; PNG only).

- [ ] **Step 9: App size + cold start.** The 60MB canon budget is judged against the built
Release `.app` recorded in Task 0 Step 5 (labeled proxy; an IPA differs). Separately report
web download weight — `du -sh dist-clean` and largest chunks
(`du -h dist-clean/_expo/static/js/* | sort -h | tail -5`) — NEVER against the 60MB line.
Web cold-start-to-interactive from a chrome-devtools trace on a hard reload of `dist-clean`
(record TTI and any black/blank gap after splash). Sim cold-launch timed via
`xcrun simctl launch --console-pty` log timestamps (T3-indicative, labeled so).

### Task 4: Frame-by-frame feel audit (spec Phase 4) — est. 60 min

**Files:** ledger + `EVID/feel-<interaction>.md` notes (10 short files or one combined).

The ten interactions (fixed list — the audit's most-touched surfaces):
1. Advance-week button (ClubHome) 2. Drill tap (SquadTraining instant drill)
3. TrainingDrillModal open/close 4. Match speed control (MatchControlRail)
5. Quick Result confirm (QuickResultFaceOff) 6. Formation change (match rail)
7. Substitution swap (SubstitutionBoard) 8. Renewal accept (contract flow)
9. Market bid (MarketScreen) 10. Fulltime continue (PostMatch chain)

- [ ] **Step 1: Per interaction, on the served export:** inject the RAF recorder, then drive a
full synthetic pointer sequence (`pointerdown → pointerup → click`), capturing
`performance.now()` at dispatch and using a MutationObserver/rAF probe for first visual
change; record frames-to-first-change and total response duration. Authored stills come from
`dist-harness` (4174) `#/dev` addresses; every LIVE interaction — including all mid-match
ones (speed, formation, swap, Quick Result) — comes from playing on `dist-clean` (4173).
Careers there persist across reloads if the Phase-0 gate confirmed OPFS persistence, and the
shipped save/load slot rail (`DEVELOPER_MODE_AVAILABLE`) holds mid-career states; if the gate
FAILED, treat a live career as expensive state and batch all mid-match measurements into one
session.

- [ ] **Step 2: Per interaction, code checks:** pressed-state present? (file:line) — sound on
press-down or on press-up? (trace the handler to the cue call) — haptic cue mapped? —
disabled state distinct? Ledger each with tier T1/T2 provenance.

- [ ] **Step 3: Abuse pass:** rapid-tap ×10 (assert single action: one week advanced, one TP
spend, one bid), drag-off-cancel, tap-during-animation (interrupt: no queue/freeze/double).
Repeat the money/TP-spending ones on the sim (T3) since double-spend is the S0-class risk.

### Task 5: Exemplar teardown (spec Phase 5) — est. 30 min

- [ ] **Step 1:** For each named exemplar (Duolingo, Balatro, FM Mobile/Retro Bowl, Alto's
Odyssey, Vampire Survivors): one paragraph naming the specific mechanic, the evidence of its
presence/absence in this build (from Tasks 1–4), and the cheapest mechanism that would close
the gap. No vibes; every claim points at ledger evidence.

### Task 6: Red team pass + artifacts (spec Phase 6) — est. 30 min

- [ ] **Step 1:** Re-read every ledger entry asking: was the surface that could falsify this
actually tried? Upgrade/downgrade tiers honestly; rewrite soft findings harder; delete
anything that is generic-advice rather than this-build-specific.
- [ ] **Step 2:** Write the 2-star App Store review (120 words) and the Steam-curator kill
shot + forgiveness paragraph. If they come out easy, good; if not, return to the axes that
were graded gently.

### Task 7: Assemble the report (spec Phase 7) — est. 60–90 min

**Files:** Create `docs/superpowers/plans/2026-08-06-polish-audit-report.md`.

- [ ] **Step 1:** Write sections in order: 8.0 surface log (3 lines) → 8.1 scorecard (A–K,
tier-labeled, blockers-to-+1) → 8.2 findings table (sorted by severity, provenance on every
row, tags KNOWN-DEFERRED / [UNVERIFIED-DEVICE] / NOT-BUILT) → 8.2b canon pushback → 8.3 the
ten blockers → 8.4 fix plan by delight-per-hour with the first-afternoon cluster → 8.5 retest
protocol (pre-registered pass/fail + measurement command per fix) → §9 artifacts.
- [ ] **Step 2:** Verify report invariants: every §5 axis has ≥5 S2+ findings or a
clean-proof paragraph; no banned words; every row has a tier; canon collisions only in 8.2b;
ends on the fix plan.

### Task 8: Report review + fold-in — est. 20–40 min

- [ ] **Step 1:** Send the report through the grok-review skill (Grok CLI is single-turn
headless: inline the document via `--prompt-file`, never expect it to read files itself).
- [ ] **Step 2:** Per-finding accept/pushback (established workflow), fold accepted
corrections into the report, note pushbacks with reasons in the PR description. Re-submit
once if the first round was REVISE.

### Task 9: Commit, PR, hygiene — est. 15 min

- [ ] **Step 1: Commit** (only these paths):
```bash
cd "$WT" && git add docs/superpowers/plans/2026-08-06-polish-audit-spec.md \
  docs/superpowers/plans/2026-08-06-polish-audit-plan.md \
  docs/superpowers/plans/2026-08-06-polish-audit-report.md \
  scripts/qa/polish/ src/audit/__tests__/frame-budget-probe.test.ts \
  artifacts/polish-audit-2026-08-06/
git commit -m "audit: adversarial polish audit — spec, plan, report, measurement harnesses

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
Pre-commit guards: `npm run test:probe -- src/audit/__tests__/frame-budget-probe.test.ts`
passes; `npx tsc --noEmit` unchanged from base (the probe must not break typecheck);
`git log origin/main..HEAD` shows no duplicate base commit.

- [ ] **Step 2: Push + PR**
```bash
git push -u origin claude/polish-audit-plan-d7cfff
gh pr create --title "Adversarial polish audit: report + measurement harnesses" --body "…summary, surface log, review outcomes…

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Hygiene sweep (non-negotiable)**
```bash
# Kill ONLY the serve PIDs recorded in $SCRATCH/serve-pids.txt at Task 0 Step 3 —
# never pkill by pattern: another session may be serving its own dist.
while read -r pid; do kill "$pid" 2>/dev/null; done < "$SCRATCH/serve-pids.txt"
SIM_UDID=$(cat "$SCRATCH/sim-udid.txt") && \
  xcrun simctl shutdown "$SIM_UDID" && xcrun simctl delete "$SIM_UDID"
# Plus any layout-sweep sims booted in Task 3 Step 8 — shut down by their captured UDIDs,
# one at a time. NEVER `simctl shutdown all`: other sessions' gate sims may be running.
[ -n "$WT" ] && rm -rf "$WT/ios"   # the rsync'd build copy is scratch, not source
# dist-clean/dist-harness live in $SCRATCH and vanish with the session — nothing to clean.
```
Close every preview/Chrome tab opened for the audit. Confirm port 8081 was never bound:
`lsof -nP -iTCP:4173,8081 -sTCP:LISTEN` → only expected entries (none after cleanup).

---

## Success criteria

1. Every axis A–K scored with tier, or explicitly unscored with the surface attempt named
   (device tier expected unscored — phone offline).
2. ≥5 S2+ findings per axis or an evidence-backed clean proof; every finding reproducible from
   its provenance line.
3. The three harnesses run green from a fresh checkout (`raf-recorder` inject → report;
   `audio-forensics` exit code meaningful; `frame-budget-probe` passes and writes JSON).
4. Report survives Grok review (approve, or REVISE with all accepts folded).
5. PR open from this branch; zero leftover servers/tabs/sims; port 8081 untouched.

## Risks and mitigations

- **MAIN folder is shared with other sessions and Joe's phone loop.** It is read-only here:
  the sim build always uses the worktree recipe (rsync ios/ out; build in WT). Never write to,
  build in, or pod-install in MAIN.
- **Two exports, two truths.** `dist-harness` exists only for state addressing; any perf,
  pacing, cold-start, or size number sourced from it is invalid — those come from `dist-clean`
  alone. Every capture notes which build served it.
- **Web career persistence is a Phase-0 empirical question, not an assumption.** The code
  says careers persist (SQLite over OPFS + `requestPersistentStorage()`), and the shipped
  save/load slot rail (`DEVELOPER_MODE_AVAILABLE = true`) holds mid-career states. Verify by
  playing + hard-reloading before relying on either; if persistence fails, fall back to
  batching all live-career measurements into one unbroken session. Axis H's save-integrity
  findings key off the same observed result.
- **Local serve is only ship-parity WITH the headers.** Vercel sets COOP/COEP on every
  response; both serves carry the same `serve.json`, and the `crossOriginIsolated` gate is
  recorded before any perf claim.
- **The fulltime-freeze premise changed.** A rival-preload pump ships; the audit measures
  pump chunks + residual settle, and the 4× synchronous figure is only ever reported labeled
  COLD-WORST-CASE.
- **Browser-pane traps** (0-width phone layout, hidden RAF, muted audio) — every frametime
  record is validity-gated on `hiddenFrames: 0`; desktop-layout judgments only from real
  Chrome/chrome-devtools at a real viewport.
- **Sim build failure** (pods, codegen) — bounded to one Podfile.lock retry, then the worktree
  recipe; if both fail, T3 axes degrade to web+code evidence and the report says so.
- **Reviewer scope creep** (Grok/Opus asking for device numbers we can't get) — the spec
  pre-registers the blocked tier; push back with the spec section, don't fake coverage.

## Estimated total

Execution: ~6–8 h wall clock (sim build, sim seeding + 4-device sweep, and captures dominate;
report writing ~1.5 h). Review rounds: +30–60 min. Fits one long session; context
summarization expected mid-way.
