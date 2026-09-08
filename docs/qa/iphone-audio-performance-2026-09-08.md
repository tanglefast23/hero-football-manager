# iPhone audio timing and six restored 3x effects

## Current change

The iOS Expo Audio player skips `AVPlayerItem.currentDate()` for local files.
That live-stream metadata call blocked Auto Battler's main thread. Football
Manager used the same unguarded getter in Expo Audio 57.0.4. Apple documents the
date mapping as coming from the HLS `EXT-X-PROGRAM-DATE-TIME` tag:
[AVPlayerItem.currentDate](https://developer.apple.com/documentation/avfoundation/avplayeritem/currentdate()).

`scripts/audio/patch-expo-audio.mjs` reapplies the guard after installation.
`node scripts/audio/patch-expo-audio.mjs --check` verifies the installed patch.
The existing `setup-skia-web` installation step is preserved.

The owner then approved restoring four groups at 3x:

- Power activation camera punch, zoom, and shake.
- Activation screen/body flashes and speed lines.
- Secondary impact particles around tackles, shots, saves, and interruptions.
- Ticker scrolling, shadow, extrusion, and full outline.

These reuse the existing 1x/2x effects. Camera effects update the existing
transform. Impact particles use the existing fixed path batches. Ticker lines
already skip unchanged renders. These were selected as lower-cost candidates
than continuous player afterimages or tackle debris; this is a code-based
estimate, not a measured per-effect cost ranking.

After viewing the four-group test, the owner approved restoring Super Speed
trails and slide-tackle debris next. Pass-combo trails stay disabled at 3x.
They can affect many players together, so they remain the estimated highest-cost
candidate. Confetti stays at 60 rather than 220 pieces, as explicitly requested.
Reduce Motion and adaptive effect reduction still apply. Simulation, match
speed, automatic fallback thresholds, and saved data do not change.

## Verification

- Physical device: iPhone 16 Pro Max, iOS 26.6.1, connected by USB.
- Base commit: `822e306a6a059837a5710d2a83049ed03d10d2bf`, matching remote main.
- The build includes the main checkout's existing tracked edits unchanged.
- Initial audio verification: 10 focused Jest suites, 83 tests passed.
- Six restored effects: 10 focused Jest suites, 117 tests passed, including
  Super Speed versus pass-combo trail selection and the preserved reductions.
  This overlaps the audio verification; the totals must not be added together.
- TypeScript, release preflight, patch verification, and whitespace checks passed.
- The actual patched Swift getter passed a standalone execution check: local
  files did not query a date; remote and missing-source cases kept their behavior.
- Repeated patch installation was idempotent. An unknown upstream getter was
  rejected without editing its file.
- Native Release builds succeeded. No balance or soak suites were run.

Two initial phone runs used seed `20260893`, Bramble Rovers versus Ferrous
United, automatic powers, and 3x. Native audio playback remained active but was
muted for silent QA. Both reached full time at tick 2017, score 1–2, with five
power activations. Both held 3x without adaptive reduction or a 2x fallback.
Their JavaScript bundles were byte-identical; the native audio guard differed.

The initial drawing-gap comparison is not final evidence. Its callback was
registered again on React redraws, which reset part of its interval history.
The earlier 207 ms versus 34 ms figures are therefore excluded from the
performance conclusion. A corrected temporary recorder uses one stable callback
and continuous timestamps. Callback gaps are not presented-frame FPS.

The corrected four-group test completed at 3x with 29.989 simulation ticks per
second. It reached tick 2017, score 1–2, and five power activations. There were
no catch-up clamps or 2x fallback. Its longest measured drawing-callback gap
was 62.1 ms, with one gap above 50 ms. Automatic effect reduction first appeared
in the 54-second sample. Thus the test did not retain full effects throughout;
the existing safeguard remains active.

The six-group native test completed with all six groups available throughout:

- 3x in every active sample; 30.001 simulation ticks per second.
- No automatic effect reduction, 2x fallback, or catch-up clamps.
- Full time at tick 2017, score 1–2, five power activations.
- Super Speed, Fire Torch, and Super Strength activated; 19 slide tackles ran.
- A live Super Speed trail was recorded in the sampled render state.
- Longest measured drawing-callback gap: 41.9 ms; no gap exceeded 50 ms.

This is one seeded fixture, not proof of all careers or presented-frame FPS.
The automatic check reads JavaScript game-loop timing. Its earlier reduction
does not by itself prove visible lag or identify an expensive effect. Run-to-run
variation means the six-group result is not evidence that adding effects improves
performance. The existing safeguard remains unchanged.

Continuous callback samples for both restored-effect runs are stored in
`iphone-audio-frame-gaps-2026-09-08.json`. Temporary test routes, forced silence,
recording, and baseline overrides are absent from shipping source.

## Delivery

The final native Release build with the audio patch and six restored groups was
installed and opened on the phone at 22:56 local time. Code-signature verification
passed. Its bundled JavaScript SHA-256 is
`dfc339971732ce52ef0b20fd086396395443e356e31de0373b858851330ff2ec`.
The app contains bundled JavaScript and does not need Metro. The source changes
are local; nothing has been committed or pushed.
