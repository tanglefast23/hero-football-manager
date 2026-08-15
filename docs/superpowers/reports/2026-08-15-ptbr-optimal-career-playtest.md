# Optimal career playtest (pt-BR) — 2026-08-15

Fresh career on the deployed build `https://hero-football-manager.vercel.app/`.
Language: Português (Brasil). Difficulty: **Presidente (expert)**.
Master volume set to 0 before the career started; browser pane muted on load.

Reporting cadence requested by Joe: a summary at every division passed —
what is good, what is bad, economy balance, opponent balance, suggestions, bugs.

## Career start state

- Season 1 · D5 · Week 1 / 30, Bramble Rovers.
- Cash $53,000 · TP 12 · Fans 500.
- Created player: Zeca, FWD, 15 points spent — SHO 60, PAC 55, rest 50.
  $180/week, 1 season.
- Transfer windows: weeks 1–4 and 17–18.

## Findings log

State key: `observed-open`, `recommendation`, `fixed-local`, `verified`, `intentional`.

### i18n / copy

1. `observed-open` — Title-screen Settings mixes translated and untranslated
   values: `MENOS MOVIMENTO — NÃO` next to `LUGAR DOS DADOS — LEFT`,
   `VIBRAÇÃO — ON`, `ALTO CONTRASTE — OFF`. In pt-BR these should read
   `ESQUERDA`, `SIM/NÃO` (or all `LIGADO/DESLIGADO`), consistently.
2. `observed-open` — Home header greeting shows `BOM DIA, CHEFE` with the
   English word `BOSS` rendered directly beneath it (untranslated label).
3. `observed-open` — The fans-counter accessible label drops every accent:
   "Enche o estadio nos jogos em casa e compra na loja, entao cada torcedor e
   dinheiro que o clube ainda nao faturou." Should be
   "estádio … então … é dinheiro … não faturou". Every neighbouring string is
   correctly accented, so this one line looks hand-typed.

## BLOCKER — career save is unloadable at S1 W16 (crash in `BertBriefingWalkOn`)

`observed-open` · **severity: highest**

**What happened.** In Season 1, Week 16, a Bert coach-mark was open over the
Club → Escritório (facilities) screen. The bubble read *"Todos os jogos da rodada
aparecem nesta página, e os placares entram ao vivo conforme rolam"* — copy about
the **League** page, shown while the **facilities** page was on screen. The whole
screen was dimmed and every control, including the bottom tab bar, was inert.
Tapping the bubble to dismiss it crashed the screen:

```
[screen] render failed  Minified React error #185
  at BertBriefingWalkOn (index-…js:784:184)
```

React #185 is "Maximum update depth exceeded" — a setState loop.

**Why it is a blocker, not an annoyance.** The pending briefing is part of the
saved career. Title → `CONTINUAR · TEMPORADA 1 · SEMANA 16` re-enters the same
crash every time. The career cannot be resumed at all. Sixteen weeks of D5 are
stranded.

**Reproduction:** new pt-BR career on the deployed build → play to S1 W16 with the
league/cup briefing pending → open Club → Escritório → tap Bert's bubble.

**Two smaller findings inside the same crash:**

- The blocked week before the crash silently ate a full training week: with the
  overlay up, every drill tap is swallowed, TP is not spent, and nothing tells
  the player why. 91 TP had piled up before I noticed.
- The crash screen renders in **English** in a pt-BR career: "THIS SCREEN COULD
  NOT OPEN / Your saved career has not been changed…". `ScreenErrorBoundary` is
  supposed to resolve its strings through `useCopy()`.

**Root cause — found, fixed locally.** Two effects in `App.tsx` each force a
different management tab, and each lists `store.activeTab` in its dependencies:

- the first-Cup round-of-32 briefing pulls the manager to the **League** tab
  while `milestone:first-cup-win` is set and `first-cup-round-of-32-seen` is not;
- an undiscovered facility-combo reveal pulls them back to the **Club** tab.

With both conditions true the tab flips on every render, so React throws #185.
The error surfaces inside `BertBriefingWalkOn` because the briefing only renders
on the League tab: it mounts on one flip, unmounts on the other, and its unmount
cleanup writes guide focus back to App state — one state write per cycle.

This career satisfied both conditions from Week 13 on. The Cup win landed in
Week 10, and the Week 13 Club Shop was built next to a Stand, which discovered
the `Club Shop + Stand` combo without its reveal ever being shown. Both live in
the save, which is why the crash repeated on every load.

