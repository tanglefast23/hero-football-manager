import { readFileSync } from 'fs';
import { join } from 'path';

import { useM1Store } from '../store';

/**
 * The face-off's app-state surface.
 *
 * `faceOff` is never persisted, so the two things worth pinning are that
 * `completeFaceOff` cannot fire twice or off-screen, and that no path which
 * swaps careers can leave a scene from the previous one waiting to play.
 */

function reset(): void {
  useM1Store.setState({
    screen: 'management',
    faceOff: null,
    pendingPostFaceOffScreen: null,
  });
}

describe('completeFaceOff', () => {
  beforeEach(reset);

  it('hands on to the held screen and clears both fields', () => {
    useM1Store.setState({
      screen: 'faceoff',
      pendingPostFaceOffScreen: 'postmatch',
      faceOff: {
        sides: [
          { playerId: 'a', playerName: 'A', role: 'FWD', clubName: 'Rovers' },
          { playerId: 'b', playerName: 'B', role: 'MID', clubName: 'Town' },
        ],
        strike: 'club',
        accessibilityLabel: 'A, Rovers, against B, Town.',
      },
    });

    useM1Store.getState().completeFaceOff();

    expect(useM1Store.getState().screen).toBe('postmatch');
    expect(useM1Store.getState().faceOff).toBeNull();
    expect(useM1Store.getState().pendingPostFaceOffScreen).toBeNull();
  });

  it('honours an awakening held behind the scene', () => {
    useM1Store.setState({
      screen: 'faceoff',
      pendingPostFaceOffScreen: 'awakening',
    });
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState().screen).toBe('awakening');
  });

  /**
   * The scene's own timer and a skip tap can land in the same frame. Two
   * advances would skip whatever screen the first one opened.
   */
  it('is harmless when called twice', () => {
    useM1Store.setState({
      screen: 'faceoff',
      pendingPostFaceOffScreen: 'postmatch',
    });
    useM1Store.getState().completeFaceOff();
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState().screen).toBe('postmatch');
  });

  it('mutates nothing at all when the face-off is not the screen', () => {
    useM1Store.setState({
      screen: 'management',
      pendingPostFaceOffScreen: 'postmatch',
    });
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState().screen).toBe('management');
    // The held destination survives, because nothing consumed it.
    expect(useM1Store.getState().pendingPostFaceOffScreen).toBe('postmatch');
  });

  it('falls back to the post-match screen if the destination was somehow lost', () => {
    useM1Store.setState({ screen: 'faceoff', pendingPostFaceOffScreen: null });
    useM1Store.getState().completeFaceOff();
    expect(useM1Store.getState().screen).toBe('postmatch');
  });
});

describe('quickResult raises the face-off', () => {
  /**
   * Source-level, deliberately: driving a real Quick Result needs a settled
   * career, a matchday phase and the persistence stack, all of which
   * store.test.ts already exercises end to end. What is worth pinning here is
   * the shape of the call, because both mistakes it can make are silent.
   */
  const source = () =>
    readFileSync(join(process.cwd(), 'src/application/store.ts'), 'utf8');

  it('builds the scene from the pre-settlement capture, never by re-entering currentMatchday', () => {
    const quickResult = source()
      .split('  quickResult(')[1]
      .split('\n  watchMatch(')[0];

    expect(quickResult).toContainSource('quickResultFaceOffViewModel({');
    // The capture destructured at the top of the call — the only teams that
    // belong to the fixture just played.
    expect(quickResult).toContainSource(
      'const { kind, fixture, fixtures, teams } = currentMatchday(before);',
    );
    // Exactly one currentMatchday call in the whole function: the one above.
    expect(quickResult.match(/currentMatchday\(/g)).toHaveLength(1);
    // And it is called on the pre-settlement state, never on the settled one.
    expect(quickResult).not.toContainSource('currentMatchday(next)');
    expect(quickResult).not.toContainSource('currentMatchday(after)');
    expect(quickResult).not.toContainSource('currentMatchday(completed)');
  });

  it('reads the verdict, not the scoreline, so a penalty shoot-out is never a draw', () => {
    const quickResult = source()
      .split('  quickResult(')[1]
      .split('\n  watchMatch(')[0];
    expect(quickResult).toContainSource(
      'outcomeLabel: postMatch.result.outcomeLabel',
    );
  });

  it('holds the screen the result would have opened, and skips the scene if it cannot be built', () => {
    const quickResult = source()
      .split('  quickResult(')[1]
      .split('\n  watchMatch(')[0];
    expect(quickResult).toContainSource(
      "screen: faceOff === null ? destination : 'faceoff'",
    );
    expect(quickResult).toContainSource(
      'pendingPostFaceOffScreen: faceOff === null ? null : destination',
    );
    // The awakening still comes before the ledger; the face-off only ever sits
    // ahead of that chain, never inside it.
    expect(quickResult).toContainSource(
      "const destination = awakening.awakened ? ('awakening' as const) : ('postmatch' as const);",
    );
  });
});

describe('ephemeral screen state is never inherited across careers', () => {
  /**
   * The bug this exists to prevent, which has already happened once: a field
   * that lives only in app state is added, cleared on three of the paths that
   * swap careers, and inherited on the other five — so loading a save replays
   * a scene belonging to a career you are no longer managing.
   *
   * Source-level rather than behavioural, because these paths are async and
   * persistence-bound. The invariant is structural: every reset that nulls
   * `postMatch` must null the other ephemeral screen fields in the same
   * object literal.
   */
  it('pairs every postMatch reset with the face-off and match-day banner', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/application/store.ts'),
      'utf8',
    );
    const lines = source.split('\n');
    const resets = lines
      .map((line, index) => ({ line, index }))
      .filter((entry) => /^\s+postMatch: null,\s*$/.test(entry.line));

    expect(resets.length).toBeGreaterThan(0);

    for (const reset of resets) {
      // The rest of the object literal this reset sits in. The longest such
      // literal in the file is ~16 lines; 24 clears it with room to spare
      // without running into the next one.
      const where = `store.ts:${reset.index + 1}`;
      const block = lines.slice(reset.index, reset.index + 24).join('\n');
      expect(`${where} ${block.includes('faceOff: null,')}`).toBe(
        `${where} true`,
      );
      expect(
        `${where} ${block.includes('pendingPostFaceOffScreen: null,')}`,
      ).toBe(`${where} true`);
      expect(`${where} ${block.includes('matchDayBanner: null,')}`).toBe(
        `${where} true`,
      );
    }
  });
});
