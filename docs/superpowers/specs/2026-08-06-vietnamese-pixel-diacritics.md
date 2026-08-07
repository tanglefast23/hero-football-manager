# Vietnamese pixel diacritics for Silkscreen — design

Date: 2026-08-06
Status: **approved** — Grok 4.5 (4 rounds) and Claude Fable 5 (5 rounds)

Draw the ~100 missing Vietnamese glyphs into a Silkscreen derivative so that
`vi` renders in the game's own pixel face instead of Handjet, **without**
changing line height, advance widths, or the appearance of any other language.

This supersedes the Handjet decision recorded in
`docs/superpowers/specs/2026-08-06-multilingual-copy-design.md` §2 and in
`src/i18n/locales.ts`. Handjet was chosen because it was one of only two pixel
faces on Google Fonts covering Vietnamese; it is lighter, wider and lower
contrast than Silkscreen, and because the face swap is per-language, selecting
Vietnamese currently redraws the *entire* UI — including untranslated English —
in a visibly worse font.

---

## 1. Measured facts

All numbers parsed from the shipped TTFs
(`@expo-google-fonts/silkscreen@0.4.2`, both cuts) — not from documentation.

| Quantity | Value |
| --- | --- |
| `unitsPerEm` | 1000 |
| Design grid | 125 units = 1 pixel (8 px per em) |
| Cap/letter height | 625 units = **5 px**, baseline at y=0 |
| Descender ink | `g p y j` stop at y=0, but `q` and `,` reach −125 and **`Ç ç` reach −250** |
| `hhea.descender` | −250 — declared *and* already used to its full extent by cedilla |
| Hinting tables present | `fpgm`, `prep`, `cvt `, `gasp`, plus `GPOS`/`GSUB`/`GDEF` |
| `hhea.ascender` / `sTypoAscender` | **1030** |
| `OS/2.usWinAscent` / `usWinDescent` | **1000 / 250** |
| Single accent top (`Á Â Ã`) | **1000** |
| Diaeresis top (`Ä`) | 875 (one row, at 750–875; row 625–750 is the gap) |
| Advance quantum | 125 units; every advance is a whole pixel |
| `o` advance | 750 (regular) / 875 (bold); ink 500 / 625 wide |
| Accented advance | **identical to the base letter** (`á` = `a` = 750) |
| Glyph count | 227, covering 226 codepoints |

**The binding constraint is 30 units.** The declared ascender sits 0.24 px above
the top of the existing acute accent. There is no room for a second mark on the
full pixel grid.

**And y=1000 is a hard clipping bound, not a stylistic one.** It is exactly
`OS/2.usWinAscent`, the height above which Windows-family rasterisers clip — and
the planned Steam build is Electron, i.e. Chromium reading usWin metrics. Ink
above 1000 would not merely look tall; it would be cut off. The same is true
downward at −250 (`usWinDescent`), which `Ç ç` already reach. The design must
live inside **[−250, 1000]**, an envelope the font already occupies fully.

### 1.1 Vietnamese glyph inventory

The language needs 134 precomposed letters (7 base modifications × 2 cases,
plus 12 vowels × 5 tones × 2 cases). Silkscreen already has 32 of them via
Latin-1 (`á à ã â é è ê í ì ó ò õ ô ú ù ý` and caps).

| Category | Count | Notes |
| --- | --- | --- |
| **Missing total** | **102** | the work |
| Need two stacked marks *above* | **32** | `ắằẳẵ ấầẩẫ ếềểễ ốồổỗ` + caps |
| Dot-below only | 24 | draws into the −250 band `Ç ç` already occupy |
| New base letters | 8 | `ăĂ đĐ ơƠ ưƯ` |
| Single-mark, no stacking | 38 | hook-above/tilde/dot on plain vowels |

Only **32 of 134 glyphs** create the vertical problem. Everything else fits the
existing box on the full pixel grid today.

---

## 2. Proposal — sub-pixel mark rows, on integer coordinates

> **§6.7 has run. Scheme C is dead; Scheme A is the design.** The mockup gate
> rendered both schemes in both cuts at true 1:1 across 16–72 px/em, with real
> area-coverage antialiasing, against Handjet as a reference. Scheme C's two
> touching bands read as **one solid slab**: `ễ` renders as a filled rectangle,
> the circumflex disappears entirely from `ế ề ể ễ` while surviving in `ệ` (which
> has no tone above it), so the six-glyph set reads caret / slab / slab / slab /
> slab / caret. Bold is worse — its stock `ê` is already a filled caret, so
> compressing it yields a bar as wide as the letter. The order of proof below is
> kept as the record of how that was decided, not as work still to do.

**Order of proof. Do not skip to the sub-pixel grid.** Two schemes were on the
table and the cheaper one had to be disproved first:

**Scheme C — compressed full-grid stack (try this first).** Drop the gap rows
and stack both marks on the existing 125-unit grid:

```
875 – 1000   tone mark      (1 full row)
750 – 875    base mark      (1 full row)   circumflex / breve
625 – 750    gap            (1 full row)
0 – 625      the letter     (untouched)
```

Top of ink = 1000. Every coordinate is already a legal multiple of 125, no new
geometry class, no rasterisation question, and the marks are as crisp as the
letters.

