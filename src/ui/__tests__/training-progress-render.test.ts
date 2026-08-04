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
    // The second box is the net difference the modifiers make, signed — a number
    // to add to the line above, not a total standing in its place. Printing a
    // result there made "+4" then "+3" scan as +7.
    expect(source).toContain("{pendingConfirm.trainingAdjustment >= 0 ? '+' : ''}");
    // Each name coloured by its own direction, because the row mixes them:
    // "Veteran + GK + Prodigy" is one modifier that costs and two that pay, and
    // one colour across the row cannot say which is which.
    expect(source).toContain("modifier.helps ? 'text-pitch-dark' : 'text-red-dark'");
    // The box takes the colour of the net, so the summary and the detail may
    // disagree — a veteran with good archetypes is a red box with green names.
    expect(source).toContain('border-red-dark bg-red-light px-3 py-2');
    // Gold is gone. A drag is a drag; amber read as neither.
    expect(source).not.toContain('border-gold-dark bg-gold-light px-3 py-2');
  });
});
