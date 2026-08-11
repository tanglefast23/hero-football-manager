import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockPlayers: Array<{
  muted: boolean;
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
      muted: false,
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
  playDrillCompleteSfx,
  playDrillGainRevealSfx,
  playDrillProgressSfx,
  playEventSuccessSfx,
  playFacilityCompleteSfx,
  playFacilityStartSfx,
  playManagementActionSfx,
  playMatchDayCallSfx,
  playMatchControlSfx,
  playMatchStatementSfx,
  playPositiveSfx,
  prewarmManagementSfx,
  playStatStepSfx,
  playSuperCelebrationSfx,
  playSuperTrainingYaySfx,
  playTrainingStatDing,
  playTransactionConfirmSfx,
  playUiClickSfx,
  setManagementSfxMasterVolume,
  stopDrillProgressSfx,
  stopMatchDayCallSfx,
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

  it('stores initial volume without creating the catalog', () => {
    expect(mockPlayers).toHaveLength(0);

    setManagementSfxMasterVolume(0.5);

    expect(mockPlayers).toHaveLength(0);
  });

  it('prewarms the ordered catalog once and applies stored mute', () => {
    setManagementSfxMasterVolume(0);

    prewarmManagementSfx();
    prewarmManagementSfx();

    expect(mockPlayers).toHaveLength(34);
    expect(mockPlayers.every((player) => player.volume === 0)).toBe(true);
    expect(mockPlayers.every((player) => player.muted)).toBe(true);

    setManagementSfxMasterVolume(0.4);
    expect(mockPlayers[27].volume).toBeCloseTo(0.3);
    expect(
      mockPlayers
        .filter((_, index) => index !== 27)
        .every((player) => player.volume === 0.4),
    ).toBe(true);
    expect(mockPlayers.every((player) => !player.muted)).toBe(true);
  });

  it('restarts the supplied ding for each revealed stat', async () => {
    setManagementSfxMasterVolume(0.5);
    playTrainingStatDing();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
    const trainingDing = mockPlayers[1];
    expect(mockPlayers[27].volume).toBeCloseTo(0.375);
    expect(
      mockPlayers
        .filter((_, index) => index !== 27)
        .every((player) => player.volume === 0.5),
    ).toBe(true);
    expect(trainingDing.seekTo).toHaveBeenCalledWith(0);
    expect(trainingDing.play).toHaveBeenCalledTimes(1);

    playTrainingStatDing();
    await Promise.resolve();
    expect(trainingDing.play).toHaveBeenCalledTimes(2);
  });

  it('plays the positive synth independently when the statement appears', async () => {
    playMatchStatementSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
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

  it('uses the supplied work cue when facility construction starts', () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'facility-start': require('../../assets/audio/sfx/facility-start-work.wav')",
    );
  });

  it('answers a risky career event with the fanfare, and never with the old cheer', () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'event-success': require('../../assets/audio/sfx/event-success-fanfare.m4a')",
    );
    expect(sounds).toContainSource(
      "'super-celebration': require('../../assets/audio/sfx/level-up.m4a')",
    );
    // The crowd wash is gone from the catalog. Asserted on the require rather
    // than the file, because the comment above `event-success` still names the
    // sound it replaced — which is the point of the comment.
    expect(sounds).not.toContainSource(
      "require('../../assets/audio/sfx/crowd-cheer.wav')",
    );
  });

  /**
   * The two match-day calls are one cue with two sounds, and the split is the
   * competition — swapping them is a one-character edit here and inaudible in
   * any other test, so the mapping is pinned on both sides: the catalog's
   * assets, and the argument the card passes.
   */
  it('gives the league week the fanfare and the cup tie the bugle', async () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );
    const banner = readFileSync(
      join(process.cwd(), 'src/ui/components/MatchDayBanner.tsx'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'match-day-fanfare': require('../../assets/audio/sfx/match-day-fanfare.m4a')",
    );
    expect(sounds).toContainSource(
      "'match-day-bugle': require('../../assets/audio/sfx/match-day-bugle.m4a')",
    );
    expect(sounds).toContainSource(
      "playManagementSfx(isCup ? 'match-day-bugle' : 'match-day-fanfare')",
    );
    expect(banner).toContainSource('playMatchDayCallSfx(isCup)');

    playMatchDayCallSfx(false);
    await Promise.resolve();
    expect(mockPlayers).toHaveLength(34);
    // 'match-day-fanfare' is appended last, so it owns the final catalog slot;
    // the bugle keeps the slot before it.
    expect(mockPlayers[25].play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[23].play).not.toHaveBeenCalled();

    playMatchDayCallSfx(true);
    await Promise.resolve();
    expect(mockPlayers[23].play).toHaveBeenCalledTimes(1);

    // Either call is stoppable: the card can leave before the sound ends.
    stopMatchDayCallSfx();
    expect(mockPlayers[25].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[23].pause).toHaveBeenCalledTimes(1);
  });

  it('gives rapid neutral button presses independent voices too', async () => {
    playUiClickSfx();
    playUiClickSfx();
    playUiClickSfx();
    playUiClickSfx();
    await Promise.resolve();

    const uiClickPool = [
      mockPlayers[2],
      mockPlayers[28],
      mockPlayers[29],
      mockPlayers[30],
    ];
    // One press, one rewind, one play — on a voice of its own, so four quick
    // presses never share a playhead.
    expect(
      uiClickPool.every((player) => player.seekTo.mock.calls.length === 1),
    ).toBe(true);
    expect(
      uiClickPool.every((player) => player.play.mock.calls.length === 1),
    ).toBe(true);
    expect(mockImpactAsync).toHaveBeenCalledTimes(4);
  });

  it('plays the supplied three-layer live-match cue once without borrowing the generic click', async () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'match-control': require('../../assets/audio/sfx/match-control-whistle.wav')",
    );

    playMatchControlSfx();
    await Promise.resolve();

    const matchControl = mockPlayers[26];
    expect(matchControl.seekTo).toHaveBeenCalledTimes(1);
    expect(matchControl.seekTo).toHaveBeenCalledWith(0);
    expect(matchControl.play).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].play).not.toHaveBeenCalled();
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
  });

  it('gives small interactions an audible click and large action buttons the confirmation', () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );
    const buttons = readFileSync(
      join(process.cwd(), 'src/ui/components/Scorecard.tsx'),
      'utf8',
    );

    // A press on the screen answers with the supplied tap, whichever of the two
    // generic cue names the caller reaches for; steppers keep the lighter tap.
    // Neither borrows headroom from the music.
    expect(sounds).toContainSource(
      "'ui-click': require('../../assets/audio/sfx/ui-tap.wav')",
    );
    expect(sounds).toContainSource(
      "select: require('../../assets/audio/sfx/ui-tap.wav')",
    );
    expect(sounds).toContainSource(
      "'stat-step': require('../../assets/audio/sfx/stat-step-tap-loud.m4a')",
    );
    expect(sounds).toContainSource(
      "positive: require('../../assets/audio/sfx/positive.m4a')",
    );
    // Large buttons still confirm by default, but the variant can speak for
    // itself: a destructive one answers with the back-button cue (dismissing a
    // coach or erasing a save used to be applauded by the chime that celebrates
    // a signing), and a neutral paper one — cancel, back, pass, decline — only
    // clicks, so a refusal never sounds like a win.
    expect(sounds).toContainSource(
      "danger: require('../../assets/audio/sfx/back-button.m4a')",
    );
    expect(buttons).toContainSource(
      "const cue = pressSfx\n    ?? (variant === 'danger' ? 'danger' : variant === 'paper' ? 'click' : 'positive');",
    );
  });

  it('keeps the drill progress bed stoppable and the reveal on its own player', async () => {
    playDrillProgressSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
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

  it('plays the supplied drill-complete cue once at three-quarter gain', async () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );
    const modal = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'drill-complete': require('../../assets/audio/sfx/drill-complete-heavy.wav')",
    );
    expect(sounds).toContainSource('const DRILL_COMPLETE_GAIN = 0.75');
    expect(modal).toContainSource(
      'streakRef.current += 1;\n    playDrillCompleteSfx();\n    if (result.isSuper)',
    );

    playDrillCompleteSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
    const completion = mockPlayers[27];
    expect(completion.volume).toBeCloseTo(0.75);
    expect(completion.seekTo).toHaveBeenCalledWith(0);
    expect(completion.play).toHaveBeenCalledTimes(1);

    setManagementSfxMasterVolume(0.4);
    expect(completion.volume).toBeCloseTo(0.3);
  });

  it('ties the progress bed to the count-up inside the drill scene', () => {
    const scene = readFileSync(
      join(process.cwd(), 'src/render/DrillSceneOverlay.tsx'),
      'utf8',
    );

    expect(scene).toContainSource('playDrillProgressSfx()');
    // Stopped where the number lands AND on teardown, so a skipped scene is silent.
    expect(scene.match(/stopDrillProgressSfx\(\)/g)).toHaveLength(2);
    // The number itself is green; the duplicate inline "+N" stamp is gone
    // because the following full-screen takeover owns the gain.
    expect(scene).not.toContainSource('countLanded');
    expect(scene).not.toContainSource('gainDelta');
    expect(scene).toContainSource("gainValue: { color: '#3f8a4a'");
  });

  it('routes semantic management cues to their dedicated player', async () => {
    playManagementActionSfx('success');
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
    expect(mockPlayers[13].seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayers[13].play).toHaveBeenCalledTimes(1);
  });

  it('plays the positive cue on its own dedicated player', async () => {
    playPositiveSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
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
    expect(celebration).toContainSource('playSuperTrainingYaySfx()');
    expect(celebration).toContainSource(
      'export const SUPER_CELEBRATION_MS = drillPresentationMs(3_400)',
    );
    expect(celebration).toContainSource('FIREWORK_DELAYS_MS');

    playSuperTrainingYaySfx();
    await Promise.resolve();
    expect(mockPlayers).toHaveLength(34);
    expect(mockPlayers[20].play).toHaveBeenCalledTimes(1);
  });

  it('runs the level-up jingle under the SUPER takeover and stops it when it goes', async () => {
    const sounds = readFileSync(
      join(process.cwd(), 'src/render/management-sfx.ts'),
      'utf8',
    );
    const celebration = readFileSync(
      join(process.cwd(), 'src/ui/components/SuperTrainingCelebration.tsx'),
      'utf8',
    );

    expect(sounds).toContainSource(
      "'super-celebration': require('../../assets/audio/sfx/level-up.m4a')",
    );
    // Started when the takeover appears, not when the result lands.
    expect(celebration).toContainSource('playSuperCelebrationSfx()');
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

  it('rebuilds the catalog and replays the cue when the audio session dies', async () => {
    // iOS kills the session server while backgrounded: the next native call
    // rejects and the old player can never play again.
    prewarmManagementSfx();
    mockPlayers[16].seekTo.mockImplementation(() =>
      Promise.reject(new Error('Session lookup failed')),
    );

    playPositiveSfx();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Same catalog rebuilt in the same order — every index above stays valid.
    expect(mockPlayers).toHaveLength(68);
    expect(mockPlayers[16].release).toHaveBeenCalledTimes(1);
    const rebuiltPositive = mockPlayers[34 + 16];
    expect(rebuiltPositive.seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    expect(rebuiltPositive.play).toHaveBeenCalledTimes(1);
  });

  it('recovers a dead rapid voice and replays the tap on the rebuilt pool', async () => {
    prewarmManagementSfx();
    mockPlayers[2].seekTo.mockImplementation(() =>
      Promise.reject(new Error('Unable to find the native shared object')),
    );

    playUiClickSfx();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(68);
    // The rebuilt pool starts from a fresh cursor, so the retry lands on the
    // rebuilt catalog's own ui-click voice.
    const rebuiltUiClick = mockPlayers[34 + 2];
    expect(rebuiltUiClick.seekTo).toHaveBeenCalledWith(0);
    await Promise.resolve();
    expect(rebuiltUiClick.play).toHaveBeenCalledTimes(1);
  });

  it('plays every rapid stat-step tap on an independent voice', async () => {
    playStatStepSfx();
    playStatStepSfx();
    playStatStepSfx();
    playStatStepSfx();
    await Promise.resolve();

    expect(mockPlayers).toHaveLength(34);
    const statStepPool = [
      mockPlayers[17],
      mockPlayers[31],
      mockPlayers[32],
      mockPlayers[33],
    ];
    expect(
      statStepPool.every((player) => player.seekTo.mock.calls.length === 1),
    ).toBe(true);
    expect(
      statStepPool.every((player) => player.play.mock.calls.length === 1),
    ).toBe(true);

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
