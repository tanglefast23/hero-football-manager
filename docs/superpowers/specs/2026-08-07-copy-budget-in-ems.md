# Copy budget in ems, not characters — design

Date: 2026-08-07
Status: **REJECTED — §4 is not to be built.** Reviewed by Grok 4.5, 2026-08-07.
Kept as the record of why, and for the analysis in §1–§3, §5, §6.1 and §7, which
survive the rejection. **Read §10 first.**

The proposal was: replace the character-count copy budget with one measured in
**em width against the face the string is actually drawn in**, so the gate stops
using a proxy for a question it can answer directly.

---

## 1. What the budget is, and the two jobs it was doing

`gate 3` asserts every translation is under a ceiling derived from its English
source. It has always been two rules wearing one number:

1. **A copy rule.** The owner's instruction is "simple and succinct, always". A
   character count is a fine instrument for that — it is arbitrary, but so is
   the rule, and arbitrary is acceptable for style.
2. **A fitting rule.** A pixel word inside a bordered chip cannot reflow. Here a
   character count is a genuinely poor instrument, and the original spec says so
   in as many words: *"Silkscreen is proportional, so character count is a poor
   proxy for pixel width."*

Job 2 is the one this document is about.

## 2. What just happened, and why it is the motivating evidence

The budget was recently split into three classes (`src/i18n/copy-budget.ts`):

- **spoken** (`*.a11y.*`) — read aloud, no width, effectively unbounded.
- **prose** — wraps freely, generous.
- **boxed** — cannot reflow, tighter.

The **spoken** split fixed a real harm: screen-reader labels had been shortened
for a width constraint that does not exist, and they are the largest group that
had been sitting near the old ceiling.

The **boxed** tightening was a mistake and has already been reverted. It cost,
in a single pass across three languages:

| Language | Was | Became | Collateral |
| --- | --- | --- | --- |
| de | `Einstellungen` | `Optionen` | 9 other strings still say Einstellungen |
| es | `Campo de Entrenamiento` | `Campo de Entreno` | 5 others unchanged |
| fr | `Notoriété` | `renommée` | contradicts its own glossary entry |

**Vocabulary drift across a catalog is a worse defect than a label that might be
a few pixels wide** — and it was certain, where the overflow was hypothetical.
No one had measured a container overflowing. The looser rule had been shipping
those strings and device screenshots looked correct.

That is the lesson this change has to respect: **do not tighten without a
measured overflow to point at.**

## 3. Measured: how much better is an em?

Parsed from `HFMSilkscreen_700Bold` via the existing `advanceEm`:

| English → translation | chars | ems |
| --- | --- | --- |
| `Fan Shop` → `Loja do Clube` | +63% | **+55%** |
| `Fan Shop` → `Tienda del Club` | +88% | **+74%** |
| `Fan Shop` → `Boutique du Club` | +100% | **+89%** |

**An em is roughly ten percentage points kinder than a character, and no more.**

This matters because the change was originally pitched — by me — as likely to
"dissolve a good share" of the over-budget strings. **That claim was wrong.**
`Boutique du Club` really is nearly twice as wide as `Fan Shop`; no change of
unit rescues it. Anyone reading this should weigh the proposal on truthfulness,
not on an expected pile of freed-up strings.

## 4. Proposal

### 4.1 Measure the string in the face it is drawn in

`voiceOf(key)` already resolves display / data / body, and `faceForKey` already
turns that into a family name. `advanceEm(text, family)` already returns em
width. The gate for a **boxed** key becomes:

```
advanceEm(translation, faceForKey(key)) <= advanceEm(english, face) * factor + slack
```

`prose` and `spoken` keep character budgets. Prose is drawn in the platform
sans, whose metrics are not knowable from this repo, and a spoken string has no
width at all — measuring either in ems of a pixel face would be theatre.

### 4.2 Keep the coined-term floor, in ems

A term the glossary *requires* cannot also be forbidden by width. Already true
in characters; port it, taking the em width of the shortest allowed form.

### 4.3 `factor` starts where the shipping rule effectively sat

**Not tighter.** Calibrate so that every string currently in the catalogs
passes, then leave it. The gate's job on day one is to be a truthful instrument,
not to find new work. Any future tightening is a separate decision with its own
evidence.

### 4.4 Re-check the shortening pass

~340 strings were shortened under the over-tight rule (pt-BR, id and vi are
already merged; es, fr and de are staged but **not** merged). Recheck each
against the em rule. Where the original was within budget, prefer it — most
importantly wherever shortening broke vocabulary consistency with the rest of
the catalog.

## 5. What this does NOT solve, stated plainly

**We still do not know how wide the boxes are.** An em budget compares a
translation to its English source, not to its container. It answers "is this
much wider than the string the box was designed for" — which is a better
question than the character one, and still not the real question.

The real question needs a container width per key. Only gates 8 and 8b have
that, for table columns, from hand-measured constants. Extending that to every
button and chip means either a layout harness or annotating keys with their
container, and neither is in scope here.

