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

  it('gives NegotiationPanel a flush option instead of editing SeasonEndScreen', () => {
    expect(source).toContain('flush');
    const seasonEnd = readFileSync(
      join(process.cwd(), 'src/ui/screens/SeasonEndScreen.tsx'),
      'utf8',
    );
    expect(seasonEnd).not.toContain('flush');
  });
});
