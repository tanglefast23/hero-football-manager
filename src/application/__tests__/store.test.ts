import {
  assertTransferCashAvailable,
  SAVE_FAILURE_BLOCK_LIMIT,
  setStoreCopy,
  transferTransactionErrorCopy,
  useM1Store,
} from '../store';
import {
  createCareerRepository,
  createReplayRepository,
  MissingCareerBackupError,
  type CareerRepository,
  type ReplayRepository,
} from '../../persistence';
import type { ReplayEnvelope } from '../../sim/types';
import { createMatch, queueInput, runReplay, tick } from '../../sim/match';
import {
  buildCareerFacility,
  careerHeroLimit,
  completeAssistantGuideMilestone,
  CREATED_PLAYER_ROOKIE_WAGE,
  createCareer,
  currentUserDivision,
  DEFAULT_CREATION_RATINGS,
  leagueStandings,
  midseasonTrainingStatus,
  offerCareerEvent,
  pendingRivalHeroIntro,
  startNextSeason,
  type GameState,
} from '../../game';
import { FakePersistenceDatabase } from '../../persistence/__tests__/fake-database';
import type { PostMatchViewModel } from '../../ui';
import { loadLaunchContent } from '../../content';
import { createLaunchCareerSetup } from '../launch';
import {
  awakeningCutsceneViewModel,
  clubFinancesViewModel,
  storyEventViewModel,
} from '../view-models';
import { careerMarketScoutOptions } from '../market-source-adapter';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';
import { copyFor } from '../../i18n';
import {
  outstandingInboxDuties,
  type OpeningInboxDutyId,
} from '../assistant-guide';

