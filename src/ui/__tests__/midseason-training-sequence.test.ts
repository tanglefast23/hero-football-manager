import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8');

describe('Week 19 team training presentation', () => {
  it('greys out Green Bull after individual training and explains the weekly lock', () => {
    const catalog = JSON.parse(source('content/i18n/en.json')) as {
      strings: Record<string, string>;
    };
    const squad = source('src/ui/screens/SquadTrainingScreen.tsx');

    expect(
      catalog.strings['greenBullTraining.individualTrainingUsed'],
    ).toBe('Individual training already used · available next week');
    expect(catalog.strings['greenBullTraining.requirement']).toContain(
      'Book before individual drills.',
    );
    expect(squad).toContainSource(
      "offer.blockedReason === 'INDIVIDUAL_TRAINING_USED'",
    );
    expect(squad).toContainSource(
      "t('greenBullTraining.individualTrainingUsed')",
    );
    expect(squad).toContainSource(
      'accessibilityState={{ disabled: blockedLabel !== undefined }}',
    );
  });

  it('keeps the requested English captain line and TP question exact', () => {
    const catalog = JSON.parse(source('content/i18n/en.json')) as {
      strings: Record<string, string>;
    };

    expect(catalog.strings['midseasonTraining.captainLine']).toBe(
      "Boss, can we take a mid season trip Green Bull Sports Star Performance Center? Let's get the team strong!",
    );
    expect(catalog.strings['midseasonTraining.spendAllTp']).toBe(
      'Spend {tp} TP to train your team? Every player also loses {condition} condition.',
    );
  });

  it('routes the production prompt and accepted celebration through App', () => {
    const app = source('App.tsx');

    expect(app).toContainSource("midseasonStatus !== 'prompt'");
    expect(app).toContainSource("setMidseasonTrainingStage('walk-on');");
    expect(app).toContainSource('<MidseasonTrainingCaptainWalkOn');
    expect(app).toContainSource('<MidseasonTrainingDecisionCard');
    expect(app).toContainSource('store.acceptMidseasonTraining();');
    expect(app).toContainSource('<MidseasonTrainingCelebrationScreen');
    expect(app).toContainSource('onContinue={store.completeMidseasonTraining}');
  });

  it('uses the captain sprite, visible armband, exact prompt, and Yes/No actions', () => {
    const prompt = source('src/ui/MidseasonTrainingPrompt.tsx');

    expect(prompt).toContainSource('<PlayerRunSprite');
    expect(prompt).toContainSource('styles.armbandOutline');
    expect(prompt).toContainSource("t('midseasonTraining.captainLine')");
    expect(prompt).toContainSource("t('midseasonTraining.spendAllTp', {");
    expect(prompt).toContainSource("t('midseasonTraining.no')");
    expect(prompt).toContainSource("t('midseasonTraining.yes')");
  });

  it('draws the whole squad in one atlas with the requested training effects', () => {
    const celebration = source(
      'src/ui/screens/MidseasonTrainingCelebrationScreen.tsx',
    );

    expect(celebration).toContainSource('<Atlas');
    expect(celebration).toContainSource('ROLE_ORDER.map((role, index)');
    expect(celebration).toContainSource('playDrillProgressSfx();');
    expect(celebration).toContainSource('playDrillCompleteSfx();');
    expect(celebration).toContainSource('playMidseasonFootstepsSfx();');
    expect(celebration).toContainSource(
      'setTimeout(playTrainingStatDing, 700)',
    );
    expect(celebration).toContainSource('setTimeout(playPositiveSfx, 1_550)');
    expect(celebration).toContainSource(
      'setTimeout(playSuperTrainingYaySfx, 2_800)',
    );
    expect(celebration).toContainSource('<GreenBullPixelMark />');
    expect(celebration).toContainSource('<Firework');
    expect(celebration).toContainSource('styles.confetti');
    expect(celebration).toContainSource('styles.plus');
    expect(celebration).toContain('+{viewModel.statGain}');
    expect(celebration).toContainSource('antiAlias={false}');
  });

  it('makes the first tap finish motion and the next tap return Home', () => {
    const celebration = source(
      'src/ui/screens/MidseasonTrainingCelebrationScreen.tsx',
    );

    expect(celebration).toContainSource(
      'if (!finishedRef.current) finishAnimation(); else continueOnce();',
    );
    expect(celebration).toContainSource('setFinished(true);');
    expect(celebration).toContainSource("t('midseasonTraining.continue')");
    expect(celebration).toContainSource('onPress={continueOnce}');
    expect(celebration).toContainSource('stopMidseasonFootstepsSfx();');
    expect(celebration).toContainSource('stopDrillCompleteSfx();');
  });

  it('uses two hard close-up cuts and the shared two-column footer width', () => {
    const celebration = source(
      'src/ui/screens/MidseasonTrainingCelebrationScreen.tsx',
    );

    expect(celebration).toContainSource(
      "setTimeout(() => setCameraShot('forwards'), 700)",
    );
    expect(celebration).toContainSource(
      "setTimeout(() => setCameraShot('defenders'), 2_100)",
    );
    expect(celebration).toContainSource(
      'const closeScale = width >= 900 ? 5 : 3;',
    );
    expect(celebration).toContainSource("setCameraShot('wide');");
    expect(celebration).not.toContainSource('cameraProgress');
    expect(celebration).toContainSource('maxWidth: DESKTOP_CONTENT_MAX_WIDTH');
  });

  it('registers D5 and D1 production-backed full flows in the Dev Harness', () => {
    const entry = source('src/ui/dev-harness/entries/midseason-training.tsx');
    const registry = source('src/ui/dev-harness/registry.ts');

    expect(entry).toContainSource("id: 'midseason-training'");
    expect(entry).toContainSource("id: 'd5'");
    expect(entry).toContainSource("id: 'd1'");
    expect(entry).toContainSource('acceptMidseasonTraining(career)');
    expect(registry).toContainSource('midseasonTrainingEntry');
  });
});
