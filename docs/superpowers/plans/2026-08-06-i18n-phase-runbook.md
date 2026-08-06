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
| 1.5 content keys | `claude/multilingual-copy-phase-2` | #96 | **open** |
| 2 Spanish | `claude/i18n-phase-2-spanish` | — | **in progress** |
| 3 Vietnamese | `claude/i18n-phase-3-vietnamese` | — | not started |
| 4 pt-BR/fr/id/de | `claude/i18n-phase-4-remaining` | — | not started |
| 5 long tail | `claude/i18n-phase-5-long-tail` | — | not started |

## The invariant that matters most

`ENABLED_LOCALES` in `src/i18n/locales.ts` gates every quality check AND the
picker. Widening it is the LAST step of a phase, after that locale's strings
exist and pass. Widening it early turns every gate red at once.

## Phase 2 — Spanish (current)

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

## Phase 3 — Vietnamese

Same steps. Third, not last, because it is the one that can fail on font
grounds. Handjet is not monospace, so `vi` needs its own full advance table.

## Phase 4 — pt-BR, fr, id, then **de last**

German last: longest language, surfaces any remaining layout ceilings.

## Phase 5 — long tail

Whatever prose remains uncovered once 2–4 are done.

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
