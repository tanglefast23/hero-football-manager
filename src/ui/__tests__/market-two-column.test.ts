import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('market two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/MarketScreen.tsx'),
    'utf8',
  );

  it('renders every desk as a section on wide viewports', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
    expect(source).toContain("layoutMode === 'single'");
  });

  it('keeps the phone tab docket for single-column mode', () => {
    expect(source).toContain('docket'); // the tab bar still exists for phones
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
