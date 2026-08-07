import { AWARD_CATEGORIES, PODIUM_SIZE } from '../game/division-leaders';
import { divisionAwardPrize, divisionAwardPrizeCashPerCategory } from '../game/division-award-prize';
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
  AwardCeremonySpeechTone,
  AwardCeremonyViewModel,
} from '../ui/models';
import { copyFor, type CopyFn } from '../i18n';
import { copyOrEnglish } from './copy-fallback';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

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
  t: CopyFn = englishCopy(),
): AwardCeremonyViewModel {
  const podiums = REVEAL_ORDER.map(categoryId => ({
    categoryId,
    // Podium order here (winner first) because the speaker is read off the
    // front; the beat reverses it for the reveal. Cut to three again, so the
    // beat holds a podium whatever the stored record holds.
    placings: placementsFor(source.recap, categoryId)
      .slice(0, PODIUM_SIZE)
      .map((placement, index) => placing(placement, index + 1, source)),
  }));

  const prize = awardPrize(source);
  const wonCategories = new Set(prize.categoriesWon);

  // Every line for the whole ceremony in one pass, so the de-duplication can
  // see all four speakers before the first card renders. Speakers are handed
  // over in reveal order, which is the order the probe resolves collisions in.
  const speakers: AwardCeremonySpeaker[] = podiums.flatMap(({ categoryId, placings }) => {
    const speaking = speakingPlacing(placings);
    if (speaking === undefined) return [];
    return [{ category: categoryId, playerId: speaking.playerId, tone: speechTone(speaking) }];
  });
  const lines = new Map(awardCeremonySpeeches(speakers, source.recap.season, t)
    .map(speech => [speech.category, speech.line]));

  const beats: AwardCeremonyBeatViewModel[] = podiums.map(({ categoryId, placings }) => {
    const category = AWARD_CATEGORIES[categoryId];
    const speaking = speakingPlacing(placings);
    const line = lines.get(categoryId);
    return {
      categoryId,
      // The pure ring writes the English and the key; the club reads whichever
      // of the two its language has. See `AWARD_CATEGORIES`.
      boardLabel: copyOrEnglish(t, category.boardLabelKey, category.boardLabel),
      metricLabel: copyOrEnglish(t, category.metricLabelKey, category.metricLabel),
      placings: [...placings].reverse(),
      emptyLabel: t('awardsCeremony.noneRecordedThisSeason', {
        metric: copyOrEnglish(
          t,
          category.metricInlineLabelKey,
          category.metricLabel.toLowerCase(),
        ),
      }),
      ...(speaking === undefined || line === undefined
        ? {}
        : { speaker: { placing: speaking, tone: speechTone(speaking), line } }),
      wonByUserPlayer: wonCategories.has(categoryId),
    };
  });

  return {
    seasonLabel: t('endgameCelebration.seasonLabel', { season: source.recap.season }),
    beats,
    prize: {
      totalMoney: prize.money,
      perCategoryMoney: divisionAwardPrizeCashPerCategory(source.targetDivision),
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
 * The one player who walks on: the manager's highest-placed on this podium.
 *
 * A rival never walks on, whatever he won — the owner watched two walk-ons a
 * board and reversed the rival's, so a board the manager is nowhere on now
 * reveals its three placings and moves on. A club taking first AND second still
 * gets one walk-on, and it is the winner's, because `placings` is winner-first.
 *
 * Deciding it here rather than at the render also keeps a player who will never
 * be heard from claiming a line out of the pool.
 */
function speakingPlacing(
  placings: readonly AwardCeremonyPlacingViewModel[],
): AwardCeremonyPlacingViewModel | undefined {
  return placings.find(candidate => candidate.isUserPlayer);
}

/** Winning the board is the only thing that draws from the winner's pool. */
function speechTone(placing: AwardCeremonyPlacingViewModel): AwardCeremonySpeechTone {
  return placing.position === 1 ? 'winner' : 'runner-up';
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