**Fix.** The Cup briefing wins the tab; the combo reveal stands down while the
briefing is owed, and is still waiting the moment it finishes. Guarded in both
the effect and the visibility flag. Regression test:
`src/ui/__tests__/guide-tab-claim-conflict.test.ts` — verified failing on the
unfixed tree and passing on the fixed one. The whole `src/ui` and `src/i18n`
suite is back to its three pre-existing failures, with none added.

**Still true:** this save cannot be rescued. The fix stops new careers reaching
that state; it cannot re-open one already in it, because the deployed build has
to ship the fix first.

## Findings so far (Season 1, D5, weeks 1–16)

### Balance

1. `observed-open` — **Two drills a week on one player is a death spiral.**
   Measured recovery is about +10 condition per week; one drill costs ~7–8 and a
   D5 start costs 4. So one drill per player per week settles at 98%, while two
   drags a player down ~7 per week with no floor. Following the handoff's "train
   each priority player up to twice a week" took Zeca from 100% to **52%** in six
   weeks, and the club lost four league matches in a row while its two best
   players were "Fora de ponto". Nothing on the training screen warns about this;
   the only warning is Bert's line on match day, after the damage is done.
2. `observed-open` — **D5 economy is tighter than the handoff's build order
   assumes.** Weekly fixed costs reach ~$3,028 (wages $2,223 + staff $450 +
   maintenance $355) against a season-1 wage subsidy of ~$1,069, a home gate of
   ~$4,086 with two stands (every other week), $2,400 monthly advertising and
   ~$262/week of shop income. Building Training Centre + Tech Room + two Stands
   + Dorm + Shop by week 13 left the club at **$1,890** with no crew work
   possible. The build order needs a stated cash floor, or D5 needs more income.
3. `recommendation` — Coach candidates have no variety. Across two separate
   three-candidate lists, **every single coach** had `GOLEIROS` as their first
   specialty and `Treino de REF +10%`, at the same $300/week and +5 TP. Only the
   second trait differed. A goalkeeping bonus is close to worthless for an
   outfield-heavy D5 squad, so the "choice" is really a one-slot pick between
   DEF, SHO and Motivador.
4. `observed-open` — The coach-story risky option is EV-negative in both stories
   seen (30%: +5 moral/+2 TP vs 70%: −6 moral/−1 TP; 27%: +8 moral/+1 trait vs
   73%: −6 moral/−1 trait). An optimizing player always takes the safe option, so
   the choice is not a choice. The two club stories seen (mugs, scoreboard) were
   the opposite — clearly positive EV — and equally automatic.

### UX

5. `observed-open` — A story that needs a coach target does not preselect the
   only eligible coach. With exactly one assistant on the staff, the player still
   has to find `+ ESCOLHER TREINADOR`, open it, and pick the single entry. Until
   they do, both decision buttons do nothing, and the only hint is a line at the
   very bottom of the page: `ESCOLHA UM ALVO VÁLIDO ANTES DE DECIDIR`.
6. `observed-open` — The in-match energy plan (POUPAR / EQUILIBRADO / NO MÁXIMO)
   marks the active option with colour only. The three buttons carry no
   `aria-pressed`/`aria-checked`, so a screen-reader user cannot tell which plan
   is running.
7. `recommendation` — A 7-TP drill often leaves the headline `NOTA` unchanged
   (+3 on one of six attributes rounds away), so the first training a new player
   buys can look like it did nothing.

### i18n (pt-BR) — fixed in this repo unless noted

8. `fixed-local` — Title Settings showed `LEFT`, `ON`, `OFF` untranslated beside
   translated values. `AccessibilityToggle` hardcoded `'ON'/'OFF'` and the match-
   info row rendered `preferences.hudSide` raw. Now `settings.on/off` and
   `settings.matchInfo.left/right`.
9. `fixed-local` — Home header showed the English default manager name `BOSS`.
   `managerName: 'Boss'` was hardcoded in `view-models.ts`; now
   `clubHome.managerNameDefault`, added to all seven catalogs.
10. `fixed-local` — `managementShell.fansExplainer` in pt-BR had every accent
    stripped ("estadio … entao … e dinheiro … nao faturou").
11. `fixed-local` — gate 3 was already failing on `main` for
    `fixtureMatchDay.conditionWarning` (es over budget), and fr and vi were over
    once es was fixed. All three shortened.
12. `observed-open` — `TAP TO SKIP` on the pre-match VS screen is untranslated.
13. `observed-open` — `SUPER POWER` on the rival-hero card is untranslated.
14. `observed-open` — Cup briefing reads `Jogo contra Moonlight Town em o
    estádio deles`. `em o` must contract to `no`.
