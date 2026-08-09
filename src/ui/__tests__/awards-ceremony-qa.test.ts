import { isPlayerLookIdForRole } from '../../game/player-appearance';
import { AWARD_CATEGORIES } from '../../game/division-leaders';
import type { AwardCategoryId } from '../../game/types';
import { MAX_ARRIVAL_LINE_LENGTH } from '../player-arrival-lines';
import {
  AWARDS_CEREMONY_QA_CASES,
  awardsCeremonyQaLookIds,
  awardsCeremonyQaNote,
  awardsCeremonyQaStageIndex,
  awardsCeremonyQaTargets,
  awardsCeremonyQaViewModel,
  type AwardsCeremonyQaCaseId,
} from '../awards-ceremony-qa';
import { awardCeremonyStages, prizeCountsUp } from '../awards-ceremony-stage';
import type { AwardCeremonyViewModel } from '../models';

const CASE_IDS = AWARDS_CEREMONY_QA_CASES.map((entry) => entry.id);

function viewModelFor(caseId: AwardsCeremonyQaCaseId): AwardCeremonyViewModel {
  return awardsCeremonyQaViewModel(caseId);
}

/**
 * The reel exists to show what a career shows. Everything below therefore
 * asserts against the ceremony the PRODUCTION builder returned for fabricated
 * podiums — never against a hand-assembled view model, which could only prove
 * itself.
 */
describe('the fabricated ceremonies', () => {
  it('offers every case the reel advertises', () => {
    expect(CASE_IDS).toEqual(['mixed', 'sweep', 'thin', 'barren']);
    expect(
      AWARDS_CEREMONY_QA_CASES.every((entry) => entry.label.length > 0),
    ).toBe(true);
  });

  it.each(CASE_IDS)(
    'gives %s four boards in the ceremony’s reveal order',
    (caseId) => {
      const viewModel = viewModelFor(caseId);

      expect(viewModel.beats.map((beat) => beat.categoryId)).toEqual([
        'saves',
        'tacklesWon',
        'passesCompleted',
        'goals',
      ]);
      expect(viewModel.beats.map((beat) => beat.boardLabel)).toEqual([
        'Keepers',
        'Defenders',
        'Midfielders',
        'Strikers',
      ]);
    },
  );

  it.each(CASE_IDS)(
    'numbers %s’s podiums 1..n and stores them third-first',
    (caseId) => {
      for (const beat of viewModelFor(caseId).beats) {
        const positions = beat.placings.map((placing) => placing.position);

        expect(positions).toEqual(
          [...positions].sort((left, right) => right - left),
        );
        expect([...positions].reverse()).toEqual(
          positions.map((_, index) => index + 1),
        );
      }
    },
  );

  /**
   * A reel laid out at toy widths proves nothing about the rostrum card. The
   * ranges are the ones a D5 season actually produces.
   */
  it.each(CASE_IDS)(
    'keeps %s’s values in the ranges a real D5 season produces',
    (caseId) => {
      const ranges: Record<AwardCategoryId, readonly [number, number]> = {
        saves: [55, 65],
        tacklesWon: [45, 65],
        passesCompleted: [150, 175],
        goals: [20, 24],
      };

      for (const beat of viewModelFor(caseId).beats) {
        const [low, high] = ranges[beat.categoryId];
        for (const placing of beat.placings) {
          expect(placing.value).toBeGreaterThanOrEqual(low);
          expect(placing.value).toBeLessThanOrEqual(high);
        }
      }
    },
  );

  it('renders a club the pyramid has regenerated as its identifier', () => {
    const strikers = viewModelFor('mixed').beats[3];

    expect(strikers.placings.map((placing) => placing.clubName)).toContain(
      'moor-end-athletic',
    );
  });
});

/**
 * The four states the reel was built to make reachable. Each is asserted on the
 * built ceremony, so a change to the production suppression rule fails here
 * rather than quietly turning the reel into a demo of nothing.
 */
