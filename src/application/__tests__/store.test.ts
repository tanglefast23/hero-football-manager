import { SAVE_FAILURE_BLOCK_LIMIT, useM1Store } from '../store';
import {
  createCareerRepository,
  createReplayRepository,
  MissingCareerBackupError,
  type CareerRepository,
  type ReplayRepository,
} from '../../persistence';
import type { ReplayEnvelope } from '../../sim/types';
import { createMatch, queueInput, runReplay, tick } from '../../sim/match';
import { DEFAULT_CREATION_RATINGS, offerCareerEvent, type GameState } from '../../game';
import { FakePersistenceDatabase } from '../../persistence/__tests__/fake-database';
import type { PostMatchViewModel } from '../../ui';
import { loadLaunchContent } from '../../content';
import { awakeningCutsceneViewModel, storyEventViewModel } from '../view-models';

describe('M1 app store integration', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
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
    expect(useM1Store.getState().career?.players).toHaveLength(159);
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('first-match');
    advanceToWeek(3);
    expect(useM1Store.getState().career?.week).toBe(3);

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState()).toMatchObject({ screen: 'matchday' });
    expect(useM1Store.getState().career?.phase).toBe('matchday');

    useM1Store.getState().quickResult();
    expect(useM1Store.getState().screen).toBe('awakening');
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('reveal');
    expect(useM1Store.getState().career?.week).toBe(4);
    expect(useM1Store.getState().career?.ledgers).toHaveLength(3);
    expect(useM1Store.getState().career?.onboarding).toMatchObject({
      stage: 'reveal',
      awakenedPower: expect.any(String),
    });
    expect(loadLaunchContent().powers.powers.map(power => power.id))
      .toContain(useM1Store.getState().career?.onboarding?.awakenedPower);
    expect(useM1Store.getState().career?.awakening.pending).toMatchObject({
      firstHero: true,
      triggerId: 'glowing-caterpillar',
    });
    expect(userHeroes()).toHaveLength(1);
    expect(userHeroes()[0]).toMatchObject({
      name: 'Jo Rook',
      weeklyWage: 180,
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

  it('still awakens the created player after they are substituted in the first match', () => {
    startCreatedCareer(124);
    advanceToWeek(3);
    useM1Store.getState().advanceCareer();
    useM1Store.getState().watchMatch();

    const watched = useM1Store.getState().watchedMatch!;
    const createdPlayerId = useM1Store.getState().career?.onboarding?.createdPlayerId;
    expect(createdPlayerId).toBeDefined();
    const match = createMatch(watched.fixture.matchSeed, watched.home, watched.away, {
      controlledTeam: watched.controlledTeam,
    });
    const playerIndex = match.players.findIndex(player => player.def.id === createdPlayerId);
    const replacement = match.bench[watched.controlledTeam]
      .find(player => player.role === match.players[playerIndex].def.role);
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    expect(replacement).toBeDefined();

    queueInput(match, {
      tick: 1,
      kind: 'SUBSTITUTE',
      player: playerIndex,
      replacementId: replacement!.id,
    });
    tick(match);
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'SUBSTITUTION',
      outPlayerId: createdPlayerId,
      inPlayerId: replacement!.id,
    }));
    expect(match.players.some(player => player.def.id === createdPlayerId)).toBe(false);

    match.phase = 'fulltime';
    useM1Store.getState().finishWatchedMatch(match);

    expect(useM1Store.getState()).toMatchObject({ screen: 'awakening', error: null });
    expect(useM1Store.getState().career?.awakening.pending).toMatchObject({
      playerId: createdPlayerId,
      firstHero: true,
    });
  });

  it('awards the spider mascot success bonuses without awakening anyone', () => {
    startAwakenedCareer(3);
    const career = useM1Store.getState().career!;
    useM1Store.setState({ career: { ...career, week: 7, phase: 'manage' }, screen: 'management' });

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId).toBe('giant-spider-arrives');
    const beforeChoice = useM1Store.getState().career!;
    const userClub = beforeChoice.clubs.find(club => club.id === beforeChoice.userClubId)!;
    const moraleBefore = beforeChoice.players
      .filter(player => player.clubId === beforeChoice.userClubId)
      .map(player => ({ id: player.id, morale: player.morale }));
    expect(storyEventViewModel(beforeChoice, loadLaunchContent()).choices).toEqual([
      expect.objectContaining({
        id: 'adopt-spider',
        consequenceHint: '35% chance: +10 squad morale and +100 fans. Failure gives no reward.',
        tone: 'risky',
      }),
      expect.objectContaining({
        id: 'call-groundskeeper',
        consequenceHint: 'Guaranteed: +10 TP',
        tone: 'safe',
      }),
    ]);

    useM1Store.getState().chooseEvent('adopt-spider');
    const resolved = useM1Store.getState().career!;
    expect(resolved.eventFlags).toContain('spider-adopted');
    expect(resolved.clubs.find(club => club.id === resolved.userClubId)?.fans).toBe(userClub.fans + 100);
    for (const player of moraleBefore) {
      expect(resolved.players.find(candidate => candidate.id === player.id)?.morale)
        .toBe(Math.min(100, player.morale + 10));
    }
    expect(storyEventViewModel(resolved, loadLaunchContent()).successCutscene).toEqual({
      artKey: 'event-giant-spider-success',
      headline: 'A mascot is born',
      rewards: ['+10 squad morale', '+100 fans'],
    });
    expect(userHeroes()).toHaveLength(1);
    useM1Store.getState().continueAfterEvent();
    expect(useM1Store.getState().career?.resolvedEventIds).toContain('giant-spider-arrives');
    expect(useM1Store.getState().career?.eventFlags).toContain('m4:event-guide-seen');
  });

  it('gives no reward when the spider mascot gamble fails', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: offerCareerEvent({ ...career, week: 7, phase: 'manage', pendingEvent: undefined }, 'giant-spider-arrives'),
      screen: 'event',
    });
    const beforeChoice = useM1Store.getState().career!;

    useM1Store.getState().chooseEvent('adopt-spider');
    const resolved = useM1Store.getState().career!;
    expect(useM1Store.getState().error).toBeNull();
    expect(resolved.eventFlags).not.toContain('spider-adopted');
    expect(resolved.clubs).toEqual(beforeChoice.clubs);
    expect(resolved.players).toEqual(beforeChoice.players);
    expect(resolved.trainingPoints).toBe(beforeChoice.trainingPoints);
  });

  it('always awards the safe spider-event training points', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: offerCareerEvent({ ...career, week: 7, phase: 'manage', pendingEvent: undefined }, 'giant-spider-arrives'),
      screen: 'event',
    });
    const beforeChoice = useM1Store.getState().career!;

    useM1Store.getState().chooseEvent('call-groundskeeper');
    const resolved = useM1Store.getState().career!;
    expect(useM1Store.getState().error).toBeNull();
    expect(resolved.trainingPoints).toBe(beforeChoice.trainingPoints + 10);
    expect(resolved.eventFlags).not.toContain('spider-adopted');
  });

  it('offers an authored follow-up event before advancing the week', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...career,
        phase: 'manage',
        week: 8,
        pendingEvent: {
          eventId: 'hundredth-fan',
          resolvedChoiceId: 'hundredth-fan-parade',
          outcomeText: 'The parade inspires a new stadium mural.',
          resolvedOutcomeIndex: 0,
          resolvedRisky: true,
          resolvedSuccess: true,
          resolvedNextEventId: 'community-mural',
        },
      },
      screen: 'event',
    });

    useM1Store.getState().continueAfterEvent();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'event',
      career: {
        week: 8,
        pendingEvent: { eventId: 'community-mural' },
        resolvedEventIds: expect.arrayContaining(['hundredth-fan']),
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
          eventId: 'hundredth-fan',
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
    expect(useM1Store.getState().career?.resolvedEventIds).toContain('hundredth-fan');
  });

  it('trains a player the moment a drill is tapped and reviews the week without it', () => {
    startCreatedCareer(789);
    const before = useM1Store.getState().career!;
    const playerId = 'bramble-rovers-created-player';
    const unassignedPlayerId = 'bramble-rovers-p14';
    const beforePac = before.players.find(player => player.id === playerId)!.attrs.pac;
    const beforeUnassignedSta = before.players.find(player => player.id === unassignedPlayerId)!.attrs.sta;

    useM1Store.getState().buildFacility();
    useM1Store.getState().trainPlayer(playerId, 'sprints');

    const trained = useM1Store.getState().career!;
    const result = useM1Store.getState().lastDrillResult!;
    // Division 5 unlocks tier II, so the tap resolves Sprints 2: 10 TP.
    expect(result).toMatchObject({
      playerId,
      attribute: 'pac',
      before: beforePac,
      tpSpent: 10,
      sequence: 1,
    });
    expect(result.after).toBeGreaterThan(result.before);
    expect(trained.players.find(player => player.id === playerId)?.attrs.pac).toBe(result.after);
    expect(trained.trainingPoints).toBe(before.trainingPoints - 10);
    expect(trained.players.find(player => player.id === unassignedPlayerId)?.attrs.sta)
      .toBe(beforeUnassignedSta);
    expect(trained.eventFlags).toContain('guide:bert:first-training-complete');

    // Chain-tap: the popup stays live and the next result re-sequences.
    useM1Store.getState().trainPlayer(playerId, 'sprints');
    expect(useM1Store.getState().lastDrillResult).toMatchObject({ sequence: 2 });
    expect(useM1Store.getState().career?.trainingPoints).toBe(before.trainingPoints - 20);

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
    expect(useM1Store.getState().career?.facilities.trainingGroundBuilt).toBe(false);
    expect(review.facilityCompletion).toBeUndefined();

    useM1Store.getState().continueWeekReview();
    useM1Store.getState().advanceCareer();
    const secondReview = useM1Store.getState().weekReview!;
    expect(useM1Store.getState().career?.facilities.trainingGroundBuilt).toBe(true);
    expect(secondReview.facilityCompletion).toMatchObject({
      type: 'training-pitch',
      name: 'Training Pitch',
      level: 1,
      kind: 'BUILD',
    });
  });

  it('accepts a TRAINING_PRIORITY renewal as a five-drill debt', () => {
    useM1Store.getState().startNewCareer(20260831);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    const trainee = career.players.find(player => (
      player.clubId === career.userClubId && player.contractPromise === undefined
    ))!;
    const seasonEndCareer: GameState = {
      ...career,
      phase: 'season-end',
      players: career.players.map(player => player.id === trainee.id
        ? { ...player, contractSeasonsRemaining: 0 }
        : player),
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
    expect(useM1Store.getState().career?.players.find(player => player.id === trainee.id))
      .toMatchObject({
        contractPromise: expect.objectContaining({ perk: 'TRAINING_PRIORITY' }),
        priorityDrillsRemaining: 5,
      });
  });

  it('surfaces a tap the bank cannot afford without advancing anything', () => {
    startCreatedCareer(794);
    const career = useM1Store.getState().career!;
    const playerId = career.players.find(player => player.clubId === career.userClubId)!.id;
    useM1Store.setState({ career: { ...career, trainingPoints: 0 } });

    useM1Store.getState().trainPlayer(playerId, 'sprints');

    expect(useM1Store.getState().error).toContain('needs 10 TP');
    expect(useM1Store.getState().lastDrillResult).toBeNull();
    expect(useM1Store.getState().career?.players.find(player => player.id === playerId)?.attrs)
      .toEqual(career.players.find(player => player.id === playerId)?.attrs);
  });

  it('updates the Starting XI through the app store', () => {
    startCreatedCareer(788);
    const before = useM1Store.getState().career!;
    const { starterId, replacementId } = firstAvailableLineupSwap(before);

    useM1Store.getState().swapStartingPlayer(starterId, replacementId);

    const after = useM1Store.getState().career!;
    const nextLineup = after.lineups.find(candidate => candidate.clubId === after.userClubId)!;
    expect(nextLineup.playerIds).toContain(replacementId);
    expect(nextLineup.playerIds).not.toContain(starterId);
    expect(useM1Store.getState().error).toBeNull();
  });

  it('advances a week with no training and returns to the new week from the review', () => {
    startCreatedCareer(791);

    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().screen).toBe('week-review');
    useM1Store.getState().continueWeekReview();
    expect(useM1Store.getState()).toMatchObject({ screen: 'management', weekReview: null });
  });

  it('returns Home beneath the statement, then dismisses it', () => {
    const postMatch = examplePostMatch();
    useM1Store.setState({ screen: 'postmatch', postMatch, postMatchOverlay: null });

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

  it('persists Bert guide progress and clears his first-week objective after advancing', () => {
    startCreatedCareer(790);
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().setActiveTab('squad');
    useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildFacility();
    useM1Store.getState().setActiveTab('home');

    expect(useM1Store.getState().career?.eventFlags).toEqual(expect.arrayContaining([
      'guide:bert:intro-complete',
      'guide:bert:first-training-complete',
    ]));

    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.eventFlags).toContain('guide:bert:first-week-advanced');
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

    useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().error).toBe(
      'Return home and check your inbox before advancing the week.',
    );

    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().error).toBe(
      'Build the Training Ground from your inbox before advancing the week.',
    );

    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildFacility();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().error).toBe('Return home before advancing the week.');

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
    useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');
    useM1Store.getState().setActiveTab('club');
    useM1Store.getState().buildClubFacility('training-pitch', { x: 0, y: 0 });
    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().clearNotice();
    const weekBefore = useM1Store.getState().career!.week;

    expect(useM1Store.getState().notice).toBeNull();
    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState().career?.week).toBe(weekBefore);
    expect(useM1Store.getState().notice).toEqual({
      tone: 'info',
      message: 'You still have 1 inbox item left to deal with first.',
    });
    expect(useM1Store.getState().career?.eventFlags)
      .not.toContain('guide:bert:desk-intro-complete');

    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    useM1Store.getState().hireCoach(coachId);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(weekBefore + 1);
  });

  it('completes the real default two-season store flow through events, licenses, and renewal', () => {
    startCreatedCareer(24680);
    useM1Store.getState().buildFacility();
    useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');

    driveStoreUntil(state => state.career?.phase === 'season-end');
    const seasonOne = useM1Store.getState().career!;
    expect(seasonOne.season).toBe(1);
    expect(seasonOne.clubs.find(club => club.id === seasonOne.userClubId)?.cash)
      .toBeGreaterThanOrEqual(0);
    expect(userHeroes().length).toBeGreaterThanOrEqual(1);
    expect(userHeroes().filter(player => player.licensed).length).toBeLessThanOrEqual(2);
    expect(seasonOne.players.filter(player =>
      player.clubId === seasonOne.userClubId && player.contractSeasonsRemaining === 0,
    )).toHaveLength(1);

    const expiredHero = seasonOne.players.find(player =>
      player.clubId === seasonOne.userClubId
      && player.power !== undefined
      && player.contractSeasonsRemaining === 0,
    )!;
    useM1Store.getState().renewPlayer(expiredHero.id, 1);
    useM1Store.getState().advanceCareer();
    driveStoreUntil(state => state.career?.season === 2 && state.career?.phase === 'season-end');

    expect(useM1Store.getState().career).toMatchObject({ season: 2, phase: 'season-end' });
  });

  it('survives a save/kill/relaunch checkpoint after every persisted journey boundary', async () => {
    const database = new FakePersistenceDatabase();
    const careerRepository = await createCareerRepository(database);
    const replayRepository = await createReplayRepository(database);
    await useM1Store.getState().initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(97531);
    let checkpoints = await relaunchCheckpoint(careerRepository, replayRepository);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    const { starterId, replacementId } = firstAvailableLineupSwap(useM1Store.getState().career!);
    useM1Store.getState().swapStartingPlayer(starterId, replacementId);
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    expect(useM1Store.getState().career?.lineups
      .find(lineup => lineup.clubId === useM1Store.getState().career?.userClubId)?.playerIds)
      .toContain(replacementId);
    useM1Store.getState().buildFacility();
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);

    let watchedMatches = 0;
    // The season transition replaces the fixture list, so record every played
    // score as the journey goes to verify Season 1 replays after Season 2.
    const scoreByFixtureId = new Map<string, [number, number]>();
    for (let step = 0; step < 400; step += 1) {
      const current = useM1Store.getState();
      const career = current.career;
      if (career === null) throw new Error('career disappeared during persisted journey');
      const cupFixtures = (career.m2?.nationalCups ?? [])
        .flatMap(cup => cup.rounds.flatMap(round => round.fixtures));
      for (const fixture of [...career.fixtures, ...cupFixtures]) {
        if (fixture.score === undefined) continue;
        scoreByFixtureId.set(fixture.id, [fixture.score.homeGoals, fixture.score.awayGoals]);
      }
      // The career is endless, so the journey stops at Season 2's boundary.
      if (career.season === 2 && career.phase === 'season-end') break;

      if (current.screen === 'awakening') {
        current.continueAfterAwakening();
      } else if (current.screen === 'event') {
        progressJourneyEvent(current);
      } else if (current.screen === 'matchday') {
        if (watchedMatches === 0) {
          current.watchMatch();
          const watched = useM1Store.getState().watchedMatch;
          if (watched === null) throw new Error('watched match context was not created');
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
          queueInput(match, { tick: 1, kind: 'SET_FORMATION', formation: '4-3-3' });
          queueInput(match, { tick: 1, kind: 'SET_MENTALITY', mentality: 'ATTACK' });
          while (match.phase !== 'fulltime') tick(match);
          useM1Store.getState().finishWatchedMatch(match);
          watchedMatches += 1;
        } else {
          current.quickResult();
        }
      } else if (current.screen === 'championship-celebration') {
        current.completeChampionshipCelebration();
      } else if (current.screen === 'season-end') {
        if (career.phase === 'season-end') {
          const expired = career.players.find(player =>
            player.clubId === career.userClubId && player.contractSeasonsRemaining === 0,
          );
          if (expired !== undefined) current.renewPlayer(expired.id, 1);
          else current.advanceCareer();
        } else {
          break;
        }
      } else if (
        current.screen === 'management'
        || current.screen === 'postmatch'
        || current.screen === 'week-review'
      ) {
        if (current.screen === 'postmatch') current.continueAfterMatch();
        else if (current.screen === 'week-review') current.continueWeekReview();
        else if (current.postMatchOverlay === 'summary') current.dismissPostMatchSummary();
        else current.advanceCareer();
      } else {
        throw new Error(`unexpected persisted journey screen ${current.screen}`);
      }

      checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    }

    const completed = useM1Store.getState().career!;
    expect(completed).toMatchObject({ season: 2, phase: 'season-end' });
    expect(completed.ledgers).toHaveLength(60);
    expect(userHeroes().length).toBeGreaterThanOrEqual(1);
    expect(userHeroes().filter(player => player.licensed).length).toBeLessThanOrEqual(2);
    expect(watchedMatches).toBe(1);
    expect(checkpoints).toBeGreaterThan(80);

    const replays = await replayRepository.listForCareer(`m1-career-${completed.careerSeed}`);
    expect(replays.length).toBeGreaterThan(20);
    expect(replays.some(replay => replay.envelope.inputs.some(input => input.kind === 'SET_FORMATION')))
      .toBe(true);
    for (const replay of replays) {
      const score = scoreByFixtureId.get(replay.fixtureId);
      if (score === undefined) throw new Error(`missing played fixture ${replay.fixtureId}`);
      expect(runReplay(replay.envelope).score).toEqual(score);
    }
  }, 120000);

  it('resumes a saved final-match awakening and continues to the season review', async () => {
    const database = new FakePersistenceDatabase();
    const careerRepository = await createCareerRepository(database);
    const replayRepository = await createReplayRepository(database);
    startAwakenedCareer(8642);
    const current = useM1Store.getState().career!;
    const candidate = current.players.find(player =>
      player.clubId === current.userClubId && player.power === undefined,
    )!;
    const fixture = current.fixtures.find(item =>
      item.status === 'played'
      && (item.homeClubId === current.userClubId || item.awayClubId === current.userClubId),
    )!;
    const pendingCareer = {
      ...current,
      phase: 'season-end' as const,
      players: current.players.map(player => player.id === candidate.id
        ? { ...player, power: 'SUPER_STRENGTH' as const }
        : player),
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
    await useM1Store.getState().initializePersistence(careerRepository, replayRepository);
    useM1Store.getState().continueCareer();
    expect(useM1Store.getState().screen).toBe('awakening');

    useM1Store.getState().continueAfterAwakening();
    expect(useM1Store.getState().screen).toBe('season-end');
    expect(useM1Store.getState().career?.awakening.pending).toBeUndefined();
  });

  it('blocks a new career after a load failure without overwriting the save', async () => {
    let careerSaveCalls = 0;
    let replayResetCalls = 0;
    const careerRepository = stubCareerRepository({
      async load() { throw new Error('database read failed'); },
      async save() { careerSaveCalls += 1; },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer() { replayResetCalls += 1; },
    };

    await useM1Store.getState().initializePersistence(
      careerRepository,
      replayRepository,
    );
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
      async load() { throw new Error('career save is corrupt'); },
      async delete() { deleteCalls += 1; },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer() {},
    };
    await useM1Store.getState().initializePersistence(careerRepository, replayRepository);
    expect(useM1Store.getState().persistenceLoadError).toContain('career save is corrupt');

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

  it('never deletes a save that loaded cleanly', async () => {
    let deleteCalls = 0;
    const careerRepository = stubCareerRepository({
      async delete() { deleteCalls += 1; },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().discardUnreadableSave();

    expect(deleteCalls).toBe(0);
  });

  it('keeps the boot failure visible when discarding the save fails', async () => {
    const careerRepository = stubCareerRepository({
      async load() { throw new Error('career save is corrupt'); },
      async delete() { throw new Error('disk is on fire'); },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().discardUnreadableSave();

    expect(useM1Store.getState().persistenceLoadError).toContain('disk is on fire');
  });

  it('warns while progress is unsaved and pauses the season after repeated failures', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await useM1Store.getState().initializePersistence(repository);
    startCreatedCareer(31337);
    // `hasSavedCareer` flips optimistically, so wait for the row itself.
    await waitFor(() => database.careerRow !== null && !useM1Store.getState().saving);

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

    expect(useM1Store.getState().consecutiveSaveFailures).toBe(SAVE_FAILURE_BLOCK_LIMIT);
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
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBeGreaterThan(advancedWeek);
    // Each queued save serialises a whole career synchronously, so this needs the
    // same explicit budget as the journey-checkpoint test above rather than the
    // 5s default.
  }, 120000);

  it('restores the season backup when the live save stops loading', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await useM1Store.getState().initializePersistence(repository);
    startCreatedCareer(24601);
    await waitFor(() => database.backupRow !== null && !useM1Store.getState().saving);

    // The live row survives as unreadable bytes; before the backup existed this
    // was the whole career gone.
    database.seedCareerRow({ schema_version: 1, state_json: '{"schemaVersion":1}' });
    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store.getState().initializePersistence(repository);

    expect(useM1Store.getState().persistenceLoadError).toContain('career save is corrupt');
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
      async load() { throw new Error('career save is corrupt'); },
      async restoreBackup() { throw new Error('backup row is corrupt too'); },
    });
    await useM1Store.getState().initializePersistence(careerRepository);

    await useM1Store.getState().restoreBackupSave();

    expect(useM1Store.getState().persistenceLoadError).toContain('backup row is corrupt too');
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

    await useM1Store.getState().initializePersistence(stubCareerRepository({
      async load() { return retiredTrigger; },
    }));

    // The cutscene view model throws on an unknown trigger, and the pending
    // awakening is persisted, so it would throw again on every relaunch.
    expect(useM1Store.getState().career?.awakening.pending?.triggerId)
      .toBe(loadLaunchContent().onboarding.triggers[0].id);
    expect(() => awakeningCutsceneViewModel(
      useM1Store.getState().career!,
      loadLaunchContent(),
    )).not.toThrow();
  });

  it('drops a saved awakening whose power content no longer ships', async () => {
    const pendingCareer = careerWithPendingAwakening(112358);
    const pending = pendingCareer.awakening.pending!;
    const retiredPower = withRetiredAwakeningPower(pendingCareer, pending.playerId);
    useM1Store.setState(useM1Store.getInitialState(), true);

    await useM1Store.getState().initializePersistence(stubCareerRepository({
      async load() { return retiredPower; },
    }));

    expect(useM1Store.getState().career?.awakening.pending).toBeUndefined();
    // The power the player already earned is untouched; only the cutscene goes.
    expect(useM1Store.getState().career?.players
      .find(player => player.id === pending.playerId)?.power).toBe('MAGNET_TOUCH');
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('complete');
  });

  it('clears the replay namespace before saving a replacement career', async () => {
    const operations: string[] = [];
    const careerRepository = stubCareerRepository({
      async save(career) { operations.push(`save:${career.careerSeed}`); },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer(careerId) {
        operations.push(`reset:${careerId}`);
      },
    };
    await useM1Store.getState().initializePersistence(
      careerRepository,
      replayRepository,
    );

    useM1Store.getState().startNewCareer(20260718);
    await waitFor(() => operations.length === 2);

    expect(operations).toEqual([
      'reset:m1-career-20260718',
      'save:20260718',
    ]);
  });

  it('erases the replaced career replay namespace before saving a new career', async () => {
    useM1Store.getState().startNewCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    const operations: string[] = [];
    const careerRepository = stubCareerRepository({
      async load() { return existingCareer; },
      async save(career) { operations.push(`save:${career.careerSeed}`); },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer(careerId) {
        operations.push(`reset:${careerId}`);
      },
    };
    await useM1Store.getState().initializePersistence(careerRepository, replayRepository);

    useM1Store.getState().startNewCareer(222);
    await waitFor(() => operations.length === 4);

    // Loading reconciles the save into a fresh object, so boot re-saves it
    // before the replacement career clears the old replay namespace.
    expect(operations).toEqual([
      'save:111',
      'reset:m1-career-111',
      'reset:m1-career-222',
      'save:222',
    ]);
  });

  it('keeps the existing career when a replacement career cannot be saved', async () => {
    startCreatedCareer(111);
    const existingCareer = useM1Store.getState().career!;
    useM1Store.setState(useM1Store.getInitialState(), true);

    const savedSeeds: number[] = [];
    const careerRepository = stubCareerRepository({
      async load() { return existingCareer; },
      async save(career) { savedSeeds.push(career.careerSeed); },
    });
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer() { throw new Error('reset failed'); },
    };
    await useM1Store.getState().initializePersistence(
      careerRepository,
      replayRepository,
    );

    useM1Store.getState().startNewCareer(222);
    // Queued while the replacement is still only in memory: its own save has to
    // be refused too, or it lands on the slot the failure just preserved.
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    await waitFor(() => useM1Store.getState().error?.includes('reset failed') ?? false);
    await flushMicrotasks();

    // The write that failed is the one that would have replaced the save, so the
    // slot still holds career 111 — and the recovery screen that offers to
    // delete that slot is the wrong answer. Play goes back to it instead.
    expect(useM1Store.getState().persistenceLoadError).toBeNull();
    expect(useM1Store.getState().career?.careerSeed).toBe(111);
    expect(useM1Store.getState().hasSavedCareer).toBe(true);
    expect(useM1Store.getState().screen).toBe('management');
    expect(savedSeeds).not.toContain(222);
  });

  it('warns rather than rolling back when there was no career to replace', async () => {
    const careerRepository = stubCareerRepository();
    const replayRepository: ReplayRepository = {
      async save() {},
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer() { throw new Error('reset failed'); },
    };
    await useM1Store.getState().initializePersistence(
      careerRepository,
      replayRepository,
    );

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
      async load() { return null; },
      async listForCareer() { return []; },
      async delete() {},
      async deleteAllForCareer() {},
    };
    useM1Store.setState({ replayRepository });

    startCreatedCareer(2468);
    advanceToWeek(3);
    // The week-3 advance opens the fixture rather than moving the clock on.
    useM1Store.getState().advanceCareer();
    useM1Store.getState().quickResult();
    await waitFor(() => saved.length === 1);

    expect(saved[0]).toMatchObject({
      careerId: 'm1-career-2468',
      sortOrder: 3,
      envelope: {
        schemaVersion: 1,
        engineVersion: expect.any(String),
        inputs: [],
        opts: {
          homePolicy: 'FIRE_WHEN_READY',
          awayPolicy: 'FIRE_WHEN_READY',
        },
      },
    });
    expect(saved[0].fixtureId).toBe(useM1Store.getState().career?.onboarding?.firstFixtureId);
    expect(saved[0].envelope.home.players).toHaveLength(11);
    expect(saved[0].envelope.away.players).toHaveLength(11);
    expect(saved[0].envelope.home.players.every(player => player.power === undefined)).toBe(true);
    expect(saved[0].envelope.away.players.every(player => player.power === undefined)).toBe(true);
  });

  it('keeps the user controllable in an away fixture and maps the score back to league order', () => {
    startCreatedCareer(1357);
    const career = useM1Store.getState().career!;
    const awayFixture = career.fixtures.find(fixture =>
      fixture.season === 1 && fixture.awayClubId === career.userClubId,
    );
    if (awayFixture === undefined) throw new Error('expected a Season-1 away fixture');
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

    const result = createMatch(awayFixture.matchSeed, watched.home, watched.away);
    result.score = [2, 1];
    result.phase = 'fulltime';
    useM1Store.getState().finishWatchedMatch(result);

    const played = useM1Store.getState().career?.fixtures.find(fixture => fixture.id === awayFixture.id);
    expect(played?.score).toEqual({ homeGoals: 2, awayGoals: 1 });
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  // Each queued save serialises a full career synchronously, which eats timer
  // turns, so the budget has to cover several of them back to back.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
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
  await useM1Store.getState().initializePersistence(careerRepository, replayRepository);
  // Boot re-runs the story feature pacing, which closes a Season 1 Week 1
  // youth intake that has not reached its unlock week yet. Everything else
  // about the career must come back exactly as it was saved.
  expect(withoutYouthIntake(useM1Store.getState().career))
    .toEqual(withoutYouthIntake(expected));
  useM1Store.getState().continueCareer();
  return 1;
}

function withoutYouthIntake(career: GameState | null): Omit<GameState, 'youthIntake'> | null {
  if (career === null) return null;
  const { youthIntake: _intake, ...rest } = career;
  return rest;
}

function driveStoreUntil(done: (state: ReturnType<typeof useM1Store.getState>) => boolean): void {
  for (let step = 0; step < 300; step += 1) {
    const current = useM1Store.getState();
    if (done(current)) return;
    const career = current.career;
    if (career === null) throw new Error('career disappeared during the default journey');

    if (current.screen === 'awakening') {
      current.continueAfterAwakening();
      continue;
    }
    if (current.screen === 'event') {
      progressJourneyEvent(current);
      continue;
    }
    if (current.screen === 'matchday') {
      current.quickResult();
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
    if (current.screen === 'season-end' && career.phase === 'season-end') {
      current.advanceCareer();
      continue;
    }
    if (current.screen === 'management') {
      if (current.postMatchOverlay === 'summary') current.dismissPostMatchSummary();
      else current.advanceCareer();
      continue;
    }
    throw new Error(`unexpected journey screen ${current.screen}`);
  }
  throw new Error('default journey exceeded its step budget');
}

function progressJourneyEvent(current: ReturnType<typeof useM1Store.getState>): void {
  const career = current.career;
  const pending = career?.pendingEvent;
  if (career === null || pending === undefined) throw new Error('event screen lost its pending event');
  if (pending.resolvedChoiceId !== undefined) {
    current.continueAfterEvent();
    return;
  }
  const viewModel = storyEventViewModel(career, loadLaunchContent());
  if (viewModel.playerSelectionRequired && viewModel.selectedPlayer === undefined) {
    current.selectEventPlayer();
    return;
  }
  const choice = viewModel.choices.find(candidate => !candidate.disabled && candidate.tone === 'safe')
    ?? viewModel.choices.find(candidate => !candidate.disabled);
  if (choice === undefined) throw new Error(`journey event ${pending.eventId} has no available choice`);
  current.chooseEvent(choice.id);
}

function startCreatedCareer(seed: number): void {
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

function firstAvailableLineupSwap(career: GameState): { starterId: string; replacementId: string } {
  const lineup = career.lineups.find(candidate => candidate.clubId === career.userClubId)!;
  const roster = career.players.filter(player => player.clubId === career.userClubId);
  const starter = lineup.playerIds
    .map(playerId => roster.find(player => player.id === playerId)!)
    .find(player => roster.some(candidate => (
      candidate.role === player.role
      && !lineup.playerIds.includes(candidate.id)
      && candidate.injuryWeeks === 0
      && candidate.power === undefined
    )));
  if (starter === undefined) throw new Error('test career has no swappable starter');
  const replacement = roster.find(player => (
    player.role === starter.role
    && !lineup.playerIds.includes(player.id)
    && player.injuryWeeks === 0
    && player.power === undefined
  ));
  if (replacement === undefined) throw new Error('test career has no eligible replacement');
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
      headline: 'The office will be loud tonight.',
    },
    ledger: [{ id: 'tickets', label: 'League home gate', amount: 1200, kind: 'income' }],
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
  }
  throw new Error(
    `advanceToWeek(${week}) stalled at week ${useM1Store.getState().career?.week}`,
  );
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
  return career?.players.filter(player =>
    player.clubId === career.userClubId && player.power !== undefined,
  ) ?? [];
}

async function flushMicrotasks(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
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
function withRetiredAwakeningPower(state: GameState, playerId: string): GameState {
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
    async load() { return null; },
    async save() {},
    async delete() {},
    async backupSummary() { return null; },
    async restoreBackup() { throw new MissingCareerBackupError(); },
    async checkIntegrity() { return true; },
    ...overrides,
  };
}