So this change buys **honesty about the comparison**, not certainty about
fitting. It should be sold as no more than that.

## 6. Alternatives considered

| Option | Why not (or not yet) |
| --- | --- |
| **Raise the character number** | Legitimate, and simpler. Rejected only because it keeps a unit we know is wrong while making it looser — the gate would be less likely to fire *and* still uninformative when it did. |
| **Shrink the type to fit** (`adjustsFontSizeToFit`) | Standard i18n practice, wrong for a 1-bit bitmap face: a non-integer scale puts every stem between device pixels and greys the glyph. The codebase already met this and chose a different lever — `CharacterCreationScreen` switched a cell to the *narrower cut* rather than shrink it, and records why. |
| **Add shorter approved forms to the glossaries** | Not an alternative — a complement, and an owner decision. `Tienda` for `Tienda del Club` may be perfectly good; that is a call about the game's voice, not about pixels. |
| **Measure real container widths** | The correct end state — and it already exists in this repo for 7 labels. See §6.1. |

### 6.1 The precedent this document may be ignoring

`src/ui/squad-register-columns.ts` does the honest version already. For each
register header it holds a real column width in points, a real per-word em
advance measured out of `hmtx`, the real font size, and a cap on how far iOS
text scaling may grow it — then `squad-register-columns.test.ts` re-runs the
arithmetic so a width cannot quietly stop fitting. It proves a **fit**, not a
ratio.

That is a strictly better instrument than anything in §4, and it is already
written. The honest question this document has to answer is not "chars or ems"
but **why the answer is not "extend that pattern to the boxed surfaces that
actually overflow, and leave the global budget alone as the style rule it is
good at being."**

The counter-argument is cost: gate 8 covers 7 labels against 7 hand-derived
widths. There are on the order of 2,000 boxed keys. Whether the pattern
generalises — or whether only a couple of dozen surfaces are tight enough to be
worth hand-deriving — is unmeasured, and measuring it is probably the real first
step.

## 7. Risks

1. **`advance.ts` imports `fs`.** It is a CI/test tool and its header says it
   must never be imported by app code. `copy-budget.ts` is currently exported
   from `src/i18n/index.ts` and is therefore reachable at runtime. The em logic
   must live on the test side of that line, or the export must go.
2. **Face resolution must match the gate's own.** Gate 5 already uses
   `faceForKey` for glyph coverage. If the budget resolves a face differently
   the two gates disagree about what a string is, which is the class of bug this
   whole workstream keeps producing.
3. **A miscalibrated `factor` reintroduces §2.** The calibration step is not
   optional and its output should be recorded in the file.
4. **Interpolated strings.** `{count}` is not what gets drawn. The em width of a
   template is a fiction; the gate should measure the template consistently for
   both sides rather than pretend otherwise, and say so.
5. **The catalog string is not the drawn string.** This is the one that could
   make the whole change actively misleading, and it was missed on the first
   pass. A large share of boxed copy is typed in title case and **uppercased by
   the stylesheet** — `uppercase` appears on pixel text throughout `src/ui`
   (`ManagementShell`, `TrainingDrillModal`, `FacilityPlacementConfirmation`,
   `CoachStaffOverlay`, `PostMatchSummaryModal`, `FacilityProjectNotice`,
   `TutorialTapCue`, …), plus a `textTransform: 'uppercase'` in
   `CharacterSpeechOverlay`. `squad-register-columns.ts` says so in as many
   words: *"the labels are typed in title case and uppercased by the stylesheet;
   what is measured here is what is drawn."*

   **The case half of this was wrong, and the correction matters.** I asserted
   Silkscreen's uppercase is wider than its lowercase. It is not: measured
   across `a`–`z` against `A`–`Z` in `HFMSilkscreen_700Bold`, **every pair has
   an identical advance** — zero differences. `advanceEm('Fan Shop')` and
   `advanceEm('FAN SHOP')` are both 6.625em. The per-letter widths quoted above
   (1.0em for `M`/`N`/`V`, 0.75em for `E`) are real, but they apply to the
   letter, not to its case. Uppercasing a Silkscreen string never changes its
   width, so `uppercase` in the stylesheet cannot make a measurement wrong.

   Gate 8b's `advanceEm(label.toUpperCase())` is still the right habit — measure
   what is drawn — but it is habit, not a load-bearing correction.

   **The letter-spacing half is real and survives.** `tracking-wide` /
   `tracking-widest` ride on pixel labels (`FacilityProjectNotice`, among
   others) and are not in the font metrics at all: they add roughly
   `(n − 1) × spacing`, so a longer translation pays more absolute tracking than
   the English it is compared against. A bare em ratio cannot see that.

   So the surviving form of this risk is narrower than stated but still fatal
   to §4: an honest em rule must resolve **letter-spacing, font size, the text-
   scale cap and any face override per key**, which means knowing which
   component draws it — the same per-key knowledge §5 says we do not have for
   container widths.

## 8. Verification

