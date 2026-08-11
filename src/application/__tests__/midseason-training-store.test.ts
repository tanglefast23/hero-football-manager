import { createCareer, midseasonTrainingStatus } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { useM1Store } from '../store';

function weekNineteen() {
  const base = createCareer(createLaunchCareerSetup(20260811));
  return { ...base, week: 19, phase: 'manage' as const, trainingPoints: 42 };
}

describe('Week 19 team training store flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('keeps the manager on Home until the prompt is answered', () => {
    const career = weekNineteen();
    useM1Store.setState({ career, screen: 'management', activeTab: 'home' });

    useM1Store.getState().setActiveTab('squad');
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      activeTab: 'home',
      career,
    });

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career).toBe(career);
  });

  it('spends all TP, opens the celebration, and returns Home once', () => {
    const career = weekNineteen();
    const player = career.players.find(
      (candidate) => candidate.clubId === career.userClubId,
    )!;
    useM1Store.setState({ career, screen: 'management', activeTab: 'home' });

    useM1Store.getState().acceptMidseasonTraining();
    const accepted = useM1Store.getState();
    expect(accepted).toMatchObject({
      screen: 'midseason-training',
      activeTab: 'home',
      career: { trainingPoints: 0 },
    });
    expect(
      accepted.career?.players.find((candidate) => candidate.id === player.id)
        ?.attrs.pac,
    ).toBe(player.attrs.pac + 1);
    expect(midseasonTrainingStatus(accepted.career!)).toBe('celebration');

    accepted.completeMidseasonTraining();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      activeTab: 'home',
    });
    expect(midseasonTrainingStatus(useM1Store.getState().career!)).toBe(
      'complete',
    );

    const completed = useM1Store.getState().career;
    useM1Store.getState().completeMidseasonTraining();
    expect(useM1Store.getState().career).toBe(completed);
  });

  it('resumes an accepted celebration after a relaunch', () => {
    const career = weekNineteen();
    useM1Store.setState({ career, screen: 'management', activeTab: 'home' });
    useM1Store.getState().acceptMidseasonTraining();
    const accepted = useM1Store.getState().career!;

    useM1Store.setState({ career: accepted, screen: 'welcome' });
    useM1Store.getState().continueCareer();

    expect(useM1Store.getState().screen).toBe('midseason-training');
  });

  it('declines without spending TP and still returns Home', () => {
    const career = weekNineteen();
    useM1Store.setState({ career, screen: 'management', activeTab: 'home' });

    useM1Store.getState().declineMidseasonTraining();

    expect(useM1Store.getState()).toMatchObject({
      career: { trainingPoints: 42, players: career.players },
      screen: 'management',
      activeTab: 'home',
    });
    expect(midseasonTrainingStatus(useM1Store.getState().career!)).toBe(
      'complete',
    );
  });
});