C carries **three** risks, and the third is easy to miss: one row is thin for a
distinguishable five-tone set; circumflex-versus-breve in a single row is
doubtful; and **the two mark bands touch.** Base occupies 750–875 and tone
875–1000 with no gap between them, because the single spare row has to go below
the base mark or it merges into the letter body instead. §4 describes gaps as
what stops two marks reading as one blob — that applies to C's mark-to-mark
boundary at y=875 just as much as it does to A. **Mock it as bitmaps and test it
before building anything else** (§6.7). If it passes, the rest of this section
is unnecessary.

**Scheme A — sub-pixel mark rows.** If C fails, give the marks half-height rows.

> **TrueType `glyf` coordinates are integer FUnits. `62.5` cannot be stored.**
> An earlier draft of this spec specified 62.5-unit rows and was not
> implementable; it would have failed at the first `fonttools` compile. The row
> boundaries are therefore an explicit integer table, with rows alternating 63
> and 62 units. Uniformity is not required — only legality and a fixed table.

```
938 – 1000   tone mark   (62)  ┐ tone = 875–1000 solid, 125 units
875 –  938   tone mark   (63)  ┘
813 –  875   gap         (62)
750 –  813   base mark   (63)  ┐ base = 688–813 solid, 125 units
688 –  750   base mark   (62)  ┘   circumflex / breve
625 –  688   gap         (63)
  0 –  625   the letter        untouched Silkscreen outline
```

Legal integer row boundaries: **625, 688, 750, 813, 875, 938, 1000**, summing to
the 375 units available. Both marks get **two sub-rows of solid ink** (≈125
units each) and both gaps are ≈62–63, with no orphan band.

An earlier draft of this table gave the tone a single 62-unit sub-row while the
base mark got a full 125, which contradicted this section's own ink rule and
inverted the priority: **the tone is the mark that carries meaning**, so if
either is going to be thin it is not that one.

Top of ink is 1000, exactly where `Á` already tops out and exactly
`OS/2.usWinAscent`. `hhea.ascender` (1030), the OS/2 metrics, line height and
every layout constant are unchanged.

Under either scheme, non-stacked glyphs keep the existing full-grid mark at
750–1000, so **the 32 Latin-1 accents Silkscreen already ships are not
redrawn** and Spanish, French, Portuguese and German are untouched.

Silkscreen is not a perfectly clean 125 lattice today in any case — not every
existing point sits on a multiple of 125 — so "sub-pixel rows for marks only"
does not violate an invariant the font actually holds.

### 2.1 Why not smooth (non-pixel) marks

A curved mark over a pixel letter is more legible per unit of height and would
also fit. Rejected because **the mismatch scales with type size**: invisible on
an 8 pt caption, conspicuous on a 40 pt heading — worst exactly where the game
is most decorative. Axis-aligned rectangles read as fine pixel detail, the same
trick pixel art already uses for eyes and specular highlights, at every size.

### 2.1b What the mockup gate measured

Scheme A survives for one reason that Scheme C cannot buy back: **the circumflex
stays a circumflex in every toned form**, so `ê ế ề ể ễ ệ` read as one family.

It also turns out to be structurally what the current font already does.
Measured from Handjet: a stacked glyph gets **5 dot rows above an 8-row letter**
(2 base / gap / 2 tone). Silkscreen has 3 rows above a 5-row letter, and Scheme
A's 2 sub-rows / gap / 2 sub-rows reproduces that same structure at 60% vertical
scale. Handjet's own stacked marks at 21 px/em are themselves a soft grey
cluster — so the bar for "acceptable" is lower than it looks, and Silkscreen's
letter body is bigger and crisper underneath it.

**Two blockers remain, and neither is a tone-versus-tone question:**

1. **Breve versus circumflex under a tone.** The distinction is a pure vertical
   mirror at 62/63-unit resolution — at 21 px/em, a ~20% brightness
   redistribution across two adjacent device-pixel rows. **In Bold it is
   essentially gone**: five ink columns at half height turn both marks into
   horizontal streaks. `ắ`/`ấ` and `ằ`/`ầ` are different words. §4 spent its
   whole risk budget on tone-versus-tone and never named this pair, which is at
   least as fragile.
2. **Hook-above's shape.** Handjet draws it taller than wide; the mockup drew it
   wider than tall. That is a *correct-Vietnamese* question, not a distinctness
   one, and no one on this workstream can settle it.

**Both were put to a Vietnamese reader (the project owner) at 21 px/em — the
marginal `text-xs`-on-@2x case — and both passed, in Regular and in Bold.**
Scheme A is therefore the design, the §7 fallback is not being taken, and the
horn ships as option (a′) at rows 3–4 with the advance unchanged.

That sign-off covers shape acceptability at the hardest size. It does **not**
retire §6.5: the reader judged rendered mockups, and the built font still has to
be checked on a real device, at both densities, in both voices, before the face
swap lands.

### 2.1c The horn is settled — option (a′) works

Drawn in the existing right sidebearing (column `advance/125 − 1`; column 5
Regular, 6 Bold — both cuts carry exactly 125 units of RSB), **advance
unchanged**. `ơn hơn mơi ưu` renders with a 1 px ink gap where the font
elsewhere has 2 px. Tight and unique to those letters, but it never merges, at
any size in either cut, and the tone stays centred on the body without drifting
into the horn column. The Bold case — a 1 px whisker against a 5 px ring — was
put to the reader and accepted, so the horn stays at rows 3–4. Raising it to
rows 4–5 remains available if device QA disagrees.

