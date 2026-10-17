# Safe audio efficiency — 2026-10-17

One Auto Battler optimization applies directly: reduce unused periodic audio
status reports. HFM has no playback-progress UI or audio status listeners.
All nine audio owners now pass the shared `GAME_AUDIO_PLAYER_OPTIONS`, with
`updateInterval: 60_000`, instead of the Expo Audio default of 500 ms.
Existing session options, sounds, gains, cue timing, recovery, and loops remain.
This uses the supported positive interval; it adds no native patch or dependency.
See [Expo Audio options](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

## Other Auto Battler changes checked

The comparison used Auto Battler `9ceb2143` plus its current dirty tree, and HFM
`a18fa65b` plus this audio change. Retained source changes were checked separately
from rejected experiments. The scratch evidence includes a SHA-256 snapshot of
17 relevant Auto Battler files in `comparison-source-manifest.json`.

| Change | Current HFM path | Decision |
| --- | --- | --- |
| Avoid local-file `AVPlayerItem.currentDate()` calls | `scripts/audio/patch-expo-audio.mjs` already applies this guard | Already present; this fix originally came from HFM |
| Bound stalled-frame catch-up | `MatchScreen.tsx` caps catch-up at five ticks | Already present |
| Publish animation state on the UI thread | `worklet-atlas-frame.ts` queues retargeting through `runOnAtlasRuntime` | Already present |
| Batched sprite drawing | The match uses Skia Atlas buffers | Already present |
| Reduce oversized draw arrays and changing enemy lists | HFM has fixed player slots rather than Auto Battler's growing enemy batches | No direct port justified without separate profiling |
| Native SHA-256, checkpoint parsing, file read-back, and yielding file writes | HFM uses asynchronous SQLite writes, queued saves, reused save JSON, and cached backup metadata | Different persistence path; no save changes made |

These findings do not rule out further HFM-specific gains. They do not justify
copying Auto Battler's implementation into a different renderer or save system.

## Independent reviews and final decision

Grok, Muse, and Opus reviewed both checkouts independently. All three support
keeping HFM's 60-second interval and found no further safe runtime ports. The lead
verified the caller paths, installed Expo Audio implementation, and native checks.
The final decision is to keep this audio change and make no further runtime edits.

Opus also suggested an automatic test for the existing native patch's `--check`.
That adds no runtime reduction. The existing command was run directly and passed;
no extra test wrapper or source-scanning test was added.

Muse's source-promotion classification became stale during the comparison. The
latest Auto Battler note confirms its queued yielding saves and background grant
are retained. HFM still uses a different SQLite path, so that update does not
justify a port. Save deferral, further native observer changes, and per-tick React
changes all need HFM profiling before implementation.

## Full uncommitted-work refresh

The follow-up snapshot at `2026-10-17 16:46:59 UTC` includes the complete
HEAD-to-working-tree diff and all untracked files. Auto Battler still has HEAD
`9ceb2143`: 126 changed tracked files, **5,685 added / 2,626 removed lines**,
plus **53 untracked files**.

| Tracked change group | Files | Added + removed lines |
| --- | ---: | ---: |
| Replay/render fixtures | 3 | 5,396 |
| Tests | 48 | 1,191 |
| Documentation | 2 | 57 |
| Runtime, configuration, and tools | 73 | 1,667 |

The 16 code files in the earlier performance snapshot are byte-identical. Only
its QA-note file changed. The remaining UI, native shell, application, simulation,
content, and tooling changes received separate follow-up reviews. New UI helpers,
the native background module, and other untracked source files are included.

Grok's UI review, Muse's native/layout review, and Opus's gameplay/tooling review
all found zero additional safe ports. The lead closed the remaining BattleScreen
style-tail coverage and checked HFM's matching screen/canvas paths. HFM already
keeps its web canvas mounted through size changes. New mobile card layouts,
inspection gestures, inventory limits, and extra wave units are product changes.
The newer path-construction and reward-mount experiments were rejected in Auto
Battler; they supply no confirmed HFM improvement.

The frozen patch, all 179 file hashes, source copies, and coverage inventory are
in `/var/folders/3b/wdw40w8n0fq28cvr7t0782900000gn/T/hfm-live-comparison-20261017-4kk5jg2n/`.
The three follow-up reports are saved there as `review-grok.md`, `review-muse.md`,
and `review-opus.md`. The final drift check found no changed, added, or removed
paths since that snapshot.
All ten HFM runtime files still match the passing native build. This refresh adds
no runtime code and does not repeat device tests.

## Passed checks

- Focused audio and press-cue tests: 13 suites, 133 tests.
- `npx tsc --noEmit` on the final runtime/test changes.
- Targeted Prettier check and `git diff --check`.
- `npm run audio:levels:check`: 98/98 referenced assets passed.
- Existing Expo Audio timing patch check.
- Xcode Release build: `HeroFootballManager`, iOS Simulator, build 3.
- Apple XCTest UI run: one test passed, zero failures, 119.110 seconds.
- Separate native music-loop XCTest: one test passed, zero failures, 18.017 seconds.

The native probe played two muted copies of the match theme. After warm-up, the
six-second window produced **12 periodic reports with 500 ms, and zero with
60,000 ms**. Direct time, duration, loaded, playing, and loop properties remained
live. Seek, pause, resume, and the short whistle's completion event passed.
This counts steady-playback periodic reports only. Loading, playback changes,
seeking, and completion can still emit status events.

The separate loop check used the real awards theme with the same player options.
It sought to one second before the end of its 33.366-second loop, then confirmed
playback wrapped to 1.305 seconds and remained playing. The probe repeated the
12-versus-zero periodic report count. Native playback stayed muted throughout.

The real `MatchScreen` rendered, paused, resumed, and showed 2x and 3x. Seed
`20260893` reached full time at tick **2017**, score **1–2**, with **five power
activations**. The normal `App` then opened its title screen. Captures were
inspected. This is a regression check, not a phone FPS or battery measurement.

## Test setup and earlier failures

Native checks used a diagnostic copy of the freshly built Release shell with the
final production modules. A process-local native AVPlayer mute guard kept sound
playback active and silent. The diagnostic entry, mute library, and XCTest runner
stay outside the checkout. The original Release artifact retains its normal entry.

An earlier cached native shell used Worklets 0.10.0 with current 0.10.1 JavaScript.
It crashed during animation startup, before the audio probe. That invalid preflight
was discarded. The matching fresh build passed. Two earlier UI runs also stopped
on test setup: an unsupported JavaScript mute guard and the scorebar's grouped
accessibility tree. The final driver verified native silence and used the observed
speed-control position. No app code changed to bypass these failures.

## Artifacts and delivery

- Scratch evidence: `/tmp/hfm-efficiency-20261017-flbpR2/`.
- Passing result: `native-verification-3.xcresult`; native probe and match results
  are in `native-verification-3.log` and its exported attachments.
- Music-loop result: `native-loop-verification.xcresult`,
  `native-loop-verification.log`, and `native-loop-proof.json`.
- Unmodified Release bundle SHA-256:
  `90c143e5fe0c50725557fe044ee177d44079bbfedba2365de99af51d55ff2429`.
- Owned simulator: `3314D9B5-E7A9-4495-8DBD-1B34D0E23924`; app stopped and
  simulator shut down. Existing Auto Battler simulators stayed running.
- Those local checks used no phone, audible listening, balance/soak runs, commit,
  push, or publication. The later OTA release is recorded below.

## Production OTA — 2026-10-18 local time

The user authorized verification and publication. App Store Connect still reports
version `1.0.0`, build **3**, as `READY_FOR_SALE` and `VALID`.
The production channel previously served commit
`f0bf642a8f27579f41e3866145049d6565d5b39c`, group
`e9809f84-86b5-454f-9a90-75ee5681f546`.

An isolated release worktree starts at that exact production commit. Only the
12-file audio patch was applied. All starting blobs match the main patch.
Its SHA-256 is
`0731a0610d21236cc2910f7d2a99b33c16288c6ceb22ad00d8cc09afd5a40d15`.
No other main changes, dependencies, native settings, saves, content, or engine
changes enter this release. The release lockfile keeps Expo Audio **57.0.4**.
It supports the same positive interval and live getters as main's 57.0.5.

The baseline, candidate, and final iOS fingerprints all equal the live runtime:
`4e13cc16040713b5be8f6884fc75eef780b010bc`.
Release checks passed: 13 audio suites / 133 tests, TypeScript, release policy,
98/98 audio assets, the existing native audio patch check, and `git diff --check`.
Opus independently reviewed the release boundary and found no blockers.

| Release stage | Group | iOS update ID |
| --- | --- | --- |
| Preview, production environment | `159b9cb0-63fc-40b6-a031-d22c4ab3f827` | `01a14adc-58bd-7575-8d0b-a47721e18fae` |
| Production, republished from tested preview | `56fb36f4-99a4-4370-8dd4-2129a5bb7bcf` | `01a14ae1-0cc7-78ad-b8cb-fdc8e4b46001` |

The native test used a copy of an existing build-3 simulator app. Its embedded
runtime is the live fingerprint, Worklets is 0.10.1, and Hermes bytecode is 98.
Its native preview header is separate from the unchanged production source
configuration. A temporary diagnostic entry imports the release modules.
A process-local native guard verifies silence before playback.

One Apple XCTest passed in **97.198 seconds**, with zero failures:

- The six-second audio window again gave 12 default periodic reports and zero
  sparse reports. Live getters, seek, pause, resume, completion, and the real
  33.366-second awards-theme loop passed.
- Seed `20260893` paused, resumed, rendered at 3x, and reached tick 2017 with
  score 1–2 and five powers. Captures were inspected.
- Expo Updates downloaded the preview update. The downloaded bundle matches
  the published local export byte for byte: **8,195,348 bytes**, SHA-256
  `3c84ebdc1ab31383d6e98466d07af7845d77a4b37d8e2eff64efe2239b31b613`.
- The downloaded update opened the normal title screen after reload and a cold
  restart. A temporary native observer read the running update ID from the
  updates controller. It equals the preview update ID. The updates database
  records two successful launches and zero failed launches for that update.

The production publication reused the tested preview group. It did not rebuild
the JavaScript bundle. The live production manifest was checked at
`2026-10-17T17:20:40Z`: it serves the production update ID, the same runtime,
the same launch-bundle hash, and all 106 unchanged game assets.
Production publication completed at `2026-10-17T17:20:25.287Z`.

The app keeps embedded offline startup and zero startup wait. It downloads on
launch and applies the update on a later restart. No forced reload was added.
If rollback is needed, republish group `e9809f84-86b5-454f-9a90-75ee5681f546`
to production for iOS. Do not roll back to the older embedded game.

Standalone CDN checks returned HTTP 403. The supported native updates client
downloaded successfully; its local bundle supplies the byte-for-byte proof.
The first temporary native receipt could not reach the Swift singleton. The
observer then captured the native launch controller and verified its update ID.
Neither check required an app source change.

Release evidence is in
`/var/folders/3b/wdw40w8n0fq28cvr7t0782900000gn/T/hfm-audio-ota-20261018-26rn6swe/`:
`production-verification.json`, `preview-native-proof.json`,
`preview-native.xcresult`, exported attachments, fingerprints, the exact patch,
and the independent release review. Generated iOS folders, pods, export files,
and the diagnostic runner stay in that scratch release worktree. No temporary
QA entry remains in either checkout.

No physical iPhone access, audible testing, Apple build upload, commit, or push
was performed. This proves reduced periodic status work and the checked flows.
It does not measure phone FPS or battery improvement.
The owned simulator is shut down. The final listener audit found no HFM server.
Both checkouts still contain only the intended audio patch and QA record.
