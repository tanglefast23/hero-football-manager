const mockPlayers: Array<{
  volume: number;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];

const setAudioModeAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-audio', () => ({
  setAudioModeAsync,
  createAudioPlayer: jest.fn(() => {
    const player = {
      volume: -1,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import {
  setMenuMasterVolume,
  setMenuTheme,
  teardownMenuAudio,
} from '../menu-audio';

describe('opening and management music ownership', () => {
  beforeEach(() => {
    teardownMenuAudio();
    mockPlayers.length = 0;
    setAudioModeAsync.mockClear();
    setMenuMasterVolume(1);
  });

  afterEach(() => {
    teardownMenuAudio();
  });

  it('starts the opening theme and hands off exclusively to management', () => {
    setMenuTheme('opening');

    expect(mockPlayers).toHaveLength(2);
    expect(mockPlayers.every(player => player.loop)).toBe(true);
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();

    setMenuTheme('management');

    expect(mockPlayers[0].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);

    setMenuTheme(null);
    expect(mockPlayers[1].pause).toHaveBeenCalledTimes(1);
  });

  it('shares the selected master level while preserving the music mix', () => {
    setMenuMasterVolume(0.5);
    setMenuTheme('opening');

    expect(mockPlayers.every(player => player.volume === 0.25)).toBe(true);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });

    setMenuMasterVolume(0);
    expect(mockPlayers.every(player => player.volume === 0)).toBe(true);
  });
});
