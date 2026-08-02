import { DIVISION_AWARD_PRIZE_AT_D5 } from '../../game/division-award-prize';
import type {
  AwardCategoryId,
  DivisionAwardPlacement,
  SeasonRecap,
} from '../../game/types';
import {
  RUNNER_UP_CEREMONY_LINES,
  WINNER_CEREMONY_LINES,
} from '../../ui/award-ceremony-lines';
import { awardCeremonyViewModel } from '../award-ceremony-view-model';

const CLUB_NAMES = new Map([
  ['me', 'Brambleroad'],
  ['them', 'Quartz FC'],
  ['other', 'Halden Rangers'],
]);

function placement(
  playerId: string,
  playerName: string,
  clubId: string,
  value: number,
): DivisionAwardPlacement {
  return { playerId, playerName, clubId, value };
}

function awards(
  overrides: Partial<Record<AwardCategoryId, DivisionAwardPlacement[]>> = {},
): Record<AwardCategoryId, DivisionAwardPlacement[]> {
  return { goals: [], passesCompleted: [], tacklesWon: [], saves: [], ...overrides };
}

function recap(overrides: Partial<SeasonRecap> = {}): SeasonRecap {
  return {
    season: 3,
    division: 4,
    finalPosition: 2,
    played: 18,
    won: 11,
    drawn: 4,
    lost: 3,
    goalsFor: 40,
    goalsAgainst: 22,
    cashChange: 1200,
    closingCash: 5400,
    trainingCapsReached: 0,
    cupResult: 'Quarter-final',
    divisionAwards: awards(),
    ...overrides,
  };
}

function ceremony(
  overrides: Partial<Parameters<typeof awardCeremonyViewModel>[0]> = {},
): ReturnType<typeof awardCeremonyViewModel> {
  return awardCeremonyViewModel({
    recap: recap(),
    userClubId: 'me',
    clubNames: CLUB_NAMES,
    targetDivision: 5,
    ...overrides,
  });
}

/** A full podium for one category, with the user's club taking the given slot. */
function podium(userSlot?: 1 | 2 | 3): DivisionAwardPlacement[] {
  return [1, 2, 3].map(slot => placement(
    `player-${slot}`,
    `Player ${slot}`,
    slot === userSlot ? 'me' : 'them',
    30 - slot,
  ));
}