### 2.2 Rasterisation — the honest version

An earlier draft claimed sub-pixel marks add "no new class of artifact" because
the app already renders Silkscreen antialiased. **That claim was half true and
is withdrawn.**

**And having now been measured, it pointed at the wrong sizes.** The draft said
the danger was large integer-ppem headings, citing `fontSize: 24` @3x = 72 px/em.
Measured coverage of the tone band across `ế ề ể ễ`:

| ppem | context | Scheme A mark ≥95% crisp | letter body |
| --- | --- | --- | --- |
| 16 | `text-[8px]` @2x | 77% | 100% |
| **21** | **`text-xs` @2x** | **11%** | 52% |
| 24.5 | `text-sm` @2x | 15% | 58% |
| 36.75 | `text-sm` @3x | 33% | 69% |
| 72 | `fontSize: 24` @3x | **82%** | 100% |

72 px/em is nearly fine — one soft row in nine. The soft zone is the **small,
non-integer body sizes**, where at 21 px/em the mark is 11% crisp in a context
where the letter itself is only 52%. The relevant quantum is **em/16**, not
em/8: Scheme A snaps crisp at ppem 16, 32, 48, 64 and is worst at the
half-integer multiples between them.

Mitigating, and the reason this is survivable: the tone band still reaches full
coverage somewhere at every size (mean 0.48–0.67 at body sizes). It is light and
soft, not a smear — the two-sub-rows-of-solid-ink rule is doing its job.

So the true statement is: **under Scheme A, diacritics will read lighter and
softer than their bases at integer-ppem sizes.** That may still be acceptable —
a soft but identifiable tone mark beats a crisp wrong one — but acceptance is
**tone identification, not stem parity** (§4, §6.5). This is the single
strongest argument for proving Scheme C first.

Mitigation if Scheme A ships: give each mark **two sub-rows of solid ink**
rather than a one-sub-row hairline, so antialiased coverage stays near full.

---

## 3. The horn — cheaper than the first draft claimed

`ơ` and `ư` carry a horn on the top-right shoulder. Unlike every other mark it
extends **horizontally**.

The measured fact that decides this: `o` ink runs 125–625 inside a 750-unit
advance, so there is already **125 units (1 px) of right sidebearing** — and the
same holds in the bold cut (ink 125–750 inside an 875 advance). **Both cuts**
carry the same 125-unit RSB. An earlier draft assumed a horn necessarily costs
+1 px of advance. It does not.

Three options, in the order they should be tried:

**(a′) Horn in the existing right sidebearing.** 1 px wide, at the top of the
shoulder. **Advance unchanged**, so every measured advance table stays valid and
the §1 invariant (accented forms keep the base advance) holds.

The cost is narrower than an earlier draft claimed. It consumes `ơ`'s own right
**sidebearing**, not the inter-glyph gap: the next letter still contributes its
own 125-unit left sidebearing, so `ơn` renders with a **1 px ink gap** where the
rest of the font has 2 px. Tight and visibly unique to those letters, but it
cannot merge — merging would need zero ink between them. **Try this first, and
judge it on a rendered word rather than in isolation.**

**(a) Horn with +125 advance.** Only if (a′) demonstrably collides at body
sizes. The affected set is the **24** horn-carrying codepoints — `ơ ư` each with
five toned forms, in both cases:

```
ơ Ơ  ớ Ớ  ờ Ờ  ở Ở  ỡ Ỡ  ợ Ợ      ư Ư  ứ Ứ  ừ Ừ  ử Ử  ữ Ữ  ự Ự
```

(An earlier draft said 12, having counted only the lowercase half.) Every one of
those has an advance differing from its base, which requires regenerating the
`vi` advance tables behind
`src/i18n/advance.ts` and `src/ui/league-table-columns.ts` (which is a
re-measure, not a hand-maintained exception, since they are generated from the
TTF — but gate 8b must be re-run).

**(b) Carve the top-right of the ring.** Last resort. At 4×5 px an `o` is a
closed ring and removing its corner may read as `a`, `d` or `ə`.

**Horn plus tone** (`ớ ờ ở ỡ ợ`, `ứ ừ ử ữ ự`) is a separate case the first draft
missed: the tone sits **above the letter body, horizontally centred on the body
and not on the horn**, so it must not drift right into the horn's column.
**Twenty** of the 102 glyphs are this shape (`ớ ờ ở ỡ ợ`, `ứ ừ ử ữ ự`, both
cases) and they should be drawn as a set, not derived.

---

## 4. Tone legibility — the actual risk

The risk is **not** stylistic inconsistency. The base alphabet is unchanged, so
Vietnamese text and English text sit on the same grid and look like one font.

The risk is **tone ambiguity**. Vietnamese distinguishes six tones, five of them
by mark: `má` `mà` `mả` `mã` `mạ` are five different words. Acute, grave,
hook-above and tilde must stay mutually distinguishable, and hook-above (a curl)
and tilde (a wave) are the pair that collapse first at low resolution.

