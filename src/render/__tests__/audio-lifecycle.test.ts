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

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
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

/**
 * The suite runs in the `node` environment with no jsdom, so the page-visibility
 * signal the web build reacts to has to be supplied. It is installed before the
 * audio modules are required, because each one registers its owner at import
 * time and that first registration is what attaches the listener.
 */
const listeners = new Map<string, Set<() => void>>();
const fakeDocument = {
  hidden: false,
  addEventListener: (
    type: string,
    listener: () => void,
    options?: { once?: boolean },
  ) => {
    const set = listeners.get(type) ?? new Set();
    set.add(Object.assign(listener, { once: options?.once === true }));
    listeners.set(type, set);
  },
  removeEventListener: (type: string, listener: () => void) => {
    listeners.get(type)?.delete(listener);
  },
};
(globalThis as unknown as { document: unknown }).document = fakeDocument;

function dispatch(type: string): void {
  for (const listener of [...(listeners.get(type) ?? [])]) {
    if ((listener as { once?: boolean }).once === true)
      listeners.get(type)?.delete(listener);
    listener();
  }
}

function setTabHidden(hidden: boolean): void {
  fakeDocument.hidden = hidden;
  dispatch('visibilitychange');
}

/**
 * A `document` makes menu-audio take its web path, where nothing may play until
 * the first user gesture. Standing in for that gesture is part of reproducing
 * the browser-tab case this suite is about.
 */
function unlockWebPlayback(): void {
  dispatch('pointerdown');
}

// Required, not imported: the stub above must already be in place.
const { audioIsSuspended, registerAudioOwner } =
  require('../audio-lifecycle') as typeof import('../audio-lifecycle');
const { setMenuTheme, teardownMenuAudio } =
  require('../menu-audio') as typeof import('../menu-audio');
const {
  initAudio,
  startTheme,
  stopTheme,
  startFireAmbience,
  stopFireAmbience,
  playForEvent,
  teardownAudio,
} = require('../audio') as typeof import('../audio');
const {
  playAwakeningLimp,
  playAwakeningAscension,
  AWAKENING_HARPS_DELAY_MS,
  teardownAwakeningAudio,
} = require('../awakening-audio') as typeof import('../awakening-audio');
const {
  playEndingFarewell,
  playCelebrationAnthem,
  stopCelebrationAudio,
  teardownCelebrationAudio,
} = require('../celebration-audio') as typeof import('../celebration-audio');

function pendingSeek(player: (typeof mockPlayers)[number]) {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  player.seekTo.mockReturnValueOnce(promise);
  return { resolve: () => resolve(), reject: (error: Error) => reject(error) };
}

async function flushPromises(): Promise<void> {
  for (let count = 0; count < 6; count += 1) await Promise.resolve();
}

