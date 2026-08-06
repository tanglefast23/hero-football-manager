import { recordCashTransaction } from './cash-transactions';
import { careerDifficulty } from './difficulty';
import { chooseWeightedOutcome, deterministicCareerEventRoll } from './event-clock';
import { isAvailableForSelection } from './lineup';
import { adjustLoyalty, playerLoyalty } from './loyalty';
import { compareIds } from './ordering';
import { repairCareerLineupForInjuries } from './squad';
import type {
  ActiveRequestEffect,
  CareerPlayer,
  DifficultyMode,
  GameState,
  PlayerRequestCatalog,
  PlayerRequestCost,
  PlayerRequestDefinition,
  PlayerRequestResolution,
  PlayerRequestState,
  PlayerSeasonStatLine,
} from './types';

interface RequestCadence {
  readonly minWeeks: number;
  readonly guaranteeWeeks: number;
  readonly starMinWeeks: number;
  readonly starGuaranteeWeeks: number;
}

/**
 * The catalog is always INJECTED, never loaded in this module.
 *
 * No production module under `src/game/` imports the content loader — the ring
 * is pure TypeScript over plain data. Calling `loadLaunchContent()` here would
 * couple the career engine to JSON parsing, make every headless harness run pay
 * a zod pass it does not need, and leave tests no way to substitute a small
 * catalog. Callers in the application layer already hold parsed content.
 */
export function requestDefinition(
  catalog: PlayerRequestCatalog,
  requestId: string,
): PlayerRequestDefinition {
  const definition = catalog.requests.find(candidate => candidate.id === requestId);
  if (definition === undefined) throw new Error(`unknown player request ${requestId}`);
  return definition;
}

/**
 * The odds a quiet week produces a request, rising with the drought.
 *
 * Shaped like `quietWeekEventChancePercent` in `event-clock.ts`, and for the
 * same reason: a flat weekly chance makes long silences feel like the game
 * forgot about you, and a hard "guaranteed on week N" makes the wait feel
 * scripted. The difference is the floor — nothing can happen before `minWeeks`,
 * so the gap between requests is an exact window rather than a distribution
 * with a long left tail that would occasionally deal two in three weeks.
 */
export function requestChancePercent(
  weeksSinceRequest: number,
  cadence: RequestCadence,
  hasStar: boolean,
  baseChancePercent: number,
): number {
  if (!Number.isInteger(weeksSinceRequest) || weeksSinceRequest < 0) {
    throw new Error('weeks since the last request must be a nonnegative integer');
  }
  const minWeeks = hasStar ? cadence.starMinWeeks : cadence.minWeeks;
  const guaranteeWeeks = hasStar ? cadence.starGuaranteeWeeks : cadence.guaranteeWeeks;
  if (weeksSinceRequest < minWeeks) return 0;
  if (weeksSinceRequest >= guaranteeWeeks) return 100;

  const progress = (weeksSinceRequest - minWeeks) / (guaranteeWeeks - minWeeks);
  // Eased, not linear: the first week past the floor barely moves the odds and
  // the last one moves them a lot, so the wait reads as patience running out
  // rather than a countdown ticking down in public.
  return Math.round(baseChancePercent + (100 - baseChancePercent) * progress * progress);
}

/**
 * Player ids in the top `rank` of the division for league goals this season.
 *
 * Cup rows are skipped so this stays a division board: goals scored against
 * another division never made a player his own division's top scorer. Rows are
 * summed per player because a player sold mid-season keeps one stat line per
 * club, and half a season each would rank him below where he actually finished.
 */
export function starQualifiers(
  statLines: readonly Pick<PlayerSeasonStatLine, 'season' | 'competition' | 'playerId' | 'goals'>[],
  season: number,
  rank: number,
): string[] {
  const goalsByPlayerId = new Map<string, number>();
  for (const line of statLines) {
    if (line.season !== season || line.competition !== 'league') continue;
    goalsByPlayerId.set(line.playerId, (goalsByPlayerId.get(line.playerId) ?? 0) + line.goals);
  }

  return [...goalsByPlayerId]
    .filter(([, goals]) => goals > 0)
    .sort(([leftId, leftGoals], [rightId, rightGoals]) => (
      rightGoals - leftGoals || compareIds(leftId, rightId)
    ))
    .slice(0, rank)
    .map(([playerId]) => playerId);
}

