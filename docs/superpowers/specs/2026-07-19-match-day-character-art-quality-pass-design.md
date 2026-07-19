# Match-day character art quality pass — design

**Date:** 2026-07-19
**Status:** approved direction, spec under review
**Owner:** rendering / art

## Problem

The in-game match sprites don't match the intended "heroic chibi" look. Concretely
(see [docs/11-art-style.md](../../11-art-style.md)):

- Feet are a flat 2-pixel `OO` block — no foot sticks forward, so legs read as straight
  stumps.
- At **16×20** the head is only ~8px, so there is no room for the art bible's
  **Rule 1 caricature** ("find the defining feature, blow it up"). Every player reads
  as the same generic body with a recolored hair block.
- Overall the sprites look flat and low-detail next to the reference art.

The sprites are **data**, not image files: each is a text pixel-map in
[src/render/sprites/sprites.json](../../../src/render/sprites/sprites.json), painted to a
Skia atlas by [buildAtlas.ts](../../../src/render/sprites/buildAtlas.ts). So the whole cast
can be regenerated in code — no hand-drawing required. (Plain-language: the players are
described as a grid of letters that map to colors, so we rewrite the description, not
redraw pictures by hand.)

## Goal

Redraw every match-day player at **24×30 "heroic chibi"** — bigger head, proper feet,
one pronounced feature per player — while keeping:

- the **same on-screen footprint** (crisper/more detailed, not bigger — so 22 players
  still fit without crowding), and
- the **exact data + sim contract** (same sprite keys, same frames; render-only change).

**Out of scope:** the menu/roster **portraits** (24×29 head-and-shoulders with expression
swaps) are a separate future system — [HirePitchScreen.tsx](../../../src/ui/screens/HirePitchScreen.tsx)
already carries a `TODO(art)` for those. This pass is match-day full-body sprites only.

## Non-goals / constraints

- **No `ENGINE_VERSION` bump.** Sprites are pure rendering; they never feed the sim. Match
  results and golden replays stay byte-identical. (Plain-language: players look different,
  games play out exactly the same.)
