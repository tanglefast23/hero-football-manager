import { loadLaunchContent } from '../../content';
import {
  DEFAULT_CREATION_RATINGS,
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
  advanceWeek,
  applyCareerTraining,
  completeAssistantGuideSequence,
  createCareer,
  playerAttributeCaps,
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

describe('training cap feedback', () => {
  const content = loadLaunchContent();
  const sprints = content.training.focusDrills.find(drill => drill.id === 'sprints')!;

  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('locks the plan and adds an inbox warning when a selected drill cannot improve the player', () => {
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

    expect(squadTrainingViewModel(
      useM1Store.getState().career!,
      content,
      player.id,
      [player.id],
      ['sprints'],
    )).toMatchObject({
      totalMoneyCost: 0,
      totalTrainingPointCost: 0,
      canApply: true,
    });

    useM1Store.getState().toggleTrainingPlayer(player.id);
    useM1Store.getState().toggleDrill('sprints');
    useM1Store.getState().applyTraining();

    const planned = useM1Store.getState().career!;
    expect(planned.trainingPlan).toMatchObject({
      assignedPlayerIds: [player.id],
      drills: [{ id: 'sprints' }],
    });
    expect(useM1Store.getState().error).toBeNull();
    expect(homeViewModel(planned).alerts).toContainEqual({
      id: `training-cap:skipped:s1-w1:${player.id}:pac:sprints`,
      title: `${player.name} skipped Sprints I`,
      detail: `${player.name} is already at their PAC maximum of ${pacCap}. Pick another player or drill for next week.`,
      tone: 'info',
    });
  });

  it('prices only eligible drills in the editor, store guard, and locked-plan summary', () => {
    const initial = createCareer(createLaunchCareerSetup(20260724, undefined, content, 'full'));
    const player = initial.players.find(candidate => (
      candidate.clubId === initial.userClubId
      && playerAttributeCaps(candidate).sho > candidate.attrs.sho
    ))!;
    const state = {
      ...initial,
      trainingPoints: 12,
      players: initial.players.map(candidate => candidate.id === player.id
        ? { ...candidate, attrs: { ...candidate.attrs, pac: playerAttributeCaps(candidate).pac } }
        : candidate),
    };
    const selectedDrillIds = ['sprints', 'finishing'];
    const editor = squadTrainingViewModel(
      state,
      content,
      player.id,
      [player.id],
      selectedDrillIds,
    );

    expect(editor).toMatchObject({
      totalMoneyCost: 500,
      totalTrainingPointCost: 12,
      canApply: true,
    });
    expect(editor.drills.find(drill => drill.id === 'sprints')).toMatchObject({
      available: true,
    });

    useM1Store.setState({
      career: state,
      assignedPlayerIds: [player.id],
      selectedDrillIds: ['sprints'],
    });
    useM1Store.getState().toggleDrill('finishing');
    expect(useM1Store.getState()).toMatchObject({
      selectedDrillIds,
      error: null,
    });
    useM1Store.getState().applyTraining();

    const planned = useM1Store.getState().career!;
    expect(squadTrainingViewModel(
      planned,
      content,
      player.id,
      [player.id],
      selectedDrillIds,
    ).lockedPlan).toMatchObject({
      moneyCost: 500,
      trainingPointCost: 12,
    });
  });

  it('adds a one-shot inbox note naming the player, ability, and drill when the cap is reached', () => {
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
    before = applyCareerTraining(before, [player.id], [sprints]);

    const after = advanceWeek(before);
    const alert = homeViewModel(after).alerts.find(candidate => candidate.id.startsWith('training-cap:'));

    expect(alert).toEqual({
      id: `training-cap:s1-w1:${player.id}:pac:sprints`,
      title: `${player.name} reached their PAC maximum`,
      detail: `Sprints I took PAC to its personal maximum of ${pacCap}. Pick another player for this drill next week.`,
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
    before = applyCareerTraining(before, [player.id], [sprints]);

    const after = advanceWeek(before);

    expect(after.trainingCapNotices).toHaveLength(65);
    expect(after.trainingCapNotices?.at(-1)?.id).toBe(
      `training-cap:s1-w1:${player.id}:pac:sprints`,
    );
    expect(() => parseStoredGameState(serializeGameState(after))).not.toThrow();
  });

  it('counts a personal attribute cap once when overlapping drills reach it together', () => {
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
    };
    before = applyCareerTraining(before, [player.id], [
      { id: 'overlap-a', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
      { id: 'overlap-b', moneyCost: 0, tpCost: 0, gains: { pac: 1 } },
    ]);

    const after = advanceWeek(before);

    expect(after.trainingCapNotices?.filter(notice => (
      notice.playerId === player.id && notice.attribute === 'pac'
    ))).toHaveLength(1);
  });

  it('projects a healthy trainee gain from the real resolver, with atCap false', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const drill = content.training.focusDrills.find(candidate => candidate.id === 'sprints')!;
    const trainedAttribute = Object.keys(drill.gains)[0] as 'pac';

    state = setCareerTrainingPlan(state, [trainee.id], [drill]);
    const model = squadTrainingViewModel(state, content, undefined, [trainee.id], [drill.id]);

    expect(model.lockedPlan).toBeDefined();
    const progress = model.lockedPlan?.players[0]?.trainingProgress ?? [];

    // only attributes the plan raises appear
    expect(progress).toHaveLength(Object.keys(drill.gains).length);

    const line = progress.find(entry => entry.label === trainedAttribute.toUpperCase());
    expect(line).toBeDefined();
    expect(line?.value).toBe(25);
    expect(line?.cap).toBe(41);
    // Hardcoded, not re-derived from the resolver, so a formula change trips this test.
    expect(line?.weeklyGain).toBe(5);
    expect(line?.atCap).toBe(false);
  });

  it('reports atCap only when the player is genuinely at their personal cap', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const drill = content.training.focusDrills.find(candidate => candidate.id === 'sprints')!;
    const trainedAttribute = Object.keys(drill.gains)[0] as 'pac';
    const cap = playerAttributeCaps(trainee)[trainedAttribute];

    state = {
      ...state,
      players: state.players.map(player => player.id === trainee.id
        ? { ...player, attrs: { ...player.attrs, [trainedAttribute]: cap } }
        : player),
    };
    state = setCareerTrainingPlan(state, [trainee.id], [drill]);

    const model = squadTrainingViewModel(state, content, undefined, [trainee.id], [drill.id]);
    const progress = model.lockedPlan?.players[0]?.trainingProgress ?? [];
    const line = progress.find(entry => entry.label === trainedAttribute.toUpperCase());

    expect(line?.value).toBe(cap);
    expect(line?.weeklyGain).toBe(0);
    expect(line?.atCap).toBe(true);
  });

  it('does not report atCap when the club simply cannot afford the plan (regression)', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, content, 'full'));
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = roster[0];
    const drill = content.training.focusDrills.find(candidate => candidate.id === 'sprints')!;
    const trainedAttribute = Object.keys(drill.gains)[0] as 'pac';
    const cap = playerAttributeCaps(trainee)[trainedAttribute];

    // Sanity: this player is nowhere near their cap.
    expect(trainee.attrs[trainedAttribute]).toBeLessThan(cap);

    state = setCareerTrainingPlan(state, [trainee.id], [drill]);
    // Zero training points makes the drill unaffordable, so settlement grants
    // no gain this week even though the player is not capped.
    state = { ...state, trainingPoints: 0 };

    const model = squadTrainingViewModel(state, content, undefined, [trainee.id], [drill.id]);
    const progress = model.lockedPlan?.players[0]?.trainingProgress ?? [];
    const line = progress.find(entry => entry.label === trainedAttribute.toUpperCase());

    expect(line?.weeklyGain).toBe(0);
    expect(line?.atCap).toBe(false);
  });
});
