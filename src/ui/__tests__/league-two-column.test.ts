import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('league table two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/LeagueTableScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6');
    expect(source).not.toContain('"mt-5"');
  });

  it('derives the table weight from row count', () => {
    expect(source).toContain('viewModel.rows.length');
  });

  it('renders the season fixtures section with the shared fixture row', () => {
    expect(source).toContain('LeagueFixtureRow');
    expect(source).toContain('viewModel.leagueFixtures.length');
  });
});
