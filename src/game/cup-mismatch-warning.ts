import type { Role } from '../sim/types';
import { activeCareerMatchday } from './career';
import { compareIds } from './ordering';
import type { CareerPlayer, GameState } from './types';

const CUP_MISMATCH_WARNING_FLAG_PREFIX = 'story:bert:cup-mismatch-warning:';

export interface CupMismatchWarning {
  readonly fixtureId: string;
  readonly divisionGap: number;
  readonly title: string;
  readonly body: readonly string[];
  readonly starPlayer?: {
    readonly playerId: string;
    readonly playerName: string;
  };
}

interface WarningCopy {
  readonly title: string;
  readonly body: (opponentName: string) => string;
  readonly starBody: (playerName: string) => string;
}

/**
 * Bert grows less professionally reassuring as the draw grows less reasonable.
 *
 * Four is the widest gap in the five-division pyramid. Keeping the final row as
 * the 4+ fallback means a future pyramid expansion cannot silently suppress the
 * rarest warning.
 */
const WARNING_COPY_BY_TIER: Readonly<Record<2 | 3 | 4, WarningCopy>> = {
  2: {
    title: 'Two divisions above us',
    body: opponentName => `Boss, ${opponentName} are two divisions above us. On paper, we are expected to lose by a couple. Keep it tight, and this can still become the funny kind of Cup story.`,
    starBody: playerName => `One more thing: ${playerName} is their likeliest scorer. Give them less room than a budget-airline seat.`,
  },
  3: {
    title: 'Three divisions. Oh dear.',
    body: opponentName => `Boss, ${opponentName} are three divisions above us. A three or four-goal defeat would not shock the statisticians. Their substitutes probably have substitutes.`,
    starBody: playerName => `${playerName} is their main goal threat. If they look unmarked, that is not a tactical shape. That is an emergency.`,
  },
  4: {
    title: 'Four divisions. I checked twice.',
    body: opponentName => `Boss, ${opponentName} are four divisions above us — the full pyramid. We are expected to lose by the kind of score normally counted with both hands. If they stop at four, I may send a thank-you card.`,
    starBody: playerName => `${playerName} is their likeliest scorer. I would say double-mark them, but I do not want the other ten to feel ignored.`,
  },
};

/**
 * The once-per-tie flavour briefing shown over the match-day formation screen.
 *
 * Draw-time divisions are authoritative, exactly as they are for the matching
 * post-win giant-killing speech. The assistant mode is deliberately not read:
 * this is a Cup story beat, not a lesson, so Advisor careers keep it too.
 */
export function cupMismatchWarning(state: GameState): CupMismatchWarning | undefined {
  const matchday = activeCareerMatchday(state);
  if (matchday?.kind !== 'national-cup') return undefined;
  if (state.eventFlags.includes(cupMismatchWarningFlag(matchday.fixture.id))) return undefined;

  const cup = state.m2?.nationalCups.find(
    candidate => candidate.season === matchday.fixture.season,
  );
  const divisions = cup?.seedDivisionByClubId;
  if (divisions === undefined) return undefined;

  const opponentClubId = matchday.fixture.homeClubId === state.userClubId
    ? matchday.fixture.awayClubId
    : matchday.fixture.homeClubId;
  const userDivision = divisions[state.userClubId];
  const opponentDivision = divisions[opponentClubId];
  if (userDivision === undefined || opponentDivision === undefined) return undefined;

  const divisionGap = userDivision - opponentDivision;
  if (divisionGap < 2) return undefined;

  const opponent = state.clubs.find(club => club.id === opponentClubId);
  if (opponent === undefined) return undefined;
  const tier: 2 | 3 | 4 = divisionGap >= 4 ? 4 : divisionGap === 3 ? 3 : 2;
  const copy = WARNING_COPY_BY_TIER[tier];
  const star = shouldNameStar(matchday.fixture.matchSeed)
    ? likeliestOpponentScorer(state, opponentClubId)
    : undefined;

  return {
    fixtureId: matchday.fixture.id,
    divisionGap,
    title: copy.title,
    body: [
      copy.body(opponent.name),
      ...(star === undefined ? [] : [copy.starBody(star.name)]),
    ],
    ...(star === undefined ? {} : {
      starPlayer: { playerId: star.id, playerName: star.name },
    }),
  };
}

/** Retires the current tie's warning without turning a story beat into a tutorial milestone. */
export function completeCupMismatchWarning(state: GameState): GameState {
  const warning = cupMismatchWarning(state);
  if (warning === undefined) throw new Error('there is no Cup mismatch warning to complete');
  return {
    ...state,
    eventFlags: [...state.eventFlags, cupMismatchWarningFlag(warning.fixtureId)],
  };
}

export function cupMismatchWarningFlag(fixtureId: string): string {
  return `${CUP_MISMATCH_WARNING_FLAG_PREFIX}${fixtureId}`;
}

/**
 * Fixture seeds are uniformly generated uint32s. Their low bit is therefore an
 * exact 50/50, and reading it consumes no match or career RNG.
 */
function shouldNameStar(matchSeed: number): boolean {
  return (matchSeed & 1) === 0;
}

/**
 * Names a starter, never a benched headline. Shooting owns most of the score;
 * technique and pace settle close calls, then attacking roles and the stable ID
 * order keep the answer deterministic on Hermes and V8.
 */
function likeliestOpponentScorer(
  state: GameState,
  opponentClubId: string,
): CareerPlayer | undefined {
  const lineup = state.lineups.find(candidate => candidate.clubId === opponentClubId);
  if (lineup === undefined) return undefined;
  const starters = new Set(lineup.playerIds);
  return state.players
    .filter(player => (
      player.clubId === opponentClubId
      && starters.has(player.id)
      && player.role !== 'GK'
    ))
    .slice()
    .sort((left, right) => (
      scoringThreat(right) - scoringThreat(left)
      || scoringRoleRank(right.role) - scoringRoleRank(left.role)
      || compareIds(left.id, right.id)
    ))[0];
}

function scoringThreat(player: CareerPlayer): number {
  return player.attrs.sho * 4 + player.attrs.tec * 2 + player.attrs.pac;
}

function scoringRoleRank(role: Role): number {
  if (role === 'FWD') return 3;
  if (role === 'MID') return 2;
  if (role === 'DEF') return 1;
  return 0;
}
