import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('club finances two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6');
    expect(source).not.toContain('mt-5');
  });

  it('retargets guided scrolling with window-measured coordinates instead of accumulated layout offsets', () => {
    expect(source).toContain('scrollToTarget');
    expect(source).not.toContain('facilityYRef');
    expect(source).not.toContain('groundsYRef');
  });

  it('derives the itemized statement and club grounds weights from view-model content counts', () => {
    expect(source).toContain('2 + viewModel.ledger.length');
    expect(source).toContain('10 + viewModel.facilities.height * 2');
  });

  it('gives the transactions and legacy training ground sections a spread-conditional weight', () => {
    expect(source).toContain('...(viewModel.recentTransactions.length > 0 ? [{');
    expect(source).toContain('...(viewModel.legacyTrainingGroundVisible ? [{');
  });

  it('keeps the cash-position guide mt-20 wrapper literal byte-identical', () => {
    expect(source).toContain("'relative mt-20 border-2 border-blue-dark bg-blue-light p-1'");
  });
});

/**
 * The Facility board used to be one section: the grid, the build menu and the
 * pair bonuses in a single panel, so a wide window balanced nothing and the
 * grid rendered 1180pt across. The grounds are the left column now.
 */
describe('the facility board columns', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
    'utf8',
  );

  it('breaks the column at the build menu so the grid keeps the left to itself', () => {
    const facility = /const facilitySections[\s\S]*?\n  \];/.exec(source);
    expect(facility).not.toBeNull();
    const keys = [...facility![0].matchAll(/key: '([a-z-]+)'/g)].map(match => match[1]);
    expect(keys[0]).toBe('grounds');
    expect(keys).toContain('build-menu');
    expect(facility![0]).toMatch(/key: 'build-menu',[\s\S]{0,120}startsColumn: true,/);
  });

  it('files the catalog and the pairs under their own sections', () => {
    expect(source).toContain('<BuildMenuSection');
    expect(source).toContain('<FacilityPairBonusesSection');
    // The grid panel no longer carries either of them.
    const grounds = source.slice(
      source.indexOf('function GroundsSection({'),
      source.indexOf('interface BuildMenuSectionProps {'),
    );
    expect(grounds).not.toContain('facilities.catalog.map');
    expect(grounds).not.toContain('discoveredAdjacencies.map');
  });

  it('drops the scroll-up cue when the menu is already beside the grid', () => {
    expect(source).toMatch(
      /showCoachingOfficeScrollCue=\{[\s\S]{0,200}layoutMode === 'single'/,
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
    expect(source).toMatch(/viewModel\.coachingStaff\.map\(coach => \(\{[\s\S]{0,120}key: `coach-\$\{coach\.role\}`/);
    expect(source).toContain('<CoachCardSection');
  });

  it('keeps the coach market its own section rather than a card footer', () => {
    expect(source).toContain("key: 'coach-market',");
  });

  it('puts the board label in the header so both columns start level', () => {
    expect(source).toMatch(
      /activeTab === 'staff' \? \([\s\S]{0,200}title=\{t\('clubFinances\.coachingStaff'\)\}/,
    );
  });
});
