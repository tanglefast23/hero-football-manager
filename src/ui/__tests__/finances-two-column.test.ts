import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('club finances two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContainSource('useLayoutMode');
    expect(source).toContainSource('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContainSource('mt-6');
    expect(source).not.toContainSource('mt-5');
  });

  it('retargets guided scrolling with window-measured coordinates instead of accumulated layout offsets', () => {
    expect(source).toContainSource('scrollToTarget');
    expect(source).not.toContainSource('facilityYRef');
    expect(source).not.toContainSource('groundsYRef');
  });

  it('derives the itemized statement and club grounds weights from view-model content counts', () => {
    expect(source).toContainSource('2 + viewModel.ledger.length');
    expect(source).toContainSource('10 + viewModel.facilities.height * 2');
  });

  it('gives the transactions and legacy training ground sections a spread-conditional weight', () => {
    expect(source).toContainSource(
      '...(viewModel.recentTransactions.length > 0 ? [{',
    );
    expect(source).toContainSource(
      '...(viewModel.legacyTrainingGroundVisible ? [{',
    );
  });

  it('keeps the cash-position guide mt-20 wrapper literal byte-identical', () => {
    expect(source).toContainSource(
      "'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'",
    );
  });

  it('stacks income labels and effects in the single-column layout', () => {
    expect(source).toContain("compact={layoutMode !== 'twoColumn'}");
    expect(source).toContain("compact ? 'gap-1' : 'flex-row items-center'");
  });
});

/**
 * The Facility board used to be one section: the grid, the build menu and the
 * pair bonuses in a single panel, so a wide window balanced nothing and the
 * grid rendered 1180pt across. The build menu is the left column now, so it
 * also comes first above the grounds on a phone.
 */
describe('the facility board columns', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
    'utf8',
  );

  it('puts the build menu first and breaks the wide layout at the grounds', () => {
    const facility = /const facilitySections[\s\S]*?\n  \];/.exec(source);
    expect(facility).not.toBeNull();
    const keys = [...facility![0].matchAll(/key: '([a-z-]+)'/g)].map(
      (match) => match[1],
    );
    expect(keys[0]).toBe('build-menu');
    expect(keys[1]).toBe('grounds');
    expect(facility![0]).toMatchSource(
      /key: 'grounds',[\s\S]{0,120}startsColumn: true,/,
    );
  });

  it('files the catalog and the pairs under their own sections', () => {
    expect(source).toContainSource('<BuildMenuSection');
    expect(source).toContainSource('<FacilityPairBonusesSection');
    // The grid panel no longer carries either of them.
    const grounds = source.slice(
      source.indexOf('function GroundsSection({'),
      source.indexOf('interface BuildMenuSectionProps {'),
    );
    expect(grounds).not.toContainSource('facilities.catalog.map');
    expect(grounds).not.toContainSource('discoveredAdjacencies.map');
  });

  it('does not tell the manager to scroll up after the menu moves first', () => {
    expect(source).not.toContainSource('showCoachingOfficeScrollCue');
    expect(source).not.toContainSource(
      "detail={t('clubFinances.thenTapAPlusSquare')}",
    );
  });
});

/**
 * Two coaches, two columns. One 1180pt-wide card per coach stacked down the
 * page wasted the window and hid the comparison the pair is there to make.
 */
describe('the staff board columns', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
    'utf8',
  );

  it('gives every coach their own section', () => {
    expect(source).toMatchSource(
      /viewModel\.coachingStaff\.map\(\(coach\) => \(\{[\s\S]{0,240}key: `coach-\$\{coach\.role\}`/,
    );
    expect(source).toContainSource('<CoachCardSection');
  });

  it('keeps the coach market its own section rather than a card footer', () => {
    expect(source).toContainSource("key: 'coach-market',");
  });

  it('puts the board label in the header so both columns start level', () => {
    expect(source).toMatchSource(
      /activeTab === 'staff' \? \([\s\S]{0,200}title=\{t\('clubFinances\.coachingStaff'\)\}/,
    );
  });
});
