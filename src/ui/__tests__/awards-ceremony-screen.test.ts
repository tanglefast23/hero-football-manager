import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PODIUM_ROW_MIN_HEIGHT,
  PRIZE_COUNT_UP_MS,
  arrivingPlacing,
  awardCeremonyStages,
  beatResultStageIndex,
  isWalkOnStage,
  nextStageIndex,
  placingRowLabel,
  podiumNameType,
  podiumRows,
  prizeAccessibilityLabel,
  prizeCountProgress,
  prizeCountValue,
  prizeCountsUp,
  prizeDetailLine,
  prizeStageIndex,
  stageAccessibilityLabel,
  stageBeat,
} from '../awards-ceremony-stage';
import type {
  AwardCeremonyBeatViewModel,
  AwardCeremonyPlacingViewModel,
  AwardCeremonyViewModel,
} from '../models';

function placing(
  position: number,
  overrides: Partial<AwardCeremonyPlacingViewModel> = {},
): AwardCeremonyPlacingViewModel {
  return {
    position,
    playerId: `p${position}`,
    playerName: `Player ${position}`,
    clubName: 'Quartz FC',
    value: 30 - position,
    isUserPlayer: false,
    ...overrides,
  };
}

/**
 * Placings arrive third-first, which is the order the view model stores them
 * in. The default board is one the manager won, since a board he is nowhere on
 * has no walk-on to stage at all.
 */
function beat(overrides: Partial<AwardCeremonyBeatViewModel> = {}): AwardCeremonyBeatViewModel {
  const placings = [placing(3), placing(2), placing(1, { isUserPlayer: true })];
  return {
    categoryId: 'saves',
    boardLabel: 'Keepers',
    metricLabel: 'Saves',
    placings,
    emptyLabel: 'No saves recorded this season',
    speaker: { placing: placings[2], tone: 'winner', line: 'Hands like glue.' },
    wonByUserPlayer: true,
    ...overrides,
  };
}

function ceremony(overrides: Partial<AwardCeremonyViewModel> = {}): AwardCeremonyViewModel {
  return {
    seasonLabel: 'Season 3',
    beats: [
      beat(),
      beat({ categoryId: 'tacklesWon', boardLabel: 'Defenders', metricLabel: 'Tackles won' }),
      beat({ categoryId: 'passesCompleted', boardLabel: 'Midfielders', metricLabel: 'Passes' }),
      beat({ categoryId: 'goals', boardLabel: 'Strikers', metricLabel: 'Goals' }),
    ],
    prize: { totalTrainingPoints: 210, perCategoryTrainingPoints: 120, boardsWon: 2 },
    ...overrides,
  };
}

