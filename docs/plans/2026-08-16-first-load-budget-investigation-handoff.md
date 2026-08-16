# Handoff: get the web first-load budget safely down

**Written:** 2026-08-16, from branch `claude/motivational-speech-cutscene-306228`
**For:** whoever picks up first-load performance next
**Status:** investigation brief. No fix is prescribed — the sizing work below is
real and measured, the causes are not yet proven.

## The ask

The web build's first load is at **6,023,331 raw / 903,351 gzip** and the budget
had to be raised again to let a small feature land. Find out what is actually in
those bytes and what can safely come out, so the number can go **down** and stay
comfortably under rather than being ratcheted up per feature.

## What "first load" is here

`scripts/web/verify-first-load-budget.mjs` exports the web build and measures the
JS the browser must fetch and parse before anything renders. Today that is three
files:

```
__expo-metro-runtime-*.js
__common-*.js
index-*.js          <- ~5.96 MB of the total; this is the one to attack
```

Everything else is a lazy chunk and does not count. Two numbers are enforced:
gzip (download time) and raw (parse time — usually the worse one on a phone).

```bash
npm run web:first-load:check
```

## Measured starting points

Run on this branch, 2026-08-16. **Re-measure before trusting any of it** — and
note the caveat in "Traps" about which build you are measuring.

### The big rocks: sprite data bundled as JSON

| File | Bytes |
|---|---|
| `src/render/sprites/sprites.json` | **1,982,277** |
| `src/render/sprites/portraits.json` | **1,357,643** |
| `src/render/sprites/management-sprites.json` | **269,256** |
| `src/render/sprites/player-look-manifest.json` | 12,215 |

That is **~3.6 MB of JSON**, against a ~6.0 MB first load. If it is all in
`index-*.js`, it is more than half the problem and everything else is rounding.

**This is the first thing to confirm or kill.** I confirmed
`management-sprites.json` IS in the bundle (`coach:amara-okafor:rest` returns 1
hit in `index-*.js`). I did **not** confirm the other two — my probes for
`"palette"` and `sprites.json` returned 0 hits, which most likely means the
minifier renamed or restructured them rather than that they are absent. Do not
conclude they are lazy on my evidence; pick a probe string that survives
minification (a literal pixel row, a hex colour, a sprite key) and check
properly.

### Content JSON, also bundled

| File | Bytes |
|---|---|
| `content/events.json` | 127,497 |
| `content/clubs.json` | 89,904 |
| `content/assistant-guide.json` | 25,310 |
| `content/glossary.json` | 12,325 |
| everything else in `content/` | < 10,000 each |

`loadLaunchContent()` (`src/content/load.ts`) imports **all** of these eagerly and
zod-parses them. ~290 KB of JSON plus the schema pass.

### Locale catalogs — already lazy, leave alone

| File | Bytes |
|---|---|
| `content/i18n/vi.json` | 371,836 |
| `content/i18n/fr.json` | 352,571 |
| `content/i18n/de.json` | 347,433 |
| `content/i18n/es.json` | 345,922 |
| `content/i18n/pt-BR.json` | 342,321 |
| `content/i18n/id.json` | 340,248 |
| `content/i18n/en.json` | 201,797 |

**Verified lazy**: a Spanish string returns 0 hits in `index-*.js` and 1 hit in
`es-*.js`. Each locale is its own chunk. This is already correct — do not
"optimize" it and do not count these 2.3 MB as first-load weight.

### A live lead worth checking first

`grep -c "scale-invariant" index-*.js` returns **1**.

`src/audit/fixtures/scale-invariant-opening-gate.json` is **157,665 bytes** of
balance-probe fixture data. `src/audit/` is measurement and test tooling. If a
fixture of that size is reachable from the app graph, something in `src/audit/`
is being imported by shipped code, and that is a pure win to sever. Find the
import chain (`madge`, or grep the app rings for `audit/` imports) before
assuming — one hit could also be an unrelated substring.

