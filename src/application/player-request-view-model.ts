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
import { copyFor, type CopyFn } from '../i18n';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 * The same lazy shape `application/view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

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


/**
 * The Requests tab, built from career state.
 *
 * The catalog is read off the career rather than loaded here, because that is
 * where it lives: a career saved before the feature existed has none until
 * launch reconciliation supplies one, and until then the tab is simply absent
 * rather than half-drawn.
 */
export function playerRequestViewModel(
  state: GameState,
  t: CopyFn = englishCopy(),
): PlayerRequestViewModel {
  const emptyDetail = t('playerRequests.dressingRoomQuiet');
  const catalog = state.playerRequestRules;
  const pending = state.playerRequests?.pending;
  const available = catalog !== undefined
    && (state.season > catalog.tuning.startSeason
      || (state.season === catalog.tuning.startSeason && state.week >= catalog.tuning.startWeek));

  const history = catalog === undefined
    ? []
    : (state.playerRequests?.history ?? []).map((entry, index) => ({
        key: `${entry.requestId}-${entry.season}-${entry.week}-${index}`,
        label: t('playerRequests.historyStamp', {
          title: requestDefinition(catalog, entry.requestId).title,
          season: entry.season,
          week: entry.week,
        }),
        resolution: entry.resolution,
      }));

  if (!available || catalog === undefined || pending === undefined) {
    return { available, glowing: false, history, emptyDetail };
  }

  const definition = requestDefinition(catalog, pending.requestId);
  const player = state.players.find(candidate => candidate.id === pending.playerId);
  const difficulty = careerDifficulty(state);
  const refuse = resolutionDeltas('REFUSED', requestTarget(definition.cost), difficulty).asker;

  return {
    available,
    glowing: true,
    history,
    emptyDetail,
    pending: {
      requestId: definition.id,
      playerId: pending.playerId,
      playerName: player?.name ?? t('playerRequests.aPlayer'),
      playerRole: player?.role ?? 'MID',
      ...(player?.lookId === undefined ? {} : { lookId: player.lookId }),
      title: definition.title,
      line: definition.line,
      artKey: `request-${definition.id}`,
      grantLabel: grantLabel(definition, pending.costAmount, difficulty, t),
      // The minus signs are U+2212, which Silkscreen cannot draw — they are
      // built here rather than stored, the same rule the `▸` chevrons follow.
      refuseLabel: t('playerRequests.refuseCost', {
        loyalty: `-${Math.abs(refuse.loyalty)}`,
        morale: `-${Math.abs(refuse.morale)}`,
      }),
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
  t: CopyFn,
): string {
  const cost = definition.cost;
  if (cost.kind === 'MONEY_PLAYER' || cost.kind === 'MONEY_SQUAD') {
    return `-${(costAmount ?? 0).toLocaleString('en-GB')}`;
  }
  if (cost.kind === 'ABSENCE') {
    const weeks = absenceWeeksFor(cost.weeks, difficulty);
    return t('playerRequests.costOutForWeeks', { n: weeks, count: weeks });
  }
  if (cost.kind === 'CONDITION_SQUAD') {
    return t('playerRequests.costSquadCondition', { amount: `-${cost.amount}` });
  }
  if (cost.kind === 'DRILL_PLAYER') {
    return t('playerRequests.costPlayerDrills', {
      multiplier: cost.multiplierPercent / 100,
      weeks: cost.weeks,
    });
  }
  return t('playerRequests.costSquadDrills', {
    multiplier: cost.multiplierPercent / 100,
    weeks: cost.weeks,
  });
}
