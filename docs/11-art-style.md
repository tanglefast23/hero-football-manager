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

## Do / don't

**Do** — cream canvas, vibrant chunky buttons; thick 2px outlines and rounded corners on UI; Silkscreen pixel-font labels; on art, coloured outlines + 4-value bands + one character-giving exaggeration + a ground contact shadow; build an explicitly multicultural cast; break the thirds on faces; ship resting/joy/KO sets.

**Don't** — flat square tinted-rectangle buttons; thin 1px UI outlines; system font on labels; `#000000` outlines; smooth gradients or anti-aliasing; ethnicity-as-caricature or recolored clone faces; blueprint-flat sterile props; literal every-hole nets; mixed perspective in the menu set; bevel/gloss on sprites; one-off colours outside the palette.
