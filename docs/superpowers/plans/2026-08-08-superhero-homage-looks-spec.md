# Spec — 15 superhero-homage player looks

Date: 2026-08-08
Status: draft, for review

## 1. What the owner asked for

> "Design 15 more football players. Make them look a little like (inspired by) famous
> superheroes that have similar powers. I want the superheroes to look 1.15x larger and
> have more muscles/bigger build. Their uniforms will always be the same, but do whatever
> you need to for their faces to be inspired by famous superheroes — whether it's glasses
> or hairstyle or mask etc., skin tone, hair length, cut etc. Design 15 of them and show
> me what they look like. Give them names that are similar but different to who they are
> inspired by; don't use their superhero names but their human names if they have them,
> otherwise make a pun or change their superhero name. Follow the design rules of the
> current live players — remember, caricatures."

## 2. Existing system this must fit

`scripts/player-art-roster.mjs` is the single source of truth for every player face. A
"look" is a data record — `{ id, role, skin, hair, feature, build, face, eyes?, mouth? }` —
that both generators consume, so a player's identity is byte-identical between the
management portrait (24×29) and the match sprite (24×30).

Established precedent for exactly this kind of addition: `FOOTBALL_HOMAGE_FIELD_LOOKS`
(f140–f167) — 28 looks that caricature real footballers by exaggerating **one**
era-defining visual cue each, with the real reference recorded only in the preview script
and the in-game identity kept fictional.

Current pools: 168 field looks (f00–f167), 25 goalkeeper looks, 240 created-player looks.
`FIELD_PLAYER_LOOK_COUNT` in `src/game/player-appearance.ts` must match the field pool
length or `portraits.test.ts` fails.

Design rules already enforced by the codebase, which this spec inherits:

- **One silhouette move per look.** A look is recognised by its outline first.
- **Caricature, not portrait.** Chibi proportions, big head, hard pixels, upper-left light.
- **Shared 24-colour palette.** No new palette keys (the budget is 26 tokens including
  transparency; 25 are used).
- **Uniform is never touched by a look.** Kit colour comes from the side (`r` home /
  `u` away) at draw time, which is why the owner's "uniforms will always be the same"
  is free.
- **Hair must not read as skin.** `separateHairFromSkin` moves every head off the shared
  browns onto the near-black ramp `x/y/z`. It bails out when rows 7–14 contain no skin
  key at all, and the retired browns `H`/`J` are not in the palette — so a look whose face
  rows are entirely covered will fail sprite validation. See §5.3.

## 3. Scope

### In scope

1. 15 new field looks `f168`–`f182`, superhero-caricature heads, on a new `hero` build.
2. A new `hero` build tier and a new `hero` face shape that together deliver the
   requested ~1.15× size increase.
3. Regenerated `sprites.json`, `portraits.json`, `player-look-manifest.json`.
4. `FIELD_PLAYER_LOOK_COUNT` 168 → 183.
5. A named identity record per look (fictional in-game name, inspiration reference,
   affinity power), exported from the roster module.
6. A preview contact sheet `art/superhero-homage-preview.svg` in the same format as
   `art/football-legends-preview.svg`, rendered to PNG so the owner can see the designs.
7. Tests covering the new build, the new pool size, and the palette/cell invariants.

### Out of scope (stated, not silently dropped)

- **Binding the 15 names to actual in-game players.** Player names are random
  first+last draws from pools in `src/game/pyramid.ts` and `src/game/youth-intake.ts`;
  there is no name↔look binding for any player today (the 28 football homages have none
  either). Making these 15 marquee named characters that spawn in the world is a separate
  gameplay feature. The names ship as data on the look records so that feature can consume
  them later without redesign.
- **Reserving hero looks for awakened players.** Tempting, but an awakened player
  changing face mid-career is jarring and would contradict the persisted-identity rule in
  `assignDistinctPlayerLooks`. These 15 join the general career pool exactly as the
  football homages did.
- Any change to the match engine, `ENGINE_VERSION`, or balance. Looks are cosmetic; no
  replay-affecting code is touched.

## 4. The "1.15× larger" decision

The atlas cell is a fixed 24×30. Three ways to make a player bigger were considered:

