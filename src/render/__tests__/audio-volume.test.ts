import { createMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import {
  advanceMatchVfxShowcase,
  initializeMatchVfxShowcase,
  matchVfxShowcaseEvent,
  matchVfxShowcaseSeed,
} from '../match-vfx-showcase';

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
  playForEvent,
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
    const whooshIndex =
      audioKeysForProfile('full').indexOf('ball-flight-whoosh');
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

  it('plays the supplied cue when a real match slide starts', async () => {
    initAudio();
    const match = createMatch(
      matchVfxShowcaseSeed('slide-tackle'),
      ROVERS,
      UNITED,
    );
    initializeMatchVfxShowcase(match, 'slide-tackle');
    for (let i = 0; i < 20; i += 1) {
      advanceMatchVfxShowcase(match, 'slide-tackle');
      const event = matchVfxShowcaseEvent(match, 'slide-tackle');
      if (!event) continue;
      playForEvent(event);
      break;
    }
    await Promise.resolve();
    const player =
      mockPlayers[audioKeysForProfile('full').indexOf('slide-tackle')];
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('updates every active player immediately, including mute', () => {
    initAudio();
    setMasterVolume(0);

    expect(mockPlayers.every((player) => player.volume === 0)).toBe(true);
  });
});
