/**
 * OPT-IN MEASUREMENT PROBE:
 *   PLAYER_REQUEST_DROUGHT_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/player-request-drought-probe.test.ts
 *
 * Whether the request drought `player-request-cadence-probe` found survives a
 * manager who answers, and what is actually holding the asker pool empty.
 *
 * That probe measured a career that answers nothing and trains nobody, and
 * reported 61 of 149 settled weeks with no eligible asker: `eligibleAskers`
 * drops anyone carrying `transferRequested`, and 14–15 of a 16-man squad carried
 * it by season 3. Its own caveat is that an unmanaged squad is the worst case
 * for morale, so the drought could be an artifact of the harness rather than a
 * property of the feature. This runs the same seeds twice — once ignoring every
 * request, once answering each the week it opens, granting when the club can
 * afford it and refusing when it cannot — through the same production engine.
 *
 * It also measures what the first probe could not distinguish. Weekly wellbeing
 * used to write the flag as an OR against its own previous value, with no
 * weekly path back to false — only a season-end renewal cleared it, and only
 * for a contract that had actually expired. So a listed squad meant either of
 * two very different things: fifteen players who want to leave today, or
 * fifteen who were unhappy for four weeks once and have been content ever
 * since. The `stale` column re-runs `shouldRequestTransfer` against each listed
 * player's CURRENT morale and low-morale streak — the same call weekly
 * wellbeing makes. Anyone it returns false for is carrying a memory rather than
 * a grievance.
 *
 * The columns, per settled week from the first week requests can open:
 *   squad    user-club players
 *   listed   squad players carrying `transferRequested`
 *   stale    of those, how many `shouldRequestTransfer` would NOT set today
 *   pool     eligible askers — a zero is a silent week the clock cannot end
 *   clock    `weeksSinceRequest`
 *   opens    requests dealt that week
 *
 * WHAT IT FOUND (2026-08-02, six seasons × three seeds, 146 settled weeks/arm)
 *
 * 1. The drought was real and answering did NOT rescue it. Ignoring every
 *    request left 75–82 weeks silent (51–56%); granting every request the week
 *    it opened left 63–76 (43–52%), still with 21-week silences. One asker
 *    gaining +5 morale every twenty weeks cannot lift a squad losing morale
 *    every week, so the first probe's "unmanaged squad is the worst case"
 *    caveat did not explain the number away.
 *
 * 2. The stuck flag was NOT what emptied the pool — the hypothesis two
 *    paragraphs above is refuted by its own column. `stale` read 0 at every
 *    season end in all six arms: every listed player would raise his request
 *    again on that week's morale. They were not carrying memories, they were
 *    genuinely miserable, and `eligibleAskers` was correctly dropping them.
 *
 * 3. Removing `transferRequested` from `eligibleAskers` closed it completely:
 *    0 silent weeks in every arm, asks up from 4–7 per career to 11–15, and the
 *    pool floor up from 0 to 12–15. `weeksSinceRequest` fell back inside the
 *    authored Cozy band — a peak of 8–12 against 17–49 before, since the clock
 *    is no longer counting a drought it has no way to end.
 *
 * 4. STILL OPEN, and the reason this probe is worth keeping: `listed` remains
 *    14–15 of 16 by season 3 and `stale` remains 0. Nothing here fixed the
 *    morale collapse underneath, and the fix in (3) adds to it — three times
 *    the asks in a club that cannot afford them means mostly refusals, at -4
 *    morale to the asker each. This manager never trains and never buys, so a
 *    played career should list fewer; that remains unmeasured.
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
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import { resolveMatchday } from '../../game/matchday';
import {
  canAffordRequest,
  eligibleAskers,
  resolvePlayerRequest,
} from '../../game/player-requests';
import { shouldRequestTransfer } from '../../game/pyramid';
import { buildCareerMatchTeams } from '../../game/squad';
import type { CareerPlayer } from '../../game/types';

const describeProbe = process.env.PLAYER_REQUEST_DROUGHT_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();
const TUNING = content.playerRequests.tuning;

/** The cadence probe's seeds and span, so the two runs can be read against each other. */
const SEEDS = [20260801, 23, 4_000_000];
const SEASONS = 6;

interface WeekRow {
  readonly season: number;
  readonly week: number;
  readonly squad: number;
  readonly listed: number;
  readonly stale: number;
  readonly eligible: number;
  readonly weeksSinceRequest: number;
  readonly opened?: string;
}

interface ArmResult {
  readonly rows: WeekRow[];
  readonly grants: number;
  readonly refusals: number;
}

/**
 * The career the store builds, not the one `createCareer` builds.
 *
 * `createLaunchCareerSetup` never attaches `playerRequestRules`; only `store.ts`
 * does, at career creation. Without it `advancePlayerRequests` returns on its
 * first line every week and the probe measures nothing.
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

/**
 * The transfer-request test weekly wellbeing runs, against the player as he is
 * now — with the same defaults `resolveWeeklyPlayerWellbeing` supplies before
 * calling it, so a false here means the flag would not be set this week.
 */
