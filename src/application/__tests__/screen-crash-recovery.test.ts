import { DEFAULT_CREATION_RATINGS, type GameState } from '../../game';
import { useM1Store } from '../store';

/** A cutscene the career insists on resuming — the boundary's own worst case. */
const PENDING_AWAKENING = {
  fixtureId: 'ghost-fixture',
  playerId: 'ghost-player',
  power: 'SUPER_SPEED',
  triggerId: 'ghost-trigger',
  firstHero: false,
} as const;

/**
 * Two ways the app ring can point at something that is no longer there: the
 * title screen pointing back at a screen that just crashed, and a player
 * selection pointing at a player who has been sold.
 */
function openedCareer(seed = 20260814): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(seed);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  return useM1Store.getState().career!;
}

describe('recovering from a screen that threw', () => {
  it('does not send Continue straight back into the crashing screen', () => {
    const career = openedCareer();
    // A pending cutscene is the boundary's own worst case: the career says
    // resume there, and that screen is the one whose view model throws.
    useM1Store.setState({
      career: {
        ...career,
        awakening: { ...career.awakening, pending: PENDING_AWAKENING },
      },
      screen: 'awakening',
    });

    useM1Store.getState().recoverFromScreenCrash();
    expect(useM1Store.getState().screen).toBe('welcome');
    expect(useM1Store.getState().recoveredFromScreenCrash).toBe(true);

    useM1Store.getState().continueCareer();
    expect(useM1Store.getState().screen).toBe('management');
    // The career is untouched: only this one presentation is skipped.
    expect(useM1Store.getState().career!.awakening.pending).toEqual(
      PENDING_AWAKENING,
    );
  });

  it('resumes normally when no crash sent the player to the title', () => {
    const career = openedCareer();
    useM1Store.setState({
      career: {
        ...career,
        awakening: { ...career.awakening, pending: PENDING_AWAKENING },
      },
      screen: 'welcome',
    });

    useM1Store.getState().continueCareer();
    expect(useM1Store.getState().screen).toBe('awakening');
  });

  it('forgets the crash once the desk has been offered', () => {
    const career = openedCareer();
    useM1Store.setState({
      career: {
        ...career,
        awakening: { ...career.awakening, pending: PENDING_AWAKENING },
      },
    });
    useM1Store.getState().recoverFromScreenCrash();
    useM1Store.getState().continueCareer();

    useM1Store.setState({ screen: 'welcome' });
    useM1Store.getState().continueCareer();
    expect(useM1Store.getState().screen).toBe('awakening');
  });
});

describe('a selection that names a departed player', () => {
  it('is cleared by the sale that removed them', () => {
    const career = openedCareer();
    const lineup = career.lineups.find(
      (entry) => entry.clubId === career.userClubId,
    )!;
    const benched = career.players.find(
      (player) =>
        player.clubId === career.userClubId &&
        !lineup.playerIds.includes(player.id),
    )!;

    useM1Store.getState().selectPlayer(benched.id);
    useM1Store.getState().actOnTransfer(benched.id, 'SELL');
    const listing = useM1Store
      .getState()
      .career!.market!.transferListings!.find(
        (entry) => entry.playerId === benched.id,
      )!;
    useM1Store
      .getState()
      .actOnTransfer(benched.id, 'SELL', listing.bids[0]!.id);

    expect(useM1Store.getState().error).toBeNull();
    const after = useM1Store.getState().career!;
    // The sale moves them to the buying club rather than deleting them, which
    // is exactly why a membership test and not a roster test is what matters.
    expect(
      after.players.some(
        (player) =>
          player.id === benched.id && player.clubId === after.userClubId,
      ),
    ).toBe(false);
    expect(useM1Store.getState().selectedPlayerId).toBeUndefined();
  });

  it('is left alone while the player is still on the roster', () => {
    const career = openedCareer();
    const kept = career.players.find(
      (player) => player.clubId === career.userClubId,
    )!;
    useM1Store.getState().selectPlayer(kept.id);
    useM1Store.getState().retrySave();

    expect(useM1Store.getState().selectedPlayerId).toBe(kept.id);
  });
});
