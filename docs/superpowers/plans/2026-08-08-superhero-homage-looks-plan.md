# Implementation plan — 15 superhero-homage player looks

Date: 2026-08-08
Spec: `2026-08-08-superhero-homage-looks-spec.md`

Nine steps, in dependency order. Every step ends in a runnable check; nothing is
"probably fine". Steps 1–3 are pure generator work and can be verified by running the
generators alone, before a single test is touched.

---

## Step 1 — Hero geometry in `scripts/player-art-roster.mjs`

Four edits, all additive. No existing look changes shape, because every branch is gated on
a value only the new looks use.

1. **`SKIN`** — add `gamma: { sh: 'b', base: 'T', hi: 'C' }`.
2. **`face()`** — add to the shape ladder, before the final fallback:
   `shape === 'hero' ? { left: 5, right: 18, top: 4, bottom: 15 }`.
3. **`fieldBody()`** — `if (build === 'hero') { left = 5; right = 18; }`, and change the
   deltoid-cap condition from `build === 'muscular'` to
   `build === 'muscular' || build === 'hero'`.
4. **`legs(g, frame, sk, build)`** — `const [left, right] = build === 'hero' ? [8, 14] : [9, 13];`.
   `fieldBody` passes its build through; `goalkeeperBody` does not, so the default keeps
   today's columns and no goalkeeper sprite moves by a pixel.
5. **`portraitBust(g, role, kitAccent, build)`** — for `hero`, widen the two collar rows
   to `rect(g, 7, 16, 16, 16)` and `rect(g, 4, 17, 19, 17)` before the existing rows 18+
   run unchanged. `makePortrait` passes `look.build`.
6. **`heroCap(g, hs, top = 2)`** helper — the hero-width equivalent of `cap()`, spanning
   x 5–18 instead of 6–17, so hero hairlines meet the wider head. `cap()` itself is not
   touched.

**Check:** `node scripts/generate-sprites.mjs && node scripts/generate-portraits.mjs`
still succeed and `git diff --stat` on the two JSON sheets shows **zero** changes. If any
existing sprite moved, a gate leaked — fix before continuing.

## Step 2 — The 15 feature cases

Add 15 `hero-*` branches to `feature()`. House rules each one obeys:

- One silhouette move. The look is recognisable from its outline alone.
- Nothing paints outside columns 1–22 or rows 0–29.
- **Eyes and mouth stay on the absolute rows `face()` already uses** (eyes 8–9, mouth 12),
  per spec §4.1. Open-face heroes draw no face at all in their feature case; mask heroes
  paint their own eyes over rows 7–10 and end the mask at **row 11 at the lowest**, so the
  stock mouth on row 12 and the bare jaw on 13–15 both survive.
- Rows 7–14 keep at least one skin pixel (mask designs expose the jaw), so
  `separateHairFromSkin` runs — except `hero-gammamop`, which is the documented §5.3a
  exception and must instead put `hs.l` pixels inside rows 7–9.
- Upper-left highlight, single shadow, flat colour. No gradients.