/**
 * Where a squad player stops being anonymous.
 *
 * Fallback only; the shipped value is authored as `tuning.starFameThreshold`
 * and the two must agree.
 *
 * This number has been wrong twice, in opposite directions, and both times
 * because it was reasoned about rather than measured against the fame a squad
 * actually reaches.
 *
 * At 50, with the fame ceiling at 99, every starter cleared it inside a season.
 * `hasStar` was true from season 2 in every career ever played and the non-star
 * half of `tuning.cadence` never executed.
 *
 * The ceiling then moved to 999 and this was scaled to 200 — ×4, taken off the
 * old number instead of off the new curve. `player-request-cadence-probe`
 * measured the result through the real match engine: top squad fame reaches
 * 120-142 by season six, so `hasStar` was false for all 146 recorded weeks
 * across three seeds. The same dead-row bug, now at the other end.
 *
 * 120 sits just under where a first-choice player arrives around season four or
 * five, so a star is earned partway through a climb rather than issued at the
 * start or never. Re-measure with the probe before moving it again.
 */
export const STAR_FAME_THRESHOLD = 120;

/**
 * Base 1, doubled once per star qualifier met, so a famous division top scorer
 * asks four times as often as an anonymous squad player.
 *
 * The qualifier list is a parameter rather than a hard-coded fame test so the
 * assists, tackles and saves boards from the separate division-leaders work can
 * drop in later without touching this function. The fame threshold is a
 * parameter for the same reason: a tuning value nothing reads is a knob that
 * lies about being adjustable.
 */
export function weightForPlayer(
  player: Pick<CareerPlayer, 'id' | 'fame'>,
  qualifierIds: readonly string[],
  fameThreshold: number = STAR_FAME_THRESHOLD,
): number {
  let weight = 1;
  if ((player.fame ?? 0) >= fameThreshold) weight *= 2;
  if (qualifierIds.includes(player.id)) weight *= 2;
  return weight;
}

interface EligibilityContext {
  readonly lastAskingPlayerId?: string;
  /**
   * Seasons, not weeks. `CareerPlayer` has `seasonsAtClub` and no finer tenure,
   * so a "four weeks at the club" rule cannot be honestly implemented and is
   * not pretended at. A player signed this season reads as 0.
   */
  readonly minSeasonsAtClub: number;
  /** True when the drawn request would take the player away from matches. */
  readonly absence: boolean;
  /**
   * Whether the starting eleven survives this player's leave. Optional because
   * the answer needs the whole game state, which pure pool tests do not have;
   * `advancePlayerRequests` always supplies it, via the exact lineup-repair
   * path a granted absence runs. Without it, a bare-eleven roster — reachable
   * through player sales — could be OFFERED a leave request whose grant throws
   * inside lineup repair.
   */
  readonly lineupSurvivesAbsence?: (player: CareerPlayer) => boolean;
}

/**
 * A transfer request is not a vow of silence.
 *
 * Wanting a move and wanting a new gym are different things, so
 * `transferRequested` is deliberately NOT tested here. It used to be, and it
 * cost the feature half its life: measured over six seasons and three seeds
 * with the production engine, 14–15 of a 16-man squad are legitimately listed
 * by season 3 — not stale flags, every one of them would ask again today — and
 * the tab fell silent for 43–52% of settled weeks, in stretches over 20 weeks
 * long, even for a manager who granted every request on sight. The drought
 * arrived exactly when a struggling club most needed the beat.
 *
 * The same reasoning removed the listing test from
 * `cancelPendingPlayerRequestIfInvalid`: a request must not evaporate because
 * its asker's mood dipped in the days after he made it.
 */
export function eligibleAskers(
  roster: readonly CareerPlayer[],
  context: EligibilityContext,
): CareerPlayer[] {
  const fitKeepers = roster.filter(
    player => player.role === 'GK' && isAvailableForSelection(player),
  );
  return roster.filter(player => {
    if (!isAvailableForSelection(player)) return false;
    if (player.id === context.lastAskingPlayerId) return false;
    if ((player.seasonsAtClub ?? 0) < context.minSeasonsAtClub) return false;
    // Sending away the only fit keeper leaves no legal XI, so the request is
    // never offered rather than being offered and then failing to apply.
    if (context.absence && player.role === 'GK' && fitKeepers.length <= 1) return false;
    // The same rule for every starter: a leave the lineup cannot repair is
    // never offered rather than being offered and then throwing on Grant.
    if (context.absence && context.lineupSurvivesAbsence?.(player) === false) return false;
    return true;
  });
}

