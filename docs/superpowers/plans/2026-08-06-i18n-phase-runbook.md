# i18n Phase Runbook — the durable task list

**Read this first if context was compacted.** It is the single source of truth
for what is done, what is next, and the exact commands.

## Ground rules

- One branch per phase. Finish → full suite → commit → push → PR → branch for
  the next phase off the merged/current HEAD.
- **Never lower a gate to make it pass.** The gates encode findings from two
  council reviews; a failing gate means the work is wrong, not the gate.
- `npx jest` takes ~6–12 min. Run it **in the background** and keep working.
- `npx tsc --noEmit` is fast — run it after every edit batch.

## State

| Phase | Branch | PR | State |
| --- | --- | --- | --- |
| 0–1 engineering | `claude/multilingual-copy-translation-bbe9c8` | #94 | **merged** (`1593b9d`) |
| 1.5 content keys | `claude/multilingual-copy-phase-2` | #96 | **merged** (`749949a`) |
| 2 Spanish | `claude/i18n-phase-2-spanish` | #97 | **merged** (`034f417`) |
| 3 Vietnamese | `claude/i18n-phase-3-vietnamese` | #98 | **superseded — close it** |
| 4 pt-BR/fr/id/de | `claude/i18n-phase-4-remaining` | #99 | **merged** (`aed2bc7`) |
| 5 long tail | `claude/i18n-phase-5-long-tail` | #100 | **content complete** |

**#98 must be CLOSED, not merged.** #99 was stacked on it and squash-merged, so
every commit #98 carries is already in `main`. `git diff main #98` is deletions
only: merging it would roll back four locales.

## The invariant that matters most

`ENABLED_LOCALES` in `src/i18n/locales.ts` gates every quality check AND the
picker. Widening it is the LAST step of a phase, after that locale's strings
exist and pass. Widening it early turns every gate red at once.

## Phase 2 — Spanish (done)

1. **Column short forms + advances.** Hard blocker on any non-English locale.
   - `col.*` keys for the league table (`# P W D L GD PTS`) and squad register.
   - Extend `LEAGUE_HEADER_ADVANCE_EM` / `LEAGUE_CELL_ADVANCE_EM` in
     `src/ui/league-table-columns.ts` and the squad-register equivalent, using
     advances measured from the real TTF.
   - Recompute `LEAGUE_COLUMN_WIDTH` as the **max across all seven locales**,
     computed up front — not per locale, or enabling German later silently
     widens the English table months after the change that caused it.
   - Gate: every `col.*` fits its column AND the whole row fits the narrowest
     screen (fixed widths + padding + gutters + min flexible column).
2. **Coined-term glossary** — `content/i18n/glossary/es.json`, ~20 terms
   (Heat, the Zone, Hero License, Awakening, Training Points, Fan Shop, Buzz).
   Scope is coined terms ONLY; ordinary football words stay advisory, because a
   substring check on them false-positives on Spanish inflection.
3. **Translate `content/i18n/es.json`** — every key in `en.json`.
4. **Translate content prose** — the `contentStrings()` key space (events, tips,
   glossary, player requests) into `es.json` too.
5. **Enable `es`** in `ENABLED_LOCALES`, run everything, fix what the gates say.
6. Commit → PR → branch Phase 3.

### Voice rules (spec §1) — these outrank literal fidelity

| Locale | Address | Notes |
| --- | --- | --- |
| `es` | `tú` | Neutral Latin-American. No `vosotros`, no `usted` |
| `pt-BR` | `você` | Brazilian. Never `tu` |
| `fr` | `tu` | `on` for "we" |
| `de` | `du` | Never `Sie`. Break compounds |
| `id` | `kamu` | Colloquial. Never `Anda` |
| `vi` | neutral | No `quý khách`, no `xin vui lòng` |

Casual, spoken, short. Where a faithful translation busts the character budget,
**rewrite shorter in the target language** — never translate literally and let
it sprawl.

## Phase 3 — Vietnamese (done)

Same steps as Phase 2. Third, not last, because it is the one that can fail on
font grounds.

**What is different for `vi`:**
- It renders in **Handjet**, not Silkscreen. Gate 5 checks each locale against
  its OWN face, so a glyph Silkscreen lacks is fine here and a glyph Handjet
  lacks is a failure.
- Handjet has different advances, so gate 8 measures `col.*` against Handjet.
  If a Vietnamese header does not fit, the fix is a shorter short-form, not a
  wider column — widening is a max across locales and would widen English too.
- Vietnamese has no plural marking (`pluralRule: 'none'`), so `.one` / `.other`
  siblings both take `.other`. Write one form.
- Expansion budget is 1.15, the tightest of the six.

**Column short forms** (`col.league.*`): `#`, `ST` (số trận), `T` (thắng),
`H` (hòa), `B` (bại), `HS` (hiệu số), `Đ` (điểm).

## Phase 4 — pt-BR, fr, id, then **de last** (done)

German last: longest language (1.30 budget), surfaces any remaining layout
ceilings.

**Per locale:** glossary → `col.*` short forms → translate all keys → add to
`ENABLED_LOCALES` → run gates → fix what they say.

**Column short forms:**
- `pt-BR`: `#`, `J`, `V`, `E`, `D`, `SG`, `PTS`
- `fr`: `#`, `J`, `G`, `N`, `P`, `DB`, `PTS`
- `id`: `#`, `M`, `M`→use `MN`, `S`, `K`, `SG`, `PTS`
- `de`: `#`, `SP`, `S`, `U`, `N`, `TD`, `PKT`

**Plural rules already encoded** in `locales.ts`: `pt-BR` and `fr` put ZERO in
the singular; `es` and `de` do not; `id` and `vi` have no plural marking.

## Phase 5 — long tail (content complete)

**606 content-prose keys** (50 events, 19 tips, 62 glossary entries, 32 player
requests) × 6 languages = 3,636 strings. All of them are translated: gate 10
reports **100% for every locale**.

Because the floors are all at 100, gate 10 changed job. It no longer measures
progress; it guards completeness. Adding an event, a tip or a glossary entry now
fails the gate until all six languages have it, so English cannot leak back in.

**Also landed in this phase, outside the original scope:** the squad register's
column headers (`Pos`, `Name`/`Player`, `OVR`/`Score`, `POT`/`Potential`,
`Cond`/`Condition`) were typed English literals in `SquadTrainingScreen`. They
are `col.squad.*` keys now, with gate 8b measuring each translation against the
fixed column it has to fit — in the **bold** cut, since the register draws its
headers bold and the regular face understates every label by about a sixth.

**What is still owed:** device QA. No language has been looked at on a phone.

**The trap this phase already sprang:** gates that MEASURE a translation
(budget, placeholders, terminology) must use `englishAll()` — chrome plus
content. Using chrome-only silently measures every content translation against
an empty string, collapsing the budget to 2 characters. Key parity deliberately
uses chrome-only, because content falls back by design.

## Commands

```bash
npx tsc --noEmit                      # fast, after every batch
npx jest src/i18n                     # the gates, ~10s
npx jest                              # full suite, background it
node scripts/i18n/prose-report.mjs    # any hardcoded copy left
```

## Gate reference

`src/i18n/__tests__/gates.test.ts` — key parity, character budget, placeholder
parity, glyph coverage (per voice + formatter output + endonyms), no-fragment,
labelKey resolves.
`no-hardcoded-prose.test.ts` — AST check, ceiling is 0.
`no-literal-faces.test.ts` — no file hardcodes a font family.