describe('awardCeremonyStages', () => {
  it('stages a board as its card, then one placing at a time, then the walk-on', () => {
    const stages = awardCeremonyStages(ceremony({ beats: [beat()] }));

    expect(stages).toEqual([
      { kind: 'board', beatIndex: 0, revealed: 0 },
      { kind: 'placing', beatIndex: 0, revealed: 1 },
      { kind: 'placing', beatIndex: 0, revealed: 2 },
      { kind: 'placing', beatIndex: 0, revealed: 3 },
      { kind: 'walk-on', beatIndex: 0, revealed: 3 },
      { kind: 'result', beatIndex: 0, revealed: 3 },
      { kind: 'prize', beatIndex: -1, revealed: 0 },
    ]);
  });

  /**
   * The reveal is the whole point. A podium that appeared complete would be a
   * table; third, then second, then first is what makes the last name land.
   */
  it('never reveals the walk-on before the placings below him', () => {
    const stages = awardCeremonyStages(ceremony({ beats: [beat()] }));
    const walkOn = stages.findIndex(stage => stage.kind === 'walk-on');

    expect(stages.slice(0, walkOn).map(stage => stage.revealed)).toEqual([0, 1, 2, 3]);
  });

  /**
   * The rule the owner reversed after watching it: a rival never walks on, so a
   * board the manager has nobody on is podium and nothing else.
   */
  it('stages no walk-on for a board the manager has nobody on', () => {
    const rivalBoard = awardCeremonyStages(ceremony({
      beats: [beat({
        placings: [placing(3), placing(2), placing(1)],
        speaker: undefined,
        wonByUserPlayer: false,
      })],
    }));

    expect(rivalBoard.map(stage => stage.kind)).toEqual([
      'board', 'placing', 'placing', 'placing', 'result', 'prize',
    ]);
  });

  /** One walk-on a board, whether the manager's man won it or was beaten to it. */
  it('stages one walk-on for a beaten player, exactly as for a winner', () => {
    const runnerUpPlacings = [placing(3), placing(2, { isUserPlayer: true }), placing(1)];
    const beaten = awardCeremonyStages(ceremony({
      beats: [beat({
        placings: runnerUpPlacings,
        speaker: { placing: runnerUpPlacings[1], tone: 'runner-up', line: 'Next year.' },
        wonByUserPlayer: false,
      })],
    }));

    expect(beaten.map(stage => stage.kind)).toEqual([
      'board', 'placing', 'placing', 'placing', 'walk-on', 'result', 'prize',
    ]);
    expect(beaten).toEqual(awardCeremonyStages(ceremony({ beats: [beat()] })));
  });

  it('gives an empty board a card and a result, and nobody to walk on', () => {
    const stages = awardCeremonyStages(ceremony({
      beats: [beat({ placings: [], speaker: undefined, wonByUserPlayer: false })],
    }));

    expect(stages.map(stage => stage.kind)).toEqual(['board', 'result', 'prize']);
  });

  it('runs all four boards and finishes on one prize', () => {
    const stages = awardCeremonyStages(ceremony());

    expect(stages.filter(stage => stage.kind === 'board')).toHaveLength(4);
    expect(stages.filter(stage => stage.kind === 'prize')).toHaveLength(1);
    expect(stages[stages.length - 1]!.kind).toBe('prize');
  });
});

describe('advancing and skipping', () => {
  const stages = awardCeremonyStages(ceremony());

  it('advances one stage at a time and stops on the prize', () => {
    expect(nextStageIndex(stages, 0)).toBe(1);
    expect(nextStageIndex(stages, stages.length - 1)).toBe(stages.length - 1);
  });

  it('skips a walk-on to that board’s podium result', () => {
    const walkOn = stages.findIndex(stage => stage.kind === 'walk-on');

    const landed = stages[beatResultStageIndex(stages, walkOn)]!;

    expect(landed.kind).toBe('result');
    expect(landed.beatIndex).toBe(stages[walkOn]!.beatIndex);
  });

  it('skips the whole ceremony to the prize, which is never skipped', () => {
    expect(stages[prizeStageIndex(stages)]!.kind).toBe('prize');
  });

  /**
   * Skipping moves an index and nothing else. What the boards paid is decided
   * by the season transition before this screen renders, so no traversal of the
   * stage list may touch it.
   */
  it('leaves the prize untouched however the ceremony is traversed', () => {
    const viewModel = ceremony();
    const before = { ...viewModel.prize };

    const traversed = awardCeremonyStages(viewModel);
    beatResultStageIndex(traversed, traversed.findIndex(stage => stage.kind === 'walk-on'));
    prizeStageIndex(traversed);
    nextStageIndex(traversed, 0);

    expect(viewModel.prize).toEqual(before);
    expect(traversed).toEqual(stages);
  });

  /** One a board, four in the ceremony, and nothing else is skippable staging. */
  it('treats the one walk-on a board as skippable staging', () => {
    expect(stages.filter(isWalkOnStage).map(stage => stage.beatIndex)).toEqual([0, 1, 2, 3]);
    expect(stages.filter(isWalkOnStage).every(stage => stage.kind === 'walk-on')).toBe(true);
    expect(isWalkOnStage(undefined)).toBe(false);
  });

  it('has nothing to skip to on the prize', () => {
    const prize = prizeStageIndex(stages);

    expect(beatResultStageIndex(stages, prize)).toBe(prize);
  });
});

