const mockPlayers: Array<{
  seekTo: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];
let mockSuspended = false;
const mockOwners: Array<{ suspend: () => void; resume: () => void }> = [];

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    const player = {
      seekTo: jest.fn(() => Promise.resolve()),
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      release: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  },
}));
jest.mock('../audio-lifecycle', () => ({
  GAME_AUDIO_PLAYER_OPTIONS: { updateInterval: 60_000 },
  audioIsSuspended: () => mockSuspended,
  registerAudioOwner: (owner: (typeof mockOwners)[number]) => {
    mockOwners.push(owner);
    return () => {};
  },
}));

const audio =
  require('../coach-speech-audio') as typeof import('../coach-speech-audio');

function suspend(): void {
  mockSuspended = true;
  mockOwners.forEach((owner) => owner.suspend());
}

describe('coach speech audio cancellation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSuspended = false;
    audio.setCoachSpeechMasterVolume(1);
    audio.initCoachSpeechAudio();
  });

  afterEach(() => {
    audio.teardownCoachSpeechAudio();
    mockPlayers.length = 0;
    jest.useRealTimers();
  });

  it('plays each current cue after its seek completes', async () => {
    audio.playSpeechThunder();
    audio.startSpeechGospel();
    audio.playCoachVoice(1000);
    await Promise.resolve();
    for (const player of mockPlayers)
      expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending gospel seek without stopping the other cues', async () => {
    audio.playSpeechThunder();
    audio.startSpeechGospel();
    audio.playCoachVoice(1000);
    audio.stopSpeechGospel();
    await Promise.resolve();
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();
    expect(mockPlayers[2].play).toHaveBeenCalledTimes(1);
  });

  it('does not revive old seeks when a new cutscene starts', async () => {
    audio.playSpeechThunder();
    audio.startSpeechGospel();
    audio.stopCoachSpeechAudio();
    audio.playSpeechThunder();
    audio.startSpeechGospel();
    await Promise.resolve();
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).toHaveBeenCalledTimes(1);
  });

  it.each(['finish', 'suspend', 'teardown'] as const)(
    'does not start thunder or gospel after %s cancels their pending seeks',
    async (action) => {
      const players = mockPlayers.slice(0, 2);
      const complete: Array<() => void> = [];
      for (const player of players) {
        player.seekTo.mockImplementation(
          () => new Promise<void>((resolve) => complete.push(resolve)),
        );
      }
      audio.playSpeechThunder();
      audio.startSpeechGospel();
      if (action === 'finish') audio.stopCoachSpeechAudio();
      if (action === 'suspend') suspend();
      if (action === 'teardown') audio.teardownCoachSpeechAudio();
      complete.forEach((resolve) => resolve());
      await Promise.resolve();
      await Promise.resolve();

      for (const player of players) expect(player.play).not.toHaveBeenCalled();
    },
  );

  it('does not start any speech cue while the app is suspended', async () => {
    suspend();
    audio.playSpeechThunder();
    audio.startSpeechGospel();
    audio.playCoachVoice(1000);
    await Promise.resolve();
    await Promise.resolve();

    for (const player of mockPlayers) {
      expect(player.seekTo).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
    }
  });
});
