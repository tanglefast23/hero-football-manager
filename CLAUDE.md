# Hero Football Manager — Project Context

Kairosoft-style soccer club management sim with superpowered players. iOS-first (paid ~$0.99), Expo/React Native. Currently in planning → early build phase.

## Read first

- `README.md` — decision log + doc index. All design decisions live in `docs/01`–`docs/10`.
- `research/` — background research reports (Kairosoft economics, match presentation, stack analysis). Reference, not canon; the docs are canon.

## Non-negotiable architecture rules

- `src/sim/` (match engine) and `src/game/` (season/economy/events) are **pure TypeScript**: no React Native, Skia, or Expo imports, no `Math.random`/`Date.now` — a seeded PRNG (mulberry32) is injected. Everything in these rings must be Jest-testable headless and deterministic (same seed = byte-identical results).
- Match rendering uses react-native-skia's **Atlas batched API** — never one component per sprite (known perf trap).
- Game content (powers, events, drills, sponsors, archetypes, names) is typed JSON in `content/`, zod-validated. New content ships as data, not code.
- Balance changes must keep the CI balance-harness assertions passing (see `docs/09-tech-stack.md`).
- Any replay-affecting sim change (behavior, tuning, or RNG consumption) must bump `ENGINE_VERSION` in `src/sim/match.ts`. The golden-replay snapshot update is the forcing reminder — never update that snapshot without a version decision.

## New copy ships in all seven languages, or it does not ship

The game ships in en, es, pt-BR, fr, de, id and vi. **Writing English copy is half the task; the other half is the same commit.** Never leave translation as a follow-up — it has been left twice and both times shipped English to six languages.

- **Player-facing prose belongs in `content/*.json`**, not in a component. `contentStrings()` flattens it into keys, and gate 10 then holds every content file at **100% in all six locales**. Adding a Bert page, a story event or a coach line without translating it turns CI red with the file named.
- **Chrome strings belong in `content/i18n/en.json`** and must appear in all six other catalogs — gate 1 fails on any English key a locale is missing. (It is a subset check, not exact parity: a stale key left in a locale and no longer in English is invisible to it.)
- **`src/sim/` and `src/game/` may not import `src/i18n`.** A pure ring dual-writes: the English sentence plus a `labelKey`/`textKey` (and raw `labelParams` — never pre-formatted text). The app ring resolves the pair with `copyOrEnglish` / `resolveRingCopy`. Writing the key is not enough — **check a consumer actually reads it**, because a key nothing requests is the single most common defect in this codebase's history.
- **Never translate an id.** Archetypes, personalities, specialties, mentalities and cup rounds are persisted enum values compared as control values; translating one at source breaks saves and replays. Add a display key and look it up.
- **Deliberately English**: club and player names, fictional sponsor brands, stat codes (PAC/SHO/REF), role codes (GK/DEF/MID/FWD), and `ScreenErrorBoundary` — the screen that renders when translation itself may be what broke, exempted in `hardcoded-prose.ts`. Everything else translates.
- **Coverage floors go UP; the prose ceiling goes DOWN.** They move in opposite directions and it is easy to say this wrong. A `COVERAGE_FLOOR` is a minimum — raising it demands more translation. `MAX_REMAINING` in `no-hardcoded-prose.test.ts` is a maximum — *lowering* it demands less hardcoded English. If either is in your way, the copy is untranslated; fix the copy, not the number.
- **Lowering a floor is a two-table act, on purpose.** `gates.test.ts` holds `FLOOR_HIGH_WATER` beside `COVERAGE_FLOOR`: a floor below its mark, missing a locale, or absent from either table fails. This is a speed bump, not a lock — someone editing both tables in one commit still gets green, and no in-repo constant can prevent that. What it buys is that the one-line accident cannot happen, and the deliberate version has to say out loud in the diff that the game ships less translated than it once did. `events.json` went 100 → 38 exactly that way and sat there until someone happened to ask.
- **Vietnamese uses a custom pixel font** with 102 hand-built glyphs. The authority is the FONT — gate 5 reads the shipped face's cmap (`glyphSet(faceFile(...))`), not the catalog — so a glyph in the face is legal even if no string uses it yet. Sticking to characters already in `content/i18n/vi.json` is the safe shortcut, not the rule. Gate 5 checks display copy in both its authored and UPPERCASED forms, because the stylesheet uppercases most of it; body prose is deliberately unchecked, since it renders in the platform sans.

## Preview & QA hygiene (no background game audio)

