# Hero Football Manager game testing

Use this guide for browser careers, strategy checks, saved-game blockers, and playtest reports.
Follow the Preview & QA hygiene rules in `AGENTS.md` throughout.

## Prepare a reliable run

1. Record the source commit, dirty diff, engine version, dependency lock, surface, and career seed.
   Use a detached checkout if concurrent edits would change the test source.
2. Preserve existing saves. Use an isolated origin for fresh careers and synthetic fixtures.
   Mark a synthetic fixture as a separate test. It cannot prove career progress.
3. Start a local web preview on a free port. Record its PID and URL.
   Open the background browser with `?qa=playtest`. Mute at load using the guard in `AGENTS.md`.
4. Read `scripts/qa/playtest-browser.js` and inject its contents with the browser evaluation tool.
   Completion: `HFMPlaytest.brief()` returns the current screen without an error.

The opt-in snapshot bridge exposes cloned, codec-validated career data through `window.__HFM_QA__.read()`.
It is closed on public hosts, `hfm://`, and native builds.
It exposes no store actions or mutable career references.
The browser helper's mute patch is an extra layer. It cannot guarantee silence before injection.

When switching `EXPO_PUBLIC_` QA export flags, pass `--clear` to `expo export`.
In the installed Expo version, a cached normal export ignored a newly set harness flag.
A cleared export picked it up. Keep QA exports in a separate temporary directory.
Before final build checks, unset the QA flags and rebuild the normal export with
`npx expo export --platform web --clear`, then run `node scripts/web/fix-worker-bundles.mjs`.
Run the desktop check against that normal export. Do not publish a temporary QA export.

## Drive the actual game

Inspect `HFMPlaytest.controls()` and call `await HFMPlaytest.tap('Exact accessible label')`.
Each tap checks one visible, enabled control and waits past the 400 ms guards.
Missing, duplicate, disabled, or failing controls stop the action and enter the action log.
Use `await HFMPlaytest.waitFor(s => s.screen === 'management')` for a bounded screen wait.
Inspect the rendered page and browser logs when a wait fails.

The helper keeps both 450 ms input guards. Its short-lived worker clock avoids
the page timer budget in an occluded browser. Each delay terminates its worker
and releases its Blob URL. Browsers that block workers use the MessageChannel
fallback, which can still run slowly in a covered pane. Use
`await HFMPlaytest.pause(ms)` for driver delays of 0–30000 ms.

A pane can suspend animation frames while still reporting visible and focused.
If an animation stops responding, probe a fresh `requestAnimationFrame` first.
If no frame arrives and a screenshot says the tab has not painted, resize the
background viewport by one pixel, then restore it. Stop repeated clicks first.
This redraw needs no foreground focus, reload, or game-state change. Record it
as a QA environment incident. It does not prove normal browser, Steam, or phone
performance. Keep screenshots at the recorded viewport size.

Read the full roster, finances, facilities, requests, and fixtures with `HFMPlaytest.read()`.
Use production training previews when checking diminishing returns; displayed ratings can contain presentation bonuses.
Make purchases, training, lineup changes, and match choices through rendered controls.
Stop for requests, events, save errors, or season boundaries and inspect the decision.
For Skia pitch controls, use the existing browser input tools and screenshots. DOM clicks do not control the canvas.

Export `HFMPlaytest.checkpoint()` before risky actions, weekly, after matches, and at season boundaries.
The checkpoint contains the career, engine version, save status, and action log.
Read `HFMPlaytest.chunks(checkpoint)` one chunk at a time if the tool truncates large results.
Join all chunks, parse the JSON, and save it under the run's artifact folder.
Logs live in the page only. Export them before a reload.
Completion: the saved JSON parses, the source is recorded, and fixture totals match reported progress.

Club IDs remain stable after promotion and relegation. Read the current division
from the pyramid divisions, or the Cup's seedDivisionByClubId. An ID prefix
such as d2- does not prove that club is still in Division 2.

Export before trying a costly full-page capture. A successful frame probe does
not guarantee that screenshot capture works. Stop repeated capture attempts
after three failures. Record missing images and any lost page logs.
If a capture leaves a tab unusable, first confirm the career was persisted.
A fresh same-origin tab can report the single-tab club-file lock until the old
tab closes. Close only your old tab, then use Retry opening club files.
Retry can reload the page: install the mute guard and helper again immediately.
Continue the saved career and compare its seed, week, funds, and fixtures.
Do not replace the save or replay a completed fixture to obtain an image.

## Validate a checkpoint without changing it

```sh
npm run qa:career -- artifacts/my-run/checkpoint.json
npm run qa:career -- artifacts/my-run/checkpoint.json --simulate
npm run qa:tools:check
```

The default check uses the production save codec and team builders.
It reports each refused lineup and exits 1 on failure. It never writes a save.
The optional simulation runs the active user fixture through `quickMatchForFixture`.
It requires matchday phase and, when recorded, the matchday screen.
Missing fixtures or a different checkpoint engine return a clear skipped result while preserving validation results.
An empty checkpoint reports no career. It is not labelled a corrupt career save.
It uses the saved lineup formation, `userClubId`, and `autoSubs: true`.
The opening story match removes the user's powers, as the real match does.
The saved lineup formation must match the UI selection when comparing exact results.
Quick Match starts the controlled side at Balanced energy; watched energy settings do not carry over.
Cup simulations here stop at the match result; they do not resolve a tied Cup match or advance the career.

Treat simulated results as supplemental evidence. They do not count as browser wins.
For strategy comparisons, hold teams and seeds fixed, name all varied settings, and save each result.
`runHeadlessFullCareer` uses synthetic fixture scores. Use it only for its economy and clock checks.
It cannot prove a winning strategy or match balance.

## Report and finish

Report completed seasons, actual fixtures, purchases, drills, funds, wins, and the exact stopping point.
For each issue, give the action, expected result, actual result, source cause, and evidence.
Separate bugs, owner decisions, balance hypotheses, and your own strategy mistakes.
Keep independent reviewer comments and record accepted and rejected suggestions with reasons.
Keep the original run's result unchanged when reporting a later fix or resumed run.

Exercise each changed player flow, run focused tests, and run TypeScript.
Separate passed, failed, blocked, and untested checks. State whether code is local or published.
Destroy the page, close the tab, and stop only the server you started.
Completion: all started resources are closed and every finding has a stated status.
