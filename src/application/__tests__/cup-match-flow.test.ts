import {
  CUP_SETTLEMENT_WEEKS,
  DEFAULT_CREATION_RATINGS,
  createCareer,
  cupMismatchWarning,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import type { CareerRepository } from '../../persistence';
import { MissingCareerBackupError } from '../../persistence';
import { createMatch } from '../../sim/match';
import { weeklySettlementAwardKeys } from '../../game/weekly-settlement-awards';
import { useM1Store } from '../store';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';

const PLAY_IN_WEEK = CUP_SETTLEMENT_WEEKS[0];

describe('Hero Cup app routing', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  test('routes from the league match through awakening into the playable cup tie', () => {
    useM1Store.getState().startNewCareer(2);
    useM1Store.getState().completePlayerCreation({
      name: 'Cup Runner',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: withRivalHeroIntrosSeen({
        ...career,
        week: 3,
        phase: 'matchday',
      }),
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState().error).toBeNull();
    // The face-off opens first and holds the awakening behind it: the scene is
    // ahead of the settlement chain, never inside it.
    expect(useM1Store.getState()).toMatchObject({
      screen: 'faceoff',
      pendingPostFaceOffScreen: 'awakening',
      career: { week: 4, phase: 'manage' },
    });

    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'awakening',
      career: { week: 4, phase: 'manage' },
    });

    useM1Store.getState().continueAfterAwakening();
    // The awakening hands back to that match's accounts before the desk.
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: 4, phase: 'manage' },
    });
    // A league defeat ends nothing, so it must never read as a cup exit.
    expect(useM1Store.getState().postMatch!.result.cupExit).toBe(false);

    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      career: { week: 4, phase: 'manage' },
    });

    // The cup settles in weeks the season-1 league leaves empty, so the league
    // round after the play-in week is pulled onto it. That reproduces the
    // season-2-onward double-header this routing has to handle without playing
    // out a whole season first.
    const awakenedCareer = useM1Store.getState().career!;
    const doubleHeaderRound = Math.min(
      ...awakenedCareer.fixtures
        .filter(
          (fixture) =>
            fixture.season === awakenedCareer.season &&
            fixture.week > PLAY_IN_WEEK,
        )
        .map((fixture) => fixture.round),
    );
    useM1Store.setState({
      career: {
        ...awakenedCareer,
        week: PLAY_IN_WEEK,
        phase: 'matchday',
        fixtures: awakenedCareer.fixtures.map((fixture) =>
          fixture.season === awakenedCareer.season &&
          fixture.round === doubleHeaderRound
            ? { ...fixture, week: PLAY_IN_WEEK }
            : fixture,
        ),
      },
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });
    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });

    useM1Store.getState().quickResult();
    useM1Store.getState().completeFaceOff();
    const final = useM1Store.getState();
    expect(final).toMatchObject({
      screen: 'postmatch',
      career: { week: PLAY_IN_WEEK + 1, phase: 'manage' },
      postMatch: {
        result: {
          fixtureId: expect.stringContaining('-cup-'),
          competition: 'Hero Cup · Play-in',
        },
      },
    });
    expect(
      final.career!.m2!.nationalCups[0].rounds[0].fixtures.every(
        (fixture) => fixture.status === 'played',
      ),
    ).toBe(true);
  });

  test('does not open the second match until the league checkpoint is on disk', async () => {
    const initial = createCareer(createLaunchCareerSetup(20260805));
    const doubleHeaderRound = Math.min(
      ...initial.fixtures
        .filter(
          (fixture) =>
            fixture.season === initial.season && fixture.week > PLAY_IN_WEEK,
        )
        .map((fixture) => fixture.round),
    );
    const checkpoint = withRivalHeroIntrosSeen({
      ...initial,
      week: PLAY_IN_WEEK,
      phase: 'matchday' as const,
      fixtures: initial.fixtures.map((fixture) =>
        fixture.season === initial.season && fixture.round === doubleHeaderRound
          ? { ...fixture, week: PLAY_IN_WEEK }
          : fixture,
      ),
    });
    let releaseSave: (() => void) | undefined;
    const repository = emptyCareerRepository({
      save: async () =>
        new Promise<void>((resolve) => {
          releaseSave = resolve;
        }),
    });
    useM1Store.setState({
      career: checkpoint,
      repository,
      persistenceReady: true,
      hasSavedCareer: true,
      lastPersistedCareer: checkpoint,
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'faceoff',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });

    // The face-off stands in front of the ledger. The career is already
    // settled behind it, and still on `matchday` because the second fixture
    // of this double-header week is waiting — which is exactly the case
    // where a face-off built from post-settlement state would name the wrong
    // two players.
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });

    const continuation = useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState().screen).toBe('postmatch');
    for (
      let attempt = 0;
      attempt < 20 && releaseSave === undefined;
      attempt += 1
    ) {
      await Promise.resolve();
    }
    expect(releaseSave).toBeDefined();
    releaseSave?.();
    await continuation;

    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });
  });

  test('hands a watched cup tie its round, and a watched league fixture none', () => {
    // The round is what the match screen's title card is built from, so it has
    // to survive the trip from the bracket into the watched-match context.
    useM1Store.getState().startNewCareer(2);
    useM1Store.getState().completePlayerCreation({
      name: 'Cup Runner',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;

    useM1Store.setState({
      career: withRivalHeroIntrosSeen({
        ...career,
        week: 3,
        phase: 'matchday',
      }),
      screen: 'matchday',
    });
    useM1Store.getState().watchMatch();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().watchedMatch!.cupRoundLabel).toBeUndefined();

    // Season 1 leaves the play-in week empty of league fixtures, so the
    // matchday resolves to the cup tie on its own.
    useM1Store.setState({
      career: { ...career, week: PLAY_IN_WEEK, phase: 'matchday' },
      screen: 'matchday',
    });
    useM1Store.getState().watchMatch();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().watchedMatch!.cupRoundLabel).toBe('Play-in');
  });

  test.each([
    { path: 'Quick Result', watched: false },
    { path: 'watched', watched: true },
  ])(
    'queues exactly one Bert giant-killing walk-on after the $path path',
    ({ watched }) => {
      const prepared = prepareCupTie(2);
      const matchday = prepared.m2!.nationalCups[0].rounds[0].fixtures.find(
        (fixture) =>
          fixture.homeClubId === prepared.userClubId ||
          fixture.awayClubId === prepared.userClubId,
      )!;

      if (watched) {
        useM1Store.getState().watchMatch();
        const context = useM1Store.getState().watchedMatch!;
        const result = createMatch(
          context.fixture.matchSeed,
          context.home,
          context.away,
          { controlledTeam: context.controlledTeam },
        );
        result.score = context.userIsFixtureHome ? [1, 0] : [0, 1];
        result.phase = 'fulltime';
        useM1Store.getState().finishWatchedMatch(result);
        // A duplicate full-time callback is ignored and must not queue Bert twice.
        useM1Store.getState().finishWatchedMatch(result);
      } else {
        useM1Store.getState().quickResult();
        // The post-match screen rejects a double tap at the store boundary.
        useM1Store.getState().quickResult();
      }
      expect(useM1Store.getState().error).toBeNull();

      const prizeLines = useM1Store
        .getState()
        .career!.ledgers.flatMap((ledger) => ledger.lines)
        .filter(
          (line) =>
            line.idempotencyKey ===
            weeklySettlementAwardKeys.cupRound(
              prepared.userClubId,
              prepared.season,
              matchday.round,
            ),
        );
      expect(prizeLines).toEqual([
        expect.objectContaining({ kind: 'prize', amount: 2_000 }),
      ]);
      expect(
        useM1Store.getState().career?.pendingCupGiantKillingCelebrations,
      ).toEqual([
        expect.objectContaining({
          fixtureId: matchday.id,
          divisionGap: 2,
          title: 'Two divisions up!',
        }),
      ]);
      useM1Store.getState().completeCupGiantKillingCelebration();
      expect(
        useM1Store.getState().career?.pendingCupGiantKillingCelebrations,
      ).toBeUndefined();
    },
  );

  test('dismisses the mode-neutral mismatch warning once before the Cup tie', () => {
    const prepared = prepareCupTie(2);
    useM1Store.setState({
      career: { ...prepared, assistantMode: 'advisor' },
      screen: 'matchday',
    });

    const warning = cupMismatchWarning(useM1Store.getState().career!);
    expect(warning).toMatchObject({
      fixtureId: expect.stringContaining('-cup-'),
      divisionGap: 2,
    });

    useM1Store.getState().completeCupMismatchWarning();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      career: { assistantMode: 'advisor' },
    });
    expect(cupMismatchWarning(useM1Store.getState().career!)).toBeUndefined();
  });

  test('calls a knockout defeat the end of the cup run, and a win not', () => {
    // There is no second leg in this competition, so one defeat is the exit —
    // which is what Bert's once-a-career consolation is hung on.
    prepareCupTie(2, 'opponent');
    useM1Store.getState().quickResult();
    expect(useM1Store.getState().postMatch!.result).toMatchObject({
      outcomeLabel: 'LOSS',
      cupExit: true,
    });
    // Being knocked out by a club two divisions up is not a giant-killing.
    expect(
      useM1Store.getState().career?.pendingCupGiantKillingCelebrations,
    ).toBeUndefined();

    useM1Store.setState(useM1Store.getInitialState(), true);
    prepareCupTie(2, 'user');
    useM1Store.getState().quickResult();
    expect(useM1Store.getState().postMatch!.result).toMatchObject({
      outcomeLabel: 'WIN',
      cupExit: false,
    });
  });
});