describe('the walk-on states the reel has to reach', () => {
  it('walks your second-placed player on when a rival wins the board', () => {
    const keepers = viewModelFor('mixed').beats[0];
    const winner = keepers.placings.find((placing) => placing.position === 1);

    expect(winner?.isUserPlayer).toBe(false);
    expect(keepers.speaker?.placing.isUserPlayer).toBe(true);
    expect(keepers.speaker?.placing.position).toBe(2);
    expect(keepers.speaker?.tone).toBe('runner-up');
  });

  it('gives a board your own player wins, with nobody following him on', () => {
    const defenders = viewModelFor('mixed').beats[1];

    expect(defenders.speaker?.placing.isUserPlayer).toBe(true);
    expect(defenders.speaker?.placing.position).toBe(1);
    expect(defenders.speaker?.tone).toBe('winner');
    expect(defenders.wonByUserPlayer).toBe(true);
  });

  /**
   * The rule that is impossible to see live without luck: first AND second are
   * yours, and it is the winner who walks on.
   */
  it('walks the winner on when your club takes first and second', () => {
    const midfielders = viewModelFor('mixed').beats[2];
    const second = midfielders.placings.find(
      (placing) => placing.position === 2,
    );

    expect(second?.isUserPlayer).toBe(true);
    expect(midfielders.speaker?.placing.position).toBe(1);
    expect(midfielders.speaker?.placing.isUserPlayer).toBe(true);
    expect(midfielders.speaker?.tone).toBe('winner');
    expect(
      awardCeremonyStages(viewModelFor('mixed')).filter(
        (stage) => stage.beatIndex === 2 && stage.kind === 'walk-on',
      ),
    ).toHaveLength(1);
  });

  /** The reversed rule, and the reason the reel keeps a board like this one. */
  it('gives a rival board you are nowhere on, which nobody walks on to', () => {
    const strikers = viewModelFor('mixed').beats[3];

    expect(strikers.placings.some((placing) => placing.isUserPlayer)).toBe(
      false,
    );
    expect(strikers.wonByUserPlayer).toBe(false);
    expect(strikers.speaker).toBeUndefined();
    expect(
      awardCeremonyStages(viewModelFor('mixed'))
        .filter((stage) => stage.beatIndex === 3)
        .map((stage) => stage.kind),
    ).toEqual(['board', 'placing', 'result']);
  });

  it.each(CASE_IDS)(
    'never lets %s walk on anyone but your highest-placed',
    (caseId) => {
      for (const beat of viewModelFor(caseId).beats) {
        const mine = beat.placings.filter((placing) => placing.isUserPlayer);
        const highest = Math.min(...mine.map((placing) => placing.position));

        if (mine.length === 0) {
          expect(beat.speaker).toBeUndefined();
          continue;
        }
        expect(beat.speaker?.placing.position).toBe(highest);
        expect(beat.speaker?.placing.isUserPlayer).toBe(true);
        expect(beat.speaker?.tone).toBe(highest === 1 ? 'winner' : 'runner-up');
      }
    },
  );

  it.each(CASE_IDS)('stages at most one walk-on a board for %s', (caseId) => {
    const viewModel = viewModelFor(caseId);
    const walkOns = awardCeremonyStages(viewModel).filter(
      (stage) => stage.kind === 'walk-on',
    );

    expect(walkOns).toHaveLength(
      viewModel.beats.filter((beat) => beat.speaker !== undefined).length,
    );
    expect(new Set(walkOns.map((stage) => stage.beatIndex)).size).toBe(
      walkOns.length,
    );
  });
});