/** Weighted pick from a roll in `[0, totalAskerWeight)`. */
export function pickAsker(
  pool: readonly CareerPlayer[],
  qualifierIds: readonly string[],
  roll: number,
  fameThreshold: number = STAR_FAME_THRESHOLD,
): CareerPlayer | undefined {
  if (pool.length === 0) return undefined;
  return pool[chooseWeightedOutcome(
    pool.map(player => weightForPlayer(player, qualifierIds, fameThreshold)),
    roll,
  )];
}

/** Total weight of a pool, for sizing the roll. */
export function totalAskerWeight(
  pool: readonly CareerPlayer[],
  qualifierIds: readonly string[],
  fameThreshold: number = STAR_FAME_THRESHOLD,
): number {
  return pool.reduce(
    (sum, player) => sum + weightForPlayer(player, qualifierIds, fameThreshold),
    0,
  );
}

interface RequestPricingContext {
  readonly playerWeeklyWage: number;
  readonly squadWeeklyWageBill: number;
}

/**
 * Money asks are priced off wages, never off the cash balance.
 *
 * A percentage of cash looks self-scaling and is not. The economy is fail-soft
 * and a club may legitimately sit below zero, where a percentage of the balance
 * is a payment TO the manager for granting a request; and at a low balance
 * every ask becomes free, so a struggling club would farm loyalty for nothing.
 * Wages scale with division, squad quality and hero status on their own, are
 * never negative, and make a star's demands cost more than a reserve's — which
 * is what the fiction wants anyway.
 */
export function requestMoneyCost(
  cost: PlayerRequestCost,
  context: RequestPricingContext,
): number | undefined {
  if (cost.kind === 'MONEY_PLAYER') {
    return Math.max(1, Math.round(context.playerWeeklyWage * cost.wageMultiple));
  }
  if (cost.kind === 'MONEY_SQUAD') {
    return Math.max(1, Math.round(context.squadWeeklyWageBill * cost.billMultiplePercent / 100));
  }
  return undefined;
}

/** Cozy never loses a player for more than one week. */
export function absenceWeeksFor(authoredWeeks: number, difficulty: DifficultyMode): number {
  return difficulty === 'COZY' ? Math.min(1, authoredWeeks) : authoredWeeks;
}

type RequestTarget = 'PLAYER' | 'SQUAD';

interface RequestDelta {
  readonly loyalty: number;
  readonly morale: number;
}

interface RequestDeltas {
  /** Applied to the asking player alone, on top of any squad delta. */
  readonly asker: RequestDelta;
  /** Applied to every user-club player, the asker included. */
  readonly squad: RequestDelta;
}

const NO_DELTA: RequestDelta = { loyalty: 0, morale: 0 };

/** Which requests hit the whole squad rather than one player. */
export function requestTarget(cost: PlayerRequestCost): RequestTarget {
  return cost.kind === 'MONEY_SQUAD'
    || cost.kind === 'CONDITION_SQUAD'
    || cost.kind === 'DRILL_SQUAD'
    ? 'SQUAD'
    : 'PLAYER';
}

/**
 * A lapse costs exactly what a refusal costs.
 *
 * The second-week inbox notice prints the number, so the manager was told. A
 * discount for ignoring it would make silence cheaper than deciding, which is
 * the opposite of the lesson.
 */
export function resolutionDeltas(
  resolution: PlayerRequestResolution,
  target: RequestTarget,
  difficulty: DifficultyMode,
): RequestDeltas {
  if (resolution === 'GRANTED') {
    return {
      asker: { loyalty: 5, morale: 5 },
      squad: target === 'SQUAD' ? { loyalty: 2, morale: 5 } : NO_DELTA,
    };
  }
  const cozy = difficulty === 'COZY';
  return {
    asker: cozy ? { loyalty: -3, morale: -4 } : { loyalty: -5, morale: -8 },
    squad: target !== 'SQUAD'
      ? NO_DELTA
      : cozy
        ? { loyalty: -1, morale: -2 }
        : { loyalty: -2, morale: -3 },
  };
}

/** How many settled decisions the tab remembers. */
export const MAX_PLAYER_REQUEST_HISTORY = 20;

export const DEFAULT_PLAYER_REQUEST_STATE: PlayerRequestState = {
  weeksSinceRequest: 0,
  effects: [],
  history: [],
};