| Feature | Construction |
| --- | --- |
| `hero-cowl` | `K` mass x 5–18 rows 3–10 plus `K` side panels at x 4/19; two `K` ear points at x 6–7 and 16–17 rows 1–3; `W` eye slits rows 8–9 with `K` inner corners; `g` top-left sheen; jaw rows 11–15 left bare |
| `hero-spitcurl` | `heroCap` in `dark`; forehead curl at x 9–12, **rows 6–7 only** — an open-face hero paints no face, and row 8 is a stock eye row |
| `hero-tiara` | `heroCap` plus long hair panels x 4–6 / 17–19 rows 6–16; gold `A` band row 5; `R` centre stone at x 11–12 |
| `hero-boltcrown` | Red `r` hood rows 2–7 with `R` crest row 2; gold `A` wings at x 2–4 and 19–21 rows 5–7 |
| `hero-webmask` | Red `R` mask x 5–18 **rows 2–11**, `r` shadow down the right edge; `W` teardrop eyes rows 6–9 outlined in `K`; `K` web centre line and brow arc. Bottom is row 11, not 12: the stock mouth at row 12 and the bare jaw at 13–15 both have to survive |
| `hero-faceplate` | Gold `A` plate rows 3–11 with `W` upper-left highlight; `C` eye slit row 8; jaw rows 12–15 bare |
| `hero-winghelm` | Blue `b` helm rows 2–7; `W` wing flashes x 4–6 / 17–19 rows 5–6; chinstrap columns x 5 and 18 rows 8–13 |
| `hero-thundermane` | Blond `heroCap` plus mane panels x 4–6 / 17–19 rows 6–16; `G` silver brow band row 6; short beard **rows 13–15 only**, clearing the stock mouth at row 12 |
| `hero-gammamop` | Heavy `black` mop rows 1–7 with strands reaching rows 8–9 drawn in `hs.l`; low brow row 7 in `hs.d` |
| `hero-clawpeaks` | Two hair peaks at x 6–8 and 15–17 rows 0–4; muttonchops x 5–6 / 17–18 rows 8–13 |
| `hero-visor` | Side-part hair rows 2–6; `r` visor band x 5–18 rows 8–9 with an `R` slit and `o` underline |
| `hero-sorcerer` | Dark `heroCap`; `G` temple flashes x 5–6 / 17–18 rows 6–8; thin moustache row 11; goatee rows 13–15 |
| `hero-pantherhood` | `K` hood x 5–18 rows 2–11 with `K` short ears x 6–8 / 15–17 rows 1–2; `g` sheen row 3; `G` eye rings rows 7–10 with `K` eye holes; jaw rows 12–15 bare |
| `hero-tidemane` | Blond long hair panels x 4–6 / 17–19 rows 3–16; full beard x 6–17 rows 11–15 with the mouth punched back through |
| `hero-greenhood` | `T` hood framing x 4–6 / 17–19 rows 1–13 with a `b` shadow edge and a brow arch row 4; blond goatee rows 13–15 |

**Check:** both generators run clean. This is where a stray palette token or an off-cell
pixel throws. The pool is still 168 at this point — the feature cases exist but nothing
references them until Step 3, so *no* count has moved yet and claiming otherwise would be
checking a number that cannot be true.

## Step 3 — The 15 look records and their identities

Append `SUPERHERO_HOMAGE_FIELD_LOOKS` to `player-art-roster.mjs` above the
`FIELD_PLAYER_LOOKS` export, carrying the same development-reference-only comment the
football homages use. Every record sets **both** `build: 'hero'` and `shape: 'hero'`.

| ID | Name | Feature | Skin | Hair | Face | Eyes / mouth |
| --- | --- | --- | --- | --- | --- | --- |
| f168 | Bruce Wain | `hero-cowl` | fair | dark | 4 | mouth `grit` |
| f169 | Clark Kentley | `hero-spitcurl` | fair | dark | 1 | mouth `toothsmile` |
| f170 | Dinah Prince | `hero-tiara` | brown | black | 3 | — |
| f171 | Barry Allan | `hero-boltcrown` | warm | dark | 0 | mouth `toothsmile` |
| f172 | Pete Parkin | `hero-webmask` | warm | black | 0 | mouth `smile` |
| f173 | Toni Starke | `hero-faceplate` | brown | platinum | 4 | — |
| f174 | Steve Rodgers | `hero-winghelm` | fair | blond | 1 | mouth `grit` |
| f175 | Don Blaker | `hero-thundermane` | fair | blond | 4 | mouth `toothsmile` |
| f176 | Bruno Bannor | `hero-gammamop` | gamma | black | 1 | eyes `beady`, mouth `grit` |
| f177 | James Howlitt | `hero-clawpeaks` | warm | black | 1 | mouth `grit` |
| f178 | Scott Somers | `hero-visor` | brown | brown | 2 | — |
| f179 | Stefan Strangeway | `hero-sorcerer` | fair | grey | 4 | — |
| f180 | Tchalo Adaku | `hero-pantherhood` | deep | black | 3 | — |
| f181 | Arthur Currey | `hero-tidemane` | warm | blond | 4 | eyes `narrow` |
| f182 | Oliver Quinn | `hero-greenhood` | fair | blond | 2 | mouth `smile` |

Export `SUPERHERO_HOMAGE_IDENTITIES` — `{ id, name, reference, power, cue }` — from the
same module, and thread it into `PLAYER_LOOK_MANIFEST` as `heroes` so the names ship as
data rather than living only in a preview script.

Face-variant choice is not decoration: `validateSprites` rejects two career looks sharing
`role|feature|face|build|eyes|mouth`, and every resting portrait must be pixel-unique.
Distinct features already guarantee both, but the face indices above also keep the
expressions varied.

