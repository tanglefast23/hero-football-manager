const mockPlayers: Array<{
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const player = {
      volume: -1,
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
  LONG_MESSAGE_MS,
  SHORT_MESSAGE_MS,
  bertVoiceDurationMs,
  playBertVoice,
  stopBertVoice,
  teardownBertVoice,
} from '../bert-voice';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('bert voice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPlayers.length = 0;
  });

  afterEach(() => {
    teardownBertVoice();
    jest.useRealTimers();
  });

  it('talks for two seconds on a short message and 3.5 on a long one', () => {
    expect(bertVoiceDurationMs('Navigate round the facilities here.')).toBe(SHORT_MESSAGE_MS);
    expect(bertVoiceDurationMs(
      'Wages and upkeep go out every week, win or lose. Keep an eye on the money up top.'
      + ' Win games, pull in fans, and you will be fine.',
    )).toBe(LONG_MESSAGE_MS);
    expect(SHORT_MESSAGE_MS).toBe(2_000);
    expect(LONG_MESSAGE_MS).toBe(3_500);
  });

  it('ticks repeatedly while talking, then falls silent on its own', async () => {
    playBertVoice(SHORT_MESSAGE_MS);
    await flushPromises();
    const player = mockPlayers[0];
    expect(player).toBeDefined();
    expect(player.play.mock.calls.length).toBeGreaterThan(0);

    jest.advanceTimersByTime(SHORT_MESSAGE_MS);
    await flushPromises();
    // A run of ticks, not a single blip: ~2s at one tick per 90ms.
    const ticksWhileTalking = player.play.mock.calls.length;
    expect(ticksWhileTalking).toBeGreaterThan(5);
    expect(player.pause).toHaveBeenCalled();

    // Past the duration the ticker is cleared, so no further clip is triggered.
    jest.advanceTimersByTime(5_000);
    await flushPromises();
    expect(player.play.mock.calls.length).toBe(ticksWhileTalking);
  });

  it('stops mid-line when the page changes', async () => {
    playBertVoice(LONG_MESSAGE_MS);
    await flushPromises();
    const player = mockPlayers[0];
    jest.advanceTimersByTime(300);
    await flushPromises();
    const ticks = player.play.mock.calls.length;

    stopBertVoice();
    jest.advanceTimersByTime(LONG_MESSAGE_MS);
    await flushPromises();
    expect(player.play.mock.calls.length).toBe(ticks);
  });

  it('stays silent at zero master volume', async () => {
    const { setBertVoiceMasterVolume } = await import('../bert-voice');
    setBertVoiceMasterVolume(0);
    playBertVoice(SHORT_MESSAGE_MS);
    await flushPromises();
    jest.advanceTimersByTime(SHORT_MESSAGE_MS);
    await flushPromises();
    for (const player of mockPlayers) expect(player.play).not.toHaveBeenCalled();
    setBertVoiceMasterVolume(1);
  });
});