**An earlier draft got this arithmetic wrong** and justified the design on the
easy case. It claimed the tone mark gets "4 × 6 half-cells", which describes the
750–1000 band — that is the *non-stacked* mark, and §2 does not even redraw most
of those. The case that motivated the whole design is worse:

| Scheme | Vertical budget for the **tone** on a stacked glyph |
| --- | --- |
| C (full grid) | 875–1000 = **1 full row** |
| A (sub-pixel) | 875–1000 = **2 sub-rows** |

And the budget is **forced**. 375 units sit above the letter, and Scheme A
spends them tone(2) + gap(1) + circumflex(2) + gap(1) with no slack: a third
sub-row for the tone can only come from deleting a gap, which is what keeps the
two marks from reading as one blob.

So the real question is whether acute / grave / hook-above / tilde stay mutually
distinct inside a band **one full pixel tall**. An acute across ~3 px of width in
2 sub-rows is roughly an 18° diagonal, which may simply read as a flat dash;
tilde-versus-hook in that band is genuinely doubtful. Nothing here is
self-evident, and "more cells" is not proof — the shapes have to be drawn and
looked at. That is why §6.7 puts hand-drawn bitmaps *before* any generator work,
and why Scheme C is tried first: if one crisp row can carry five distinguishable
tones, that beats two soft ones outright.

Note the trade runs both ways. Scheme A buys resolution and pays in antialiased
softness (§2.2); Scheme C buys crispness and pays in resolution. **Legibility of
the tone is the only tiebreak** — a soft but identifiable mark beats a crisp
ambiguous one, because the failure mode here is not "looks blurry", it is "reads
as a different word".

Acceptance is a native-render test with a Vietnamese reader, not a design
opinion — see §6.5.

---

## 5. Build pipeline and licence

- **Licence.** Silkscreen is OFL 1.1. The copyright line
  (`Copyright 2001 The Silkscreen Project Authors`) declares **no Reserved Font
  Name**, so a derivative is unrestricted in naming. Ship it as
  `HFMSilkscreen_400Regular` / `_700Bold`, set a distinct `name` ID 1/3/4/6,
  keep the OFL `name` IDs 13/14, and add a "derived from Silkscreen" line.
- **Append-only merge — the rule that protects the other six languages.** Take
  stock Silkscreen as the base and **copy the original `glyf`, `hmtx` and
  hinting records through unmodified**, appending only the new glyphs. In
  particular:
  - **New glyphs go at the END of glyph order. Never insert, never reorder.**
    `GPOS`, `GSUB` and `GDEF` reference glyphs by **ID**, and this spec requires
    those tables preserved byte-for-byte. Inserting a glyph anywhere but the end
    shifts every later ID while leaving those binaries unchanged, so the coverage
    tables would silently point at the wrong glyphs.

    §6.2's walk of glyph IDs 0–226 **is** the gate for this: any insertion or
    reorder below ID 227 moves an original glyph, and the walk then finds
    differing geometry at a matching ID and fails loudly. The rule exists so that
    gate never has to fire — not because nothing would catch it. (An earlier
    draft claimed every gate would still pass; that was true before the ID walk
    was added, and the two edits landed in the same revision without being
    reconciled.)
  - Treat `fpgm`, `prep`, `cvt `, `gasp`, `GPOS`, `GSUB` and `GDEF` as **opaque
    pass-through — never decompiled, never rewritten**. §6.2 asserts this; the
    pipeline has to actually do it, since a decompile-and-recompile round trip
    can differ byte-wise even when semantically identical.
  - **Never re-run `ttfautohint` or any whole-font re-export.** The face ships
    `fpgm`, `prep`, `cvt ` and `gasp` (measured), and a rebuild would perturb
    the original outlines and break §6.2 outright.
  - New glyphs ship **unhinted**. Accept that they may snap differently from the
    hinted bases at small ppem; that is a §6.5 acceptance question, not a
    licence to re-hint everything.
  - Leave `gasp` as found. Changing it to suppress gridfit would alter rendering
    for **all seven languages** — treat as nuclear, and only after an A/B.
  - Update `maxp.numGlyphs`, `loca`, `cmap` format 4 segments, `hmtx` (including
    the `hhea.numberOfHMetrics` long-metric run), `OS/2.xAvgCharWidth`, and —
    because the cmap now grows past Latin-1 — `OS/2.ulUnicodeRange*`. Rendering
    rarely reads the last one; OS font panels and subsetters do.
  - Assert `OS/2.usWinAscent`/`usWinDescent` and both `sTypo` values unchanged.
- **Precomposed only.** Ship all 102 codepoints as precomposed glyphs. Do **not**
  rely on `GPOS` `mark`/`mkmk` to compose Vietnamese stacks at runtime — §6.2
  records why that is impossible, not merely inadvisable.

  Consequently the catalogs must be **NFC-normalised**. Note what a decomposed
  `e + U+0302 + U+0301` actually does: it misses the precomposed glyph, but both
  its marks *are* in the cmap and the attachment machinery *is* present, so it
  renders **something** — through anchor data this project has never verified,
  plausibly stacking the second mark above the y=1000 clip bound on the
  Electron/Windows target. Silent wrongness, not a visible tofu box. Gated in
  §6.8, which is the only thing standing between the game and that path.
