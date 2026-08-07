import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match statement facility badges', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/components/FinancialStatement.tsx'),
    'utf8',
  );

  it('counts shops and stands from the first one', () => {
    // The shop line used to stay bare below two shops, so a manager with one
    // Fan Shop saw merchandise money with nothing naming where it came from.
    expect(source).toContain('if (reveal === undefined || reveal.facilityCount < 1) return null;');
    expect(source).not.toContain('if (reveal.multiplierTimes < 2) return null;');
    // The noun and its plural moved into the catalog; the count still drives
    // which form is spoken, and the separator stays in the source.
    expect(source).toContain('return ` · ${facilityCount(reveal, t)}`;');
    expect(source).toContain("? 'financialStatement.shopCount'");
    expect(source).toContain(": 'financialStatement.standCount'");
    expect(source).toContain('t(key, { n: reveal.facilityCount, count: reveal.facilityCount })');
  });

  it('puts the building beside its count', () => {
    expect(source).toContain("reveal!.source === 'merch' ? 'fan-shop' : 'stadium-stand'");
    // Level pips belong on the grounds map, not on a one-line ledger badge.
    expect(source).toContain('<FacilitySprite type={facilitySpriteFor(reveal)!} size={16} showLevel={false} />');
    // One sprite per row: the number already says how many.
    expect(source.match(/<FacilitySprite/g)).toHaveLength(1);
  });

  /**
   * The ×N chip used to ride beside the amount and the shop's adjacency was a
   * grey caption on the line below — so a club with one Fan Shop, whose only
   * bonus is the adjacency, read as having earned no bonus at all.
   */
  it('lands every bonus beside the sprite that earned it', () => {
    const groupStart = source.indexOf('<View className="min-w-0 flex-1 flex-row items-center">');
    const labelGroup = source.slice(groupStart, source.indexOf('<SlotAmount', groupStart));
    expect(labelGroup).toContain('<FacilitySprite');
    expect(labelGroup).toContain('<BonusBadge label={multiplierLabel(reveal!)}');
    expect(labelGroup).toContain('<BonusBadge label={`+${reveal.adjacencyPercent}%`}');
    // The caption below the row is gone, and with it its catalog key.
    expect(source).not.toContain('adjacencyCaption');
  });

  it('mounts each badge on its own beat so it animates in with the numbers', () => {
    // Mounted by the phase, not hidden by opacity: the entrance runs on mount.
    expect(source).toContain("&& ['chip', 'multiplied', 'adjacency', 'complete'].includes(runtime.phase)");
    expect(source).toContain("&& ['adjacency', 'complete'].includes(runtime.phase)");
    expect(source).toMatch(/function BonusBadge[\s\S]{0,700}Animated\.timing/);
  });

  it('speaks the same count it shows', () => {
    // The bare-amount branches used to drop the count entirely, so VoiceOver
    // announced a row that visibly read "1 shop" as just an amount.
    expect(source).toContain('const count = reveal.facilityCount >= 1');
    // Same phrase on screen and in the label: both go through facilityCount.
    expect(source).toContain('? `, ${facilityCount(reveal, t)}`');
    expect(source).toContain("t('financialStatement.a11y.rowAmount', {");
  });
});
