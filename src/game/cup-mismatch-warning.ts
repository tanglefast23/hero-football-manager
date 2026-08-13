import type { Role } from '../sim/types';
import { activeCareerMatchday } from './career';
import { compareIds } from './ordering';
import type { PyramidClub } from './pyramid';
import type { CareerPlayer, GameState } from './types';

const CUP_MISMATCH_WARNING_FLAG_PREFIX = 'story:bert:cup-mismatch-warning:';

/** One briefing line: English, plus the catalog key the screen renders instead. */
export interface CupMismatchWarningLine {
  /**
   * English, still written on every line.
   *
   * The pure ring cannot know the player's language, so it emits the key and
   * raw params as data and keeps this as the fallback — the same dual write
   * `LedgerLine.label` uses.
   */
  readonly text: string;
  readonly textKey: string;
  /** Raw values for the key's placeholders. Never pre-formatted text. */
  readonly textParams: Readonly<Record<string, string>>;
}

export interface CupMismatchWarning {
  readonly fixtureId: string;
  readonly divisionGap: number;
  readonly title: string;
  /** Catalog key for `title`. */
  readonly titleKey: string;
  readonly body: readonly string[];
  /** `body` again, index-aligned, carrying each line's key and params. */
  readonly bodyLines: readonly CupMismatchWarningLine[];
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
 *
 * @i18n-fallback English source, paired by tier with `cupMismatchCopyKey` below.
 * The keys cannot live in this table because each row's body is a function of
 * the opponent, so the two are kept in step by the shared tier index.
 */
const WARNING_COPY_BY_TIER: Readonly<Record<2 | 3 | 4, WarningCopy>> = {
  2: {
    title: 'Two divisions above us',
    body: (opponentName) =>
      `Boss, ${opponentName} are two divisions above us. On paper, we are expected to lose by a couple. Keep it tight, and this can still become the funny kind of Cup story.`,
    starBody: (playerName) =>
      `One more thing: ${playerName} is their likeliest scorer. Give them less room than a budget-airline seat.`,
  },
  3: {
    title: 'Three divisions. Oh dear.',
    body: (opponentName) =>
      `Boss, ${opponentName} are three divisions above us. A three or four-goal defeat would not shock the statisticians. Their substitutes probably have substitutes.`,
    starBody: (playerName) =>
      `${playerName} is their main goal threat. If they look unmarked, that is not a tactical shape. That is an emergency.`,
  },
  4: {
    title: 'Four divisions. I checked twice.',
    body: (opponentName) =>
      `Boss, ${opponentName} are four divisions above us — the full pyramid. We are expected to lose by the kind of score normally counted with both hands. If they stop at four, I may send a thank-you card.`,
    starBody: (playerName) =>
      `${playerName} is their likeliest scorer. I would say double-mark them, but I do not want the other ten to feel ignored.`,
  },
};

/**
 * `cupMismatch.<tier>.<part>`, mirroring `cupUpset.<gap>.<part>` on the matching
 * post-win speech. The tier is already the identity of the row, so no second
 * lookup table can drift out of step with the English one above.
 */
function cupMismatchCopyKey(
  tier: 2 | 3 | 4,
  part: 'title' | 'body' | 'star',
): string {
  return `cupMismatch.${tier}.${part}`;
}

/**
 * The once-per-tie flavour briefing shown over the match-day formation screen.
 *
 * Draw-time divisions are authoritative, exactly as they are for the matching
 * post-win giant-killing speech. The assistant mode is deliberately not read:
 * this is a Cup story beat, not a lesson, so Advisor careers keep it too.
 */
export function cupMismatchWarning(
  state: GameState,
): CupMismatchWarning | undefined {
  const matchday = activeCareerMatchday(state);
  if (matchday?.kind !== 'national-cup') return undefined;
  if (state.eventFlags.includes(cupMismatchWarningFlag(matchday.fixture.id)))
    return undefined;

  const cup = state.m2?.nationalCups.find(
    (candidate) => candidate.season === matchday.fixture.season,
  );
  const divisions = cup?.seedDivisionByClubId;
  if (divisions === undefined) return undefined;

  const opponentClubId =
    matchday.fixture.homeClubId === state.userClubId
      ? matchday.fixture.awayClubId
      : matchday.fixture.homeClubId;
  const userDivision = divisions[state.userClubId];
  const opponentDivision = divisions[opponentClubId];
  if (userDivision === undefined || opponentDivision === undefined)
    return undefined;

  const divisionGap = userDivision - opponentDivision;
  if (divisionGap < 2) return undefined;

  const opponentName = cupOpponentName(state, opponentClubId);
  if (opponentName === undefined) return undefined;
  const tier: 2 | 3 | 4 = divisionGap >= 4 ? 4 : divisionGap === 3 ? 3 : 2;
  const copy = WARNING_COPY_BY_TIER[tier];
  const star = shouldNameStar(matchday.fixture.matchSeed)
    ? likeliestOpponentScorer(state, opponentClubId)
    : undefined;

  const bodyLines: CupMismatchWarningLine[] = [
    {
      text: copy.body(opponentName),
      textKey: cupMismatchCopyKey(tier, 'body'),
      textParams: { opponent: opponentName },
    },
    ...(star === undefined
      ? []
      : [
          {
            text: copy.starBody(star.name),
            textKey: cupMismatchCopyKey(tier, 'star'),
            textParams: { player: star.name },
          },
        ]),
  ];

  return {
    fixtureId: matchday.fixture.id,
    divisionGap,
    title: copy.title,
    titleKey: cupMismatchCopyKey(tier, 'title'),
    body: bodyLines.map((line) => line.text),
    bodyLines,
    ...(star === undefined
      ? {}
      : {
          starPlayer: { playerId: star.id, playerName: star.name },
        }),
  };
}

/** Retires the current tie's warning without turning a story beat into a tutorial milestone. */
export function completeCupMismatchWarning(state: GameState): GameState {
  const warning = cupMismatchWarning(state);
  if (warning === undefined)
    throw new Error('there is no Cup mismatch warning to complete');
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags,
      cupMismatchWarningFlag(warning.fixtureId),
    ],
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
 * The two places a Cup opponent can live.
 *
 * `state.clubs` holds ONLY the ten clubs of the user's active division, so a
 * tie two or more tiers away — the only kind this whole feature exists for —
 * is never in it. The match itself already knows this: `buildCareerMatchTeamDef`
 * falls back to the pyramid to build the opposition. Reading `state.clubs`
 * alone meant every qualifying tie was silently rejected here while the
 * matching post-win giant-killing speech still fired.
 */
function pyramidClub(
  state: GameState,
  clubId: string,
): PyramidClub | undefined {
  return state.m2?.pyramid.divisions
    .flatMap((division) => division.clubs)
    .find((club) => club.id === clubId);
}

function cupOpponentName(
  state: GameState,
  opponentClubId: string,
): string | undefined {
  return (
    state.clubs.find((club) => club.id === opponentClubId)?.name ??
    pyramidClub(state, opponentClubId)?.name
  );
}

/** Everything the star callout needs, from an active-division or a pyramid squad. */
type ScorerCandidate = Pick<CareerPlayer, 'id' | 'name' | 'role' | 'attrs'>;

/**
 * Names a starter, never a benched headline. Shooting owns most of the score;
 * technique and pace settle close calls, then attacking roles and the stable ID
 * order keep the answer deterministic on Hermes and V8.
 */
function likeliestOpponentScorer(
  state: GameState,
  opponentClubId: string,
): ScorerCandidate | undefined {
  return opponentOutfieldStarters(state, opponentClubId)
    .slice()
    .sort(
      (left, right) =>
        scoringThreat(right) - scoringThreat(left) ||
        scoringRoleRank(right.role) - scoringRoleRank(left.role) ||
        compareIds(left.id, right.id),
    )[0];
}

function opponentOutfieldStarters(
  state: GameState,
  opponentClubId: string,
): readonly ScorerCandidate[] {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === opponentClubId,
  );
  if (lineup !== undefined) {
    const starters = new Set(lineup.playerIds);
    return state.players.filter(
      (player) =>
        player.clubId === opponentClubId &&
        starters.has(player.id) &&
        player.role !== 'GK',
    );
  }
  // `state.lineups` is active-division-only too. A pyramid club's eleven is the
  // first player of each role in squad order — the same slice
  // `buildCareerMatchTeamDef`'s `take(...)` will pick on match day.
  const club = pyramidClub(state, opponentClubId);
  if (club === undefined) return [];
  const take = (role: Role, count: number) =>
    club.squad.filter((player) => player.role === role).slice(0, count);
  return [...take('DEF', 4), ...take('MID', 4), ...take('FWD', 2)];
}

function scoringThreat(player: ScorerCandidate): number {
  return player.attrs.sho * 4 + player.attrs.tec * 2 + player.attrs.pac;
}

function scoringRoleRank(role: Role): number {
  if (role === 'FWD') return 3;
  if (role === 'MID') return 2;
  if (role === 'DEF') return 1;
  return 0;
}
