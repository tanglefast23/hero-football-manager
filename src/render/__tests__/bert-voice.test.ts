const mockPlayers: Array<{
  volume: number;
  loop: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];

/** Resolvers for seeks still in flight, so a test can decide when one lands. */
const pendingSeeks: Array<() => void> = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const player = {
      volume: -1,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            pendingSeeks.push(() => resolve());
          }),
      ),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));

import {
  LONG_MESSAGE_MS,
  REGULAR_MESSAGE_MAX_MS,
  REGULAR_MESSAGE_MIN_MS,
  SHORT_MESSAGE_MS,
  bertVoiceDurationMs,
  playBertVoice,
  stopBertVoice,
  teardownBertVoice,
} from '../bert-voice';

/** Lands every seek the player is waiting on, then drains the microtask queue. */
async function settleSeeks(): Promise<void> {
  for (const resolve of pendingSeeks.splice(0)) resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const SHORT_LINE = "So. You're the new manager.";
const REGULAR_LINE =
  'All you gotta do is win games, gain fans, get sponsors. Not hard right?';
const LONG_LINE =
  'Starting from week 10, all divisions play against each other. Stronger clubs' +
  ' receive opening byes. The winner takes the cup and the prize money that comes with it.';

describe('bert voice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPlayers.length = 0;
    pendingSeeks.length = 0;
  });

  afterEach(() => {
    teardownBertVoice();
    jest.useRealTimers();
  });

  it('talks for one second on a one-liner and 1.9 on a paragraph', () => {
    expect(bertVoiceDurationMs(SHORT_LINE)).toBe(SHORT_MESSAGE_MS);
    expect(bertVoiceDurationMs(LONG_LINE)).toBe(LONG_MESSAGE_MS);
    expect(SHORT_MESSAGE_MS).toBe(1_000);
    expect(LONG_MESSAGE_MS).toBe(1_900);
    // Nothing said, nothing to tick under.
    expect(bertVoiceDurationMs('   ')).toBe(0);
  });

  it('varies a regular message box between 1.3 and 1.7 seconds', () => {
    expect(REGULAR_MESSAGE_MIN_MS).toBe(1_300);
    expect(REGULAR_MESSAGE_MAX_MS).toBe(1_700);

    const durations = new Set<number>();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const duration = bertVoiceDurationMs(REGULAR_LINE);
      expect(duration).toBeGreaterThanOrEqual(REGULAR_MESSAGE_MIN_MS);
      expect(duration).toBeLessThanOrEqual(REGULAR_MESSAGE_MAX_MS);
      durations.add(duration);
    }
    // Randomised, not a fixed middle value: consecutive bubbles must not tick
    // for an identical, metronomic beat.
    expect(durations.size).toBeGreaterThan(1);
  });

  it('sorts copy into the three bands at the documented boundaries', () => {
    expect(bertVoiceDurationMs('x'.repeat(45))).toBe(SHORT_MESSAGE_MS);
    expect(bertVoiceDurationMs('x'.repeat(46))).not.toBe(SHORT_MESSAGE_MS);
    expect(bertVoiceDurationMs('x'.repeat(130))).not.toBe(LONG_MESSAGE_MS);
    expect(bertVoiceDurationMs('x'.repeat(131))).toBe(LONG_MESSAGE_MS);
  });

  it('plays one uninterrupted run for the whole line, then falls silent on its own', async () => {
    playBertVoice(SHORT_MESSAGE_MS);
    await settleSeeks();
    const player = mockPlayers[0];
    expect(player).toBeDefined();
    // One seek and one play for the whole line. Repeatedly seeking a single
    // voice is what silenced every tick after the first on iOS, and that
    // constraint outlived the tick it was discovered with.
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    // The dialogue clip outruns the longest line, so there is no end to loop at.
    expect(player.loop).toBe(false);
    // It enters the clip somewhere rather than always at the top, so two
    // bubbles in a row never open on the same syllables.
    const [offset] = player.seekTo.mock.calls[0];
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(8.8 - 2);

    jest.advanceTimersByTime(SHORT_MESSAGE_MS);
    await settleSeeks();
    expect(player.pause).toHaveBeenCalled();

    // Past the duration nothing restarts it.
    jest.advanceTimersByTime(5_000);
    await settleSeeks();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('stops mid-line when the page changes', async () => {
    playBertVoice(LONG_MESSAGE_MS);
    await settleSeeks();
    const player = mockPlayers[0];
    jest.advanceTimersByTime(300);

    stopBertVoice();
    expect(player.pause).toHaveBeenCalled();
    jest.advanceTimersByTime(LONG_MESSAGE_MS);
    await settleSeeks();
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('does not start looping on a seek that lands after the line ended', async () => {
    playBertVoice(SHORT_MESSAGE_MS);
    const player = mockPlayers[0];
    // The page changes while the rewind is still in flight. A looping voice
    // started by that late seek would tick on with nothing left to stop it.
    stopBertVoice();
    await settleSeeks();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('stays silent at zero master volume', async () => {
    const { setBertVoiceMasterVolume } = await import('../bert-voice');
    setBertVoiceMasterVolume(0);
    playBertVoice(SHORT_MESSAGE_MS);
    await settleSeeks();
    jest.advanceTimersByTime(SHORT_MESSAGE_MS);
    await settleSeeks();
    for (const player of mockPlayers)
      expect(player.play).not.toHaveBeenCalled();
    setBertVoiceMasterVolume(1);
  });
});
