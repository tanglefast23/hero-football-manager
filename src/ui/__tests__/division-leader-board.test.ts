// Jest runs in `node` with no DOM, so importing react-native for real throws.
// The helpers under test are pure; the component around them is never rendered.
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));

jest.mock('../../render/management-sfx', () => ({
  playUiClickSfx: jest.fn(),
}));

import {
  leaderRowLabel,
  resolveSubTab,
  subTabLabel,
  visibleSubTabs,
} from '../components/DivisionLeaderBoard';

describe('leader board presentation', () => {
  it('reads a row as position, player, club and value', () => {
    expect(
      leaderRowLabel(
        {
          position: 2,
          playerId: 'p',
          playerName: 'Gem Arrow',
          clubName: 'Quartz FC',
          value: 9,
          isUserPlayer: true,
        },
        'Goals',
      ),
    ).toBe('2. Gem Arrow, Quartz FC, 9 goals. Your player.');
  });

  it('omits the ownership suffix for rivals', () => {
    expect(
      leaderRowLabel(
        {
          position: 1,
          playerId: 'p',
          playerName: 'Flint Vale',
          clubName: 'Quartz FC',
          value: 12,
          isUserPlayer: false,
        },
        'Saves',
      ),
    ).toBe('1. Flint Vale, Quartz FC, 12 saves.');
  });

  it('reads a two-word metric as one phrase', () => {
    expect(
      leaderRowLabel(
        {
          position: 3,
          playerId: 'p',
          playerName: 'Ash Kerr',
          clubName: 'Quartz FC',
          value: 40,
          isUserPlayer: false,
        },
        'Tackles won',
      ),
    ).toBe('3. Ash Kerr, Quartz FC, 40 tackles won.');
  });
});

describe('league sub-tabs', () => {
  it('hides the tab strip until a second tab unlocks', () => {
    expect(visibleSubTabs(['league'])).toEqual([]);
    expect(visibleSubTabs(['league', 'cup'])).toEqual(['league', 'cup']);
    expect(visibleSubTabs(['league', 'cup', 'leaders'])).toEqual([
      'league',
      'cup',
      'leaders',
    ]);
  });

  it('labels tabs', () => {
    expect(subTabLabel('league')).toBe('LEAGUE');
    expect(subTabLabel('cup')).toBe('CUP');
    expect(subTabLabel('leaders')).toBe('LEADERS');
  });

  it('falls back to the league when the requested tab is not unlocked yet', () => {
    expect(resolveSubTab(['league'], 'leaders')).toBe('league');
    expect(resolveSubTab(['league', 'cup'], 'leaders')).toBe('league');
    expect(resolveSubTab(['league', 'cup', 'leaders'], 'leaders')).toBe(
      'leaders',
    );
    expect(resolveSubTab(['league', 'cup'], 'cup')).toBe('cup');
  });
});
