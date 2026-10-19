import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { conditionedRatingD64, contestProbability } from '../sim/contest';
import { mulberry32, type Rng } from '../sim/rng';
import type { MatchState, PlayerDef, Role } from '../sim/types';
import { compareIds } from './ordering';

/**
 * Cup shootouts for the user's level ties, decided by the players who finished
 * the match rather than by the fixture seed alone.
 *
 * The match engine stops at full time, so none of this runs inside `src/sim`
 * or touches its RNG: regulation-match replays are unchanged and
 * `ENGINE_VERSION` is unaffected. The kicks are resolved once at settlement and
 * persisted on the Cup fixture, so presentation and reloads read them back and
 * can never reroll them.
 */

/** 75% conversion when a taker and a keeper are evenly matched. */
export const PENALTY_EQUAL_CONVERSION_65536 = 49_152;
const CONTEST_EVEN_65536 = 32_768;
/**
 * The engine's own log-ratio contest (0..1) moves conversion by 2/5 of its
 * distance from even: bounded to 55%..95%, with the same diminishing returns
 * on raw rating that shots in open play have.
 */
const SKILL_SPAN_NUMERATOR = 2;
const SKILL_SPAN_DENOMINATOR = 5;
const REGULATION_KICKS = 5;
/**
 * ponytail: a level sudden death longer than this is below 1e-40 even at the
 * 95% bound, so the next pair is settled by the seed instead of looping on.
 */
const MAX_SUDDEN_DEATH_ROUNDS = 1_000;

export type PenaltySideId = 'home' | 'away';

/** One player on the pitch at full time, with the skills a shootout reads. */
export interface PenaltyTaker {
  readonly playerId: string;
  readonly name: string;
  readonly role: Role;
  readonly sho: number;
  readonly ref: number;
  /** Live match condition at full time. */
  readonly condition: number;
}

export interface PenaltySide {
  /** Everyone still on the pitch at full time; dismissed players are excluded. */
  readonly takers: readonly PenaltyTaker[];
  readonly keeperId: string;
}

export interface PenaltyFullTime {
  readonly home: PenaltySide;
  readonly away: PenaltySide;
}

export interface PenaltyKick {
  readonly side: PenaltySideId;
  readonly takerId: string;
  readonly keeperId: string;
  readonly scored: boolean;
}

/** Persisted on a level Cup fixture. Old fixtures have none and keep their winner. */
export interface PenaltyShootout {
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly kicks: readonly PenaltyKick[];
}

export interface ResolvedPenaltyShootout extends PenaltyShootout {
  readonly winner: PenaltySideId;
}

/**
 * Reads the shootout squads from the final match state.
 *
 * Skills come from the squads as they took the field (`match.teams`, players
 * and bench), which already carry morale, match form and any Cup lift. A
 * half-time speech replaces `player.def` with lifted attributes for the second
 * half only, and powers and Heat never change attributes, so neither reaches
 * the shootout. Condition is the live full-time value.
 */
export function penaltyFullTimeFromMatch(match: MatchState): PenaltyFullTime {
  if (match.phase !== 'fulltime') {
    throw new Error('a penalty shootout needs the full-time match state');
  }
  return { home: penaltySide(match, 0), away: penaltySide(match, 1) };
}

function penaltySide(match: MatchState, team: 0 | 1): PenaltySide {
  const openingDefs = new Map<string, PlayerDef>(
    [...match.teams[team].players, ...(match.teams[team].bench ?? [])].map(
      (def) => [def.id, def],
    ),
  );
  const first = team * 11;
  const slots = match.players.slice(first, first + 11);
  const takers = slots
    .filter((player) => player.outReason !== 'redcard')
    .map((player): PenaltyTaker => {
      const def = openingDefs.get(player.def.id) ?? player.def;
      return {
        playerId: def.id,
        name: def.name,
        role: def.role,
        sho: def.attrs.sho,
        ref: def.attrs.ref,
        condition: player.condition,
      };
    });
  if (takers.length === 0) {
    throw new Error(`team ${team} has no player left for a shootout`);
  }
  const slotKeeper = slots[0];
  const keeperId =
    slotKeeper.outReason !== 'redcard' && slotKeeper.def.role === 'GK'
      ? slotKeeper.def.id
      : (
          takers.find((taker) => taker.role === 'GK') ??
          [...takers].sort(
            (left, right) =>
              keeperD64(right) - keeperD64(left) ||
              compareIds(left.playerId, right.playerId),
          )[0]
        ).playerId;
  return { takers, keeperId };
}