## Candidate directions, cheapest first

Not recommendations. Each needs measuring.

1. **Sever `src/audit/` from the app graph.** If the fixture lead is real, this
   is dead weight with no player-facing cost. Start here.
2. **Sprite data as an asset, not a module.** JSON imported by JS is parsed as
   part of the bundle. The same bytes fetched as an asset (or packed to a real
   image / binary) are lazy, cacheable, and parsed by the platform instead of by
   Metro's runtime. This is the biggest prize and the biggest change; the
   Atlas-rendering rule in `CLAUDE.md` matters here.
3. **Split the sprite sheets by need.** `portraits.json` is 1.36 MB. The title
   screen does not need every portrait. What does the FIRST screen actually
   need?
4. **Make `loadLaunchContent()` lazy per file.** `events.json` (127 KB) is not
   needed to draw the title screen. The zod parse cost is documented at 40–80 ms
   in Node, several hundred on Hermes — that is startup time as well as bytes.
5. **Check for duplicated deps in `__common-*.js`.** Standard bundle hygiene;
   cheap to look at, sometimes free wins.

## How to measure properly

The budget script gives one total. For a per-module breakdown you need more:

- Export with source maps and run a bundle visualiser over `index-*.js`. This is
  the single highest-value setup step — without it you are guessing.
- `npx expo export --platform web` writes to `dist/`. Compare
  `wc -c dist/_expo/static/js/web/index-*.js` between experiments.
- To attribute a change, measure the merge base the same way in a throwaway
  worktree — `git worktree add --detach <path> <sha>`; Node resolves
  `node_modules` up the tree, so no install is needed. That is how the
  "+5,508 is entirely this branch" figure in
  `verify-first-load-budget.mjs` was established.

## Traps, all hit on 2026-08-16

- **Metro caches hard.** Two consecutive exports produced a byte-identical
  `index-*.js` hash despite a changed env var. Use `--clear` when a build should
  differ, and check the hash in `dist/index.html` actually moved.
- **`serve` caches too.** After a rebuild it kept serving the old bundle;
  restarting it on a fresh port was the fix. Verify with
  `curl -s http://127.0.0.1:PORT/ | grep -o 'index-[a-f0-9]*\.js'`.
- **`serve -s` breaks Skia.** SPA mode rewrites the `canvaskit.wasm` request to
  `index.html`, and the app dies with `expected magic word`. Serve without `-s`,
  and copy `node_modules/canvaskit-wasm/bin/full/canvaskit.wasm` to `dist/`.
- **The dev harness needs its own build.** `EXPO_PUBLIC_DEV_HARNESS=1` is baked
  at build time. That build is NOT the one to measure the budget against.
- **CI reads ~1,037 bytes higher than a local export** of the identical tree.
  The current budget is set from local + that gap. If CI reports lower, ratchet
  down rather than banking the slack.
- **Do not grep the bundle for short substrings of app code.** A previous author
  recorded that `SPEECH` hits seven times inside `MOTIVATIONAL_SPEECH`. Pick
  probe strings that exist only in the thing being tested.

## Rules that constrain any fix

From `CLAUDE.md`, non-negotiable:

- `src/sim/` and `src/game/` are pure TypeScript. No React Native, Skia or Expo
  imports; no `Math.random` / `Date.now`.
- Match rendering uses react-native-skia's **Atlas batched API**. Never one
  component per sprite.
- Game content stays typed JSON, zod-validated, in `content/`.
- Any replay-affecting sim change bumps `ENGINE_VERSION`. A bundling change
  should not touch the sim at all — if it does, something is wrong.
- New player-facing copy ships in all seven languages in the same commit.

## Definition of done

A measured, attributed reduction with the budget constants moved **down** in
`scripts/web/verify-first-load-budget.mjs`, plus a comment in that file saying
what came out and how it was measured — the file's existing history is the
format to follow. Lowering the number without evidence is worse than leaving it.
