const mockPlayers: Array<{
  volume: number;
  loop: boolean;
  seekTo: jest.Mock;
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
      seekTo: jest.fn(() => Promise.resolve()),
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
  playAdvanceWeekSfx,
  playLeagueChampionsSfx,
  setMenuMasterVolume,
  setMenuTheme,
  stopLeagueChampionsSfx,
  teardownMenuAudio,
} from '../menu-audio';

describe('non-match music ownership', () => {
  beforeEach(() => {
    teardownMenuAudio();
    mockPlayers.length = 0;
    setAudioModeAsync.mockClear();
    setMenuMasterVolume(1);
  });

  afterEach(() => {
    teardownMenuAudio();
  });

  it('hands off exclusively from opening to management to event music', () => {
    setMenuTheme('opening');

    expect(mockPlayers).toHaveLength(5);
    expect(mockPlayers.slice(0, 3).every(player => player.loop)).toBe(true);
    expect(mockPlayers.slice(3).every(player => !player.loop)).toBe(true);
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();
    expect(mockPlayers[2].play).not.toHaveBeenCalled();

    setMenuTheme('management');

    expect(mockPlayers[0].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);

    setMenuTheme('event');

    expect(mockPlayers[1].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].play).toHaveBeenCalledTimes(1);

    setMenuTheme(null);
    expect(mockPlayers[2].pause).toHaveBeenCalledTimes(1);
  });

  it('shares the selected master level while preserving the music mix', () => {
    setMenuMasterVolume(0.5);
    setMenuTheme('opening');

    expect(mockPlayers.slice(0, 3).every(player => player.volume === 0.25)).toBe(true);
    expect(mockPlayers[3].volume).toBe(0.5);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });

    setMenuMasterVolume(0);
    expect(mockPlayers.every(player => player.volume === 0)).toBe(true);
  });

  it('rewinds and plays the advance-week SFX on demand', async () => {
    setMenuTheme('management');

    playAdvanceWeekSfx();
    await Promise.resolve();

    expect(mockPlayers[3].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
  });

  it('plays the league-title fanfare once and can stop it when the scene is skipped', async () => {
    setMenuTheme(null);

    playLeagueChampionsSfx();
    await Promise.resolve();

    expect(mockPlayers[4].loop).toBe(false);
    expect(mockPlayers[4].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[4].play).toHaveBeenCalledTimes(1);

    stopLeagueChampionsSfx();
    expect(mockPlayers[4].pause).toHaveBeenCalledTimes(1);
  });
});