describe('the thin and barren cases', () => {
  it('holds a one-name board, a two-name board and one nobody registered', () => {
    const thin = viewModelFor('thin');

    expect(thin.beats.map((beat) => beat.placings.length)).toEqual([
      1, 2, 0, 3,
    ]);
  });

  it('leaves the empty board with nobody to walk on', () => {
    const empty = viewModelFor('thin').beats[2];

    expect(empty.placings).toEqual([]);
    expect(empty.speaker).toBeUndefined();
    expect(empty.emptyLabel).toBe('No passes recorded this season');
    expect(
      awardCeremonyStages(viewModelFor('thin'))
        .filter((stage) => stage.beatIndex === 2)
        .map((stage) => stage.kind),
    ).toEqual(['board', 'result']);
  });

  /** A rival alone on a board is announced and never walked on. */
  it('leaves a one-name rival board with nobody to walk on either', () => {
    const single = viewModelFor('thin').beats[0];

    expect(single.placings).toHaveLength(1);
    expect(single.placings[0].isUserPlayer).toBe(false);
    expect(single.speaker).toBeUndefined();
  });

  it('walks your beaten player on from a two-name board', () => {
    const twoNames = viewModelFor('thin').beats[1];

    expect(twoNames.placings).toHaveLength(2);
    expect(twoNames.speaker?.placing.position).toBe(2);
    expect(twoNames.speaker?.tone).toBe('runner-up');
  });

  /**
   * Third is still the highest of yours on the board, so he speaks — a season
   * winning nothing is not a season nobody from your club is heard in.
   */
  it('walks your third-placed player on in a barren season', () => {
    const keepers = viewModelFor('barren').beats[0];

    expect(keepers.speaker?.placing.position).toBe(3);
    expect(keepers.speaker?.placing.isUserPlayer).toBe(true);
    expect(keepers.speaker?.tone).toBe('runner-up');
  });

  it('states a barren season rather than counting up to zero', () => {
    const barren = viewModelFor('barren');

    expect(barren.beats.some((beat) => beat.wonByUserPlayer)).toBe(false);
    expect(barren.prize.boardsWon).toBe(0);
    expect(barren.prize.totalMoney).toBe(0);
    expect(prizeCountsUp(barren.prize)).toBe(false);
  });
});

/**
 * The prize comes from the production pricing function, taper and all, so the
 * reel cannot show a figure the game would never pay.
 */
describe('what the fabricated seasons pay', () => {
  it.each(CASE_IDS)(
    'pays %s for exactly the boards its beats say it won',
    (caseId) => {
      const viewModel = viewModelFor(caseId);

      expect(viewModel.prize.boardsWon).toBe(
        viewModel.beats.filter((beat) => beat.wonByUserPlayer).length,
      );
      expect(viewModel.prize.perCategoryMoney).toBe(5_280);
    },
  );

  it('shows the D5 taper rather than the rate times the boards won', () => {
    expect(viewModelFor('mixed').prize.totalMoney).toBe(9_240);
    expect(viewModelFor('thin').prize.totalMoney).toBe(5_280);
    expect(viewModelFor('sweep').prize.totalMoney).toBe(13_200);
  });
});

/** Where wrapping breaks if it breaks: the pool's ceiling, in a 320pt bubble. */
describe('the widths the reel is meant to stress', () => {
  it('puts a name on the rostrum longer than the shipped roster holds', () => {
    const names = CASE_IDS.flatMap((caseId) =>
      viewModelFor(caseId).beats.flatMap((beat) =>
        beat.placings.map((placing) => placing.playerName),
      ),
    );

    expect(
      Math.max(...names.map((name) => name.length)),
    ).toBeGreaterThanOrEqual(28);
  });

  /**
   * One line a board now, so the two pools are stressed on two boards: the
   * keepers' beaten man says the longest runner-up line, the defenders' winner
   * the longest winner line.
   */
  it('speaks the longest line each pool allows, on the boards it advertises', () => {
    const [keepers, defenders] = viewModelFor('mixed').beats;

    expect(keepers.speaker?.tone).toBe('runner-up');
    expect(keepers.speaker?.line.length).toBeGreaterThanOrEqual(55);
    expect(defenders.speaker?.tone).toBe('winner');
    expect(defenders.speaker?.line.length).toBeGreaterThanOrEqual(60);
    // The longest bubble is spoken over the podium carrying the longest name.
    expect(
      Math.max(...keepers.placings.map((placing) => placing.playerName.length)),
    ).toBeGreaterThanOrEqual(28);
  });

  it.each(CASE_IDS)(
    'keeps every %s line inside the one-bubble cap',
    (caseId) => {
      for (const beat of viewModelFor(caseId).beats) {
        if (beat.speaker === undefined) continue;
        expect(beat.speaker.line.length).toBeLessThanOrEqual(
          MAX_ARRIVAL_LINE_LENGTH,
        );
      }
    },
  );
});

