const mockPlayers: Array<{
  volume: number;
  loop: boolean;
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
  audioKeysForProfile,
  initAudio,
  setMasterVolume,
  teardownAudio,
} from '../audio';

describe('master audio volume', () => {
  beforeEach(() => {
    teardownAudio();
    mockPlayers.length = 0;
    setMasterVolume(1);
  });

  afterEach(() => {
    teardownAudio();
  });

  it('applies a preselected level while preserving the existing mix', () => {
    setMasterVolume(0.5);
    initAudio();

    const sfx = mockPlayers.slice(0, -2);
    const whooshIndex = audioKeysForProfile('full').indexOf(
      'ball-flight-whoosh',
    );
    const theme = mockPlayers.at(-2)!;
    const fireLoop = mockPlayers.at(-1)!;

    expect(sfx.length).toBeGreaterThan(0);
    expect(sfx[whooshIndex].volume).toBe(0.125);
    expect(
      sfx
        .filter((_, index) => index !== whooshIndex)
        .every((player) => player.volume === 0.5),
    ).toBe(true);
    expect(theme.volume).toBe(0.25);
    expect(fireLoop.volume).toBe(0.35);
  });

  it('updates every active player immediately, including mute', () => {
    initAudio();
    setMasterVolume(0);

    expect(mockPlayers.every((player) => player.volume === 0)).toBe(true);
  });
});