/**
 * You cannot grant what the club does not have.
 *
 * NOT the difficulty cash floor. Every other discretionary purchase in the game
 * guards on `club.cash < cost` — scouting (`market-career.ts`), youth signings,
 * transfers, drill upgrades — and the fail-soft floor exists for obligations a
 * manager cannot avoid, wages and upkeep, not for luxuries. Spending past zero
 * would also record a negative `balanceAfter`, which the cash-transaction schema
 * rejects as a nonnegative integer: a career that cannot be saved.
 */
export function canAffordRequest(state: GameState): boolean {
  const pending = state.playerRequests?.pending;
  if (pending?.costAmount === undefined) return true;
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club.cash >= pending.costAmount;
}

/** Settles the open request, applying its cost, its rewards and its record. */
export function resolvePlayerRequest(
  state: GameState,
  catalog: PlayerRequestCatalog,
  resolution: PlayerRequestResolution,
): GameState {
  const requests = state.playerRequests;
  const pending = requests?.pending;
  if (requests === undefined || pending === undefined) {
    throw new Error('no pending request to resolve');
  }
  // The UI disables Grant below the line, but the pure API is the contract.
  // A disabled button is a courtesy; this is the rule.
  if (resolution === 'GRANTED' && !canAffordRequest(state)) {
    throw new Error('the club cannot afford this request');
  }

  const definition = requestDefinition(catalog, pending.requestId);
  const difficulty = careerDifficulty(state);
  const target = requestTarget(definition.cost);
  const deltas = resolutionDeltas(resolution, target, difficulty);
  const granted = resolution === 'GRANTED';

  // Condition only moves on a grant: refusing a night out costs feelings, not
  // legs. A themed bonus can offset the cost of the same request.
  const conditionDelta = !granted
    ? 0
    : (definition.cost.kind === 'CONDITION_SQUAD' ? -definition.cost.amount : 0)
      + (definition.grantBonus?.kind === 'CONDITION_SQUAD' ? definition.grantBonus.amount : 0);
  const bonusMorale = granted && definition.grantBonus?.kind === 'MORALE_SQUAD'
    ? definition.grantBonus.amount
    : 0;
  const awayWeeks = granted && definition.cost.kind === 'ABSENCE'
    ? absenceWeeksFor(definition.cost.weeks, difficulty)
    : 0;

  const players = state.players.map(player => {
    if (player.clubId !== state.userClubId) return player;
    const isAsker = player.id === pending.playerId;
    const loyaltyDelta = deltas.squad.loyalty + (isAsker ? deltas.asker.loyalty : 0);
    const moraleDelta = deltas.squad.morale
      + bonusMorale
      + (isAsker ? deltas.asker.morale : 0);

    return {
      ...player,
      loyalty: adjustLoyalty(playerLoyalty(player, state.careerSeed), loyaltyDelta),
      morale: Math.max(0, Math.min(100, player.morale + moraleDelta)),
      condition: Math.max(0, Math.min(100, (player.condition ?? 100) + conditionDelta)),
      ...(isAsker && awayWeeks > 0 ? { awayWeeks } : {}),
    };
  });

  const cost = granted ? pending.costAmount ?? 0 : 0;
  // Charge first, then record. `recordCashTransaction` stamps `balanceAfter`
  // from the club's current cash and mutates nothing, so handing it unchanged
  // state would log a spend that never happened. Same order as scouting and
  // transfers.
  const charged: GameState = cost === 0
    ? { ...state, players }
    : {
        ...state,
        players,
        clubs: state.clubs.map(club => (club.id === state.userClubId
          ? { ...club, cash: club.cash - cost }
          : club)),
      };
  const spent = cost === 0
    ? charged
    : recordCashTransaction(charged, {
        kind: 'player-request',
        label: definition.title,
        amount: -cost,
        referenceId: pending.requestId,
      });

  const settled: GameState = {
    ...spent,
    playerRequests: {
      weeksSinceRequest: 0,
      effects: [...requests.effects, ...grantedEffects(definition.cost, pending.playerId, granted)],
      history: [
        {
          requestId: pending.requestId,
          playerId: pending.playerId,
          season: state.season,
          week: state.week,
          resolution,
          ...(cost === 0 ? {} : { costAmount: cost }),
        },
        ...requests.history,
      ].slice(0, MAX_PLAYER_REQUEST_HISTORY),
      lastAskingPlayerId: pending.playerId,
    },
  };

  // Granting leave benches a starter, and nothing else would notice until
  // Saturday — when buildCareerTeamDef would throw. Repair now, through the
  // same path weekly settlement and the injury drill already use.
  return awayWeeks > 0 ? repairCareerLineupForInjuries(settled) : settled;
}