- **Tooling.** `fonttools`, pinned. Glyphs authored as rectangle contours from a
  coordinate table committed in the repo (`content/fonts/vi-marks.json` or
  similar) — the table is the source of truth, the TTF is a build artifact
  produced by `npm run build:fonts`. 102 glyphs decompose to ~12 hand-drawn
  primitives (5 tone marks + `ă â ê ô ơ ư đ` modifications) plus composition.
- **One runtime family, not two.** Migrate **all** locales to the derivative and
  drop `@expo-google-fonts/silkscreen` to a build-time input. Pointing only `vi`
  at the derivative would ship two Silkscreen lineages in the binary and let
  them drift.
- **Loader path — this breaks CI the moment `locales.ts` changes.**
  `faceFile()` (`src/i18n/glyph-coverage.ts:26-34`) maps a family name to
  `@expo-google-fonts/<name.toLowerCase()>/package.json` via `require.resolve`,
  so `HFMSilkscreen_400Regular` resolves to `@expo-google-fonts/hfmsilkscreen`
  and throws. It must learn `assets/fonts/` (which does not exist yet) **before**
  the face swap, or these fail together:
  - gates 5, 5b, **5c (the endonym gate)**, 8 and 8b in
    `src/i18n/__tests__/gates.test.ts`;
  - the every-locale separator test — `glyph-coverage.test.ts:54-61`.

  **Find them by gate name, not by line number.** Line numbers in this spec were
  accurate when written and have already drifted once.

  Resolve the asset the way `faceFile` already resolves packages — not from
  `process.cwd()`, whose worktree hazard is the reason that doc-comment exists.
- **Removals, enumerated** so the change cannot strand CI half-done:
  - `glyph-coverage.test.ts:42-52` asserts Handjet covers Vietnamese — retire it;
  - `App.tsx` loads `Handjet_*` at **eight** `useFonts` sites (lines 315–2827)
    plus the rationale comment near 2422;
  - `locales.ts:66-79` — the `HANDJET` constant and its comment;
  - `@expo-google-fonts/handjet` leaves `package.json`.
- **Licence file in the bundle.** Name-table IDs 13/14 are necessary but not
  sufficient: ship `assets/fonts/OFL.txt` beside the TTFs. In-app licence UI is
  optional on top of that.

---

## 6. Verification

1. **Glyph coverage gate.** Extend `src/i18n/__tests__/glyph-coverage.test.ts`
   so the `vi` face must cover all 134 codepoints; it currently only asserts
   Silkscreen's Latin-1 set. Must fail before the font lands and pass after.
2. **Non-regression gate.** For all 226 original codepoints, assert **equal
   glyph geometry, advance widths and left sidebearings** against stock
   Silkscreen.

   **"Contour point list" is not sufficient, because 48 of the 224 non-empty
   glyphs in the Regular cut are composites** (45 in Bold) — including much of
   Latin-1: `Á á ç ý` and friends. A composite has no contour points at all, so a
   reader that only handles simple glyphs either throws or, far worse, skips a
   fifth of the alphabet in silence. The gate must either flatten components to
   absolute points, or compare component records (component glyph index, dx/dy,
   flags, any scale) and rely on the referenced glyphs' own entries.

   **And geometry alone is not the whole regression surface.** Measured: every
   simple glyph in both cuts carries per-glyph hinting instructions (176/176
   Regular, 179/179 Bold), and the font ships `fpgm` 3596 B, `prep` 178 B,
   `cvt ` 82 B, `gasp` 8 B, `GPOS` 884/866 B, `GSUB` 334 B, `GDEF` 100 B. A merge
   that dropped any of those would pass a contours-plus-advances check and still
   change what appears on screen **for all seven languages**, because hints
   execute on the Electron/Windows target. That is precisely the regression class
   this gate exists to prevent, and §5's all-locale migration is what makes it
   load-bearing.

   **On GPOS specifically, the two reviewers disagreed and the measurement
   settles it.** One argued dropping GPOS would move spacing on iOS because
   CoreText applies GPOS kerning by default. Parsed from both cuts: GPOS carries
   exactly two features, **`mark` and `mkmk`** (lookup types 4 and 6). There is
   no `kern` feature and no `kern` table. So dropping GPOS would *not* change
   inter-letter advances for precomposed Latin text. What it would break is
   **combining-mark attachment** on any decomposed path — which is why it is
   preserved.

   **Runtime composition is not merely unwise, it is impossible.** The cmap maps
   seven combining marks — U+0300 grave, U+0301 acute, U+0302 circumflex,
   U+0303 tilde, U+0304 macron, U+0308 diaeresis, U+0327 cedilla — and does
   **not** map the four Vietnamese needs most: **U+0306 breve, U+0309 hook
   above, U+031B horn, U+0323 dot below**. So `mark`/`mkmk` could compose at most
   part of the repertoire and could never carry the language. The precomposed
   rule rests on capability, which is firmer ground than robustness.

   **The dangerous consequence runs the other way.** Because U+0300–0304 *are*
   mapped, a decomposed `e + U+0302 + U+0301` passes gate 5's `missingGlyphs`
   check **and** passes §6.8's own cmap clause — every character really is in
   the face. **Only the NFC assertion catches it.** The two clauses of §6.8 are
   therefore not redundant and the cmap one must never be treated as subsuming
   the normalisation one.

   So additionally assert that `fpgm`, `prep`, `cvt `, `gasp`, `GPOS`, `GSUB`
   and `GDEF` are **present and byte-identical**, plus the per-glyph instruction
   bytes of every original glyph. *Present* is not pedantry: a lenient
   implementation that writes "if both fonts have GPOS, compare them" passes the
   dropped-table case, which is the single case this assertion exists to catch.
   This does not contradict the anti-byte-diff reasoning below: that reasoning
   applies to tables fonttools *recompiles*. These are copied through opaque, so
   byte identity is exactly the right assertion for them — and it is honest in
   the passing direction too, since fonttools writes back tables it never
   accesses unchanged.

   **Walk glyph IDs 0–226 directly**, in addition to the per-codepoint
   advance/LSB comparison. The font has 227 glyphs and 226 mapped codepoints, so
   a codepoint-only walk cannot see the unmapped glyph — and if any composite
   referenced it, an edit to its outline would slip past a component-record
   comparison. Walking IDs closes that without needing to know which branch of
   composite handling was chosen.

   Deliberately *not* a whole-file byte or `ttx` comparison:
   fonttools recompiles every table on save, so repeat-flag packing, table
   padding and `head.checkSumAdjustment` can differ byte-wise while the geometry
   round-trips exactly. A byte diff fails spuriously; a coordinates-plus-`hmtx`
   diff cannot. The repo has cmap and hmtx parsers already; this needs a small
   `glyf` reader added to `glyph-coverage.ts`.

   This gate is load-bearing **because §5 moves every locale to the
   derivative** — the six Latin languages render from it too. Had `vi` alone
   been repointed, the others would have been protected structurally by still
   loading stock Silkscreen, and this gate would only have covered English
   fallback strings and the shared measured column constants.
