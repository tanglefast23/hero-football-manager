import type { Attrs, PowerId } from '../sim/types';

export interface ProgressionPlayer {
  readonly id: string;
  readonly attrs: Readonly<Attrs>;
  readonly power?: PowerId;
  readonly licensed: boolean;
  readonly weeklyWage: number;
  readonly onHeroWage: boolean;
  readonly contractSeasonsRemaining: number;
}

export interface AwakeningPityState {
  readonly failedRiskyChoices: number;
}

export interface AwakeningResult {
  readonly player: ProgressionPlayer;
  readonly pityState: AwakeningPityState;
  readonly awakened: boolean;
  readonly chancePercent: number;
}

export interface FocusDrill {
  readonly id: string;
  readonly moneyCost: number;
  readonly tpCost: number;
  readonly gains: Readonly<Partial<Attrs>>;
}

export interface TrainingResources {
  readonly money: number;
  readonly tp: number;
}

export interface TrainingResult {
  readonly players: ProgressionPlayer[];
  readonly resources: TrainingResources;
}

const ATTR_NAMES = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
const ATTR_NAME_SET: ReadonlySet<string> = new Set(ATTR_NAMES);

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${label} IDs must be non-empty strings`);
    }
    if (seen.has(id)) {
      throw new Error(`${label} IDs must be unique`);
    }
    seen.add(id);
  }
}

function playersById(players: readonly ProgressionPlayer[]): ReadonlyMap<string, ProgressionPlayer> {
  assertUniqueIds(players.map(player => player.id), 'Player');
  return new Map(players.map(player => [player.id, player]));
}

/**
 * Applies the per-match hero-license selection. Owning a power is independent
 * from being licensed to use it in the next match.
 */
export function selectLicensedHeroes(
  players: readonly ProgressionPlayer[],
  selectedIds: readonly string[],
  limit = 2,
): ProgressionPlayer[] {
  assertNonNegativeInteger(limit, 'License limit');
  assertUniqueIds(selectedIds, 'Selected player');

  if (selectedIds.length > limit) {
    throw new Error(`Cannot license more than ${limit} heroes`);
  }

  const roster = playersById(players);
  for (const id of selectedIds) {
    const player = roster.get(id);
    if (!player) {
      throw new Error(`Unknown player ID: ${id}`);
    }
    if (!player.power) {
      throw new Error(`Player ${id} has no power to license`);
    }
  }

  const selected = new Set(selectedIds);
  return players.map(player => ({ ...player, licensed: selected.has(player.id) }));
}

export function awakeningChancePercent(
  failedRiskyChoices: number,
  base = 8,
  step = 6,
): number {
  assertNonNegativeInteger(failedRiskyChoices, 'Failed risky choices');
  assertNonNegativeInteger(base, 'Awakening base chance');
  assertNonNegativeInteger(step, 'Awakening pity step');

  const chance = base + failedRiskyChoices * step;
  return chance > 100 ? 100 : chance;
}

/**
 * Resolves an awakening from a pre-generated percentage roll. This function
 * consumes no ambient randomness, so callers can persist/replay the roll.
 */
export function resolveAwakening(
  player: ProgressionPlayer,
  pityState: AwakeningPityState,
  rollPercent: number,
  power: PowerId,
): AwakeningResult {
  assertNonNegativeInteger(pityState.failedRiskyChoices, 'Failed risky choices');
  if (!Number.isSafeInteger(rollPercent) || rollPercent < 0 || rollPercent > 99) {
    throw new Error('Awakening roll must be an integer from 0 to 99');
  }

  const chancePercent = awakeningChancePercent(pityState.failedRiskyChoices);

  // A hero cannot awaken twice. This is not another failed attempt, so pity is
  // preserved and the existing power remains authoritative.
  if (player.power) {
    return {
      player: { ...player },
      pityState: { ...pityState },
      awakened: false,
      chancePercent,
    };
  }

  if (rollPercent < chancePercent) {
    return {
      player: { ...player, power },
      pityState: { failedRiskyChoices: 0 },
      awakened: true,
      chancePercent,
    };
  }

  return {
    player: { ...player },
    pityState: { failedRiskyChoices: pityState.failedRiskyChoices + 1 },
    awakened: false,
    chancePercent,
  };
}

/** Returns the simple M1 renewal ask. Negotiation modifiers arrive in M2. */
export function renewalQuote(player: ProgressionPlayer, heroMultiplier: number): number {
  if (!Number.isFinite(heroMultiplier) || heroMultiplier < 3 || heroMultiplier > 5) {
    throw new Error('Hero wage multiplier must be from 3 to 5');
  }
  assertNonNegativeInteger(player.weeklyWage, 'Weekly wage');

  const quote = player.power && !player.onHeroWage
    ? Math.round(player.weeklyWage * heroMultiplier)
    : player.weeklyWage;

  if (!Number.isFinite(quote) || quote > Number.MAX_SAFE_INTEGER) {
    throw new Error('Renewal quote exceeds the supported numeric range');
  }
  return quote;
}

export function renewContract(
  player: ProgressionPlayer,
  heroMultiplier: number,
  termSeasons: number,
): ProgressionPlayer {
  if (!Number.isSafeInteger(termSeasons) || termSeasons < 1 || termSeasons > 3) {
    throw new Error('Contract term must be an integer from 1 to 3 seasons');
  }
  if (player.contractSeasonsRemaining !== 0) {
    throw new Error('A contract may be renewed only after it expires');
  }

  return {
    ...player,
    weeklyWage: renewalQuote(player, heroMultiplier),
    onHeroWage: player.power ? true : player.onHeroWage,
    contractSeasonsRemaining: termSeasons,
  };
}

function validateDrill(drill: FocusDrill): void {
  if (typeof drill.id !== 'string' || drill.id.length === 0) {
    throw new Error('Drill IDs must be non-empty strings');
  }
  assertNonNegativeInteger(drill.moneyCost, `Money cost for drill ${drill.id}`);
  assertNonNegativeInteger(drill.tpCost, `TP cost for drill ${drill.id}`);

  for (const [attribute, gain] of Object.entries(drill.gains)) {
    if (!ATTR_NAME_SET.has(attribute)) {
      throw new Error(`Unknown attribute gain: ${attribute}`);
    }
    assertNonNegativeInteger(gain as number, `${attribute} gain for drill ${drill.id}`);
  }
}

function validatePlayerAttrs(player: ProgressionPlayer): void {
  for (const attribute of ATTR_NAMES) {
    const value = player.attrs[attribute];
    if (!Number.isSafeInteger(value) || value < 1 || value > 99) {
      throw new Error(
        `Player ${player.id} attribute ${attribute} must be a safe integer from 1 to 99`,
      );
    }
  }
}

export function applyTrainingPlan(
  players: readonly ProgressionPlayer[],
  assignedPlayerIds: readonly string[],
  drills: readonly FocusDrill[],
  resources: TrainingResources,
): TrainingResult {
  if (drills.length > 3) {
    throw new Error('A training plan may contain at most 3 focus drills');
  }
  assertNonNegativeInteger(resources.money, 'Available money');
  assertNonNegativeInteger(resources.tp, 'Available TP');
  assertUniqueIds(assignedPlayerIds, 'Assigned player');
  assertUniqueIds(drills.map(drill => drill.id), 'Drill');

  const roster = playersById(players);
  for (const player of players) {
    validatePlayerAttrs(player);
  }
  for (const id of assignedPlayerIds) {
    if (!roster.has(id)) {
      throw new Error(`Unknown player ID: ${id}`);
    }
  }

  let moneyCost = 0;
  let tpCost = 0;
  for (const drill of drills) {
    validateDrill(drill);
    moneyCost += drill.moneyCost;
    tpCost += drill.tpCost;
  }

  if (!Number.isSafeInteger(moneyCost) || !Number.isSafeInteger(tpCost)) {
    throw new Error('Training cost exceeds the supported integer range');
  }
  if (moneyCost > resources.money || tpCost > resources.tp) {
    throw new Error('Training plan is not affordable');
  }

  const assigned = new Set(assignedPlayerIds);
  const nextPlayers = players.map(player => {
    if (!assigned.has(player.id)) return player;

    const attrs: Attrs = { ...player.attrs };
    for (const drill of drills) {
      for (const attribute of ATTR_NAMES) {
        const gain = drill.gains[attribute];
        if (gain === undefined) continue;

        const nextValue = attrs[attribute] + gain;
        attrs[attribute] = nextValue > 99 ? 99 : nextValue;
      }
    }
    return { ...player, attrs };
  });

  return {
    players: nextPlayers,
    resources: {
      money: resources.money - moneyCost,
      tp: resources.tp - tpCost,
    },
  };
}