| Option | Verdict |
| --- | --- |
| Fractional render scale (`scale * 1.15`) | **Rejected.** `PIXEL_ART_SAMPLING` is nearest-neighbour, so a 1.15× upscale maps source columns to alternating 3px/4px runs. The 1px black outline would visibly wobble. `PlayerRunSprite` already documents "fractional values blur the art". |
| A larger dedicated hero cell (28×35) | **Rejected.** The loader does support per-sprite cells (`BALL_SIZE`, `SLIDE_TACKLE_CELL`), so it is possible — but every coordinate in `face()`, `feature()`, `fieldBody()` and `legs()` is hardcoded to the 24-wide grid. Redrawing 60+ feature cases at a second resolution is disproportionate, and rescaling the 24×30 art into 28×35 reintroduces the same uneven-pixel problem. |
| **Draw the hero larger inside the existing cell** | **Chosen.** The current figure does not fill the cell: `muscular` spans x 4–19 with 4 spare columns, and the classic face box is 12×9 in a cell that comfortably holds 14×12. Growing into that margin is a genuine size increase, pixel-perfect, and touches no renderer, no atlas, and no test that asserts cell geometry. |

Concretely, relative to a `normal` build:

- **Torso** x 7–16 (10 wide) → x 5–18 (14 wide).
- **Arms** x 6/17 → x 3/20, with deltoid caps at x 2/21. Outline still lands at x 1/22,
  inside the cell.
- **Head** classic box `{left 6, right 17, top 5, bottom 13}` (12×9) → hero box
  `{left 5, right 18, top 4, bottom 15}` (14×12). Same centre line (x 11.5).
- **Legs** unchanged at columns 9/13. A wider stance was specified and then reverted:
  `foot-direction.test.ts` holds every look on the sheet to one shin geometry, and the
  derived slide poses and rear-view sole swap key off the same columns. Broad shoulders
  over an ordinary stance is the V-taper the genre draws anyway.

Head 14×12 vs 12×9 and torso 14 vs 10 is ~1.17× across the silhouette — the owner's
1.15× to within one pixel, which is the finest granularity this art style has.

### 4.1 Where the eyes and mouth sit

`face()` paints eyes at absolute rows 8–9 and the mouth at absolute row 12, regardless of
the shape's bounds. The rule for hero looks is: **keep them exactly there, unchanged.**

That is not a guess. The hero box is the shipped `long` box widened by one column on each
side — `long` is already `{left 6, right 17, top 4, bottom 15}`, the *same* `top` and the
*same* `bottom` as hero. Sixteen shipped looks use `long`, so the absolute eye and mouth
rows are already proven correct against a top of 4 and a bottom of 15; hero changes only
the width, and width does not move a row.

What the taller box buys is the caricature the owner asked for: three rows of jaw below
the mouth instead of one, which reads as a heavy heroic chin, and one extra row of
forehead. Both are on-model for the genre.

Consequences worth stating so nobody re-derives them:

- **Open-face heroes** (Kentley, Bannor, Howlitt, Strangeway, Currey, Quinn, Rodgers,
  Blaker, Allan, Prince) use the stock eyes and mouth at rows 8–9 and 12. No feature needs
  to draw a face.
- **Mask heroes** (Wain, Parkin, Starke, Adaku, Somers) paint their own eyes over rows
  7–10 in the feature case, deliberately covering the stock eyes. Their masks stop at or
  above row 12 so the stock mouth and the exposed jaw still read — which is also what
  keeps `separateHairFromSkin` running (§5.3).
- No hero look needs a vertical offset parameter, and none is added. If a future hero
  design does, that is a new shape, not a tweak to this one.

## 5. Implementation surface

### 5.1 `scripts/player-art-roster.mjs`

- `face()`: add a `hero` branch to the shape switch with bounds
  `{ left: 5, right: 18, top: 4, bottom: 15 }`.
- **Every hero look record carries `shape: 'hero'` explicitly.** `face()` reads
  `appearance.shape ?? variant.shape`, and `appearance` is the look object — a look that
  only sets `build: 'hero'` would still draw a classic-sized head on a hero torso. This is
  the one field it is easiest to forget and the acceptance test in §6.4 asserts it.
