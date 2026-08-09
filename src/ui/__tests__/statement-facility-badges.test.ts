import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match statement facility badges', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/components/FinancialStatement.tsx'),
    'utf8',
  );
  const strip = readFileSync(
    join(process.cwd(), 'src/ui/components/LedgerRowIcons.tsx'),
    'utf8',
  );

  it('counts shops and stands from the first one', () => {
    // The shop line used to stay bare below two shops, so a manager with one
    // Fan Shop saw merchandise money with nothing naming where it came from.
    expect(source).not.toContainSource(
      'if (reveal.multiplierTimes < 2) return null;',
    );
    // The noun and its plural live in the catalog; the count drives the form.
    expect(source).toContainSource("? 'financialStatement.shopCount'");
    expect(source).toContainSource(": 'financialStatement.standCount'");
    expect(source).toContainSource(
      't(key, { n: reveal.facilityCount, count: reveal.facilityCount })',
    );
  });

  it('prints the count once, as icons', () => {
    // "· 3 shops" beside a `🏪×3` badge said the same thing twice. The words
    // came off the screen; nothing else may put them back.
    expect(source).not.toContainSource('suffixFor');
    expect(source).not.toContainSource('` · ${');
  });

  it('keeps the building with its count instead of the amount', () => {
    // A single label Text plus a floating sprite pinned the building to the
    // right edge as soon as the label wrapped, where it read as part of the
    // money. Label, count, and icons are now siblings in one wrapping run.
    expect(source).toContainSource('flex-1 flex-row flex-wrap items-center');
    expect(source).toContainSource(
      '{line.icons === undefined ? null : (<LedgerRowIcons icons={line.icons} />)}',
    );
    // The statement no longer picks a sprite of its own: every row's pictures
    // come from the view model, so both statements draw the same thing.
    expect(source).not.toContainSource('facilitySpriteFor');
    expect(source).not.toContainSource('<FacilitySprite');
  });

  it('draws one sprite per group and counts the rest', () => {
    // Level pips belong on the grounds map, not on a one-line ledger badge.
    expect(strip).toContainSource(
      '<FacilitySprite type={icon.facility} size={ICON_SIZE} showLevel={false} />',
    );
    // Identical things collapse to `×N`; only differing icons repeat.
    expect(strip).toContainSource('icon.count !== undefined && icon.count > 1');
    expect(strip).toContainSource('×{icon.count}');
    // A trailing `+N` must not sit flush against the amount column.
    expect(strip).toContainSource('mr-3');
  });

  /**
   * The ×N chip used to ride beside the amount and the shop's adjacency was a
   * grey caption on the line below — so a club with one Fan Shop, whose only
   * bonus is the adjacency, read as having earned no bonus at all.
   */
  it('lands every bonus in the run with the buildings that earned it', () => {
    const groupStart = source.indexOf(
      '<View className="min-w-0 flex-1 flex-row flex-wrap items-center">',
    );
    const labelGroup = source.slice(
      groupStart,
      source.indexOf('<SlotAmount', groupStart),
    );
    expect(labelGroup).toContainSource('<LedgerRowIcons');
    expect(labelGroup).toContainSource(
      '<BonusBadge label={multiplierLabel(reveal!)}',
    );
    expect(labelGroup).toContainSource(
      '<BonusBadge label={`+${reveal.adjacencyPercent}%`}',
    );
    // The caption below the row is gone, and with it its catalog key.
    expect(source).not.toContainSource('adjacencyCaption');
  });

  it('states both multipliers in percent', () => {
    // "×3" beside "×200%" read as two kinds of arithmetic, and left the shop
    // on the larger multiple looking like the smaller number.
    expect(source).toContainSource('`×${reveal.multiplierTimes * 100}%`');
    expect(source).toContainSource('`×${reveal.multiplierPercent}%`');
  });

  it('mounts each badge on its own beat so it animates in with the numbers', () => {
    // Mounted by the phase, not hidden by opacity: the entrance runs on mount.
    expect(source).toContainSource(
      "&& ['chip', 'multiplied', 'adjacency', 'complete'].includes(runtime.phase)",
    );
    expect(source).toContainSource(
      "&& ['adjacency', 'complete'].includes(runtime.phase)",
    );
    expect(source).toMatchSource(
      /function BonusBadge[\s\S]{0,700}Animated\.timing/,
    );
  });

  it('speaks the same count it shows', () => {
    // The bare-amount branches used to drop the count entirely, so VoiceOver
    // announced a row that visibly read "1 shop" as just an amount.
    expect(source).toContainSource('const count = reveal.facilityCount >= 1');
    // Same phrase on screen and in the label: both go through facilityCount.
    expect(source).toContainSource('? `, ${facilityCount(reveal, t)}`');
    expect(source).toContainSource("t('financialStatement.a11y.rowAmount', {");
  });
});
