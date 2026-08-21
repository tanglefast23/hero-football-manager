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

  it('reaches the cup guide target by tab, not by scrolling', () => {
    // The sub-tabs retired the phone-only scroll-into-view: the guided section
    // is now the only thing on the page in either mode.
    expect(source).toContain('guideSubTab');
    expect(source).not.toContain('scrollTo');
  });

  it('keeps division metrics to two columns on a phone', () => {
    const summary = source.slice(
      source.indexOf('kicker={\n              summary.userDivision'),
      source.indexOf(
        'summary.userDivision\n                ? t(\n                    topDivision',
      ),
    );
    expect(
      summary.match(/<View className="(?:mt-2 )?flex-row(?: gap-2)?">/g),
    ).toHaveLength(3);
  });
});
