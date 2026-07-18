# 11 — Art Style (Pixel Bible)

The look: **B+ "heroic chibi" pixel art**. Two rendering tracks share one palette so the whole game reads as one world. This doc is canon for how art is *drawn*; UI colour-role and chrome discipline live in [08-ui-ux.md](08-ui-ux.md) (60-30-10, hero-gold reserved) and this doc defers to it for *usage*.

A rendered visual companion exists — the style-guide page with every swatch, the bevel construction, the shading ramp, and the worked caricature/expression examples. (Private Claude artifact: `claude.ai/code/artifact/6cdbc00c-02c4-4e8d-b8ac-e3df858bde25`. The hexes and rules below are the source of truth; the page just shows them.)

## Two tracks, one palette

- **Track A — Interactive UI** (buttons, toggles, tabs, sliders, chrome): a hard **bevel** — dark outline, bright top highlight, solid face, dark bottom lip. Reads raised, glossy, pressable.
- **Track B — Character & object art** (players, people, fans, buildings, trophies, items, icons): a **soft coloured outline** (a dark tint of the fill, never pure black), 3–4 value shading, chibi shapes, and **one feature exaggerated**. Reads hand-drawn and full of character.
- **Never mix the recipes.** A face is not beveled like a button; a button is not shaded like a sprite.

## Master palette

Every colour comes from here. Author art as indexed PNG with the palette locked.

### Core families — UI + art

| Family | Shadow | Base | Light | Meaning (see 08) |
|---|---|---|---|---|
| Violet | `#5b3a91` | `#9a63d6` | `#c9a6ec` | Confirm / primary |
| Red | `#a83440` | `#d94f52` | `#f2938c` | Cancel / destructive |
| Blue | `#3f6fb5` | `#5a8fd6` | `#a3c8f0` | Neutral action |
| Gold | `#c8862a` | `#edb54a` | `#f7d894` | **Hero / reward only** |
| Grey | `#6b6675` | `#9a95a4` | `#c9c5d0` | Disabled / structure |

Shared neutrals used by both tracks: **Ink** `#241f2e` · **Cream** `#f4f1ea` · **White** `#ffffff`.

> Gold is "hero gold." Per [08](08-ui-ux.md) it may only mark hero/power/reward moments — never plain settings or generic emphasis.

### Extended world — art track only (same 4-value ramp discipline)

| Ramp | Shadow | Base | Light |
|---|---|---|---|
| Skin | `#cf9268` | `#eab48c` | `#f7d7ba` |
| Hair / wood / leather | `#6a4326` | `#8a5a30` | `#a9743d` |
| Pitch / turf | `#3f8a4a` | `#5cb85c` | `#8fd98f` |

Face extras: soft skin outline `#6a4326`, nostril/deep-crease `#b07a52`, grey hair `#7d7887`/`#b9b4c2`. Deeper skin tones extend the Skin ramp darker (e.g. shadow `#8a4f38`) — same discipline, more range; the game's players are diverse.

**Rule:** pick a family, use its ramp. A shape uses one family + ink + cream + at most one neutral for a contact shadow. Extend a ramp when you need more range; never invent a one-off colour.

## Track A — the button recipe

9-slice beveled buttons. The frame scales to any label; only the ramp changes. **Meaning is carried by colour, not by shape.** Four fixed values per family (violet example):

| Layer | Rule | Violet |
|---|---|---|
| Outline | 1px dark border; corners notched 1px | `#35234f` |
| Highlight | top 3 rows + left edge — the gloss | `#c9a6ec` |
| Face | solid mid-tone body | `#9a63d6` |
| Lip | bottom 3 rows — the raised depth | `#6d3fa6` |

Labels: cream mono, uppercase, tracked, with a 1px ink drop-shadow. Disabled = grey ramp, dimmed label. Reserve red for genuinely destructive/negative actions only. Vivid buttons are for primary actions and moments; everyday chrome stays calm per [08](08-ui-ux.md).

## Track B — character & object art

### Rule 1 — Exaggerate; break the thirds

A normal face splits into even thirds: hairline→brow, brow→nose, nose→chin. **A caricature refuses to keep them even** — one third balloons and the others shrink to make room. Find the feature that defines the character, blow it up hard, and let it steal space from everything else. Push the **eyes** to the extremes too: giant all-pupil orbs with no white, or tiny 1–2px beady dots — the choice is a personality, not a default. **One big move per face; keep the rest quiet** so the exaggeration lands.

Reference archetypes (each breaks a different third, each a different eye treatment):

- **The Wonderkid** — middle third swallowed by eyes; the *whole eye is the pupil*, no white, one sparkle.
- **The Enforcer** — lower third exploded into a giant jaw + gritted mouth; tiny 1px beady pupils under a heavy brow.
- **The Gaffer** — bald tiny upper third; middle third owned by a bulbous nose, heavy brow, and moustache; deep-set dot eyes.

### Rule 2 — Expression sets

Faces are **eyes-and-mouth swaps over a fixed head** — the head stays put, only the features change. Ship each character with at least three: **resting**, **peak-joy** (closed happy arcs + open grin), **knocked-out**. **X-for-eyes is the universal KO / faint tell**; gritted teeth sell the pain. In game one portrait reacts live — neutral on the ball → X-eyes when injured → grin on a goal — with no full redraw.

### Rule 3 — Shade with a 4-value ramp

Light comes from the **upper-left, always**. Each form uses four steps of one ramp — core, shadow, light, highlight — quantised into hard bands. No smooth gradients, no anti-aliased edges. Highlights top-left, contact shadow bottom-right.

### Outlines

Art outline = the **darkest step of that shape's own ramp** (a coloured dark), never `#000000` — that softness is what separates our look from harsh clip-art. 1px weight at native resolution. UI outline = the single dark ink `#241f2e`.

## Shared foundations

| Rule | Detail |
|---|---|
| Native resolution | Item icons `16px`; portraits `24×29` (head + shoulders + kit — the torso runs long enough to read team colour and build); buildings in multiples of `16`. |
| Pixel grid | One logical pixel = the unit; never half-pixels. On-screen scaling is always an integer multiple (×2/×3/×4). |
| Render settings | `image-rendering: pixelated` in DOM; `FilterMode.Nearest` in Skia. Never bilinear-filter a sprite. |
| Light direction | Upper-left, always. |
| Atlas & export | Packed Skia **Atlas** — one draw call, never one node per sprite (see [03](03-match-engine.md)/[09](09-tech-stack.md)). Portraits ship as a base head + a small eye/mouth overlay sheet. |
| File naming | `track/category/name@1x.png` — e.g. `art/player/striker_ko@1x.png`, `ui/button/confirm.png`. |
| Spacing | Anything the sprites sit inside obeys the 8-pt grid (`4 / 8 / 12 / 16 / 24 / 32`), per [08](08-ui-ux.md). |

## Do / don't

**Do** — break the thirds; one exaggeration per face; outline in a dark tint of the fill; 3–4 values with hard bands; ship a resting / joy / KO set per face.

**Don't** — flat, symmetrical, feature-less faces; `#000000` outlines; smooth gradients or anti-aliased edges; bevel/gloss on sprites (that's the button recipe); one-off colours outside the palette.
