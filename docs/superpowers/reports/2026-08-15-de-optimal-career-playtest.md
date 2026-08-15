---
title: 'German optimal career playtest'
type: qa-report
date: 2026-08-15
status: in-progress
locale: de
---

# German optimal career playtest — Bramble Rovers

Fresh career, German locale, **Gemütlich (Cozy)** difficulty, played on the
deployed build at `https://hero-football-manager.vercel.app/` in the Claude
browser pane. Master volume set to 0 before anything else; the page stayed
silent for the whole session.

The handoff says continue the saved career unless Joe asks for a new one. Joe
asked for a new one, in German, so this is a fresh file and does not continue
`2026-08-13-optimal-career-playtest.md`.

## Career state at time of writing

| | |
|---|---|
| Season / week | S1 · W22 / 30 |
| Division | D5 · Bezirksliga |
| League | 2nd, 29 pts from 13 (promotion place) |
| Hero Cup | **Out** — lost the Vorrunde 0–5 to Neon Athletic in W10 |
| Cash | $9,358 |
| Fans | 598 |
| Squad | 15 |
| Coaches | Sofia Rossi (head, PAS/TEC +10%), Kwame Boateng (assistant, DEF/SHO +5%) |
| Facilities | Trainingsplatz L1→L2 (building), Trainerbüro L1, 3× Tribüne L1, 1× Fanshop L1 |
| Hero | Klaus Sturm — awakened W3 with **Donnerschuss** (Thunder Strike) |

Winning the Hero Cup needs at least Season 2; this season's run ended in the
first round.

## Language pass

Every item below was **fixed in the repo**, not just logged. Three commits so
far: `3efaf6c4`, `63f5a3e2`, `4e700987`, plus uncommitted work in progress.
The fixes reach the running career only after main deploys.

### English leaking into every locale (code, not catalog)

| Where | Was | Now |
|---|---|---|
| `src/ui/TrainingDrillModal.tsx:996` | training confirm printed `7 OF 12` from a hardcoded `" of "` | `trainingDrill.pointsOfAvailable` in all 7 catalogs |
| `src/ui/components/CupBracket.tsx` | every undecided tie drew the raw constant `TBD` | `cupBracket.placeholderClub` in all 7 catalogs (de: `Offen`) |
| `src/ui/components/FormStrip.tsx` | recent-form cells drew the `W/D/L` enum, so German showed `D` and `L` | reuses `col.league.drawn` / `col.league.lost`, which already said `U` / `N` |
| `src/ui/screens/StoryEventScreen.tsx` (×2) | coach picker badges hardcoded `HEAD` / `ASST` | `storyEvent.coachBadge.*` in all 7 catalogs (de: `CHEFTR.` / `CO-TR.`) |

The form strip is the sharpest of these: the league table two screens away
already showed the correct German letters, so the same result was `N` in one
place and `L` in another.

### The player had two names, and one of them was the head coach's

The UI addresses the manager as **CHEF** — the home greeting is `MORGEN, CHEF`,
the title wordmark ends in `CHEF!`, the status chip reads `CHEF`. But 61
strings called them **Boss**, and `market.hireAsHead` used **Chef** for the
*head coach*, whose wage chip read `CHEF $300/WO` right next to
`ALS CO-TRAINER HOLEN`. Meanwhile *Boss* is also the name of the Chairman
difficulty.

Three roles, two words, no agreement anywhere. Resolved as:

- player → **Chef** everywhere (61 strings changed);
- head coach → **Cheftrainer** (`Cheftrainer holen`, `Cheftrainer {head}/Wo`);
- **Boss** kept only where it names the difficulty.

### "Desk" had been translated as a dining table

English uses *desk* as the manager's-desk metaphor throughout. German rendered
it literally as `Tisch`, which is furniture. The cup panel's current round read
**`AKTUELLER TISCH`**, and the inbox-empty state read **`Tisch leer.`**

