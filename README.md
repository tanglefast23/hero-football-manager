# Hero Football Manager (working title)

A cozy, Kairosoft-style soccer club management sim where some of your players are secretly superheroes. Manage a lower-league club — train players, balance the books, upgrade your grounds — and watch short, charming, auto-played matches where superpowers fire with comic-book spectacle. Build the squad, set the shape, and watch your heroes turn a match.

**Platform:** iOS first (paid, ~$0.99), Android next, PC (Steam/web) later.
**Art:** "Heroic chibi" pixel art (B+) — big readable heads, taller bodies for real customization, comic-book effects when powers fire, broadcast-style match dressing.

## Running it (dev)

- **Tests:** `npm test` (Jest; the full deterministic seed sweeps can take ~7 minutes — the pure `src/sim`/`src/render` logic is fully headless-testable). **Types:** `npx tsc --noEmit`. There is no lint script — that's intentional, don't add one.
- **Metro:** `npx expo start` (defaults to port 8081; pass `--port 8082` to run a second bundler alongside another checkout). The dev app reads its bundle location from the shake-menu setting, which persists; the `-RCT_jsLocation` launch arg does not.
- **Power live-match review (development only):** `EXPO_PUBLIC_POWER_MATCH_QA=1 npx expo start --web --port 8092`. This runs every launch power one at a time through the real `MatchScreen`, real Atlas players, contextual engine activation, team-colour control-area title, audio, and production effect art. Each scenario briefly holds its authored best-use match situation, then auto-fires at the normal contextual-auto strength. The power has no review timeout: if its best context is not present, it stays banked until that context appears. Previous, Restart, and Next controls cycle and replay the catalog.
- **Power effect-art review (web, development only):** `EXPO_PUBLIC_POWER_ART_QA=1 npx expo start --web --port 8092`. This lighter review reel reuses the production effect layer, but deliberately uses a simplified pitch and demo actors; it is not a live match replay.
- **Dev Harness (development only):** `EXPO_PUBLIC_DEV_HARNESS=1 npx expo start` — the front door for reviewing any screen. See [Dev Harness](#dev-harness) below.
- **Awards ceremony review (development only):** `EXPO_PUBLIC_AWARDS_CEREMONY_QA=1 npx expo start`. Superseded by the Dev Harness, kept working for now. The division awards ceremony plays once a season, so this drives the real `AwardsCeremonyScreen` against fabricated podiums instead: pick a case (mixed / sweep / thin / nothing won), jump straight to any board or to the prize, and toggle reduced motion. Hide the control panel to see the layout untouched.
- **Simulator:** `npx expo start` then press `i`, or build directly with the XcodeBuildMCP CLI (`simulator build-and-run --scheme HeroFootballManager --workspace-path ios/HeroFootballManager.xcworkspace`). Relaunch pointed at a specific bundler with `xcrun simctl launch <udid> com.tanglefast.herofootballmanager -RCT_jsLocation localhost:8082`.
- **Native builds** (needed after any icon/audio/native-dep change — Metro can't hot-load native resources): local `xcodebuild` with cloud signing via the ASC API key. `security find-identity` showing 0 local certs is NORMAL (signing is cloud-based); `expo run:ios` fails its local-cert pre-check, so don't use it. Export `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods. Device install: wireless (needs the one-time cabled network-pairing toggle) or the TestFlight upload pipeline.
    - **Engine version discipline:** any replay-affecting `src/sim` change bumps `ENGINE_VERSION` in `src/sim/match.ts` and regenerates the golden snapshot (`npx jest src/sim/__tests__/parity-replay.test.ts -u`) in the same commit. Current engine: **m2.0**.

## Dev Harness

One flag, one build, every registered feature a tap away. It exists because the older review reels (`EXPO_PUBLIC_POWER_MATCH_QA`, `EXPO_PUBLIC_POWER_CUTIN_QA`, `EXPO_PUBLIC_POWER_ART_QA`, `EXPO_PUBLIC_AWAKENING_ART_QA`, `EXPO_PUBLIC_AWARDS_CEREMONY_QA`) each have their own flag, and `process.env.EXPO_PUBLIC_*` is inlined at transform time — so switching from one reel to another costs a full static export. That friction is why most screens in this game have never been looked at.

**Reaching it**

```
EXPO_PUBLIC_DEV_HARNESS=1 npx expo start          # Metro (web, simulator, device)
```

Static web export, which is where deep links are worth having:

```
rm -rf dist && EXPO_PUBLIC_DEV_HARNESS=1 npx expo export --platform web --clear
node scripts/web/fix-worker-bundles.mjs
cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm dist/
npx serve dist
```

`--clear` is not optional: a cached transform keeps the previous flag inlined and you will debug a stale bundle.

The flag is the only way in. A build without it inlines `undefined` at the check in `App()`, so the branch is dead code and no route a player can reach leads here.

**Deep links**

| URL | Opens |
|---|---|
| `#/dev` | the menu |
| `#/dev/<entryId>` | that entry, on its first case |
| `#/dev/<entryId>/<caseId>` | that entry, on that case |

Cold loads work, so a screenshot of one exact state costs a URL rather than a run of taps: `http://localhost:3000/#/dev/awards-ceremony/sweep`. Selecting an entry or a case updates the hash, and an address the registry no longer holds — a renamed entry, a dropped case — falls back to the menu and corrects the URL rather than stranding you. Native has no location hash, so there the harness simply holds its route in memory; everything else behaves the same.

**Adding an entry**

1. Write `src/ui/dev-harness/entries/<feature>.tsx` and export one `DevHarnessEntry`:

    ```tsx
    export const boardUltimatumEntry: DevHarnessEntry = {
      id: 'board-ultimatum',                 // url-safe, stable: it is half of a bookmark
      group: 'Season',                       // menu section; a new name opens a new one
      title: 'Board ultimatum',
      summary: 'The warning the board issues when a season is going badly.',
      cases: [
        { id: 'first-warning', label: 'Warning', note: 'One bad season, still recoverable' },
        { id: 'final', label: 'Final', note: 'Last chance before the sack' },
      ],
      render: caseId => <BoardUltimatumReel caseId={caseId as UltimatumCaseId} />,
    };
    ```

2. Register it: one import plus one line in the `DEV_HARNESS_ENTRIES` array in `registry.ts`. Nothing self-registers, so that array is the whole answer to "what is in the harness".
3. Feed the **production** screen its real inputs. Two ways, and the feature picks:
    - Fabricate them, when the input is small. The awards entry writes four podiums into a `SeasonRecap` and hands it to the shipped view-model builder — never to a hand-assembled view model, which could only ever prove itself.
    - Ask for a career, when the screen reads a whole `GameState`. `devHarnessCareerAtWeek(season, week)` and `devHarnessCareerAtSeasonEnd(season)` in `src/ui/dev-harness/career.ts` run the real season clock from a fixed seed and cache the result, so opening an entry pays for the simulation once. `devHarnessCareer({ id, seed, stopAt })` takes any stopping condition; give it an id that folds in everything you varied.
4. Controls the entry owns go in the entry, drawn with `DevHarnessButton` and `devHarnessControlStyles` so they match the harness bar.

`cases` are the *inputs* — the states worth a bookmark, one line each on the menu and one chip each in the harness bar. Anything a reviewer flips while looking at one of those states (a jump, a speed, a motion toggle) belongs inside the entry's own controls; folding it into `cases` multiplies the menu out into something nobody can read.

The harness owns the top-left of an open entry and nothing else, and it remounts the entry whenever the case changes — so an entry may read its case once and keep state without worrying about the harness changing it underneath.

Two house rules the harness inherits: give every `Pressable` an explicit `minHeight` in a **static** style (a function-form `style` drops layout properties on iOS and collapses the control to zero height), and add no audio cue (the management SFX table is index-addressed by eight tests).

Logic goes in a module that imports no React: `route.ts` (addresses) and `career.ts` (seeded careers) are both covered by tests in `src/ui/dev-harness/__tests__/`. Jest runs with `testEnvironment: 'node'` and `require('react-native')` throws there, so nothing in the harness can be rendered in a test — the registry itself is not even importable from one.

## Planning documents

| Doc | Contents |
|---|---|
| [docs/01-vision.md](docs/01-vision.md) | Pitch, design pillars, references, audience, tone |
| [docs/02-core-loop.md](docs/02-core-loop.md) | Weekly loop, season calendar, league pyramid, fail-soft rules |
| [docs/03-match-engine.md](docs/03-match-engine.md) | Deterministic sim design, stats math, match presentation |
| [docs/04-superpowers.md](docs/04-superpowers.md) | Power catalog, Hero Gauge, acquisition, balance rails |
| [docs/05-players-training-coaches.md](docs/05-players-training-coaches.md) | Player anatomy, growth, training, chemistry, coaches, scouting, aging |
| [docs/06-economy.md](docs/06-economy.md) | Two currencies, income/expenses, salaries, negotiation, facilities, tuning tables |
| [docs/07-events.md](docs/07-events.md) | Random event system, odds, launch event list, data schema |
| [docs/08-ui-ux.md](docs/08-ui-ux.md) | Screen map, match screen layout, design language, onboarding |
| [docs/09-tech-stack.md](docs/09-tech-stack.md) | Stack decision, architecture, determinism rules, save data, testing |
| [docs/10-roadmap.md](docs/10-roadmap.md) | Milestones M0–M5, risks, post-launch |
| [docs/11-art-style.md](docs/11-art-style.md) | Pixel-art bible: palette, button bevel recipe, caricature + expression rules, atlas/naming |

Research reports (source material, written by research agents):
[research/kairosoft-economy.md](research/kairosoft-economy.md) · [research/match-presentation.md](research/match-presentation.md) · [research/stack-analysis.md](research/stack-analysis.md)

## Decision log (locked through 2026-07-19)

| Decision | Choice |
|---|---|
| Match involvement | Matches auto-play and powers always fire automatically in their authored context — there is no manual hero tap. The player's live controls are Formation, Playstyle, Swap, and Energy Use |
| Match effort | Playstyle controls tactical intent; Save Energy / Balanced / All Out controls physical effort, movement, and condition drain without directly changing passing or shooting |
| Career structure | Climb from D5 · District League to D1 · Global League; win **both** D1 and the National Cup to complete the main journey, then continue endlessly; the career record is kept in the Hall of Fame |
| Business model | Paid app, ~$0.99, no IAP at launch; economy balanced purely for fun |
| Art direction | B+ "heroic chibi" pixel art + comic FX layer + broadcast match dressing |
| Opening music | **“Heroes Start Here”** — original 128 BPM title-screen fanfare and seamless chiptune loop |
| Match music | **“Match Day Heroes”** — original 128 BPM heroic stadium-chiptune loop; the official watched-match theme |
| Management music | **“Clubhouse Dreams”** — original 112 BPM warm chiptune loop for training, squad, transfers, facilities, and finances |
| Event music | **“The Big Call”** — original 136 BPM dramatic chiptune loop for story interruptions and player choices |
| Awakening music | A 10.3-second trimmed **“Spirit of the Dead”** pre-rise bed starts with the limp and fades over its final second if the player waits; it cuts the instant the rise begins, when the existing angels/harps ascension cue takes over |
| Income sources | All four: sponsors, tickets/fans, prize money, player sales |
| Currencies | Money + Training Points (TP) — each with exactly one job |
| Contract talks | Offer/counter with mood meter; a light card mini-game influences (max ±20%) but never fully decides |
| Superpower acquisition | Risky chance events (wage stays locked until renewal) + rare expensive pre-powered signings |
| Hero field limit | "Hero License" slots: 2 on the pitch at start, up to 4 via club prestige; squad ownership uncapped |
| Salaries | Weekly wages for everyone; raises at contract renewal; hero-rate renewals (×3–5) after awakening |
| Players | Fictional, procedurally generated (no licensing risk); gentle aging with retirement and a legacy system |
| Stack | Expo/React Native + TypeScript + react-native-skia (Atlas API); deterministic pure-TS sim core |

### Balance decisions (2026-07-25–29, implementation campaign complete)

The scale-invariant campaign replaces compressed high ratings with ratio-based
contests, a bounded pace curve, an honest D5→D1 ladder, and percentage-based
rival growth. The locked implementation spec and completed acceptance evidence are
in [the scale-invariant attributes master spec](docs/superpowers/plans/2026-07-29-scale-invariant-attributes.md).

| Question | Decision | Where it lands |
|---|---|---|
| Economy: cut wages or raise income? | **Raise income**, via the fans / ticket price / sponsor levers | Division income scales; transfer values and generated wages are anchored to each division's support band |
| Should PAC matter? | **Yes.** Pace must convert into chances — accepting it as a dead stat is rejected | `PACE_SPEED128` supplies bounded, strictly increasing movement with fixed-point residue carry |
| Is the goalkeeper the most important player? | **No.** Flatten the shot/save asymmetry so the eleven matter roughly equally | REF now uses the symmetric log-ratio contest and each division has an explicit keeper REF target |
| Opponent shape | **Balanced teams with visible specialists.** | Explicit support, specialist focus, pace, and keeper tables replace the old star back-solve |
| Opponent season scaling | **Slow percentage growth**, so the meaning is stable at every division | Cozy +3%/season, Chairman +4%, deterministic stochastic rounding, capped below 999 |
| Tutorial fixture | Open against the **strongest** rival, then ease down to the weakest by match five | `schedule.ts` `pinOpeningLeagueOpponents` |
| Hero worth | **Powers are typed spectacle after ordinary ratios.** | Power bonuses use d64, multiplier, geometry, or time effects rather than hidden raw-stat additions |
| Chairman mode | **Genuinely harder**, not Cozy with four economic knobs turned down | `difficulty.ts` needs a difficulty axis beyond the economy |
| How hard is D5? | **1 season for a good player, 2 at most for someone still learning.** Not a multi-season tutorial arc, and never the current unsignposted permanent 10th place | Sets the target for every number above |
| Should the harness gate the ramp? | **Yes** — assert a best-play career promotes out of D5 **within 2 seasons**, and that a competent-play career manages it in 1 | `division-ramp-probe.test.ts` (`DIVISION_RAMP_PROBE=1`). Not `m2-balance.test.ts`: it scores fixtures from the seed alone and never reads squad strength |
| Manual Zone tap | **Removed permanently**; powers always fire automatically | Done — see docs/04 |
| Cup giant-killing | **Enabled:** one division down wins 5–10%; two-plus down wins 1–2% | Deterministic long-tail Cup model; Bert celebrates every qualifying player win with gap-specific copy |

## Deliberately deferred (not forgotten)

- Final mix balance — decide during M4 polish
- PC input mapping and landscape layouts — decide at the PC port spike
- Localization beyond English — post-launch
- Android release timing — after iOS beta feedback