describe('opening the ceremony part-way through', () => {
  it.each(CASE_IDS)(
    'lands %s on the title card of whichever board was asked for',
    (caseId) => {
      const viewModel = viewModelFor(caseId);
      const stages = awardCeremonyStages(viewModel);

      viewModel.beats.forEach((beat, beatIndex) => {
        const stage =
          stages[awardsCeremonyQaStageIndex(viewModel, beat.categoryId)];

        expect(stage.kind).toBe('board');
        expect(stage.beatIndex).toBe(beatIndex);
      });
    },
  );

  it.each(CASE_IDS)(
    'lands %s on the prize, which is the last stage',
    (caseId) => {
      const viewModel = viewModelFor(caseId);
      const stages = awardCeremonyStages(viewModel);
      const index = awardsCeremonyQaStageIndex(viewModel, 'prize');

      expect(stages[index].kind).toBe('prize');
      expect(index).toBe(stages.length - 1);
    },
  );

  it('offers a jump for each board plus the prize, labelled by the boards', () => {
    const viewModel = viewModelFor('mixed');

    expect(
      awardsCeremonyQaTargets(viewModel).map((entry) => entry.label),
    ).toEqual(['Keepers', 'Defenders', 'Midfielders', 'Strikers', 'Prize']);
  });

  /** Short enough that the jump row never wraps and covers another podium row. */
  it('puts each board’s position line on its button', () => {
    expect(
      awardsCeremonyQaTargets(viewModelFor('mixed')).map((entry) => entry.code),
    ).toEqual(['GK', 'DEF', 'MID', 'FWD', 'PRIZE']);
  });
});

describe('the reviewer’s note', () => {
  it('names the walk-on rule each board is about to demonstrate', () => {
    const viewModel = viewModelFor('mixed');

    expect(awardsCeremonyQaNote(viewModel, 'saves')).toBe(
      '3 placings · rival wins · your 2nd walks on · the rival winner does not',
    );
    expect(awardsCeremonyQaNote(viewModel, 'tacklesWon')).toBe(
      '3 placings · yours wins · your winner walks on alone',
    );
    expect(awardsCeremonyQaNote(viewModel, 'passesCompleted')).toBe(
      '3 placings · yours wins · yours 1st AND 2nd · only the winner walks on',
    );
    expect(awardsCeremonyQaNote(viewModel, 'goals')).toBe(
      '3 placings · rival wins · none of yours on the podium · nobody walks on',
    );
  });

  /** The note is derived, so it cannot promise a walk-on the ceremony skips. */
  it.each(CASE_IDS)(
    'never claims a walk-on %s is not about to play',
    (caseId) => {
      const viewModel = viewModelFor(caseId);

      for (const beat of viewModel.beats) {
        const note = awardsCeremonyQaNote(viewModel, beat.categoryId);

        expect(note.includes('nobody walks on')).toBe(
          beat.speaker === undefined,
        );
      }
    },
  );

  it('calls an empty board empty and a barren prize barren', () => {
    expect(
      awardsCeremonyQaNote(viewModelFor('thin'), 'passesCompleted'),
    ).toContain('Empty board');
    expect(awardsCeremonyQaNote(viewModelFor('barren'), 'prize')).toContain(
      'instead of counting to zero',
    );
    expect(awardsCeremonyQaNote(viewModelFor('sweep'), 'prize')).toContain(
      '$13,200',
    );
  });

  it('counts a single placing in the singular', () => {
    expect(awardsCeremonyQaNote(viewModelFor('thin'), 'saves')).toContain(
      '1 placing ·',
    );
  });
});

describe('the looks the winners walk on wearing', () => {
  it.each(CASE_IDS)(
    'dresses %s’s own players and leaves the rivals to the fallback',
    (caseId) => {
      const viewModel = viewModelFor(caseId);
      const lookIds = awardsCeremonyQaLookIds(viewModel);

      for (const beat of viewModel.beats) {
        const { role } = AWARD_CATEGORIES[beat.categoryId];
        for (const placing of beat.placings) {
          const lookId = lookIds.get(placing.playerId);
          if (!placing.isUserPlayer) {
            expect(lookId).toBeUndefined();
            continue;
          }
          // An invalid look throws inside the sprite, which would take the reel
          // down on the very frame it exists to show.
          expect(lookId).toBeDefined();
          expect(isPlayerLookIdForRole(lookId as string, role)).toBe(true);
        }
      }
    },
  );
});
