import { countUpValue } from './count-up';
import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonyPlacingViewModel,
  AwardCeremonyPrizeViewModel,
  AwardCeremonyViewModel,
} from './models';

/**
 * The ceremony as a flat list of tap-advanced stages.
 *
 * Kept out of the component because Jest runs with no DOM and cannot render one
 * — and because the ordering IS the ceremony. A podium that appeared all at
 * once would be a table; third, then second, then first is what makes the last
 * name land.
 */
export type AwardCeremonyStageKind =
  /** The board's title card, before any name is on the podium. */
  | 'board'
  /** One placing arriving. Third first, first last. */
  | 'placing'
  /** The winner walking on to speak, rival or not. */
  | 'winner'
  /** The manager's own player who finished second to a rival. */
  | 'runner-up'
  /** The finished podium, held until the manager taps on. */
  | 'result'
  /** The ceremony's single prize screen. */
  | 'prize';

export interface AwardCeremonyStage {
  readonly kind: AwardCeremonyStageKind;
  /** Index into `beats`, or -1 on the prize stage, which belongs to no board. */
  readonly beatIndex: number;
  /** How many of the beat's placings stand on the podium at this stage. */
  readonly revealed: number;
}

/** How long the prize total takes to climb from zero. */
export const PRIZE_COUNT_UP_MS = 2_400;

/**
 * Every stage of the whole ceremony, in order.
 *
 * Built once from the view model rather than derived per tap, so "where am I"
 * is a single index and skipping is a jump rather than a replayed sequence.
 */
export function awardCeremonyStages(
  viewModel: AwardCeremonyViewModel,
): readonly AwardCeremonyStage[] {
  const stages: AwardCeremonyStage[] = [];
  viewModel.beats.forEach((beat, beatIndex) => {
    const revealed = beat.placings.length;
    stages.push({ kind: 'board', beatIndex, revealed: 0 });
    beat.placings.forEach((_, index) => {
      stages.push({ kind: 'placing', beatIndex, revealed: index + 1 });
    });
    if (beat.winner !== undefined && beat.winnerLine !== undefined) {
      stages.push({ kind: 'winner', beatIndex, revealed });
    }
    if (beat.runnerUp !== undefined && beat.runnerUpLine !== undefined) {
      stages.push({ kind: 'runner-up', beatIndex, revealed });
    }
    stages.push({ kind: 'result', beatIndex, revealed });
  });
  stages.push({ kind: 'prize', beatIndex: -1, revealed: 0 });
  return stages;
}

/** The next stage, or the last one — advancing off the end is not an exit. */
export function nextStageIndex(
  stages: readonly AwardCeremonyStage[],
  index: number,
): number {
  return Math.min(Math.max(0, index) + 1, Math.max(0, stages.length - 1));
}

/**
 * Where "skip this walk-on" lands: the podium result for the board being shown.
 *
 * A board's winner and runner-up are one staging, so skipping the winner skips
 * the runner-up with him. Splitting them would leave the manager tapping past a
 * second sprite he has just said he does not want to watch.
 */
export function beatResultStageIndex(
  stages: readonly AwardCeremonyStage[],
  index: number,
): number {
  const stage = stages[index];
  if (stage === undefined || stage.kind === 'prize') return index;
  const result = stages.findIndex(candidate => (
    candidate.beatIndex === stage.beatIndex && candidate.kind === 'result'
  ));
  return result === -1 ? index : Math.max(result, index);
}

/** Where "skip the ceremony" lands: the prize, which is never skipped. */
export function prizeStageIndex(stages: readonly AwardCeremonyStage[]): number {
  const prize = stages.findIndex(stage => stage.kind === 'prize');
  return prize === -1 ? Math.max(0, stages.length - 1) : prize;
}

export function isWalkOnStage(stage: AwardCeremonyStage | undefined): boolean {
  return stage?.kind === 'winner' || stage?.kind === 'runner-up';
}

