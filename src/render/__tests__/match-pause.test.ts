import {
  shouldPauseMatch,
  syncBackgroundPauseReason,
  type AutomaticMatchPauseReason,
} from '../match-pause';

describe('match pause reasons', () => {
  it('pauses for global settings and resumes only after every automatic reason closes', () => {
    const reasons = new Set<AutomaticMatchPauseReason>();
    expect(shouldPauseMatch(false, reasons)).toBe(false);

    reasons.add('settings');
    expect(shouldPauseMatch(false, reasons)).toBe(true);
    reasons.add('background');
    reasons.delete('settings');
    expect(shouldPauseMatch(false, reasons)).toBe(true);
    reasons.delete('background');
    expect(shouldPauseMatch(false, reasons)).toBe(false);
  });

  it('preserves a user pause when settings closes', () => {
    expect(shouldPauseMatch(true, new Set())).toBe(true);
  });

  it('holds the match while a first-match tutorial is open', () => {
    expect(shouldPauseMatch(false, new Set<AutomaticMatchPauseReason>(['tutorial']))).toBe(true);
  });

  it('holds an acquired-power replay on its final frame', () => {
    expect(shouldPauseMatch(false, new Set<AutomaticMatchPauseReason>(['showcase']))).toBe(true);
  });

  it('holds the simulation while the graphics context is unavailable', () => {
    expect(
      shouldPauseMatch(false, new Set<AutomaticMatchPauseReason>(['graphics'])),
    ).toBe(true);
  });

  it('automatically releases only the background pause when the app returns', () => {
    const backgroundOnly = new Set<AutomaticMatchPauseReason>();
    syncBackgroundPauseReason(backgroundOnly, false);
    expect(shouldPauseMatch(false, backgroundOnly)).toBe(true);

    syncBackgroundPauseReason(backgroundOnly, true);
    expect(backgroundOnly).toEqual(new Set<AutomaticMatchPauseReason>());
    expect(shouldPauseMatch(false, backgroundOnly)).toBe(false);

    const reasons = new Set<AutomaticMatchPauseReason>(['settings']);

    syncBackgroundPauseReason(reasons, false);
    expect(reasons).toEqual(new Set<AutomaticMatchPauseReason>(['settings', 'background']));

    syncBackgroundPauseReason(reasons, true);
    expect(reasons).toEqual(new Set<AutomaticMatchPauseReason>(['settings']));
    expect(shouldPauseMatch(false, reasons)).toBe(true);
  });
});
