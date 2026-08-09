import { loadLaunchContent } from '../../content';
import {
  CUP_SETTLEMENT_WEEKS,
  SEASON_WEEKS,
  createCareer,
  type GameState,
} from '../../game';
import { isTransferWindowOpen } from '../../game/market';
import { copyFor } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { managerNotes } from '../manager-notes';

describe("manager's notes", () => {
  const content = loadLaunchContent();

  function career(seed: number): GameState {
    return createCareer(createLaunchCareerSetup(seed, undefined, content));
  }

  function noteIds(state: GameState, week: number): string[] {
    return managerNotes({ ...state, week }).map((note) => note.id);
  }

  it('opens the transfer window in week 1 and closes it in week 4', () => {
    const state = career(20260901);

    expect(noteIds(state, 1)).toContain('note:transfer-window-open');
    expect(noteIds(state, 2)).not.toContain('note:transfer-window-open');
    expect(noteIds(state, 4)).toContain('note:preseason-windows-closing');
  });

  it('reopens and closes the mid-season window', () => {
    const state = career(20260902);

    expect(noteIds(state, 17)).toContain('note:midseason-window-open');
    expect(noteIds(state, 18)).toContain('note:midseason-window-closing');
  });

  /**
   * The window weeks appear in the copy as literal numbers, so they have to
   * agree with the rule the market actually enforces.
   */
  it('names window weeks that match the market rule', () => {
    const state = career(20260903);
    const openWeeks: number[] = [];
    for (let week = 1; week <= SEASON_WEEKS; week += 1) {
      if (isTransferWindowOpen(week)) openWeeks.push(week);
    }
    expect(openWeeks).toEqual([1, 2, 3, 4, 17, 18]);

    const firstOpen = openWeeks[0];
    const lastPreseason = openWeeks[3];
    expect(noteIds(state, firstOpen)).toContain('note:transfer-window-open');
    expect(noteIds(state, lastPreseason)).toContain(
      'note:preseason-windows-closing',
    );
    expect(noteIds(state, openWeeks[4])).toContain(
      'note:midseason-window-open',
    );
    expect(noteIds(state, openWeeks[5])).toContain(
      'note:midseason-window-closing',
    );
  });

  it('warns that the season is about to end on the final week', () => {
    const state = career(20260904);

    expect(noteIds(state, SEASON_WEEKS)).toContain('note:season-final-week');
    expect(noteIds(state, SEASON_WEEKS - 1)).not.toContain(
      'note:season-final-week',
    );
  });

  it('writes the whole message on the card', () => {
    const notes = managerNotes({ ...career(20260905), week: 1 });

    expect(notes).not.toHaveLength(0);
    for (const note of notes) {
      expect(note.title.startsWith("Manager's Note: ")).toBe(true);
      expect(note.detail.length).toBeGreaterThan(40);
    }
  });

  it('says nothing on an ordinary mid-season week', () => {
    expect(noteIds(career(20260906), 9)).toEqual([]);
  });

  it('stays silent for careers with no transfer market', () => {
    const state = { ...career(20260907), market: undefined };

    expect(noteIds(state, 1)).toEqual([]);
  });

  describe('cup rounds', () => {
    /** Places the user club in this season's cup at the given round. */
    function cupCareer(
      seed: number,
      round: number,
      involvement: 'playing' | 'bye' | 'out',
    ): GameState {
      const state = career(seed);
      const opponentId = state.clubs.find(
        (club) => club.id !== state.userClubId,
      )!.id;
      const otherIds = state.clubs
        .filter(
          (club) => club.id !== state.userClubId && club.id !== opponentId,
        )
        .map((club) => club.id);
      const label = (
        [
          'Play-in',
          'Round of 32',
          'Round of 16',
          'Quarter-final',
          'Semi-final',
          'Final',
        ] as const
      )[round - 1];
      return {
        ...state,
        m2: {
          ...state.m2!,
          nationalCups: [
            {
              careerSeed: state.careerSeed,
              season: state.season,
              rounds: [
                {
                  number: round,
                  label,
                  entrantClubIds: [state.userClubId, opponentId, ...otherIds],
                  byeClubIds: involvement === 'bye' ? [state.userClubId] : [],
                  fixtures:
                    involvement === 'playing'
                      ? [
                          {
                            id: `s1-cup-r${round}-m01`,
                            season: state.season,
                            round,
                            homeClubId: state.userClubId,
                            awayClubId: opponentId,
                            matchSeed: 1,
                            status: 'scheduled' as const,
                          },
                        ]
                      : [
                          {
                            id: `s1-cup-r${round}-m01`,
                            season: state.season,
                            round,
                            homeClubId: opponentId,
                            awayClubId: otherIds[0],
                            matchSeed: 1,
                            status: 'scheduled' as const,
                          },
                        ],
                },
              ],
            },
          ],
        },
      };
    }

    it('names the round, the opponent and what winning is worth', () => {
      const state = cupCareer(20260911, 2, 'playing');
      const week = CUP_SETTLEMENT_WEEKS[1];
      const note = managerNotes({ ...state, week }).find(
        (candidate) => candidate.id === 'note:cup-round:2',
      );

      expect(note?.title).toBe(
        "Manager's Note: Hero Cup Round of 32 this week",
      );
      expect(note?.detail).toContain('Round of 16');
      expect(note?.detail).toContain(`Week ${CUP_SETTLEMENT_WEEKS[2]}`);
    });

    it("names the ground so the venue cannot read as the rival club's", () => {
      // The helper hands the user the home tie, so the away half is built by
      // swapping the two clubs on that same fixture.
      const home = cupCareer(20260911, 2, 'playing');
      const week = CUP_SETTLEMENT_WEEKS[1];
      const cup = home.m2!.nationalCups[0]!;
      const tie = cup.rounds[0]!.fixtures[0]!;
      const away: GameState = {
        ...home,
        m2: {
          ...home.m2!,
          nationalCups: [
            {
              ...cup,
              rounds: [
                {
                  ...cup.rounds[0]!,
                  fixtures: [
                    {
                      ...tie,
                      homeClubId: tie.awayClubId,
                      awayClubId: tie.homeClubId,
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const detailFor = (state: GameState) =>
        managerNotes({ ...state, week }).find(
          (candidate) => candidate.id === 'note:cup-round:2',
        )?.detail;

      expect(detailFor(home)).toMatch(/^Playing .+ at our stadium\./);
      expect(detailFor(away)).toMatch(/^Playing .+ at their stadium\./);
    });

    it('stops updating once the club is knocked out', () => {
      const state = cupCareer(20260912, 2, 'out');

      expect(noteIds(state, CUP_SETTLEMENT_WEEKS[1])).toEqual([]);
    });

    it('explains a bye instead of a tie', () => {
      const state = cupCareer(20260913, 1, 'bye');
      const note = managerNotes({
        ...state,
        week: CUP_SETTLEMENT_WEEKS[0],
      }).find((candidate) => candidate.id === 'note:cup-bye:1');

      expect(note?.title).toContain('bye');
      expect(note?.detail).toContain('Round of 32');
    });

    it('promises the trophy rather than a next round in the final', () => {
      const state = cupCareer(20260914, 6, 'playing');
      const note = managerNotes({
        ...state,
        week: CUP_SETTLEMENT_WEEKS[5],
      }).find((candidate) => candidate.id === 'note:cup-round:6');

      expect(note?.detail).toContain('Hero Cup is yours');
    });

    /**
     * The round is the one word in these notes that came out of the engine, and
     * for that reason it was the one word that stayed English in every language:
     * a German manager read "Heldenpokal, Round of 32 diese Woche". The label
     * itself must not move — `nextCupRoundLabel` matches against it — so the
     * assertion is that the sentence is German *and* the round inside it is too.
     */
    it('translates the round inside the German note, not just the sentence around it', () => {
      const de = copyFor('de');
      const state = cupCareer(20260916, 2, 'playing');
      const week = CUP_SETTLEMENT_WEEKS[1];
      const note = managerNotes({ ...state, week }, de).find(
        (candidate) => candidate.id === 'note:cup-round:2',
      );

      expect(note?.title).toBe(
        'Notiz vom Trainer: Heldenpokal, Sechzehntelfinale diese Woche',
      );
      expect(note?.detail).toContain('Achtelfinale');
      expect(note?.title).not.toContain('Round of 32');
      expect(note?.detail).not.toContain('Round of 16');
    });

    it('translates the round in a German bye note too', () => {
      const de = copyFor('de');
      const state = cupCareer(20260917, 1, 'bye');
      const note = managerNotes(
        { ...state, week: CUP_SETTLEMENT_WEEKS[0] },
        de,
      ).find((candidate) => candidate.id === 'note:cup-bye:1');

      // The title names the round being sat out, the detail the one it resumes
      // at — two different rounds, both of which used to arrive in English.
      expect(note?.title).toBe(
        'Notiz vom Trainer: Freilos im Pokal bis Vorrunde',
      );
      expect(note?.detail).toContain('Sechzehntelfinale');
      expect(note?.detail).not.toContain('Round of 32');
    });

    it('goes quiet once the cup has a champion', () => {
      const state = cupCareer(20260915, 2, 'playing');
      const decided = {
        ...state,
        m2: {
          ...state.m2!,
          nationalCups: [
            { ...state.m2!.nationalCups[0], championClubId: state.userClubId },
          ],
        },
      };

      expect(noteIds(decided, CUP_SETTLEMENT_WEEKS[1])).toEqual([]);
    });
  });
});
