/**
 * OPT-IN MEASUREMENT PROBE:
 *   PLAYER_REQUEST_CADENCE_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/player-request-cadence-probe.test.ts
 *
 * How long a real career goes without a star, and which half of
 * `tuning.cadence` is actually driving the request clock while it does.
 *
 * `advancePlayerRequests` picks between two cadence rows on one boolean: does
 * any squad player weigh more than 1. Until the fame rescale that boolean was
 * permanently true from season 2 — fame capped at 99 and the star threshold sat
 * at 50 — so `minWeeks`/`guaranteeWeeks` had never executed in a played game.
 * The ceiling is 999 now and the threshold 200, which is supposed to give a new
 * club a genuine anonymous stretch. This measures whether it does.
 *
 * Fame is only half of the test. `weightForPlayer` also doubles for a division
 * top-`starGoalRank` league scorer, so a squad with nobody near 200 fame still
 * counts as having a star the moment one of its forwards leads the division's
 * scoring chart. That channel needs REAL stat lines, which is why this probe
 * plays every fixture through the production engine — `resolveMatchday` with no
 * supplied results — rather than using the seeded scoreline roll the balance
 * harnesses share. A scoreline harness records no contributions at all, so it
 * would report the goal channel as permanently empty and overstate how long a
 * squad stays anonymous.
 *
 * EVERY settled week is recorded, matchday weeks included. The request clock
 * ticks in `settleCurrentWeek`, which `completeMatchday` calls as well as
 * `advanceWeek` — a first cut of this probe watched only the quiet weeks and
 * reported one ask per two seasons for a feature that actually deals one every
 * ten.
 *
 * The columns, per settled week from the first week requests can open:
 *   star       whether `hasStar` held that week, and what made it hold
 *   fame       squad players at or over the star fame threshold
 *   goals      squad players on the division's top-scorer list this season
 *   since      the request clock, in weeks
 *   pool       eligible askers — a zero here is a silent week the clock cannot end
 *   opened     the request drawn that week, if one was
 *
 * WHAT IT FOUND (2026-08-02, six seasons × three seeds)
 *
 * 1. `hasStar` is false for the WHOLE run. Top squad fame reaches 120–142 by
 *    season 6 against a threshold of 200, and no user-club player ever makes
 *    the division's top-two scorers. The old bug is inverted: the non-star row
 *    is now the only row a young career runs, and the STAR row is the one that
 *    a six-season measurement never reaches.
 * 2. The non-star row is genuinely the one in force. Every ask arrived on a
 *    clock of 8–11 dry weeks, never on 6 or 7 — and seed 23's season-5 ask
 *    arrived on 11, which the star row could not have produced, because it
 *    guarantees at 10.
 * 3. `maxClock` running to 17–29 with no ask is NOT the cadence: it is
 *    `eligibleAskers` returning an empty pool. In this run 14–15 of a 16-man
 *    squad are transfer-listed by season 3, and a listed player cannot ask. The
 *    draw then rolls, finds nobody, and the clock keeps climbing with nothing
 *    to show for it — 61 of 149 settled weeks. The manager here answers nothing
 *    and trains nobody, so a played career will list fewer players than this;
 *    the mechanism is real either way and has no floor under it.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  renewCareerPlayer,
  startNextSeason,
  type GameState,
} from '../../game';
import { resolveMatchday } from '../../game/matchday';
import { eligibleAskers, starQualifiers, weightForPlayer } from '../../game/player-requests';
import { buildCareerMatchTeams } from '../../game/squad';

const describeProbe = process.env.PLAYER_REQUEST_CADENCE_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const TUNING = content.playerRequests.tuning;

/** Three seeds and six seasons: the anonymous stretch, if there is one, is early. */
const SEEDS = [20260801, 23, 4_000_000];
const SEASONS = 6;

interface WeekRow {
  readonly season: number;
  readonly week: number;
  readonly hasStar: boolean;
  readonly fameStars: number;
  readonly goalStars: number;
  readonly topFame: number;
  readonly weeksSinceRequest: number;
  readonly eligible: number;
  readonly opened?: string;
}

/**
 * The career the store builds, not the one `createCareer` builds.
 *
 * `createLaunchCareerSetup` never attaches `playerRequestRules`; only
 * `store.ts` does, at career creation. A probe that forgot it would measure a
 * career where `advancePlayerRequests` returns on its first line every week.
 */
function newCareer(seed: number): GameState {
  return {
    ...createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY')),
    playerRequestRules: content.playerRequests,
  };
}

function userSquad(state: GameState): GameState['players'] {
  return state.players.filter(player => player.clubId === state.userClubId);
}

/** `advancePlayerRequests`'s own star test, recomputed so the reason is visible. */
function starReading(
  state: GameState,
): Pick<WeekRow, 'hasStar' | 'fameStars' | 'goalStars' | 'topFame'> {
  const qualifiers = starQualifiers(
    state.seasonStatLines ?? [],
    state.season,
    TUNING.starGoalRank,
  );
  const squad = userSquad(state);
  const fameStars = squad.filter(
    player => (player.fame ?? 0) >= TUNING.starFameThreshold,
  ).length;
  const goalStars = squad.filter(player => qualifiers.includes(player.id)).length;
  return {
    hasStar: squad.some(
      player => weightForPlayer(player, qualifiers, TUNING.starFameThreshold) > 1,
    ),
    fameStars,
    goalStars,
    topFame: squad.length === 0 ? 0 : Math.max(...squad.map(player => player.fame ?? 0)),
  };
}

function playMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('matchday phase without an active fixture');
  const clubIds = [...new Set(matchday.fixtures.flatMap(
    fixture => [fixture.homeClubId, fixture.awayClubId],
  ))];
  return completeMatchday(
    state,
    resolveMatchday(matchday.fixtures, buildCareerMatchTeams(state, clubIds)),
  );
}

/**
 * One career, every settled week recorded from the week requests open.
 *
 * The star reading is taken from the state the settlement is about to read,
 * which is the same state `advancePlayerRequests` sees bar its own leave and
 * effect tick — neither of which touches fame or a stat line.
 */
function runCareer(seed: number): WeekRow[] {
  let state = newCareer(seed);
  const rows: WeekRow[] = [];
  let guard = 0;

  while (state.season <= SEASONS) {
    guard += 1;
    if (guard > SEASONS * 400) throw new Error('cadence probe exceeded its transition budget');

    if (state.phase === 'season-end') {
      if (state.season >= SEASONS) break;
      for (const player of userSquad(state).filter(candidate => (
        candidate.contractSeasonsRemaining === 0
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = startNextSeason(state);
      continue;
    }

    // `advanceWeek` on a matchday week only flips the phase; the week is
    // settled by `completeMatchday`, and that is the settle the clock ticks in.
    const settling = state.phase === 'matchday';
    const before = state;
    const reading = starReading(before);
    const pendingBefore = before.playerRequests?.pending?.requestId;
    state = settling ? playMatchday(before) : advanceWeek(before);
    if (!settling && state.phase === 'matchday') continue;

    const opensRequests = before.season > TUNING.startSeason
      || (before.season === TUNING.startSeason && before.week >= TUNING.startWeek);
    const pendingAfter = state.playerRequests?.pending;
    if (opensRequests && state.phase !== 'season-end') {
      rows.push({
        season: before.season,
        week: before.week,
        ...reading,
        weeksSinceRequest: state.playerRequests?.weeksSinceRequest ?? 0,
        eligible: eligibleAskers(userSquad(state), {
          ...(state.playerRequests?.lastAskingPlayerId === undefined
            ? {}
            : { lastAskingPlayerId: state.playerRequests.lastAskingPlayerId }),
          minSeasonsAtClub: TUNING.minSeasonsAtClub,
          absence: false,
        }).length,
        ...(pendingAfter !== undefined && pendingAfter.requestId !== pendingBefore
          ? { opened: pendingAfter.requestId }
          : {}),
      });
    }
  }

  return rows;
}

describeProbe('the player request cadence over a real career', () => {
  it('reports the anonymous stretch and the gaps it produced', () => {
    const cadence = TUNING.cadence.COZY;
    const lines = [
      '',
      `star fame >= ${TUNING.starFameThreshold} · top-${TUNING.starGoalRank} league scorers also count`,
      `cadence COZY  no star ${cadence.minWeeks}-${cadence.guaranteeWeeks} wk`
        + `  star ${cadence.starMinWeeks}-${cadence.starGuaranteeWeeks} wk`,
      '',
    ];

    for (const seed of SEEDS) {
      const rows = runCareer(seed);
      const starless = rows.filter(row => !row.hasStar);
      const firstStar = rows.find(row => row.hasStar);
      lines.push(`seed ${seed}`);
      lines.push(
        `  weeks recorded ${rows.length} · starless ${starless.length}`
        + ` · first star ${firstStar === undefined ? 'never' : `S${firstStar.season} W${firstStar.week}`}`,
      );
      lines.push(
        '  season  wks  starless  topFame  fameStars  goalStars  maxClock  minPool'
        + '  opens  starlessOpens',
      );
      for (let season = TUNING.startSeason; season <= SEASONS; season += 1) {
        const inSeason = rows.filter(row => row.season === season);
        if (inSeason.length === 0) continue;
        lines.push([
          String(season).padStart(8),
          String(inSeason.length).padStart(5),
          String(inSeason.filter(row => !row.hasStar).length).padStart(10),
          String(Math.max(...inSeason.map(row => row.topFame))).padStart(9),
          String(Math.max(...inSeason.map(row => row.fameStars))).padStart(11),
          String(Math.max(...inSeason.map(row => row.goalStars))).padStart(11),
          String(Math.max(...inSeason.map(row => row.weeksSinceRequest))).padStart(10),
          String(Math.min(...inSeason.map(row => row.eligible))).padStart(9),
          String(inSeason.filter(row => row.opened !== undefined).length).padStart(7),
          String(inSeason.filter(row => row.opened !== undefined && !row.hasStar).length)
            .padStart(15),
        ].join(''));
      }

      lines.push('  every ask, with the clock it arrived on:');
      for (const row of rows.filter(item => item.opened !== undefined)) {
        lines.push(
          `    S${row.season} W${String(row.week).padStart(2)}`
          + `  since=${String(row.weeksSinceRequest).padStart(2)}`
          + `  ${row.hasStar ? 'STAR   ' : 'NO STAR'}`
          + `  fame=${row.fameStars} goals=${row.goalStars}`
          + `  ${row.opened}`,
        );
      }
      lines.push('');
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(4);
  }, 1_800_000);
});