3. **Metric gate.** Assert `hhea.ascender` = 1030, `hhea.descender` = −250,
   `OS/2.usWinAscent` = 1000, `usWinDescent` = 250, both `sTypo` values, and
   that every new glyph satisfies **−250 ≤ `yMin`** and **`yMax` ≤ 1000**. The
   floor is as load-bearing as the ceiling: `Ç ç` already sit on it, and dot-below
   is drawn into that band. Confirm the fonttools save path does not recalculate
   these (it does not by default; `recalcBBoxes` touches only `glyf`/`head`).
4. **Advance-table regeneration.** Re-derive the `vi` entries behind
   `advance.ts` / `league-table-columns.ts` from the new TTF and re-run the
   column-width gate (8b) — the one that measures the **bold** cut. Additionally
   assert `advance(ơ) ∈ { advance(o), advance(o) + 125 }` and the same for every
   toned horned form, so §3's outcome is recorded rather than assumed.
> **§6.5 SIGNED OFF (2026-08-07).** The owner, who reads Vietnamese, ran the
> built font on a real device and confirmed it renders correctly. That releases
> the last hold on this work: `vi` is in `ENABLED_LOCALES`, and it is now in
> `AUTO_LOCALES` too, so a Vietnamese phone opens the game in Vietnamese.
>
> What that sign-off does and does not cover: it is a reader confirming the
> letters are right on hardware, which is the question this gate was written to
> answer. It is not a sweep of every screen at every type size and density —
> §6.6's small-body-text case and the @3x/@2x comparison were never run
> side by side. Those remain worth doing, but they are polish now, not a gate.

5. **Tone legibility — the gate that matters.** Render `má mà mả mã mạ`,
   `ế ề ể ễ ệ` and `ớ ờ ở ỡ ợ` at the app's smallest shipped size and at the
   largest Dynamic Type multiplier the league/register headers already plan for
   (~1.6×). A native reader must name the tone from a 1:1 screenshot. Native,
   not web: the browser pane forces phone layout and is not a trustworthy render
   surface.

   Screenshot **both voices**, `display` (Bold) and `data` (Regular) — for the
   reasons in §6.7.

   **Test @2x, not only @3x.** Joe's phone is @3x, which is the *easy* case; the
   marginal one is an iPhone SE class @2x, where `text-xs` (10.5 pt) gives 21
   device px per em and a Scheme A sub-row is ~1.31 device px. A simulator
   screenshot is fine for geometry.
