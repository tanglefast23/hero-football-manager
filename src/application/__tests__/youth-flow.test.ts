import { useM1Store } from '../store';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import { reconcileStoryYouthIntake } from '../../game/youth-intake';

describe('M2 youth intake store flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  test('reveals the Week 2 choice, signs one prospect, and preserves the scout slot', () => {
    useM1Store.getState().startNewCareer(91_001);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const beforeReveal = useM1Store.getState().career!;
    expect(beforeReveal.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
    useM1Store.setState({
      career: reconcileStoryYouthIntake({ ...beforeReveal, week: 2 }),
      error: null,
    });
    const initial = useM1Store.getState().career!;
    const offer = initial.youthIntake!.offers[0];
    const cashBefore = useM1Store.getState().career!.clubs.find(
      club => club.id === initial.userClubId,
    )!.cash;

    useM1Store.getState().signYouth(offer.player.id);

    const signed = useM1Store.getState().career!;
    expect(signed.players.find(player => player.id === offer.player.id)).toEqual(offer.player);
    expect(signed.clubs.find(club => club.id === signed.userClubId)?.cash)
      .toBe(cashBefore - offer.signingBonus);
    expect(signed.youthIntake?.signedPlayerIds).toContain(offer.player.id);
    expect(signed.youthIntake).toMatchObject({ status: 'CLOSED', offers: [] });
    expect(signed.players.filter(player => player.clubId === signed.userClubId)).toHaveLength(16);
    expect(useM1Store.getState().error).toBeNull();
  });

  test('declines every remaining offer and keeps the decision in career state', () => {
    useM1Store.getState().startNewCareer(91_002);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const beforeReveal = useM1Store.getState().career!;
    useM1Store.setState({
      career: reconcileStoryYouthIntake({ ...beforeReveal, week: 2 }),
    });
    expect(useM1Store.getState().career?.youthIntake?.status).toBe('OPEN');

    useM1Store.getState().declineYouth();

    expect(useM1Store.getState().career?.youthIntake).toMatchObject({
      status: 'CLOSED',
      declined: true,
      offers: [],
    });
    expect(useM1Store.getState().error).toBeNull();
  });
});
