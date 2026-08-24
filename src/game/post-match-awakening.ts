import { mulberry32 } from '../sim/rng';
import type { PowerId } from '../sim/types';
import {
  awakeningPowerRollSize,
  chooseStatWeightedAwakeningPower,
} from './career-events';
import type { GameState } from './types';
import { powerIsCompatibleWithRole } from './power-catalog';
import { hasActiveCareerContractPromise } from './contract-promises';
import { isAvailableForSelection } from './lineup';
import { leagueWeekForRound } from './schedule';
import { tryRepairCareerLineupForInjuries } from './squad';

interface PostMatchAwakeningTuning {
  /**
   * Percentage points the roll gains for every week of the season. See
   * `awakeningChancePercent`.
   */
  weeklyChanceStepPercent: number;
  /** Heroes a season may earn. Season 1 gets one more: its opener is free. */
  maxPerSeason: number;
  minimumMatchesBetween: number;
}

/**
 * The roll a match faces, from the week it is played in.
 *
 * The chance opens at one step on the season's first league week and adds a
 * step every week after it, Cup and rest weeks included, until it reaches 100.
 * A flat chance could miss for a whole year; this one cannot, so a season
 * always ends with its hero and the wait itself is the tension. The climb
 * restarts every season because it is measured from that season's own first
 * league week.
 */
export function awakeningChancePercent(
  weeklyChanceStepPercent: number,
  season: number,
  week: number,
): number {
  const weeksElapsed = Math.max(1, week - leagueWeekForRound(1, season) + 1);
  return Math.min(100, weeklyChanceStepPercent * weeksElapsed);
}

/**
 * Heroes already awakened in the season being played.
 *
 * The tally carries the season it counted, so a tally left over from a
 * finished season reads as zero without anything having to clear it on the
 * boundary — and a save written before the cap existed reads the same way.
 */
export function awakeningsThisSeason(state: GameState): number {
  const tally = state.awakening.seasonTally;
  return tally?.season === state.season ? tally.count : 0;
}

interface PostMatchAwakeningResult {
  state: GameState;
  awakened: boolean;
}

/**
 * Resolves the single automatic awakening check after the user's match.
 * The first created player is guaranteed; later checks are deterministic from
 * the career seed + fixture ID, become eligible on the third match after the
 * previous awakening, and roll against a chance that climbs each week of the
 * season until it is certain.
 */