- `fieldBody()`: add `build === 'hero'` → `left = 5; right = 18;`, and extend the
  existing deltoid-cap branch to fire for `muscular` **or** `hero`.
- `legs()`: take the build and use columns `[8, 14]` for `hero`, `[9, 13]` otherwise.
  The goalkeeper caller keeps today's behaviour by default.
- `portraitBust()`: take the build. A hero jaw spans x 5–18 at row 15, and today's collar
  is x 9–14 at row 16 — a pinhead-on-pinneck read. The hero bust widens the collar to
  x 7–16 at row 16 and x 4–19 at row 17, leaving rows 18+ unchanged so the shoulders still
  land where every other portrait's do.
- Add `SUPERHERO_HOMAGE_FIELD_LOOKS` (f168–f182) and append to `FIELD_PLAYER_LOOKS`.
- Add 15 `hero-*` cases to `feature()`.
- Export `SUPERHERO_HOMAGE_IDENTITIES` — `{ id, name, reference, power, cue }` per look.

### 5.2 The 15 designs

Every uniform is the club kit. Every look is identified by its head alone, one move each.
Reference names are development references only, per the existing homage comment; the
in-game names are fictional and deliberately near-miss.

Feature IDs are named here, not left to the implementer, so the roster records, the
manifest, the preview sheet, and the tests cannot drift apart.

| ID | In-game name | Reference (dev only) | `feature` | One silhouette move | `skin` | Affinity power |
| --- | --- | --- | --- | --- | --- | --- |
| f168 | Bruce Wain | Batman / Bruce Wayne | `hero-cowl` | Ink cowl with two ear points, white eye slits, bare scowling jaw | fair | SHADOW_MARK |
| f169 | Clark Kentley | Superman / Clark Kent | `hero-spitcurl` | Blue-black sweep with a single spit curl on the forehead | fair | FIRE_TORCH |
| f170 | Dinah Prince | Wonder Woman / Diana Prince | `hero-tiara` | Gold tiara band with a red centre stone over long black hair | brown | GRAVITY_WELL |
| f171 | Barry Allan | The Flash / Barry Allen | `hero-boltcrown` | Red hood with gold lightning wings at both temples | warm | SUPER_SPEED |
| f172 | Pete Parkin | Spider-Man / Peter Parker | `hero-webmask` | Red mask, big white teardrop eyes, ink web lines, bare jaw | warm | WEB_TRAP |
| f173 | Toni Starke | Iron Man / Tony Stark | `hero-faceplate` | Gold faceplate with a pale blue eye slit, exposed jaw | brown | BLINK_RUN |
| f174 | Steve Rodgers | Captain America / Steve Rogers | `hero-winghelm` | Blue helm with white wing flashes and a chinstrap | fair | RALLY_CRY |
| f175 | Don Blaker | Thor / Donald Blake | `hero-thundermane` | Long blond mane, short beard, silver winged brow band | fair | THUNDER_STRIKE |
| f176 | Bruno Bannor | Hulk / Bruce Banner | `hero-gammamop` | Green skin and a heavy black mop with a low brow | gamma | SUPER_STRENGTH |
| f177 | James Howlitt | Wolverine / James Howlett | `hero-clawpeaks` | Twin black hair peaks and thick muttonchops | warm | PHASE_RUN |
| f178 | Scott Somers | Cyclops / Scott Summers | `hero-visor` | Red visor band across the eyes, brown side part above | brown | THUNDER_STRIKE |
| f179 | Stefan Strangeway | Doctor Strange / Stephen Strange | `hero-sorcerer` | Grey temple flashes, thin moustache and goatee | fair | PORTAL_PASS |
| f180 | Tchalo Adaku | Black Panther / T'Challa | `hero-pantherhood` | Ink mask with silver eye rings and short cat ears, open jaw | deep | SHADOW_MARK |
| f181 | Arthur Currey | Aquaman / Arthur Curry | `hero-tidemane` | Long blond hair and a full blond beard | warm | ICE_RINK |
| f182 | Oliver Quinn | Green Arrow / Oliver Queen | `hero-greenhood` | Deep green hood framing the face, blond goatee | fair | FUTURE_SIGHT |

