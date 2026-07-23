import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockPlayers: Array<{
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  release: jest.Mock;
}> = [];
const mockImpactAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: mockImpactAsync,
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

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
  playCoachDepartureSfx,
  playEventSuccessSfx,
  playFacilityCompleteSfx,
  playFacilityStartSfx,
  playManagementActionSfx,
  playMatchStatementSfx,
  playPositiveSfx,
  playStatStepSfx,
  playTrainingStatDing,
  playTransactionConfirmSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  teardownManagementSfx,
} from '../management-sfx';

describe('management feedback sounds', () => {
  beforeEach(() => {
    teardownManagementSfx();
    mockPlayers.length = 0;
    mockImpactAsync.mockClear();
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

    expect(mockPlayers).toHaveLength(18);
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

    expect(mockPlayers).toHaveLength(18);
    expect(mockPlayers[0].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[1].play).not.toHaveBeenCalled();
  });

  it('routes interaction families to stable semantic sounds', async () => {
    playUiClickSfx();
    playTransactionConfirmSfx();
    playCoachDepartureSfx();
    playFacilityStartSfx();
    playFacilityCompleteSfx();
    playEventSuccessSfx();
    await Promise.resolve();

    expect(mockPlayers[2].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[4].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[5].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[6].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[7].play).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
  });

  it('uses the tap for small interactions and confirmation for large action buttons', () => {
    const sounds = readFileSync(join(process.cwd(), 'src/render/management-sfx.ts'), 'utf8');
    const buttons = readFileSync(join(process.cwd(), 'src/ui/components/Scorecard.tsx'), 'utf8');

    expect(sounds).toContain("'ui-click': require('../../assets/audio/sfx/stat-step-tap.m4a')");
    expect(sounds).toContain("select: require('../../assets/audio/sfx/stat-step-tap.m4a')");
    expect(sounds).toContain("positive: require('../../assets/audio/sfx/positive.m4a')");
    expect(buttons).toContain("pressSfx = 'positive'");
  });

  it('routes semantic management cues to their dedicated player', async () => {
    playManagementActionSfx('success');
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(18);
    expect(mockPlayers[13].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[13].play).toHaveBeenCalledTimes(1);
  });

  it('plays the positive cue on its own dedicated player', async () => {
    playPositiveSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(18);
    // 'positive' is appended last, so it owns the final player slot.
    const positive = mockPlayers[16];
    expect(positive.seekTo).toHaveBeenCalledWith(0);
    expect(positive.play).toHaveBeenCalledTimes(1);
    // It must not double-trigger the neutral UI click.
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
  });

  it('plays the supplied stat-step tap independently from the neutral click', async () => {
    playStatStepSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(18);
    const statStep = mockPlayers[17];
    expect(statStep.seekTo).toHaveBeenCalledWith(0);
    expect(statStep.play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
  });
});
