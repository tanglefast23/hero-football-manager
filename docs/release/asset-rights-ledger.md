# Asset rights ledger

Last reviewed: 2026-08-17  
Release scope: Hero Football Manager 1.0 for iPhone and iPad

This ledger records evidence; it does not create rights that do not already
exist. Joe confirmed on 2026-08-06 that every supplied audio recording and cue
listed below is authorized for commercial/public use in the App Store release.
Any private underlying license, receipt, or source record should remain outside
the repository.

## Visual assets

Joe confirmed on 2026-08-05 that all visual artwork was drawn programmatically
for this game and that no third-party visual assets were used.

| Group | Shipped examples | Provenance | Status |
|---|---|---|---|
| App icon, splash source, and favicon | `assets/icon.png` is the current app icon and splash source; `assets/favicon.png` is the web icon | Owner confirmation; `scripts/icon/gen-icons.mjs` is the deterministic app-icon writer | Cleared by owner |
| Removed event art | The former `assets/art/events/*.jpg` files were deleted from current `main` before this release candidate | Owner confirmation still covers the artwork, but it is not part of the current shipped asset set | Not shipped in current release |
| Portraits, characters, facilities, match and UI art | Generated sprite JSON and programmatic renderers under `src/render/sprites/`, `src/ui/`, and generation scripts | Repository source plus owner confirmation | Cleared by owner |
| Fictional players and clubs | Typed game content and deterministic generators | Original fictional content; README explicitly excludes real-player licensing | Cleared by owner |

## Audio

| Group | Evidence | Status |
|---|---|---|
| Match, opening, management, and event themes | `scripts/audio/gen-music.mjs` and `gen-menu-music.mjs` state that every sound is synthesized with no samples or third-party music | Cleared by repository evidence |
| Procedural WAV sound catalog | `scripts/audio/gen-sfx.mjs`, `synth.mjs`, and `catalog.mjs` generate the catalog from oscillators and seeded noise | Cleared by repository evidence |
| “Spirit of the Dead” awakening excerpt | `assets/audio/music/awakening-limp.m4a`; README names it as a trimmed excerpt; Joe confirms commercial/public-use authorization | Cleared by owner confirmation (2026-08-06) |
| Supplied button recording | `ui-push-button.m4a` and its derivative `ui-single-click.m4a`; `assets/audio/sfx/README.md` calls the source supplied; Joe confirms commercial/public-use authorization | Cleared by owner confirmation (2026-08-06) |
| Supplied body-fall recording | `body-fall.m4a`; the design note identifies an owner-supplied `wet_thud.webm`; Joe confirms commercial/public-use authorization | Cleared by owner confirmation (2026-08-06) |
| Bert supplied recording | `dialogue2.m4a` and derivative `bert-voice-dialogue2.m4a`; source comments call it supplied; Joe confirms commercial/public-use authorization | Cleared by owner confirmation (2026-08-06) |
| Other supplied/recorded cues | `awakening-angels.m4a`, `awakening-harps.m4a`, `flame-loop.m4a`, celebration/farewell music, and any M4A not reproducible from the checked-in synthesis scripts; Joe confirms commercial/public-use authorization | Cleared by owner confirmation (2026-08-06) |
| Season-boundary arcade theme | `assets/audio/music/awards-theme.m4a`, a 16-bar loop cut from the owner-supplied `8-bit-arcade-mode-158814.webm`; Joe confirmed the source is free for commercial use | Cleared by owner confirmation (2026-08-09); retain the source/license evidence outside the repository |
| Rival-introduction hip-hop theme | `assets/audio/music/rival-intro-theme.m4a`, a 37.16-second loop cut from the owner-supplied `Hip_Hop__BPM155.webm` | Cleared by owner confirmation (2026-08-08) |
| Rival-introduction laughs | `assets/audio/sfx/rival-laugh-*.m4a`, one normalized derivative of each of the five owner-supplied laugh WAV files | Cleared by owner confirmation (2026-08-08) |
| Cues added after the 2026-08-09 review | `speech-gospel.m4a`, `speech-thunder.m4a`, `awards-celebration.m4a`, `ball-flight-whoosh.m4a`, `coach-voice.m4a`, `fireworks.m4a`, `drill-complete-heavy.wav`, `facility-start-work.wav`, `goal-net-hit.wav`, `midseason-footsteps-loop.wav`, `shot-scorch.wav`, and the re-cut `negative.m4a`. All twelve ship in the Release binary and **none is reproducible from the checked-in synthesis scripts** — they appear only in `scripts/audio/levels.json`, so they are supplied recordings despite five carrying a `.wav` extension | Cleared by owner confirmation (2026-08-17) |

## Third-party software asset

| Asset | License evidence | Status |
|---|---|---|
| Silkscreen font | `node_modules/@expo-google-fonts/silkscreen/LICENSE_FONT`: Copyright 2001 The Silkscreen Project Authors; SIL Open Font License 1.1. Package wrapper is MIT. Commercial embedding is permitted when the copyright and license travel with each copy. | License compatible; retain the notice and verify it is present in the final distribution/support materials |
| HFM Silkscreen (shipped face) | Derivative of the above: `assets/fonts/HFMSilkscreen_{400Regular,700Bold}.ttf`, built by `npm run build:fonts`. OFL 1.1 permits modification and renaming — the copyright line declares **no Reserved Font Name**. `assets/fonts/OFL.txt` ships beside the TTFs, name IDs 13/14 carry the licence, and name ID 0 retains the original copyright plus the derivation notice. | License compatible; `assets/fonts/OFL.txt` must be present in the archive alongside the TTFs |

## Inventory performed 2026-08-17

Run against the built Release app, not the source tree.

- **90 audio files** ship, matching `npm run audio:levels:check`.
- **7 images** ship; the rest of the art is drawn programmatically, as recorded
  above.
- **Fonts:** `HFMSilkscreen_400Regular.ttf`, `HFMSilkscreen_700Bold.ttf`, and
  `OFL.txt` beside them — so the OFL notice obligation is met **in the binary**,
  not merely in the repository.

Twelve supplied cues had entered the build since the previous review and were
cleared on 2026-08-17. Repeat this check after content freeze:

```
# assets added or changed since the ledger was last reviewed
git log --since=<last-review-date> --name-status --diff-filter=AM \
  --pretty=format: -- assets/ | sort -u

# is a given cue synthesized, or supplied?
grep -rls "<basename>" scripts/audio/
```

A synthesized cue appears in a **generator** (`gen-sfx.mjs`, `gen-music.mjs`,
`gen-menu-music.mjs`, `catalog.mjs`). A hit in `levels.json` alone proves
nothing — that file lists every asset, generated or supplied. Validate the check
against a known-generated cue such as `crowd-jeer` or `kick-pass` before
trusting a negative result. **Do not read `.wav` as "procedural"**: five of the
twelve supplied cues carry that extension.

## Before final archive

1. Re-run the shipped-asset inventory against the Release archive so unused
   source files are not mistaken for shipped content and newly added assets do
   not bypass this ledger.
2. Retain Joe's owner confirmation and any private underlying receipts,
   licenses, or source evidence outside the repository.
3. Keep the Silkscreen copyright and OFL 1.1 notice with the distributed app or
   its user-visible legal notices.
4. Joe gives the final content-rights answer in App Store Connect; an agent must
   not answer it from inference alone.