- The web build auto-plays looping music, and browser-pane tabs + `serve`/dev-server processes outlive your turn — a forgotten preview plays game audio through the Mac speakers indefinitely.
- Immediately after loading any web preview of the game, mute it (via javascript_tool): `document.querySelectorAll('audio,video').forEach(el => { el.muted = true; })`. If sound persists (Web Audio can't be muted from outside), navigate the tab to `about:blank` between checks.
- When QA is done, ALWAYS close the preview tab and stop any `serve`/static/dev-server process you started. Same for simulators: shut down a simulator you booted once you're finished with it. Never leave a running game tab or booted sim behind at the end of a turn.

## Phone dev server (Joe's physical iPhone)

The phone runs a **Debug build with no embedded JS** — it fetches everything from Metro on the Mac, so anything merged to main reaches the phone with a reload, never a rebuild. The recurring traps:

- **Start Metro only via `scripts/phone-dev-server.sh`, in a user-owned Terminal**: `osascript -e 'tell application "Terminal" to do script "/Users/joemacprom5/Documents/Vibecode/Hero_Football_Manager/scripts/phone-dev-server.sh"'` (Joe can also run `npm run phone` in his own Terminal). Servers started from a Claude Bash call get reaped within minutes — even nohup'd/detached ones. The script hardcodes the MAIN folder + port 8081, so it serves main even when launched from a worktree. Verify: `curl -s localhost:8081/status` → `packager-status:running`.
- **Ship-to-phone loop**: merge to main → `git pull` in the MAIN folder → reload the app on the phone (reopen it, or shake → Reload). Rebuild ONLY for native changes (new native dependency, Expo SDK bump, native app.json settings) or the IP re-bake below.
- **Redbox "No script URL provided … (null)" = stale baked IP, not a Metro problem.** The Mac's LAN IP is baked into the .app (`ip.txt`) at build time, and DHCP flaps it between 192.168.1.23 and .24 (broke 2026-07-28 AND 2026-07-29). Diagnose in one step: `ipconfig getifaddr en0` vs `cat ~/Library/Developer/Xcode/DerivedData/HeroFootballManager-*/Build/Products/Debug-iphoneos/HeroFootballManager.app/ip.txt`. Fix: rebuild to the plugged-in phone (re-bakes ip.txt). Stopgap Joe can run himself (needs sudo): `sudo ifconfig en0 alias <baked-ip> 255.255.255.255`. Durable cure: a DHCP reservation for the Mac in the router.
- **Phone drops mid-session** → another session's iOS build likely seized port 8081 (`lsof -nP -iTCP:8081 -sTCP:LISTEN`). Restart via the script; after any server death the phone needs one app reopen — a reload broadcast can't reconnect it.
- **Never infer what's on the phone from build artifacts on disk** (`Release-iphoneos` leftovers lie). Shake the phone: a React Native Dev Menu proves a Debug build talking to Metro.

## Key design facts (don't re-litigate casually)

- Matches auto-play, 3–4 real minutes watched; heroes build Heat, bank it until an authored opportunity, then enter "the Zone" (a full-intensity glow that holds until the context arrives — m1.27 removed the countdown, so an unused Zone never fades or refunds Heat). **Powers always fire automatically** — in-context at 85%, the only firing grade in the shipped game. There is no manual hero tap and no M/A toggle (removed 2026-07-25; the sim keeps POWER_TAP and SAVE_FOR_TAP as test instrumentation only). Teammate powers advance independently and may overlap; the phone match HUD shows one takeover card plus a "+N more heroes live" count, while the desktop rail shows up to four persistent hero tiles as the Hero License cap grows. The player's live inputs are Formation, Playstyle, Swap, and Energy Use — all recorded, so a watched match stays deterministic (same seed + same inputs) without being predetermined. Quick Result runs the same engine and now resolves identically to an unattended watch.
- Powers: 17 ship at launch (Magnet Touch cut at M4 by measurement; catalog in content/powers.json is canon), Hero License field caps (2→4), GK Resolve prevents one-shot goals, wind-ups are interruptible, cut-ins skippable after first view. Timing-sensitivity principle: effects are visible possession/geometry spikes, never stat smears.
- Economy: Money + Training Points — exactly one job each; no new currencies.
- Salaries weekly; awakened players keep old wage until renewal, then ×3–5 hero rates.
- Art: B+ "heroic chibi" pixel sprites + comic FX + broadcast dressing; paper-doll customization layers.
- Fail-soft economy (warnings → one loan → forced sale), never game over.
