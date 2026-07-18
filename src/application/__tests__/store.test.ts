import { useM1Store } from '../store';
import type { CareerRepository, ReplayRepository } from '../../persistence';
import type { ReplayEnvelope } from '../../sim/types';
import { createMatch } from '../../sim/match';
import { DEFAULT_CREATION_RATINGS } from '../../game';

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
    expect(useM1Store.getState().career?.players).toHaveLength(131);
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
  });

  it('applies the facility decision and one-player-per-drill training plan', () => {
    startCreatedCareer(789);
    const before = useM1Store.getState().career!;
    const playerId = 'bramble-rovers-p13';
    const beforePac = before.players.find(player => player.id === playerId)!.attrs.pac;

    useM1Store.getState().buildFacility();
    useM1Store.getState().toggleTrainingPlayer(playerId);
    useM1Store.getState().toggleDrill('sprints');
    useM1Store.getState().applyTraining();

    const after = useM1Store.getState().career!;
    expect(after.facilities.trainingGroundBuilt).toBe(true);
    expect(after.clubs[0].cash).toBe(before.clubs[0].cash - 8000 - 400);
    expect(after.trainingPoints).toBe(before.trainingPoints - 10);
    expect(after.players.find(player => player.id === playerId)?.attrs.pac).toBe(beforePac + 3);
  });

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