| Key | Was | Now |
|---|---|---|
| `m2League.currentDesk` | Aktueller Tisch | Aktuelle Runde |
| `clubHome.deskClearTheBoard` | Tisch leer. | Schreibtisch leer. |
| `managementShell.a11y.bertSaysReadTheDesk` | lies den Tisch | lies das Postfach |
| `market.registrationDesk` | Meldetisch | Meldestelle |
| `market.a11y.dealsDesk` | Deal-Tisch | Transferbüro |
| `market.a11y.scoutDesk` | Scout-Tisch | Scoutingbüro |
| `market.a11y.coachesDesk` | Trainertisch | Trainerbereich |
| `market.a11y.youthDesk` | Jugendtisch | Jugendbereich |
| `clubFinances.sponsorDesk` | Sponsorentisch | Sponsorenbüro |
| `financialReport.clubDesk` | Vereinstisch | Vereinsbüro |
| `market.scoutReportsOnDesk` | Berichte auf dem Tisch | Berichte auf dem Schreibtisch |
| `assistantModeChoice.teacher.detail` | bis der Tisch leer ist | bis der Schreibtisch leer ist |

`Meldestelle` was already the German word on the match-day sheet, so the
registration desk had been called two different things in one career.

Two `Tisch` strings were left alone: the agent's pen lying *auf dem Tisch* and
Bert's *Preis, der auf dem Tisch liegt* are the same idiom in both languages.

### Condition had four German words

English has one term, `Condition`/`Cond`. German used **Zustand** in the squad
table, **Form** on the match sheet and in the drill modal, **Kondition** in the
tutorial warning, and **Fitness** in the league explainer — all for the same
number. One accessibility label managed two of them in a single sentence:
`Form 86 Prozent … Zust 86`.

Standardised on **Kondition / Kond**, which mirrors Condition/Cond, fits the
existing 4-character column, and was already the word the tutorial used.
*Form* was the wrong candidate: in German football it means current form, a
different thing — and `m2League.squadStrengthUsesPlayer` lists "Form" and
"condition" as two separate factors in the English source.

16 keys changed.

### Number formatting contradicted itself

Four German strings hardcoded **`$8,000`** with English grouping while the
app's own formatter rendered **`$8.000`** on the build menu one tap away. In
German, `$8,000` reads as eight dollars. Fixed to `$8.000`.

(The same four strings are hardcoded in `es`, `pt-BR`, `fr`, `id` and `vi`
too — copied from English. Only German was in scope here, but the other five
locales have the same defect.)

### Grammar, spelling, and register

| Key | Problem | Fix |
|---|---|---|
| `managementShell.fansExplainer` | `Sie fullen das Stadion` — missing umlaut | `füllen` |
| `managerNotes.venueHome` / `venueAway` | `Spiel gegen X in unser Stadion` — accusative where the dative belongs | `in unserem Stadion`; the a11y fixture row gained its missing preposition |
| `story.awakening.power.THUNDER_STRIKE.omen` | `Statik kriecht über die Schuhe` — *Statik* is structural engineering, not static electricity | `Statische Aufladung` |
| `newGameWelcome.theSquadHasBeen` | `wo du ihn ließt` — archaic and jarring | `wo du ihn verlassen hast` |
| `titleLanding.trainATinyClub` | `Trainier` missing its imperative -e; "match-day" dropped | `Trainiere …  Mach Spieltag-Legenden.` |
| `playerFarewell.guilt.lookRelieved` | `Schaut nicht…` — plural imperative at a singular boss | `Schau nicht…` |
| `playerFarewell.sentimental.saveASeat` | `Haltet mir…` — same | `Halt mir…` |
| `matchRail`/`matchScreen.a11y.matchSpeed` | `Tempo {speed} fach` | `{speed}-fach` |
| 5 strings | spelled the noun the English way, `Club` | `Klub`, matching the other 25 |
| `confirm.hireCoach.detail` | `Sofia Rossi wird Cheftrainer` — masculine noun for a female coach | `übernimmt den Posten {role}`, gender-neutral |
| `coachStaff.nowYourRole` | `ist jetzt dein {role}` — same, plus a gendered article | `hat jetzt den Posten {role}` |

### Terminology collisions resolved

- `titleLanding.glossary` and `settings.glossary.*` said **Handbuch**, the same
  word as `clubHandbook` = **Vereinshandbuch**, so the settings card read
  `VEREINSHANDBUCH / HANDBUCH / HANDBUCH ÖFFNEN`. Glossary is **Glossar** now.
- `titleLanding.masterMix` showed **GESAMTMISCHUNG** while its own
  accessibility label said **Gesamtlautstärke**. Now both say Gesamtlautstärke.
