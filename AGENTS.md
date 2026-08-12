# Hero Football Manager — Project Context

Kairosoft-style soccer club management sim with superpowered players. iOS-first (paid, US$3.99 — `README.md` holds the current price), Expo/React Native. M0–M3 are accepted and M2 is code-complete; the work now is M4 content and polish.

## Read first

- `README.md` — decision log + doc index. All design decisions live in `docs/01`–`docs/11`.
- `research/` — background research reports (Kairosoft economics, match presentation, stack analysis). Reference, not canon; the docs are canon.

## Non-negotiable architecture rules

- `src/sim/` (match engine) and `src/game/` (season/economy/events) are **pure TypeScript**: no React Native, Skia, or Expo imports, no `Math.random`/`Date.now` — a seeded PRNG (mulberry32) is injected. Everything in these rings must be Jest-testable headless and deterministic: the same engine version, teams, options, seed and ordered input log produce byte-identical results.
- Match rendering uses react-native-skia's **Atlas batched API** — never one component per sprite (known perf trap).
- Game content (powers, events, drills, sponsors, tips, clubs, and the other files in `content/`) is typed JSON, zod-validated. New content ships as data, not code. Archetype caps and name pools are the exception — they are TypeScript in `src/game/`, so treat `content/` as the default home for new content, not as a claim about every existing table.
- Balance changes must keep the CI balance-harness assertions passing (see `docs/09-tech-stack.md`).
- Do not run balance, soak, or large seed-rail tests for UI, tutorial, animation, copy, art, or audio-only changes. Run them only when match simulation, economy, progression balance, RNG consumption, or another measured balance contract changes, or when the user explicitly requests them. Use focused tests and TypeScript checks for unrelated work.
- Any replay-affecting sim change (behavior, tuning, or RNG consumption) must bump `ENGINE_VERSION` in `src/sim/match.ts`. The golden-replay snapshot update is the forcing reminder — never update that snapshot without a version decision.

## Artwork discipline

- Unless the user explicitly directs otherwise, every new or modified piece of artwork—including sprites, visual effects, icons, world objects, animation frames, and art-bearing UI—must follow the canonical design rules in `docs/11-art-style.md` and the colour/usage rules in `docs/08-ui-ux.md`.
- This rule applies prospectively to artwork being created or changed. It does not require retroactive restyling of otherwise untouched artwork.

## Preview & QA hygiene (background, silent, cleaned up)

Verification must never take the Mac away from Joe: no stolen focus, no stolen mouse or keyboard, no full-screen window, and above all no game audio. The web build auto-plays looping music, and tabs, dev servers and simulators all outlive your turn.

1. **Headless first.** `npx jest <affected test paths>` plus `npx tsc --noEmit` answer most questions with no UI at all. Do NOT reach for bare `npm test` as the default — it runs every suite including `m2-managed-recovery-soak` and the balance rails, which the rule above forbids for UI, copy, art or audio-only work. Open a browser only when the claim is about what renders or what the player hears.
2. **Background browser pane before a real browser or a simulator.** The agent's browser pane runs occluded, steals no focus, takes no input control, and Chrome background-pauses its media — it is the quiet default. Escalate only when the pane's evidence is genuinely inadequate: it reports a 0×0 viewport (so phone layout only) and cannot play audio at all. Say in the report which surface you used and why.
3. **Never seize input.** Drive the browser with the pane / remote-debugging tools and the Simulator with headless screenshot and tap actions — `xcrun simctl` boot, install, launch, input and screenshot all work without opening Simulator.app at all, so prefer that over the visible panel unless Joe wants to watch. Do not use desktop mouse or keyboard control on this project. Front a window with `osascript` only when a real user gesture is required, keep the activation as short as possible, and hand focus back.
4. **Mute in the same breath as the load.** Be honest about what this buys: no tool here can run JavaScript *before* the bundle's own scripts, so the guard is a net thrown immediately after `navigate`, not a pre-load guarantee. Make it the VERY NEXT tool call, with nothing in between.

   ```js
   (() => { const W = window, AC = W.AudioContext || W.webkitAudioContext;
     if (AC && !AC.qaMuted) { const P = function (...a) { const c = new AC(...a); c.suspend(); c.resume = () => Promise.resolve(); return c; }; P.prototype = AC.prototype; P.qaMuted = true; W.AudioContext = W.webkitAudioContext = P; }
     const M = HTMLMediaElement.prototype; if (!M.play.qaMuted) { const p = M.play, f = function () { this.muted = true; return p.apply(this, arguments); }; f.qaMuted = true; M.play = f; }
     const els = document.querySelectorAll('audio,video'); els.forEach((el) => { el.muted = true; el.pause(); });
     return 'muted; media els: ' + els.length; })()
   ```

   The `play()` patch is the load-bearing half. `expo-audio` on web plays through **detached `new Audio(...)` elements** (`node_modules/expo-audio/build/AudioModule.web.js`), never through Web Audio — an AudioContext only appears in its recorder. So the patch catches every game sound started after it installs, and `media els: 0` is expected and means nothing: detached elements are not in the DOM for `querySelectorAll` to find. The AudioContext half is a second layer for Skia or any future path; it survives the app's own `resume()` (verified 2026-08-12: the context stays `suspended`, `play()` returns muted).

   What it does **not** catch: players already sounding before injection, later code that clears `muted`, autoplay that never calls `play()`, and audio in another frame. If anything is still audible, destroy the page — `window.location.replace('about:blank')`, then confirm with any JS call (`No site is open in this tab` proves the context is gone).

   Two levers beat the page guard when they are available. If you ever launch a Chromium yourself, pass `--mute-audio` and the whole process is silent before a single script runs — this does NOT apply to the attach path, since Joe's Chrome is already running and cannot be relaunched under you. And **never play audible test audio to check audio**: assert on player state, events and asset files, and run `npm run audio:levels:check`. Listening is a last resort that needs Joe's say-so.