Skin spread: 6 fair, 4 warm, 3 brown, 1 deep, 1 gamma-green. **`gamma` is the one and
only name for the green ramp** — the `SKIN` map key, the `skin` field on f176, the prose
in §5.3a, and every test that names it. Bruno Bannor's green uses the
existing `T` palette entry (`#1d9e75`) as a skin ramp — a new `SKIN` entry
`gamma: { sh: 'b', base: 'T', hi: 'C' }` reusing existing keys, adding no palette cost.
The green ramp carries a constraint of its own; see §5.3a.

**Legal/IP position.** These are caricature homages in the same vein as the shipped
football-legend looks: no real name is used in the game, no costume or trade dress is
copied (the uniform is always the club kit), and each design exaggerates one generic
visual cue — a cowl, a visor, a hairstyle, a beard — rather than reproducing a protected
character design. Reference names live in a development-only table with a comment saying
so, exactly as `writeFootballReferencePreview` already does.

### 5.3 Palette safety for masked looks

`separateHairFromSkin` returns early when rows 7–14 hold no skin key, leaving `H`/`J`
in place — and neither is a palette colour, so `generate-sprites.mjs` validation throws.
Four looks are mask-heavy (f168 cowl, f172 web mask, f173 faceplate, f180 panther mask).
Rule for this spec:

1. Every mask leaves the jaw or lower cheek in skin, so separation always runs.
   This is also the better caricature — the scowl or grin still reads.
2. f172's mask is the largest of the four, so it also takes `hair: 'black'`
   (`d:'K', b:'K', l:'h'`) as a belt-and-braces measure — all three of that ramp's keys
   are live palette entries, so even a drawing mistake that swallowed the jaw could not
   leave a retired `H`/`J` behind. Rule 1 still applies to it: the mask stops at row 12
   and the jaw stays bare.

`hair-skin-separation.test.ts` already guards this and will catch a violation.

### 5.3a The green-skin trap

`separateHairFromSkin` decides whether a head has skin by testing
`SKIN_KEYS = ['d','m','n','S','L']`. A green head is drawn in `T`, which is not in that
list, so **the whole look bypasses separation** — the same escape hatch `c212` uses.

Two consequences, both of which must be designed for rather than discovered:

1. **`generate-sprites.mjs` validation.** With separation skipped, `H` and `J` survive,
   and neither is a palette key, so the build throws. Bruno Bannor therefore uses
   `hair: 'black'` (`d:'K'`, `b:'K'`, `l:'h'`), whose three ramp entries are all live
   palette colours.
2. **`hair-skin-separation.test.ts` third contract.** Any look classified as "drawn in a
   hair key" must have a legacy key (`h`/`H`/`J`) present in face rows 7–14 and must have
   no `x`/`y`/`z` there. So `hero-gammamop` must deliberately place `hs.l` (= `h`)
   highlight pixels inside rows 7–9 — shaggy strands over the temples, which the design
   wants anyway. This is not incidental; it is a drawing requirement.

**Rejected fix:** adding `T` to the generator's `SKIN_KEYS`. That would make green heads
separate (`h` → `x`), but the test keeps its *own* copy of `SKIN_KEYS` without `T`, so it
would still classify Bruno as hair-key-drawn and then fail him for having `x` present.
Changing both copies widens a shared invariant for one look and risks `f33` (teal hair,
which already paints `T` into face rows 7–14). Leave the ramp alone.

**Downstream check, not assumed:** `deriveBackFacingFrame` picks the skin token by
frequency over rows 7–14 excluding `.`/`K`/`W`/`w`, so it resolves `T` and paints a green
back-of-head correctly. `slide-tackle.ts` has a hardcoded `SKIN_RAMP` of the five browns
and shades the rotated head from it; a green head is outside that ramp. The slide poses
must be inspected for Bruno specifically, and `slide-tackle.test.ts` must pass — if the
green head shades wrong, the fallback is to give Bruno the deep brown ramp and carry the
reference on hair and brow alone.

### 5.4 Counts and regeneration

