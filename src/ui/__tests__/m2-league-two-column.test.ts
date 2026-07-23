import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('national league two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/M2LeagueScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-7');
    expect(source).not.toContain('"mt-5"');
  });

  it('derives the standings weight from row count', () => {
    expect(source).toContain('viewModel.activeTable.rows.length');
  });

  it('only auto-scrolls to the cup guide target in single-column mode', () => {
    expect(source).toContain("layoutMode === 'single'");
  });
});
