import { readFileSync } from 'fs';
import { join } from 'path';

import type { GameState } from '../../game';
import type { PenaltyShootoutViewModel } from '../../ui';
import { useM1Store } from '../store';

const shootout: PenaltyShootoutViewModel = {
  fixtureId: 'cup-1',
  clubName: 'Rovers',
  opponentName: 'Town',
  winner: 'club',
  kicks: [],
  finalClubScore: 4,
  finalOpponentScore: 3,
  accessibilityLabel: 'Rovers 4, Town 3. Rovers wins the penalty shootout.',
};

function source(): string {
  return readFileSync(
    join(process.cwd(), 'src/application/store.ts'),
    'utf8',
  );
}

describe('completeShootout', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('hands on once without changing or saving the settled career', () => {
    const career = { careerSeed: 7 } as GameState;
    useM1Store.setState({
      career,
      screen: 'shootout',
      shootout,
      pendingPostFaceOffScreen: 'awakening',
    });

    useM1Store.getState().completeShootout();
    useM1Store.getState().completeShootout();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'awakening',
      shootout: null,
      pendingPostFaceOffScreen: null,
    });
    expect(useM1Store.getState().career).toBe(career);
    const complete = source()
      .split('  completeShootout() {')[1]
      .split('\n\n  dismissInboxProduct')[0];
    expect(complete).not.toContain('queueCareerSave');
    expect(complete).not.toContain('career:');
  });

  it('does nothing off-screen and falls back safely when the destination is lost', () => {
    useM1Store.setState({
      screen: 'management',
      shootout,
      pendingPostFaceOffScreen: 'postmatch',
    });
    useM1Store.getState().completeShootout();
    expect(useM1Store.getState().shootout).toBe(shootout);

    useM1Store.setState({
      screen: 'shootout',
      pendingPostFaceOffScreen: null,
    });
    useM1Store.getState().completeShootout();
    expect(useM1Store.getState().screen).toBe('postmatch');
  });
});

describe('settled Hero Cup routing', () => {
  it('uses pre-settlement teams for Quick Result and watched-match snapshots for Play', () => {
    const store = source();
    const quick = store
      .split('  quickResult(')[1]
      .split('\n  watchMatch(')[0];
    const watched = store
      .split('  finishWatchedMatch(result) {')[1]
      .split('\n\n  async continueAfterMatch')[0];

    expect(quick).toContainSource("kind === 'national-cup'");
    expect(quick).toContainSource('penaltyShootoutViewModel(');
    expect(quick).toContainSource('clubTeam, opponentTeam');
    expect(quick.match(/currentMatchday\(/g)).toHaveLength(1);
    expect(watched).toContainSource('watchedMatch.home');
    expect(watched).toContainSource('watchedMatch.away');
    expect(watched).toContainSource('penaltyShootoutViewModel(');
  });

  it('only raises the shootout for a tied Hero Cup score', () => {
    const store = source();
    for (const block of [
      store.split('  quickResult(')[1].split('\n  watchMatch(')[0],
      store
        .split('  finishWatchedMatch(result) {')[1]
        .split('\n\n  async continueAfterMatch')[0],
    ]) {
      expect(block).toContainSource("kind === 'national-cup'");
      expect(block).toContainSource('homeGoals ===');
      expect(block).toContainSource("'shootout'");
    }
  });
});