5. **Small windows, never full screen.** Size the viewport to the smallest thing that proves the point (900×600 for desktop layout, a mobile preset for phone). Never maximize or full-screen the browser or the Simulator; a full-screen window covers Joe's work.
6. **Clean up everything you started, every turn.** Destroy the page first (`window.location.replace('about:blank')`) — stopping the server does NOT stop an already-loaded page — then close the tab, stop any `serve`/dev-server you started, and shut down any simulator you booted. Audit before you finish with `for p in $(lsof -nP -iTCP -sTCP:LISTEN -t | sort -u); do ps -o pid=,command= -p $p; done | grep Hero_Football_Manager` — grepping `lsof` output alone finds nothing, because it prints `node`, not the arguments — and note it exits 1 when the result is clean, which is success, not failure. Then **tear down only what you started.** Other worktree sessions run concurrently here: a listener you did not start or a simulator you did not boot may be someone else's live work, and `xcrun simctl list devices booted` being non-empty is not by itself a violation. Record the PID, tab and simulator UDID when you start one, kill those, and report anything else you found still running instead of killing it. Joe's phone Metro on 8081 always stays. Orphans are real — on 2026-08-12 two `expo start --web` servers (ports 8092 and 4174) had been idling for 22h and 36h.
7. **If a check truly needs foreground focus, physical input, audible sound, or a full-screen window, do not run it.** Report the limit and say what you verified instead. "I could not prove this headlessly" is worth more than a check that hijacks the machine.

## Phone dev server (Joe's physical iPhone)

The phone runs a **Debug build with no embedded JS** — it fetches everything from Metro on the Mac, so anything merged to main reaches the phone with a reload, never a rebuild. The recurring traps:

- **Start Metro only via `scripts/phone-dev-server.sh`, in a user-owned Terminal**: `osascript -e 'tell application "Terminal" to do script "/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/scripts/phone-dev-server.sh"'` (Joe can also run `npm run phone` in his own Terminal). Servers started from an agent shell call get reaped within minutes — even nohup'd/detached ones. The script hardcodes the MAIN folder + port 8081, so it serves main even when launched from a worktree. Verify with `curl -fsS -D - http://127.0.0.1:8081/status`: you need BOTH `packager-status:running` and an `X-React-Native-Project-Root` header pointing at the MAIN folder. `curl -s` alone hides connection errors and proves only that some Metro answered — a worktree's Metro on 8081 looks identical in the body.
- **Ship-to-phone loop**: merge to main → `git pull` in the MAIN folder → reload the app on the phone (reopen it, or shake → Reload). Rebuild ONLY for native changes (new native dependency, Expo SDK bump, native app.json settings) or the IP re-bake below.
- **Redbox "No script URL provided … (null)" = stale baked IP, not a Metro problem.** The Mac's LAN IP is baked into the .app (`ip.txt`) at build time, and DHCP moves it (it has been .23, .24 and .12 — never assume a value, always read both). Diagnose in one step: `ipconfig getifaddr en0` vs `find ~/Library/Developer/Xcode/DerivedData -path '*Debug-iphoneos/HeroFootballManager.app/ip.txt' -exec echo {} \; -exec cat {} \;` — the labelled `find` matters, because a bare glob either fails on no match or silently concatenates several builds' files. Fix: rebuild to the plugged-in phone (re-bakes ip.txt). Stopgap Joe can run himself (needs sudo): `sudo ifconfig en0 alias <baked-ip> 255.255.255.255`. Durable cure: a DHCP reservation for the Mac in the router.
- **Phone drops mid-session** → another session's iOS build likely seized port 8081 (`lsof -nP -iTCP:8081 -sTCP:LISTEN`). Restart via the script; after any server death the phone needs one app reopen — a reload broadcast can't reconnect it.
- **Never infer what's on the phone from build artifacts on disk** (`Release-iphoneos` leftovers lie). Shake the phone: a React Native Dev Menu proves a Debug build talking to Metro.

## Key design facts (don't re-litigate casually)

- Matches auto-play, 3–4 real minutes watched; heroes build Heat, bank it until an authored opportunity, then enter "the Zone" (a full-intensity glow that holds until the context arrives — m1.27 removed the countdown, so an unused Zone never fades or refunds Heat). **Powers always fire automatically** — in-context at 85%, the only firing grade in the shipped game. There is no manual hero tap and no M/A toggle (removed 2026-07-25; the sim keeps POWER_TAP and SAVE_FOR_TAP as test instrumentation only). Teammate powers advance independently and may overlap; the match HUD presents one to four simultaneous power tiles as the Hero License cap grows. The player's live inputs are Formation, Playstyle, Swap, and Energy Use — all recorded, so a watched match stays deterministic (same seed + same inputs) without being predetermined. Quick Result runs the same engine and now resolves identically to an unattended watch.
- Powers: 17 ship at launch (Magnet Touch cut at M4 by measurement; catalog in content/powers.json is canon), Hero License field caps (2→4), GK Resolve prevents one-shot goals, wind-ups are interruptible, cut-ins skippable after first view. Timing-sensitivity principle: effects are visible possession/geometry spikes, never stat smears.
- Economy: Money + Training Points — exactly one job each; no new currencies.
- Salaries weekly; awakened players keep old wage until renewal. ×3–5 is the agent's **asking** wage, not the signed one — a negotiated hero renewal can land as low as ×2.0 (measured floor ×1.99).
- Art: B+ "heroic chibi" pixel sprites + comic FX + broadcast dressing; paper-doll customization layers.
- Fail-soft economy (warnings → one loan → forced sale), never game over.
