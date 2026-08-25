import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('market two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
    'utf8',
  );

  it('flows the chosen desk through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
    // One flow for both widths. The phone-only branch used to hold the docket,
    // which is why the tab strip existed nowhere else.
    expect(source).not.toContain("layoutMode === 'single'");
  });

  it('wears the shared tab strip in the header rather than its own glyph docket', () => {
    expect(source).toContain('<ScreenTabs');
    expect(source).toContain('docketTabs');
    expect(source).not.toContain('function DocketTab');
  });

  it('derives desk section weights from view-model content counts', () => {
    expect(source).toContain('viewModel.youth.offers.length');
    expect(source).toContain('viewModel.transfers.length');
    expect(source).toContain('viewModel.coaches.length');
  });

  it('keeps new scouting missions visible below completed reports', () => {
    expect(source).toContain('viewModel.scouting.reports.length > 0 ?');
    expect(source).not.toContain(
      ') : (\n        <View className="mt-5 gap-3">',
    );
  });

  it('gives NegotiationPanel a flush option instead of editing SeasonEndScreen', () => {
    expect(source).toContain('flush');
    const seasonEnd = readFileSync(
      join(process.cwd(), 'src/ui/screens/SeasonEndScreen.tsx'),
      'utf8',
    );
    expect(seasonEnd).not.toContain('flush');
  });

  it('lets the manager close active talks before making an offer', () => {
    const offerButton = source.indexOf("t('market.makeTheOfferArrow')");
    const closeButton = source.indexOf(
      "t('market.closeAgentFile')",
      offerButton,
    );
    expect(offerButton).toBeGreaterThan(-1);
    expect(closeButton).toBeGreaterThan(offerButton);
  });
});

describe('youth prospect card on the narrowest phone', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
    'utf8',
  );
  // The academy intake card's header row is portrait · text column · ACADEMY
  // stamp. On a 375pt iPhone SE the two art siblings were free to take the width
  // they wanted, squeezing the text column to about four characters, and the two
  // lines under the name had no numberOfLines to stop them wrapping — so
  // "FWD · AGE 17 · PLAYMAKER" came out as six stacked fragments and pushed SIGN
  // below the fold. A season-1 duty forces every new manager onto this screen.
  const header = source.slice(
    source.indexOf('{intake.offers.map((offer) => ('),
    source.indexOf('<YouthStatLine'),
  );

  it('holds the fixed-size art at its natural width', () => {
    expect(header).not.toBe('');
    expect(header).toContain('className="shrink-0 overflow-hidden');
    expect(header).toContain('className="shrink-0 -rotate-2');
    expect(header).toContain('className="min-w-0 flex-1"');
  });

  it('keeps the name to one line and gives both metadata labels two', () => {
    const textNodes = header.match(/<Text[\s\S]*?>/g) ?? [];
    expect(textNodes).toHaveLength(3);
    expect(textNodes[0]).toContain('numberOfLines={1}');
    expect(textNodes[1]).toContain('numberOfLines={2}');
    expect(textNodes[2]).toContain('numberOfLines={2}');
  });
});

describe('coach actions on a narrow screen', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
    'utf8',
  );

  it('stacks the two hire buttons in the single-column layout', () => {
    expect(source).toContain("compact={layoutMode !== 'twoColumn'}");
    expect(source).toContain(
      "compact ? 'gap-2' : 'flex-row justify-end gap-2'",
    );
  });
});
