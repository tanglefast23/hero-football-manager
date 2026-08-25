// The rapid tap cues (`ui-click`, `stat-step`) are the only ones that reuse a
// pool of players, so they are the only ones that can get the playhead wrong.
// The other management-sfx tests mock the player as a bare jest.fn, which
// happily "plays" from anywhere; that mock cannot fail for a voice left parked
// at the end of its clip, and it cannot fail for a rewind that lands while the
// clip is still sounding. Both of those are audible bugs on a device.
//
// This file mocks the two behaviours the platform player actually has:
//   - play() on a player sitting at the end of its clip does nothing at all
//     (AVPlayer does not rewind for you — the tap is silent).
//   - seek() does not stop playback, so seeking a sounding player back to the
//     head re-fires the transient (the tap is heard twice).
// and it asserts the only contract that matters: one tap, one sound.

const PLAY_START_LATENCY_MS = 60;
let clipSeconds = 0.44;

interface FakePlayer {
  volume: number;
  muted: boolean;
  /** Times this player audibly re-attacked from the head of its clip. */
  audibleStarts: number;
  /** Times play() was ignored because the playhead was parked at the end. */
  droppedPlays: number;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  remove: () => void;
  release: () => void;
}

const fakePlayers: FakePlayer[] = [];

function createFakePlayer(): FakePlayer {
  const duration = clipSeconds;
  let position = 0;
  let soundingUntil: number | null = null;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let endTimer: ReturnType<typeof setTimeout> | null = null;

  const sounding = (): boolean =>
    soundingUntil !== null && Date.now() < soundingUntil;

  const scheduleEnd = (from: number): void => {
    if (endTimer !== null) clearTimeout(endTimer);
    const remainingMs = (duration - from) * 1000;
    soundingUntil = Date.now() + remainingMs;
    endTimer = setTimeout(() => {
      endTimer = null;
      soundingUntil = null;
      position = duration;
    }, remainingMs);
  };

  const player: FakePlayer = {
    volume: -1,
    muted: false,
    audibleStarts: 0,
    droppedPlays: 0,
    play: () => {
      // Already going: the platform player keeps playing, it does not restart.
      if (startTimer !== null || sounding()) return;
      if (position >= duration) {
        player.droppedPlays += 1;
        return;
      }
      const from = position;
      startTimer = setTimeout(() => {
        startTimer = null;
        player.audibleStarts += 1;
        scheduleEnd(from);
      }, PLAY_START_LATENCY_MS);
    },
    pause: () => {
      if (startTimer !== null) clearTimeout(startTimer);
      if (endTimer !== null) clearTimeout(endTimer);
      startTimer = null;
      endTimer = null;
      soundingUntil = null;
    },
    seekTo: (seconds: number) => {
      const wasSounding = sounding();
      position = seconds;
      if (wasSounding) {
        // A seek leaves the rate alone, so the clip carries straight on from
        // the new playhead — from the head, that is the transient again.
        player.audibleStarts += 1;
        scheduleEnd(seconds);
      }
      return Promise.resolve();
    },
    remove: () => {},
    release: () => {},
  };

  fakePlayers.push(player);
  return player;
}

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => createFakePlayer()),
}));

import {
  playStatStepSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from '../management-sfx';

/** Runs the clock forward in small steps so timers and seek promises interleave. */
async function advance(ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    jest.advanceTimersByTime(10);
    await Promise.resolve();
    await Promise.resolve();
  }
}

function totalAudibleStarts(): number {
  return fakePlayers.reduce((total, player) => total + player.audibleStarts, 0);
}

function totalDroppedPlays(): number {
  return fakePlayers.reduce((total, player) => total + player.droppedPlays, 0);
}

function reset(clip: number): void {
  teardownManagementSfx();
  fakePlayers.length = 0;
  clipSeconds = clip;
  setManagementSfxMasterVolume(1);
}

describe('rapid tap voices', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    teardownManagementSfx();
    jest.useRealTimers();
  });

  it('sounds a button click once per press, at any pace', async () => {
    reset(0.069);

    for (let press = 0; press < 12; press += 1) {
      playUiClickSfx();
      await advance(700);
    }

    expect({
      audibleStarts: totalAudibleStarts(),
      droppedPlays: totalDroppedPlays(),
    }).toEqual({ audibleStarts: 12, droppedPlays: 0 });
  });

  it('sounds a stepper tap once per press, at any pace', async () => {
    reset(0.085);

    for (let press = 0; press < 12; press += 1) {
      playStatStepSfx();
      await advance(260);
    }

    expect({
      audibleStarts: totalAudibleStarts(),
      droppedPlays: totalDroppedPlays(),
    }).toEqual({ audibleStarts: 12, droppedPlays: 0 });
  });

  it('still gives a held-down stepper one sound per press', async () => {
    reset(0.085);

    for (let press = 0; press < 12; press += 1) {
      playStatStepSfx();
      await advance(90);
    }

    expect({
      audibleStarts: totalAudibleStarts(),
      droppedPlays: totalDroppedPlays(),
    }).toEqual({ audibleStarts: 12, droppedPlays: 0 });
  });
});
