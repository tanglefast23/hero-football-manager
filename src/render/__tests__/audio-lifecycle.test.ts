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
const { initAudio, startTheme, stopTheme, teardownAudio } =
  require('../audio') as typeof import('../audio');

describe('audio lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    teardownMenuAudio();
    mockPlayers.length = 0;
  });

  afterEach(() => {
    setTabHidden(false);
    teardownMenuAudio();
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