- **≤24-color palette.** Enforced by `sprites.test.ts` ("palette stays within the 24-color
  budget"). This is the tightest constraint (see Palette below).
- **Ball unchanged** — stays a 6×6 sprite; only player cells grow.
- Follow the CLAUDE.md rule: new content ships as **data**, headless-testable.

## Art recipe (per docs/11 Track B)

- **24×30 cell**, big-head chibi: head ≈ 45% of height. That head share is what makes a
  single feature legible.
- **Soft colored outline** (a dark tint of the fill, never `#000000`), **4-value ramp**
  shading, light from **upper-left**, chunky silhouette.
- **Feet fixed:** a real boot with a **forward toe** + a **ground-contact shadow** (a
  squashed low-opacity ink ellipse). Replaces the flat `OO`.
- **One pronounced feature per player**, expressed at **silhouette level** (hair shape,
  jaw, headband, build) so it reads at ~30px *while moving*. Fine facial caricature is
  deferred to the future portraits.
- **2-frame run cycle** for all 22 (leg/foot swap). Keepers keep **2 crouch poses**
  (`ready0`/`ready1`). Same 49 sprite keys as today.

## Identities to preserve

The 22 slots are a **designed cast** (roster in [src/sim/teams.ts](../../../src/sim/teams.ts)),
not generic. ★ = locked by an existing test in
[sprites.test.ts](../../../src/render/sprites/__tests__/sprites.test.ts).

| Slot | Name | Pos | Signature feature (silhouette) |
|---|---|---|---|
| r0 | Sam Mitts | GK | ★ GK kit (teal) + gloves; 2 crouch poses |
| r1 | Ed Stone | DEF | Blocky flat-top hair, stocky |
| r2 | Bo Hedges | DEF | Big bushy curls |
| r3 | Max Tanko | DEF | Shaved head + heavy brow |
| r4 | Ty Brooks | DEF | Neat side-swept fringe (young) |
| r5 | Gio Marsh | MID | Headband |
| r6 | Ken Ash | MID | Silver/grey hair |
| r7 | Leo Quick | MID | Short spiky hair, grin |
| r8 | Ravi Chan | MID | Ponytail / man-bun |
| r9 | **Dario Flint** | FWD | ★ **Fire-orange `#ff6a00` spiky hair** (FIRE_TORCH) |
| r10 | Zip Vela | FWD | Slim/aerodynamic build, swept-back hair (SUPER_SPEED) |
| u0 | Vic Palm | GK | ★ GK kit (amber) + gloves; 2 crouch poses |
| u1 | Ali Frost | DEF | Pale/blond frosty tips — ★ **narrower shoulders than u3** |
| u2 | Jon Crag | DEF | Full beard, rugged |
| u3 | **Rex Bould** | DEF | ★ **Muscular, wide shoulders** + big jaw (SUPER_STRENGTH) |
| u4 | Nik Vale | DEF | Thin moustache |
| u5 | Oz Reeds | MID | Tall/reedy build, tuft |
| u6 | Cal Dunn | MID | Round face, rosy cheeks |
| u7 | Ian Slate | MID | Slate-grey crop, narrow eyes |
| u8 | Uri Kemp | MID | Undercut / fade |
| u9 | Abe Torro | FWD | Bull-ish: thick neck + horn tufts, strong jaw |
| u10 | Moe Lyle | FWD | Mohawk |

Skin tones are distributed across the 22 for a diverse squad (extend the Skin ramp darker
per docs/11). The table is the **feature contract**; exact pixels are authored during build
and reviewed on the contact sheet.

## Palette (proposed, ≤24)

Home hues kept as approved: Rovers red base `#e8433f`, United blue base `#3f6fd8`; shadow/
light steps built around them. Final hexes tuned during build; count must stay ≤24.

| Group | Chars | Notes |
|---|---|---|
| Transparent | `.` | 1 |
| Ink / outline | `K` `#241f2e` | all outlines, eye pupils, boot outline |
| Skin ramp | `d` `#8a4f38` · `n` `#cf9268` · `S` `#eab48c` · `L` `#f7d7ba` | deep→light gives squad diversity |
| Hair (brown) | `h` `#6a4326` · `H` `#8a5a30` · `J` `#a9743d` | `h` doubles as skin outline |
| Hair (grey) | `g` `#7d7887` · `G` `#b9b4c2` | Ash, Slate, veterans |
| Fire | `F` `#ff6a00` | Flint; gradient reuses red `r`/`R` |
| Red kit | `o` `#7a2731` · `r` `#c22f2c` · `R` `#e8433f` · `E` `#f2938c` | Rovers |
| Blue kit | `q` `#2a4f9e` · `b` `#2f55b8` · `B` `#3f6fd8` · `C` `#a3c8f0` | United |
| White (shorts/socks/eyes/gloves/boots) | `w` `#d9d5cf` · `W` `#ffffff` | boots are white/cream + ink outline |
| GK kits | `T` `#1d9e75` (teal) · `A` `#ba7517` (amber) | base-only; ink for shading — saves budget |

Total: **24.** GK kits are base-only (shaded with ink) specifically to stay in budget; if a
kit needs a second tone we drop grey-hair to a single color to compensate.

## Code touch-points (small, contained)

1. **[sprites.json](../../../src/render/sprites/sprites.json)** — `cell` 16×20 → **24×30**;
   palette per table above; all 49 sprite maps regenerated (ball stays 6×6).
2. **[MatchScreen.tsx](../../../src/render/MatchScreen.tsx)** —
   `PLAYER_DRAW_SCALE` 26 → **17** (26 × 20/30 ≈ 17 keeps the footprint);
   `PLAYER_CELL_W` 16 → **24**; `FALLBACK_SPRITE` 16 → **24**.
3. **[StressScreen.tsx](../../../src/render/StressScreen.tsx)** — `FALLBACK_SPRITE` 16 → **24**.
4. **[sprites.test.ts](../../../src/render/sprites/__tests__/sprites.test.ts)** — update the
   two **layout-coupled** star tests (the `SHOULDER_ROW` index and the row-map comment) to
   the new 24×30 layout. The width test reads `sheet.cell` so it adapts automatically; the
   49-key, palette-budget, GK-distinct-poses, and Flint-fire tests stay as-is (Flint test is
   layout-agnostic).

No changes needed in [loader.ts](../../../src/render/sprites/loader.ts) (reads `cell` from
the JSON) or [worklet-atlas-frame.ts](../../../src/render/worklet-atlas-frame.ts) (sprite
size flows in from `atlas.rectFor`). No golden-replay/balance-harness impact.

## Build approach (de-risking the art)

1. Write a small **compose helper** (Node, in the sprite tooling / scratchpad): shared body
   + leg-frame templates, with swappable head/feature blocks and per-slot recolor. Reduces
   hand-pixel errors and keeps the 22 consistent.
2. Render a **contact sheet of all 22 (both teams) + keepers + run frames** as a PNG.
3. **Review gate:** user approves the contact sheet before anything is wired in.
4. Emit the approved maps into `sprites.json`; apply the constant + test changes.

## Testing & verification

- **Unit:** `npm test` green — `sprites.test.ts` (updated), loader/atlas tests, and the sim
  golden-replay/teams tests unchanged (proves render-only).
- **Type/lint:** `npm run typecheck` + lint clean.
- **Visual:** run the web preview, watch a match, screenshot 22 players on the pitch;
  confirm feet read, silhouettes are distinct, Flint/Bould/Vela/keepers are recognizable,
  and there's no new overlap/crowding at the same footprint.

## Risks

- **Palette budget (24)** is the main pinch — mitigated by sharing ink for outlines/boots
  and base-only GK kits.
- **Authoring volume** (22 × 2 frames + keepers) is the bulk of the work — mitigated by the
  compose helper + contact-sheet review before integration.
- **Layout-coupled tests** must be updated in lockstep with the new row map, or they fail
  meaningfully (they're guarding real identities, so that's a feature).