`platinum` (f173) and `grey` (f179) are both existing `HAIR` entries — confirmed present
before use, not assumed. The `power`, `cue`, and `reference` values are copied verbatim
from the spec §5.2 table rather than improvised at the keyboard.

**Check:** run **both** generators, in this order —
`node scripts/generate-sprites.mjs && node scripts/generate-portraits.mjs`. Portraits alone
would leave `sprites.json` without f168–f182, and every count test in Steps 4 and 5 reads
that file. Observed output: `generate-sprites.mjs` prints **1893 base sprites for 448
unique player looks** and `generate-portraits.mjs` prints **1344 portraits for 448 unique
player looks**, with no throw from the structural-uniqueness or unique-resting-portrait
guards.

**These are not the same metric as Step 4's `BASE_KEYS = 1865`, and the two must not be
reconciled with each other.** The generator counts what it authors — both kits × 183 field
× 2 run frames, + both kits × 25 goalkeepers × 4 poses, + both kits × 240 created looks
× 2 frames, + the ball = 1893. `sprites.test.ts` counts what the *loader* exposes for
roster identities — both kits × 208 roster looks × 4 frames (run0/run1 plus the derived
back0/back1), + both kits × 25 × 4 ready poses, + the ball = 1865 — which excludes the
created paper-doll pool and includes derived rear views the generator never writes. Both
numbers are correct; they measure different sets.

## Step 4 — Pool size and the six count literals

- `src/game/player-appearance.ts`: `FIELD_PLAYER_LOOK_COUNT` 168 → 183.
- `portraits.test.ts`: 168 → 183, 433 → 448, 1299 → 1344, and the `it(…)` title 193 → 208.
- `sprites.test.ts`: `BASE_KEYS` 1745 → 1865, `SLIDE_KEYS` 3860 → 4160.

Derivations are in spec §5.4. Recompute each rather than trusting the table — if a
computed number disagrees with the table, the table is wrong and the spec gets corrected.

**Check:** `npx jest src/render/sprites` passes.

## Step 5 — New tests

Add `src/render/sprites/__tests__/hero-build.test.ts`, driven off the shipped JSON so it
tests what actually ships:

1. **Exactly 15 hero looks, f168–f182**, and their IDs match `PLAYER_LOOK_MANIFEST.heroes`.
2. **Bounds.** For every `r:`/`u:` hero run/ready frame, columns 0 and 23 are empty —
   the outline pass always has room. Guards the cowl ears and the boltcrown wings.
3. **Bigger than muscular**, measured rather than asserted from memory. Row 18 is the
   discriminator because it is the one torso row whose width is constant within a build:
   measured across all 168 shipped looks it is slim 12, normal 14, muscular 18. Hero
   geometry puts it at 20 (`x 2–21` after the outline pass). The test asserts every hero
   run0 frame is exactly 20 at row 18 and every non-hero is at most 18 — a strict
   separation, and the numeric form of "1.15× larger" (20/18 = 1.11 against the broadest
   existing build, 20/14 = 1.43 against the common one).
   If the generated value is not 20, the geometry is wrong — fix the geometry, not the
   number.
4. **Distinct silhouettes.** The 15 hero resting portraits produce 15 distinct
   painted-mask strings, so no two heroes read the same at a glance.
5. **`shape: 'hero'` and `build: 'hero'` travel together.** Read the roster module
   directly: exactly 15 records carry `build: 'hero'`, they are f168–f182, and every one of
   them also carries `shape: 'hero'`. Spec §6.4, and the single easiest field to omit.
6. **Green-skin contract.** `f176`'s face rows 7–14 contain `T`, contain at least one of
   `h`/`H`/`J`, and contain none of `x`/`y`/`z` — the §5.3a invariant, pinned so a later
   edit to the mop cannot silently break `hair-skin-separation.test.ts`.

**Check:** `npx jest src/render/sprites` passes, including the pre-existing
`hair-skin-separation`, `slide-tackle`, `foot-direction`, and `facing` suites.

## Step 6 — Preview sheet

Extend `scripts/generate-roster-preview.mjs` with a third
`writeFootballReferencePreview`-style call: `art/superhero-homage-preview.svg`, 5 columns,
each card showing rest portrait, joy portrait, home-kit match sprite, the fictional name,
the ID, and the cue. Drive the look list from the exported
`SUPERHERO_HOMAGE_IDENTITIES` rather than retyping it, so the sheet cannot drift from the
roster.