- `src/game/player-appearance.ts`: `FIELD_PLAYER_LOOK_COUNT` 168 → 183.
- Regenerate: `node scripts/generate-sprites.mjs`, `node scripts/generate-portraits.mjs`,
  `node scripts/generate-roster-preview.mjs`.

Six hardcoded count literals move with the pool. Each was read out of the test files, and
each is arithmetic, not a guess:

| File | Literal | Now | Becomes | Why |
| --- | --- | --- | --- | --- |
| `portraits.test.ts` | `manifest.field` length | 168 | 183 | +15 field looks |
| `portraits.test.ts` | `IDS` length | 433 | 448 | 183 + 25 + 240 |
| `portraits.test.ts` | sprite-key count | 1299 | 1344 | 448 × 3 expressions |
| `portraits.test.ts` | `it('ships 193 roster looks…')` | 193 | 208 | 183 + 25 |
| `sprites.test.ts` | `BASE_KEYS` length | 1745 | 1865 | 2 sides × 208 × 4 frames + 2 × 25 × 4 GK ready + 1 ball |
| `sprites.test.ts` | `SLIDE_KEYS` length | 3860 | 4160 | 2 sides × 208 × 10 slide frames |

**Also verified, and unchanged:** `launchLookAssignments` walks `FIELD_PLAYER_LOOKS` from
index 0, so appending at the end leaves all 160 launch-club faces exactly as they are.
And `generate-portraits.mjs`'s `validateSprites` requires
`role|feature|face|build|eyes|mouth` to be unique across career looks — satisfied because
each hero look has its own `feature`.

**Known ripple:** `lookIndex` is `hash % poolSize`, so growing the pool 168 → 183 reshuffles
which generated player gets which face. That is cosmetic and expected — `career-look-diversity.test.ts`
asserts structural properties (distinctness, counts), not specific IDs, so it should still
pass. Launch-club assignments come from `clubs.json` via `launchLookAssignments` and are
explicit, so the 160 launch players keep their faces. This must be verified, not assumed.

### 5.5 Preview

Extend `scripts/generate-roster-preview.mjs` with a third
`writeFootballReferencePreview`-style call producing `art/superhero-homage-preview.svg`:
5 columns × 3 rows, each card showing rest portrait, joy portrait, home-kit match sprite,
the fictional name, the ID, and the silhouette cue. Rasterise to PNG for the owner.

## 6. Acceptance criteria

1. `node scripts/generate-sprites.mjs` and `generate-portraits.mjs` run clean; the field
   pool reports 183 looks.
2. Every new sprite is exactly 24×30 (portraits 24×29) and uses only palette tokens.
3. `npx tsc --noEmit` passes and the full Jest suite passes, including
   `hair-skin-separation`, `sprites`, `portraits`, and `career-look-diversity`.
4. The 15 hero looks are the only looks with `build: 'hero'`, every one of them also sets
   `shape: 'hero'`, and each has a distinct `feature`, name, and reference.
4a. No hero sprite paints outside columns 1–22 in any frame, so the outline pass always
   has a column to land in. Asserted by test, not by eye.
5. `art/superhero-homage-preview.svg` renders all 15 with readable, mutually distinct
   silhouettes at 3× — checked by eye, not just by test.
6. No change to `src/sim/`, `ENGINE_VERSION`, or any golden replay. The only `src/game/`
   edit permitted is the `FIELD_PLAYER_LOOK_COUNT` constant in `player-appearance.ts`
   (§5.4) — no game logic, no types, no balance.

## 7. Risks

- **Hero heads are wider (x 4–19 with ears).** Features that already reach x 3–4 (`afro`,
  `puffs`) are not reused by hero looks, but new hero features must be checked against the
  cell edge; the outline pass adds one more column. Mitigation: an explicit test that no
  hero sprite paints in column 0 or 23 outside the outline.
- **A 14-wide torso may crowd the shorts/legs junction.** Widening the leg columns was
  the intended mitigation and proved unavailable (above); the contact sheet was checked by
  eye instead, and the junction reads.
- **Pool reshuffle** (§5.4) is the one behavioural ripple. Mitigation: run the full suite
  and diff the launch assignments in `player-look-manifest.json`.
