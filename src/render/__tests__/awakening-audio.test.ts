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

import {
  AWAKENING_HARPS_DELAY_MS,
  AWAKENING_LIMP_CLIP_MS,
  playAwakeningAscension,
  playAwakeningLimp,
  setAwakeningMasterVolume,
  stopAwakeningAscension,
  stopAwakeningLimp,
  teardownAwakeningAudio,
} from '../awakening-audio';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('awakening ascension audio', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    teardownAwakeningAudio();
    mockPlayers.length = 0;
    setAudioModeAsync.mockClear();
    setAwakeningMasterVolume(1);
  });

  afterEach(() => {
    teardownAwakeningAudio();
    jest.useRealTimers();
  });

  it('starts angels first and layers harps halfway through the clip', async () => {
    playAwakeningAscension();
    await flushPromises();

    expect(mockPlayers).toHaveLength(3);
    expect(mockPlayers[0].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();

    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS - 1);
    await flushPromises();
    expect(mockPlayers[1].play).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(mockPlayers[1].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
  });

  it('cancels the harp entrance when the ascension beat ends early', async () => {
    playAwakeningAscension();
    await flushPromises();
    stopAwakeningAscension();

    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS);
    await flushPromises();

    expect(mockPlayers[1].play).not.toHaveBeenCalled();
    expect(mockPlayers.slice(0, 2).every(player => player.pause.mock.calls.length > 0)).toBe(true);
  });

  it('restarts cleanly without leaving the first harp timer active', async () => {
    playAwakeningAscension();
    await flushPromises();
    jest.advanceTimersByTime(500);

    playAwakeningAscension();
    await flushPromises();
    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS);
    await flushPromises();

    expect(mockPlayers[0].play).toHaveBeenCalledTimes(2);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
  });

  it('respects the shared master-volume scale, holding the limp at music level', () => {
    setAwakeningMasterVolume(0.5);
    playAwakeningAscension();

    const [angels, harps, limp] = mockPlayers;
    expect(angels.volume).toBe(0.5);
    expect(harps.volume).toBe(0.5);
    // The limp is a music bed, so it carries the same 0.5 every other bed does
    // rather than the SFX gain the two reveal cues play at.
    expect(limp.volume).toBe(0.25);
    expect(setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });

    setAwakeningMasterVolume(0);
    expect(mockPlayers.every(player => player.volume === 0)).toBe(true);
  });

  it('rebuilds every player and replays the limp when the audio session dies', async () => {
    playAwakeningLimp();
    await flushPromises();
    expect(mockPlayers).toHaveLength(3);
    // iOS killed the session server: the next native call throws and the old
    // player can never play again.
    mockPlayers[2].seekTo.mockImplementation(() => {
      throw new Error('Session lookup failed');
    });

    playAwakeningLimp();
    await flushPromises();

    expect(mockPlayers).toHaveLength(6);
    expect(setAudioModeAsync).toHaveBeenCalledTimes(2);
    const rebuiltLimp = mockPlayers[5];
    expect(rebuiltLimp.seekTo).toHaveBeenCalledWith(0);
    expect(rebuiltLimp.play).toHaveBeenCalledTimes(1);
  });

  it('recovers a dead angels player and still layers harps on the rebuilt pair', async () => {
    playAwakeningAscension();
    await flushPromises();
    expect(mockPlayers).toHaveLength(3);
    mockPlayers[0].seekTo.mockImplementation(() =>
      Promise.reject(new Error('Unable to find the native shared object')));

    playAwakeningAscension();
    await flushPromises();
    await flushPromises();

    expect(mockPlayers).toHaveLength(6);
    const rebuiltAngels = mockPlayers[3];
    expect(rebuiltAngels.seekTo).toHaveBeenCalledWith(0);
    expect(rebuiltAngels.play).toHaveBeenCalledTimes(1);

    // The delayed harps layer must reach the rebuilt player, not the dead one.
    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS);
    await flushPromises();
    expect(mockPlayers[4].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[4].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();
  });

  it('plays the exact 10.3-second limp cue once until the rise begins', async () => {
    expect(AWAKENING_LIMP_CLIP_MS).toBe(10_300);

    playAwakeningLimp();
    await flushPromises();

    expect(mockPlayers).toHaveLength(3);
    expect(mockPlayers[2].loop).toBe(false);
    expect(mockPlayers[2].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[2].play).toHaveBeenCalledTimes(1);

    stopAwakeningLimp();
    expect(mockPlayers[2].pause).toHaveBeenCalled();
  });
});