export function stageBeat(
  viewModel: AwardCeremonyViewModel,
  stage: AwardCeremonyStage | undefined,
): AwardCeremonyBeatViewModel | undefined {
  return stage === undefined || stage.beatIndex < 0
    ? undefined
    : viewModel.beats[stage.beatIndex];
}

/**
 * The podium as it should be READ — first at the top — from placings stored in
 * the order they are revealed. Slicing then reversing is what lets the list
 * grow upwards as each name arrives.
 */
export function podiumRows(
  beat: AwardCeremonyBeatViewModel,
  stage: AwardCeremonyStage,
): readonly AwardCeremonyPlacingViewModel[] {
  return [...beat.placings.slice(0, stage.revealed)].reverse();
}

/** The name that has just landed, so the render can mark it as new. */
export function arrivingPlacing(
  beat: AwardCeremonyBeatViewModel,
  stage: AwardCeremonyStage,
): AwardCeremonyPlacingViewModel | undefined {
  return stage.kind === 'placing' ? beat.placings[stage.revealed - 1] : undefined;
}

/** Reads as "1. Flint Vale, Quartz FC, 12 saves." — the League board's sentence. */
export function placingRowLabel(
  placing: AwardCeremonyPlacingViewModel,
  metricLabel: string,
): string {
  const owner = placing.isUserPlayer ? ' Your player.' : '';
  return `${placing.position}. ${placing.playerName}, ${placing.clubName}, `
    + `${placing.value} ${metricLabel.toLowerCase()}.${owner}`;
}

/** Whether the prize screen has a number worth watching climb. */
export function prizeCountsUp(prize: AwardCeremonyPrizeViewModel): boolean {
  return prize.boardsWon > 0 && prize.totalTrainingPoints > 0;
}

export function prizeCountProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / PRIZE_COUNT_UP_MS);
}

/** The figure on screen at a given point in the climb. */
export function prizeCountValue(total: number, elapsedMs: number): number {
  return countUpValue(total, prizeCountProgress(elapsedMs));
}

/**
 * The prize screen's sentence.
 *
 * A club that won nothing says so. Counting a zero up from zero would spend the
 * ceremony's last beat animating an absence.
 *
 * `totalTrainingPoints` is quoted directly and never rebuilt from the
 * per-board rate: the prize tapers, so two boards at D5 pay 210 and not 240.
 */
export function prizeDetailLine(prize: AwardCeremonyPrizeViewModel): string {
  if (!prizeCountsUp(prize)) {
    return 'No board went to the club this season. Top one next year and the prize is yours.';
  }
  const boards = prize.boardsWon === 1 ? '1 board' : `${prize.boardsWon} boards`;
  return `${boards} won · ${prize.perCategoryTrainingPoints} TP for the first, less for each after.`;
}

export function prizeAccessibilityLabel(prize: AwardCeremonyPrizeViewModel): string {
  return prizeCountsUp(prize)
    ? `Award prize: ${prize.totalTrainingPoints} Training Points. ${prizeDetailLine(prize)}`
    : `Award prize: nothing. ${prizeDetailLine(prize)}`;
}

/**
 * Everything the current stage is saying, as one sentence.
 *
 * The ceremony makes the whole screen the button, and an accessible parent hides
 * its children from VoiceOver — so the podium has to be spoken by the control
 * that covers it, or a screen-reader user hears "Next" and nothing else. The
 * same rule as the reduced-motion path: no information may live only in the
 * presentation.
 */
export function stageAccessibilityLabel(
  viewModel: AwardCeremonyViewModel,
  stage: AwardCeremonyStage,
): string {
  const beat = stageBeat(viewModel, stage);
  if (beat === undefined) return prizeAccessibilityLabel(viewModel.prize);
  const board = `${beat.boardLabel}, ${beat.metricLabel}.`;
  if (stage.kind === 'board') return `${board} And the award goes to…`;
  const rows = podiumRows(beat, stage);
  if (rows.length === 0) return `${board} ${beat.emptyLabel}.`;
  return [board, ...rows.map(row => placingRowLabel(row, beat.metricLabel))].join(' ');
}
