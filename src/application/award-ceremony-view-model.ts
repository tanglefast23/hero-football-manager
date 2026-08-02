import { AWARD_CATEGORIES, PODIUM_SIZE } from '../game/division-leaders';
import { divisionAwardPrize, divisionAwardPrizePerCategory } from '../game/division-award-prize';
import type {
  AwardCategoryId,
  DivisionAwardPlacement,
  DivisionAwardPrize,
  SeasonRecap,
} from '../game/types';
import { awardCeremonySpeeches, type AwardCeremonySpeaker } from '../ui/award-ceremony-lines';
import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonyPlacingViewModel,
  AwardCeremonyViewModel,
} from '../ui/models';

/**
 * Reveal order, deliberately the reverse of the League board's.
 *
 * The ceremony is watched, one beat at a time, so it builds to the category the
 * player cares most about and ends on goals. The board is scanned, so it leads
 * with goals for exactly the same reason. Unifying the two orders would cost
 * one of them the thing it is ordered for — see `division-leaders-view-model.ts`,
 * which states the other half of this.
 */
const REVEAL_ORDER: readonly AwardCategoryId[] = [
  'saves', 'tacklesWon', 'passesCompleted', 'goals',
];

export interface AwardCeremonyViewModelSource {
  /** The completed season's recap, which carries the podiums being presented. */
  readonly recap: SeasonRecap;
  readonly userClubId: string;
  /** Every club in the pyramid, so a stored `clubId` still resolves to a name. */
  readonly clubNames: ReadonlyMap<string, string>;
  /**
   * The division the club is about to ENTER, which is what the prize is sized
   * against. Ignored when the transition has already banked a figure.
   */
  readonly targetDivision: number;
}

/**
 * The four division awards as a watchable sequence of beats.
 *
 * Everything the ceremony screen shows is decided here: the order, the podium,
 * who walks on, what they say, and what it paid. The screen holds no logic, so
 * the whole ceremony is a pure function of one recap — the same recap always
 * produces the same lines, which matters because a speaking sprite survives
 * taps and orientation changes that re-render it.
 */
export function awardCeremonyViewModel(
  source: AwardCeremonyViewModelSource,
): AwardCeremonyViewModel {
  const podiums = REVEAL_ORDER.map(categoryId => ({
    categoryId,
    // Podium order here (winner first) because the winner and the runner-up are
    // read off the front; the beat reverses it for the reveal. Cut to three
    // again, so the beat holds a podium whatever the stored record holds.
    placings: placementsFor(source.recap, categoryId)
      .slice(0, PODIUM_SIZE)
      .map((placement, index) => placing(placement, index + 1, source)),
  }));

  const prize = awardPrize(source);
  const wonCategories = new Set(prize.categoriesWon);

  // Every line for the whole ceremony in one pass, so the de-duplication can
  // see all four winners before the first card renders. Speakers are handed
  // over in reveal order, which is the order the probe resolves collisions in.
  const speakers: AwardCeremonySpeaker[] = podiums.flatMap(({ categoryId, placings }) => {
    const winner = placings[0];
    if (winner === undefined) return [];
    const runnerUp = speakingRunnerUp(placings);
    return [{
      category: categoryId,
      winnerPlayerId: winner.playerId,
      ...(runnerUp === undefined ? {} : { runnerUpPlayerId: runnerUp.playerId }),
    }];
  });
  const speeches = new Map(awardCeremonySpeeches(speakers, source.recap.season)
    .map(speech => [speech.category, speech]));

  const beats: AwardCeremonyBeatViewModel[] = podiums.map(({ categoryId, placings }) => {
    const category = AWARD_CATEGORIES[categoryId];
    const speech = speeches.get(categoryId);
    const runnerUp = speakingRunnerUp(placings);
    return {
      categoryId,
      boardLabel: category.boardLabel,
      metricLabel: category.metricLabel,
      placings: [...placings].reverse(),
      emptyLabel: `No ${category.metricLabel.toLowerCase()} recorded this season`,
      ...(placings[0] === undefined ? {} : { winner: placings[0] }),
      ...(speech === undefined ? {} : { winnerLine: speech.winnerLine }),
      ...(runnerUp === undefined || speech?.runnerUpLine === undefined
        ? {}
        : { runnerUp, runnerUpLine: speech.runnerUpLine }),
      wonByUserPlayer: wonCategories.has(categoryId),
    };
  });

  return {
    seasonLabel: `Season ${source.recap.season}`,
    beats,
    prize: {
      totalTrainingPoints: prize.trainingPoints,
      perCategoryTrainingPoints: divisionAwardPrizePerCategory(source.targetDivision),
      boardsWon: prize.categoriesWon.length,
    },
  };
}

/**
 * What the boards paid, and therefore which of them count as won.
 *
 * One authority for both questions, so the prize panel and the beats cannot
 * disagree about a category. The transition's banked grant wins where it
 * exists; before the transition runs there is none, and the ceremony shows the
 * projection from the same pure function the transition will grant from.
 */
function awardPrize(source: AwardCeremonyViewModelSource): DivisionAwardPrize {
  return source.recap.divisionAwardPrize ?? divisionAwardPrize({
    recap: completeAwards(source.recap),
    userClubId: source.userClubId,
    targetDivision: source.targetDivision,
  });
}

/**
 * The manager's second-placed player, when he is the one who speaks.
 *
 * A club with first AND second gets one walk-on: the winner's. Suppressing the
 * runner-up here rather than at the render also keeps him from claiming a line
 * out of the pool that no one will hear.
 */
function speakingRunnerUp(
  placings: readonly AwardCeremonyPlacingViewModel[],
): AwardCeremonyPlacingViewModel | undefined {
  const winner = placings[0];
  if (winner === undefined || winner.isUserPlayer) return undefined;
  const runnerUp = placings[1];
  return runnerUp?.isUserPlayer === true ? runnerUp : undefined;
}

function placing(
  placement: DivisionAwardPlacement,
  position: number,
  source: AwardCeremonyViewModelSource,
): AwardCeremonyPlacingViewModel {
  return {
    position,
    playerId: placement.playerId,
    playerName: placement.playerName,
    // A club regenerated out of the pyramid still has to render as something,
    // and its identifier beats a blank rostrum card.
    clubName: source.clubNames.get(placement.clubId) ?? placement.clubId,
    value: placement.value,
    isUserPlayer: placement.clubId === source.userClubId,
  };
}

/**
 * A recap missing `divisionAwards` entirely predates the boards; one missing a
 * single category should not exist, since the save schema requires all four.
 * Both are read as empty podiums rather than trusted, because this runs inside
 * the season transition, where a thrown error strands the career instead of
 * blanking a screen.
 */
function placementsFor(
  recap: SeasonRecap,
  categoryId: AwardCategoryId,
): readonly DivisionAwardPlacement[] {
  return recap.divisionAwards?.[categoryId] ?? [];
}

/** The same defence, applied before the prize function indexes the record. */
function completeAwards(recap: SeasonRecap): SeasonRecap {
  if (recap.divisionAwards === undefined) return recap;
  return {
    ...recap,
    divisionAwards: Object.fromEntries(REVEAL_ORDER.map(categoryId => [
      categoryId,
      [...placementsFor(recap, categoryId)],
    ])) as Record<AwardCategoryId, DivisionAwardPlacement[]>,
  };
}