/**
 * Request effects are their own list, never `contractPromise`.
 *
 * `contractPromise` holds a single object per player, so writing one here would
 * silently destroy whatever was agreed at the negotiating table. Only the two
 * drill effects exist; the status requests that would have needed a perk were
 * cut from v1 for exactly this reason.
 */
function grantedEffects(
  cost: PlayerRequestCost,
  playerId: string,
  granted: boolean,
): ActiveRequestEffect[] {
  if (!granted) return [];
  if (cost.kind === 'DRILL_PLAYER') {
    return [{
      kind: 'DRILL_PLAYER',
      playerId,
      weeksRemaining: cost.weeks,
      multiplierPercent: cost.multiplierPercent,
    }];
  }
  if (cost.kind === 'DRILL_SQUAD') {
    return [{
      kind: 'DRILL_SQUAD',
      weeksRemaining: cost.weeks,
      multiplierPercent: cost.multiplierPercent,
    }];
  }
  return [];
}

/** One week of decay; an effect that reaches zero is gone. */
export function tickRequestEffects(
  effects: readonly ActiveRequestEffect[],
): ActiveRequestEffect[] {
  return effects
    .map(effect => ({ ...effect, weeksRemaining: effect.weeksRemaining - 1 }))
    .filter(effect => effect.weeksRemaining > 0);
}

/** Drill gain scale for one player, squad and personal effects compounded. */
export function drillMultiplierPercent(
  effects: readonly ActiveRequestEffect[],
  playerId: string,
): number {
  return effects.reduce((percent, effect) => {
    const applies = effect.kind === 'DRILL_SQUAD'
      || (effect.kind === 'DRILL_PLAYER' && effect.playerId === playerId);
    return applies ? Math.round(percent * (effect.multiplierPercent ?? 100) / 100) : percent;
  }, 100);
}

/**
 * Clears a pending request that no longer makes sense, with no penalty.
 *
 * Called from the weekly tick AND from the mid-week transfer sale, because
 * waiting for settlement would leave the tab offering Grant on a player who has
 * already left the club.
 *
 * The board's forced sale deliberately has no hook of its own: it runs inside
 * weekly settlement, before `advancePlayerRequests`, so the tick already clears
 * it — and `board-ultimatum` importing this module would close a cycle back
 * through `squad`. Retirement is covered by the season transition, which resets
 * the request clock outright.
 *
 * Leaving the club is the only thing that invalidates an ask. Asking for a
 * transfer no longer does: see `eligibleAskers` for why a listed player may
 * still make one, and granting his ask is now a way to talk him round, since a
 * grant pays +5 morale toward the mood he must reach to withdraw.
 */
export function cancelPendingPlayerRequestIfInvalid(state: GameState): GameState {
  const pending = state.playerRequests?.pending;
  if (pending === undefined) return state;
  const asker = state.players.find(player => player.id === pending.playerId);
  const stillValid = asker !== undefined
    && asker.clubId === state.userClubId;
  if (stillValid) return state;
  return { ...state, playerRequests: { ...state.playerRequests!, pending: undefined } };
}

/**
 * One settled week: leave counts down, effects decay, a stale request is warned
 * and then lapsed, and a quiet week may produce a new ask.
 *
 * `openRequests` is false on the season-end path — requests are a
 * management-week beat, and dealing a card on the week the season ends would
 * hand the manager something they cannot act on before the clock resets.
 *
 * Every draw is seeded from persisted career data through
 * `deterministicCareerEventRoll`, so saving and reloading the same week cannot
 * re-roll who asks or what they want. There is no settled-week stamp, so this
 * is safe only while it runs exactly once per settlement: never call it from a
 * view model or a desk reconcile.
 */