- `market.actionListPlayer` read **Spieler listen**, which parses as the plural
  noun "player lists" before it parses as a verb. Now **Auf die Liste**,
  matching the body copy directly above it. Its a11y template composed as
  `Auf die Liste für Zip Vela`; the template takes a colon now.
- `market.youthHeadlineClosed` / `youthIntakeClosed` said `Dieser Jahrgang ist
  zu`, which reads like a shop shutter. Now `Jahrgang abgeschlossen`.

### Verified clean

A scripted sweep of all German values found **no** remaining untranslated
English words outside placeholders, and no misplaced decimal separators. The
remaining leaks were all in components, and all four are fixed above.

### Not changed, and why

- **The wordmark** `HELD / FUSSBALL / CHEF!` reads oddly as three stacked
  nouns, but every locale translates the title the same way (`Héroe/Fútbol`,
  `Herói/Futebol`, `Anh Hùng/Bóng Đá`). Changing German alone would break a
  deliberate, consistent decision. Owner call.
- **`Klub` vs `Verein`** (25 vs 71 uses). Both are correct German. A sweep to
  `Verein` was tried and reverted: it pushed several strings past the gate-3
  width budget, and unifying valid synonyms is style, not a defect.
- **`V` between club names** on the match-day sheet is British-style "v".
  Meaningless in German, but it is one glyph in a fixed layout — flagging, not
  fixing.
- **Stat codes** (PAC/SHO/REF) and **role codes** (GK/DEF/MID/FWD) stay
  English by project rule. Worth noting the side effect: the drill row reads
  `56 PAC` above `+3 TEMPO`, so the code and the name of the same stat do not
  visually connect the way `PAC`/`PACE` does in English.

## Gameplay and balance notes

### Energy is the whole game in D5, and training is what spends it

The clearest finding of the session. Two matches, same squad:

- **W10 cup tie vs Neon Athletic** — trained 4 players that week. Started at
  92% team energy, halftime 52%, 57' 38%, full time 15%. **Lost 0–5.**
- **W9 away at Thunder Borough** (league leaders, 1 opposing hero) — trained 5,
  but started `5-3-2 Deep Counter` on **Sparen**. Halftime 74%. Switched to
  `3-4-3` when 1–0 down. **Won 3–2.**

The handoff's "train a priority starter once per week by default" is right, and
I broke it. Worth saying plainly in the handoff that heavy training in a match
week is not a small tax — it is match-losing.

Energy on **Normal** drains fast: 98% → 46% by halftime in W3. On **Sparen** the
same squad held 74%. Sparen is close to mandatory away from home.

### Facility money is genuinely tight

Following the handoff build order — 3× Tribüne, 1× Fanshop, then Training Pitch
L2 — the balance bottomed out at **$2,926** in W20, below the handoff's own
$10,000 floor. It recovered to $9,358 by W22 on home gates (3 stands ×400% =
+$5,784 per home match). The order works, but only just, and it needed the
$5,935 from selling Zip Vela to afford the $20,000 Training Pitch upgrade at
all.

### Other observations

- **Youth intake is one player, not two.** Signing Jae Gray immediately closed
  the whole intake; Ivo Oak (DEF 43, better than every defender I had) was gone.
  Nothing on the screen says the choice is exclusive before you make it —
  `Die Angebote bleiben die ganze Vorbereitung liegen` actively suggests
  otherwise.
- **The `Sicher`/`Riskant` story choice is doing its job.** The W4 gamble paid
  +9 SHO on Dario Flint and visibly changed the season; the W12 and W16 safe
  picks felt like the right call under a tight balance. Real decisions.
- **Sofia Rossi is strictly better than Imani Adeyemi** in the opening coach
  list — identical specialties and bonuses, plus a 4-3-3 unlock. If that is not
  intentional the second card is dead choice.
- **`aria-checked` is missing on the difficulty radios** in character creation.
  Both `role="radio"` elements report `null`, so a screen reader cannot tell
  which difficulty is selected. Not a translation bug; flagging it here because
  it surfaced during the language sweep.
- **WebGL context leak.** After ~10 watched/simulated matches in one browser
  session the console fills with `Too many active WebGL contexts. Oldest
  context will be lost.` Rendering kept working, but the contexts are not being
  released between matches.

## Session hygiene

Browser pane only, occluded, 800×600, never full-screen. Audio guard injected
immediately after navigate; master volume set to 0 in-game before play. No dev
server or simulator started, so nothing to tear down.
