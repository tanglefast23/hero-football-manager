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
  playSuperCelebrationSfx,
  playSuperTrainingYaySfx,
  playTrainingStatDing,
  playTransactionConfirmSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  stopDrillProgressSfx,
  stopSuperCelebrationSfx,
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

    expect(mockPlayers).toHaveLength(29);
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

    expect(mockPlayers).toHaveLength(29);
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

  it('gives rapid neutral button presses independent voices too', async () => {
    playUiClickSfx();
    playUiClickSfx();
    playUiClickSfx();
    playUiClickSfx();
    await Promise.resolve();

    const uiClickPool = [mockPlayers[2], mockPlayers[23], mockPlayers[24], mockPlayers[25]];
    // One press, one rewind, one play — on a voice of its own, so four quick
    // presses never share a playhead.
    expect(uiClickPool.every(player => player.seekTo.mock.calls.length === 1)).toBe(true);
    expect(uiClickPool.every(player => player.play.mock.calls.length === 1)).toBe(true);
    expect(mockImpactAsync).toHaveBeenCalledTimes(4);
  });

  it('gives small interactions an audible click and large action buttons the confirmation', () => {
    const sounds = readFileSync(join(process.cwd(), 'src/render/management-sfx.ts'), 'utf8');
    const buttons = readFileSync(join(process.cwd(), 'src/ui/components/Scorecard.tsx'), 'utf8');

    // A press on the screen answers with the supplied tap, whichever of the two
    // generic cue names the caller reaches for; steppers keep the lighter tap.
    // Neither borrows headroom from the music.
    expect(sounds).toContain("'ui-click': require('../../assets/audio/sfx/ui-tap.wav')");
    expect(sounds).toContain("select: require('../../assets/audio/sfx/ui-tap.wav')");
    expect(sounds).toContain("'stat-step': require('../../assets/audio/sfx/stat-step-tap-loud.m4a')");
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

    expect(mockPlayers).toHaveLength(29);
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
    // The number itself is green; the duplicate inline "+N" stamp is gone
    // because the following full-screen takeover owns the gain.
    expect(scene).not.toContain('countLanded');
    expect(scene).not.toContain('gainDelta');
    expect(scene).toContain("gainValue: { color: '#3f8a4a'");
  });

  it('routes semantic management cues to their dedicated player', async () => {
    playManagementActionSfx('success');
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(29);
    expect(mockPlayers[13].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[13].play).toHaveBeenCalledTimes(1);
  });

  it('plays the positive cue on its own dedicated player', async () => {
    playPositiveSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(29);
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
    expect(celebration).toContain('export const SUPER_CELEBRATION_MS = 3400');
    expect(celebration).toContain('FIREWORK_DELAYS_MS');

    playSuperTrainingYaySfx();
    await Promise.resolve();
    expect(mockPlayers).toHaveLength(29);
    expect(mockPlayers[20].play).toHaveBeenCalledTimes(1);
  });

  it('runs the level-up jingle under the SUPER takeover and stops it when it goes', async () => {
    const sounds = readFileSync(join(process.cwd(), 'src/render/management-sfx.ts'), 'utf8');
    const celebration = readFileSync(
      join(process.cwd(), 'src/ui/components/SuperTrainingCelebration.tsx'),
      'utf8',
    );

    expect(sounds).toContain("'super-celebration': require('../../assets/audio/sfx/level-up.m4a')");
    // Started when the takeover appears, not when the result lands.
    expect(celebration).toContain('playSuperCelebrationSfx()');
    // Stopped where the takeover ends AND on teardown, so a 3.6s jingle never
    // rings on over the screen behind it.
    expect(celebration.match(/stopSuperCelebrationSfx\(\)/g)).toHaveLength(2);

    playSuperCelebrationSfx();
    await Promise.resolve();
    const jingle = mockPlayers[22];
    expect(jingle.seekTo).toHaveBeenCalledWith(0);
    expect(jingle.play).toHaveBeenCalledTimes(1);

    stopSuperCelebrationSfx();
    expect(jingle.pause).toHaveBeenCalledTimes(1);
    // The cheer that follows is its own cue, not a restart of the jingle.
    playSuperTrainingYaySfx();
    await Promise.resolve();
    expect(jingle.play).toHaveBeenCalledTimes(1);
  });

  it('plays every rapid stat-step tap on an independent voice', async () => {
    playStatStepSfx();
    playStatStepSfx();
    playStatStepSfx();
    playStatStepSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(29);
    const statStepPool = [mockPlayers[17], mockPlayers[26], mockPlayers[27], mockPlayers[28]];
    expect(statStepPool.every(player => player.seekTo.mock.calls.length === 1)).toBe(true);
    expect(statStepPool.every(player => player.play.mock.calls.length === 1)).toBe(true);

    // The fifth press wraps back onto the first voice. It rewinds again rather
    // than calling play() on a playhead that may be parked at the clip's end,
    // where the platform player would simply ignore it.
    playStatStepSfx();
    await Promise.resolve();
    expect(statStepPool[0].seekTo).toHaveBeenCalledWith(0);
    expect(statStepPool[0].play).toHaveBeenCalledTimes(2);
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
    expect(mockImpactAsync).toHaveBeenCalledTimes(5);
  });
});