6. **Rasterisation gate (§2.2) — with a pass criterion, not just a log.**
   Record the device-pixel size of one em at every type size the app really
   uses, flag the integer-ppem ones (that is where Scheme A is softest), and
   require **em/16 ≥ ~1 device px at the smallest shipped type size on the
   lowest supported density**. Note em/**16**, not em/8 — a sub-row is half a
   design pixel. And the smallest shipped prose is **8 pt**, not `text-xs`:
   `text-[8px]`, `text-[9px]`, `fontSize: 8` and `fontSize: 9` all appear in
   shipped screens. Below that a sub-row is not a soft mark, it is a
   low-contrast smear.
7. **Bitmap mockups before any TTF exists (design gate).** Draw Scheme C and
   Scheme A by hand as bitmaps and sign off before writing a generator. This is
   what stops a week of font engineering landing on an unreadable tone set. The
   checklist:
   - **both cuts, Regular and Bold** — not Regular alone. `display` is Bold and
     it is the voice on every heading, button, label and table header, so small
     bold toned text certainly exists. Bold `o` ink is 625 units wide against
     Regular's 500, which moves mark centering and the §3 horn relationship, and
     heavier bases make a mark that held its own in Regular disappear. A tone set
     proven only over Regular letterforms can fail over Bold ones. The repo has
     already been bitten here once: `src/ui/league-table-columns.ts` records a
     hand-measured table going wrong on exactly this distinction, which is why
     gate 8b measures the bold cut;
   - the five tones on `a` and on `ê` (the stacked case) under both schemes;
   - circumflex versus breve — they must not converge;
   - **mark-to-mark separation under Scheme C**, whose two bands touch at y=875
     with no gap (§2). Judge whether the pair reads as two marks or one blob;
   - **`ê` beside `ế`**, deliberately rather than incidentally: under both
     schemes the circumflex changes shape between the untoned and toned form of
     the same base letter, and a reader has to accept both as the same letter;
   - the horned set `ớ ờ ở ỡ ợ` with the horn in the existing sidebearing,
     and a rendered word such as `ơn` to judge the 1 px ink gap of §3 (a′).

   **How the mockups are judged decides whether this gate works at all.** A
   hand-drawn bitmap inspected at design-grid zoom is always legible, and the
   flattery is *asymmetric*: a crisp zoomed Scheme C mockup is faithful to what
   an integer-ppem screen really shows, while a crisp zoomed Scheme A mockup
   hides precisely the antialiased softness §2.2 documents. Judged that way the
   comparison is biased toward A, and a doomed A walks through the gate that
   exists to stop it. So:
   - resample every mockup to the **real target scales and view it 1:1** — at
     minimum 21 px/em (@2x `text-xs`, §6.5's marginal case), 72 px/em (the
     integer-ppem heading case), and one mid non-integer size;
   - downscale Scheme A the way the rasteriser would, so its softness is visible
     in the comparison rather than after the font is built;
   - **put a Vietnamese reader at this gate**, not only at §6.5. Failing that,
     compare side by side against a known-good Vietnamese pixel face. A
     wrong-shaped hook-above that a non-reader waves through at mockup stage
     costs exactly the week this gate is meant to save.
8. **NFC gate.** Assert every string in `loadCatalog('vi')`, plus the endonym
   `Tiếng Việt`, is NFC-normalised and that every character it contains is in
   the face's cmap.
9. **New-glyph round trip — the only gate covering most of the new glyphs.**
   Flatten every new glyph out of the built TTF and assert its outline matches
   its source coordinates in the §5 table (`content/fonts/vi-marks.json`).

   This exists because of a coverage hole the other gates leave open. §6.1 checks
   that a glyph *exists*, gate 5 checks *coverage*, §6.2 checks only the
   **original** 226 — and §6.5's human reader only ever sees the ~15 lowercase
   letters in its three word sets. For the other ~87 new glyphs, including every
   uppercase toned form, **no gate in this document renders them at all**. A
   generator bug handing `Ẩ` the tilde belonging to `Ẫ` would pass every check
   here and first appear on a player's screen. Roughly twenty lines against a
   coordinate table that has to exist anyway.
10. **Optional machine triage.** Rasterise via FreeType at ppem 10/12/14/24 and
    diff, to catch gross breakage before spending device time. The human tone
    test stays the final word.

---

## 7. Fallback if §4 fails

If five tones cannot be made distinguishable at the smallest shipped type size:
keep **the pixel derivative** for `display` and use a legible non-pixel face for
`data` and `body` in `vi` only. Note the wording — after §5 the runtime pixel
face is `HFMSilkscreen`, so this fallback must **not** reintroduce
`@expo-google-fonts/silkscreen` (or Handjet) as a runtime path; the derivative
still draws the display voice, it simply is not asked to draw tone-marked prose.

That is strictly better than today, and it confines the compromise to the voice
where reading accuracy beats character.

Cutting Vietnamese entirely remains available and should be named explicitly as
an option rather than drifting into it.

---

## 8. Explicitly out of scope

This spec covers **rendering only**. It does not address the separate and much
larger finding that **2,033 player-facing strings across 137 files are still
hardcoded English** — including all of Bert's dialogue and 9 of 13
`content/*.json` files — which affects all six non-English locales equally.

That number has a source: it is what `src/i18n/__tests__/no-hardcoded-prose.test.ts`
reports after being widened. It previously reported **zero**, which is why the
extraction was believed complete — it counted only bare JSX text and
`accessibility{Label,Hint}`, so it could not see `title=`/`label=` props, any
`.ts` file, or any template literal. `src/application/view-models.ts` builds 245
player-facing sentences and scored zero. The gate is now a ratchet over the real
number and returns to a hard zero when the sweep finishes.

**This makes the font work more valuable, not less.** Today, choosing `vi`
swaps the entire UI — overwhelmingly still English — into Handjet, so the
current behaviour is the worst case available. Under this plan an untranslated
Vietnamese screen is pixel-identical to the English one except where a
translation actually exists. The font fix pays off *most* while translation is
incomplete. The two workstreams are independent and can run in parallel.

---

## 9. Review status

Reviewed independently by **Grok 4.5** (high effort, two rounds) and **Claude
Fable 5** (xhigh effort), the latter re-parsing both TTFs with its own parser
before reviewing. They converged on the same two blockers.

**The alternative both were asked to weigh — raising `hhea.ascender` by 2 px so
stacked marks fit the full grid — is worse than the first draft admitted.** It
would also require raising `OS/2.usWinAscent`, i.e. changing declared metrics on
every platform, and the line-box cost is +250 on 1280 = **+19.5%** (not the
+21% first claimed) across all seven languages. Order of preference stays:
Scheme C → Scheme A → §7 fallback → never "raise the ascender for everyone".

**Round 1 (Grok) — REVISE.** Five must-fixes, all applied:

1. **Blocking:** `glyf` coordinates are integer FUnits, so the original
   62.5-unit half-grid was not implementable — it would have failed at the first
   `fonttools` compile. §2 now specifies an integer row table and puts a
   full-grid scheme first in the order of proof.
2. Horn economics were overstated: `o` already carries 125 units of right
   sidebearing, so a 1 px horn needs no advance change. §3 reordered, and the
   horn-plus-tone composites it missed are now named.
3. The §2.2 rasterisation argument was half true and is withdrawn — at
   `fontSize: 24` @3x the grid *is* integer, so sub-pixel marks are softest
   exactly on large headings.
4. Append-only merge, no re-hinting, `gasp` left alone, NFC requirement, and the
   `faceFile()` / `useFonts` / all-locale loader path added to §5.
5. §6.2 restated as per-codepoint contours + advances + sidebearings rather than
   file-level byte identity.

Also corrected: the claim that Silkscreen has no descender ink. `q` and `,`
reach −125 and `Ç ç` reach −250, the full declared descender.

**Round 2 (Grok) — REVISE, one blocker.** Scheme A's row table contradicted its
own ink rule: the tone got a single 62-unit sub-row while the base mark got a
full 125, and 625–688 was left orphaned. Since the tone is the mark that carries
meaning, that inverted the priority. §2's table is now the balanced stack.
Also applied from that round: the horn set is 24 (the draft's own "4 + 10 = 12"
did not even add up), `assets/fonts/OFL.txt` beside the TTFs,
`OS/2.ulUnicodeRange*` and `hhea.numberOfHMetrics` in the append checklist.

**Round 1 (Fable) — REVISE, two blockers, both already covered above** (integer
FUnits; `faceFile()` breaking four gates), plus four findings unique to it, all
applied:

- §4 justified the design on the **wrong case** — "4 × 6 half-cells" describes
  the non-stacked band, while the stacked tone gets 2 sub-rows and the budget
  has no slack. This was the sharpest catch in either review.
- `OS/2.usWinAscent` = 1000 is the *real* ceiling, and the Steam build is
  Electron/Chromium, which honours usWin metrics. §2's conclusion holds for a
  stronger reason than it stated.
- @2x is the marginal density, not @3x; §6.6 now carries a numeric pass
  criterion instead of "log it".
- Exact line numbers for every gate and load site that breaks on the face swap.

Fable also verified, against its own parse: §1's core table, §1.1's inventory
arithmetic (134 / 32 / 102 and the 32-24-8-38 split), the licence reasoning, and
— by grepping for Skia text rendering and explicit `lineHeight` sites — that
nothing in the app depends on ink extents rather than declared metrics, so §2's
"zero layout change" is true.

**Round 2 (Fable) — REVISE, one substantive.** §6.2 was a gesture, not a gate.
Verified against the TTFs after it said so: **48 of 224 non-empty glyphs in the
Regular cut are composites** (45 in Bold), including much of Latin-1, so
"contour point lists" was unimplementable for a fifth of the alphabet; and
**every simple glyph carries per-glyph hinting instructions** (176/176, 179/179)
alongside `fpgm` 3596 B, `GPOS` 884/866 B and the rest. A merge that dropped all
of that would have passed the gate and still changed rendering in every
language. §6.2 now covers composites explicitly and asserts byte identity on the
pass-through tables. Also applied: Scheme C's mark bands **touch** at y=875 with
no gap — named as its third risk and added to the §6.7 checklist along with an
`ê`/`ế` consistency check; and §3 (a′) overstated its own cost, since the
neighbour's left sidebearing still yields a 1 px ink gap.

Fable additionally verified, by its own parse, that Silkscreen really does hold
180 off-lattice points in Regular and 80 in Bold — so §2's claim that sub-pixel
geometry breaks no existing invariant is measured, not assumed — and that the
`vi` withdrawal leaves a persisted save working (`preferences-repository.ts`
validates against `LOCALES`, not `ENABLED_LOCALES`; `load-catalogs.ts` bundles
`vi.json` regardless). It caught two consequences of that withdrawal which are
fixed in code rather than in this document: `cycleLanguage` ejected a `vi` user
to English through `-1` index arithmetic, and `scripts/merge-i18n-staging.js`
could have written an ungated catalog.

**Still open, and deliberately not pre-decided:**

- Is Scheme C viable, or is the ordering in §2 wishful and Scheme A inevitable?
  Unknown until the §6.7 bitmaps. Do not pre-commit.
- Does horn-in-sidebearing survive a rendered word, or does `ơn` merge? Device
  test only.
