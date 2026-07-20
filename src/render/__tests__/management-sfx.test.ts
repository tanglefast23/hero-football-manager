const mockPlayers: Array<{
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];

jest.mock('expo-audio', () => ({
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
  playManagementActionSfx,
  playMatchStatementSfx,
  playTrainingStatDing,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from '../management-sfx';

describe('management feedback sounds', () => {
  beforeEach(() => {
    teardownManagementSfx();
    mockPlayers.length = 0;
    jest.clearAllMocks();
    setManagementSfxMasterVolume(1);
  });

  afterEach(() => {
    teardownManagementSfx();
  });

  it('restarts the supplied ding for each revealed stat', async () => {
    setManagementSfxMasterVolume(0.5);
    playTrainingStatDing();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(10);
    const trainingDing = mockPlayers[1];
    expect(mockPlayers.every(player => player.volume === 0.5)).toBe(true);
    expect(trainingDing.seekTo).toHaveBeenCalledWith(0);
    expect(trainingDing.play).toHaveBeenCalledTimes(1);

    playTrainingStatDing();
    await Promise.resolve();
    expect(trainingDing.play).toHaveBeenCalledTimes(2);
  });

  it('plays the positive synth independently when the statement appears', async () => {
    playMatchStatementSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(10);
    expect(mockPlayers[0].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();
  });

  it('routes semantic management cues to their dedicated player', async () => {
    playManagementActionSfx('success');
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(10);
    expect(mockPlayers[7].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[7].play).toHaveBeenCalledTimes(1);
  });
});