describe('M1 app store integration', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('gives an unaffordable transfer tap the requested cash message', () => {
    expect(() => assertTransferCashAvailable(100, 101)).toThrow(
      'transfer fee exceeds current cash',
    );
    expect(
      transferTransactionErrorCopy(
        new Error('transfer fee exceeds current cash'),
      ),
    ).toBe('Not enough Cash');
  });

  it("has Bert explain the scout's one-time favor when the first trip is unaffordable", () => {
    startCreatedCareer(20260805);
    const career = useM1Store.getState().career!;
    const broke = {
      ...career,
      week: 15,
      clubs: career.clubs.map((club) =>
        club.id === career.userClubId ? { ...club, cash: 0 } : club,
      ),
    };
    useM1Store.setState({
      career: broke,
      screen: 'management',
      activeTab: 'market',
    });
    const option = careerMarketScoutOptions(broke)[0];

    useM1Store.getState().startScoutMission(option.id);

    expect(useM1Store.getState().notice).toMatchObject({
      tone: 'info',
      speaker: 'bert',
      message: expect.stringContaining('one for free'),
    });
    expect(useM1Store.getState().career?.market).toMatchObject({
      nextMissionNumber: 2,
      activeScoutMissionFeeWaived: true,
    });
  });

  it('creates the player, plays a powerless first match, and guarantees hero #1', () => {
    useM1Store.getState().startNewCareer(123);
    expect(useM1Store.getState().screen).toBe('create-player');
    expect(userHeroes()).toHaveLength(0);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    expect(useM1Store.getState().screen).toBe('management');
    expect(useM1Store.getState().career?.players).toHaveLength(160);
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('first-match');
    advanceToWeek(3);
    expect(useM1Store.getState().career?.week).toBe(3);

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState()).toMatchObject({ screen: 'matchday' });
    expect(useM1Store.getState().career?.phase).toBe('matchday');

    expect(pendingRivalHeroIntro(useM1Store.getState().career!)).toMatchObject({
      heroId: 'special-f171',
    });
    useM1Store.getState().completeRivalHeroIntro('special-f171');

    useM1Store.getState().quickResult();
    // The career's very first match settles behind the face-off exactly like
    // any other: the scene sits AHEAD of the settlement -> awakening -> ledger
    // chain and never inside it, so the first hero's reveal is already waiting
    // by the time the card is tapped away.
    expect(useM1Store.getState()).toMatchObject({
      screen: 'faceoff',
      pendingPostFaceOffScreen: 'awakening',
    });
    useM1Store.getState().completeFaceOff();

    expect(useM1Store.getState().screen).toBe('awakening');
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('reveal');
    expect(useM1Store.getState().career?.week).toBe(4);
    expect(useM1Store.getState().career?.ledgers).toHaveLength(3);
    expect(useM1Store.getState().career?.onboarding).toMatchObject({
      stage: 'reveal',
      awakenedPower: expect.any(String),
    });
    expect(
      loadLaunchContent().powers.powers.map((power) => power.id),
    ).toContain(useM1Store.getState().career?.onboarding?.awakenedPower);
    expect(useM1Store.getState().career?.awakening.pending).toMatchObject({
      firstHero: true,
      triggerId: 'glowing-caterpillar',
    });
    expect(userHeroes()).toHaveLength(1);
    expect(userHeroes()[0]).toMatchObject({
      name: 'Jo Rook',
      weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
      onHeroWage: false,
      licensed: true,
    });
    useM1Store.getState().continueAfterAwakening();
    // The first hero arrives at the final whistle, but the manager is still owed
    // that match's accounts — the onboarding brief's own "survive the books" job.
    expect(useM1Store.getState()).toMatchObject({ screen: 'postmatch' });
    expect(useM1Store.getState().postMatch).not.toBeNull();
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('complete');
    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({ screen: 'management' });
  });

  it('restores a developer snapshot as the live career and clears transient match UI', () => {
    startCreatedCareer(20260805);
    const snapshot: GameState = {
      ...useM1Store.getState().career!,
      week: 11,
      trainingPoints: 76,
      phase: 'manage',
    };
    useM1Store.setState({
      screen: 'postmatch',
      selectedPlayerId: snapshot.players[0]?.id,
      error: 'Old error',
    });

    useM1Store.getState().restoreDeveloperSave(snapshot, 'B');

    expect(useM1Store.getState()).toMatchObject({
      career: { week: 11, trainingPoints: 76 },
      hasSavedCareer: true,
      lastPersistedCareer: null,
      screen: 'management',
      activeTab: 'home',
      selectedPlayerId: undefined,
      watchedMatch: null,
      postMatch: null,
      weekReview: null,
      error: null,
      notice: { tone: 'info', message: 'Loaded developer save B.' },
    });
  });

  it('still awakens the created player after they are substituted in the first match', () => {
    startCreatedCareer(124);
    advanceToWeek(3);
    useM1Store.getState().advanceCareer();
    useM1Store.getState().watchMatch();

    const watched = useM1Store.getState().watchedMatch!;
    const createdPlayerId =
      useM1Store.getState().career?.onboarding?.createdPlayerId;
    expect(createdPlayerId).toBeDefined();
    const match = createMatch(
      watched.fixture.matchSeed,
      watched.home,
      watched.away,
      {
        controlledTeam: watched.controlledTeam,
      },
    );
    const playerIndex = match.players.findIndex(
      (player) => player.def.id === createdPlayerId,
    );
    const replacement = match.bench[watched.controlledTeam].find(
      (player) => player.role === match.players[playerIndex].def.role,
    );
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    expect(replacement).toBeDefined();

    queueInput(match, {
      tick: 1,
      kind: 'SUBSTITUTE',
      player: playerIndex,
      replacementId: replacement!.id,
    });
    tick(match);
    expect(match.events).toContainEqual(
      expect.objectContaining({
        kind: 'SUBSTITUTION',
        outPlayerId: createdPlayerId,
        inPlayerId: replacement!.id,
      }),
    );
    expect(
      match.players.some((player) => player.def.id === createdPlayerId),
    ).toBe(false);

    match.phase = 'fulltime';
    useM1Store.getState().finishWatchedMatch(match);

    expect(useM1Store.getState()).toMatchObject({
      screen: 'awakening',
      error: null,
    });
    expect(useM1Store.getState().career?.awakening.pending).toMatchObject({
      playerId: createdPlayerId,
      firstHero: true,
    });
  });

  it('validates exact player, coach, and facility selections and guards the no-target escape', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    const nonKeeper = career.players.find(
      (player) => player.clubId === career.userClubId && player.role !== 'GK',
    )!;
    useM1Store.setState({
      career: { ...career, pendingEvent: { eventId: 'the-penalty-gauntlet' } },
      screen: 'event',
    });

    useM1Store.getState().selectEventPlayer(nonKeeper.id);
    expect(useM1Store.getState().error).toContain('not eligible');
    expect(useM1Store.getState().career?.pendingEvent).toEqual({
      eventId: 'the-penalty-gauntlet',
    });
    useM1Store.getState().skipUnavailableEvent();
    expect(useM1Store.getState().error).toContain(
      'still has an eligible target',
    );

    const assistant = career.market!.coachCandidates[0]!;
    const staffed: GameState = {
      ...career,
      market: { ...career.market!, assistantCoach: assistant },
      pendingEvent: { eventId: 'assistant-takes-the-week' },
    };
    useM1Store.setState({ career: staffed, screen: 'event', error: null });
    useM1Store.getState().selectEventCoach('HEAD');
    expect(useM1Store.getState().error).toContain('not eligible');
    useM1Store.getState().selectEventCoach('ASSISTANT');
    expect(useM1Store.getState().career?.pendingEvent).toMatchObject({
      selectedCoachRole: 'ASSISTANT',
    });

    const grid = career.facilities.grid!;
    const withGym: GameState = {
      ...career,
      facilities: {
        ...career.facilities,
        grid: {
          ...grid,
          construction: undefined,
          buildings: [
            ...grid.buildings,
            {
              id: 'store-test-gym',
              type: 'gym',
              level: 1,
              x: 6,
              y: 0,
              capitalInvested: 1_000,
            },
          ],
        },
      },
      pendingEvent: { eventId: 'donated-equipment' },
    };
    useM1Store.setState({ career: withGym, screen: 'event', error: null });
    useM1Store.getState().selectEventFacility('missing-building');
    expect(useM1Store.getState().error).toContain('not eligible');
    useM1Store.getState().selectEventFacility('store-test-gym');
    expect(useM1Store.getState().career?.pendingEvent).toMatchObject({
      selectedFacilityId: 'store-test-gym',
    });

    const otherClubId = career.clubs.find(
      (club) => club.id !== career.userClubId,
    )!.id;
    const noKeeper: GameState = {
      ...career,
      players: career.players.map((player) =>
        player.clubId === career.userClubId && player.role === 'GK'
          ? { ...player, clubId: otherClubId }
          : player,
      ),
      pendingEvent: { eventId: 'the-penalty-gauntlet' },
    };
    useM1Store.setState({ career: noKeeper, screen: 'event', error: null });
    useM1Store.getState().skipUnavailableEvent();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      error: null,
      career: { pendingEvent: undefined },
    });
  });

  it('offers an authored follow-up event before advancing the week', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    const selectedPlayer = career.players.find(
      (player) => player.clubId === career.userClubId && player.role !== 'GK',
    )!;
    useM1Store.setState({
      career: {
        ...career,
        phase: 'manage',
        week: 8,
        pendingEvent: {
          eventId: 'rival-bid-arrives',
          selectedPlayerId: selectedPlayer.id,
          playerLocked: true,
          resolvedChoiceId: 'listen-to-the-rival-bid',
          outcomeText: 'The deadline is real.',
          resolvedOutcomeIndex: 0,
          resolvedRisky: true,
          resolvedSuccess: true,
          resolvedNextEventId: 'rival-bid-deadline-day',
        },
      },
      screen: 'event',
    });

    useM1Store.getState().continueAfterEvent();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'event',
      career: {
        week: 8,
        pendingEvent: { eventId: 'rival-bid-deadline-day' },
        resolvedEventIds: expect.arrayContaining(['rival-bid-arrives']),
      },
    });
  });

  it('ends a chain whose follow-up event this build no longer ships', () => {
    startAwakenedCareer(457);
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...career,
        phase: 'manage',
        week: 8,
        pendingEvent: {
          eventId: 'rival-bid-arrives',
          resolvedChoiceId: 'hundredth-fan-parade',
          outcomeText: 'The parade inspires a new stadium mural.',
          resolvedOutcomeIndex: 0,
          resolvedRisky: true,
          resolvedSuccess: true,
          resolvedNextEventId: 'event-cut-from-the-build',
        },
      },
      screen: 'event',
    });

    useM1Store.getState().continueAfterEvent();

    // Continue used to throw here, and the throw was reachable again on every
    // tap because the dead chain is saved.
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().screen).not.toBe('event');
    expect(useM1Store.getState().career?.pendingEvent).toBeUndefined();
    expect(useM1Store.getState().career?.resolvedEventIds).toContain(
      'rival-bid-arrives',
    );
  });

  /**
   * A story used to be the toll on the way OUT of a week: Advance Week opened
   * the card instead of advancing, and answering it spent the week. It belongs
   * to the week it was drawn for, so it is now the first thing in that week and
   * the manager still has the week to act on whatever it did to the club.
   */
  it("opens a week's story on arrival and hands the week back when it is answered", () => {
    startAwakenedCareer(457);
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...career,
        phase: 'manage',
        week: 8,
        pendingEvent: {
          eventId: 'rival-bid-arrives',
          resolvedChoiceId: 'hundredth-fan-parade',
          outcomeText: 'The parade inspires a new stadium mural.',
          resolvedOutcomeIndex: 0,
          resolvedRisky: true,
          resolvedSuccess: true,
        },
      },
      screen: 'week-review',
    });

    // The review hands over to the story, not to the desk.
    useM1Store.getState().continueWeekReview();
    expect(useM1Store.getState().screen).toBe('event');

    useM1Store.getState().continueAfterEvent();

    // Answered — and week 8 is still there to be played.
    expect(useM1Store.getState().screen).toBe('management');
    expect(useM1Store.getState().career?.week).toBe(8);
    expect(useM1Store.getState().career?.pendingEvent).toBeUndefined();
    expect(useM1Store.getState().career?.resolvedEventIds).toContain(
      'rival-bid-arrives',
    );
  });

  it('trains a player the moment a drill is tapped and reviews the week without it', () => {
    startCreatedCareer(789);
    const started = useM1Store.getState().career!;
    // The shipped opening bank now funds one tier-one drill. This test needs
    // two taps to verify popup sequencing, so fund that exact test contract.
    useM1Store.setState({ career: { ...started, trainingPoints: 14 } });
    const before = useM1Store.getState().career!;
    const playerId = 'bramble-rovers-created-player';
    const unassignedPlayerId = 'bramble-rovers-p14';
    const beforePac = before.players.find((player) => player.id === playerId)!
      .attrs.pac;
    const beforeUnassignedSta = before.players.find(
      (player) => player.id === unassignedPlayerId,
    )!.attrs.sta;

    useM1Store.getState().buildFacility();
    useM1Store.getState().trainPlayer(playerId, 'sprints');

    const trained = useM1Store.getState().career!;
    const result = useM1Store.getState().lastDrillResult!;
    // A new Division 5 club owns Sprints 1: 7 TP.
    expect(result).toMatchObject({
      playerId,
      attribute: 'pac',
      before: beforePac,
      tpSpent: 7,
      sequence: 1,
    });
    expect(result.after).toBeGreaterThan(result.before);
    expect(
      trained.players.find((player) => player.id === playerId)?.attrs.pac,
    ).toBe(result.after);
    expect(trained.trainingPoints).toBe(before.trainingPoints - 7);
    expect(
      trained.players.find((player) => player.id === unassignedPlayerId)?.attrs
        .sta,
    ).toBe(beforeUnassignedSta);
    expect(trained.eventFlags).toContain('guide:bert:first-training-complete');

    // Chain-tap: the popup stays live and the next result re-sequences.
    useM1Store.getState().trainPlayer(playerId, 'sprints');
    expect(useM1Store.getState().lastDrillResult).toMatchObject({
      sequence: 2,
    });
    expect(useM1Store.getState().career?.trainingPoints).toBe(
      before.trainingPoints - 14,
    );

    finishOpeningInboxJobs();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().screen).toBe('week-review');
    const review = useM1Store.getState().weekReview!;
    expect(review).toMatchObject({
      completedWeekLabel: 'Week 1 complete',
      nextWeekLabel: 'Week 2',
    });
    // Development now happens live in the drill popup, never in the review.
    expect(review).not.toHaveProperty('development');
    // The pitch takes two weeks: still building after the first settlement.
    expect(useM1Store.getState().career?.facilities.trainingGroundBuilt).toBe(
      false,
    );
    expect(review.facilityCompletion).toBeUndefined();

    useM1Store.getState().continueWeekReview();
    // Week 2's desk carries the youth intake, which holds Advance Week until it
    // is answered. This test is about the pitch, so it answers and moves on.
    useM1Store.getState().advanceCareer();
    expect(answerRefusedDeskDuty()).toBe(true);
    useM1Store.getState().advanceCareer();
    const secondReview = useM1Store.getState().weekReview!;
    expect(useM1Store.getState().career?.facilities.trainingGroundBuilt).toBe(
      true,
    );
    expect(secondReview.facilityCompletion).toMatchObject({
      type: 'training-pitch',
      name: 'Training Pitch',
      level: 1,
      kind: 'BUILD',
    });
  });

  it('kindly refuses a non-pitch facility as the opening build', () => {
    startCreatedCareer(20260805);
    const before = useM1Store.getState().career!;
    const cashBefore = before.clubs.find(
      (club) => club.id === before.userClubId,
    )!.cash;

    useM1Store.getState().buildClubFacility('gym', { x: 0, y: 0 });

    const after = useM1Store.getState();
    expect(after.error).toBeNull();
    expect(after.notice).toEqual({
      tone: 'info',
      message:
        "Let's build the Training Pitch first. The other facilities will open up once it is underway.",
    });
    expect(after.career?.facilities.grid?.buildings).toEqual([]);
    expect(
      after.career?.clubs.find((club) => club.id === before.userClubId)?.cash,
    ).toBe(cashBefore);
  });

  it('lets an already-stuck opening save advance its wrong project', () => {
    startCreatedCareer(20260806);
    let career = useM1Store.getState().career!;
    career = completeAssistantGuideMilestone(career, 'intro-complete');
    career = completeAssistantGuideMilestone(career, 'first-training-complete');
    career = buildCareerFacility(career, 'gym', { x: 0, y: 0 }).state;
    useM1Store.setState({ career, activeTab: 'home', screen: 'management' });
    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId, 'HEAD');

    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'week-review',
      error: null,
    });
    expect(useM1Store.getState().career).toMatchObject({
      week: 2,
      facilities: {
        grid: { construction: { type: 'gym', weeksRemaining: 1 } },
      },
    });
  });

  /**
   * Skipping out of the presentation used to cancel the drills still queued
   * behind it: a confirmed 3x batch counted only the cards the manager sat
   * through. The animation is the optional part, not the training.
   */
  it('runs the drills queued behind a skipped presentation', () => {
    startCreatedCareer(789);
    // The 21 TP test bank buys the three drills exercised by this case.
    useM1Store.setState({
      career: { ...useM1Store.getState().career!, trainingPoints: 21 },
    });
    const before = useM1Store.getState().career!;
    const playerId = 'bramble-rovers-created-player';

    useM1Store.getState().buildFacility();
    // The manager confirms three runs, watches the first, then taps outside.
    useM1Store.getState().trainPlayer(playerId, 'sprints');
    const watched = useM1Store.getState().lastDrillResult!;
    useM1Store.getState().trainPlayerBatch(playerId, 'sprints', 2);

    const finished = useM1Store.getState().career!;
    expect(useM1Store.getState().error).toBeNull();
    // All three counted: the TP, the tally, and the stat itself.
    expect(finished.trainingPoints).toBe(before.trainingPoints - 21);
    expect(finished.totalInstantDrills).toBe(3);
    expect(useM1Store.getState().lastDrillResult).toMatchObject({
      sequence: 3,
    });
    expect(
      finished.players.find((player) => player.id === playerId)!.attrs.pac,
    ).toBeGreaterThan(watched.after);
  });

  it('trains nobody when the skipped batch belongs to a player who has pulled up', () => {
    startCreatedCareer(789);
    useM1Store.getState().buildFacility();
    const playerId = 'bramble-rovers-created-player';
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...career,
        players: career.players.map((player) =>
          player.id === playerId ? { ...player, injuryWeeks: 3 } : player,
        ),
      },
    });
    const before = useM1Store.getState().career!;

    useM1Store.getState().trainPlayerBatch(playerId, 'sprints', 2);

    // Silently, and without an error banner: the batch simply has nowhere to go.
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().career?.trainingPoints).toBe(
      before.trainingPoints,
    );
    expect(useM1Store.getState().career?.totalInstantDrills ?? 0).toBe(0);
  });

  it('accepts a TRAINING_PRIORITY renewal as a five-drill debt', () => {
    useM1Store.getState().startNewCareer(20260831);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    const trainee = career.players.find(
      (player) =>
        player.clubId === career.userClubId &&
        player.contractPromise === undefined,
    )!;
    const seasonEndCareer: GameState = {
      ...career,
      phase: 'season-end',
      players: career.players.map((player) =>
        player.id === trainee.id
          ? { ...player, contractSeasonsRemaining: 0 }
          : player,
      ),
    };
    useM1Store.setState({ career: seasonEndCareer });

    useM1Store.getState().startRenewal(trainee.id);
    expect(useM1Store.getState().error).toBeNull();
    useM1Store.getState().submitRenewalOffer({
      weeklyWage: 999999,
      termSeasons: 3,
      perk: 'TRAINING_PRIORITY',
    });

    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().career?.market?.renewalTalks).toBeUndefined();
    // The promise is a debt: the player is now owed their next five drills,
    // which block other training until the countdown drains.
    expect(
      useM1Store
        .getState()
        .career?.players.find((player) => player.id === trainee.id),
    ).toMatchObject({
      contractPromise: expect.objectContaining({ perk: 'TRAINING_PRIORITY' }),
      priorityDrillsRemaining: 5,
    });
  });

  it('lands a third-hero renewal during the D4 promotion review that unlocks license three', () => {
    startCreatedCareer(20260808);
    const initial = useM1Store.getState().career!;
    const contractsReady: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.clubId === initial.userClubId
          ? {
              ...player,
              contractSeasonsRemaining: Math.max(
                2,
                player.contractSeasonsRemaining,
              ),
            }
          : player,
      ),
    };
    const d4 = startNextSeason(completedSeasonForUser(contractsReady));
    expect(currentUserDivision(d4.m2!)).toBe(4);
    const userPlayers = d4.players.filter(
      (player) => player.clubId === d4.userClubId,
    );
    const licensedIds = new Set(
      userPlayers.slice(0, 2).map((player) => player.id),
    );
    const target = userPlayers[2]!;
    const promotionEnd = completedSeasonForUser({
      ...d4,
      market: { ...d4.market!, renewalTalks: undefined },
      players: d4.players.map((player) => {
        if (player.id === target.id) {
          return {
            ...player,
            age: 22,
            contractSeasonsRemaining: 0,
            power: 'FIRE_TORCH' as never,
            licensed: false,
            loyalty: 100,
            retirementAnnounced: false,
            retirementAnnouncementSeason: undefined,
          };
        }
        if (licensedIds.has(player.id)) {
          return {
            ...player,
            contractSeasonsRemaining: Math.max(
              1,
              player.contractSeasonsRemaining,
            ),
            power: 'FIRE_TORCH' as never,
            licensed: true,
          };
        }
        return player.clubId === d4.userClubId
          ? {
              ...player,
              licensed: false,
              contractSeasonsRemaining: Math.max(
                1,
                player.contractSeasonsRemaining,
              ),
            }
          : player;
      }),
    });
    expect(
      leagueStandings(promotionEnd).find(
        (row) => row.clubId === promotionEnd.userClubId,
      )?.position,
    ).toBe(1);
    expect(careerHeroLimit(promotionEnd)).toBe(2);
    useM1Store.setState({ career: promotionEnd, error: null });

    useM1Store.getState().startRenewal(target.id);
    useM1Store.getState().submitRenewalOffer({
      weeklyWage: 999_999,
      termSeasons: 1,
      perk: 'GUARANTEED_STARTER',
    });

    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().career?.market?.renewalTalks).toBeUndefined();
    expect(
      useM1Store
        .getState()
        .career?.players.find((player) => player.id === target.id),
    ).toMatchObject({
      contractSeasonsRemaining: 1,
      licensed: true,
      contractPromise: expect.objectContaining({ perk: 'GUARANTEED_STARTER' }),
    });
  });

  it('localizes the typed promise backstop if a blocked offer is submitted anyway', () => {
    startCreatedCareer(20260809);
    const initial = useM1Store.getState().career!;
    const userPlayers = initial.players.filter(
      (player) => player.clubId === initial.userClubId,
    );
    const licensedIds = new Set(
      userPlayers.slice(0, 2).map((player) => player.id),
    );
    const target = userPlayers[2]!;
    const capped: GameState = {
      ...initial,
      phase: 'season-end',
      players: initial.players.map((player) => {
        if (player.id === target.id) {
          return {
            ...player,
            age: 22,
            contractSeasonsRemaining: 0,
            power: 'FIRE_TORCH' as never,
            licensed: false,
            loyalty: 100,
            retirementAnnounced: false,
            retirementAnnouncementSeason: undefined,
          };
        }
        return licensedIds.has(player.id)
          ? {
              ...player,
              contractSeasonsRemaining: Math.max(
                1,
                player.contractSeasonsRemaining,
              ),
              power: 'FIRE_TORCH' as never,
              licensed: true,
            }
          : player;
      }),
    };
    const vietnamese = copyFor('vi');
    setStoreCopy(vietnamese);
    try {
      useM1Store.setState({ career: capped, error: null });
      useM1Store.getState().startRenewal(target.id);
      useM1Store.getState().submitRenewalOffer({
        weeklyWage: 999_999,
        termSeasons: 1,
        perk: 'GUARANTEED_STARTER',
      });

      expect(useM1Store.getState().error).toBe(
        vietnamese('market.promiseBlockedHeroLicense', { player: target.name }),
      );
      expect(useM1Store.getState().error).not.toContain(
        'No Hero License is free',
      );
      expect(useM1Store.getState().career?.market?.renewalTalks).toBeDefined();
    } finally {
      setStoreCopy(copyFor('en'));
    }
  });

  it('surfaces a tap the bank cannot afford without advancing anything', () => {
    startCreatedCareer(794);
    const career = useM1Store.getState().career!;
    const playerId = career.players.find(
      (player) => player.clubId === career.userClubId,
    )!.id;
    useM1Store.setState({ career: { ...career, trainingPoints: 0 } });

    useM1Store.getState().trainPlayer(playerId, 'sprints');

    expect(useM1Store.getState().error).toContain('needs 7 TP');
    expect(useM1Store.getState().lastDrillResult).toBeNull();
    expect(
      useM1Store
        .getState()
        .career?.players.find((player) => player.id === playerId)?.attrs,
    ).toEqual(career.players.find((player) => player.id === playerId)?.attrs);
  });

  it('updates the Starting XI through the app store', () => {
    startCreatedCareer(788);
    const before = useM1Store.getState().career!;
    const { starterId, replacementId } = firstAvailableLineupSwap(before);

    useM1Store.getState().swapStartingPlayer(starterId, replacementId);

    const after = useM1Store.getState().career!;
    const nextLineup = after.lineups.find(
      (candidate) => candidate.clubId === after.userClubId,
    )!;
    expect(nextLineup.playerIds).toContain(replacementId);
    expect(nextLineup.playerIds).not.toContain(starterId);
    expect(useM1Store.getState().error).toBeNull();
  });

  it('advances a week with no training and returns to the new week from the review', () => {
    startCreatedCareer(791);
    finishOpeningInboxJobs();

    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().screen).toBe('week-review');
    useM1Store.getState().continueWeekReview();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      weekReview: null,
    });
  });

  it('returns Home beneath the statement, then dismisses it', () => {
    const postMatch = examplePostMatch();
    useM1Store.setState({
      screen: 'postmatch',
      postMatch,
      postMatchOverlay: null,
    });

    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      activeTab: 'home',
      postMatch,
      postMatchOverlay: 'summary',
    });

    useM1Store.getState().dismissPostMatchSummary();
    expect(useM1Store.getState()).toMatchObject({
      postMatch: null,
      postMatchOverlay: null,
    });
  });

  it('shows the financial summary before a queued achievement story', () => {
    const postMatch = examplePostMatch();
    const career = {
      ...createCareer(createLaunchCareerSetup(20260810)),
      phase: 'manage' as const,
      pendingMilestones: [{ eventId: 'milestone-first-cup-win' }],
    };
    useM1Store.setState({
      career,
      screen: 'postmatch',
      postMatch,
      postMatchOverlay: null,
    });

    useM1Store.getState().continueAfterMatch();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      postMatchOverlay: 'summary',
      career: {
        pendingEvent: { eventId: 'milestone-first-cup-win' },
      },
    });

    useM1Store.getState().dismissPostMatchSummary();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'event',
      postMatch: null,
      postMatchOverlay: null,
      career: {
        pendingEvent: { eventId: 'milestone-first-cup-win' },
      },
    });
  });

  it('shows simultaneous achievements in one post-match interruption sequence', () => {
    const base = createCareer(createLaunchCareerSetup(20260811));
    useM1Store.setState({
      career: {
        ...base,
        phase: 'manage',
        pendingMilestones: [{ eventId: 'milestone-crowd-thousand' }],
        pendingEvent: {
          eventId: 'milestone-first-cup-win',
          resolvedChoiceId: 'remember-the-night',
          outcomeText: 'The first Cup win is recorded.',
        },
        eventClock: {
          ...base.eventClock,
          storySettledSeason: base.season,
          storySettledWeek: base.week,
        },
      },
      screen: 'event',
    });

    useM1Store.getState().continueAfterEvent();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'event',
      career: {
        pendingEvent: { eventId: 'milestone-crowd-thousand' },
      },
    });
  });

  it('persists Bert guide progress and clears his first-week objective after advancing', () => {
    startCreatedCareer(790);
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().setActiveTab('squad');
    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildFacility();
    useM1Store.getState().setActiveTab('home');

    expect(useM1Store.getState().career?.eventFlags).toEqual(
      expect.arrayContaining([
        'guide:bert:intro-complete',
        'guide:bert:first-training-complete',
      ]),
    );

    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.eventFlags).toContain(
      'guide:bert:first-week-advanced',
    );
  });

  it('blocks advancing until the first guided training plan is finished', () => {
    startCreatedCareer(791);
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().setActiveTab('squad');
    const weekBefore = useM1Store.getState().career!.week;

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().error).toBe(
      'Train a player before advancing the week.',
    );

    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'facility-placement',
      'head-coach-market',
    ]);

    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().inboxDutyReminder).toContain(
      'facility-placement',
    );

    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildFacility();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'head-coach-market',
    ]);

    useM1Store.getState().setActiveTab('home');
    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore + 1);
  });

  it('warns only after Advance Week is tapped with one first-week inbox item left', () => {
    useM1Store.getState().startNewCareer(792);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().setActiveTab('squad');
    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildClubFacility('training-pitch', { x: 0, y: 0 });
    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().clearNotice();
    const weekBefore = useM1Store.getState().career!.week;

    expect(useM1Store.getState().notice).toBeNull();
    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'head-coach-market',
    ]);
    expect(useM1Store.getState().career?.eventFlags).not.toContain(
      'guide:bert:desk-intro-complete',
    );

    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore + 1);
  });

  it("takes the first week's two inbox jobs in either order", () => {
    // Bert points at the pitch, but the coach is a job too, not a queue
    // position. Doing them the other way round has to reach the same week 2.
    useM1Store.getState().startNewCareer(793);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().setActiveTab('squad');
    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().setActiveTab('home');
    const weekBefore = useM1Store.getState().career!.week;

    // The coach first — the one the desk used to refuse until the pitch was up.
    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'facility-placement',
    ]);

    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildClubFacility('training-pitch', { x: 0, y: 0 });
    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore + 1);
  });

  it('completes the real default two-season store flow through events, licenses, and renewal', () => {
    startCreatedCareer(24680);
    useM1Store.getState().buildFacility();
    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');

    driveStoreUntil((state) => state.career?.phase === 'season-end');
    const seasonOne = useM1Store.getState().career!;
    expect(seasonOne.season).toBe(1);
    expect(
      seasonOne.clubs.find((club) => club.id === seasonOne.userClubId)?.cash,
    ).toBeGreaterThanOrEqual(0);
    expect(userHeroes().length).toBeGreaterThanOrEqual(1);
    expect(
      userHeroes().filter((player) => player.licensed).length,
    ).toBeLessThanOrEqual(2);
    expect(
      seasonOne.players.filter(
        (player) =>
          player.clubId === seasonOne.userClubId &&
          player.contractSeasonsRemaining === 0,
      ),
    ).toHaveLength(1);

    const expiredHero = seasonOne.players.find(
      (player) =>
        player.clubId === seasonOne.userClubId &&
        player.power !== undefined &&
        player.contractSeasonsRemaining === 0,
    )!;
    useM1Store.getState().renewPlayer(expiredHero.id, 1);
    useM1Store.getState().advanceCareer();
    driveStoreUntil(
      (state) =>
        state.career?.season === 2 && state.career?.phase === 'season-end',
    );

    expect(useM1Store.getState().career).toMatchObject({
      season: 2,
      phase: 'season-end',
    });
  });

  it('survives a save/kill/relaunch checkpoint after every persisted journey boundary', async () => {
    const database = new FakePersistenceDatabase();
    const careerRepository = await createCareerRepository(database);
    const replayRepository = await createReplayRepository(database);
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(97531);
    let checkpoints = await relaunchCheckpoint(
      careerRepository,
      replayRepository,
    );
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    const { starterId, replacementId } = firstAvailableLineupSwap(
      useM1Store.getState().career!,
    );
    useM1Store.getState().swapStartingPlayer(starterId, replacementId);
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    expect(
      useM1Store
        .getState()
        .career?.lineups.find(
          (lineup) =>
            lineup.clubId === useM1Store.getState().career?.userClubId,
        )?.playerIds,
    ).toContain(replacementId);
    useM1Store.getState().buildFacility();
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    useM1Store
      .getState()
      .trainPlayer('bramble-rovers-created-player', 'sprints');
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);

    let watchedMatches = 0;
    // The season transition replaces the fixture list, so record every played
    // score as the journey goes to verify Season 1 replays after Season 2.
    const scoreByFixtureId = new Map<string, [number, number]>();
    let journeyCompleted = false;
    // Club Business adds persisted Bert deliveries and safe league-to-Cup save
    // checkpoints. Six hundred is a deadlock guard, not the expected journey
    // length; exhausting it now fails explicitly instead of falling through to
    // a misleading phase assertion.
    for (let step = 0; step < 600; step += 1) {
      const current = useM1Store.getState();
      const career = current.career;
      if (career === null)
        throw new Error('career disappeared during persisted journey');
      const cupFixtures = (career.m2?.nationalCups ?? []).flatMap((cup) =>
        cup.rounds.flatMap((round) => round.fixtures),
      );
      for (const fixture of [...career.fixtures, ...cupFixtures]) {
        if (fixture.score === undefined) continue;
        scoreByFixtureId.set(fixture.id, [
          fixture.score.homeGoals,
          fixture.score.awayGoals,
        ]);
      }
      // The career is endless, so the journey stops at Season 2's boundary.
      if (career.season === 2 && career.phase === 'season-end') {
        journeyCompleted = true;
        break;
      }

      if (current.screen === 'awakening') {
        current.continueAfterAwakening();
      } else if (current.screen === 'event') {
        progressJourneyEvent(current);
      } else if (current.screen === 'matchday') {
        const rivalIntro = pendingRivalHeroIntro(career);
        if (rivalIntro !== undefined) {
          current.completeRivalHeroIntro(rivalIntro.heroId);
        } else if (watchedMatches === 0) {
          current.watchMatch();
          const watched = useM1Store.getState().watchedMatch;
          if (watched === null)
            throw new Error('watched match context was not created');
          const match = createMatch(
            watched.fixture.matchSeed,
            watched.home,
            watched.away,
            {
              controlledTeam: watched.controlledTeam,
              homePolicy: 'FIRE_WHEN_READY',
              awayPolicy: 'FIRE_WHEN_READY',
            },
          );
          queueInput(match, {
            tick: 1,
            kind: 'SET_FORMATION',
            formation: '4-3-3',
          });
          queueInput(match, {
            tick: 1,
            kind: 'SET_MENTALITY',
            mentality: 'ATTACK',
          });
          while (match.phase !== 'fulltime') tick(match);
          useM1Store.getState().finishWatchedMatch(match);
          watchedMatches += 1;
        } else {
          current.quickResult();
        }
      } else if (current.screen === 'championship-celebration') {
        current.completeChampionshipCelebration();
      } else if (current.screen === 'awards-ceremony') {
        current.completeAwardsCeremony();
      } else if (current.screen === 'season-end') {
        if (career.phase === 'season-end') {
          const expired = career.players.find(
            (player) =>
              player.clubId === career.userClubId &&
              player.contractSeasonsRemaining === 0,
          );
          if (expired !== undefined) current.renewPlayer(expired.id, 1);
          else current.advanceCareer();
        } else {
          break;
        }
      } else if (current.screen === 'faceoff') {
        // Quick Result opens the face-off first; the manager taps through it.
        current.completeFaceOff();
      } else if (midseasonTrainingStatus(career) === 'prompt') {
        // This broad persistence journey tests every later season boundary, not
        // the Yes branch. Decline the Week 19 decision so Advance Week is no
        // longer correctly blocked by the unanswered captain request.
        current.declineMidseasonTraining();
      } else if (
        current.screen === 'management' ||
        current.screen === 'postmatch' ||
        current.screen === 'week-review'
      ) {
        // League/Cup double-headers deliberately checkpoint the first match
        // before exposing the second. Await that persisted boundary before the
        // test kills and relaunches the app, exactly as the UI does.
        if (current.screen === 'postmatch') await current.continueAfterMatch();
        else if (current.screen === 'week-review') current.continueWeekReview();
        else if (current.postMatchOverlay === 'summary')
          current.dismissPostMatchSummary();
        // A story waits on the desk as an inbox card now, so the journey has to
        // open it the way a manager would rather than advance past it.
        else if (career.pendingEvent !== undefined) current.openDeskStory();
        else {
          // Same again for an opening-week duty, answered in the same step as
          // the press it refuses: the reminder is in-memory app state by design,
          // so the relaunch checkpoint below would wipe it and the journey would
          // press the same refused button until it ran out of steps.
          current.advanceCareer();
          answerRefusedDeskDuty();
        }
      } else {
        throw new Error(
          `unexpected persisted journey screen ${current.screen}`,
        );
      }

      checkpoints += await relaunchCheckpoint(
        careerRepository,
        replayRepository,
      );
    }

    const completed = useM1Store.getState().career!;
    expect(journeyCompleted).toBe(true);
    expect(completed).toMatchObject({ season: 2, phase: 'season-end' });
    expect(completed.ledgers).toHaveLength(60);
    expect(userHeroes().length).toBeGreaterThanOrEqual(1);
    expect(
      userHeroes().filter((player) => player.licensed).length,
    ).toBeLessThanOrEqual(2);
    expect(watchedMatches).toBe(1);
    expect(checkpoints).toBeGreaterThan(80);

    const replays = await replayRepository.listForCareer(
      `m1-career-${completed.careerSeed}`,
    );
    expect(replays.length).toBeGreaterThan(20);
    expect(
      replays.some((replay) =>
        replay.envelope.inputs.some((input) => input.kind === 'SET_FORMATION'),
      ),
    ).toBe(true);
    for (const replay of replays) {
      const score = scoreByFixtureId.get(replay.fixtureId);
      if (score === undefined)
        throw new Error(`missing played fixture ${replay.fixtureId}`);
      expect(runReplay(replay.envelope).score).toEqual(score);
    }
  }, 300000);

  it('resumes a saved final-match awakening and continues to the season review', async () => {
    const database = new FakePersistenceDatabase();
    const careerRepository = await createCareerRepository(database);
    const replayRepository = await createReplayRepository(database);
    startAwakenedCareer(8642);
    const current = useM1Store.getState().career!;
    const candidate = current.players.find(
      (player) =>
        player.clubId === current.userClubId && player.power === undefined,
    )!;
    const fixture = current.fixtures.find(
      (item) =>
        item.status === 'played' &&
        (item.homeClubId === current.userClubId ||
          item.awayClubId === current.userClubId),
    )!;
    const pendingCareer = {
      ...current,
      phase: 'season-end' as const,
      players: current.players.map((player) =>
        player.id === candidate.id
          ? { ...player, power: 'SUPER_STRENGTH' as const }
          : player,
      ),
      awakening: {
        matchesSinceLastAwakening: 0,
        usedTriggerIds: ['glowing-caterpillar'],
        pending: {
          fixtureId: fixture.id,
          playerId: candidate.id,
          power: 'SUPER_STRENGTH' as const,
          triggerId: 'glowing-caterpillar',
          firstHero: false,
        },
      },
    };
    await careerRepository.save(pendingCareer);

    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);
    useM1Store.getState().continueCareer();
    expect(useM1Store.getState().screen).toBe('awakening');

    useM1Store.getState().continueAfterAwakening();
    // The division awards stand between the last whistle and the recap, so a
    // resumed final-match awakening lands on the ceremony first.
    expect(useM1Store.getState().screen).toBe('awards-ceremony');
    useM1Store.getState().completeAwardsCeremony();
    expect(useM1Store.getState().screen).toBe('season-end');
    expect(useM1Store.getState().career?.awakening.pending).toBeUndefined();
  });

  it('blocks a new career after a load failure without overwriting the save', async () => {
    let careerSaveCalls = 0;
    let replayResetCalls = 0;
    const careerRepository = stubCareerRepository({
      async load() {
        throw new Error('database read failed');
      },
      async save() {
        careerSaveCalls += 1;
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer() {
        replayResetCalls += 1;
      },
    };

    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);
    useM1Store.getState().startNewCareer(999);

    expect(useM1Store.getState().career).toBeNull();
    expect(useM1Store.getState().persistenceLoadError).toContain(
      'database read failed',
    );
    expect(useM1Store.getState().error).toBe(
      'Resolve the save-load error before replacing this career.',
    );
    expect(careerSaveCalls).toBe(0);
    expect(replayResetCalls).toBe(0);
  });

  it('discards an unreadable save on request and unblocks a fresh career', async () => {
    let deleteCalls = 0;
    const careerRepository = stubCareerRepository({
      async load() {
        throw new Error('career save is corrupt');
      },
      async delete() {
        deleteCalls += 1;
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer() {},
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);
    expect(useM1Store.getState().persistenceLoadError).toContain(
      'career save is corrupt',
    );

    await useM1Store.getState().discardUnreadableSave();

    expect(deleteCalls).toBe(1);
    expect(useM1Store.getState().persistenceLoadError).toBeNull();
    expect(useM1Store.getState().career).toBeNull();
    expect(useM1Store.getState().hasSavedCareer).toBe(false);
    expect(useM1Store.getState().screen).toBe('welcome');

    useM1Store.getState().startNewCareer(777);
    expect(useM1Store.getState().career).not.toBeNull();
    expect(useM1Store.getState().error).toBeNull();
  });

  it('exports the raw payload before reset and blocks deletion after a requested export fails', async () => {
    let deleteCalls = 0;
    const raw = '{"schemaVersion":1,"careerSeed":777}';
    const careerRepository = stubCareerRepository({
      async load() {
        throw new Error('game state schema 1 is unsupported');
      },
      async loadRaw() {
        return { schemaVersion: 1, stateJson: raw };
      },
      async delete() {
        deleteCalls += 1;
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().exportUnreadableSave(async () => {
      throw new Error('share sheet failed');
    });
    await useM1Store.getState().discardUnreadableSave();

    expect(deleteCalls).toBe(0);
    expect(useM1Store.getState().persistenceLoadError).toContain(
      'has not been deleted',
    );

    const shared: string[] = [];
    await useM1Store
      .getState()
      .exportUnreadableSave(async (fileName, contents) => {
        shared.push(fileName, contents);
      });
    await useM1Store.getState().exportUnreadableSave(async () => {
      throw new Error('second share was dismissed');
    });
    await useM1Store.getState().discardUnreadableSave();

    expect(shared).toEqual(['hero-football-manager-raw-schema-1.json', raw]);
    expect(deleteCalls).toBe(1);
    expect(useM1Store.getState().persistenceLoadError).toBeNull();
  });

  it('leaves an incompatible save untouched when the recovery flow is relaunched or cancelled', async () => {
    let deleteCalls = 0;
    const repository = stubCareerRepository({
      async load() {
        throw new Error('game state schema 1 is unsupported');
      },
      async loadRaw() {
        return { schemaVersion: 1, stateJson: '{"schemaVersion":1}' };
      },
      async delete() {
        deleteCalls += 1;
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await useM1Store.getState().exportUnreadableSave(async () => {
      throw new Error('cancelled');
    });
    expect(deleteCalls).toBe(0);

    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store.getState().initializePersistence(repository);
    expect(useM1Store.getState().rawExportRequired).toBe(false);
    expect(deleteCalls).toBe(0);
  });

  it('never deletes a save that loaded cleanly', async () => {
    let deleteCalls = 0;
    const careerRepository = stubCareerRepository({
      async delete() {
        deleteCalls += 1;
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().discardUnreadableSave();

    expect(deleteCalls).toBe(0);
  });

  it('keeps the boot failure visible when discarding the save fails', async () => {
    const careerRepository = stubCareerRepository({
      async load() {
        throw new Error('career save is corrupt');
      },
      async delete() {
        throw new Error('disk is on fire');
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().discardUnreadableSave();

    expect(useM1Store.getState().persistenceLoadError).toContain(
      'disk is on fire',
    );
  });

  it('warns while progress is unsaved and pauses the season after repeated failures', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await useM1Store.getState().initializePersistence(repository);
    startCreatedCareer(31337);
    // `hasSavedCareer` flips optimistically, so wait for the row itself.
    await waitFor(
      () => database.careerRow !== null && !useM1Store.getState().saving,
    );
    finishOpeningInboxJobs();
    await waitFor(() => !useM1Store.getState().saving);

    // The disk fills. The first failed week is a dismissible toast today, which
    // is how a player keeps advancing a career that only exists in memory.
    database.writesFail = true;
    useM1Store.getState().advanceCareer();
    const advancedWeek = useM1Store.getState().career!.week;
    await waitFor(() => useM1Store.getState().saveWarning !== null);

    expect(useM1Store.getState().consecutiveSaveFailures).toBe(1);
    expect(useM1Store.getState().saveBlocked).toBe(false);

    useM1Store.getState().retrySave();
    await waitFor(() => useM1Store.getState().consecutiveSaveFailures === 2);
    useM1Store.getState().retrySave();
    await waitFor(() => useM1Store.getState().saveBlocked);

    expect(useM1Store.getState().consecutiveSaveFailures).toBe(
      SAVE_FAILURE_BLOCK_LIMIT,
    );
    expect(useM1Store.getState().saveWarning).toContain('paused');

    // Back to management first: the advance above raised a week review, and
    // advanceCareer only dispatches from the shell that owns the button.
    if (useM1Store.getState().screen === 'week-review') {
      useM1Store.getState().continueWeekReview();
    }
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().error).toContain('could not be saved');
    expect(useM1Store.getState().career?.week).toBe(advancedWeek);

    // Space freed: one successful save clears the warning and the pause.
    database.writesFail = false;
    useM1Store.getState().retrySave();
    await waitFor(() => !useM1Store.getState().saveBlocked);

    expect(useM1Store.getState().saveWarning).toBeNull();
    expect(useM1Store.getState().consecutiveSaveFailures).toBe(0);
    // The week the save pause was lifted on still carries its own desk duty,
    // and that refusal is a separate thing from the save block being cleared.
    useM1Store.getState().advanceCareer();
    answerRefusedDeskDuty();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBeGreaterThan(advancedWeek);
    // Each queued save serialises a whole career synchronously, so this needs the
    // same explicit budget as the journey-checkpoint test above rather than the
    // 5s default. Sized for CI, not one desk: store.test.ts runs ~87s on the
    // author's Mac and ~257s on a GitHub runner, so 120s passed locally and
    // timed out there the moment the suite could finish at all.
  }, 300000);

  it('restores the season backup when the live save stops loading', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await useM1Store.getState().initializePersistence(repository);
    startCreatedCareer(24601);
    await waitFor(
      () => database.backupRow !== null && !useM1Store.getState().saving,
    );

    // The live row survives as unreadable bytes; before the backup existed this
    // was the whole career gone.
    database.seedCareerRow({
      schema_version: 1,
      state_json: '{"schemaVersion":1}',
    });
    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store.getState().initializePersistence(repository);

    expect(useM1Store.getState().persistenceLoadError).toContain(
      'game state schema 1 is unsupported',
    );
    expect(useM1Store.getState().backupSummary).toEqual({ season: 1, week: 1 });

    await useM1Store.getState().restoreBackupSave();

    expect(useM1Store.getState().persistenceLoadError).toBeNull();
    expect(useM1Store.getState().career?.careerSeed).toBe(24601);
    expect(useM1Store.getState().hasSavedCareer).toBe(true);
    // The restored generation is now the live save, so a relaunch loads it.
    await waitFor(() => useM1Store.getState().saving === false);
    await expect(repository.load()).resolves.not.toBeNull();
  });

  it('reports a failed restore without clearing the boot failure', async () => {
    const careerRepository = stubCareerRepository({
      async load() {
        throw new Error('career save is corrupt');
      },
      async restoreBackup() {
        throw new Error('backup row is corrupt too');
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().restoreBackupSave();

    expect(useM1Store.getState().persistenceLoadError).toContain(
      'backup row is corrupt too',
    );
    expect(useM1Store.getState().career).toBeNull();
  });

  it('re-points a saved awakening whose authored trigger no longer ships', async () => {
    const pendingCareer = careerWithPendingAwakening(8675309);
    const retiredTrigger: GameState = {
      ...pendingCareer,
      awakening: {
        ...pendingCareer.awakening,
        pending: {
          ...pendingCareer.awakening.pending!,
          triggerId: 'trigger-cut-from-the-build',
        },
      },
    };
    useM1Store.setState(useM1Store.getInitialState(), true);

    await useM1Store.getState().initializePersistence(
      stubCareerRepository({
        async load() {
          return retiredTrigger;
        },
      }),
    );

    // The cutscene view model throws on an unknown trigger, and the pending
    // awakening is persisted, so it would throw again on every relaunch.
    expect(useM1Store.getState().career?.awakening.pending?.triggerId).toBe(
      loadLaunchContent().onboarding.triggers[0].id,
    );
    expect(() =>
      awakeningCutsceneViewModel(
        useM1Store.getState().career!,
        loadLaunchContent(),
      ),
    ).not.toThrow();
  });

  it('drops a saved awakening whose power content no longer ships', async () => {
    const pendingCareer = careerWithPendingAwakening(112358);
    const pending = pendingCareer.awakening.pending!;
    const retiredPower = withRetiredAwakeningPower(
      pendingCareer,
      pending.playerId,
    );
    useM1Store.setState(useM1Store.getInitialState(), true);

    await useM1Store.getState().initializePersistence(
      stubCareerRepository({
        async load() {
          return retiredPower;
        },
      }),
    );

    expect(useM1Store.getState().career?.awakening.pending).toBeUndefined();
    // The power the player already earned is untouched; only the cutscene goes.
    expect(
      useM1Store
        .getState()
        .career?.players.find((player) => player.id === pending.playerId)
        ?.power,
    ).toBe('MAGNET_TOUCH');
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('complete');
  });

  it('saves a replacement career before clearing its replay namespace', async () => {
    const operations: string[] = [];
    const careerRepository = stubCareerRepository({
      async save(career) {
        operations.push(`save:${career.careerSeed}`);
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer(careerId) {
        operations.push(`reset:${careerId}`);
      },
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(20260718);
    await waitFor(() => operations.length === 2);

    expect(operations).toEqual(['save:20260718', 'reset:m1-career-20260718']);
  });

  it('erases replaced replay namespaces only after saving the new career', async () => {
    useM1Store.getState().startNewCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    const operations: string[] = [];
    const careerRepository = stubCareerRepository({
      async load() {
        return existingCareer;
      },
      async save(career) {
        operations.push(`save:${career.careerSeed}`);
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer(careerId) {
        operations.push(`reset:${careerId}`);
      },
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(222);
    await waitFor(() => operations.length === 5);

    // Loading reconciles the save into a fresh object, so boot re-saves it.
    // Replacement then checkpoints that exact old snapshot before attempting
    // the new write, and only a durable new career may clear either namespace.
    expect(operations).toEqual([
      'save:111',
      'save:111',
      'save:222',
      'reset:m1-career-111',
      'reset:m1-career-222',
    ]);
  });

  it('keeps the existing career and its replays when a replacement save fails', async () => {
    startCreatedCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    const replayDeletes: string[] = [];
    const careerRepository = stubCareerRepository({
      async load() {
        return existingCareer;
      },
      async save(career) {
        if (career.careerSeed === 222)
          throw new Error('replacement save failed');
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer(careerId) {
        replayDeletes.push(careerId);
      },
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(222);
    // Queued while the replacement is still only in memory: its own save has to
    // be refused too, or it lands on the slot the failure just preserved.
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    await waitFor(
      () =>
        useM1Store.getState().error?.includes('replacement save failed') ??
        false,
    );
    await flushMicrotasks();

    // The write that failed is the one that would have replaced the save, so the
    // slot still holds career 111 — and the recovery screen that offers to
    // delete that slot is the wrong answer. Play goes back to it instead.
    expect(useM1Store.getState().persistenceLoadError).toBeNull();
    expect(useM1Store.getState().career?.careerSeed).toBe(111);
    expect(useM1Store.getState().hasSavedCareer).toBe(true);
    expect(useM1Store.getState().screen).toBe('management');
    expect(replayDeletes).toEqual([]);
  });

  it('checkpoints queued old-career progress before a failed replacement rolls back', async () => {
    startCreatedCareer(111);
    const diskCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    let durableCareer = diskCareer;
    const savedSeeds: number[] = [];
    const careerRepository = stubCareerRepository({
      async load() {
        return durableCareer;
      },
      async save(career) {
        savedSeeds.push(career.careerSeed);
        if (career.careerSeed === 222)
          throw new Error('replacement save failed');
        durableCareer = career;
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);
    await waitFor(() => !useM1Store.getState().saving);
    savedSeeds.length = 0;

    const beforeSwap = useM1Store.getState().career!;
    const { starterId, replacementId } = firstAvailableLineupSwap(beforeSwap);
    useM1Store.getState().swapStartingPlayer(starterId, replacementId);
    const queuedOldCareer = useM1Store.getState().career!;
    // Do not yield: this is the real race. The normal save still owns only the
    // module-level coalesced payload when replacement starts synchronously.
    useM1Store.getState().startNewCareer(222);

    await waitFor(
      () =>
        useM1Store.getState().error?.includes('replacement save failed') ??
        false,
    );
    await flushMicrotasks();

    expect(savedSeeds).toEqual([111, 222]);
    expect(useM1Store.getState().career).toBe(queuedOldCareer);
    expect(useM1Store.getState().lastPersistedCareer).toBe(queuedOldCareer);
    expect(durableCareer).toBe(queuedOldCareer);
    expect(
      durableCareer.lineups.find(
        (lineup) => lineup.clubId === durableCareer.userClubId,
      )?.playerIds,
    ).toContain(replacementId);

    // A relaunch must load the same checkpoint the rollback screen showed.
    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store.getState().initializePersistence(careerRepository);
    expect(
      useM1Store
        .getState()
        .career?.lineups.find(
          (lineup) => lineup.clubId === durableCareer.userClubId,
        )?.playerIds,
    ).toContain(replacementId);
  });

  it('never lets a withdrawn save task write a payload queued after a replacement', async () => {
    startCreatedCareer(111);
    const diskCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    let durableCareer = diskCareer;
    const savedStates: GameState[] = [];
    const careerRepository = stubCareerRepository({
      async load() {
        return durableCareer;
      },
      async save(career) {
        savedStates.push(career);
        durableCareer = career;
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);
    await waitFor(() => !useM1Store.getState().saving);
    savedStates.length = 0;

    // Queue save A for the old career. Do not yield: it must still be waiting
    // on the coalesced payload when the replacement withdraws it.
    const { starterId, replacementId } = firstAvailableLineupSwap(
      useM1Store.getState().career!,
    );
    useM1Store.getState().swapStartingPlayer(starterId, replacementId);
    useM1Store.getState().startNewCareer(222);
    // Save B, queued for the replacement AFTER the withdrawal. Only its own
    // task may write it: if the withdrawn task steals it, the replacement
    // transaction sitting between them overwrites B on disk while memory's
    // lastPersistedCareer says B is safe.
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const finalCareer = useM1Store.getState().career!;

    await waitFor(() => !useM1Store.getState().saving);
    await flushMicrotasks();

    expect(useM1Store.getState().error).toBeNull();
    expect(savedStates[savedStates.length - 1]).toBe(finalCareer);
    expect(durableCareer).toBe(finalCareer);
    expect(useM1Store.getState().lastPersistedCareer).toBe(finalCareer);
  });

  it('refuses an abandoned save even when the replacement reuses its seed', async () => {
    startCreatedCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    let armed = false;
    let saveCalls = 0;
    const savedStates: GameState[] = [];
    const careerRepository = stubCareerRepository({
      async load() {
        return existingCareer;
      },
      async save(career) {
        if (!armed) return;
        saveCalls += 1;
        // The first write checkpoints the replaced career; the second is the
        // replacement itself, whose failure rolls play back onto the slot.
        if (saveCalls === 2) throw new Error('replacement save failed');
        savedStates.push(career);
      },
    });
    await useM1Store.getState().initializePersistence(careerRepository);
    await waitFor(() => !useM1Store.getState().saving);
    armed = true;
    const replacedCareer = useM1Store.getState().career!;

    // Deliberately the same seed as the career being replaced: identity must
    // not lean on seed uniqueness.
    useM1Store.getState().startNewCareer(111);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });

    await waitFor(
      () =>
        useM1Store.getState().error?.includes('replacement save failed') ??
        false,
    );
    await flushMicrotasks();

    // The creation save queued for the abandoned replacement shares the
    // preserved career's seed, and must still be refused.
    expect(useM1Store.getState().career).toBe(replacedCareer);
    expect(savedStates[savedStates.length - 1]).toBe(replacedCareer);
    expect(useM1Store.getState().lastPersistedCareer).toBe(replacedCareer);
  });

  it('does not claim a reconciled backup restore is on disk before its save lands', async () => {
    const pendingCareer = careerWithPendingAwakening(8912);
    // A backup whose authored trigger no longer ships: reconciliation changes
    // the restored state, so the raw backup bytes the repository copied into
    // the live slot differ from what memory holds.
    const staleBackup: GameState = {
      ...pendingCareer,
      awakening: {
        ...pendingCareer.awakening,
        pending: {
          ...pendingCareer.awakening.pending!,
          triggerId: 'trigger-cut-from-the-build',
        },
      },
    };
    useM1Store.setState(useM1Store.getInitialState(), true);

    const repository = stubCareerRepository({
      async load() {
        throw new Error('career save is corrupt');
      },
      async restoreBackup() {
        return staleBackup;
      },
      async save() {
        throw new Error('disk is full');
      },
    });
    await useM1Store.getState().initializePersistence(repository);
    await useM1Store.getState().restoreBackupSave();

    expect(useM1Store.getState().career?.awakening.pending?.triggerId).toBe(
      loadLaunchContent().onboarding.triggers[0].id,
    );
    await waitFor(() => useM1Store.getState().saveWarning !== null);
    // The reconciliation save failed, so disk still holds the pre-reconcile
    // backup; memory must not claim the reconciled shape is persisted.
    expect(useM1Store.getState().lastPersistedCareer).toBeNull();
  });

  it('keeps the saved new career when replay cleanup fails', async () => {
    startCreatedCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);
    const careerRepository = stubCareerRepository({
      async load() {
        return existingCareer;
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer() {
        throw new Error('cleanup failed');
      },
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(222);
    await waitFor(
      () =>
        useM1Store.getState().notice?.message.includes('cleanup failed') ??
        false,
    );

    expect(useM1Store.getState().career?.careerSeed).toBe(222);
    expect(useM1Store.getState().hasSavedCareer).toBe(true);
    expect(useM1Store.getState().error).toBeNull();
  });

  it('warns rather than rolling back when there was no career to replace', async () => {
    const careerRepository = stubCareerRepository({
      async save() {
        throw new Error('new career write failed');
      },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer() {},
    };
    await useM1Store
      .getState()
      .initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(4242);
    await waitFor(() => useM1Store.getState().saveWarning !== null);

    // An empty slot has nothing to protect, so this is the ordinary unsaved
    // career: keep playing, with the banner and its retry.
    expect(useM1Store.getState().persistenceLoadError).toBeNull();
    expect(useM1Store.getState().career?.careerSeed).toBe(4242);
    expect(useM1Store.getState().saveWarning).toContain('not being saved');
  });

  it('persists a complete Quick Result replay envelope for the user fixture', async () => {
    const saved: Array<{
      careerId: string;
      fixtureId: string;
      sortOrder: number;
      envelope: ReplayEnvelope;
    }> = [];
    const replayRepository: ReplayRepository = {
      async save(careerId, fixtureId, sortOrder, envelope) {
        saved.push({ careerId, fixtureId, sortOrder, envelope });
      },
      async load() {
        return null;
      },
      async listForCareer() {
        return [];
      },
      async delete() {},
      async deleteAllForCareer() {},
    };
    useM1Store.setState({ replayRepository });

    startCreatedCareer(2468);
    advanceToWeek(3);
    // The week-3 advance opens the fixture rather than moving the clock on.
    useM1Store.getState().advanceCareer();
    const before = useM1Store.getState().career!;
    const fixtureId = before.onboarding?.firstFixtureId;
    const fixture = before.fixtures.find(
      (candidate) => candidate.id === fixtureId,
    )!;
    const controlledTeam: 0 | 1 =
      fixture.homeClubId === before.userClubId ? 0 : 1;
    useM1Store.getState().quickResult({ initialFormation: '3-5-2' });
    await waitFor(() => saved.length === 1);

    expect(saved[0]).toMatchObject({
      careerId: 'm1-career-2468',
      sortOrder: 3,
      envelope: {
        schemaVersion: 1,
        engineVersion: expect.any(String),
        inputs: expect.arrayContaining([
          expect.objectContaining({ kind: 'SUBSTITUTE' }),
        ]),
      },
    });
    expect(saved[0].envelope.opts).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam,
      ...(controlledTeam === 0
        ? { homeFormation: '3-5-2' }
        : { awayFormation: '3-5-2' }),
    });
    expect(saved[0].fixtureId).toBe(
      useM1Store.getState().career?.onboarding?.firstFixtureId,
    );
    expect(saved[0].envelope.home.players).toHaveLength(11);
    expect(saved[0].envelope.away.players).toHaveLength(11);
    const userTeam =
      controlledTeam === 0 ? saved[0].envelope.home : saved[0].envelope.away;
    const rivalTeam =
      controlledTeam === 0 ? saved[0].envelope.away : saved[0].envelope.home;
    expect(userTeam.players.every((player) => player.power === undefined)).toBe(
      true,
    );
    expect(
      rivalTeam.players.find((player) => player.id === 'special-f171'),
    ).toMatchObject({ name: 'Larry Alan', power: 'SUPER_SPEED' });
    const replayed = runReplay(saved[0].envelope);
    const larryHomeIndex = saved[0].envelope.home.players.findIndex(
      (player) => player.id === 'special-f171',
    );
    const larryIndex =
      larryHomeIndex >= 0
        ? larryHomeIndex
        : 11 +
          saved[0].envelope.away.players.findIndex(
            (player) => player.id === 'special-f171',
          );
    expect(replayed.events).toContainEqual(
      expect.objectContaining({
        kind: 'POWER_FIRED',
        player: larryIndex,
        power: 'SUPER_SPEED',
      }),
    );
  });

  it('keeps the user controllable in an away fixture and maps the score back to league order', () => {
    startCreatedCareer(1357);
    const career = useM1Store.getState().career!;
    const awayFixture = career.fixtures.find(
      (fixture) =>
        fixture.season === 1 && fixture.awayClubId === career.userClubId,
    );
    if (awayFixture === undefined)
      throw new Error('expected a Season-1 away fixture');
    useM1Store.setState({
      career: { ...career, week: awayFixture.week, phase: 'matchday' },
      screen: 'matchday',
    });

    useM1Store.getState().watchMatch();
    const watched = useM1Store.getState().watchedMatch!;
    expect(watched.userIsFixtureHome).toBe(false);
    expect(watched.controlledTeam).toBe(1);
    expect(watched.home.id).toBe(awayFixture.homeClubId);
    expect(watched.away.id).toBe(career.userClubId);

    const result = createMatch(
      awayFixture.matchSeed,
      watched.home,
      watched.away,
    );
    result.score = [2, 1];
    result.phase = 'fulltime';
    useM1Store.getState().finishWatchedMatch(result);

    const played = useM1Store
      .getState()
      .career?.fixtures.find((fixture) => fixture.id === awayFixture.id);
    expect(played?.score).toEqual({ homeGoals: 2, awayGoals: 1 });
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  // Each queued save serialises a full career synchronously, which eats timer
  // turns, so the budget has to cover several of them back to back.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('timed out waiting for queued save');
}

async function relaunchCheckpoint(
  careerRepository: CareerRepository,
  replayRepository: ReplayRepository,
): Promise<number> {
  await waitFor(() => !useM1Store.getState().saving);
  const expected = structuredClone(useM1Store.getState().career);
  useM1Store.setState(useM1Store.getInitialState(), true);
  await useM1Store
    .getState()
    .initializePersistence(careerRepository, replayRepository);
  // A load-time reconciliation is itself a persisted boundary. In particular,
  // the Cup safety guard must see that write finish before the test immediately
  // presses Quick Result on the second match of a double-header.
  await waitFor(() => !useM1Store.getState().saving);
  // Boot re-runs the story feature pacing, which closes a Season 1 Week 1
  // youth intake that has not reached its unlock week yet. Everything else
  // about the career must come back exactly as it was saved.
  expect(withoutYouthIntake(useM1Store.getState().career)).toEqual(
    withoutYouthIntake(expected),
  );
  useM1Store.getState().continueCareer();
  return 1;
}

function withoutYouthIntake(
  career: GameState | null,
): Omit<GameState, 'youthIntake'> | null {
  if (career === null) return null;
  const { youthIntake: _intake, ...rest } = career;
  return rest;
}

function driveStoreUntil(
  done: (state: ReturnType<typeof useM1Store.getState>) => boolean,
): void {
  for (let step = 0; step < 300; step += 1) {
    const current = useM1Store.getState();
    if (done(current)) return;
    const career = current.career;
    if (career === null)
      throw new Error('career disappeared during the default journey');

    if (current.screen === 'awakening') {
      current.continueAfterAwakening();
      continue;
    }
    if (current.screen === 'event') {
      progressJourneyEvent(current);
      continue;
    }
    if (current.screen === 'midseason-training') {
      current.completeMidseasonTraining();
      continue;
    }
    if (current.screen === 'matchday') {
      current.quickResult();
      continue;
    }
    if (current.screen === 'faceoff') {
      current.completeFaceOff();
      continue;
    }
    if (current.screen === 'postmatch') {
      current.continueAfterMatch();
      continue;
    }
    if (current.screen === 'week-review') {
      current.continueWeekReview();
      continue;
    }
    if (current.screen === 'championship-celebration') {
      current.completeChampionshipCelebration();
      continue;
    }
    if (current.screen === 'awards-ceremony') {
      current.completeAwardsCeremony();
      continue;
    }
    if (current.screen === 'season-end' && career.phase === 'season-end') {
      current.advanceCareer();
      continue;
    }
    if (current.screen === 'management') {
      if (current.postMatchOverlay === 'summary')
        current.dismissPostMatchSummary();
      else if (midseasonTrainingStatus(career) === 'prompt')
        current.declineMidseasonTraining();
      else {
        // An opening-week duty refuses the advance; answering it is what a
        // manager does next. Done in the same step so a journey that reloads
        // between steps cannot lose the refusal and press the button forever.
        current.advanceCareer();
        answerRefusedDeskDuty();
      }
      continue;
    }
    throw new Error(`unexpected journey screen ${current.screen}`);
  }
  throw new Error('default journey exceeded its step budget');
}

function progressJourneyEvent(
  current: ReturnType<typeof useM1Store.getState>,
): void {
  const career = current.career;
  const pending = career?.pendingEvent;
  if (career === null || pending === undefined)
    throw new Error('event screen lost its pending event');
  if (pending.resolvedChoiceId !== undefined) {
    current.continueAfterEvent();
    return;
  }
  const viewModel = storyEventViewModel(career, loadLaunchContent());
  if (
    viewModel.playerSelectionRequired &&
    viewModel.selectedPlayer === undefined
  ) {
    current.selectEventPlayer(viewModel.playerChoices[0]!.id);
    return;
  }
  if (
    viewModel.coachSelectionRequired &&
    viewModel.selectedCoach === undefined
  ) {
    current.selectEventCoach(viewModel.coachChoices[0]!.role);
    return;
  }
  if (
    viewModel.facilitySelectionRequired &&
    viewModel.selectedFacility === undefined
  ) {
    current.selectEventFacility(viewModel.facilityChoices[0]!.buildingId);
    return;
  }
  const choice =
    viewModel.choices.find(
      (candidate) => !candidate.disabled && candidate.tone === 'safe',
    ) ?? viewModel.choices.find((candidate) => !candidate.disabled);
  if (choice === undefined)
    throw new Error(`journey event ${pending.eventId} has no available choice`);
  current.chooseEvent(choice.id);
}

describe('financial report reveals', () => {
  /** Walks management/review screens until the next matchday pauses the store. */
  function advanceToNextMatchday(): void {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = useM1Store.getState();
      if (state.screen === 'matchday') return;
      if (state.screen === 'week-review') {
        state.continueWeekReview();
        continue;
      }
      if (state.screen === 'faceoff') {
        state.completeFaceOff();
        continue;
      }
      if (state.screen === 'postmatch') {
        state.continueAfterMatch();
        continue;
      }
      if (state.screen === 'event') {
        progressJourneyEvent(state);
        continue;
      }
      if (state.screen !== 'management') {
        throw new Error(
          `advanceToNextMatchday stopped on the ${state.screen} screen`,
        );
      }
      if (state.postMatchOverlay === 'summary') {
        state.dismissPostMatchSummary();
        continue;
      }
      state.advanceCareer();
      answerRefusedDeskDuty();
    }
    throw new Error('advanceToNextMatchday never reached a matchday');
  }

  /** The next HOME league matchday past onboarding — home weeks carry the gate reveal. */
  function parkOnNextHomeMatchday(seed: number): void {
    useM1Store.setState(useM1Store.getInitialState(), true);
    startAwakenedCareer(seed);
    useM1Store.getState().continueAfterMatch();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      advanceToNextMatchday();
      const career = useM1Store.getState().career!;
      const isHome = career.fixtures.some(
        (fixture) =>
          fixture.season === career.season &&
          fixture.week === career.week &&
          fixture.homeClubId === career.userClubId &&
          fixture.status === 'scheduled',
      );
      if (isHome) return;
      useM1Store.getState().quickResult();
      if (useM1Store.getState().screen === 'awakening') {
        useM1Store.getState().continueAfterAwakening();
      }
      useM1Store.getState().continueAfterMatch();
    }
    throw new Error('no home matchday found within six match weeks');
  }

  function settleCurrentMatchAndCapture(): {
    settled: GameState['ledgers'][number];
    postMatch: PostMatchViewModel;
    career: GameState;
  } {
    // Quick Result now opens the face-off ahead of the awakening/ledger chain.
    if (useM1Store.getState().screen === 'faceoff') {
      useM1Store.getState().completeFaceOff();
    }
    if (useM1Store.getState().screen === 'awakening') {
      useM1Store.getState().continueAfterAwakening();
    }
    expect(useM1Store.getState().screen).toBe('postmatch');
    const career = useM1Store.getState().career!;
    const postMatch = useM1Store.getState().postMatch!;
    return {
      settled: career.ledgers[career.ledgers.length - 1],
      postMatch,
      career,
    };
  }

  it('banks identical reveal ledgers through Quick Result and a watched match', () => {
    parkOnNextHomeMatchday(20260806);
    useM1Store.getState().quickResult();
    const quick = settleCurrentMatchAndCapture();

    parkOnNextHomeMatchday(20260806);
    useM1Store.getState().watchMatch();
    const watched = useM1Store.getState().watchedMatch!;
    const match = createMatch(
      watched.fixture.matchSeed,
      watched.home,
      watched.away,
      {
        controlledTeam: watched.controlledTeam,
      },
    );
    let guard = 0;
    while (match.phase !== 'fulltime') {
      if (guard++ > 100_000) throw new Error('watched match never finished');
      tick(match);
    }
    useM1Store.getState().finishWatchedMatch(match);
    const seen = settleCurrentMatchAndCapture();

    // The settled money — including every reveal — is path-independent.
    expect(JSON.stringify(quick.settled.lines)).toBe(
      JSON.stringify(seen.settled.lines),
    );
    expect(quick.postMatch.ledger).toEqual(seen.postMatch.ledger);
  });

  it('passes reveals and the settlement week through the post-match view model only', () => {
    parkOnNextHomeMatchday(20260806);
    useM1Store.getState().quickResult();
    const { settled, postMatch, career } = settleCurrentMatchAndCapture();

    const settledGate = settled.lines.find(
      (line) => line.label === 'League home gate',
    );
    const shownGate = postMatch.ledger.find(
      (line) => line.label === 'League home gate',
    );
    expect(settledGate?.reveal).toBeDefined();
    expect(shownGate?.reveal).toEqual(settledGate?.reveal);
    expect(postMatch.settlementSeason).toBe(settled.season);
    expect(postMatch.settlementWeek).toBe(settled.week);

    // The Finances tab stays undressed: no reveal field on its ledger lines.
    for (const line of clubFinancesViewModel(career).ledger) {
      expect('reveal' in line).toBe(false);
    }
  });
});

function startCreatedCareer(seed: number): void {
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const career = useM1Store.getState().career;
  if (career === null) throw new Error('created career missing');
  useM1Store.setState({ career: withRivalHeroIntrosSeen(career) });
}

function firstAvailableLineupSwap(career: GameState): {
  starterId: string;
  replacementId: string;
} {
  const lineup = career.lineups.find(
    (candidate) => candidate.clubId === career.userClubId,
  )!;
  const roster = career.players.filter(
    (player) => player.clubId === career.userClubId,
  );
  const starter = lineup.playerIds
    .map((playerId) => roster.find((player) => player.id === playerId)!)
    .find((player) =>
      roster.some(
        (candidate) =>
          candidate.role === player.role &&
          !lineup.playerIds.includes(candidate.id) &&
          candidate.injuryWeeks === 0 &&
          candidate.power === undefined,
      ),
    );
  if (starter === undefined)
    throw new Error('test career has no swappable starter');
  const replacement = roster.find(
    (player) =>
      player.role === starter.role &&
      !lineup.playerIds.includes(player.id) &&
      player.injuryWeeks === 0 &&
      player.power === undefined,
  );
  if (replacement === undefined)
    throw new Error('test career has no eligible replacement');
  return { starterId: starter.id, replacementId: replacement.id };
}

function examplePostMatch(): PostMatchViewModel {
  return {
    result: {
      fixtureId: 'fixture-1',
      competition: 'Division Five',
      homeTeam: 'Bramble Rovers',
      awayTeam: 'Ferrous United',
      homeScore: 1,
      awayScore: 0,
      outcomeLabel: 'WIN',
      winner: 'home',
      cupExit: false,
    },
    ledger: [
      {
        id: 'tickets',
        label: 'League home gate',
        amount: 1200,
        kind: 'income',
      },
    ],
    settlementSeason: 1,
    settlementWeek: 3,
    netAmount: 1200,
    trainingPointsGained: 7,
    fanDelta: 10,
    highlights: [],
    updates: [],
  };
}

/**
 * Advances to `week` the way the app does. An advance that produces a week
 * review leaves the store on that screen, and `advanceCareer` only dispatches
 * from management, so the review has to be cleared before the next one.
 *
 * Bounded on purpose, and it reports the screen it stopped on. The unbounded
 * `while (week < 3) advanceCareer()` this replaces spun forever the day
 * advanceCareer gained its double-tap screen guard: jest cannot interrupt a
 * synchronous loop, so the suite stopped finishing at all — locally and on CI —
 * without ever naming a failing test.
 */
function advanceToWeek(week: number): void {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = useM1Store.getState();
    if ((state.career?.week ?? 0) >= week) {
      // Leave the caller on management, not on the review the last advance
      // raised — a player always dismisses it, and the next advanceCareer only
      // dispatches from there.
      if (state.screen === 'week-review') state.continueWeekReview();
      const reached = useM1Store.getState().career;
      if (reached !== null) {
        finishOpeningInboxJobs(outstandingInboxDuties(reached));
      }
      return;
    }
    if (state.screen === 'week-review') {
      state.continueWeekReview();
      continue;
    }
    if (state.screen !== 'management') {
      throw new Error(
        `advanceToWeek(${week}) stopped on the ${state.screen} screen at week ${state.career?.week}`,
      );
    }
    state.advanceCareer();
    answerRefusedDeskDuty();
  }
  throw new Error(
    `advanceToWeek(${week}) stalled at week ${useM1Store.getState().career?.week}`,
  );
}

function completedSeasonForUser(state: GameState): GameState {
  return {
    ...state,
    phase: 'season-end',
    fixtures: state.fixtures.map((fixture) =>
      fixture.season === state.season
        ? {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? { homeGoals: 3, awayGoals: 0 }
                : fixture.awayClubId === state.userClubId
                  ? { homeGoals: 0, awayGoals: 3 }
                  : { homeGoals: 0, awayGoals: 0 },
          }
        : fixture,
    ),
  };
}

/**
 * Answers whatever the opening weeks' desk just refused an Advance Week for,
 * and reports whether there was anything to answer.
 *
 * It performs the same durable action the card requests. This prevents journey
 * tests from hiding a regression by clearing a briefing flag or declining the
 * youth choice instead of signing a player.
 */
function answerRefusedDeskDuty(): boolean {
  const refused = useM1Store.getState().inboxDutyReminder;
  if (refused === null) return false;
  useM1Store.getState().dismissInboxDutyReminder();
  finishOpeningInboxJobs(refused);
  return true;
}

function finishOpeningInboxJobs(
  duties: readonly OpeningInboxDutyId[] = [
    'facility-placement',
    'head-coach-market',
  ],
): void {
  for (const duty of duties) {
    const current = useM1Store.getState();
    const career = current.career;
    if (career === null) throw new Error('opening job helper lost the career');
    if (duty === 'facility-placement') {
      const hasPitch =
        career.facilities.trainingGroundBuilt ||
        (career.facilities.grid?.buildings.some(
          (building) => building.type === 'training-pitch',
        ) ??
          false);
      if (!hasPitch && career.facilities.grid?.construction === undefined) {
        current.buildClubFacility('training-pitch', { x: 0, y: 0 });
      }
    } else if (duty === 'head-coach-market') {
      if (career.market?.headCoach === undefined) {
        const coachId = career.market?.coachCandidates[0]?.id;
        if (coachId === undefined)
          throw new Error('opening job helper has no head coach candidate');
        current.hireCoach(coachId, 'HEAD');
      }
    } else if (duty === 'youth-intake') {
      const youthId = career.youthIntake?.offers[0]?.player.id;
      if (youthId === undefined)
        throw new Error('opening job helper has no youth offer');
      current.signYouth(youthId);
    } else if (duty === 'assistant-coach-hire') {
      if (career.market?.assistantCoach === undefined) {
        const coachId = career.market?.coachCandidates.find(
          (coach) => coach.id !== career.market?.headCoach?.id,
        )?.id;
        if (coachId === undefined)
          throw new Error(
            'opening job helper has no assistant coach candidate',
          );
        current.hireCoach(coachId, 'ASSISTANT');
      }
    } else if (duty === 'national-cup') {
      current.completeAssistantGuide('national-cup');
    } else if (
      duty === 'coaching-office' &&
      !(
        career.facilities.grid?.buildings.some(
          (building) => building.type === 'coaching-office',
        ) ?? false
      ) &&
      career.facilities.grid?.construction === undefined
    ) {
      current.buildClubFacility('coaching-office', { x: 2, y: 0 });
    }
  }
}

function startAwakenedCareer(seed: number): void {
  startCreatedCareer(seed);
  advanceToWeek(3);
  useM1Store.getState().advanceCareer();
  useM1Store.getState().quickResult();
  useM1Store.getState().continueAfterAwakening();
}

function userHeroes() {
  const career = useM1Store.getState().career;
  return (
    career?.players.filter(
      (player) =>
        player.clubId === career.userClubId && player.power !== undefined,
    ) ?? []
  );
}

async function flushMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** A career parked on the post-match awakening cutscene, pending and all. */
function careerWithPendingAwakening(seed: number): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  startCreatedCareer(seed);
  advanceToWeek(3);
  useM1Store.getState().advanceCareer();
  useM1Store.getState().quickResult();
  const career = useM1Store.getState().career;
  if (career?.awakening.pending === undefined) {
    throw new Error('the first match did not leave a pending awakening');
  }
  return career;
}

/**
 * A career whose hero holds a power this build retired from its content, the way
 * MAGNET_TOUCH once was. A power id dropped from the type can only reach the game
 * through stored JSON, so the state is built the same way.
 */
function withRetiredAwakeningPower(
  state: GameState,
  playerId: string,
): GameState {
  const stored = JSON.parse(JSON.stringify(state)) as {
    players: { id: string; power?: string }[];
    awakening: { pending?: { power: string } };
  };
  for (const player of stored.players) {
    if (player.id === playerId) player.power = 'MAGNET_TOUCH';
  }
  if (stored.awakening.pending === undefined) {
    throw new Error('the career has no pending awakening to retire');
  }
  stored.awakening.pending.power = 'MAGNET_TOUCH';
  return stored as unknown as GameState;
}

/** An empty career repository: healthy, with no save and no backup. */
function stubCareerRepository(
  overrides: Partial<CareerRepository> = {},
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
