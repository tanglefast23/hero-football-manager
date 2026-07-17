# Tech Stack Analysis: Mobile-First Soccer Club Management Sim (2026)

**Prepared:** July 17, 2026
**Scope:** iOS-first (then Android) club management sim, ~90% management UI / ~10% one 2D top-down auto-playing match screen, deterministic headless sim core, later PC/Steam port, local-first saves.
**Method:** Each candidate below was checked against current (2026) release notes, official docs, GitHub/npm activity, and community reports — not assumed from training data. Sources are linked inline and collected at the end.

---

## Bottom line up front

**Recommend Option 1: Expo/React Native + `@shopify/react-native-skia`.** It's the only option that doesn't cost this developer weeks of ramp-up before writing game logic (it reuses the exact Expo + EAS + TestFlight pipeline and React/TypeScript skills already in daily use), the sprite-performance ceiling is verified far above what this match screen needs even on budget Android, and the deterministic sim is just plain TypeScript — no engine to route around for testing. The honest weak spot is the PC/Steam port: it's the least proven path of the four and will need real engineering time later. Full reasoning, decision matrix, and risk mitigations below.

---

## 1. Expo/React Native + `@shopify/react-native-skia`

**Stack as proposed:** Expo (managed, EAS Build) + `@shopify/react-native-skia` for the match canvas + `react-native-reanimated` for driving frame updates + `zustand` for UI state + `expo-sqlite`/MMKV for saves. Web/PC: `react-native-web` + Skia's CanvasKit (WebAssembly build of Skia — the same 2D graphics engine, compiled to run in a browser) for a web build, wrapped by Electron or Tauri for Steam.

### What's actually true in 2026

