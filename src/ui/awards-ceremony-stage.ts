import { countUpValue } from './count-up';
import { copyFor, formatMoneyForCopy, type CopyFn } from '../i18n';

import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonyPlacingViewModel,
  AwardCeremonyPrizeViewModel,
  AwardCeremonyViewModel,
} from './models';

/**
 * Money, spelled the way the rest of the game spells it.
 *
 * Written out here rather than imported from Scorecard: this module is pure so
 * the ceremony's stage order can be tested with no DOM and no react-native, and
 * reaching into a component file for a string helper would drag both in.
 */
function formatPrizeMoney(t: CopyFn, value: number): string {
  return formatMoneyForCopy(t, value);
}

/**
 * English copy, for every caller that has not threaded a locale through yet.
 * The same lazy shape `application/view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * The ceremony as a flat list of stages, played on a timer.
 *
 * Kept out of the component because Jest runs with no DOM and cannot render one
 * — and because the ordering IS the ceremony.
 *
 * The podium used to arrive one name at a time, third then second then first,
 * on the theory that the last name lands harder for the wait. In practice that
 * was a tap per name, four boards deep, every season — the ceremony asked for
 * a dozen taps before it paid anything. The whole top three arrives together
 * now and the stages advance themselves; a tap only makes them advance sooner.
 */
export type AwardCeremonyStageKind =
  /** The board's title card, before any name is on the podium. */
  | 'board'
  /** The whole podium arriving at once, top three together. */
  | 'placing'
  /**
   * The manager's highest-placed player on this board walking on to speak.
   * At most one a board, and never a rival.
   */
  | 'walk-on'
  /** The finished podium, held for a beat before the next board. */
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
 * How long each stage holds before it plays itself on.
 *
 * A title card is a beat, a podium wants reading, and a walk-on runs for as
 * long as the speech overlay takes — so the walk-on is not on this clock at all
 * and hands itself over when the sprite is done talking. The prize is the last
 * screen and never advances; it waits for the button.
 */
export const STAGE_AUTOPLAY_MS: Readonly<Record<AwardCeremonyStageKind, number | null>> = {
  board: 1_100,
  placing: 2_200,
  'walk-on': null,
  result: 1_400,
  prize: null,
};

/**
 * How long this stage holds, or null when something other than the clock ends
 * it. Reduced motion shortens every hold rather than removing it: a ceremony
 * that jumped straight to the prize would skip the result it exists to show.
 */
