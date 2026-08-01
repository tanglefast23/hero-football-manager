import { careerDifficulty } from '../game/difficulty';
import {
  absenceWeeksFor,
  canAffordRequest,
  requestDefinition,
  requestTarget,
  resolutionDeltas,
} from '../game/player-requests';
import type {
  DifficultyMode,
  GameState,
  PlayerRequestDefinition,
  PlayerRequestResolution,
} from '../game/types';

export interface PendingRequestViewModel {
  readonly requestId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly playerRole: string;
  readonly lookId?: string;
  readonly title: string;
  readonly line: string;
  /** Feeds `EventPixelScene`; always `request-<id>`. */
  readonly artKey: string;
  readonly grantLabel: string;
  readonly refuseLabel: string;
  readonly canAfford: boolean;
  readonly weeksToAnswer: number;
}

export interface RequestHistoryViewModel {
  readonly key: string;
  readonly label: string;
  readonly resolution: PlayerRequestResolution;
}

export interface PlayerRequestViewModel {
  /** False before the start week; the Squad screen then shows no tab row at all. */
  readonly available: boolean;
  readonly glowing: boolean;
  readonly pending?: PendingRequestViewModel;
  readonly history: readonly RequestHistoryViewModel[];
  readonly emptyDetail: string;
}

const EMPTY_DETAIL = 'The dressing room is quiet. It won’t last.';

/**
 * The Requests tab, built from career state.
 *
 * The catalog is read off the career rather than loaded here, because that is
 * where it lives: a career saved before the feature existed has none until
 * launch reconciliation supplies one, and until then the tab is simply absent
 * rather than half-drawn.
 */
export function playerRequestViewModel(state: GameState): PlayerRequestViewModel {
  const catalog = state.playerRequestRules;
  const pending = state.playerRequests?.pending;
  const available = catalog !== undefined
    && (state.season > catalog.tuning.startSeason
      || (state.season === catalog.tuning.startSeason && state.week >= catalog.tuning.startWeek));

  const history = catalog === undefined
    ? []
    : (state.playerRequests?.history ?? []).map((entry, index) => ({
        key: `${entry.requestId}-${entry.season}-${entry.week}-${index}`,
        label: `${requestDefinition(catalog, entry.requestId).title} · S${entry.season} W${entry.week}`,
        resolution: entry.resolution,
      }));

  if (!available || catalog === undefined || pending === undefined) {
    return { available, glowing: false, history, emptyDetail: EMPTY_DETAIL };
  }

  const definition = requestDefinition(catalog, pending.requestId);
  const player = state.players.find(candidate => candidate.id === pending.playerId);
  const difficulty = careerDifficulty(state);
  const refuse = resolutionDeltas('REFUSED', requestTarget(definition.cost), difficulty).asker;

  return {
    available,
    glowing: true,
    history,
    emptyDetail: EMPTY_DETAIL,
    pending: {
      requestId: definition.id,
      playerId: pending.playerId,
      playerName: player?.name ?? 'A player',
      playerRole: player?.role ?? 'MID',
      ...(player?.lookId === undefined ? {} : { lookId: player.lookId }),
      title: definition.title,
      line: definition.line,
      artKey: `request-${definition.id}`,
      grantLabel: grantLabel(definition, pending.costAmount, difficulty),
      refuseLabel: `−${Math.abs(refuse.loyalty)} loyalty · −${Math.abs(refuse.morale)} morale`,
      canAfford: canAffordRequest(state),
      weeksToAnswer: Math.max(0, catalog.tuning.answerWeeks - (state.week - pending.askedWeek)),
    },
  };
}

/** What the Grant button costs, in the manager's own terms. */
function grantLabel(
  definition: PlayerRequestDefinition,
  costAmount: number | undefined,
  difficulty: DifficultyMode,
): string {
  const cost = definition.cost;
  if (cost.kind === 'MONEY_PLAYER' || cost.kind === 'MONEY_SQUAD') {
    return `−${(costAmount ?? 0).toLocaleString('en-GB')}`;
  }
  if (cost.kind === 'ABSENCE') {
    const weeks = absenceWeeksFor(cost.weeks, difficulty);
    return `Out ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (cost.kind === 'CONDITION_SQUAD') return `Squad −${cost.amount} condition`;
  if (cost.kind === 'DRILL_PLAYER') {
    return `Their drills ×${cost.multiplierPercent / 100} for ${cost.weeks} weeks`;
  }
  return `Squad drills ×${cost.multiplierPercent / 100} for ${cost.weeks} weeks`;
}
