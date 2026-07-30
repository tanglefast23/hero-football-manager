const mockPlayers: Array<{
  volume: number;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
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
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import { initAudio, playForEvent, setMasterVolume, startTheme, teardownAudio } from '../audio';
import type { MatchEvent } from '../../sim/types';

describe('match audio session recovery', () => {
  beforeEach(() => {
    teardownAudio();
    mockPlayers.length = 0;
    setAudioModeAsync.mockClear();
    setMasterVolume(1);
  });

  afterEach(() => {
    teardownAudio();
  });

  it('rebuilds every player and resumes the theme when the audio session dies', () => {
    initAudio();
    startTheme();
    const initialCount = mockPlayers.length;
    const deadTheme = mockPlayers.at(-2)!;
    expect(deadTheme.play).toHaveBeenCalledTimes(1);
    // iOS kills the session server while backgrounded: the next native call
    // throws "Session lookup failed" and the old player can never play again.
    deadTheme.play.mockImplementation(() => {
      throw new Error('Session lookup failed');
    });

    startTheme();

    expect(mockPlayers).toHaveLength(initialCount * 2);
    const rebuiltTheme = mockPlayers.at(-2)!;
    expect(rebuiltTheme.loop).toBe(true);
    expect(rebuiltTheme.play).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
  });

  it('recovers a dead SFX player, then replays both the theme and the cue', async () => {
    initAudio();
    startTheme();
    const initialCount = mockPlayers.length;
    const deadKickoff = mockPlayers[0];
    deadKickoff.seekTo.mockImplementation(() =>
      Promise.reject(new Error('Unable to find the native shared object')));

    playForEvent({ t: 0, kind: 'KICKOFF', half: 1 } as MatchEvent);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(initialCount * 2);
    const rebuilt = mockPlayers.slice(initialCount);
    // The match still wants its theme — recovery resumes it on the new player.
    expect(rebuilt.at(-2)!.play).toHaveBeenCalledTimes(1);
    expect(rebuilt[0].seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    expect(rebuilt[0].play).toHaveBeenCalledTimes(1);
  });
});