function emptyCareerRepository(
  overrides: Partial<CareerRepository>,
): CareerRepository {
  return {
    async load() {
      return null;
    },
    async loadRaw() {
      return null;
    },
    async save() {},
    async delete() {},
    async backupSummary() {
      return null;
    },
    async restoreBackup() {
      throw new MissingCareerBackupError();
    },
    async checkIntegrity() {
      return true;
    },
    ...overrides,
  };
}

/**
 * A GENUINE cross-division play-in tie.
 *
 * The user is redrawn against a club that really plays `divisionGap` tiers up,
 * swapping the two clubs' fixtures so every entrant still appears exactly once.
 * Relabelling the same-division draw opponent in `seedDivisionByClubId` — what
 * this used to do — left the club inside `state.clubs`, which is the one thing
 * a real cross-division opponent is never in.
 */
function prepareCupTie(
  divisionGap: 1 | 2,
  winner: 'user' | 'opponent' = 'user',
) {
  useM1Store.getState().startNewCareer(2);
  useM1Store.getState().completePlayerCreation({
    name: 'Cup Runner',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const career = useM1Store.getState().career!;
  const cup = career.m2!.nationalCups[0];
  const fixture = cup.rounds[0].fixtures.find(
    (candidate) =>
      candidate.homeClubId === career.userClubId ||
      candidate.awayClubId === career.userClubId,
  );
  if (fixture === undefined) throw new Error('expected a user play-in fixture');
  const drawnOpponentId =
    fixture.homeClubId === career.userClubId
      ? fixture.awayClubId
      : fixture.homeClubId;
  const opponentDivision = (5 - divisionGap) as 3 | 4;
  const opponentClubId = career
    .m2!.pyramid.divisions.find(
      (division) => division.level === opponentDivision,
    )!
    .clubs.find(
      (club) => cup.seedDivisionByClubId![club.id] === opponentDivision,
    )!.id;
  const strong = {
    pac: 999,
    sho: 999,
    pas: 999,
    def: 999,
    tec: 999,
    sta: 999,
    ref: 999,
  };
  const weak = {
    pac: 1,
    sho: 1,
    pas: 1,
    def: 1,
    tec: 1,
    sta: 1,
    ref: 1,
  };
  // A knockout tie has to end decisively for either assertion to mean anything,
  // so the side that is meant to go through is made unbeatable rather than
  // merely favoured — penalties would otherwise decide it.
  const dominant = winner === 'user' ? strong : weak;
  const overmatched = winner === 'user' ? weak : strong;
  // Straight swap: the user faces the higher-division club, and the club the
  // user was drawn against inherits that club's tie. No entrant is duplicated.
  const swapClub = (clubId: string) =>
    clubId === drawnOpponentId
      ? opponentClubId
      : clubId === opponentClubId
        ? drawnOpponentId
        : clubId;
  const nextCup = {
    ...cup,
    rounds: cup.rounds.map((round, roundIndex) =>
      roundIndex !== 0
        ? round
        : {
            ...round,
            fixtures: round.fixtures.map((candidate) => ({
              ...candidate,
              homeClubId: swapClub(candidate.homeClubId),
              awayClubId: swapClub(candidate.awayClubId),
            })),
            byeClubIds: round.byeClubIds.map(swapClub),
          },
    ),
  };
  const prepared = withRivalHeroIntrosSeen({
    ...career,
    week: PLAY_IN_WEEK,
    phase: 'matchday' as const,
    players: career.players.map((player) =>
      player.clubId === career.userClubId
        ? { ...player, attrs: dominant }
        : player.clubId === opponentClubId
          ? { ...player, attrs: overmatched }
          : player,
    ),
    m2: {
      ...career.m2!,
      nationalCups: career.m2!.nationalCups.map((candidate) =>
        candidate.season === nextCup.season ? nextCup : candidate,
      ),
      pyramid: {
        ...career.m2!.pyramid,
        divisions: career.m2!.pyramid.divisions.map((division) => ({
          ...division,
          clubs: division.clubs.map((club) =>
            club.id !== career.userClubId && club.id !== opponentClubId
              ? club
              : {
                  ...club,
                  squad: club.squad.map((player) => ({
                    ...player,
                    attrs:
                      club.id === career.userClubId ? dominant : overmatched,
                  })),
                },
          ),
        })),
      },
    },
  });
  useM1Store.setState({ career: prepared, screen: 'matchday' });
  return prepared;
}