export function stageAutoplayMs(
  stage: AwardCeremonyStage | undefined,
  reduceMotion = false,
): number | null {
  if (stage === undefined) return null;
  const hold = STAGE_AUTOPLAY_MS[stage.kind];
  if (hold === null) return null;
  return reduceMotion ? Math.round(hold / 2) : hold;
}

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
    // One reveal, not one per name. An empty board has nothing to arrive, so it
    // goes straight from its title card to its "no one contested this" result.
    if (revealed > 0) stages.push({ kind: 'placing', beatIndex, revealed });
    if (beat.speaker !== undefined) {
      stages.push({ kind: 'walk-on', beatIndex, revealed });
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
 * A board stages one walk-on at most, so this is one sprite skipped and never a
 * second one waiting behind him.
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
  return stage?.kind === 'walk-on';
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

/**
 * Longest name each rostrum size holds, measured at the 375pt floor.
 *
 * The name column is about 220pt there, and 16pt bold spends roughly 9pt on a
 * character of a long name's build; 14pt and 12pt scale from that. Character
 * creation caps a typed name at 24, so the first step is the one the shipped
 * game reaches — the second is for names that were not typed by hand.
 */
const PODIUM_NAME_FULL_MAX = 20;
const PODIUM_NAME_TIGHT_MAX = 26;

/**
 * How tall every rostrum card is, whatever size its name landed on.
 *
 * The full-size row's own height: 16pt of padding, a 24pt name line, the 2pt
 * between, a 20pt club line, and the 2/4pt border. Used as the row's FLOOR, so
 * a name that stepped down cannot come out shorter than the two standing beside
 * it — measured at 52pt against 68pt before this was pinned, which is exactly
 * the uneven podium the step-down was supposed to avoid.
 */
export const PODIUM_ROW_MIN_HEIGHT = 68;

export interface PodiumNameType {
  /** Tailwind size for the player's name. */
  readonly nameClass: string;
  /** Tailwind size for his club, never larger than the name. */
  readonly clubClass: string;
}

/**
 * How big a name is set on its rostrum card.
 *
 * A long name steps DOWN rather than wrapping to a second line. The podium is
 * three rows of one height, and a two-line row would make the whole board
 * reflow the moment one player's name ran longer than the others' — the winner
 * would land and the two names below him would jump. A step down changes one
 * row's type size and nothing else, because `PODIUM_ROW_MIN_HEIGHT` holds the
 * row at the full-size height whichever step it lands on.
 *
 * The club steps with the name, because the row's hierarchy is name-over-club
 * and a club set larger than the player who plays for it reads as a bug. It
 * stops at the name's size rather than going below it: at the last step the
 * hierarchy is carried by weight and colour, which is what the League board's
 * own rows lean on.
 *
 * Character creation caps a typed name at 24, so the shipped game only ever
 * reaches the first step. The last one is for names nobody typed.
 */
export function podiumNameType(playerName: string): PodiumNameType {
  if (playerName.length <= PODIUM_NAME_FULL_MAX) {
    return { nameClass: 'text-base', clubClass: 'text-sm' };
  }
  return playerName.length <= PODIUM_NAME_TIGHT_MAX
    ? { nameClass: 'text-sm', clubClass: 'text-xs' }
    : { nameClass: 'text-xs', clubClass: 'text-xs' };
}

/** Reads as "1. Flint Vale, Quartz FC, 12 saves." — the League board's sentence. */
export function placingRowLabel(
  placing: AwardCeremonyPlacingViewModel,
  metricLabel: string,
  t: CopyFn = englishCopy(),
): string {
  const owner = placing.isUserPlayer ? ` ${t('awardsCeremony.a11y.yourPlayer')}` : '';
  return t('awardsCeremony.a11y.placingRow', {
    position: placing.position,
    player: placing.playerName,
    club: placing.clubName,
    value: placing.value,
    metric: metricLabel.toLowerCase(),
  }) + owner;
}

/** Whether the prize screen has a number worth watching climb. */
export function prizeCountsUp(prize: AwardCeremonyPrizeViewModel): boolean {
  return prize.boardsWon > 0 && prize.totalMoney > 0;
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
 * `totalMoney` is quoted directly and never rebuilt from the per-board rate:
 * the prize tapers, so two boards pay less than twice one board.
 */
export function prizeDetailLine(
  prize: AwardCeremonyPrizeViewModel,
  t: CopyFn = englishCopy(),
): string {
  if (!prizeCountsUp(prize)) return t('awardsCeremony.noBoardWon');
  return t('awardsCeremony.prizeDetail', {
    boards: t('awardsCeremony.boardsWon', { n: prize.boardsWon, count: prize.boardsWon }),
    amount: formatPrizeMoney(t, prize.perCategoryMoney),
  });
}

export function prizeAccessibilityLabel(
  prize: AwardCeremonyPrizeViewModel,
  t: CopyFn = englishCopy(),
): string {
  return prizeCountsUp(prize)
    ? t('awardsCeremony.a11y.prizeAmount', {
        amount: formatPrizeMoney(t, prize.totalMoney),
      detail: prizeDetailLine(prize, t),
    })
    : t('awardsCeremony.a11y.prizeNothing', { detail: prizeDetailLine(prize, t) });
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
  t: CopyFn = englishCopy(),
): string {
  const beat = stageBeat(viewModel, stage);
  if (beat === undefined) return prizeAccessibilityLabel(viewModel.prize, t);
  const board = t('awardsCeremony.a11y.boardAndMetric', {
    board: beat.boardLabel,
    metric: beat.metricLabel,
  });
  if (stage.kind === 'board') return `${board} ${t('awardsCeremony.andTheAwardGoesTo')}`;
  const rows = podiumRows(beat, stage);
  if (rows.length === 0) return t('awardsCeremony.a11y.boardEmpty', { board, empty: beat.emptyLabel });
  return [board, ...rows.map(row => placingRowLabel(row, beat.metricLabel, t))].join(' ');
}
