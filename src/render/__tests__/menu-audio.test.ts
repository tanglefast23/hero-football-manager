const mockPlayers: Array<{
  volume: number;
  loop: boolean;
  seekTo: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
  duration: number;
  currentTime: number;
  isLoaded: boolean;
  playing: boolean;
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
      duration: 120,
      currentTime: 0,
      isLoaded: true,
      playing: true,
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import {
  duckMenuMusicForSfx,
  menuThemeForScreen,
  playAdvanceWeekSfx,
  playPlanLockedSfx,
  playLeagueChampionsSfx,
  setMenuMasterVolume,
  setMenuTheme,
  stopLeagueChampionsSfx,
  teardownMenuAudio,
} from '../menu-audio';

describe('non-match music ownership', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    teardownMenuAudio();
    mockPlayers.length = 0;
    setAudioModeAsync.mockClear();
    setMenuMasterVolume(1);
  });

  afterEach(() => {
    teardownMenuAudio();
    jest.useRealTimers();
  });

  it('uses the normal management music while creating the first player', () => {
    expect(menuThemeForScreen('create-player', 1)).toBe('management');
  });

  it('hands off exclusively from opening to management to event music', () => {
    setMenuTheme('opening');

    expect(mockPlayers).toHaveLength(6);
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

  it('briefly ducks the music so light stepper taps remain audible', () => {
    setMenuTheme('management');

    duckMenuMusicForSfx();
    expect(mockPlayers.slice(0, 3).every(player => player.volume === 0.1)).toBe(true);

    jest.advanceTimersByTime(159);
    expect(mockPlayers[1].volume).toBe(0.1);
    jest.advanceTimersByTime(1);
    expect(mockPlayers.slice(0, 3).every(player => player.volume === 0.5)).toBe(true);
  });

  it('recovers the active theme if a native player stops at the end', async () => {
    setMenuTheme('management');
    const management = mockPlayers[1];
    management.play.mockClear();
    management.playing = false;
    management.currentTime = management.duration;

    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();

    expect(management.loop).toBe(true);
    expect(management.seekTo).toHaveBeenCalledWith(0);
    expect(management.play).toHaveBeenCalledTimes(1);
  });

  it('rewinds and plays the advance-week SFX on demand', async () => {
    setMenuTheme('management');

    playAdvanceWeekSfx();
    await Promise.resolve();

    expect(mockPlayers[3].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
  });

  it('rewinds and plays the plan-locked chime on demand', async () => {
    setMenuTheme('management');

    playPlanLockedSfx();
    await Promise.resolve();

    expect(mockPlayers[4].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[4].play).toHaveBeenCalledTimes(1);
  });

  it('plays the league-title fanfare once and can stop it when the scene is skipped', async () => {
    setMenuTheme(null);

    playLeagueChampionsSfx();
    await Promise.resolve();

    expect(mockPlayers[5].loop).toBe(false);
    expect(mockPlayers[5].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[5].play).toHaveBeenCalledTimes(1);

    stopLeagueChampionsSfx();
    expect(mockPlayers[5].pause).toHaveBeenCalledTimes(1);
  });
});