function wouldAskToLeaveToday(player: CareerPlayer): boolean {
  return shouldRequestTransfer({
    morale: player.morale,
    condition: player.condition ?? 100,
    personality: player.personality ?? 'Professional',
    consecutiveLowMoraleWeeks: player.consecutiveLowMoraleWeeks ?? 0,
  });
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

function readWeek(
  before: GameState,
  after: GameState,
  pendingBefore: string | undefined,
): WeekRow {
  const squad = userSquad(after);
  const listed = squad.filter(player => player.transferRequested === true);
  const pendingAfter = after.playerRequests?.pending;
  return {
    season: before.season,
    week: before.week,
    squad: squad.length,
    listed: listed.length,
    stale: listed.filter(player => !wouldAskToLeaveToday(player)).length,
    eligible: eligibleAskers(squad, {
      ...(after.playerRequests?.lastAskingPlayerId === undefined
        ? {}
        : { lastAskingPlayerId: after.playerRequests.lastAskingPlayerId }),
      minSeasonsAtClub: TUNING.minSeasonsAtClub,
      absence: false,
    }).length,
    weeksSinceRequest: after.playerRequests?.weeksSinceRequest ?? 0,
    ...(pendingAfter !== undefined && pendingAfter.requestId !== pendingBefore
      ? { opened: pendingAfter.requestId }
      : {}),
  };
}

/**
 * One career. `answer` decides the arm: a manager who deals with the tab the
 * week it lights up, or one who never opens it.
 *
 * Answering immediately is the optimistic bound on purpose. A grant is the
 * largest morale gift the feature can hand out (+5 to the asker), so if the
 * pool still empties under this arm it empties under every real manager too.
 */
function runCareer(seed: number, answer: boolean): ArmResult {
  let state = newCareer(seed);
  const rows: WeekRow[] = [];
  let grants = 0;
  let refusals = 0;
  let guard = 0;

  while (state.season <= SEASONS) {
    guard += 1;
    if (guard > SEASONS * 400) throw new Error('drought probe exceeded its transition budget');

    if (state.phase === 'season-end') {
      if (state.season >= SEASONS) break;
      for (const player of userSquad(state).filter(candidate => (
        candidate.contractSeasonsRemaining === 0
        && !willRetireAtSeasonTransition(candidate, state.season)
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = startNextSeason(state);
      continue;
    }

    // `advanceWeek` on a matchday week only flips the phase; the week is settled
    // by `completeMatchday`, and that is the settle the request clock ticks in.
    const settling = state.phase === 'matchday';
    const before = state;
    const pendingBefore = before.playerRequests?.pending?.requestId;
    state = settling ? playMatchday(before) : advanceWeek(before);
    if (!settling && state.phase === 'matchday') continue;

    const opensRequests = before.season > TUNING.startSeason
      || (before.season === TUNING.startSeason && before.week >= TUNING.startWeek);
    if (opensRequests && state.phase !== 'season-end') {
      rows.push(readWeek(before, state, pendingBefore));
    }

    if (answer && state.phase !== 'season-end' && state.playerRequests?.pending !== undefined) {
      const affordable = canAffordRequest(state);
      state = resolvePlayerRequest(
        state,
        content.playerRequests,
        affordable ? 'GRANTED' : 'REFUSED',
      );
      if (affordable) grants += 1;
      else refusals += 1;
    }
  }

  return { rows, grants, refusals };
}

/** The longest run of consecutive settled weeks with nobody able to ask. */
function longestSilence(rows: readonly WeekRow[]): number {
  let longest = 0;
  let run = 0;
  for (const row of rows) {
    run = row.eligible === 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

function reportArm(label: string, arm: ArmResult): string[] {
  const { rows } = arm;
  const silent = rows.filter(row => row.eligible === 0).length;
  const opens = rows.filter(row => row.opened !== undefined).length;
  const lines = [
    `  ${label}`,
    `    weeks ${rows.length} · silent ${silent} (${Math.round(silent * 100 / rows.length)}%)`
    + ` · longest silence ${longestSilence(rows)} wk`
    + ` · asks ${opens} (granted ${arm.grants}, refused ${arm.refusals})`,
    '    season  wks  squad  listed  stale  minPool  maxClock  opens',
  ];
  for (let season = TUNING.startSeason; season <= SEASONS; season += 1) {
    const inSeason = rows.filter(row => row.season === season);
    if (inSeason.length === 0) continue;
    const last = inSeason[inSeason.length - 1]!;
    lines.push([
      String(season).padStart(10),
      String(inSeason.length).padStart(5),
      String(last.squad).padStart(7),
      String(last.listed).padStart(8),
      String(last.stale).padStart(7),
      String(Math.min(...inSeason.map(row => row.eligible))).padStart(9),
      String(Math.max(...inSeason.map(row => row.weeksSinceRequest))).padStart(10),
      String(inSeason.filter(row => row.opened !== undefined).length).padStart(7),
    ].join(''));
  }
  return lines;
}

describeProbe('the player request drought under a manager who answers', () => {
  it('reports the asker pool and the staleness of the flag emptying it', () => {
    const lines = [
      '',
      'listed = transferRequested · stale = listed but shouldRequestTransfer is false today',
      'squad/listed/stale are the final week of the season; minPool/maxClock span it',
      '',
    ];

    for (const seed of SEEDS) {
      lines.push(`seed ${seed}`);
      lines.push(...reportArm('IGNORE  (answers nothing)', runCareer(seed, false)));
      lines.push('');
      lines.push(...reportArm('ANSWER  (settles every ask on sight)', runCareer(seed, true)));
      lines.push('');
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(4);
  }, 1_800_000);
});