**Check:** the SVG is written, and rasterising it produces a readable contact sheet in
which all 15 are mutually distinguishable at a glance. This is a look-at-it check; if two
heroes read the same, redraw before continuing.

## Step 7 — Full verification

```
npx tsc --noEmit
npx jest
```

Both clean. `career-look-diversity.test.ts` is the one to watch: growing the pool changes
which generated player draws which face. It asserts distinctness and counts rather than
specific IDs, so it is expected to pass — but if it fails, that is a real signal about the
allocator, not a number to edit.

Confirm no golden replay moved and `ENGINE_VERSION` is untouched: this change reaches no
file under `src/sim/`.

**Launch faces, explicitly.** Spec §5.4 claims the 160 launch-club players keep their
faces because `launchLookAssignments` walks the pool from index 0. Verify it instead of
believing it: `git diff src/render/sprites/player-look-manifest.json` must show exactly three things and
nothing else: every pre-existing `legacy` mapping byte-identical, `field` gaining only
f168–f182 at the end, and the new `heroes` key. A changed `legacy` entry means the append
was not an append.

## Step 8 — Docs

Note the addition in `README.md`'s decision log alongside the football-homage entry, in
one line. No design doc changes: no locked decision moves.

## Step 9 — Commit and push

One commit on the current branch, message in the repo's existing style, then push. Per
`CLAUDE.md` the worktree shares a tree with other sessions, so `git status` is checked for
foreign changes before staging and only the files this plan names are added.

---

## Rollback

Every step is additive. Reverting the single commit restores the 168-look pool exactly,
because launch-club assignments are index-based from position 0 and no existing look
record, feature case, or shared drawing default is modified.

## What this plan does not do

- Bind the 15 names to players that actually spawn in a career. The names ship as data;
  the marquee-player feature that consumes them is separate work.
- Reserve hero looks for awakened players.
- Touch the sim, balance, or `ENGINE_VERSION`.

---

## What actually happened

Six things the plan did not predict. All were caught by a check, not by luck.

1. **The wider hero stance was reverted.** `legs()` was to move to columns 8/14.
   `foot-direction.test.ts` holds all 896 looks to one shin geometry — no boot may
   overhang its own shin — and the derived slide poses and rear-view sole swap key off the
   same columns. Widening the stance failed three assertions. Heroes now keep the standard
   shins: broad shoulders over an ordinary stance is the V-taper the genre actually draws,
   and a shipped invariant stayed untouched.
2. **The `shape`/`build` pairing moved from a test into the generator.** It cannot be
   tested from the shipped sheets — a hero torso under a classic head is
   pixel-indistinguishable from a deliberate narrow-faced design, and the hero chin shares
   row 15 with `long`. `generate-sprites.mjs` now throws if a look sets one without the
   other, which is the stronger guarantee.
3. **`hero-cowl` failed the expression-distinctness guard.** A flat white pair of eye
   slits painted over rows 8–9 erased the eye expression, so `rest` and `ko` rendered
   identically. The slits are now *cut* — rows 8–9 are left open at x 7–9 and 14–16 — and
   the stock eyes read through them.
4. **Three looks failed the look-at-it check** and were redrawn: Barry Allan's hood moved
   from `R` to `o` and Pete Parkin's mask from `R` to `r`, because a red mask on the red
   home kit made both heads vanish into the torso; and Clark Kentley's spit curl was
   invisible until the hairline was lifted off the brow and his face variant changed from
   1 to 0, whose heavy brow was colliding with the curl.
5. **`portrait-blink.test.ts` needed a deliberate update** (433/408 → 448/419), which the
   plan missed. Eleven heroes blink; the four that do not are correct refusals — three
   masks put no pupil in the eye band, and the gamma head has no skin-ramp colour to close
   a lid with.
6. **Five committed preview SVGs were already stale** before this work: they still carried
   `#6a4326` where the sheet has `#241a17`, so they predate the hair/skin separation
   commit. Regenerating corrected them, and their PNG companions were re-rendered to
   match.

Verified at the end: 3742 Jest tests and `tsc --noEmit` clean; zero pre-existing sprites
or portraits changed (60 and 45 keys added, nothing modified or removed); the palette is
byte-identical; and all 182 `legacy` launch-face mappings are unchanged.