/** Stable per-fixture seed, independent of the match engine's RNG stream. */
export function penaltyShootoutSeed(
  careerSeed: number,
  fixture: {
    readonly id: string;
    readonly matchSeed: number;
    readonly round: number;
  },
): number {
  const text = `${fixture.id}:${fixture.matchSeed >>> 0}:${fixture.round}:penalties`;
  let hash = (2166136261 ^ (careerSeed >>> 0)) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

/** Conversion chance in 1/65536 units for this taker against this keeper. */
export function penaltyConversion65536(
  taker: PenaltyTaker,
  keeper: PenaltyTaker,
): number {
  const contest65536 = Math.round(
    contestProbability(shootingD64(taker), keeperD64(keeper)) * 65536,
  );
  return (
    PENALTY_EQUAL_CONVERSION_65536 +
    Math.trunc(
      ((contest65536 - CONTEST_EVEN_65536) * SKILL_SPAN_NUMERATOR) /
        SKILL_SPAN_DENOMINATOR,
    )
  );
}

/**
 * Best of five with early finish, then paired sudden death.
 *
 * Each side kicks in a fixed order: outfield players by conditioned shooting
 * (stable id ties), keeper last, and nobody kicks twice until every listed
 * player has. A side with more players drops its lowest-ranked outfield
 * takers so both lists are the same length.
 */
export function resolvePenaltyShootout(
  seed: number,
  fullTime: PenaltyFullTime,
): ResolvedPenaltyShootout {
  const random = mulberry32(seed >>> 0);
  const orders = equalizedOrders(
    kickOrder(fullTime.home),
    kickOrder(fullTime.away),
  );
  const keepers: Record<PenaltySideId, PenaltyTaker> = {
    home: orders.home[orders.home.length - 1],
    away: orders.away[orders.away.length - 1],
  };
  const goals: Record<PenaltySideId, number> = { home: 0, away: 0 };
  const taken: Record<PenaltySideId, number> = { home: 0, away: 0 };
  const kicks: PenaltyKick[] = [];
  const first: PenaltySideId =
    roll65536(random) < CONTEST_EVEN_65536 ? 'home' : 'away';
  const second: PenaltySideId = first === 'home' ? 'away' : 'home';

  const kick = (side: PenaltySideId, forcedScore?: boolean): void => {
    const order = orders[side];
    const taker = order[taken[side] % order.length];
    const keeper = keepers[side === 'home' ? 'away' : 'home'];
    const scored =
      forcedScore ?? roll65536(random) < penaltyConversion65536(taker, keeper);
    kicks.push({
      side,
      takerId: taker.playerId,
      keeperId: keeper.playerId,
      scored,
    });
    taken[side] += 1;
    if (scored) goals[side] += 1;
  };
  const regulationDecided = (): boolean =>
    goals.home > goals.away + (REGULATION_KICKS - taken.away) ||
    goals.away > goals.home + (REGULATION_KICKS - taken.home);

  regulation: for (let round = 0; round < REGULATION_KICKS; round += 1) {
    for (const side of [first, second]) {
      kick(side);
      if (regulationDecided()) break regulation;
    }
  }
  for (
    let round = 0;
    goals.home === goals.away && round < MAX_SUDDEN_DEATH_ROUNDS;
    round += 1
  ) {
    kick(first);
    kick(second);
  }
  if (goals.home === goals.away) {
    const firstWins = roll65536(random) < CONTEST_EVEN_65536;
    kick(first, firstWins);
    kick(second, !firstWins);
  }
  return {
    homeGoals: goals.home,
    awayGoals: goals.away,
    kicks,
    winner: goals.home > goals.away ? 'home' : 'away',
  };
}

/**
 * Diagnostic code for an impossible saved shootout, or undefined when legal.
 *
 * Shared by the codec and Cup settlement so a corrupt or hand-edited save is
 * refused rather than shown. Checks strict alternation, the tally, the best-of-
 * five early finish, complete sudden-death pairs, one keeper per side, and the
 * repeating taker cycle.
 */
export function penaltyShootoutProblem(
  shootout: PenaltyShootout,
): string | undefined {
  const { kicks } = shootout;
  if (kicks.length < 2) return 'PENALTIES_TOO_FEW_KICKS';
  const first = kicks[0].side;
  const goals: Record<PenaltySideId, number> = { home: 0, away: 0 };
  const taken: Record<PenaltySideId, number> = { home: 0, away: 0 };
  for (let index = 0; index < kicks.length; index += 1) {
    const kick = kicks[index];
    const expected: PenaltySideId =
      index % 2 === 0 ? first : first === 'home' ? 'away' : 'home';
    if (kick.side !== expected) return 'PENALTIES_SIDE_ORDER';
    taken[kick.side] += 1;
    if (kick.scored) goals[kick.side] += 1;
    const last = index === kicks.length - 1;
    const inRegulation = index < REGULATION_KICKS * 2;
    const decided = inRegulation
      ? goals.home > goals.away + (REGULATION_KICKS - taken.away) ||
        goals.away > goals.home + (REGULATION_KICKS - taken.home)
      : index % 2 === 1 && goals.home !== goals.away;
    if (decided !== last) {
      return last ? 'PENALTIES_UNDECIDED' : 'PENALTIES_AFTER_FINISH';
    }
  }
  if (goals.home !== shootout.homeGoals || goals.away !== shootout.awayGoals)
    return 'PENALTIES_TALLY_MISMATCH';
  for (const side of ['home', 'away'] as const) {
    const own = kicks.filter((kick) => kick.side === side);
    if (new Set(own.map((kick) => kick.keeperId)).size !== 1)
      return 'PENALTIES_KEEPER_CHANGED';
    const cycle = new Set(own.map((kick) => kick.takerId)).size;
    for (let index = 0; index < own.length; index += 1) {
      const repeats = own.findIndex(
        (kick) => kick.takerId === own[index].takerId,
      );
      if (index < cycle ? repeats !== index : repeats !== index % cycle)
        return 'PENALTIES_TAKER_ORDER';
    }
  }
  return undefined;
}

function kickOrder(side: PenaltySide): PenaltyTaker[] {
  const keeper = side.takers.find((taker) => taker.playerId === side.keeperId);
  if (keeper === undefined) {
    throw new Error(`shootout keeper ${side.keeperId} is not on the pitch`);
  }
  const outfield = side.takers
    .filter((taker) => taker.playerId !== side.keeperId)
    .slice()
    .sort(
      (left, right) =>
        shootingD64(right) - shootingD64(left) ||
        compareIds(left.playerId, right.playerId),
    );
  return [...outfield, keeper];
}

function equalizedOrders(
  home: PenaltyTaker[],
  away: PenaltyTaker[],
): Record<PenaltySideId, PenaltyTaker[]> {
  const size = Math.min(home.length, away.length);
  const trim = (order: PenaltyTaker[]) =>
    order.length === size
      ? order
      : [...order.slice(0, size - 1), order[order.length - 1]];
  return { home: trim(home), away: trim(away) };
}

function shootingD64(taker: PenaltyTaker): number {
  return conditionedRatingD64(contestRating(taker.sho), taker.condition);
}

function keeperD64(keeper: PenaltyTaker): number {
  return conditionedRatingD64(contestRating(keeper.ref), keeper.condition);
}

function contestRating(value: number): number {
  return Math.min(MAX_PLAYER_ATTRIBUTE, Math.max(1, Math.round(value)));
}

function roll65536(random: Rng): number {
  return Math.floor(random() * 65536);
}
