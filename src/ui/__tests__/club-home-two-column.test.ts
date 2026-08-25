import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('club home two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubHomeScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6'); // section gaps now come from the flow
  });

  it('derives section weights from view-model content counts', () => {
    expect(source).toContain('viewModel.alerts.length');
    expect(source).toContain('viewModel.table.length');
  });

  it('keeps tutorial cues inside their moved sections', () => {
    expect(source).toContain('TutorialTapCue');
  });

  it('keeps both next-match crests beside the versus tile', () => {
    const card =
      source.match(/key: 'next-match',[\s\S]*?key: 'inbox'/)?.[0] ?? '';

    expect(card.indexOf('{fixture.homeTeam}')).toBeLessThan(
      card.indexOf('<ClubCrest clubName={fixture.homeTeam}'),
    );
    expect(card).toContain('className="min-w-0 flex-1 text-right text-xl');
    expect(card).toContain('className="min-w-0 flex-1 text-xl');
  });

  it('uses the measured fixed widths in the table snapshot', () => {
    expect(source).toContainSource(
      'style={{ width: LEAGUE_COLUMN_WIDTH.goalDifference }}',
    );
    expect(source).toContainSource(
      'maxFontSizeMultiplier={CELL_MAX_FONT_MULTIPLIER}',
    );
    expect(source).toContainSource(
      'maxFontSizeMultiplier={HEADER_MAX_FONT_MULTIPLIER}',
    );
  });
});
