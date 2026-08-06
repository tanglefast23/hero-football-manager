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
    expect(source).toContain("` · ${reveal.facilityCount} shop${reveal.facilityCount === 1 ? '' : 's'}`");
    expect(source).toContain("` · ${reveal.facilityCount} stand${reveal.facilityCount === 1 ? '' : 's'}`");
  });

  it('puts the building beside its count', () => {
    expect(source).toContain("reveal!.source === 'merch' ? 'fan-shop' : 'stadium-stand'");
    // Level pips belong on the grounds map, not on a one-line ledger badge.
    expect(source).toContain('<FacilitySprite type={facilitySpriteFor(reveal)!} size={16} showLevel={false} />');
    // One sprite per row: the number already says how many.
    expect(source.match(/<FacilitySprite/g)).toHaveLength(1);
  });

  it('speaks the same count it shows', () => {
    // The bare-amount branches used to drop the count entirely, so VoiceOver
    // announced a row that visibly read "1 shop" as just an amount.
    expect(source).toContain('const count = reveal.facilityCount >= 1');
    expect(source).toContain('${line.label}${count}, ${sign}${money(line.amount)}.${surgeNote}');
  });
});