describe('podium rendering', () => {
  const viewModel = ceremony({ beats: [beat()] });
  const stages = awardCeremonyStages(viewModel);

  it('reads first at the top while arriving from the bottom', () => {
    const afterTwo = podiumRows(viewModel.beats[0]!, stages[2]!);

    expect(afterTwo.map(row => row.position)).toEqual([2, 3]);
    expect(podiumRows(viewModel.beats[0]!, stages[3]!).map(row => row.position))
      .toEqual([1, 2, 3]);
  });

  it('names the placing that has just landed, and only on a placing stage', () => {
    expect(arrivingPlacing(viewModel.beats[0]!, stages[1]!)?.position).toBe(3);
    expect(arrivingPlacing(viewModel.beats[0]!, stages[4]!)).toBeUndefined();
  });

  it('reads a row as position, player, club and value', () => {
    expect(placingRowLabel(placing(1, { playerName: 'Flint Vale', value: 12 }), 'Saves'))
      .toBe('1. Flint Vale, Quartz FC, 12 saves.');
  });

  it('says whose player it is when it is yours', () => {
    expect(placingRowLabel(
      placing(2, { playerName: 'Gem Arrow', value: 9, isUserPlayer: true }),
      'Goals',
    )).toBe('2. Gem Arrow, Quartz FC, 9 goals. Your player.');
  });

  it('finds no beat for the prize stage', () => {
    expect(stageBeat(viewModel, stages[prizeStageIndex(stages)])).toBeUndefined();
    expect(stageBeat(viewModel, stages[0])).toBe(viewModel.beats[0]);
  });
});

/**
 * The ceremony makes the whole screen the button, and an accessible parent
 * hides its children — so the covering control has to speak the podium itself,
 * or a screen-reader user hears the action and never the result.
 */
describe('what the ceremony says out loud', () => {
  const viewModel = ceremony({ beats: [beat()] });
  const stages = awardCeremonyStages(viewModel);

  it('names the board before anyone is on the podium', () => {
    expect(stageAccessibilityLabel(viewModel, stages[0]!))
      .toBe('Keepers, Saves. And the award goes to…');
  });

  it('reads the podium as far as it has been revealed', () => {
    expect(stageAccessibilityLabel(viewModel, stages[2]!))
      .toBe('Keepers, Saves. 2. Player 2, Quartz FC, 28 saves. 3. Player 3, Quartz FC, 27 saves.');
  });

  it('reads the whole podium while the walk-on speaks', () => {
    const walkOn = stages.findIndex(candidate => candidate.kind === 'walk-on');

    expect(stageAccessibilityLabel(viewModel, stages[walkOn]!))
      .toContain('1. Player 1, Quartz FC, 29 saves.');
  });

  it('says a board nobody registered rather than falling silent', () => {
    const empty = ceremony({
      beats: [beat({ placings: [], speaker: undefined, wonByUserPlayer: false })],
    });

    expect(stageAccessibilityLabel(empty, awardCeremonyStages(empty)[1]!))
      .toBe('Keepers, Saves. No saves recorded this season.');
  });

  it('reads the prize on the last stage', () => {
    expect(stageAccessibilityLabel(viewModel, stages[prizeStageIndex(stages)]!))
      .toContain('210 Training Points');
  });
});

/**
 * The reel found both of these on its first render, at the 375pt floor.
 */
