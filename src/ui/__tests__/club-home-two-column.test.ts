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
});
