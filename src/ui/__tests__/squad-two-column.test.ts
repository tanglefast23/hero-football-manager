import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('squad training two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContain('useLayoutMode');
    expect(source).toContain('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContain('mt-6');
  });

  it('derives the roster and drill weights from view-model content counts', () => {
    expect(source).toContain('3 + viewModel.players.length');
    expect(source).toContain('2 + viewModel.drills.length');
  });

  it('keeps the internal 600pt roster breakpoint independent of the 960pt layout breakpoint', () => {
    expect(source).toContain('const wideColumns = width >= 600;');
    expect(source).toContain('useWindowDimensions');
  });

  it('gives the player file section a spread-conditional weight', () => {
    expect(source).toContain("...(selectedPlayer ? [{");
    expect(source).toContain('weight: 9');
  });

  it('derives the plan panel weight from the locked-plan state', () => {
    expect(source).toContain('viewModel.lockedPlan === undefined ? 6 : 4 + viewModel.lockedPlan.players.length');
  });

  it('keeps the guide mt-20 wrapper literals byte-identical', () => {
    expect(source).toContain("'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'");
    expect(source).toContain("'relative mt-20 gap-2 border-4 border-blue-dark bg-blue-light p-1'");
  });

  it('gives the floating cue a direction-neutral label', () => {
    expect(source).toContain('label="Find your drills"');
    expect(source).not.toContain('label="Scroll down"');
  });
});
