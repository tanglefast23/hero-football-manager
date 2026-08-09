import {
  controlledMatchOptions,
  queueControlledAutoSubstitution,
} from '../../game/match-policy';
import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import { advanceGraphicsRecoveryChunk } from '../match-graphics-recovery';

describe('graphics recovery match completion', () => {
  it('finishes through the same deterministic ticks while yielding in chunks', () => {
    const direct = createMatch(9123, ROVERS, UNITED, controlledMatchOptions(0));
    const recovered = createMatch(
      9123,
      ROVERS,
      UNITED,
      controlledMatchOptions(0),
    );

    while (direct.phase !== 'fulltime') {
      tick(direct);
      queueControlledAutoSubstitution(direct, true);
    }
    while (!advanceGraphicsRecoveryChunk(recovered, true, 37)) {
      // The application yields between these bounded chunks.
    }

    expect(JSON.stringify(recovered)).toBe(JSON.stringify(direct));
  });
});
