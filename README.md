# Hero Football Manager (working title)

A cozy, Kairosoft-style soccer club management sim where some of your players are secretly superheroes. Manage a lower-league club — train players, balance the books, upgrade your grounds — and watch short, charming, auto-played matches where superpowers fire with comic-book spectacle. Tap a charged hero at the perfect moment to turn a match.

**Platform:** iOS first (paid, ~$0.99), Android next, PC (Steam/web) later.
**Art:** "Heroic chibi" pixel art (B+) — big readable heads, taller bodies for real customization, comic-book effects when powers fire, broadcast-style match dressing.

## Running it (dev)

- **Tests:** `npm test` (Jest, ~60s warm — the pure `src/sim`/`src/render` logic is fully headless-testable). **Types:** `npx tsc --noEmit`. There is no lint script — that's intentional, don't add one.
- **Metro:** `npx expo start` (defaults to port 8081; pass `--port 8082` to run a second bundler alongside another checkout). The dev app reads its bundle location from the shake-menu setting, which persists; the `-RCT_jsLocation` launch arg does not.
- **Simulator:** `npx expo start` then press `i`, or build directly with the XcodeBuildMCP CLI (`simulator build-and-run --scheme HeroFootballManager --workspace-path ios/HeroFootballManager.xcworkspace`). Relaunch pointed at a specific bundler with `xcrun simctl launch <udid> com.tanglefast.herofootballmanager -RCT_jsLocation localhost:8082`.
- **Native builds** (needed after any icon/audio/native-dep change — Metro can't hot-load native resources): local `xcodebuild` with cloud signing via the ASC API key. `security find-identity` showing 0 local certs is NORMAL (signing is cloud-based); `expo run:ios` fails its local-cert pre-check, so don't use it. Export `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` for CocoaPods. Device install: wireless (needs the one-time cabled network-pairing toggle) or the TestFlight upload pipeline.
- **Engine version discipline:** any replay-affecting `src/sim` change bumps `ENGINE_VERSION` in `src/sim/match.ts` and regenerates the golden snapshot (`npx jest src/sim/__tests__/parity-replay.test.ts -u`) in the same commit. Current engine: **m0.8**.

## Planning documents

| Doc | Contents |
|---|---|
| [docs/01-vision.md](docs/01-vision.md) | Pitch, design pillars, references, audience, tone |
| [docs/02-core-loop.md](docs/02-core-loop.md) | Weekly loop, season calendar, league pyramid, fail-soft rules |
| [docs/03-match-engine.md](docs/03-match-engine.md) | Deterministic sim design, stats math, match presentation |
| [docs/04-superpowers.md](docs/04-superpowers.md) | Power catalog, Hero Gauge, acquisition, balance rails |
| [docs/05-players-training-coaches.md](docs/05-players-training-coaches.md) | Player anatomy, growth, training, chemistry, coaches, scouting, aging |
| [docs/06-economy.md](docs/06-economy.md) | Three currencies, income/expenses, salaries, negotiation, facilities, tuning tables |
| [docs/07-events.md](docs/07-events.md) | Random event system, odds, launch event list, data schema |
| [docs/08-ui-ux.md](docs/08-ui-ux.md) | Screen map, match screen layout, design language, onboarding |
| [docs/09-tech-stack.md](docs/09-tech-stack.md) | Stack decision, architecture, determinism rules, save data, testing |
| [docs/10-roadmap.md](docs/10-roadmap.md) | Milestones M0–M5, risks, post-launch |

Research reports (source material, written by research agents):
[research/kairosoft-economy.md](research/kairosoft-economy.md) · [research/match-presentation.md](research/match-presentation.md) · [research/stack-analysis.md](research/stack-analysis.md)

## Decision log (locked 2026-07-17)

| Decision | Choice |
|---|---|
| Match involvement | Hybrid: matches auto-play; heroes charge a Hero Gauge; player taps to fire (auto-fires weaker after 8s); halftime tactics/subs |
| Career structure | Climb the league pyramid (Div 5 → Div 1 → cups), endless play after winning it all; score recap after Season 10 |
| Business model | Paid app, ~$0.99, no IAP at launch; economy balanced purely for fun |
| Art direction | B+ "heroic chibi" pixel art + comic FX layer + broadcast match dressing |
| Match music | **“Match Day Heroes”** — original 128 BPM heroic stadium-chiptune loop; the official watched-match theme |
| Income sources | All four: sponsors, tickets/fans, prize money, player sales |
| Currencies | Money + Training Points (TP) + Hero Essence (HE) — each with exactly one job |
| Contract talks | Offer/counter with mood meter; a light card mini-game influences (max ±20%) but never fully decides |
| Superpower acquisition | Risky chance events (wage stays locked until renewal) + rare expensive pre-powered signings + endgame Hero Lab |
| Hero field limit | "Hero License" slots: 2 on the pitch at start, up to 5 via club prestige; squad ownership uncapped |
| Salaries | Weekly wages for everyone; raises at contract renewal; hero-rate renewals (×3–5) after awakening |
| Players | Fictional, procedurally generated (no licensing risk); gentle aging with retirement and a legacy system |
| Stack | Expo/React Native + TypeScript + react-native-skia (Atlas API); deterministic pure-TS sim core |

## Deliberately deferred (not forgotten)

- Additional music and final mix balance — decide during M4 polish
- PC input mapping and landscape layouts — decide at the PC port spike
- Localization beyond English — post-launch
- Android release timing — after iOS beta feedback