- **Skia is still the only credible native GPU rendering path inside React Native**, actively maintained by Shopify with Software Mansion as a close collaborator — recent commits as of February 2026 updated the underlying Skia engine to m145, and the npm package is on a fast release cadence (2.x line, multiple releases a month). [Shopify/react-native-skia](https://github.com/Shopify/react-native-skia)
- **Sprite performance is verified, not assumed.** The standard cross-engine sprite stress test ("bunnymark") run against react-native-skia's `Atlas` API — which batches many sprites into a single GPU draw call rather than one component per sprite — showed **10,000 bunnies with zero frame drops on an iPhone 12 mini**, minor drops only past 15,000, and significant drops only past 20–25k. On a genuinely low-end Android device (OPPO A16), the ceiling was **~300 sprites** before drops. A separate real-scene test on a mid-range Galaxy A54 held 120fps at 60 objects and 48fps at 350 objects. [Low Atlas performance on cheap Androids #2521](https://github.com/Shopify/react-native-skia/issues/2521) · [RN game engine gap 2026](https://dev.to/grzott/the-react-native-game-engine-gap-in-2026-rnge-skia-phaser-in-webview-expo-gl-55hp)
  - This match screen needs ~22 sprites plus a ball and light particle effects — **roughly 1–7% of the tested budget-Android ceiling and under 1% of the iPhone 12 ceiling.** There's no realistic scenario where 22 sprites are a performance problem on this stack, *provided the Atlas batched-rendering API is used* rather than one Skia/Reanimated component per sprite. A GitHub discussion of unresolved "low FPS with sprite animation" traces directly to that mistake — driving each sprite as its own Reanimated-animated component instead of batching through `Atlas`. [Discussion #2435](https://github.com/Shopify/react-native-skia/discussions/2435) — **this is a real trap for a first-time implementation and should be called out in the technical plan up front.**
- **Expo SDK and the New Architecture (Fabric — React Native's newer rendering engine that lets JS and native code talk to each other without the old async "bridge") are now the default, not an opt-in.** New Architecture has been default since SDK 53; SDK 54 is the last version where it can be disabled; SDK 55+ makes it mandatory. About 83% of SDK 54 EAS builds were already on the New Architecture as of January 2026. `react-native-reanimated` v4 (needed for smooth 60fps animation driving) **requires** the New Architecture and RN 0.76+, and its "worklets" (small functions that run on a background thread instead of blocking the UI) now ship as a separate `react-native-worklets` package. Net: this stack is fully aligned with where Expo is going, not fighting it. [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/) · [Reanimated 4 migration](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/)
- **Web support exists and doesn't require `react-native-web` for the canvas itself** — Skia runs in a browser via CanvasKit (a 2.9MB gzipped WebAssembly bundle) independent of react-native-web. `react-native-web` is still what renders the other 90% of DOM-based management screens for a web/desktop build. [Skia Web Support](https://shopify.github.io/react-native-skia/docs/getting-started/web/)
- **Startup and size are close to bare native.** New Architecture Expo apps benchmark around 267ms cold start on iOS / 341ms on Android — described as "virtually indistinguishable" from bare React Native — thanks to Hermes (React Native's JS engine, which precompiles JavaScript to bytecode ahead of time instead of parsing it on every launch) shrinking bundles 30–50%. [React Native performance benchmarks 2026](https://www.applighter.com/blog/react-native-performance-benchmarks-expo-vs-bare-vs-flutter-vs-native-2026)
- **MMKV vs. expo-sqlite:** `react-native-mmkv` is MIT-licensed (no license concern), up to 30x faster than AsyncStorage, and well-suited to small key/value data (settings, session flags). Given this game's data is inherently relational — squads, contracts, fixtures, league tables, transfer history — **`expo-sqlite` is the better primary save store**, with MMKV optionally handling a handful of tiny fast-access flags (last-opened tab, tutorial state). Don't reach for MMKV as the main save format; it's the wrong shape for relational game data. [MMKV vs SQLite 2026](https://www.pkgpulse.com/guides/react-native-mmkv-vs-async-storage-vs-expo-secure-store-2026)
- **PC/Steam port is the weakest-verified part of this option.** `react-native-web` + CanvasKit + a desktop wrapper is technically sound and there are working examples of Expo output wrapped in Tauri specifically, but **no widely known shipped Steam game uses this exact combination.** It's a reasonable engineering bet built from mature parts, not a well-worn path. [Expo + Tauri desktop](https://www.netguru.com/blog/react-native-expo-tauri)
  - **Tauri vs. Electron for Steam specifically:** the JS libraries that talk to Valve's Steamworks API (achievements, cloud saves, overlay) officially support Electron and NW.js — **not Tauri.** Tauri is smaller and leaner, but Steamworks integration would mean either using Electron for the desktop wrap or hand-rolling a Rust-side Steamworks binding yourself. If the PC version launches with no Steamworks features (many simple indie games do), this doesn't matter; if achievements/cloud saves are wanted at PC launch, lean Electron.

### Fit against the 7 criteria
Reuses 100% of the existing Expo/EAS/TestFlight pipeline and React/TS skillset (fastest to first playable, fastest UI dev), verified far more sprite headroom than needed, trivial pure-TypeScript sim testing, solid size/startup — with the real trade-off being the least-proven PC/Steam port path of the four.

---

## 2. Godot 4.x

### What's actually true in 2026

- **Current version:** Godot 4.6.3 is the current stable maintenance release (4.6 branch shipped January 2026); Godot 4.7 entered beta April 24, 2026 with 1,265 fixes from 309 contributors. This is a healthy, fast-moving open-source project. [Godot 4.6 released](https://blog.ciangames.com/2026/01/godot-engine-46-released.html)
- **iOS export friction is real but not Godot-specific** — like every option here, you need a Mac with Xcode; Godot exports an Xcode project (not a finished binary) that you then sign and archive yourself. The App Store Team ID and Bundle Identifier must be filled in the export settings or the export throws an error. This is standard for any engine targeting iOS, not a unique Godot tax. [Exporting for iOS docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html)
- **In-app purchases are a genuine weak point.** There's no first-party, mature IAP solution comparable to what the React Native ecosystem has (e.g., RevenueCat, expo-iap). Apple's own official Godot iOS plugin has been marked deprecated since WWDC '24. The main community plugin org, `godot-ios-plugins`, was described by its own community in a January 2026 forum thread as lacking a maintainer, with pull requests sitting unreviewed. A promising new community project, `godot-iap`, launched in early-to-mid 2026 following a new cross-platform "OpenIAP" spec (StoreKit 2 + Play Billing 8+) — but it's only months old as of this writing, unproven at scale. **If this club sim plans any IAP (cosmetics, season passes, currency), budget real integration risk here.** [Forum: "official godot iOS plugin obsolete?"](https://forum.godotengine.org/t/its-official-godot-ios-plugin-obsolete/130507)
- **Binary size is Godot's strongest card.** The core Android engine library is 8.5MB uncompressed / 3.2MB compressed; aggressively optimized minimal games have shipped complete APKs as small as 6.5MB. This is the leanest footprint of the four candidates. [Minify Godot's build size](https://popcar.bearblog.dev/how-to-minify-godots-build-size/)
- **GDScript vs. C#:** GDScript (Godot's own Python-like scripting language) has the gentler learning curve and is what ~84% of surveyed Godot users choose, especially solo devs without a prior Python/.NET background — it's genuinely the recommended default. C# is faster for heavy compute but adds real friction on this project specifically: **C# iOS export relies on NativeAOT (a .NET compilation mode that turns C# into a native binary ahead of time, required because Apple doesn't allow the just-in-time compilation regular C# normally uses) that has been "experimental" since Godot 4.2 (2024) and still carries that label** — trimming (removing unused code to shrink the binary) can silently break reflection-dependent code at runtime. GDScript sidesteps this because it doesn't compile to a native binary needing NativeAOT, but GDScript also can't be unit-tested outside the Godot runtime the way plain TypeScript or plain C# can. [Godot C# platform support](https://godotengine.org/article/platform-state-in-csharp-for-godot-4-2/) · [GDScript vs C# 2026](https://www.strayspark.studio/blog/gdscript-vs-csharp-godot-2026-choosing-scripting-language)
- **Deterministic sim testing is better than expected, but still a different world.** Godot ships a real `--headless` command-line mode (no display needed), and two mature community test frameworks — GUT and GDUnit4 — are CI-proven with GitHub Actions integration and JUnit XML export. This works, but it's a separate test ecosystem from Jest/Vitest, needs the Godot binary present in CI, and (for GDScript) can't run fully decoupled from the engine the way pure TypeScript logic can. [GDUnit4](https://github.com/godot-gdunit-labs/gdUnit4) · [Godot CI/CD testing 2026](https://helpmetest.com/blog/godot-ci-cd-testing/)
- **Steam export is Godot's other strongest card — with one caveat worth flagging.** Native Windows/Mac/Linux export is a first-party, mature feature with a long track record of shipped indie hits, and Valve maintains its own partner documentation referencing Godot directly. The de facto standard Steamworks integration, **GodotSteam, works on Godot 4.4+, but its primary GitHub repository was archived (made read-only) by its owner on June 30, 2026** — development has moved to Codeberg, and existing exported games keep working fine, but this is a real mid-2026 maintenance-model disruption for a plugin this path would depend on. [GodotSteam](https://github.com/GodotSteam/GodotSteam) · [Godot on Steamworks partner docs](https://partner.steamgames.com/doc/steamframe/engines/godot)

### Fit against the 7 criteria
Best-in-class Steam port path and smallest binaries, trivially handles the 60fps match rendering — but this is a genuinely new engine, new language, and new UI paradigm for this developer (slowest to first playable, slowest UI dev), and the specific plugins this project would need (iOS IAP, GodotSteam) both show real maintenance churn right now.

---

## 3. Phaser (current) + Capacitor

**Clarification on management UI approach:** Phaser has its own limited `DOMElement` plugin for embedding HTML inside the canvas, but the stronger pattern — confirmed by real project write-ups — is the reverse: build a normal React DOM app for the 90% of screens, and mount a Phaser canvas inside a single `<div>` only for the match screen, with events/state bridging the two. That means, done right, **this option can also use the developer's existing React/TypeScript skillset for almost all of the UI**, not Phaser's own UI tools. [Phaser + React UI](https://3ee.com/blog/phaser-game-react-ui/) · [Phaser DOM Element docs](https://docs.phaser.io/phaser/concepts/gameobjects/dom-element)

### What's actually true in 2026

- **Phaser 4 is current and actively developed.** v4.0.0 "Caladan" shipped April 10, 2026 as, in the team's words, the biggest release in the framework's history — a ground-up WebGL renderer rewrite with a new "Render Node" architecture and a `SpriteGPULayer` feature that batches sprite rendering into single draw calls (claimed up to 100x faster, rated for up to a million sprites — wildly more than the ~22 this project needs). Checking the official downloads page directly, the current release as of this report is **v4.2.1 "Giedi," July 9, 2026** — frequent point releases, a healthy sign. [Phaser 4 downloads](https://phaser.io/download/phaser4) · [Phaser 3 vs 4](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)
- **WebView performance on mid-range Android is the real open question for this option.** Android's System WebView is Chromium-based and has improved a lot, but the evidence is mixed: a 2026 comparison on a Galaxy S24 (a *flagship*, not mid-range) still showed a small gap (58fps vs. a 60fps reference) on simple scrolling, and multiple 2026 sources caution directly that "games...requiring consistent 60fps rendering will struggle with WebView-based solutions" and that complex rendering "can feel less fluid on mid-range devices." Note this is *not* the same finding as "Phaser-in-a-RN-WebView-widget runs 5–10x slower" (a different, more constrained scenario where Phaser is embedded as a small widget inside a React Native app) — Capacitor gives Phaser the *entire* system WebView to itself, which is meaningfully better positioned. Still, of the four options, **this is the one where hitting a locked 60fps on a genuinely mid-range (not flagship) Android device is not something you can simply assume — it needs early, dedicated profiling on real low/mid Android hardware**, not just iPhone testing. [Capacitor performance 2026](https://kanopylabs.com/blog/capacitor-vs-react-native-vs-flutter) · [RN game engine gap 2026](https://dev.to/grzott/the-react-native-game-engine-gap-in-2026-rnge-skia-phaser-in-webview-expo-gl-55hp)
- **App Store acceptance is manageable but not automatic.** Apple's Guideline 4.2.3 targets apps that are little more than a repackaged website. Capacitor apps compile to genuine native app bundles and are broadly accepted — including many real shipped games — but reviewers can still flag a "web wrapper" feel. The standard, well-documented mitigation is using real native Capacitor plugins (haptics, push notifications, camera if relevant) so the app visibly does things a browser tab can't. For a game with genuine bespoke gameplay, save data, and a real simulation engine, this is a real but manageable risk, not a likely rejection. [Guideline 4.2.3 explainer](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- **One universal deadline, not a differentiator:** as of April 28, 2026, Apple requires all App Store Connect uploads to use Xcode 26+/iOS 26 SDK. This affects every option here equally (Expo/EAS, Godot, Capacitor, Unity all ultimately produce an Xcode project or archive) — worth knowing, not worth weighing in the comparison.
- **PC/Steam port path is genuinely solid** because the underlying artifact is already a standard web app — wrapping finished HTML5/Phaser games with Electron for Steam is a well-documented, widely used path with real shipped examples. [Publishing web games to Steam with Electron](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron)
- **Deterministic sim testing is as easy as Option 1** — the simulation is plain TypeScript/JavaScript, fully decoupled from Phaser's renderer, tested the same way under Jest/Vitest with zero engine dependency.

### Fit against the 7 criteria
A legitimate, closely-competitive alternative to Option 1 — same TypeScript skillset for almost all UI, equally trivial sim testing, and arguably an easier Electron-based Steam port. It loses mainly on (c): WebView-based 60fps on real mid-range Android hardware is the one place this stack needs to *prove* itself rather than inherit a verified benchmark, and it means adopting a new build pipeline (Capacitor/Ionic) rather than the one already in daily use.

---

## 4. Unity (brief, per scope)

### What's actually true in 2026

- **The Runtime Fee is fully dead, not just paused.** After the September 2023 backlash, Unity canceled the per-install Runtime Fee entirely and returned to traditional subscription pricing. Unity Personal's free-tier threshold was raised to $200K revenue/funding (from Oct 2024); Pro sits at $200K–$25M, Enterprise above that (from Jan 2025). Unity Pro/Enterprise prices are rising 5% at renewal starting January 12, 2026, and Havok Physics is being unbundled from Pro/Enterprise/Industry on the 6.0 LTS line. Current version line is Unity 6 (internally versioned 6000.x), with **6.3 LTS** the newest long-term-support release (2-year support to December 2027) and 6.0 LTS supported through October 2026. [Unity pricing updates](https://unity.com/products/pricing-updates) · [Runtime Fee cancellation](https://unity.com/blog/unity-is-canceling-the-runtime-fee)
- **Testability is genuinely solid if architected well** — the documented best practice is keeping simulation logic in a plain C# class library with zero `UnityEngine` dependency, tested with vanilla NUnit/`dotnet test` completely outside the Editor (verified as measurably faster than the built-in Unity Test Runner). [Run Unity tests 10x faster](https://gamedev.center/run-unity-tests-faster-dotnet/)
- **Overkill assessment:** Unity is a full AAA-capable 3D engine with a correspondingly heavy editor, C#/.NET toolchain, and — historically, a well-known industry complaint — a larger baseline app size and slower cold start than a lean 2D-focused engine, none of which this 90%-CRUD-UI, one-simple-2D-screen game needs. Native PC/Steam export is excellent and enormously proven, arguably the single most battle-tested path of the four, but that strength is irrelevant to the actual bottleneck here (shipping management UI fast as a solo dev). The 2023 pricing episode, even fully reversed, is a legitimate trust scar worth weighing for a solo dev picking a decade-long dependency.

**Verdict:** technically capable of everything this game needs, but the complexity, learning curve, and app-size tax buy nothing this project actually uses. Not recommended for this scope.

---

## Decision matrix

Scored 1 (worst) – 5 (best) per criterion.

| Criterion | 1. Expo/RN + Skia | 2. Godot 4.x | 3. Phaser + Capacitor | 4. Unity |
|---|---|---|---|---|
| **(a) Speed to first playable (this dev)** | **5** — same pipeline, same language, zero new tools | 2 — new engine, new editor, new language | 4 — same language, new build pipeline | 2 — new engine, heaviest toolchain |
| **(b) Management-UI dev speed/quality** | **5** — React/TS + existing NativeWind patterns | 3 — capable but a new UI paradigm (Control nodes) | 4 — full CSS, same React skillset, if architected as DOM-first | 2 — UGUI/UI Toolkit built for HUDs, not CRUD screens |
| **(c) Match-canvas 60fps (iPhone 12-class + mid-range Android)** | **5** — verified 10k+ sprite headroom iOS, 300+ budget Android | **5** — purpose-built 2D engine, trivial workload | 3 — WebView adds real, unverified-for-this-case variance | **5** — massive headroom, pure overkill |
| **(d) PC/Steam port path quality** | 3 — workable but least-proven combo; Tauri lacks Steamworks lib support | **5** — first-party native export, huge Steam track record | 4 — proven Electron-wrap path, real shipped examples | **5** — most proven path of all, but irrelevant strength here |
| **(e) Deterministic sim testability (CI/unit tests)** | **5** — plain TS, Jest/Vitest, zero engine coupling | 3 — solid headless CI tooling (GUT/GDUnit4) but a separate ecosystem | **5** — plain TS, identical to Option 1 | 4 — mature pattern (plain C# lib + NUnit) if deliberately decoupled |
| **(f) App size & startup time** | 4 — near-native startup (~267–341ms), Hermes-shrunk bundles | **5** — leanest footprint of the four, APKs under 10MB achievable | 4 — light native shell, small added WebView boot cost | 2 — known weak point: heavier baseline size, slower cold start |
| **(g) Long-term maintenance risk** | 4 — actively maintained, but several fast-moving pieces to keep in lockstep | 3 — healthy core engine, but the specific plugins this project needs (iOS IAP, GodotSteam) show real 2026 churn | 4 — mature, "boring" web tech; risk is platform-policy-level, not dependency-level | 3 — proven at scale, but real pricing-trust scar tissue and disproportionate complexity for this scope |

---

## Recommendation

**Build on Expo/React Native + `@shopify/react-native-skia`.**

This wins on the two criteria that actually gate whether this game ships at all for a solo developer: speed to first playable and management-UI development speed, since 90% of the app is exactly the kind of screen this developer already builds daily on this exact pipeline. The one criterion where the prompt asked for real skepticism — match-canvas performance — turned out not to be a risk at all once checked against real benchmarks: 22 sprites is roughly 1–7% of the verified budget-Android ceiling. The genuine trade-off being accepted is criterion (d): the PC/Steam port is the least-proven path of the four and will cost real engineering time later, but "later" is explicitly when that bill comes due, not now.

**Concrete stack:** Expo (managed, EAS Build) · `@shopify/react-native-skia` with the **`Atlas` batched-rendering API** (not per-sprite components) for the match canvas · `react-native-reanimated` v4 to drive frame updates · `zustand` for UI state · `expo-sqlite` as the primary save store (it's relational data — squads, contracts, fixtures, tables) with MMKV, if used at all, limited to small flags · deterministic sim core as plain TypeScript with no Skia/RN imports, unit-tested under Jest/Vitest · later, `react-native-web` + Skia's CanvasKit for a web build, wrapped by Electron for the Steam build (favor Electron over Tauri specifically if Steamworks achievements/cloud-saves are wanted, since the Steamworks JS libraries officially support Electron/NW.js, not Tauri).

### Top 3 risks and mitigations

1. **Risk: naive sprite implementation tanks performance.** The verified 10,000+ sprite headroom only holds if the match renderer uses Skia's `Atlas` batched-draw API. A real GitHub report of "low FPS with sprite animation" traced directly to animating each sprite as its own Reanimated-driven component instead — an easy first-draft mistake.
   **Mitigation:** Build the match renderer's sprite layer around `Atlas`/`useRectBuffer`/`useRSXformBuffer` from day one, and add an early spike that stress-tests it on a real budget Android device (not just an iPhone) before committing further engineering time to the match screen.

2. **Risk: the PC/Steam port stalls or needs a rewrite.** This is the least-proven combination of the four candidates — no widely known shipped Steam game currently uses `react-native-web` + Skia-web + Electron/Tauri together, and Tauri specifically lacks official Steamworks library support.
   **Mitigation:** Because the deterministic sim core is plain, engine-agnostic TypeScript from the start, the worst case if the wrapper approach doesn't pan out is re-hosting the *same* sim logic and UI components under a different renderer/shell later — not a full rewrite. Treat the PC port as a distinct, timeboxed R&D spike once mobile ships, not a load-bearing assumption baked into the mobile architecture. Prototype the Electron/Tauri wrap early enough (even with a placeholder UI) to surface packaging problems long before the PC launch date is real.

3. **Risk: New Architecture / Reanimated / Skia version drift over a multi-year solo project.** This stack couples several fast-moving pieces (RN's New Architecture, Reanimated 4 and its separated `react-native-worklets` package, Skia's own release cadence) that must stay in lockstep; Expo SDK 55+ has already made the New Architecture mandatory with no opt-out.
   **Mitigation:** Pin dependency versions deliberately at each EAS build milestone rather than auto-upgrading, follow Expo's SDK upgrade guide on a fixed cadence (e.g., once per quarter) instead of continuously, and keep the sim core's test suite as the regression safety net — since it has zero Skia/RN imports, it will keep passing regardless of what's happening in the rendering layer, making it easy to isolate whether an upgrade broke gameplay logic or just rendering.

---

## References

**React Native / Expo / Skia**
- [@shopify/react-native-skia GitHub](https://github.com/Shopify/react-native-skia)
- [React Native Skia — Web Support](https://shopify.github.io/react-native-skia/docs/getting-started/web/)
- [Low Atlas performance on cheap Androids — issue #2521](https://github.com/Shopify/react-native-skia/issues/2521)
- [Having low FPS with sprite animation — discussion #2435](https://github.com/Shopify/react-native-skia/discussions/2435)
- [The React Native game engine gap in 2026](https://dev.to/grzott/the-react-native-game-engine-gap-in-2026-rnge-skia-phaser-in-webview-expo-gl-55hp)
- [Expo — React Native's New Architecture](https://docs.expo.dev/guides/new-architecture/)
- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54) · [SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- [Reanimated 4 migration guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/migration-from-3.x/)
- [React Native performance benchmarks 2026](https://www.applighter.com/blog/react-native-performance-benchmarks-expo-vs-bare-vs-flutter-vs-native-2026)
- [React Native MMKV vs SQLite vs SecureStore 2026](https://www.pkgpulse.com/guides/react-native-mmkv-vs-async-storage-vs-expo-secure-store-2026)
- [Expo + Tauri desktop build](https://www.netguru.com/blog/react-native-expo-tauri)
- [Tauri in 2026](https://dev.to/ottoaria/tauri-in-2026-build-cross-platform-desktop-apps-with-web-technologies-better-than-electron-11mo)

**Godot**
- [Godot 4.6 released](https://blog.ciangames.com/2026/01/godot-engine-46-released.html)
- [Exporting for iOS — Godot docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_ios.html)
- [godot-ios-plugins — "obsolete?" forum thread](https://forum.godotengine.org/t/its-official-godot-ios-plugin-obsolete/130507)
- [godot-iap (OpenIAP) GitHub](https://github.com/hyochan/godot-iap)
- [GodotSteam GitHub (archived June 2026)](https://github.com/GodotSteam/GodotSteam) · [GodotSteam on Codeberg](https://codeberg.org/godotsteam/godotsteam)
- [Godot engines — Steamworks partner docs](https://partner.steamgames.com/doc/steamframe/engines/godot)
- [Current state of C# platform support in Godot 4.2](https://godotengine.org/article/platform-state-in-csharp-for-godot-4-2/)
- [GDScript vs C# in Godot 2026](https://www.strayspark.studio/blog/gdscript-vs-csharp-godot-2026-choosing-scripting-language)
- [How to minify Godot's build size](https://popcar.bearblog.dev/how-to-minify-godots-build-size/)
- [GDUnit4 GitHub](https://github.com/godot-gdunit-labs/gdUnit4) · [Godot CI/CD testing 2026](https://helpmetest.com/blog/godot-ci-cd-testing/)

**Phaser / Capacitor**
- [Phaser 4 downloads (official)](https://phaser.io/download/phaser4)
- [Phaser 3 vs Phaser 4](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)
- [Publishing web games to Steam with Electron — Phaser](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron)
- [Phaser game with a React UI](https://3ee.com/blog/phaser-game-react-ui/)
- [Phaser DOM Element docs](https://docs.phaser.io/phaser/concepts/gameobjects/dom-element)
- [Capacitor vs React Native vs Flutter 2026](https://kanopylabs.com/blog/capacitor-vs-react-native-vs-flutter)
- [App Store Guideline 4.2.3 explainer](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [Apple Xcode 26 requirement for Capacitor apps](https://capgo.app/blog/xcode-26-requirement-for-capacitor-apps/)

**Unity**
- [Unity pricing updates (official)](https://unity.com/products/pricing-updates)
- [Unity is canceling the Runtime Fee](https://unity.com/blog/unity-is-canceling-the-runtime-fee)
- [Unity 6.3 LTS announcement](https://unity.com/blog/unity-6-3-lts-is-now-available)
- [Run Unity tests 10x faster with .NET](https://gamedev.center/run-unity-tests-faster-dotnet/)
