import { readFileSync } from 'fs';
import { join } from 'path';

describe('training stat option rendering', () => {
  it('greys out unusable drills and shows the live gamble state', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    // A drill is untappable when the player is injured, someone else is owed
    // drills, or the stat sits at the universal safety ceiling — never because of
    // slots or caps, which no longer exist.
    expect(source).toContain('const blocked = injured || blockedByPromise || option.atSafetyCeiling;');
    expect(source).toContain('const disabled = blocked;');
    // Too little TP is different: the row stays tappable and says so, because a
    // button that does nothing reads as broken.
    expect(source).toContain('const unaffordable = !blocked && !option.affordable;');
    expect(source).toContain("title: 'Not enough TP'");
    expect(source).toContain('setNotice(null)');
    // Greyed the same either way.
    expect(source).toContain('className={disabled || unaffordable');
    // A promised player's owed drills block everyone else with their reminder.
    expect(source).toContain('reminds you');
    expect(source).toContain('Train {promiseGate.playerName} instead');
    expect(source).toContain('{option.currentValue} {option.shortCode}');
    expect(source).not.toContain('{option.cap}');

    // The gamble is honest and visible: SUPER chance and the tap-time injury
    // risk both render in the popup header strip.
    expect(source).toContain('SUPER chance {superChancePercent}%');
    expect(source).toContain('{injuryRiskPercent}% injury risk');

    // Confirmation presents both parts as net changes: the authored +5 first,
    // then why this particular player can receive more (or less).
    expect(source).toContain('Base {pendingConfirm.label}');
    expect(source).toContain(
      'pendingConfirm.baseValueAfter - pendingConfirm.currentValue',
    );
    expect(source).not.toContain(
      '{pendingConfirm.currentValue} → {pendingConfirm.baseValueAfter}',
    );
    expect(source).toContain("pendingConfirm.trainingModifierLabels.join(' + ')");
    expect(source).toContain('pendingConfirm.trainingAdjustment');
  });
});
