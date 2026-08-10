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
  setRivalIntroMusicActive,
  setMenuMasterVolume,
  setMenuTheme,
  stopLeagueChampionsSfx,
  teardownMenuAudio,
} from '../menu-audio';

/**
 * `initMenuAudio` builds every music player then every SFX player, in the order
 * the two source maps declare them, so a player's identity here is its index.
 * Named once because adding a single cue used to shift every later assertion in
 * the file — see the management-sfx suite for the same trap.
 */
const MUSIC = {
  opening: 0,
  management: 1,
  event: 2,
  awards: 3,
  rival: 4,
} as const;
const SFX = { advanceWeek: 5, planLocked: 6, leagueChampions: 7 } as const;
const PLAYERS_PER_BUILD = 8;
/** The same player after a session death rebuilt the whole set. */
const rebuilt = (index: number): number => PLAYERS_PER_BUILD + index;
const MUSIC_INDEXES = Object.values(MUSIC);
const NON_RIVAL_MUSIC_INDEXES = MUSIC_INDEXES.filter(
  (index) => index !== MUSIC.rival,
);
const TWO_DB_GAIN = 10 ** (2 / 20);

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

  /**
   * The face-off sits between two screens that both play the opening bed. If
   * it ever returns null the music stops for the scene's two seconds and
   * starts again straight after — a hole in the middle of the flow that is
   * easy to introduce and hard to notice in a test suite. Pinned by name.
   */
  it('keeps the opening theme running under the Quick Result face-off', () => {
    expect(menuThemeForScreen('faceoff', 1)).toBe('opening');
    expect(menuThemeForScreen('faceoff', 1)).toBe(
      menuThemeForScreen('matchday', 1),
    );
    expect(menuThemeForScreen('faceoff', 1)).toBe(
      menuThemeForScreen('postmatch', 1),
    );
  });

  it('uses the opening theme for the full-time report, then restores the office theme', () => {
    const fulltimeTheme = menuThemeForScreen('postmatch', 1);
    const officeTheme = menuThemeForScreen('management', 1);

    expect(fulltimeTheme).toBe('opening');
    expect(officeTheme).toBe('management');

    setMenuTheme(fulltimeTheme);
    setMenuTheme(officeTheme);

    expect(mockPlayers[MUSIC.opening].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.management].play).toHaveBeenCalledTimes(1);
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

  it('carries one arcade bed across the awards ceremony and the season review', () => {
    // The season boundary used to be the one ceremony read in silence — only
    // its success stings played. All three of its screens now share a dedicated
    // bed, and it must be the SAME theme on every one: returning different ones
    // would cut the music off and restart it at each handover.
    expect(menuThemeForScreen('awards-ceremony', 1)).toBe('awards');
    expect(menuThemeForScreen('season-end', 1)).toBe('awards');
    // The podium opens the ceremony, so the bed has to start there or the
    // music arrives a screen late and the medal scene plays in silence.
    expect(menuThemeForScreen('season-podium', 1)).toBe('awards');
    expect(menuThemeForScreen('season-podium', 1)).toBe(
      menuThemeForScreen('awards-ceremony', 1),
    );
    // The new season's desk drops it for the ordinary office bed, and a club
    // legend on the way there gets the event bed — either way the ceremony
    // music ends with the ceremony.
    expect(menuThemeForScreen('management', 1)).toBe('management');
    expect(menuThemeForScreen('legacy', 1)).toBe('event');
    // The title celebrations stay bed-less on purpose: they play the
    // celebration anthem via celebration-audio.ts, and a menu bed here would
    // loop underneath it.
    expect(menuThemeForScreen('championship-celebration', 1)).toBeNull();
    expect(menuThemeForScreen('endgame-celebration', 1)).toBeNull();
  });

  it('hands off exclusively from opening to management to event to awards music', () => {
    setMenuTheme('opening');

    expect(mockPlayers).toHaveLength(PLAYERS_PER_BUILD);
    expect(MUSIC_INDEXES.every((i) => mockPlayers[i].loop)).toBe(true);
    expect(
      mockPlayers.slice(MUSIC_INDEXES.length).every((player) => !player.loop),
    ).toBe(true);
    expect(mockPlayers[MUSIC.opening].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.management].play).not.toHaveBeenCalled();
    expect(mockPlayers[MUSIC.event].play).not.toHaveBeenCalled();
    expect(mockPlayers[MUSIC.awards].play).not.toHaveBeenCalled();

    setMenuTheme('management');

    expect(mockPlayers[MUSIC.opening].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.management].play).toHaveBeenCalledTimes(1);

    setMenuTheme('event');
    expect(mockPlayers[MUSIC.management].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.event].play).toHaveBeenCalledTimes(1);

    // The boundary bed takes over from whatever was playing and stops it — the
    // manager never hears two themes at once at the end of a season.
    setMenuTheme('awards');
    expect(mockPlayers[MUSIC.event].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.awards].play).toHaveBeenCalledTimes(1);

    setMenuTheme(null);
    expect(mockPlayers[MUSIC.awards].pause).toHaveBeenCalledTimes(1);
  });

  it('never restarts the boundary bed between the awards and the review', () => {
    // Both screens ask for the same theme, and `setMenuTheme` is a no-op when
    // it already owns the music — so the loop runs unbroken across the handover
    // instead of seeking back to bar one halfway through the ceremony.
    setMenuTheme(menuThemeForScreen('awards-ceremony', 1));
    setMenuTheme(menuThemeForScreen('season-end', 1));

    expect(mockPlayers[MUSIC.awards].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.awards].pause).not.toHaveBeenCalled();

    setMenuTheme(menuThemeForScreen('management', 1));

    expect(mockPlayers[MUSIC.awards].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.management].play).toHaveBeenCalledTimes(1);
  });

  it('plays the rival bed for the whole cutscene, then restores the latest screen theme', () => {
    setMenuTheme('opening');
    setRivalIntroMusicActive(true);

    expect(mockPlayers[MUSIC.opening].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.rival].play).toHaveBeenCalledTimes(1);

    // A screen change underneath the cutscene records its new bed without
    // interrupting the rival track mid-taunt.
    setMenuTheme('management');
    expect(mockPlayers[MUSIC.rival].pause).not.toHaveBeenCalled();
    expect(mockPlayers[MUSIC.management].play).not.toHaveBeenCalled();

    setRivalIntroMusicActive(false);
    expect(mockPlayers[MUSIC.rival].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[MUSIC.management].play).toHaveBeenCalledTimes(1);
  });

  it('shares the selected master level while preserving the music mix', () => {
    setMenuMasterVolume(0.5);
    setMenuTheme('opening');

    expect(
      NON_RIVAL_MUSIC_INDEXES.every((i) => mockPlayers[i].volume === 0.25),
    ).toBe(true);
    expect(mockPlayers[MUSIC.rival].volume).toBeCloseTo(0.25 * TWO_DB_GAIN, 8);
    expect(mockPlayers[SFX.advanceWeek].volume).toBe(0.5);
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: false,
    });

    setMenuMasterVolume(0);
    expect(mockPlayers.every((player) => player.volume === 0)).toBe(true);
  });

  it('never dips the music around a UI cue', () => {
    // Ducking was added to rescue stepper taps that seemed to vanish under the
    // bed. They were not quiet, they were not playing (see management-sfx-
    // voices.test.ts); the dip was audible pumping bought for nothing.
    const audio = readFileSync(
      join(process.cwd(), 'src/render/menu-audio.ts'),
      'utf8',
    );
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );

    expect(audio).not.toContain('duckMenuMusicForSfx');
    expect(audio).not.toContain('DUCKED_MUSIC_VOLUME');
    expect(sounds).not.toContain('duckMenuMusicForSfx');

    setMenuTheme('management');
    setMenuMasterVolume(1);
    expect(
      NON_RIVAL_MUSIC_INDEXES.every((i) => mockPlayers[i].volume === 0.5),
    ).toBe(true);
    expect(mockPlayers[MUSIC.rival].volume).toBeCloseTo(0.5 * TWO_DB_GAIN, 8);
  });

  it('recovers the active theme if a native player stops at the end', async () => {
    setMenuTheme('management');
    const management = mockPlayers[MUSIC.management];
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
    mockPlayers[MUSIC.management].play.mockImplementation(() => {
      throw new Error('Session lookup failed');
    });

    setMenuTheme('management');

    expect(mockPlayers).toHaveLength(PLAYERS_PER_BUILD * 2);
    expect(mockPlayers[rebuilt(MUSIC.management)].play).toHaveBeenCalledTimes(
      1,
    );
    expect(MUSIC_INDEXES.every((i) => mockPlayers[rebuilt(i)].loop)).toBe(true);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('recovers a dead SFX player, then replays both the theme and the cue', async () => {
    setMenuTheme('management');
    mockPlayers[MUSIC.management].play.mockClear();
    mockPlayers[SFX.advanceWeek].seekTo.mockImplementation(() =>
      Promise.reject(new Error('Unable to find the native shared object')),
    );

    playAdvanceWeekSfx();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(PLAYERS_PER_BUILD * 2);
    expect(mockPlayers[rebuilt(MUSIC.management)].play).toHaveBeenCalledTimes(
      1,
    );
    expect(mockPlayers[rebuilt(SFX.advanceWeek)].seekTo).toHaveBeenCalledWith(
      0,
    );
    await Promise.resolve();
    expect(mockPlayers[rebuilt(SFX.advanceWeek)].play).toHaveBeenCalledTimes(1);
  });

  it('rewinds and plays the advance-week SFX on demand', async () => {
    setMenuTheme('management');

    playAdvanceWeekSfx();
    await Promise.resolve();

    expect(mockPlayers[SFX.advanceWeek].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[SFX.advanceWeek].play).toHaveBeenCalledTimes(1);
  });

  it('plays the league-title fanfare once and can stop it when the scene is skipped', async () => {
    setMenuTheme(null);

    playLeagueChampionsSfx();
    await Promise.resolve();

    expect(mockPlayers[SFX.leagueChampions].loop).toBe(false);
    expect(mockPlayers[SFX.leagueChampions].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[SFX.leagueChampions].play).toHaveBeenCalledTimes(1);

    stopLeagueChampionsSfx();
    expect(mockPlayers[SFX.leagueChampions].pause).toHaveBeenCalledTimes(1);
  });
});
