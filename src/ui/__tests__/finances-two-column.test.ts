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
