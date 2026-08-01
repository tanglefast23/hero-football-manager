import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('repeat-training presentation contract', () => {
  it('offers an affordable 1-9 wheel and resolves every queued drill separately', () => {
    const modal = source('src/ui/TrainingDrillModal.tsx');

    expect(modal).toContain('maximumAffordableTrainingRuns(trainingPoints, pendingConfirm.tpCost)');
    expect(modal).toContain('horizontal');
    expect(modal).toContain('snapToInterval={REPEAT_PICKER_CELL_WIDTH}');
    expect(modal).toContain('snapToAlignment="start"');
    expect(modal).not.toContain('repeatPickerWidth');
    expect(modal).toContain('Each run keeps its own SUPER roll, injury roll and result reveal.');
    expect(modal).toContain('batch.remaining > 0');
    expect(modal).toContain('onTrainDrill(playerId, nextBatch.pathId);');
  });

  it('names risky runs and offers all three requested safety choices', () => {
    const modal = source('src/ui/TrainingDrillModal.tsx');

    expect(modal).toContain('riskyTrainingRunCount(condition, repeatCount)');
    expect(modal).toContain('selected drills start below 30% condition');
    expect(modal).toContain('Continue anyway · {repeatCount}×');
    expect(modal).toContain('Continue with max safe · ${Math.min(repeatCount, maximumSafeRuns)}×');
    expect(modal).toContain('Cancel and return to the number picker');
    expect(modal).toContain('startTrainingBatch(pendingConfirm, saferRuns);');
  });
});

describe('new power explanation contract', () => {
  it('explains the acquired power, then auto-plays it inside a real match', () => {
    const viewModels = source('src/application/view-models.ts');
    const awakening = source('src/ui/screens/AwakeningCutsceneScreen.tsx');
    const demo = source('src/ui/PowerAcquiredDemoModal.tsx');
    const match = source('src/render/MatchScreen.tsx');
    const showcase = source('src/render/power-match-showcase.ts');

    expect(viewModels).toContain('powerDescription: power.description');
    expect(awakening).toContain('WHAT IT DOES');
    expect(awakening).toContain('description={viewModel.powerDescription}');
    expect(awakening).toContain('<PowerAcquiredDemoModal');
    expect(awakening).toContain('WATCH IN MATCH');
    expect(demo).toContain('<MatchScreen');
    expect(demo).toContain('powerMatchShowcaseHome(powerId, playerName)');
    expect(demo).toContain('onPowerShowcaseComplete');
    expect(demo).toContain('label="REPLAY"');
    expect(demo).toContain('label="CONT"');
    expect(demo).toContain('presentationOnly');
    expect(demo).toContain('zIndex: 10');
    expect(demo).toContain('elevation: 10');
    expect(match).toContain("automaticPauseReasonsRef.current.add('showcase')");
    // Opening the demo mounts the match once. Bumping the replay key here as
    // well remounted it immediately, and rebuilding every audio player twice in
    // one frame killed the iOS audio session.
    expect(demo).toMatch(
      /if \(!visible\) return;\n {4}setFrozen\(false\);\n {2}\}, \[powerId, visible\]\);/,
    );
    expect(demo).toContain('const replay = useCallback(() => {');
    expect(showcase).toContain('POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS = 15');
    expect(showcase).toContain('POWER_MATCH_SHOWCASE_POST_POWER_FREEZE_MS = 1000');
  });
});

describe('story-event result contract', () => {
  it('gives risk a finished surface and clearly celebrates or rejects the bonus', () => {
    const screen = source('src/ui/screens/StoryEventScreen.tsx');
    const rewardArt = source('src/ui/components/EventRewardArt.tsx');
    const sprites = source('src/ui/event-pixel-sprites.ts');

    expect(screen).toContain("choice.tone === 'risky' ? 'border-stamp bg-red-light'");
    expect(screen).toContain('No bonus this time');
    expect(screen).toContain('No bonus earned');
    expect(screen).toContain('<EventRewardArt');
    expect(screen).toContain('<EventPixelConfetti');
    expect(rewardArt).toContain("fans: 'supporters'");
    expect(sprites).toContain('supporters: [');
  });
});

describe('veteran match-speed contract', () => {
  it('keeps 3x out of Seasons 1-2 and introduces it once through Bert in Season 3', () => {
    const app = source('App.tsx');
    const match = source('src/render/MatchScreen.tsx');
    const rail = source('src/render/MatchControlRail.tsx');

    expect(app).toContain('store.career.season >= 3');
    expect(app).toContain('maximumSpeed={store.career.season >= 3 ? 3 : 2}');
    expect(app).toContain('pausedExternally={globalSettingsOpen || tripleSpeedIntroVisible}');
    expect(app).toContain('3× match speed is now an option.');
    expect(app).toContain('You’re a veteran coach now');
    expect(match).toContain('nextMatchSpeed(speed, maximumSpeed)');
    expect(rail).toContain('availableMatchSpeeds(maximumSpeed).map');
  });
});
