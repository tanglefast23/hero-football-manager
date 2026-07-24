import { readFileSync } from 'fs';
import { join } from 'path';

describe('training stat option rendering', () => {
  it('greys out unusable drills and shows the live gamble state', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/TrainingDrillModal.tsx'),
      'utf8',
    );

    // A drill is untappable when the player is injured, the stat sits at the
    // universal safety ceiling, or the bank cannot cover the cost — never
    // because of slots or caps, which no longer exist.
    expect(source).toContain('const disabled = injured || option.atSafetyCeiling || !option.affordable;');
    expect(source).toContain('{option.currentValue} {option.shortCode}');
    expect(source).not.toContain('{option.cap}');

    // The gamble is honest and visible: SUPER chance and the tap-time injury
    // risk both render in the popup header strip.
    expect(source).toContain('SUPER chance {superChancePercent}%');
    expect(source).toContain('{injuryRiskPercent}% injury risk');
  });
});
