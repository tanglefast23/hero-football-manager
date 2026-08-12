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

  it('anchors the train cue on the + button, not over the table', () => {
    // This replaces a guard on a literal `mt-20` wrapper class. That margin
    // existed to hold 72pt of room above the roster box for a cue anchored to
    // the box itself, which put the arrow over the gap between two columns and
    // pointed it at nothing. The cue now lives inside the train button's own
    // Pressable, so `left: '50%'` resolves against the 40pt button and centres
    // the arrow on the +. Nothing hangs above the box any more, which is why
    // the guided wrapper no longer reserves the margin.
    expect(source).toMatchSource(
      /rounded-full[\s\S]{0,2000}\{glowAssignmentButton && !playerGuideDismissed \? \([\s\S]{0,200}<TutorialTapCue/,
    );
    expect(source).toMatchSource(
      /<TutorialTapCue[\s\S]{0,400}left: '50%',\s*marginLeft: -TUTORIAL_TAP_CUE_WIDTH \/ 2,\s*top: -TUTORIAL_TAP_CUE_ABOVE_OFFSET,/,
    );
    // The guided wrapper keeps its frame and loses only the headroom.
    expect(source).toContainSource(
      "'relative border-4 border-blue-dark bg-blue-light p-1'",
    );
  });
});
