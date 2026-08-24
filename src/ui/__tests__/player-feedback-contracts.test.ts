import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../i18n';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('repeat-training presentation contract', () => {
  it('offers an affordable 1-9 wheel and resolves every queued drill separately', () => {
    const modal = source('src/ui/TrainingDrillModal.tsx');

    expect(modal).toContainSource(
      'maximumAffordableTrainingRuns(trainingPoints, pendingConfirm.tpCost)',
    );
    expect(modal).toContainSource('horizontal');
    expect(modal).toContainSource('snapToInterval={REPEAT_PICKER_CELL_WIDTH}');
    expect(modal).toContainSource('snapToAlignment="start"');
    expect(modal).not.toContainSource('repeatPickerWidth');
    expect(modal).toContainSource("t('trainingDrill.eachRunKeepsIts')");
    expect(loadCatalog('en').strings['trainingDrill.eachRunKeepsIts']).toBe(
      'Each run has its own SUPER roll (1.5x gain) and injury roll. An injury stops the remaining drills.',
    );
    expect(modal).toContainSource('batch.remaining > 0');
    expect(modal).toContainSource('onTrainDrill(playerId, nextBatch.pathId);');
  });

  it('lets a tapped number stand instead of reading it back off the scroll offset', () => {
    const modal = source('src/ui/TrainingDrillModal.tsx');

    // Tapping a number also scrolls the row to it, and on iOS a programmatic
    // animated scroll ends by firing onMomentumScrollEnd like any other.
    // Ungated, that event re-derived the count from wherever the row actually
    // stopped — and only about five cells fit the phone card, so every number
    // past those clamps short and the tapped "3" quietly became "2" a third of
    // a second later. Only the manager's own finger may move the selection.
    expect(modal).toContainSource('draggingRepeatRef.current = false;');
    expect(modal).toContainSource(
      'onScrollBeginDrag={() => { draggingRepeatRef.current = true; }}',
    );
    expect(modal).toContainSource('if (!draggingRepeatRef.current) return;');
  });

  it('names risky runs and offers all three requested safety choices', () => {
    const modal = source('src/ui/TrainingDrillModal.tsx');

    expect(modal).toContainSource(
      'riskyTrainingRunCount(condition, repeatCount)',
    );
    expect(
      loadCatalog('en').strings['trainingDrill.riskyRunsBody'],
    ).toContainSource('selected drills start below 30% condition');
    expect(loadCatalog('en').strings['trainingDrill.continueAnyway']).toBe(
      'Continue anyway · {count}×',
    );
    expect(modal).toContainSource("t('trainingDrill.continueMaxSafe'");
    expect(loadCatalog('en').strings['trainingDrill.continueMaxSafe']).toBe(
      'Continue with max safe · {count}×',
    );
    expect(modal).toContainSource(
      "t('trainingDrill.a11y.cancelAndReturnToTheNumberPicker')",
    );
    expect(
      loadCatalog('en').strings[
        'trainingDrill.a11y.cancelAndReturnToTheNumberPicker'
      ],
    ).toBe('Cancel and return to the number picker');
    expect(modal).toContainSource(
      'startTrainingBatch(pendingConfirm, saferRuns);',
    );
  });
});

