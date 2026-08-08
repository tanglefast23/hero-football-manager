const mockPlayers: Array<{
  loop: boolean;
  muted: boolean;
  pause: jest.Mock;
  play: jest.Mock;
  release: jest.Mock;
  remove: jest.Mock;
  seekTo: jest.Mock;
  volume: number;
}> = [];
const pendingSeeks: Array<() => void> = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => {
    const player = {
      loop: true,
      muted: false,
      pause: jest.fn(),
      play: jest.fn(),
      release: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            pendingSeeks.push(resolve);
          }),
      ),
      volume: -1,
    };
    mockPlayers.push(player);
    return player;
  }),
}));

jest.mock('../audio-lifecycle', () => ({
  audioIsSuspended: jest.fn(() => false),
  registerAudioOwner: jest.fn(),
}));

import {
  cancelPendingRivalHeroLaugh,
  playRivalHeroLaugh,
  setRivalHeroVoiceMasterVolume,
  stopRivalHeroLaugh,
  teardownRivalHeroVoice,
} from '../rival-hero-voice';

async function settleSeeks(): Promise<void> {
  for (const resolve of pendingSeeks.splice(0)) resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('rival hero voice', () => {
  beforeEach(() => {
    mockPlayers.length = 0;
    pendingSeeks.length = 0;
    setRivalHeroVoiceMasterVolume(1);
  });

  afterEach(() => {
    teardownRivalHeroVoice();
  });

  it('loads one non-looping authored laugh for every headline rival', () => {
    expect(mockPlayers).toHaveLength(5);
    for (const player of mockPlayers) {
      expect(player.loop).toBe(false);
      expect(player.volume).toBe(1);
    }
  });

  it.each([
    ['special-f171', 0],
    ['special-f178', 1],
    ['special-f174', 2],
    ['special-f176', 3],
    ['special-f168', 4],
  ] as const)(
    'plays only the laugh assigned to %s from its beginning',
    async (heroId, expectedIndex) => {
      playRivalHeroLaugh(heroId);
      await settleSeeks();

      const assigned = mockPlayers[expectedIndex];
      expect(assigned.seekTo).toHaveBeenCalledWith(0);
      expect(assigned.play).toHaveBeenCalledTimes(1);
      for (const player of mockPlayers.filter(
        (candidate) => candidate !== assigned,
      )) {
        expect(player.play).not.toHaveBeenCalled();
      }
    },
  );

  it('cancels a pending rewind when the speech beat exits early', async () => {
    playRivalHeroLaugh('special-f171');
    cancelPendingRivalHeroLaugh();
    await settleSeeks();
    expect(mockPlayers[0].play).not.toHaveBeenCalled();
  });

  it('lets an already-playing one-shot finish when the speech beat exits', async () => {
    playRivalHeroLaugh('special-f171');
    await settleSeeks();
    cancelPendingRivalHeroLaugh();

    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[0].pause).not.toHaveBeenCalled();
  });

  it('mutes and stops every laugh at zero master volume', async () => {
    playRivalHeroLaugh('special-f178');
    await settleSeeks();
    setRivalHeroVoiceMasterVolume(0);
    for (const player of mockPlayers) {
      expect(player.volume).toBe(0);
      expect(player.muted).toBe(true);
    }
    expect(mockPlayers[1].pause).toHaveBeenCalled();
  });

  it('releases every player during root teardown', () => {
    const currentPlayers = [...mockPlayers];
    teardownRivalHeroVoice();
    for (const player of currentPlayers) {
      expect(player.remove).toHaveBeenCalledTimes(1);
      expect(player.release).toHaveBeenCalledTimes(1);
    }
  });
});