export function resolvePostMatchAwakening(
  state: GameState,
  fixtureId: string,
  participantIds: readonly string[],
  powerIds: readonly PowerId[],
  triggerIds: readonly string[],
  tuning: PostMatchAwakeningTuning,
): PostMatchAwakeningResult {
  validateTuning(tuning);
  validatePowerIds(powerIds);
  validateTriggerIds(triggerIds);
  if (state.awakening.pending !== undefined) {
    throw new Error('the previous awakening cutscene must finish first');
  }
  const fixture = state.fixtures.find(
    (candidate) => candidate.id === fixtureId,
  );
  if (fixture === undefined || fixture.status !== 'played') {
    throw new Error('post-match awakening requires the completed fixture');
  }
  if (
    fixture.homeClubId !== state.userClubId &&
    fixture.awayClubId !== state.userClubId
  ) {
    throw new Error('post-match awakening requires the user fixture');
  }

  const firstHero =
    state.onboarding?.firstFixtureId === fixtureId &&
    (state.onboarding.stage === 'first-match' ||
      state.onboarding.stage === 'collapse');
  const alreadyThisSeason = awakeningsThisSeason(state);
  const matchesSinceLastAwakening =
    state.awakening.matchesSinceLastAwakening + 1;
  let playerId: string | undefined;

  if (firstHero) {
    playerId = state.onboarding?.createdPlayerId;
    if (playerId === undefined)
      throw new Error('the first awakening is missing the created player');
    if (!participantIds.includes(playerId)) {
      throw new Error(
        'the created player must take part in the first awakening match',
      );
    }
  } else {
    const nextWithoutAwakening = (): PostMatchAwakeningResult => ({
      state: {
        ...state,
        awakening: {
          ...state.awakening,
          matchesSinceLastAwakening,
          pending: undefined,
        },
      },
      awakened: false,
    });
    // A season the club has already filled is done producing heroes. Season 1
    // is allowed one extra because its opening hero is a free campaign gift;
    // every later year makes at most one, so the squad cannot turn super.
    const seasonCap = tuning.maxPerSeason + (state.season === 1 ? 1 : 0);
    if (alreadyThisSeason >= seasonCap) {
      return nextWithoutAwakening();
    }
    if (matchesSinceLastAwakening < tuning.minimumMatchesBetween) {
      return nextWithoutAwakening();
    }
    const chancePercent = awakeningChancePercent(
      tuning.weeklyChanceStepPercent,
      fixture.season,
      fixture.week,
    );
    if (
      deterministicPostMatchAwakeningRoll(
        state.careerSeed,
        fixtureId,
        0,
        100,
      ) >= chancePercent
    ) {
      return nextWithoutAwakening();
    }
    const eligible = unique(participantIds).filter((id) =>
      state.players.some(
        (player) =>
          player.id === id &&
          player.clubId === state.userClubId &&
          player.power === undefined &&
          powerIds.some((power) =>
            powerIsCompatibleWithRole(power, player.role),
          ) &&
          canSafelyAwaken(state, id),
      ),
    );
    if (eligible.length === 0) return nextWithoutAwakening();
    playerId =
      eligible[
        deterministicPostMatchAwakeningRoll(
          state.careerSeed,
          fixtureId,
          1,
          eligible.length,
        )
      ];
  }

  const player = state.players.find(
    (candidate) =>
      candidate.id === playerId && candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown awakening player ${String(playerId)}`);
  if (player.power !== undefined)
    throw new Error('the selected awakening player is already a hero');
  if (
    firstHero &&
    state.players.some(
      (candidate) =>
        candidate.clubId === state.userClubId && candidate.power !== undefined,
    )
  ) {
    throw new Error('the created player must be the campaign first hero');
  }

  const hasPoweredTeammate = state.players.some(
    (candidate) =>
      candidate.id !== playerId &&
      candidate.clubId === state.userClubId &&
      candidate.power !== undefined,
  );
  // Rally Cry is intentionally a squad-synergy power. It cannot be the first
  // or only awakening because there would be nobody for it to accelerate.
  const compatiblePowerIds = powerIds.filter(
    (power) =>
      powerIsCompatibleWithRole(power, player.role) &&
      (power !== 'RALLY_CRY' || hasPoweredTeammate),
  );
  if (compatiblePowerIds.length === 0) {
    throw new Error(`no awakening power is compatible with ${player.role}`);
  }
  const powerRollSize = awakeningPowerRollSize(
    compatiblePowerIds,
    player.attrs,
  );
  const power = chooseStatWeightedAwakeningPower(
    compatiblePowerIds,
    player.attrs,
    deterministicPostMatchAwakeningRoll(
      state.careerSeed,
      fixtureId,
      2,
      powerRollSize,
    ),
  );
  const unusedTriggerIds = triggerIds.filter(
    (id) => !state.awakening.usedTriggerIds.includes(id),
  );
  const triggerPool =
    unusedTriggerIds.length > 0 ? unusedTriggerIds : triggerIds;
  // Keep the campaign's first awakening recognizable and reviewable; later
  // awakenings rotate deterministically through the remaining visual causes.
  const triggerId = firstHero
    ? triggerIds[0]
    : triggerPool[
        deterministicPostMatchAwakeningRoll(
          state.careerSeed,
          fixtureId,
          3,
          triggerPool.length,
        )
      ];
  const usedTriggerIds =
    unusedTriggerIds.length > 0
      ? [...state.awakening.usedTriggerIds, triggerId]
      : state.awakening.usedTriggerIds;
  const nextPlayers = state.players.map((candidate) =>
    candidate.id === playerId
      ? {
          ...candidate,
          power,
          powerTier: 1 as const,
          // The campaign's first hero is a free story gift. Later awakenings
          // create a hero, not a hidden permit decision: the manager assigns a
          // license explicitly after the reveal.
          licensed: firstHero,
        }
      : candidate,
  );
  const awakenedState: GameState = {
    ...state,
    players: nextPlayers,
    awakening: {
      matchesSinceLastAwakening: 0,
      usedTriggerIds,
      seasonTally: { season: state.season, count: alreadyThisSeason + 1 },
      pending: { fixtureId, playerId, power, triggerId, firstHero },
    },
    ...(firstHero && state.onboarding
      ? {
          onboarding: {
            ...state.onboarding,
            stage: 'reveal' as const,
            awakenedPower: power,
          },
        }
      : {}),
  };
  const next = firstHero
    ? awakenedState
    : tryRepairCareerLineupForInjuries(awakenedState);
  if (next === undefined) {
    throw new Error(
      'the unlicensed awakening player has no safe bench replacement',
    );
  }
  return { state: next, awakened: true };
}

export function completePostMatchAwakening(state: GameState): GameState {
  const pending = state.awakening.pending;
  if (pending === undefined)
    throw new Error('there is no awakening cutscene to complete');
  if (pending.firstHero && state.onboarding?.stage !== 'reveal') {
    throw new Error('the first awakening reveal is not ready');
  }
  return {
    ...state,
    awakening: {
      matchesSinceLastAwakening: state.awakening.matchesSinceLastAwakening,
      usedTriggerIds: [...state.awakening.usedTriggerIds],
      // Dropping the tally here would hand the season a fresh allowance every
      // time a cutscene finished, which is every time one is spent.
      ...(state.awakening.seasonTally === undefined
        ? {}
        : { seasonTally: { ...state.awakening.seasonTally } }),
    },
    ...(pending.firstHero && state.onboarding
      ? {
          onboarding: { ...state.onboarding, stage: 'complete' as const },
        }
      : {}),
  };
}

export function deterministicPostMatchAwakeningRoll(
  careerSeed: number,
  fixtureId: string,
  stream: number,
  upperExclusive: number,
): number {
  if (
    !Number.isInteger(careerSeed) ||
    careerSeed < 0 ||
    careerSeed > 4294967295
  ) {
    throw new Error('awakening career seed must be a uint32');
  }
  if (fixtureId.trim().length === 0)
    throw new Error('awakening fixture ID must not be empty');
  if (!Number.isSafeInteger(stream) || stream < 0) {
    throw new Error('awakening RNG stream must be a nonnegative safe integer');
  }
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new Error(
      'awakening RNG upper bound must be a positive safe integer',
    );
  }
  const seed =
    (careerSeed ^
      Math.imul(hashString(fixtureId), 0x9e3779b1) ^
      Math.imul(stream + 1, 0x85ebca6b)) >>>
    0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

function validateTuning(tuning: PostMatchAwakeningTuning): void {
  if (
    !Number.isInteger(tuning.weeklyChanceStepPercent) ||
    tuning.weeklyChanceStepPercent < 1 ||
    tuning.weeklyChanceStepPercent > 100
  ) {
    throw new Error(
      'weekly awakening chance step must be an integer from 1 to 100',
    );
  }
  if (!Number.isSafeInteger(tuning.maxPerSeason) || tuning.maxPerSeason < 1) {
    throw new Error('awakenings per season must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(tuning.minimumMatchesBetween) ||
    tuning.minimumMatchesBetween < 0
  ) {
    throw new Error(
      'awakening match cooldown must be a nonnegative safe integer',
    );
  }
}

function validatePowerIds(powerIds: readonly PowerId[]): void {
  if (powerIds.length === 0)
    throw new Error('post-match awakening needs at least one power');
  if (new Set(powerIds).size !== powerIds.length) {
    throw new Error('post-match awakening power IDs must be unique');
  }
}

function validateTriggerIds(triggerIds: readonly string[]): void {
  if (triggerIds.length === 0)
    throw new Error('post-match awakening needs at least one trigger');
  if (triggerIds.some((id) => id.trim().length === 0)) {
    throw new Error('post-match awakening trigger IDs must not be empty');
  }
  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new Error('post-match awakening trigger IDs must be unique');
  }
}

function canSafelyAwaken(state: GameState, playerId: string): boolean {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) return false;
  if (
    isAvailableForSelection(player) &&
    (hasActiveCareerContractPromise(player, 'GUARANTEED_STARTER') ||
      hasActiveCareerContractPromise(player, 'CAPTAINCY'))
  )
    return false;
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined || !lineup.playerIds.includes(playerId)) return true;
  return (
    replacementForAwakenedStarter(state, lineup.playerIds, playerId) !==
    undefined
  );
}

function replacementForAwakenedStarter(
  state: GameState,
  lineupIds: readonly string[],
  playerId: string,
): string | undefined {
  const selected = state.players.find((player) => player.id === playerId);
  if (selected === undefined) return undefined;
  const lineupSet = new Set(lineupIds);
  const bench = state.players.filter(
    (player) =>
      player.clubId === state.userClubId &&
      !lineupSet.has(player.id) &&
      player.power === undefined &&
      isAvailableForSelection(player),
  );
  return (
    bench.find((player) => player.role === selected.role)?.id ??
    (selected.role === 'GK'
      ? undefined
      : bench.find((player) => player.role !== 'GK')?.id)
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