describe('new power explanation contract', () => {
  it('explains the acquired power, then auto-plays it inside a real match', () => {
    const viewModels = source('src/application/view-models.ts');
    const awakening = source('src/ui/screens/AwakeningCutsceneScreen.tsx');
    const demo = source('src/ui/PowerAcquiredDemoModal.tsx');
    const match = source('src/render/MatchScreen.tsx');
    const showcase = source('src/render/power-match-showcase.ts');

    // The description still comes from `powers.json`; it is now read through
    // the catalog so a translated locale gets a translated sentence, with the
    // authored English as the fallback.
    expect(viewModels).toContainSource(
      'powerDescription: copyOrEnglish(t, `powerEffect.${powerSlug}.description`, power.description)',
    );
    expect(awakening).toContainSource("t('awakening.whatItDoes')");
    expect(awakening).toContainSource(
      'description={viewModel.powerDescription}',
    );
    expect(awakening).toContainSource('<PowerAcquiredDemoModal');
    // The button opens a scripted demo of the power, not the manager's own
    // match, so it says what it actually shows. It breathes in size on the
    // halo's own value, so the one thing left to tap is the one thing moving.
    expect(awakening).toContainSource("t('awakening.watchExample')");
    expect(awakening).toContainSource('onPress={() => setDemoVisible(true)}');
    expect(awakening).toContainSource('onPress={onContinue}');
    expect(awakening).toContainSource('style={styles.heroAction}');
    expect(awakening).toContainSource(
      'outputRange: reduceMotion ? [1, 1] : [1, CTA_PULSE_MAX_SCALE]',
    );
    expect(awakening).toContainSource(
      'style={[styles.ctaChip, { transform: [{ scale }] }]}',
    );
    expect(demo).toContainSource('<MatchScreen');
    expect(demo).toContainSource('powerMatchShowcaseHome(powerId, playerName)');
    expect(demo).toContainSource('onPowerShowcaseComplete');
    expect(demo).toContainSource("label={t('powerAcquiredDemo.replay')}");
    expect(loadCatalog('en').strings['powerAcquiredDemo.replay']).toBe(
      'REPLAY',
    );
    // Spelled out. "CONT" saved four characters on a button with a whole row to
    // itself, and read like a debug stub next to REPLAY.
    expect(demo).toContainSource("label={t('powerAcquiredDemo.continue')}");
    expect(loadCatalog('en').strings['powerAcquiredDemo.continue']).toBe(
      'CONTINUE',
    );
    // Each power's clip runs on the seed that makes its own promise land.
    expect(demo).toContainSource('seed={powerMatchShowcaseSeed(powerId)}');
    expect(demo).toContainSource('presentationOnly');
    expect(demo).toContainSource('zIndex: 10');
    expect(demo).toContainSource('elevation: 10');
    expect(match).toContainSource(
      "automaticPauseReasonsRef.current.add('showcase')",
    );
    // Opening the demo mounts the match once. Bumping the replay key here as
    // well remounted it immediately, and rebuilding every audio player twice in
    // one frame killed the iOS audio session.
    expect(demo).toMatchSource(
      /if \(!visible\) return;\n {4}setFrozen\(false\);\n {2}\}, \[powerId, visible\]\);/,
    );
    expect(demo).toContainSource('const replay = useCallback(() => {');
    expect(showcase).toContainSource(
      'POWER_MATCH_SHOWCASE_AUTO_FIRE_DELAY_TICKS = 15',
    );
    // The clip ends on the power's promise landing, not on a timer running out.
    expect(showcase).toContainSource(
      'export function powerMatchShowcaseSucceeded(',
    );
    expect(match).toContainSource(
      'powerMatchShowcaseSucceeded(s, powerMatchQa.power)',
    );
    // A goal restarts the kickoff in the tick it is scored, so those clips
    // freeze on the frame before it.
    expect(match).toContainSource('nextRef.current = before;');
  });
});

describe('story-event result contract', () => {
  it('gives risk a finished surface and clearly celebrates or rejects the bonus', () => {
    const screen = source('src/ui/screens/StoryEventScreen.tsx');
    const rewardArt = source('src/ui/components/EventRewardArt.tsx');
    const sprites = source('src/ui/event-pixel-sprites.ts');

    expect(screen).toContainSource(
      "choice.tone === 'risky' ? 'border-stamp bg-red-light'",
    );
    expect(screen).toContainSource("t('storyEvent.outcomeNoBonusThisTime')");
    expect(loadCatalog('en').strings['storyEvent.outcomeNoBonusThisTime']).toBe(
      'No bonus this time',
    );
    expect(screen).toContainSource("t('storyEvent.noBonusEarned')");
    expect(loadCatalog('en').strings['storyEvent.noBonusEarned']).toBe(
      'No bonus earned',
    );
    expect(screen).toContainSource('<EventRewardArt');
    expect(screen).toContainSource('<EventPixelConfetti');
    expect(rewardArt).toContainSource("fans: 'supporters'");
    expect(sprites).toContainSource('supporters: [');
  });

  it('plays the result cue once and gives Return to the Office a neutral tap', () => {
    const screen = source('src/ui/screens/StoryEventScreen.tsx');
    const resolvedResult = screen.slice(
      screen.indexOf('if (resolved) {'),
      screen.indexOf(
        '\n  return (\n    <SafeAreaView',
        screen.indexOf('if (resolved) {'),
      ),
    );

    expect(screen.match(/playEventSuccessSfx\(\)/g)).toHaveLength(1);
    expect(screen.match(/playManagementActionSfx\('warning'\)/g)).toHaveLength(
      1,
    );
    expect(resolvedResult).toContainSource('onPress={onContinue}');
    expect(resolvedResult).toContainSource('pressSfx="click"');
  });
});

