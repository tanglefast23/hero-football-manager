# 11 — Art Style (Pixel Bible)

The look: **B+ "heroic chibi" pixel art** — bright, chunky, hand-built, a little storybook. Two rendering tracks share one palette and one pixel font so the whole game reads as one world. This doc is canon for how everything is *drawn*; UI colour-role and chrome discipline live in [08-ui-ux.md](08-ui-ux.md) (60-30-10, hero-gold reserved) and this doc defers to it for *usage*.

A rendered visual companion exists — the style-guide page with swatches, the button construction, the shading ramp, and worked examples. (Claude artifact: `claude.ai/code/artifact/6cdbc00c-02c4-4e8d-b8ac-e3df858bde25`. The hexes and rules below are the source of truth; the page shows them.)

## Two tracks, one palette, one font

- **Track A — Interactive UI** (buttons, toggles, tabs, sliders, chrome): a **chunky pixel bevel** — a *thick* outline, *rounded* chunky corners, a *bold two-tone* face (bright top, dark lip), and a **pixel-font** label. Reads fat, tactile, unmistakably pressable. Never a flat tinted rectangle.
- **Track B — World & character art** (players, people, fans **and** buildings, the clubhouse, stands, goals & nets, pitch furniture, trophies, items, icons): a **soft coloured outline** (a dark tint of the fill, never pure black), 3–4 value ramp shading, chunky readable silhouettes. Characters add caricature; objects add character of their own.
- **Never mix the recipes.** A face is not beveled like a button; a button is not shaded like a sprite; a building is drawn like a sprite, not extruded like a button.

## Master palette

Every colour comes from here. Author art as indexed PNG with the palette locked.

### Core families — UI + art

| Family | Shadow / lip | Base / face | Light / highlight | Meaning (see 08) |
|---|---|---|---|---|
| Red | `#a83440` | `#d94f52` | `#f2938c` | Cancel / destructive |
| Blue | `#3f6fb5` | `#5a8fd6` | `#a3c8f0` | Neutral action |
| Gold | `#c8862a` | `#edb54a` | `#f7d894` | **Hero / reward only** |
| Grey | `#6b6675` | `#9a95a4` | `#c9c5d0` | Disabled / structure / metal |

Shared neutrals: **Ink** `#241f2e` (outlines, text, structure) · **Cream** `#f4f1ea` · **White** `#ffffff`.

> Gold is "hero gold." Per [08](08-ui-ux.md) it only marks hero/power/reward moments — never plain settings or generic emphasis.

### Canvas & theme

