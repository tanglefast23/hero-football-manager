import { useM1Store } from '../store';
import {
  createCareerRepository,
  createReplayRepository,
  type CareerRepository,
  type ReplayRepository,
} from '../../persistence';
import type { ReplayEnvelope } from '../../sim/types';
import { createMatch, queueInput, runReplay, tick } from '../../sim/match';
import { DEFAULT_CREATION_RATINGS } from '../../game';
import { FakePersistenceDatabase } from '../../persistence/__tests__/fake-database';

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
    expect(useM1Store.getState().career?.players).toHaveLength(161);
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('first-match');
    for (let week = 1; week < 5; week += 1) useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(5);

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState()).toMatchObject({ screen: 'matchday' });
    expect(useM1Store.getState().career?.phase).toBe('matchday');

    useM1Store.getState().quickResult();
    expect(useM1Store.getState().screen).toBe('first-awakening');
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('collapse');
    expect(useM1Store.getState().career?.week).toBe(6);
    expect(useM1Store.getState().career?.ledgers).toHaveLength(5);
    useM1Store.getState().chooseFirstAwakening('CHEMICAL');
    expect(useM1Store.getState().career?.onboarding).toMatchObject({
      stage: 'reveal',
      selectedOrigin: 'CHEMICAL',
      awakenedPower: 'SUPER_SPEED',
    });
    expect(userHeroes()).toHaveLength(1);
    expect(userHeroes()[0]).toMatchObject({
      name: 'Jo Rook',
      weeklyWage: 180,
      onHeroWage: false,
      licensed: true,
    });
    useM1Store.getState().continueFirstAwakening();
    expect(useM1Store.getState()).toMatchObject({ screen: 'management' });
    expect(useM1Store.getState().career?.onboarding?.stage).toBe('complete');
  });

  it('offers and resolves the persisted giant-spider chain with a selectable bench player', () => {
    startAwakenedCareer(456);
    const career = useM1Store.getState().career!;
    useM1Store.setState({ career: { ...career, week: 7, phase: 'manage' }, screen: 'management' });

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId).toBe('giant-spider-arrives');
    useM1Store.getState().chooseEvent('adopt-spider');
    expect(useM1Store.getState().career?.eventFlags).toContain('spider-adopted');
    useM1Store.getState().continueAfterEvent();
    expect(useM1Store.getState().career?.resolvedEventIds).toContain('giant-spider-arrives');

    const afterFirst = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...afterFirst,
        week: 9,
        phase: 'manage',
        eventClock: { ...afterFirst.eventClock, riskyChoices: 20 },
      },
      screen: 'management',
    });
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId).toBe('spider-training-day');
    useM1Store.getState().selectEventPlayer();
    const selectedId = useM1Store.getState().career?.pendingEvent?.selectedPlayerId;
    const selected = useM1Store.getState().career?.players.find(player => player.id === selectedId);
    const lineup = useM1Store.getState().career?.lineups.find(candidate =>
      candidate.clubId === useM1Store.getState().career?.userClubId,
    );
    expect(selected).toMatchObject({ role: 'FWD', power: undefined });
    expect(selectedId).not.toBe(useM1Store.getState().career?.onboarding?.createdPlayerId);
    expect(lineup?.playerIds).not.toContain(selectedId);
    useM1Store.getState().chooseEvent('approach-spider');
    expect(useM1Store.getState().career?.pendingEvent?.resolvedChoiceId).toBe('approach-spider');
    expect(useM1Store.getState().career?.pendingEvent?.outcomeText).toBeTruthy();
    expect(userHeroes()).toHaveLength(2);
    expect(userHeroes().filter(player => player.licensed)).toHaveLength(2);
    expect(useM1Store.getState().career?.lineups.find(candidate =>
      candidate.clubId === useM1Store.getState().career?.userClubId,
    )?.playerIds).toContain(selectedId);

    const afterSecondHero = useM1Store.getState().career!;
    useM1Store.setState({
      career: {
        ...afterSecondHero,
        week: 10,
        phase: 'manage',
        pendingEvent: undefined,
        resolvedEventIds: [...afterSecondHero.resolvedEventIds, 'spider-training-day'],
      },
      screen: 'management',
    });
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId)
      .toBe('license-pressure-awakening');
    useM1Store.getState().selectEventPlayer();
    useM1Store.getState().chooseEvent('trust-their-instincts');

    expect(userHeroes()).toHaveLength(3);
    expect(userHeroes().filter(player => player.licensed)).toHaveLength(2);
    const thirdHero = userHeroes().find(player => !player.licensed)!;
    const heroToBench = userHeroes().find(player => player.licensed && player.id !== selectedId)!;
    useM1Store.getState().toggleHeroLicense(heroToBench.id);
    useM1Store.getState().toggleHeroLicense(thirdHero.id);
    expect(userHeroes().filter(player => player.licensed).map(player => player.id))
      .toContain(thirdHero.id);
    expect(useM1Store.getState().career?.lineups.find(candidate =>
      candidate.clubId === useM1Store.getState().career?.userClubId,
    )?.playerIds).toContain(thirdHero.id);
  });

  it('keeps the hero chase alive through both non-risky spider choices', () => {
    startAwakenedCareer(457);
    const career = useM1Store.getState().career!;
    useM1Store.setState({ career: { ...career, week: 7, phase: 'manage' }, screen: 'management' });

    useM1Store.getState().advanceCareer();
    useM1Store.getState().chooseEvent('call-groundskeeper');
    useM1Store.getState().continueAfterEvent();
    expect(useM1Store.getState().career?.eventFlags).toContain('spider-chase');

    const afterGroundskeeper = useM1Store.getState().career!;
    useM1Store.setState({
      career: { ...afterGroundskeeper, week: 9, phase: 'manage' },
      screen: 'management',
    });
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId).toBe('spider-training-day');
    useM1Store.getState().selectEventPlayer();
    useM1Store.getState().chooseEvent('squash-training');
    useM1Store.getState().continueAfterEvent();
    expect(useM1Store.getState().career?.resolvedEventIds).not.toContain('spider-training-day');

    const afterSafeDrill = useM1Store.getState().career!;
    useM1Store.setState({
      career: { ...afterSafeDrill, week: 10, phase: 'manage' },
      screen: 'management',
    });
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.pendingEvent?.eventId).toBe('spider-training-day');
  });

  it('stores a repeating weekly squad plan and settles it only once per week', () => {
    startCreatedCareer(789);
    const before = useM1Store.getState().career!;
    const playerId = 'bramble-rovers-p13';
    const unassignedPlayerId = 'bramble-rovers-p14';
    const beforePac = before.players.find(player => player.id === playerId)!.attrs.pac;
    const beforeUnassignedSta = before.players.find(player => player.id === unassignedPlayerId)!.attrs.sta;

    useM1Store.getState().buildFacility();
    useM1Store.getState().toggleTrainingPlayer(playerId);
    useM1Store.getState().toggleDrill('sprints');
    useM1Store.getState().applyTraining();

    const planned = useM1Store.getState().career!;
    expect(planned.facilities.trainingGroundBuilt).toBe(true);
    expect(planned.clubs[0].cash).toBe(before.clubs[0].cash - 8000);
    expect(planned.trainingPoints).toBe(before.trainingPoints);
    expect(planned.players.find(player => player.id === playerId)?.attrs.pac).toBe(beforePac);
    expect(planned.trainingPlan).toMatchObject({
      assignedPlayerIds: [playerId],
      drills: [{ id: 'sprints' }],
    });

    useM1Store.getState().applyTraining();
    expect(useM1Store.getState().career?.clubs[0].cash).toBe(planned.clubs[0].cash);
    expect(useM1Store.getState().career?.players.find(player => player.id === playerId)?.attrs.pac)
      .toBe(beforePac);

    useM1Store.getState().advanceCareer();
    const settled = useM1Store.getState().career!;
    expect(settled.players.find(player => player.id === playerId)?.attrs.pac).toBe(beforePac + 3);
    expect(settled.players.find(player => player.id === playerId)?.attrs.sta).toBe(
      before.players.find(player => player.id === playerId)!.attrs.sta + 1,
    );
    expect(settled.players.find(player => player.id === unassignedPlayerId)?.attrs.sta)
      .toBe(beforeUnassignedSta + 1);
    expect(settled.ledgers[0].lines).toContainEqual({
      kind: 'training',
      label: 'Weekly focus training',
      amount: -400,
    });
    expect(settled.eventFlags).toContain('guide:bert:first-training-complete');
  });

  it('persists Bert guide progress and clears his first-week objective after advancing', () => {
    startCreatedCareer(790);
    useM1Store.getState().completeAssistantGuide('management-intro');
    useM1Store.getState().completeAssistantGuide('squad-intro');
    useM1Store.getState().completeAssistantGuide('desk-intro');

    expect(useM1Store.getState().career?.eventFlags).toEqual(expect.arrayContaining([
      'guide:bert:intro-complete',
      'guide:bert:squad-intro-complete',
      'guide:bert:desk-intro-complete',
    ]));

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.eventFlags).toContain('guide:bert:first-week-advanced');
  });

  it('completes the real default two-season store flow through events, licenses, and renewal', () => {
    startCreatedCareer(24680);
    useM1Store.getState().buildFacility();
    useM1Store.getState().toggleTrainingPlayer('bramble-rovers-p13');
    useM1Store.getState().toggleDrill('sprints');
    useM1Store.getState().applyTraining();

    driveStoreUntil(state => state.career?.phase === 'season-end');
    const seasonOne = useM1Store.getState().career!;
    expect(seasonOne.season).toBe(1);
    expect(seasonOne.clubs.find(club => club.id === seasonOne.userClubId)?.cash)
      .toBeGreaterThanOrEqual(0);
    expect(userHeroes()).toHaveLength(3);
    expect(userHeroes().filter(player => player.licensed)).toHaveLength(2);
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
    driveStoreUntil(state => state.career?.phase === 'complete');

    expect(useM1Store.getState().career).toMatchObject({ season: 2, phase: 'complete' });
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
    useM1Store.getState().buildFacility();
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    useM1Store.getState().toggleTrainingPlayer('bramble-rovers-p13');
    useM1Store.getState().toggleDrill('sprints');
    useM1Store.getState().applyTraining();
    checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);

    let watchedMatches = 0;
    for (let step = 0; step < 400; step += 1) {
      const current = useM1Store.getState();
      const career = current.career;
      if (career === null) throw new Error('career disappeared during persisted journey');
      if (career.phase === 'complete') break;

      if (current.screen === 'first-awakening') {
        if (career.onboarding?.stage === 'collapse') current.chooseFirstAwakening('CHEMICAL');
        else current.continueFirstAwakening();
      } else if (current.screen === 'event') {
        const pending = career.pendingEvent;
        if (pending === undefined) throw new Error('event screen lost its pending event');
        if (pending.resolvedChoiceId !== undefined) {
          if (pending.eventId === 'license-pressure-awakening') {
            const selected = pending.selectedPlayerId;
            const selectedHero = userHeroes().find(player => player.id === selected);
            if (selectedHero !== undefined && !selectedHero.licensed) {
              const licensed = userHeroes().find(player => player.licensed);
              if (licensed === undefined) throw new Error('expected a licensed hero to swap');
              current.toggleHeroLicense(licensed.id);
              useM1Store.getState().toggleHeroLicense(selectedHero.id);
            } else {
              current.continueAfterEvent();
            }
          } else {
            current.continueAfterEvent();
          }
        } else if (pending.eventId === 'giant-spider-arrives') {
          current.chooseEvent('adopt-spider');
        } else if (pending.selectedPlayerId === undefined) {
          current.selectEventPlayer();
        } else if (pending.eventId === 'spider-training-day') {
          current.chooseEvent('approach-spider');
        } else if (pending.eventId === 'license-pressure-awakening') {
          current.chooseEvent('trust-their-instincts');
        } else {
          throw new Error(`unexpected journey event ${pending.eventId}`);
        }
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
              homePolicy: watched.controlledTeam === 0 ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
              awayPolicy: watched.controlledTeam === 1 ? 'SAVE_FOR_TAP' : 'FIRE_WHEN_READY',
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
      } else if (current.screen === 'management' || current.screen === 'postmatch') {
        if (current.screen === 'postmatch') current.continueAfterMatch();
        else current.advanceCareer();
      } else {
        throw new Error(`unexpected persisted journey screen ${current.screen}`);
      }

      checkpoints += await relaunchCheckpoint(careerRepository, replayRepository);
    }

    const completed = useM1Store.getState().career!;
    expect(completed).toMatchObject({ season: 2, phase: 'complete' });
    expect(completed.ledgers).toHaveLength(60);
    expect(userHeroes()).toHaveLength(3);
    expect(userHeroes().filter(player => player.licensed)).toHaveLength(2);
    expect(watchedMatches).toBe(1);
    expect(checkpoints).toBeGreaterThan(80);

    const replays = await replayRepository.listForCareer(`m1-career-${completed.careerSeed}`);
    expect(replays.length).toBeGreaterThan(20);
    expect(replays.some(replay => replay.envelope.inputs.some(input => input.kind === 'SET_FORMATION')))
      .toBe(true);
    for (const replay of replays) {
      const fixture = completed.fixtures.find(candidate => candidate.id === replay.fixtureId);
      if (fixture?.score === undefined) throw new Error(`missing played fixture ${replay.fixtureId}`);
      const recovered = runReplay(replay.envelope);
      expect(recovered.score).toEqual([fixture.score.homeGoals, fixture.score.awayGoals]);
    }
  }, 120000);

  it('blocks a new career after a load failure without overwriting the save', async () => {
    let careerSaveCalls = 0;
    let replayResetCalls = 0;
    const careerRepository: CareerRepository = {
      async load() { throw new Error('database read failed'); },
      async save() { careerSaveCalls += 1; },
      async delete() {},
    };
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

  it('clears the replay namespace before saving a replacement career', async () => {
    const operations: string[] = [];
    const careerRepository: CareerRepository = {
      async load() { return null; },
      async save(career) { operations.push(`save:${career.careerSeed}`); },
      async delete() {},
    };
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

  it('does not overwrite the career when replay reset fails', async () => {
    let careerSaveCalls = 0;
    const careerRepository: CareerRepository = {
      async load() { return null; },
      async save() { careerSaveCalls += 1; },
      async delete() {},
    };
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
    await waitFor(() => useM1Store.getState().error?.includes('reset failed') ?? false);
    expect(useM1Store.getState().persistenceLoadError).toContain('reset failed');

    // Even an action queued before the UI can render the fatal persistence
    // error must not write the replacement career over the recoverable save.
    useM1Store.getState().advanceCareer();
    await flushMicrotasks();

    expect(careerSaveCalls).toBe(0);
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
    for (let week = 1; week <= 5; week += 1) useM1Store.getState().advanceCareer();
    useM1Store.getState().quickResult();
    await waitFor(() => saved.length === 1);

    expect(saved[0]).toMatchObject({
      careerId: 'm1-career-2468',
      sortOrder: 5,
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
  for (let attempt = 0; attempt < 20; attempt += 1) {
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
  expect(useM1Store.getState().career).toEqual(expected);
  useM1Store.getState().continueCareer();
  return 1;
}

function driveStoreUntil(done: (state: ReturnType<typeof useM1Store.getState>) => boolean): void {
  for (let step = 0; step < 300; step += 1) {
    const current = useM1Store.getState();
    if (done(current)) return;
    const career = current.career;
    if (career === null) throw new Error('career disappeared during the default journey');

    if (current.screen === 'first-awakening') {
      if (career.onboarding?.stage === 'collapse') current.chooseFirstAwakening('CHEMICAL');
      else current.continueFirstAwakening();
      continue;
    }
    if (current.screen === 'event') {
      const pending = career.pendingEvent;
      if (pending === undefined) throw new Error('event screen lost its pending event');
      if (pending.resolvedChoiceId !== undefined) {
        current.continueAfterEvent();
        continue;
      }
      if (pending.eventId === 'giant-spider-arrives') {
        current.chooseEvent('adopt-spider');
        continue;
      }
      current.selectEventPlayer();
      if (pending.eventId === 'spider-training-day') {
        current.chooseEvent('approach-spider');
        continue;
      }
      if (pending.eventId === 'license-pressure-awakening') {
        current.chooseEvent('trust-their-instincts');
        const unlicensed = userHeroes().find(player => !player.licensed);
        const licensed = userHeroes().find(player => player.licensed);
        if (unlicensed !== undefined && licensed !== undefined) {
          useM1Store.getState().toggleHeroLicense(licensed.id);
          useM1Store.getState().toggleHeroLicense(unlicensed.id);
        }
        continue;
      }
      throw new Error(`unexpected journey event ${pending.eventId}`);
    }
    if (current.screen === 'matchday') {
      current.quickResult();
      continue;
    }
    if (current.screen === 'postmatch') {
      current.continueAfterMatch();
      continue;
    }
    if (current.screen === 'management') {
      current.advanceCareer();
      continue;
    }
    throw new Error(`unexpected journey screen ${current.screen}`);
  }
  throw new Error('default journey exceeded its step budget');
}

function startCreatedCareer(seed: number): void {
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

function startAwakenedCareer(seed: number): void {
  startCreatedCareer(seed);
  while ((useM1Store.getState().career?.week ?? 0) < 5) {
    useM1Store.getState().advanceCareer();
  }
  useM1Store.getState().advanceCareer();
  useM1Store.getState().quickResult();
  useM1Store.getState().chooseFirstAwakening('CHEMICAL');
  useM1Store.getState().continueFirstAwakening();
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
