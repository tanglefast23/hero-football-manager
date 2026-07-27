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
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
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
  playDrillGainRevealSfx,
  playDrillProgressSfx,
  playEventSuccessSfx,
  playFacilityCompleteSfx,
  playFacilityStartSfx,
  playManagementActionSfx,
  playMatchStatementSfx,
  playPositiveSfx,
  playStatStepSfx,
  playSuperTrainingYaySfx,
  playTrainingStatDing,
  playTransactionConfirmSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  stopDrillProgressSfx,
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

    expect(mockPlayers).toHaveLength(22);
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

    expect(mockPlayers).toHaveLength(22);
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
    // A plain tap is deliberately the lightest weight in the taxonomy so it does
    // not feel like a `commit` that spends club money.
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('gives small interactions an audible click and large action buttons the confirmation', () => {
    const sounds = readFileSync(join(process.cwd(), 'src/render/management-sfx.ts'), 'utf8');
    const buttons = readFileSync(join(process.cwd(), 'src/ui/components/Scorecard.tsx'), 'utf8');

    // A real push-button click, not the 80ms tap that vanished under the music.
    expect(sounds).toContain("'ui-click': require('../../assets/audio/sfx/ui-push-button.m4a')");
    expect(sounds).toContain("select: require('../../assets/audio/sfx/ui-push-button.m4a')");
    // Steppers are the exception: a lighter tap, because a stat point or a hair
    // swatch is one notch of an adjustment, not a commitment.
    expect(sounds).toContain("'stat-step': require('../../assets/audio/sfx/ui-stat-step.m4a')");
    expect(sounds).toContain("positive: require('../../assets/audio/sfx/positive.m4a')");
    // Large buttons still confirm by default, but the variant can speak for
    // itself: a destructive one answers with the back-button cue (dismissing a
    // coach or erasing a save used to be applauded by the chime that celebrates
    // a signing), and a neutral paper one — cancel, back, pass, decline — only
    // clicks, so a refusal never sounds like a win.
    expect(sounds).toContain("danger: require('../../assets/audio/sfx/back-button.m4a')");
    expect(buttons).toContain(
      "const cue = pressSfx\n    ?? (variant === 'danger' ? 'danger' : variant === 'paper' ? 'click' : 'positive');",
    );
  });

  it('keeps the drill progress bed stoppable and the reveal on its own player', async () => {
    playDrillProgressSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(22);
    const progress = mockPlayers[18];
    expect(progress.seekTo).toHaveBeenCalledWith(0);
    expect(progress.play).toHaveBeenCalledTimes(1);

    stopDrillProgressSfx();
    expect(progress.pause).toHaveBeenCalledTimes(1);

    playDrillGainRevealSfx();
    await Promise.resolve();
    expect(mockPlayers[19].play).toHaveBeenCalledTimes(1);
    // The reveal must not restart the bed the count-up just stopped.
    expect(progress.play).toHaveBeenCalledTimes(1);
  });

  it('ties the progress bed to the count-up inside the drill scene', () => {
    const scene = readFileSync(join(process.cwd(), 'src/render/DrillSceneOverlay.tsx'), 'utf8');

    expect(scene).toContain('playDrillProgressSfx()');
    // Stopped where the number lands AND on teardown, so a skipped scene is silent.
    expect(scene.match(/stopDrillProgressSfx\(\)/g)).toHaveLength(2);
    expect(scene).toContain('setCountLanded(true)');
    // The gain stamp waits for the count; the number itself is green.
    expect(scene).toContain('opacity: countLanded ? 1 : 0');
    expect(scene).toContain("gainValue: { color: '#3f8a4a'");
  });

  it('routes semantic management cues to their dedicated player', async () => {
    playManagementActionSfx('success');
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(22);
    expect(mockPlayers[13].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[13].play).toHaveBeenCalledTimes(1);
  });

  it('plays the positive cue on its own dedicated player', async () => {
    playPositiveSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(22);
    // 'positive' is appended last, so it owns the final player slot.
    const positive = mockPlayers[16];
    expect(positive.seekTo).toHaveBeenCalledWith(0);
    expect(positive.play).toHaveBeenCalledTimes(1);
    // It must not double-trigger the neutral UI click.
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
  });

  it('cheers as the SUPER takeover leaves the screen', async () => {
    const celebration = readFileSync(
      join(process.cwd(), 'src/ui/components/SuperTrainingCelebration.tsx'),
      'utf8',
    );

    // Tied to the end of the takeover, not to the result landing — and it fires
    // whether the celebration played out or was tapped away.
    expect(celebration).toContain('playSuperTrainingYaySfx()');
    expect(celebration).toContain('export const SUPER_CELEBRATION_MS = 3200');
    expect(celebration).toContain('FIREWORK_DELAYS_MS');

    playSuperTrainingYaySfx();
    await Promise.resolve();
    expect(mockPlayers).toHaveLength(22);
    expect(mockPlayers[20].play).toHaveBeenCalledTimes(1);
  });

  it('plays the supplied stat-step tap independently from the neutral click', async () => {
    playStatStepSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(22);
    const statStep = mockPlayers[17];
    expect(statStep.seekTo).toHaveBeenCalledWith(0);
    expect(statStep.play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });
});