- **Cream `#f4f1ea` is the primary background** — the bright, calm 60% canvas the whole game sits on (matches the reference button sheet's world). Ink `#241f2e` is text/outline/structure. Buttons and hero art are where the palette gets **loud** against that calm cream.
- A **dark theme** (deep plum-charcoal ground, cream text) is a secondary mode, not the default. Design cream-first.

### Extended world — art track only (same 4-value ramp discipline)

| Ramp | Shadow | Base | Light |
|---|---|---|---|
| Skin | `#cf9268` | `#eab48c` | `#f7d7ba` |
| Wood / leather / hair | `#6a4326` | `#8a5a30` | `#a9743d` |
| Pitch / turf | `#3f8a4a` | `#5cb85c` | `#8fd98f` |

Face extras: soft skin outline `#6a4326`, nostril/crease `#b07a52`, grey hair `#7d7887`/`#b9b4c2`. Deeper skin tones extend the Skin ramp darker (e.g. `#8a4f38`) — same discipline, more range; players are diverse. Metal/concrete/posts use the **Grey** ramp; walls use **Cream/Grey**.

**Rule:** pick a ramp, use its four steps. A shape uses one family + ink + cream + at most one neutral for a contact shadow. Extend a ramp for more range; never invent a one-off colour.

### Extended ramps — named 2026-08-08

These already ship. They were authored correctly against the discipline above but had no name, so an audit read them as one-off colours. Named here so they are usable and enforceable.

| Ramp | Values | Job |
|---|---|---|
| **Violet — power identity** | `#5b3a91` · `#9a63d6` · `#c9a6ec` | Magic/power FX and the character sprites that carry them. The one violet the 2026-07-24 retirement kept: **art track only, never UI chrome.** |
| **Pitch — dark extension** | `#26512f` · `#31703f` (below `#3f8a4a`) · `#529f5b` (between base and light) | Night turf and mow-stripe gradients. With the core three this is a 5-step ramp travelling 133°→120° — **the only ramp in the game that meets the hue-shift rule.** |
| **Ink-deep** | `#16121f` | The stage ground *below* ink: match-rail wells, overlay scrims, cut-in backdrops. Ink `#241f2e` is structure; this is the void behind it. Replaced four near-identical ad-hoc darks. |
| **Night** | `#19142a` | Night sky on the celebration screens only. Distinct job from Ink-deep — do not merge them. |
| **Flame** | `#ff6a00` | A single accent, not a ramp: fire, heat and hazard FX only, always against the gold ramp. Never a fill, never chrome. |

### Sprite-sheet ramps — the art track's own set

`src/render/sprites/portraits.json` carries a keyed palette (lowercase = shadow, uppercase = base/light) that the 193 player identities and every portrait draw from. It is **not** a rogue palette: kits and skin need more saturation and more steps than the UI families give, which is the "extend a ramp" case the rule above sanctions. Named here so it stops reading as 25 one-off colours.

| Ramp | Keys | Values | Hue travel |
|---|---|---|---|
| **Kit red** | `o` `r` `R` `E` | `#7a2731` · `#c22f2c` · `#e8433f` · `#f2938c` | +11° |
| **Kit blue** | `b` `B` `C` | `#2f55b8` · `#3f6fd8` · `#a3c8f0` | −12° |
| **Leather / boot** | `x` `y` `z` | `#241a17` · `#3d2a22` · `#534537` | +16° |
| **Skin, 5-step** | `d` `m` `n` `S` `L` | `#8a4f38` · `#a86a42` · `#cf9268` · `#eab48c` · `#f7d7ba` | +12° |
| **Kit accents** | `T` `A` | `#1d9e75` teal · `#ba7517` amber | single values |

**Every one of these meets the 8–15° hue-shift rule, while five of the seven master UI ramps do not.** The sprite sheet is the better-disciplined half of the game's colour; when the master ramps are ever re-derived, derive them from these.

The brighter sprite-sheet `R`/`B`/`F` are also what the hero charge meter's rainbow bands wear, deliberately — a band in a HUD kit token would dissolve into the possession card behind it. That is load-bearing and covered by a test; do not "correct" those to the UI red and blue.

**One source of truth per power.** A power's colours come from `POWER_EFFECT_DESCRIPTORS` (`src/render/power-effect-descriptors.ts`) and nowhere else. All 17 entries are palette-clean; any screen that needs a power's colour reads `primary`/`secondary`/`highlight` from it rather than picking its own.

### The last seven — named 2026-08-08

After the conformance pass, every colour the shipped game draws is canon except these, and each earns its place. Everything else that drifted was snapped into the ramps above (79 colours across 85 sites), same-hue-family only.

| Named | Values | Job |
|---|---|---|
| **Celebration accents** | `#f6c744` gold · `#62b5e5` blue · `#63c56b` green | Confetti and fireworks. Deliberately brighter than the UI families so a fleck stays legible against a lit stage; used as one triad across all five celebration surfaces. |
| **Energy readout** | `#65b96e` green · `#f06b6e` red | Energy band type on the dark match rail. The turf and UI reds cannot carry small copy at that size — the same reason `#265b30` exists. |
| **Rail indigo** | `#49415f` | The match rail and cup-card panel ground: one step lighter than ink-soft, so a panel separates from the scrim without becoming grey. |
| **Blue extension** | `#77a4d8` mid · `#c8ddf0` pale | The core blue ramp is only three steps; coaching overlays and drill scenes need a mid accent and a pale wash between `#a3c8f0` and cream. |
| **Warm off-white** | `#d9d5cf` | The sprite sheet's own neutral — eye whites and bone, warm where `#d9d3e0` is cool. Paired with skin, never with UI chrome. |

Two greens sit outside every turf ramp on purpose and are **not** turf: `#65b96e` (energy readout type — needs contrast the turf shadow can't give on a dark rail, same reason `#265b30` exists) and `#63c56b` (confetti/fireworks, deliberately brighter than pitch base). Both are legal; neither may be used on grass.

### Club colours

Each club in `content/clubs.json` carries a `primaryColor` / `secondaryColor` pair. **Nothing renders them yet** — the match paints fixed home/away kits from `src/render/team-kit-ui.ts` (`#d94f52` home, `#edb54a` colour-safe home, `#5a8fd6` away), and the only code that touches the club fields is the zod schema that validates them. They were re-derived onto the palette on 2026-08-08 anyway, so the day they are wired up they are already legal. Every pair keeps its club's original character; only the values moved.

| Club | Primary | Secondary | Reads as |
|---|---|---|---|
| Bramble Rovers | `#31703F` | `#EDB54A` | bramble green / gold |
| Ferrous United | `#6B6675` | `#E8433F` | iron grey / rust red |
| Harbor Comets | `#2F55B8` | `#F4F1EA` | harbour blue / white |
| Oakridge Owls | `#6A4326` | `#F7D894` | oak brown / wheat |
| Neon Athletic | `#9A63D6` | `#A3C8F0` | neon violet / electric pale blue |
| Meadow City | `#529F5B` | `#F7D894` | meadow green / pale gold |
| Quartz FC | `#C9C5D0` | `#241F2E` | pale crystal / ink |
| Thunder Borough | `#EDB54A` | `#16121F` | lightning gold / storm dark |
| Cedar Crown | `#26512F` | `#BA7517` | cedar green / amber |
| Moonlight Town | `#5B3A91` | `#C9A6EC` | deep violet / moon pale |

Rules for adding a club: draw both values from the ramps above, keep **every primary unique** (that is the badge colour a player learns), and write hex **uppercase** — the schema regex is `^#[0-9A-F]{6}$` and rejects lowercase. Secondaries may repeat; real leagues are full of white and gold trim.

> If per-club kits are ever painted on the pitch, they must not defeat the colour-safe home/away split — that system exists so the two teams stay apart by lightness when hue is unavailable, and it is covered by tests in `src/render/__tests__/team-kit-ui.test.ts`.

## Typography — the pixel font

The game speaks in **one bitmap pixel font: HFM Silkscreen** (`assets/fonts/`, built by
`npm run build:fonts`). It is stock Silkscreen with 102 Vietnamese letters appended on the same
grid — the original glyphs are byte-identical, so every other language looks exactly as it always
did. Because it's a true pixel font, type reads as part of the art, not layered on top.

- **Display / buttons / labels / headings / eyebrows:** Silkscreen **Bold**, uppercase, letter-spaced. This is the default voice — every button label, tab, title, stat label.
- **Numerals & data** (money, stats, tables): Silkscreen with `tabular-nums` so digits align in columns.
- **Long body copy** (event narration, tooltips, paragraphs): a clean readable **sans** — pixel fonts are exhausting to *read*. Pixel font for short punchy strings; readable font for anything longer than a sentence.
- **Sizes ≤4 per screen, weights regular + bold** (per [08](08-ui-ux.md)). Render at **integer** point sizes; never blur/anti-alias pixel type at 1× — it defeats the look.

## Track A — the button recipe (chunky, rounded, two-tone)

Every button is a **fat pixel lozenge**, not a flat tinted rect. Meaning is carried by colour; shape is always this. Construction, at native res on a ~44–48px-tall button:

| Layer | Rule | Violet example |
|---|---|---|
| **Outline** | **2px** solid dark border, all the way around | `#35234f` (or ink `#241f2e`) |
| **Corners** | **Rounded chunky** — a 2–3px stepped pixel radius. Not square, not a 1px notch | — |
| **Highlight** | the **top ~40%** is the family **light** tint — a bold gloss band, *not* a 1px line; plus a 1px lighter rim on the top+left inner edge | `#a3c8f0` |
| **Face** | the family **base** fills the body — vibrant, saturated | `#5a8fd6` |
| **Lip** | the **bottom 2–3px** is the family **shadow/dark** — the raised depth | `#6d3fa6` |
| **Label** | **Silkscreen bold**, uppercase, cream/white, 1px ink drop-shadow, centred + tracked | `#f4f1ea` on face |
| **At rest** | optional 1–2px ink contact-shadow *under* the whole button | — |
| **Pressed** | button drops ~2px and the top highlight collapses — reads as pushed in | — |

Proportions on a 48px button: outline 2px · corner radius 2–3px · highlight band ~18px (top ~40%) · lip 2–3px.

Colour = meaning (per [08](08-ui-ux.md)): **blue** confirm/primary and neutral action · **red** cancel/destructive · **gold** hero/reward only · **grey** disabled. Violet is retired from the UI palette (2026-07-24); it survives only inside authored art such as power identities and character sprites. Faces are **vibrant** — buttons are exactly where the palette is allowed to shout, against the calm cream canvas. Reserve red for genuinely destructive actions.

## Track B — world & character art

Soft coloured outline (dark tint of the fill, never `#000000`), 3–4 value ramp shading, light from the **upper-left**, hard bands (no gradients, no anti-aliasing), chunky silhouette.

### Characters — Rule 1: exaggerate; break the thirds

A normal face splits into even thirds (hairline→brow, brow→nose, nose→chin). **A caricature refuses to keep them even** — one third balloons, the others shrink. Find the defining feature, blow it up, let it steal space. Push the **eyes** to extremes: giant all-pupil orbs with no white, or tiny 1–2px beady dots — a personality, not a default. **One big move per face; keep the rest quiet.**

Archetypes: **Wonderkid** (eyes eat the face, whole eye = pupil, one sparkle) · **Enforcer** (huge jaw + gritted mouth, 1px beady pupils) · **Gaffer** (bald tiny upper third, bulbous nose + heavy brow + moustache, deep-set dots).

### Characters — Rule 1B: the club world is multicultural

Players, coaches, staff, supporters, officials, and visitors must form an explicitly **multicultural cast**. A staff shortlist cannot read as one ethnicity with palette swaps: vary skin-tone ramps, hair textures, hair traditions, ages, gender presentation, face shapes, and names across the whole roster. Every recurring coach gets an individual silhouette and **one unique caricature move**—for example a braid crown, round glasses, high ponytail, headwrap, blunt bob, loc bun, giant beard, silver pixie cut, strong brows, wild curls, or hair pins.

Caricature describes the **individual's personality**, never their ethnicity. Do not use skin tone, accent, religious clothing, or cultural hair as the joke or exaggeration. Avoid identical faces recolored into “diversity,” and avoid grouping traits into stereotypes. Check the full cast together before export: no coach should be mistaken for another at 1× or in silhouette.

The player pool ships **193 stable identities**: 168 outfield looks and 25 goalkeeper looks, enough for every player in the 160-person launch league to be visually distinct with a deep reserve for future seasons. Future youth and academy IDs map deterministically into the same pool while keeping each club roster internally unique. Subtle variants are encouraged—natural hair colour, skin ramp, earrings, small scars, eyebrow slits, facial hair, forehead/hairline proportion, or an accessory—but each identity still needs a structural face or silhouette difference. A palette swap alone is not a new character. Natural black and brown remain the roster baseline; a small authored group may use celebrity-football dye treatments such as electric blue, teal, hot pink, or vivid orange, with bleach-blond and bleached-silver reserved for only a few memorable silhouettes. Famous footballers may inform one exaggerated silhouette cue, but production characters stay fictional: no real names, club marks, or exact portrait copies.

Coaches enter the staff pool at **age 30–60** and must read as staff rather than recycled players. Their staff-only wardrobe spans the real touchline spectrum: suit and tie, open-collar suit, blazer with turtleneck, cardigan over a shirt, collared sweater, quarter-zip, training polo, club tracksuit, technical shell, padded gilet, padded coat, rain jacket, and overcoat with scarf. Keep adult proportions and restrained age-band cues such as expression lines, grey temples, silver hair, or a mature hairline. Age and clothing are personality signals, never jokes or indicators of coaching quality.

### Characters — Rule 2: expression sets

Faces are **eyes-and-mouth swaps over a fixed head**. Ship **resting / peak-joy / knocked-out** minimum. **X-for-eyes is the universal KO tell**; gritted teeth sell pain. One portrait reacts live — neutral on the ball → X-eyes injured → grin on a goal — no full redraw.

### World objects, props & architecture

Buildings, goals, and items obey the same outline + 4-value shading as characters, **plus**:

- **Silhouette first.** It must read as a solid black shape before any detail. Chunky, slightly stubby proportions to match the chibi cast — a storybook miniature, not a blueprint.
- **Give it character.** Props are never sterile. Exaggerate one defining feature — a tall crooked chimney, an oversized hand-painted sign, a bulging kit bag, a wonky goal frame. One deliberate imperfection reads as "hand-built" — that's the charm.
- **One coloured outline.** 1px dark-tint outline around the whole silhouette and the major internal edges — the darkest step of that material's ramp, never `#000000`.
- **4-value material shading.** Lit plane (upper-left) → base → shadow → dark. Buildings: lit wall vs shadowed wall + a 1px roof-eave highlight. Give every object **one ground contact shadow** — a squashed ink ellipse at low opacity.
- **Materials from the palette:** cream/grey walls, **wood/leather brown** ramp, **pitch green** turf, **grey** ramp for metal/concrete/posts, **gold** only for silverware/hero fixtures. Same ramp discipline, no one-off colours.
- **Perspective:** menu & prop art is **flat front-elevation** (straight-on, no vanishing point) — easiest to read and to build as a family. The match pitch keeps its own side/¾ view (see [03](03-match-engine.md)); never drop a perspective building into the flat menu set.
- **Scale:** buildings in multiples of `16px`; small props/items `16` or `24px`; a goal frame sized to its pitch context.

**Worked objects**
- **Clubhouse / stand** — cream wall (lit left, shadowed right), red pitched roof with a 1px highlight eave, blue windows, brown door, grass strip at the base; a crooked chimney or hanging sign for character.
- **Goal & net** — white/cream posts + crossbar, grey-dark outline, 1px gloss on the lit side. The **net is implied, not literal**: a light-grey 1px lattice (square or diagonal mesh) across the goal mouth at ~50% density, fading toward the back. Read the mesh, never draw every hole.
- **Ball** — shaded white sphere + Telstar pentagon panels (see companion).
- **Trophy / item icons** — `16px`, gold ramp for silverware, one highlight pip.

## Shared foundations

| Rule | Detail |
|---|---|
| Native resolution | Item/props icons `16`–`24px`; portraits `24×29` (head + shoulders + kit); buildings multiples of `16`; goal frame to pitch scale. |
| Pixel grid | One logical pixel = the unit; never half-pixels. On-screen scaling is always an integer multiple (×2/×3/×4). |
| Render settings | `image-rendering: pixelated` in DOM; `FilterMode.Nearest` in Skia. Never bilinear-filter a sprite or blur pixel type. |
| Light direction | Upper-left, always. Contact shadow bottom-right / on the ground. |
| Atlas & export | Packed Skia **Atlas** — one draw call, never one node per sprite (see [03](03-match-engine.md)/[09](09-tech-stack.md)). Portraits ship base head + eye/mouth overlay sheet. |
| File naming | `track/category/name@1x.png` — `art/player/striker_ko@1x.png`, `art/prop/goal_net@1x.png`, `ui/button/confirm.png`. |
| Spacing | The 8-pt grid everywhere (`4 / 8 / 12 / 16 / 24 / 32`), per [08](08-ui-ux.md). |

## Pixel Logic compliance

Craft rules adopted 2026-08-08 from *Pixel Logic* (Michafrar), kept only where they add something the sections above don't already say. They govern *how a curve or a ramp is built*; the palette, outline colour and 4-value discipline above still bind.

1. **Curves progress; they don't stumble.** A curve's step runs should *change* along it — `3,2,1` opening out, `1,2,3` closing in. Equal runs all the way down are a straight diagonal, not a curve. What a curve must never do is stumble: a **single-row step marooned between two runs of three or more** is the classic accidental jaggie, and the cure is redrawing the step, never a smoothing pixel.

   *(First written as "never mix a 1px and a 2px step on one curve." That was wrong on the merits — it described a diagonal and condemned 62–75% of the cast, which is the medium, not a defect. The corrected rule finds 15 real jaggies in the portrait sheet across five identities and 106 in the match sheet; both are gated at an exact count.)*
2. **One line weight per sprite family.** Every outline and interior limb break in the character set is **1px** and stays 1px whatever the kit colour — a red player and a blue player must have identical weight or their silhouettes stop matching at 1×. Thicker weights are a Track A privilege (the 2px button outline), not a per-sprite choice.
3. **Hue-shift every *new* ramp.** A shadow is not just a darker base. Rotate ~8–15° per step in one consistent direction: **shadows toward the ink-plum end** (ink `#241f2e` is a violet, so shadows that lean plum harmonise with every outline in the game), **highlights toward warm**. This buys depth with no new families — extend a ramp by hue-shifting, never by introducing a colour.

   **This binds new and extended ramps only. The seven master ramps are locked as they are**, and five of them do not meet it — measured shadow→light hue travel: Red **+10°**, Pitch **−9°**, Gold **+6°**, Wood **+5°**, Blue **−4°**, Skin **+4°**, Grey **+2°**. Re-deriving them would retouch every sprite, every kit and every golden snapshot to buy 4–10° that reads as nothing at 1×. The rule is a craft constraint for *building* a ramp, not a gate on the foundation.
4. **Test at 1× on cream before export.** Every new sprite gets viewed at native size on `#f4f1ea`, alongside the rest of its set, before it ships. If it doesn't read instantly there, the fix is a bigger shape or a stronger silhouette — never more detail. Detail added below the readable threshold is cost with no payoff.
5. **One pitch-line weight.** Pitch markings are a single stroke width across every pitch asset (`LINE_W = 2` in [Pitch.tsx](src/render/Pitch.tsx:24)); goalposts are deliberately the one exception at `POST_W = 4`, so the goal mouth reads at a glance. New pitch furniture uses `LINE_W`, not a new number.

### What measuring these actually showed (2026-08-08)

The sheets were measured, and three of the rules above needed scoping rather than enforcing. `src/render/sprites/__tests__/pixel-bible-geometry.test.ts` is the standing gate for the rest — outline colour, outline weight, and edge survival, run against **the background each sheet actually sits on** (portraits on cream, match sprites on pitch base; judging match sprites against cream invents thousands of failures that do not exist).

- **Rule 1 holds, with one sanctioned exception.** All 177 `fontSize` declarations are integers. Three celebration surfaces put a soft halo *behind* crisp glyphs (`textShadowRadius` 7 in [EndgameCelebrationScreen](src/ui/screens/EndgameCelebrationScreen.tsx:138) and [SurgeBanner](src/ui/components/SurgeBanner.tsx:150), 2 in [ChampionshipCelebrationScreen](src/ui/screens/ChampionshipCelebrationScreen.tsx:571)). The glyph edges stay hard; the glow is what lets type survive the brightest art in the game. Allowed **only** for type over busy celebration scenes — never on chrome, never on the glyphs themselves.
- **Rule 7 was mis-stated, not inapplicable.** Measuring "equal step runs" flagged 62–75% of curves, and I first read that as the rule not binding at 24×29. Review corrected it: equal runs describe a diagonal, and real curves *should* vary. Re-stated as "no single-row step marooned between two runs of 3+", it finds a short, nameable list instead — **15 in portraits, 106 in match sprites** — and is gated at those exact counts. The lesson generalises: when a conformance check condemns most of the corpus, suspect the check.
- **Rule 2 was being measured in the wrong unit.** Sprites average 8.5–9.4 colours and peak at 13, which is correct: a character wears skin + hair + kit + ink at once. The four-value rule governs **one icon or one material**, not one cast member.
- **Rule 8 has a real gap.** The 1px band dominates (72% portraits, 74% match sprites), but portraits carry an outline on only **79.5%** of their silhouette against the match sprites' **97.3%** — roughly a fifth of a portrait's edge is bare fill meeting the background. Fixing that is authoring work on the 1299-sprite sheet, not a code change.
- **Rule 4 confirmed with evidence.** Zero pure-black entries in any of the five palettes; every outline is a dark tint.
- **Rule 12 needs a size qualifier.** UI chrome is 96% clean at the canon 2px (367 `border-2` against 14 `border-4`). Every `borderWidth: 1` in the codebase is a sub-12px micro-element — an 8×8 progress dot, a 9×5 pip, a confetti fleck — where a 2px border would eat the element. **2px is the chrome weight; elements under ~12px use 1px.** The Don't-list ban on "thin 1px UI outlines" means buttons and panels, not pips.
- **Rule 3 is gated at the only level a metric can honestly reach.** Whether a face exaggerates well is a judgment; whether the *cast* varies is measurable. Eye-band vs jaw-band ink across the 433 identities spans 0.67–4.5 (median 1.50), with only 7% showing no dominant feature — so the roster is genuinely pushed in different directions, not one head in recolours. The gate asserts that spread, and would fail if the cast collapsed toward a single template.

**The rule-10 backlog is 291 pixels, and the gate holds an exact count per sheet — not a percentage.** A percentage budget was the first thing tried and it was wrong twice over: it let new debt hide behind a growing sheet, and it handed sheets a silent allowance. Under a 0.001 budget the portraits and match sprites read as clean while carrying 158 bad pixels between them. Absolute counts, zero tolerance for new ones:

| Sheet | Known dissolving pixels | What |
|---|---|---|
| match sprites | 104 | `#ff6a00`, `#a3c8f0`, `#b9b4c2`, `#f2938c`, `#1d9e75` meeting turf |
| management sprites | 116 | `#c5c1ca` ×80, `#fff5dc` ×36 meeting cream |
| portraits | 54 | mostly `#ffffff` and `#a3c8f0` meeting cream |
| event objects | 17 | incl. two pixels of cream fill on a cream backdrop — invisible at any size |
| finance icons | 0 | clean |

Fixing these is authoring work: the cure is an ink outline, not a colour swap, and patching pixels blind is how a silhouette dies. Lower a number when art is fixed; never raise one.

**Rejected — selective anti-aliasing on button corners.** *Pixel Logic*'s selective-AA technique is for authored sprite art at high curvature; it does not transfer here. Track A buttons are not authored pixels — they are runtime views (`border-2 border-b-4 border-ink`), so there is no corner pixel to cushion, and where a radius does exist the platform already smooths it. Adding intermediate tones would also double every ramp and contradict the hard rules above (`no anti-aliasing`, `never blur pixel type`). **Jaggies are cured by rule 1, not by AA.** The hero-Zone glow and all FX frames are covered by the same ban — a soft-tinted chunky edge, never a feathered one.

## Do / don't

**Do** — cream canvas, vibrant chunky buttons; thick 2px outlines and rounded corners on UI; Silkscreen pixel-font labels; on art, coloured outlines + 4-value bands + one character-giving exaggeration + a ground contact shadow; build an explicitly multicultural cast; break the thirds on faces; ship resting/joy/KO sets; hold one stair-step rhythm per curve; hue-shift a ramp instead of adding a colour; check every new sprite at 1× on cream.

**Don't** — flat square tinted-rectangle buttons; thin 1px UI outlines; system font on labels; `#000000` outlines; smooth gradients or anti-aliasing (including "selective" AA on button corners); mixed 1px/2px steps on one curve; line weight that changes between two players in the same set; ethnicity-as-caricature or recolored clone faces; blueprint-flat sterile props; literal every-hole nets; mixed perspective in the menu set; bevel/gloss on sprites; one-off colours outside the palette.
