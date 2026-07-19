import { shouldPauseMatch, type AutomaticMatchPauseReason } from '../match-pause';

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
});