1. Calibrate `factor` against the current catalogs; record the number and the
   tightest surviving string in `copy-budget.ts`.
2. Gate 3 green across all seven locales with **no** translation edits — if any
   string has to change to make the new gate pass, the factor is wrong.
3. A test that the budget and gate 5 resolve the same face for a sample of keys
   in all three voices.
4. Re-run the shortening comparison and report how many of the ~340 cuts were
   unnecessary under the em rule. That number is the honest measure of what this
   change was worth.

## 9. Questions for the reviewer

1. Is an em budget against the **English source** worth building at all, given
   §5 — or is the character rule plus the coined-term floor good enough until
   real container widths exist?
2. Is `factor` calibrated-to-current the right starting point, or does that
   simply enshrine whatever the catalogs happen to contain today?
3. §7.1: keep `copy-budget.ts` runtime-safe and move em logic into the gate, or
   drop the runtime export? Is there a reason app code would ever want a budget?
4. Interpolated strings (§7.4) — measure the raw template, substitute a
   representative value, or exclude them from the em rule?
5. §7.5 and §6.1 together: if an em rule needs per-key knowledge of case and
   letter-spacing, and having per-key component knowledge would also unlock real
   container widths, is the comparative rule in §4 just a worse version of the
   gate-8 pattern — and should this document be replaced by "measure which boxed
   surfaces are actually tight, then extend gate 8 to those"?
6. Is there a better idea than either? Something cheaper or more reliable than
   both a comparative budget and hand-derived widths.

---

## 10. Outcome — rejected, and what replaces it

Audited by Grok 4.5 (read-only, high effort) on 2026-08-07. **Verdict: do not
implement §4.** The reviewer read the code rather than the document, and every
load-bearing number it returned was re-measured here and confirmed:

| Its claim | Re-measured |
| --- | --- |
| Uppercase does not change Silkscreen advances | **Confirmed** — 0 differences across `a`–`z` vs `A`–`Z`. My §7.5 was wrong. |
| `boxed` is 1,839 of 2,282 chrome keys | **Confirmed exactly.** |
| 489 boxed keys carry an interpolation | **Confirmed exactly.** |
| Em is ~10pp kinder than chars | **Confirmed** — +54.7/+73.6/+88.7% vs +62.5/+87.5/+100%. |
| `copyBudget` has no runtime consumer; only tests import it | **Confirmed.** |

### Why it was rejected

The document refutes itself and the reviewer simply followed the argument to its
end. §3: ems free almost nothing. §5: still no container widths. §6.1: an
instrument that proves an actual fit already exists. §7.5: an honest em rule
needs per-key component knowledge — **the same knowledge that would unlock real
container widths**. So §4 pays gate 8's information cost to buy a weaker
assertion: a ratio to English instead of a fit in a box.

Two harms it named that the document had not:

1. **False confidence.** A green gate called an "em budget" reads as "it fits in
   the chip". It does not, and it never could. The character rule at least has a
   comment admitting it is a poor proxy.
2. **Wrong population.** `budgetClass === 'boxed'` does not mean "in a fixed
   box" — it is the default class, covering 1,839 keys, most of them in flexible
   or multi-line layouts. Applying fit logic to all of them is a category error.
   The genuinely fixed surfaces are dozens, not thousands.

### What to do instead

**Keep the two jobs in two instruments, and stop trying to merge them.**

1. **Style stays in characters.** Gate 3 as it now stands — the three classes,
   the per-language expansion, the coined-term floor. It is a copy rule and
   characters are an acceptable unit for a copy rule. Do not tighten `boxed`
   without a measured overflow (§2).
2. **Fit is proven only where the box is known.** Extend the
   `squad-register-columns.ts` + gate 8/8b pattern — real container width in
   points, measured `advanceEm`, real font size, the text-scale cap, plus
   letter-spacing and chrome — and scope it to **surfaces, not keys**.
3. **Inventory before building.** List the UI that is genuinely fixed-width,
   single-line, pixel-faced and cannot reflow. Skip anything flexible,
   multi-line, or deliberately using `adjustsFontSizeToFit`. If that inventory
   comes back nearly empty, that is the answer and no new gate is needed.
4. **When a surface really is tight, reach for the container first.** Widen or
   flex it; then agree a shorter approved glossary form (an owner call about
   voice); then a surface-specific fit gate. Shortening a translation is the
   last lever, and only for that surface's keys — never a catalog-wide squeeze.
   §2 is what a catalog-wide squeeze costs.

### Done under this decision

- Boxed budget left at the shipping rule (reverted before the audit).
- Vocabulary consistency restored without ems, using the character rule and
  cross-catalog comparison: 13 strings across vi, id, pt-BR, es and de. Full
  detail in the commit; the pt-BR gym is the representative case — it was called
  `Ginásio`, `Academia` and `Gym` in three strings for one building, and in
  Brazilian Portuguese a *ginásio* is an indoor arena, so `Academia` won.
- `Fame` added to all six glossaries, so gate 9 now prevents the specific drift
  that had to be fixed by hand here.
