import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Jest runs with `testEnvironment: 'node'` and no react-native preset, so the
 * real `react-native` module throws on require. The reel's state builders are
 * plain TypeScript sitting in the same file as its component — these stubs are
 * what let them be run at all, and nothing here renders.
 */
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../screens/HallOfFameScreen', () => ({ HallOfFameScreen: () => null }));
jest.mock('../../DevHarnessControls', () => ({
  DevHarnessButton: () => null,
  devHarnessControlStyles: { row: {}, rowLabel: {} },
}));

// The mocks above are hoisted over these imports by the ts-jest transformer.
import {
  hallOfFameCaseState,
  hallOfFameCaseViewModel,
  hallOfFameEntry,
  hallOfFameNote,
  type HallOfFameCaseId,
} from '../hall-of-fame';

describe('the Hall of Fame reel', () => {
  it('registers a case for each shape the page can be opened in', () => {
    expect(hallOfFameEntry.cases.map(entry => entry.id))
      .toEqual(['long-climb', 'quick-climb', 'locked']);
    expect(hallOfFameEntry.cases.every(entry => (entry.note ?? '').length > 0)).toBe(true);
  });

  it('builds every case, deterministically', () => {
    for (const entry of hallOfFameEntry.cases) {
      const caseId = entry.id as HallOfFameCaseId;
      expect(hallOfFameCaseViewModel(caseId)).toEqual(hallOfFameCaseViewModel(caseId));
    }
  });

  /**
   * The point of the rich case: a record whose lists are long enough to find
   * out whether the page scrolls, and whose top scorer had to be summed across
   * seasons rather than copied out of one.
   */
  it('opens the long climb on a full record', () => {
    const viewModel = hallOfFameCaseViewModel('long-climb');
    if (viewModel.status !== 'complete') throw new Error('the long climb did not unlock');
    const record = hallOfFameCaseState('long-climb').hallOfFame;

    expect(record?.season).toBe(6);
    expect(record?.divisionTitles.map(title => title.season)).toEqual([2, 3, 4, 6]);
    expect(record?.cupWinSeasons).toEqual([5, 6]);
    expect(viewModel.tiers.map(tier => tier.division)).toEqual([5, 4, 3, 2, 1]);
    expect(viewModel.honours).toHaveLength(6);
    expect(record?.topScorer?.goldenBoots).toBeGreaterThan(1);
  });

  /** The other end: the shortest record the page can legally be opened on. */
  it('opens the quick climb on a one-season record', () => {
    const viewModel = hallOfFameCaseViewModel('quick-climb');
    if (viewModel.status !== 'complete') throw new Error('the quick climb did not unlock');

    expect(viewModel.tiers).toEqual([expect.objectContaining({ division: 1, seasons: 1 })]);
    expect(viewModel.honours).toHaveLength(2);
    expect(viewModel.subheading).toContain('1 season');
  });

  it('opens the locked case on a career that banked nothing', () => {
    expect(hallOfFameCaseState('locked').hallOfFame).toBeUndefined();
    expect(hallOfFameCaseViewModel('locked').status).toBe('locked');
  });

  /** The note is the reel's instrument: the sizes that decide the layout. */
  it('reports the list lengths and whether Back fired', () => {
    expect(hallOfFameNote(hallOfFameCaseViewModel('long-climb'), 2))
      .toBe('7 figures · 6 honours · 5 tiers · back pressed 2×');
    expect(hallOfFameNote(hallOfFameCaseViewModel('locked'), 0)).toContain('Locked');
  });

  /**
   * A function-form `style` on a Pressable drops layout properties on iOS and
   * collapses the control to nothing. The reel draws every control with
   * `DevHarnessButton`, which is where the 44pt minimum lives.
   */
  it('keeps its controls on the harness button', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/dev-harness/entries/hall-of-fame.tsx'),
      'utf8',
    );

    expect(source).not.toContain('<Pressable');
    expect(source).not.toContain('style={({');
    expect(source).toContain('DevHarnessButton');
    // No audio cue: the management SFX table is index-addressed by eight tests.
    expect(source).not.toContain('Sfx');
  });
});
