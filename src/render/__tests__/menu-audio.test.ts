import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  menuThemeForScreen,
  playAdvanceWeekSfx,
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

  it('uses the opening theme on the match-day team sheet', () => {
    expect(menuThemeForScreen('matchday', 1)).toBe('opening');
  });

  it('lays the event bed under the awakening from the bite onwards', () => {
    // Beat 1 is the hush, and the limp cue owns it alone. From beat 2 the bed
    // plays under the limp's tail and holds through the rise: the beats are
    // tap-paced, so without it a slow reader sits in silence once the two short
    // cues have finished. Removed once by accident (a49f006); pinned here.
    expect(menuThemeForScreen('awakening', 1)).toBeNull();
    expect(menuThemeForScreen('awakening', 2)).toBe('event');
    expect(menuThemeForScreen('awakening', 3)).toBe('event');
  });

  it('lays the event bed under the season awards ceremony and review', () => {
    // The season boundary used to be the one ceremony read in silence — only
    // its success stings played. It shares the event reveal bed rather than
    // shipping a new asset.
    expect(menuThemeForScreen('awards-ceremony', 1)).toBe('event');
    expect(menuThemeForScreen('season-end', 1)).toBe('event');
    // The title celebrations stay bed-less on purpose: they play the
    // celebration anthem via celebration-audio.ts, and a menu bed here would
    // loop underneath it.
    expect(menuThemeForScreen('championship-celebration', 1)).toBeNull();
    expect(menuThemeForScreen('endgame-celebration', 1)).toBeNull();
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

  it('never dips the music around a UI cue', () => {
    // Ducking was added to rescue stepper taps that seemed to vanish under the
    // bed. They were not quiet, they were not playing (see management-sfx-
    // voices.test.ts); the dip was audible pumping bought for nothing.
    const audio = readFileSync(join(process.cwd(), 'src/render/menu-audio.ts'), 'utf8');
    const sounds = readFileSync(join(process.cwd(), 'src/render/management-sfx.ts'), 'utf8');

    expect(audio).not.toContain('duckMenuMusicForSfx');
    expect(audio).not.toContain('DUCKED_MUSIC_VOLUME');
    expect(sounds).not.toContain('duckMenuMusicForSfx');

    setMenuTheme('management');
    setMenuMasterVolume(1);
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

  it('rebuilds every player and resumes the theme when the audio session dies', () => {
    setMenuTheme('opening');
    // iOS kills the session server while backgrounded: the next native call
    // throws "Session lookup failed" and the old player can never play again.
    mockPlayers[1].play.mockImplementation(() => {
      throw new Error('Session lookup failed');
    });

    setMenuTheme('management');

    expect(mockPlayers).toHaveLength(12);
    expect(mockPlayers[7].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers.slice(6, 9).every(player => player.loop)).toBe(true);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('recovers a dead SFX player, then replays both the theme and the cue', async () => {
    setMenuTheme('management');
    mockPlayers[1].play.mockClear();
    mockPlayers[3].seekTo.mockImplementation(() =>
      Promise.reject(new Error('Unable to find the native shared object')));

    playAdvanceWeekSfx();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(12);
    expect(mockPlayers[7].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[9].seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    expect(mockPlayers[9].play).toHaveBeenCalledTimes(1);
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

    expect(mockPlayers[5].loop).toBe(false);
    expect(mockPlayers[5].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[5].play).toHaveBeenCalledTimes(1);

    stopLeagueChampionsSfx();
    expect(mockPlayers[5].pause).toHaveBeenCalledTimes(1);
  });
});