describe('audio lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    teardownMenuAudio();
    teardownAudio();
    teardownAwakeningAudio();
    teardownCelebrationAudio();
    mockPlayers.length = 0;
  });

  afterEach(() => {
    teardownAudio();
    teardownAwakeningAudio();
    teardownCelebrationAudio();
    teardownMenuAudio();
    setTabHidden(false);
    jest.useRealTimers();
  });

  it('suspends every owner while the tab is hidden and restores them on return', () => {
    const first = { suspend: jest.fn(), resume: jest.fn() };
    const second = { suspend: jest.fn(), resume: jest.fn() };
    const unregister = registerAudioOwner(first);
    registerAudioOwner(second);

    setTabHidden(true);

    expect(audioIsSuspended()).toBe(true);
    expect(first.suspend).toHaveBeenCalledTimes(1);
    expect(second.suspend).toHaveBeenCalledTimes(1);

    // A repeat signal for the state we are already in changes nothing.
    setTabHidden(true);
    expect(first.suspend).toHaveBeenCalledTimes(1);

    setTabHidden(false);

    expect(audioIsSuspended()).toBe(false);
    expect(first.resume).toHaveBeenCalledTimes(1);
    expect(second.resume).toHaveBeenCalledTimes(1);

    unregister();
    setTabHidden(true);
    expect(first.suspend).toHaveBeenCalledTimes(1);
    expect(second.suspend).toHaveBeenCalledTimes(2);
    unregister();
  });

  it("keeps one owner's failure from silencing the rest", () => {
    const throwing = {
      suspend: () => {
        throw new Error('player gone');
      },
      resume: jest.fn(),
    };
    const healthy = { suspend: jest.fn(), resume: jest.fn() };
    const dropThrowing = registerAudioOwner(throwing);
    const dropHealthy = registerAudioOwner(healthy);

    expect(() => setTabHidden(true)).not.toThrow();
    expect(healthy.suspend).toHaveBeenCalledTimes(1);

    dropThrowing();
    dropHealthy();
  });

  it('pauses the menu theme for a hidden tab and plays it again on return', () => {
    setMenuTheme('management');
    unlockWebPlayback();
    const theme = mockPlayers[1];
    expect(theme.play).toHaveBeenCalledTimes(1);

    setTabHidden(true);
    expect(theme.pause).toHaveBeenCalledTimes(1);

    setTabHidden(false);
    expect(theme.play).toHaveBeenCalledTimes(2);
  });

  it('never starts the menu theme into a hidden tab', () => {
    setTabHidden(true);
    setMenuTheme('management');
    unlockWebPlayback();

    expect(mockPlayers[1].play).not.toHaveBeenCalled();

    setTabHidden(false);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
  });

  it('does not start awakening cues in a hidden tab', async () => {
    setTabHidden(true);
    playAwakeningLimp();
    playAwakeningAscension();
    await flushPromises();
    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS);
    await flushPromises();

    expect(
      mockPlayers.every((player) => player.play.mock.calls.length === 0),
    ).toBe(true);
    setTabHidden(false);
    await flushPromises();
    expect(
      mockPlayers.every((player) => player.play.mock.calls.length === 0),
    ).toBe(true);
  });

  it('pauses awakening audio and cancels its delayed harp entrance on hide', async () => {
    playAwakeningAscension();
    await flushPromises();
    const [angels, harps, limp] = mockPlayers;
    expect(angels.play).toHaveBeenCalledTimes(1);

    setTabHidden(true);
    expect(angels.pause).toHaveBeenCalled();
    expect(harps.pause).toHaveBeenCalled();
    expect(limp.pause).toHaveBeenCalled();
    setTabHidden(false);
    jest.advanceTimersByTime(AWAKENING_HARPS_DELAY_MS);
    await flushPromises();

    expect(angels.play).toHaveBeenCalledTimes(1);
    expect(harps.play).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'cancels an awakening seek after hide: %s',
    async (outcome) => {
      playAwakeningLimp();
      await flushPromises();
      const limp = mockPlayers[2];
      const seek = pendingSeek(limp);
      playAwakeningLimp();
      setTabHidden(true);
      if (outcome === 'resolve') seek.resolve();
      else seek.reject(new Error('Session lookup failed'));
      await flushPromises();

      expect(mockPlayers).toHaveLength(3);
      expect(limp.play).toHaveBeenCalledTimes(1);
      setTabHidden(false);
      await flushPromises();
      expect(limp.play).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['stop', 'hide', 'teardown'] as const)(
    'cancels a pending fire start after %s',
    async (action) => {
      initAudio();
      const fire = mockPlayers.at(-1)!;
      const seek = pendingSeek(fire);
      startFireAmbience();
      if (action === 'stop') stopFireAmbience();
      else if (action === 'hide') setTabHidden(true);
      else teardownAudio();
      seek.resolve();
      await flushPromises();

      expect(fire.play).not.toHaveBeenCalled();
      if (action === 'hide') {
        setTabHidden(false);
        expect(fire.play).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('does not replay an old fire ignition after a new ignition', async () => {
    initAudio();
    const fire = mockPlayers.at(-1)!;
    const oldSeek = pendingSeek(fire);
    startFireAmbience();
    stopFireAmbience();
    startFireAmbience();
    await flushPromises();
    expect(fire.play).toHaveBeenCalledTimes(1);

    oldSeek.resolve();
    await flushPromises();
    expect(fire.play).toHaveBeenCalledTimes(1);
  });

  it('cancels a recovery fire seek when the fire is stopped', async () => {
    initAudio();
    startFireAmbience();
    await flushPromises();
    const fire = mockPlayers.at(-1)!;
    const createAudioPlayer = jest.requireMock('expo-audio')
      .createAudioPlayer as jest.Mock;
    const create = createAudioPlayer.getMockImplementation()!;
    const seeks: Array<ReturnType<typeof pendingSeek>> = [];
    createAudioPlayer.mockImplementation((...args: unknown[]) => {
      const player = create(...args);
      seeks.push(pendingSeek(player));
      return player;
    });
    mockPlayers[0].seekTo.mockRejectedValueOnce(
      new Error('Session lookup failed'),
    );
    try {
      playForEvent({ t: 0, kind: 'KICKOFF', half: 1 });
      await flushPromises();
      expect(mockPlayers.at(-1)).not.toBe(fire);
      stopFireAmbience();
      for (const seek of seeks) seek.resolve();
      await flushPromises();
      expect(mockPlayers.at(-1)!.play).not.toHaveBeenCalled();
    } finally {
      createAudioPlayer.mockImplementation(create);
    }
  });

  it('does not recover a canceled fire seek', async () => {
    initAudio();
    const count = mockPlayers.length;
    const fire = mockPlayers.at(-1)!;
    const seek = pendingSeek(fire);
    startFireAmbience();
    stopFireAmbience();
    seek.reject(new Error('Session lookup failed'));
    await flushPromises();

    expect(mockPlayers).toHaveLength(count);
    expect(fire.play).not.toHaveBeenCalled();
  });

  it.each(['stop', 'hide', 'replace', 'teardown'] as const)(
    'cancels a pending celebration seek after %s',
    async (action) => {
      playEndingFarewell();
      await flushPromises();
      const farewell = mockPlayers[1];
      farewell.play.mockClear();
      const seek = pendingSeek(farewell);
      playEndingFarewell();
      if (action === 'stop') stopCelebrationAudio();
      else if (action === 'hide') setTabHidden(true);
      else if (action === 'replace') playCelebrationAnthem();
      else teardownCelebrationAudio();
      seek.resolve();
      await flushPromises();

      expect(farewell.play).not.toHaveBeenCalled();
      if (action === 'hide') {
        setTabHidden(false);
        await flushPromises();
        expect(farewell.play).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('does not recover a canceled celebration seek', async () => {
    playEndingFarewell();
    await flushPromises();
    const seek = pendingSeek(mockPlayers[1]);
    playEndingFarewell();
    stopCelebrationAudio();
    seek.reject(new Error('Session lookup failed'));
    await flushPromises();

    expect(mockPlayers).toHaveLength(2);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
  });

  it('does not replay a stale seek after the same celebration restarts', async () => {
    playEndingFarewell();
    await flushPromises();
    const farewell = mockPlayers[1];
    farewell.play.mockClear();
    const seek = pendingSeek(farewell);
    playEndingFarewell();
    stopCelebrationAudio();
    playEndingFarewell();
    await flushPromises();
    expect(farewell.play).toHaveBeenCalledTimes(1);

    seek.resolve();
    await flushPromises();
    expect(farewell.play).toHaveBeenCalledTimes(1);
  });

  describe('a match theme coming back from the background', () => {
    afterEach(() => {
      stopTheme();
      teardownAudio();
    });

    it('rebuilds the session when the resumed loop accepts play and stays silent', () => {
      initAudio();
      startTheme();
      const before = mockPlayers.length;
      const theme = mockPlayers.find((player) => player.loop === true)!;
      expect(theme.play).toHaveBeenCalledTimes(1);

      setTabHidden(true);
      expect(theme.pause).toHaveBeenCalled();

      // iOS tore the session down while the app was away: play() is accepted
      // and nothing comes out. This is the case a thrown error never covered.
      theme.playing = false;
      theme.play.mockImplementation(() => {});

      setTabHidden(false);
      expect(theme.play).toHaveBeenCalledTimes(2);
      // Nothing has noticed yet — the check is deliberately a beat later.
      expect(theme.release).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(theme.release).toHaveBeenCalled();
      expect(mockPlayers.length).toBeGreaterThan(before);
      const rebuilt = mockPlayers
        .slice(before)
        .find((player) => player.loop === true)!;
      expect(rebuilt.play).toHaveBeenCalled();
    });

    it('leaves a loop that really did resume alone', () => {
      initAudio();
      startTheme();
      const before = mockPlayers.length;
      const theme = mockPlayers.find((player) => player.loop === true)!;

      setTabHidden(true);
      setTabHidden(false);
      jest.advanceTimersByTime(500);

      expect(theme.release).not.toHaveBeenCalled();
      expect(mockPlayers.length).toBe(before);
    });
  });
});
