import { readFileSync } from 'fs';
import { join } from 'path';
import { loadCatalog } from '../../i18n';

describe('training stat option rendering', () => {
  it('keeps the drill modal out of the normal first-load bundle', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
      'utf8',
    );

    expect(screen).toContainSource(
      "import { LazyTrainingDrillModal as TrainingDrillModal, preloadTrainingDrillModal } from '../LazyTrainingDrillModal';",
    );
    // Deferred, but fetched as soon as the roster is up: the popup must never
    // make the manager wait for a download after pressing +.
    expect(screen).toContainSource('void preloadTrainingDrillModal();');
    expect(screen).toContainSource('<Suspense fallback={null}>');
    expect(screen).not.toContainSource(
      "import { TrainingDrillModal } from '../TrainingDrillModal';",
    );

    const boundary = readFileSync(
      join(process.cwd(), 'src/ui/LazyTrainingDrillModal.tsx'),
      'utf8',
    );
    expect(boundary).toContainSource(
      "const module = await import('./SkiaSurfaceImplementations');",
    );
  });

  it('greys out unusable drills and shows the live gamble state', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    // A drill is untappable when the player is injured, someone else is owed
    // drills, or the stat sits at the universal safety ceiling — never because of
    // slots or caps, which no longer exist.
    expect(source).toContainSource(
      'const blocked = injured || blockedByPromise || option.atSafetyCeiling;',
    );
    expect(source).toContainSource('const disabled = blocked;');
    // Too little TP is different: the row stays tappable and says so, because a
    // button that does nothing reads as broken.
    expect(source).toContainSource(
      'const unaffordable = !blocked && !option.affordable;',
    );
    expect(source).toContainSource("title: t('trainingDrill.notEnoughTp')");
    expect(source).toContainSource('setNotice(null)');
    // Greyed the same either way.
    expect(source).toContainSource('className={disabled || unaffordable');
    // A promised player's owed drills block everyone else with their reminder.
    expect(
      loadCatalog('en').strings['trainingDrill.remindsYou'],
    ).toContainSource('reminds you');
    expect(source).toContainSource(
      "t('trainingDrill.trainInstead', { player: promiseGate.playerName })",
    );
    expect(loadCatalog('en').strings['trainingDrill.trainInstead']).toBe(
      'Train {player} instead',
    );
    expect(source).toContainSource('{option.currentValue} {option.shortCode}');
    expect(source).not.toContainSource('{option.cap}');

    // The gamble is honest and visible: SUPER chance and the tap-time injury
    // risk both render in the popup header strip.
    expect(source).toContainSource(
      "t('trainingDrill.superChancePercent', { percent: superChancePercent })",
    );
    expect(loadCatalog('en').strings['trainingDrill.superChancePercent']).toBe(
      'SUPER chance {percent}%',
    );
    expect(source).toContainSource(
      "t('trainingDrill.injuryRiskPercent', { percent: injuryRiskPercent })",
    );
    expect(loadCatalog('en').strings['trainingDrill.injuryRiskPercent']).toBe(
      '{percent}% injury risk',
    );

    // Confirmation presents both parts as net changes: the authored +5 first,
    // then why this particular player can receive more (or less).
    expect(source).toContainSource(
      "t('trainingDrill.basePerDrill', { label: pendingConfirm.label })",
    );
    expect(loadCatalog('en').strings['trainingDrill.basePerDrill']).toBe(
      'Base {label} / drill',
    );
    expect(source).toContainSource(
      'pendingConfirm.baseValueAfter - pendingConfirm.currentValue',
    );
    expect(source).not.toContainSource(
      '{pendingConfirm.currentValue} → {pendingConfirm.baseValueAfter}',
    );
    // The second box is the net difference the modifiers make, signed — a number
    // to add to the line above, not a total standing in its place. Printing a
    // result there made "+4" then "+3" scan as +7.
    expect(source).toContainSource(
      "{pendingConfirm.trainingAdjustment >= 0 ? '+' : ''}",
    );
    expect(source).toContainSource("{t('trainingDrill.bonus')}{' '}");
    expect(loadCatalog('en').strings['trainingDrill.bonus']).toBe('Bonus:');
    expect(source).toContainSource(
      'pendingConfirm.trainingAdjustment !== 0',
    );
    expect(source).toContainSource(
      "t('trainingDrill.ordinaryBatchEstimate')",
    );
    expect(source).toContainSource('~+{ordinaryBatchEstimate}');
    expect(
      loadCatalog('en').strings['trainingDrill.ordinaryBatchEstimate'],
    ).toBe('Approx. ordinary total');
    expect(source).toContainSource(
      "t('trainingDrill.superGuaranteedInBatch')",
    );
    expect(loadCatalog('en').strings['trainingDrill.superGuaranteed']).toBe(
      'SUPER guaranteed',
    );
    expect(loadCatalog('en').strings['trainingDrill.eachRunKeepsIts']).toBe(
      'Each run has its own SUPER roll (1.5x gain) and injury roll. An injury stops the remaining drills.',
    );
    // Whole scores stay equal to the match engine. A separate one-decimal bank
    // shows the saved fraction, floored so 0.97 never promises a paid-out 1.0.
    expect(source).toContainSource('Math.floor(bank.hundredths / 10) / 10');
    expect(source).toContainSource('/ 1.0');
    expect(
      loadCatalog('en').strings['trainingDrill.fractionalGainsSaved'],
    ).toBe(
      'Fractional gains from bonuses are saved. Each full 1.0 adds +1 to a later drill.',
    );
    // Only the modifier that costs wears a colour. Marking the bonuses green as
    // well emphasised every word — which emphasises nothing — and forced a
    // green-on-red pairing that measured 1.9:1 against the 4.5:1 text needs.
    // Ink on the tinted box is 10.8:1; the red exception is 4.4:1.
    expect(source).toContainSource(
      "modifier.helps ? 'text-ink' : 'text-red-dark'",
    );
    expect(source).not.toContainSource("modifier.helps ? 'text-pitch-ink'");
    // The box takes the colour of the net, as a tint rather than the full
    // colour, so the label has somewhere legible to sit.
    expect(source).toContainSource('border-red-dark bg-red-light/40 px-3 py-2');
    expect(source).toContainSource(
      'border-pitch-dark bg-pitch-light/40 px-3 py-2',
    );
    // Gold is gone. A drag is a drag; amber read as neither.
    expect(source).not.toContainSource(
      'border-gold-dark bg-gold-light px-3 py-2',
    );
    // An outside tap cancels the popup with the supplied negative cue. The
    // visible Cancel button keeps its ordinary click because it names itself.
    expect(source).toMatchSource(
      /accessible=\{false\}\n\s+pressSfx="warning"\n\s+onPress=\{\(\) => setPendingConfirm\(null\)\}/,
    );
  });
});