15. `observed-open` — Coach card reads `Treino de Motivador, Goleiros +5%`.
    `Motivador` is a personality trait, not a trainable attribute, so the
    sentence claims training in something that does not exist.

## Career 2 — fresh pt-BR career after the crash

Career 1 is abandoned at S1 W16, unrecoverable. Career 2 started on the same
deployed build (the crash fix is in PR #161, not yet deployed). The crash is
avoided by keeping the Club Shop away from the Stands, so no facility combo is
discovered while the Cup round-of-32 briefing is owed.

Same setup as career 1: Bramble Rovers, Presidente difficulty, created striker
Zeca with 10 points into SHO and 5 into PAC.

Different rolls, and they matter:

- **Head coach.** The market offered `DEFESA + MOTIVADOR`, `TÉCNICA + MOTIVADOR`
  and `ATAQUE + TÉCNICA`. Nothing like career 1's four-goalkeepers-in-a-row.
  Hired Malik Johnson (`ATAQUE + TÉCNICA`, SHO +10%, PAS & TEC +10%), plus Noor
  Al-Khatib as assistant for DEF +5% and the 4-3-3 unlock.
- **Youth intake offered ONE prospect, not two.** Dara Ash, C+ potential, against
  career 1's choice between a B+ prodigy and a C+ anchor. Signing is mandatory,
  so this is a forced pick from a list of one.
- **Zeca awakened in Week 3 again, with a different power** — Golpe de Trovão
  instead of Fantasma. The awakening week looks fixed; the power does not.

**Result so far: D L D L D through five league matches, 4th in D5.** Career 1 had
two wins from its first two over the same fixtures. The training was more
disciplined this time — one drill per player per week, nobody trained below 90
condition — so the gap is not condition. The most likely cause is the youth roll:
career 1's B+ prodigy reached OVR 52 with SHO 88 by Week 9 and scored twice on
debut, while Dara Ash is a C+ at OVR 42.

`recommendation` — **one prospect in the mandatory youth intake is not a
choice, and the quality range is season-defining.** A B+ prodigy and a C+ squad
filler are worth very different seasons in D5, where a single striker carries the
scoreline. Either guarantee two prospects so there is a decision, or narrow the
potential range of the forced one.

### More findings

16. `observed-open` — The transfer window is announced but empty in D5 season 1.
    Weeks 1–4 show `JANELA ABERTA · Dá pra registrar negócios nesta semana` and a
    Boss note explaining that the window is the only time to buy or sell. The
    Market screen has only Youth and Coaches desks; scouting and transfers are
    still locked by story pacing. The player is told to act on a market that does
    not exist yet.
17. `observed-open` — The press story `Quatro sem perder` has a risky option with
    **no downside**: 55% for +140 fans and +15 TP, otherwise +6 TP, against a safe
    +6 morale. Taking the risk is strictly correct. Together with the coach
    stories, which are strictly wrong, the pattern is that these decisions are
    arithmetic, not judgement.
18. `observed-open` — `Jogo contra {club} em o estádio deles` is only broken for
    away ties. The home variant reads `em nosso estádio` correctly.

## D5 division review — Season 1 (career 2)

**Finished 3rd. Not promoted.** 9W 4D 5L, 45 GF, 28 GA, 31 points, GD +17.

| # | Club | P | GD | Pts |
|---|------|---|----|-----|
| 1 | Thunder Borough ↑ | 18 | +39 | 47 |
| 2 | Neon Athletic ↑ | 18 | +16 | 39 |
| 3 | **Bramble Rovers** | 18 | +17 | 31 |
| 4 | Moonlight Town | 18 | +1 | 26 |
| 5 | Ferrous United | 18 | −6 | 23 |

Cup: out in the Pré round. Fans 500 → 557. Cash ended $14,357 after a season
swing of −$38,643, plus a $6,500 finishing prize. Awards: Craque da Temporada
Dara Ash, Revelação and Herói da Temporada both Zeca.

### Was it fair?

Yes, and that is the useful part. Thunder Borough's +39 and 47 points put them
clearly out of reach, and third with +17 felt like the honest ceiling for a squad
whose outfield players started in the 40s. A casual manager would finish lower.
The handoff's "an optimal manager may clear an early division in one season" did
not hold here, but nothing about the season felt unfair — it felt like year one.

Two things drove the gap, and neither was tactics:

- The youth intake handed this career one C+ prospect where career 1 chose from a
  B+ prodigy and a C+. That single roll is worth several places in D5.
- Training throughput is capped by condition, not by TP. One drill per player per
  week is the sustainable rate, so the squad improves at a fixed pace no matter
  how much TP is banked. TP piled up unspent all season and the Week 19 trip then
  ate 49 of it at once.

### Economy

Money was never comfortable and never fatal, which reads as intended. The low
point was $3,243 in Week 15 with the crew idle; the fail-soft loan never
triggered. Weekly fixed costs settled near $3,000 against a home gate of about
$4,000 every other week, so the club lived match to match all year. Three Stands
and no Shop was probably the wrong split — the Shop's ~$262 a week is small, but
it arrives every week.

### Correction to an earlier finding

I reported "no wins in six" mid-season. That was wrong. A win renders as a
**trophy glyph**, not a `W`, so it does not appear in the text I was reading. The
club was 3rd on 18 points at the time. No bug — my reading error.

### New findings

19. `observed-open` · **severity: high — cost this career its best player.**
    Closing the agent negotiation with `FECHAR A FICHA` **permanently ends the
    talk for the season** and removes the sign-at-full-ask option. The card then
    reads `ACABOU A CONVERSA · O empresário de Zeca encerrou a conversa nesta
    temporada. Agora só sai`, and the only remaining action is to release the
    player for free. Bert's own advice on that screen says *"Assinar agora paga o
    pedido cheio; a conversa te dá três rodadas para ficar abaixo disso"* —
    which reads as a promise that the full-ask signing stays available. Nothing
    warns that leaving the table forfeits the player outright. Zeca, the created
    hero, OVR 64 with SHO 121 and Herói da Temporada, was lost for nothing.
20. `observed-open` — On the negotiation screen, **Bert's briefing overlay covers
    the `FAZER A OFERTA` button he is telling the manager to press.** His sprite
    stands on top of it and the overlay is modal, so every tap dismisses or
    advances Bert instead of making the offer. Three offer taps in a row appeared
    to do nothing. Same family as the crash: the tutorial blocks the screen it is
    teaching.
21. `observed-open` — The negotiation round counter is stale. It read `RODADA 2
    DE 3` continuously, including after further offer attempts, and the rejection
    line `Ainda é pouco. O empresário espera algo melhor.` never refreshed. With
    finding 20 in play, the manager cannot tell which offers actually landed.
22. `observed-open` — The Herói da Temporada award card shows the power name in
    **English**: `THUNDER STRIKE fez a diferença`. Everywhere else in the same
    career the power is `Golpe de Trovão`.
23. `observed-open` — The season Cup summary reads `CHEGOU A 0 JOGOS · PRÉ`.
    The Spanish playtest reported the same shape (`Llega a 0 partidos`). It should
    name the round reached without the zero-game phrase.
24. `observed-open` — The Week 19 Team Trip consumes all banked TP for a fixed
    +1 to every stat. With 49 TP banked, that is a poor trade against seven
    focused drills, but the drills cannot be run — condition caps the squad at
    about one drill each per week, and the trip lands before the week's training
    can be spent. The handoff's advice to "spend most TP before Week 19" is not
    actually reachable at D5 TP income.

## Save failure that lost career 2 — cause found, downgraded

`observed-open` · **severity: medium · not a blocker on its own**

At Season 2, Week 2 the game showed `SEU CLUBE NÃO ESTÁ SALVANDO — Nada está
sendo salvo e a temporada está pausada. Libere espaço no aparelho e tente salvar
de novo.`, disabled Advance Week, and paused the season. Retrying cleared the
banner once, then it returned. Reloading showed `NEW FILE`: the career was gone.

**It is not device space.** Measured while the banner was up: quota
21,863,398,818 bytes, usage 0; OPFS writable by hand (I created a probe file,
wrote it, read it back); and the `expo-sqlite` OPFS directory existed but was
empty, so the career database had never been written in that tab.

**Cause.** A second browser tab on the same origin. Career 2 ran in a tab I
opened while an earlier tab was still live on `hero-football-manager.vercel.app`.
SQLite over OPFS takes an exclusive access handle, so the second tab could never
write. Career 3, started in a single tab after the others were gone, saves
correctly — the database file grew 1,110,016 → 1,114,112 bytes across one week
advance, verified directly in OPFS.

**Why it still matters.** Opening the game in two tabs is an ordinary thing for a
player to do, and the game's answer is to pause the season and blame their disk.
Two real defects sit underneath:

- `store.saveWarningBlocked` and `store.seasonPausedBySaveFailure` both name
  device space as the cause. Space is one possible cause of many, and it was not
  this one.
- The real error is not lost — `enqueueSave` (`src/application/store.ts:3938`)
  puts `${errorPrefix}: ${rawMessage(error)}` into `error`. But that is a
  **dismissible toast**, while the misleading banner is the persistent one. The
  diagnosis flashes past and the wrong explanation stays on screen.

**Recommendation.** Detect the second-tab case and say so — a locked database is
recoverable by closing the other tab, which is worth telling the player. Failing
that, make the blocked banner carry the underlying error instead of assuming
space.

## Resolution pass — 2026-08-15

This section supersedes the earlier open labels. `fixed-local` means the current
working tree contains the fix and its focused check passes. It does not claim the
deployed site has updated yet.

| Finding | Status | Resolution |
|---|---|---|
| 1 | fixed-main | Settings uses translated left, right, on, and off values. |
| 2 | fixed-main | The default manager label resolves through every language catalog. |
| 3, 10 | fixed-local | Restored the missing pt-BR accents in the fans description. |
| Crash blocker | fixed-local | The Cup guide owns the tab first. The facility reveal waits without starting a render loop. |
| Balance 1 | fixed-local | The optimal-play handoff now defaults to one drill per starter each week. A second drill needs a planned rest or match-free week. Condition below 80 is not an automatic blocker. |
| Balance 2 | fixed-local | The handoff now keeps about $10,000 after optional D5 construction, with clear exceptions for the Training Pitch, vital renewals, and Starting XI upgrades. D5 income itself remains unchanged because the completed season was tight but safe. |
| Balance 3 | fixed-local | New coach lists no longer present every candidate with the same first specialty when a second specialty can distinguish them. |
| Balance 4 | fixed-local | The nine risky coach stories now use a 40% success chance. Facility risks remain intentionally harsher. |
| 5 | fixed-local | A story automatically selects its target when exactly one valid player, coach, or facility exists. |
| 6 | fixed-main | Energy choices expose their selected state to accessibility tools. |
| 7 | fixed-main | Training results show the exact attribute gain even when rounded overall rating does not move. |
| 8, 9, 11 | fixed-main | Existing translation fixes remain covered by the language gates. |
| 12, 13 | fixed-main | Skip prompts and power headings resolve through every language catalog. |
| 14, 18 | fixed-local | pt-BR Cup notes now say `no nosso estádio` or `no estádio deles`. |
| 15 | fixed-local | Coach story cards describe Motivator as a morale effect, not a trainable stat. |
| Youth intake | fixed-local | Every preseason intake now offers two deterministic prospects. A full roster blocks signing, not discovery. |
| 16 | fixed-local | D5 Season 1 does not announce or show the transfer desk before scouting unlocks. The midseason window still appears when it can be used. |
| 17 | fixed-main | The unbeaten-story risk now has a real three-week training setback. |
| 19 | fixed-local | Closing the renewal panel now leaves talks open. The contract card offers a clear Resume agent talks button. Only the explicit Walk away choice abandons talks. |
| 20, 21 | fixed-local | Bert's expired-contract lesson cannot remain mounted over active renewal talks. Offer taps now reach the negotiation panel, so the saved round advances normally. |
| 22 | fixed-main | Award copy resolves every power name through the active language catalog. |
| 23 | fixed-main | The Cup recap names the reached round without a zero-match phrase. |
| 24 | intentional | The automatic Team Trip still consumes all TP. The owner-approved rule remains. The handoff no longer recommends extra drills merely to empty the TP bank. |
| Save failure | fixed-local | Known browser database-lock errors now produce a persistent close-other-tabs warning. Other save errors no longer assume device space is the cause. |

Verification completed without balance rails: TypeScript passed, 317 focused
tests passed, and all 20 translation gates passed. The focused checks cover the
tab conflict, renewal dismissal, save-lock diagnosis, D5 market timing, youth
intake, coach presentation, story targets, Portuguese copy, awards, Cup copy,
settings, power labels, and neighbouring UI flows.

## Balance note found while repairing main's tests

25. `observed-open` — **The first scout report is unaffordable.** A D5 club
    reaches the Week 15 scouting unlock on about **$51,000**. The two names the
    first mission brings back are quoted at **$123,814** and **$74,986**. Neither
    can be signed, so the feature unlocks into a shop the player cannot buy from.
    This is what broke `story-recruitment-progression.test.ts` — it assumed one
    affordable name and found none.

    It matches what happened in the live career: I sent a D5 scout in Season 1
    Week 17 with $6,279 in the bank, and never revisited the report because
    nothing in it was reachable.

    Either the first mission should quote against the club's division and cash,
    or the unlock should land later, when a D5 club can act on it.