describe('awardCeremonyViewModel', () => {
  /**
   * Goals last is the point of the order: the ceremony is watched, so it builds
   * to the most-anticipated category. The League board is scanned and leads
   * with goals for the opposite reason, and the two are not meant to converge.
   */
  it('reveals keepers first and strikers last', () => {
    expect(ceremony().beats.map(beat => beat.categoryId))
      .toEqual(['saves', 'tacklesWon', 'passesCompleted', 'goals']);
  });

  it('labels every beat by the position line and the metric it is won on', () => {
    expect(ceremony().beats.map(beat => [beat.boardLabel, beat.metricLabel])).toEqual([
      ['Keepers', 'Saves'],
      ['Defenders', 'Tackles won'],
      ['Midfielders', 'Passes'],
      ['Strikers', 'Goals'],
    ]);
  });

  it('reveals the podium third, second, then first', () => {
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ goals: podium(2) }) }) })
      .beats[3];

    expect(beat.placings).toEqual([
      { position: 3, playerId: 'player-3', playerName: 'Player 3', clubName: 'Quartz FC', value: 27, isUserPlayer: false },
      { position: 2, playerId: 'player-2', playerName: 'Player 2', clubName: 'Brambleroad', value: 28, isUserPlayer: true },
      { position: 1, playerId: 'player-1', playerName: 'Player 1', clubName: 'Quartz FC', value: 29, isUserPlayer: false },
    ]);
    expect(beat.speaker?.placing).toEqual(beat.placings[1]);
  });

  it('resolves club names from the pyramid and falls back to the id for a club that is gone', () => {
    const [keepers] = ceremony({
      recap: recap({
        divisionAwards: awards({ saves: [placement('gk', 'Dune Halloway', 'dissolved-club', 44)] }),
      }),
    }).beats;

    expect(keepers.placings.map(placing => placing.clubName)).toEqual(['dissolved-club']);
  });

  /**
   * The rule the owner reversed after watching it: a rival's walk-on is a
   * second sprite for a moment that was never the manager's, so a board he has
   * nobody on now reveals its three placings and moves on.
   */
  it('walks nobody on when a rival wins and no player of the manager is on the podium', () => {
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ goals: podium() }) }) })
      .beats[3];

    expect(beat.speaker).toBeUndefined();
    expect(beat.wonByUserPlayer).toBe(false);
    // The rival is still announced at the top of the podium. He just does not
    // walk on to talk about it.
    expect(beat.placings[2].position).toBe(1);
    expect(beat.placings[2].isUserPlayer).toBe(false);
  });

  it('walks the manager own winner on with a winner line', () => {
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ goals: podium(1) }) }) })
      .beats[3];

    expect(beat.speaker?.placing).toEqual(beat.placings[2]);
    expect(beat.speaker?.placing.isUserPlayer).toBe(true);
    expect(beat.speaker?.tone).toBe('winner');
    expect(WINNER_CEREMONY_LINES).toContain(beat.speaker?.line);
    expect(beat.wonByUserPlayer).toBe(true);
  });

  it('walks the manager second-placed player on with a runner-up line', () => {
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ tacklesWon: podium(2) }) }) })
      .beats[1];

    expect(beat.speaker?.placing).toEqual(beat.placings[1]);
    expect(beat.speaker?.placing.isUserPlayer).toBe(true);
    expect(beat.speaker?.tone).toBe('runner-up');
    expect(RUNNER_UP_CEREMONY_LINES).toContain(beat.speaker?.line);
    expect(beat.wonByUserPlayer).toBe(false);
  });

  /** Highest-placed, not second-placed: third is still the best he managed. */
  it('walks the manager third-placed player on when he is the highest of the manager', () => {
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ tacklesWon: podium(3) }) }) })
      .beats[1];

    expect(beat.speaker?.placing.position).toBe(3);
    expect(beat.speaker?.tone).toBe('runner-up');
    expect(RUNNER_UP_CEREMONY_LINES).toContain(beat.speaker?.line);
  });

  /** Exactly one walk-on a board, and it belongs to the man who won it. */
  it('gives the moment to the winner when the manager takes first and second', () => {
    const bothMine = [
      placement('first', 'Gem Arrow', 'me', 29),
      placement('second', 'Wren Sable', 'me', 28),
      placement('third', 'Flint Vale', 'them', 27),
    ];
    const beat = ceremony({ recap: recap({ divisionAwards: awards({ goals: bothMine }) }) })
      .beats[3];

    expect(beat.speaker?.placing.playerId).toBe('first');
    expect(beat.speaker?.placing.position).toBe(1);
    expect(beat.speaker?.tone).toBe('winner');
    expect(WINNER_CEREMONY_LINES).toContain(beat.speaker?.line);
  });

  it('presents a category with fewer than three placings', () => {
    const beat = ceremony({
      recap: recap({
        divisionAwards: awards({
          passesCompleted: [
            placement('one', 'Wren Sable', 'me', 310),
            placement('two', 'Cobble Hart', 'them', 288),
          ],
        }),
      }),
    }).beats[2];

    expect(beat.placings.map(placing => placing.position)).toEqual([2, 1]);
    expect(beat.speaker?.placing.playerId).toBe('one');
    expect(beat.wonByUserPlayer).toBe(true);
  });

  it('presents a podium of three however deep the stored record is', () => {
    const overfull = [...podium(1), placement('four', 'Bram Teller', 'other', 12)];

    expect(ceremony({ recap: recap({ divisionAwards: awards({ goals: overfull }) }) })
      .beats[3].placings.map(placing => placing.playerId))
      .toEqual(['player-3', 'player-2', 'player-1']);
  });

  it('still presents a category nobody registered a figure in', () => {
    const beat = ceremony().beats[0];

    expect(beat.placings).toEqual([]);
    expect(beat.speaker).toBeUndefined();
    expect(beat.wonByUserPlayer).toBe(false);
    expect(beat.emptyLabel).toBe('No saves recorded this season');
  });

  it('gives every speaker in one ceremony a different line', () => {
    const lines = ceremony({
      recap: recap({
        divisionAwards: awards({
          goals: podium(1),
          passesCompleted: podium(1),
          tacklesWon: podium(1),
          saves: podium(1),
        }),
      }),
    }).beats.map(beat => beat.speaker?.line);

    expect(lines.filter(line => line !== undefined)).toHaveLength(4);
    expect(new Set(lines).size).toBe(4);
  });

  it('projects the prize from the division being entered', () => {
    const won = ceremony({
      recap: recap({ divisionAwards: awards({ goals: podium(1), saves: podium(1) }) }),
      targetDivision: 5,
    });

    expect(won.prize.perCategoryTrainingPoints).toBe(DIVISION_AWARD_PRIZE_AT_D5);
    expect(won.prize.boardsWon).toBe(2);
    // Tapered: the second board pays 75% of the first, so the total is not the
    // rate times the count.
    expect(won.prize.totalTrainingPoints).toBe(210);
  });

  it('raises the rate for a club promoted into a higher division', () => {
    const source = { recap: recap({ divisionAwards: awards({ goals: podium(1) }) }) };

    expect(ceremony({ ...source, targetDivision: 4 }).prize.perCategoryTrainingPoints).toBe(140);
    expect(ceremony({ ...source, targetDivision: 4 }).prize.totalTrainingPoints).toBe(140);
  });

  /**
   * The transition stamps what it actually granted. Once that exists it is the
   * record, not a figure the ceremony gets to recompute against a division the
   * club has since left.
   */
  it('prefers the prize banked by the season transition over its own projection', () => {
    const banked = ceremony({
      recap: recap({
        divisionAwards: awards({ goals: podium(1) }),
        divisionAwardPrize: { trainingPoints: 999, categoriesWon: ['goals'] },
      }),
    });

    expect(banked.prize.totalTrainingPoints).toBe(999);
    expect(banked.prize.boardsWon).toBe(1);
  });

  it('runs a complete ceremony for a season the club won nothing in', () => {
    const nothing = ceremony({
      recap: recap({ divisionAwards: awards({ goals: podium(), saves: podium() }) }),
    });

    expect(nothing.beats).toHaveLength(4);
    expect(nothing.beats.every(beat => !beat.wonByUserPlayer)).toBe(true);
    expect(nothing.beats.filter(beat => beat.placings.length > 0)).toHaveLength(2);
    // Two boards were contested and the manager was on neither, so the whole
    // ceremony is podiums and no walk-on at all.
    expect(nothing.beats.every(beat => beat.speaker === undefined)).toBe(true);
    expect(nothing.prize).toEqual({
      totalTrainingPoints: 0,
      perCategoryTrainingPoints: DIVISION_AWARD_PRIZE_AT_D5,
      boardsWon: 0,
    });
  });

  /** A save written before the boards shipped has no podiums to present. */
  it('runs a complete ceremony for a recap with no division awards at all', () => {
    const legacy = ceremony({ recap: recap({ divisionAwards: undefined }) });

    expect(legacy.beats.map(beat => beat.categoryId))
      .toEqual(['saves', 'tacklesWon', 'passesCompleted', 'goals']);
    expect(legacy.beats.every(beat => beat.placings.length === 0)).toBe(true);
    expect(legacy.prize.totalTrainingPoints).toBe(0);
  });

  it('survives a stored record that is missing a category', () => {
    const partial = { goals: [placement('one', 'Gem Arrow', 'me', 21)] } as
      Record<AwardCategoryId, DivisionAwardPlacement[]>;

    const beats = ceremony({ recap: recap({ divisionAwards: partial }) }).beats;

    expect(beats.map(beat => beat.placings.length)).toEqual([0, 0, 0, 1]);
    expect(beats[3].wonByUserPlayer).toBe(true);
  });

  it('names the season being celebrated', () => {
    expect(ceremony().seasonLabel).toBe('Season 3');
  });

  it('produces the same ceremony every time it is built from the same recap', () => {
    const source = {
      recap: recap({
        divisionAwards: awards({ goals: podium(2), saves: podium(1), tacklesWon: podium() }),
      }),
    };

    expect(ceremony(source)).toEqual(ceremony(source));
  });
});