describe('what the ceremony has to fit on a small phone', () => {
  const screen = readFileSync(
    join(process.cwd(), 'src/ui/screens/AwardsCeremonyScreen.tsx'),
    'utf8',
  );

  /**
   * "Division Awards" in 16pt pixel type is about 188pt wide, centred on a
   * 375pt screen — wider than what is left beside a skip control, so the two
   * cannot share a row at the narrowest supported width. The band above the
   * header is what keeps them apart, and it has to be measured from the
   * control's own geometry or a taller button walks straight back under the
   * title.
   */
  it('reserves the skip controls a band of their own above the title', () => {
    expect(screen).toContain('const SKIP_CONTROL_BAND = SKIP_ROW_INSET');
    expect(screen).toContain('+ SKIP_BUTTON_HEIGHT * SKIP_CONTROL_COUNT');
    expect(screen).toContain('controlBand: { height: SKIP_CONTROL_BAND }');
    expect(screen).toContain('<View style={styles.controlBand} />');
  });

  it('places the skip row from the same constants the band is measured from', () => {
    expect(screen).toContain('right: SKIP_ROW_INSET,');
    expect(screen).toContain('top: SKIP_ROW_INSET,');
    expect(screen).toContain('gap: SKIP_ROW_GAP,');
    expect(screen).toContain('minHeight: SKIP_BUTTON_HEIGHT,');
  });

  it('keeps ordinary names at full size', () => {
    expect(podiumNameType('Flint Vale')).toEqual({
      nameClass: 'text-base',
      clubClass: 'text-sm',
    });
    expect(podiumNameType('A'.repeat(20)).nameClass).toBe('text-base');
  });

  it('steps a long name down rather than ellipsising it', () => {
    expect(podiumNameType('A'.repeat(21)).nameClass).toBe('text-sm');
    expect(podiumNameType('Konstantin Abercrombie-Vasquez').nameClass).toBe('text-xs');
  });

  /** Character creation caps a typed name at 24, so one never goes below `text-sm`. */
  it('holds the longest name a player can type at the middle step', () => {
    expect(podiumNameType('A'.repeat(24)).nameClass).toBe('text-sm');
  });

  /** The row reads name over club; a club set larger than its player is a bug. */
  it('never sets the club larger than the name', () => {
    const ascending = ['text-xs', 'text-sm', 'text-base'];

    for (const length of [1, 20, 21, 26, 27, 40]) {
      const type = podiumNameType('A'.repeat(length));

      expect(ascending.indexOf(type.clubClass))
        .toBeLessThanOrEqual(ascending.indexOf(type.nameClass));
      expect(ascending).toContain(type.nameClass);
    }
  });

  /**
   * The step-down only works if the row keeps its height. Measured on the
   * reel before this was pinned: a stepped row came out 52pt against 68pt,
   * and the podium was visibly uneven.
   */
  it('holds every rostrum card at the full-size row height', () => {
    expect(PODIUM_ROW_MIN_HEIGHT).toBe(68);
    expect(screen).toContain(`min-h-[${PODIUM_ROW_MIN_HEIGHT}px]`);
    expect(screen).not.toContain('min-h-12');
  });

  /**
   * Every step is still one line. A second line would grow one row and make the
   * whole podium reflow the moment a winner's name ran longer than the two
   * already standing beneath him.
   */
  it('never asks a rostrum card for a second line', () => {
    expect(screen).toContain('numberOfLines={1}');
    expect(screen).not.toContain('numberOfLines={2}');
  });
});

describe('the prize count-up', () => {
  it('climbs from zero to the total across the count-up window', () => {
    expect(prizeCountValue(210, 0)).toBe(0);
    expect(prizeCountValue(210, PRIZE_COUNT_UP_MS)).toBe(210);
    expect(prizeCountValue(210, PRIZE_COUNT_UP_MS / 2)).toBeGreaterThan(0);
    expect(prizeCountValue(210, PRIZE_COUNT_UP_MS / 2)).toBeLessThan(210);
  });

  it('holds the total once the window has passed, and never goes backwards', () => {
    expect(prizeCountValue(210, PRIZE_COUNT_UP_MS * 4)).toBe(210);
    expect(prizeCountProgress(-50)).toBe(0);
    expect(prizeCountProgress(Number.NaN)).toBe(0);
  });

  /**
   * The taper is the trap: two boards at D5 pay 210, not 240. The screen shows
   * the banked total and never rebuilds it from the per-board rate.
   */
  it('shows the tapered total rather than the rate times the boards won', () => {
    const prize = { totalTrainingPoints: 210, perCategoryTrainingPoints: 120, boardsWon: 2 };

    expect(prizeCountValue(prize.totalTrainingPoints, PRIZE_COUNT_UP_MS)).toBe(210);
    expect(prizeDetailLine(prize)).toContain('2 boards');
    expect(prizeDetailLine(prize)).not.toContain('240');
  });

  it('states a barren season plainly instead of counting to zero', () => {
    const prize = { totalTrainingPoints: 0, perCategoryTrainingPoints: 120, boardsWon: 0 };

    expect(prizeCountsUp(prize)).toBe(false);
    expect(prizeDetailLine(prize)).toContain('No board went to the club');
    expect(prizeAccessibilityLabel(prize)).toContain('nothing');
  });

  it('reads the total out for a screen reader when there is one', () => {
    expect(prizeAccessibilityLabel({
      totalTrainingPoints: 120,
      perCategoryTrainingPoints: 120,
      boardsWon: 1,
    })).toContain('120 Training Points');
  });
});
