import { useM1Store } from '../store';

describe('M2 youth intake store flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  test('blocks a full roster, then signs an offer after space is made', () => {
    useM1Store.getState().startNewCareer(91_001, 'full');
    const initial = useM1Store.getState().career!;
    const offer = initial.youthIntake!.offers[0];
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);

    useM1Store.getState().signYouth(offer.player.id);
    expect(useM1Store.getState().error).toBe('the 16-player roster is full');

    const released = roster.at(-1)!;
    useM1Store.setState({
      career: {
        ...initial,
        players: initial.players.filter(player => player.id !== released.id),
        clubs: initial.clubs.map(club => club.id === initial.userClubId
          ? { ...club, weeklyWages: club.weeklyWages - released.weeklyWage }
          : club),
      },
      error: null,
    });
    const cashBefore = useM1Store.getState().career!.clubs.find(
      club => club.id === initial.userClubId,
    )!.cash;

    useM1Store.getState().signYouth(offer.player.id);

    const signed = useM1Store.getState().career!;
    expect(signed.players.find(player => player.id === offer.player.id)).toEqual(offer.player);
    expect(signed.clubs.find(club => club.id === signed.userClubId)?.cash)
      .toBe(cashBefore - offer.signingBonus);
    expect(signed.youthIntake?.signedPlayerIds).toContain(offer.player.id);
    expect(useM1Store.getState().error).toBeNull();
  });

  test('declines every remaining offer and keeps the decision in career state', () => {
    useM1Store.getState().startNewCareer(91_002, 'full');
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