describe('player-request money cost contract', () => {
  it('shows the exact negative cash amount beside a dollar-bills mark', () => {
    const card = source('src/ui/PlayerRequestDecisionCard.tsx');

    expect(card).toContainSource('request.grantMoneyCost');
    expect(card).toContainSource('>$$</PixelText>');
    expect(card).toContainSource("t('playerRequestCard.moneyCost'");
  });

  it('puts non-money downsides in a warning panel before the decision', () => {
    const card = source('src/ui/PlayerRequestDecisionCard.tsx');

    expect(card).toContainSource("t('playerRequestCard.downside'");
    expect(card).toContainSource('accessibilityLabel={grantDetail}');
    expect(card).toContainSource('>!</PixelText>');
  });
});

describe('match-speed contract', () => {
  it('offers every speed from the first match, with nothing to unlock', () => {
    const app = source('App.tsx');
    const match = source('src/render/MatchScreen.tsx');
    const rail = source('src/render/MatchControlRail.tsx');

    // No cap at the call site: MatchScreen's own default is the full set, so a
    // watched match opens with 1x, 2x and 3x all selectable in Season 1.
    expect(app).not.toContainSource('maximumSpeed=');
    expect(match).toContainSource('maximumSpeed = 3');
    // The season-3 unlock and Bert's briefing for it are gone together — a
    // celebration for something already available reads as a bug.
    expect(app).not.toContainSource('tripleSpeedIntroVisible');
    expect(app).not.toContainSource('3× match speed is now an option.');
    expect(app).toContainSource('pausedExternally={globalSettingsOpen}');
    // The cap still exists as a mechanism; the power demo caps itself at 1x.
    expect(match).toContainSource(
      'nextMatchSpeed(speed, effectiveMaximumSpeed)',
    );
    expect(rail).toContainSource('availableMatchSpeeds(maximumSpeed).map');
  });
});

/**
 * Every walk-on in the game speaks through this overlay — a signing arriving,
 * Bert briefing, a player making a request, an award winner on the rostrum.
 */
describe('speech bubble placement contract', () => {
  it('does not paint a bubble it has not measured yet', () => {
    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');

    // `onLayout` lands a frame or more after the bubble mounts, and until it
    // does the only placement available is the character's centre — four
    // fifths across, which on a 375pt phone leaves about 75pt and breaks the
    // line to roughly one word each. The fallback has to stay, because the
    // measuring pass needs somewhere to be; what must not happen is painting
    // it. `pop` starts at zero and hides it by accident, but `instant` sets
    // `pop` to 1 immediately and does not.
    expect(overlay).toContainSource(
      'if (bubbleWidth === 0) return characterCentre;',
    );
    expect(overlay).toContainSource('const bubbleMeasured = bubbleWidth > 0;');
    expect(overlay).toContainSource('opacity: bubbleMeasured ? pop : 0,');
  });

  it('never auto-advances a timed line while a screen reader is on or unknown', () => {
    const overlay = source('src/ui/CharacterSpeechOverlay.tsx');

    // VoiceOver reads slower than the character-count timers the callers
    // pass, so a timed line has to wait for a tap unless the screen reader is
    // known off. rivalHeroSpeechAutoExitMs applied this contract to one
    // surface; the overlay enforces it here once for every caller.
    expect(overlay).toContainSource(
      'const screenReaderEnabled = useScreenReaderEnabled();',
    );
    expect(overlay).toContainSource('screenReaderEnabled !== false ||');
  });
});
