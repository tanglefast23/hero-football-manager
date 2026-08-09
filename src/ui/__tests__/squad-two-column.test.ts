import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('squad training two-column layout', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/ui/screens/SquadTrainingScreen.tsx'),
    'utf8',
  );

  it('flows sections through SectionFlow with the auto-detected mode', () => {
    expect(source).toContainSource('useLayoutMode');
    expect(source).toContainSource('<SectionFlow');
  });

  it('lets SectionFlow own inter-section spacing', () => {
    expect(source).not.toContainSource('mt-6');
  });

  it('derives the roster weight from view-model content counts', () => {
    expect(source).toContainSource('3 + viewModel.players.length');
    expect(source).not.toContainSource('selectedPlayerStatOptions?.length');
  });

  it('keeps the internal 600pt roster breakpoint independent of the app layout breakpoint', () => {
    expect(source).toContainSource('const wideColumns = width >= 600;');
    expect(source).toContainSource('useWindowDimensions');
  });

  it('gives the player file section a spread-conditional weight', () => {
    expect(source).toContainSource('...(selectedPlayer ? [{');
    expect(source).toContainSource('weight: 9');
  });

  it('keeps the guide mt-20 wrapper literal byte-identical', () => {
    expect(source).toContainSource(
      "'relative mt-20 border-4 border-blue-dark bg-blue-light p-1'",
    );
  });
});
