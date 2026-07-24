import { loadLaunchContent } from '../../content';
import {
  DEFAULT_CREATION_RATINGS,
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  advanceWeek,
  applyCareerTraining,
  completeAssistantGuideSequence,
  createCareer,
  playerAttributeCaps,
  resolveTrainingDrillForPath,
  setCareerTrainingPlan,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { useM1Store } from '../store';
import {
  homeViewModel,
  reconcileHomeAssistantInbox,
  squadTrainingViewModel,
} from '../view-models';

describe('universal training maximum feedback', () => {
  const content = loadLaunchContent();
  const sprints = content.training.focusDrills.find(drill => drill.id === 'sprints')!;

  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('flags a training slot as a blocking interrupt when the player cannot improve that stat', () => {
    useM1Store.getState().startNewCareer(20260721, 'full');
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    const player = career.players.find(candidate => candidate.id === career.onboarding?.createdPlayerId)!;
    const pacCap = playerAttributeCaps(player).pac;
    useM1Store.setState({
      career: {
        ...career,
        players: career.players.map(candidate => candidate.id === player.id
          ? { ...candidate, attrs: { ...candidate.attrs, pac: pacCap } }
          : candidate),
      },
    });

    // Before committing, the stat picker already shows this stat as maxed out.
    const beforeCommit = useM1Store.getState().career!;
    expect(squadTrainingViewModel(beforeCommit, content, player.id, []).selectedPlayerStatOptions)
      .toContainEqual(expect.objectContaining({ pathId: 'sprints', atSafetyCeiling: true }));

    useM1Store.getState().toggleTrainingPlayer(player.id);
    useM1Store.getState().setTrainingSlotStat(player.id, 'sprints');
    expect(useM1Store.getState().error).toBeNull();

    const planned = useM1Store.getState().career!;
    expect(planned.trainingPlan).toMatchObject({
      slots: [{ playerId: player.id, pathId: 'sprints' }],
    });

    const vm = squadTrainingViewModel(planned, content, player.id, useM1Store.getState().trainingSlots);
    // A capped slot costs nothing and shows up as a blocking interrupt instead.
    expect(vm.weeklyTrainingPointCost).toBe(0);
    expect(vm.interrupts.cappedSlots).toContainEqual({
      playerId: player.id,
      playerName: player.name,
      pathId: 'sprints',
      attribute: 'pac',
      cap: pacCap,
    });
  });

  it('sums weekly TP cost per slot, skips capped slots, and matches the store after committing', () => {
    const initial = createCareer(createLaunchCareerSetup(20260724, undefined, content, 'full'));
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const cappedTrainee = roster.find(candidate => playerAttributeCaps(candidate).pac > candidate.attrs.pac)!;
    const openTrainee = roster.find(candidate => (
      candidate.id !== cappedTrainee.id && playerAttributeCaps(candidate).sho > candidate.attrs.sho
    ))!;
    const pacCap = playerAttributeCaps(cappedTrainee).pac;
    const finishing = content.training.focusDrills.find(drill => drill.id === 'finishing')!;
    const state = {
      ...initial,
      trainingPoints: 12,
      players: initial.players.map(candidate => candidate.id === cappedTrainee.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: pacCap } }
        : candidate),
    };
    const trainingSlots = [
      { playerId: cappedTrainee.id, pathId: 'sprints' },
      { playerId: openTrainee.id, pathId: 'finishing' },
    ];

    const editor = squadTrainingViewModel(state, content, undefined, trainingSlots);

    // Only the open trainee's drill is charged; the capped slot is free.
    expect(editor.weeklyTrainingPointCost).toBe(finishing.tpCost);
    expect(editor.slots).toContainEqual({
      playerId: openTrainee.id,
      playerName: openTrainee.name,
      pathId: 'finishing',
      drillName: finishing.name,
      gainLabel: `+${finishing.gains.sho} SHO`,
    });

    useM1Store.setState({ career: state });
    useM1Store.getState().toggleTrainingPlayer(cappedTrainee.id);
    useM1Store.getState().setTrainingSlotStat(cappedTrainee.id, 'sprints');
    useM1Store.getState().toggleTrainingPlayer(openTrainee.id);
    useM1Store.getState().setTrainingSlotStat(openTrainee.id, 'finishing');
    expect(useM1Store.getState().error).toBeNull();

    const planned = useM1Store.getState().career!;
    expect(planned.trainingPlan).toMatchObject({
      slots: [
        { playerId: cappedTrainee.id, pathId: 'sprints' },
        { playerId: openTrainee.id, pathId: 'finishing' },
      ],
    });
    expect(squadTrainingViewModel(planned, content, undefined, useM1Store.getState().trainingSlots)
      .weeklyTrainingPointCost).toBe(finishing.tpCost);
  });

  it('adds a one-shot inbox note at the rare universal safety maximum', () => {
    let before = createCareer(createLaunchCareerSetup(20260722, undefined, content, 'full'));
    before = M2_ASSISTANT_GUIDE_SEQUENCE_IDS.reduce(
      (state, sequenceId) => completeAssistantGuideSequence(state, sequenceId),
      before,
    );
    before = {
      ...before,
      facilities: { ...before.facilities, trainingGroundBuilt: true },
    };
    const player = before.players.find(candidate => (
      candidate.clubId === before.userClubId
      && playerAttributeCaps(candidate).pac > candidate.attrs.pac
    ))!;
    expect(player).toBeDefined();
    const pacCap = playerAttributeCaps(player).pac;
    before = {
      ...before,
      players: before.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: pacCap - 1 } }
        : candidate),
    };
    before = applyCareerTraining(before, [{ playerId: player.id, pathId: sprints.id }]);

    const after = advanceWeek(before);
    const alert = homeViewModel(after).alerts.find(candidate => candidate.id.startsWith('training-cap:'));

    expect(alert).toEqual({
      id: `training-cap:s1-w1:${player.id}:pac:sprints`,
      title: `${player.name} reached ${pacCap} PAC`,
      detail: 'Sprints I took PAC to its maximum. It cannot go higher, so choose another stat or player for next week.',
      tone: 'info',
    });
    expect(parseStoredGameState(serializeGameState(after)).trainingCapNotices)
      .toEqual(after.trainingCapNotices);

    const scheduled = reconcileHomeAssistantInbox(after);
    const followingWeek = { ...scheduled, week: scheduled.week + 1 };
    expect(homeViewModel(followingWeek).alerts.some(candidate => candidate.id === alert?.id)).toBe(false);
  });

  it('retains more than 64 cap notices so the season recap cannot undercount development', () => {
    let before = createCareer(createLaunchCareerSetup(20260723, undefined, content, 'full'));
    before = {
      ...before,
      facilities: { ...before.facilities, trainingGroundBuilt: true },
    };
    const player = before.players.find(candidate => (
      candidate.clubId === before.userClubId
      && playerAttributeCaps(candidate).pac > candidate.attrs.pac
    ))!;
    const pacCap = playerAttributeCaps(player).pac;
    before = {
      ...before,
      players: before.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: pacCap - 1 } }
        : candidate),
      trainingCapNotices: Array.from({ length: 64 }, (_, index) => ({
        id: `historic-cap-${index}`,
        season: 1,
        week: 1,
        playerId: player.id,
        playerName: player.name,
        drillId: 'historic-drill',
        attribute: 'def' as const,
        cap: 50,
      })),
    };
    before = applyCareerTraining(before, [{ playerId: player.id, pathId: sprints.id }]);

    const after = advanceWeek(before);

    expect(after.trainingCapNotices).toHaveLength(65);
    expect(after.trainingCapNotices?.at(-1)?.id).toBe(
      `training-cap:s1-w1:${player.id}:pac:sprints`,
    );
    expect(() => parseStoredGameState(serializeGameState(after))).not.toThrow();
  });

  it('counts the universal maximum once when duplicate slots reach it together', () => {
    // setCareerTrainingPlan forbids two slots for one player; this constructs
    // the plan directly to exercise the reached-cap dedup guard in
    // findReachedTrainingCaps, which still matters if a save is ever migrated
    // with a malformed plan.
    let before = createCareer(createLaunchCareerSetup(20260724, undefined, content, 'full'));
    const player = before.players.find(candidate => (
      candidate.clubId === before.userClubId
      && playerAttributeCaps(candidate).pac > candidate.attrs.pac
    ))!;
    const pacCap = playerAttributeCaps(player).pac;
    before = {
      ...before,
      players: before.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: pacCap - 1 } }
        : candidate),
      trainingPlan: {
        slots: [
          { playerId: player.id, pathId: 'sprints' },
          { playerId: player.id, pathId: 'sprints' },
        ],
      },
    };

    const after = advanceWeek(before);

    expect(after.trainingCapNotices?.filter(notice => (
      notice.playerId === player.id && notice.attribute === 'pac'
    ))).toHaveLength(1);
  });

  it('shows the best-tier gain and current rating for a selected player\'s stat options', () => {
    const state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const expectedGain = resolveTrainingDrillForPath(state, 'sprints').gains.pac;

    const model = squadTrainingViewModel(state, content, trainee.id, []);
    const option = model.selectedPlayerStatOptions?.find(candidate => candidate.pathId === 'sprints');

    expect(option).toMatchObject({
      gain: expectedGain,
      currentValue: trainee.attrs.pac,
      atSafetyCeiling: false,
    });
  });

  it('reports the safety ceiling only at the universal maximum', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const cap = playerAttributeCaps(trainee).pac;
    state = {
      ...state,
      players: state.players.map(player => player.id === trainee.id
        ? { ...player, attrs: { ...player.attrs, pac: cap } }
        : player),
    };

    const model = squadTrainingViewModel(state, content, trainee.id, []);
    const option = model.selectedPlayerStatOptions?.find(candidate => candidate.pathId === 'sprints');

    expect(option?.currentValue).toBe(999);
    expect(option?.atSafetyCeiling).toBe(true);
  });

  it('keeps the safety ceiling independent of whether the club can afford training', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const cap = playerAttributeCaps(trainee).pac;
    // Sanity: this player is nowhere near their cap.
    expect(trainee.attrs.pac).toBeLessThan(cap);

    state = setCareerTrainingPlan(state, [{ playerId: trainee.id, pathId: 'sprints' }]);
    // Zero training points makes the drill unaffordable — that must surface
    // as a TP shortfall, not get conflated with the player being capped.
    state = { ...state, trainingPoints: 0 };

    const model = squadTrainingViewModel(
      state,
      content,
      trainee.id,
      [{ playerId: trainee.id, pathId: 'sprints' }],
    );
    const option = model.selectedPlayerStatOptions?.find(candidate => candidate.pathId === 'sprints');

    expect(option?.atSafetyCeiling).toBe(false);
    expect(model.interrupts.tpShortfall).toBeGreaterThan(0);
  });
});