export function advancePlayerRequests(state: GameState, openRequests: boolean): GameState {
  const catalog = state.playerRequestRules;
  if (catalog === undefined) return state;
  const requests = state.playerRequests ?? DEFAULT_PLAYER_REQUEST_STATE;
  const tuning = catalog.tuning;

  const players = state.players.map(player => ((player.awayWeeks ?? 0) > 0
    ? { ...player, awayWeeks: player.awayWeeks! - 1 }
    : player));
  let next: GameState = cancelPendingPlayerRequestIfInvalid({
    ...state,
    players,
    playerRequests: { ...requests, effects: tickRequestEffects(requests.effects) },
  });

  const started = state.season > tuning.startSeason
    || (state.season === tuning.startSeason && state.week >= tuning.startWeek);
  if (!started || !openRequests) return next;

  const pending = next.playerRequests!.pending;
  if (pending !== undefined) {
    const weeksWaiting = state.week - pending.askedWeek;
    if (weeksWaiting >= tuning.answerWeeks) return resolvePlayerRequest(next, catalog, 'LAPSED');
    if (weeksWaiting >= 1 && !pending.warned) {
      return withRequests(next, {
        ...next.playerRequests!,
        pending: { ...pending, warned: true },
      });
    }
    return next;
  }

  const roster = next.players.filter(player => player.clubId === next.userClubId);
  const qualifiers = starQualifiers(
    next.seasonStatLines ?? [],
    next.season,
    tuning.starGoalRank,
  );
  const hasStar = roster.some(
    player => weightForPlayer(player, qualifiers, tuning.starFameThreshold) > 1,
  );
  const cadence = tuning.cadence[careerDifficulty(next)];
  const weeksSince = next.playerRequests!.weeksSinceRequest + 1;
  next = withRequests(next, { ...next.playerRequests!, weeksSinceRequest: weeksSince });

  const context = {
    careerSeed: next.careerSeed,
    season: next.season,
    week: next.week,
    riskyChoices: 0,
  };
  const chance = requestChancePercent(weeksSince, cadence, hasStar, tuning.baseChancePercent);
  if (deterministicCareerEventRoll(context, 'request:open', 0, 100) >= chance) return next;

  const stateAtDraw = next;
  const base = {
    ...(next.playerRequests!.lastAskingPlayerId === undefined
      ? {}
      : { lastAskingPlayerId: next.playerRequests!.lastAskingPlayerId }),
    minSeasonsAtClub: tuning.minSeasonsAtClub,
    lineupSurvivesAbsence: (player: CareerPlayer) => lineupSurvivesLeave(stateAtDraw, player),
  };
  const drawn = catalog.requests[
    deterministicCareerEventRoll(context, 'request:pick', 1, catalog.requests.length)
  ];
  // If an absence draw leaves nobody eligible — a squad with one fit keeper —
  // fall back to a non-absence request rather than swallowing a roll that has
  // already succeeded, which would read as the game forgetting about you.
  const drawnPool = eligibleAskers(roster, { ...base, absence: drawn.cost.kind === 'ABSENCE' });
  const definition = drawnPool.length > 0
    ? drawn
    : catalog.requests.filter(request => request.cost.kind !== 'ABSENCE')[
        deterministicCareerEventRoll(
          context,
          'request:fallback',
          3,
          Math.max(1, catalog.requests.filter(r => r.cost.kind !== 'ABSENCE').length),
        )
      ];
  if (definition === undefined) return next;

  const pool = eligibleAskers(roster, {
    ...base,
    absence: definition.cost.kind === 'ABSENCE',
  });
  const totalWeight = totalAskerWeight(pool, qualifiers, tuning.starFameThreshold);
  if (totalWeight === 0) return next;
  const asker = pickAsker(
    pool,
    qualifiers,
    deterministicCareerEventRoll(context, 'request:asker', 2, totalWeight),
    tuning.starFameThreshold,
  );
  if (asker === undefined) return next;

  const club = next.clubs.find(candidate => candidate.id === next.userClubId)!;
  const costAmount = requestMoneyCost(definition.cost, {
    playerWeeklyWage: asker.weeklyWage,
    squadWeeklyWageBill: club.weeklyWages,
  });

  return withRequests(next, {
    ...next.playerRequests!,
    pending: {
      requestId: definition.id,
      playerId: asker.id,
      askedSeason: next.season,
      askedWeek: next.week,
      ...(costAmount === undefined ? {} : { costAmount }),
      warned: false,
    },
  });
}

/**
 * Whether granting this player leave still leaves a legal eleven — a dry run of
 * the exact repair a granted absence performs (`resolvePlayerRequest` calls
 * `repairCareerLineupForInjuries`), so eligibility and application can never
 * disagree. Non-starters return true untouched; deterministic because the
 * repair itself is.
 */
function lineupSurvivesLeave(state: GameState, player: CareerPlayer): boolean {
  try {
    repairCareerLineupForInjuries({
      ...state,
      players: state.players.map(candidate => candidate.id === player.id
        ? { ...candidate, awayWeeks: (candidate.awayWeeks ?? 0) + 1 }
        : candidate),
    });
    return true;
  } catch {
    return false;
  }
}

function withRequests(state: GameState, requests: PlayerRequestState): GameState {
  return { ...state, playerRequests: requests };
}
