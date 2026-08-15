import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Decoy clones are entities 22 and 23. They live in `state.decoyClones`, NOT in
 * the 22-entry `state.players`, and only `playerAt` resolves them. Two facts
 * make an unguarded lookup on a clone-capable index a live crash in the match
 * view, and both have already produced one:
 *
 * - `s.players[idx]` is `undefined` for a clone even while that clone is alive,
 *   because the array simply has no such slot. Gravity Well stores the carrier
 *   as `state.ball.by`, which is the clone whenever the clone holds the ball.
 * - `playerAt` returns `undefined` once a clone has been dismissed, and the
 *   frame drains its whole event batch AFTER advancing up to MAX_CATCHUP_TICKS
 *   further ticks. A slide the clone started can therefore be read back several
 *   ticks after expiry, a restart, or an auto-substitution removed it.
 *
 * A source check rather than a render: this Jest environment has no DOM and no
 * React Native, so MatchScreen cannot be mounted, and the handlers are closures
 * inside its animation-frame callback with no exported seam.
 */
const source = readFileSync(
  join(process.cwd(), 'src/render/MatchScreen.tsx'),
  'utf8',
);
const batchStart = source.indexOf('const newEvents = s.events.slice(');
const eventLoop = source.slice(batchStart);

describe('match event loop clone-entity lookups', () => {
  it('reads the whole event batch after the tick loop', () => {
    // The premise both guards rest on. If events were ever drained per tick,
    // the staleness window below would close and these rails would go quiet
    // for the wrong reason.
    expect(batchStart).toBeGreaterThan(-1);
    expect(eventLoop).toContain('for (const e of newEvents) {');
  });

  it('resolves the Gravity Well carrier through playerAt, not s.players', () => {
    expect(eventLoop).not.toContain('s.players[state.carrierIdx]');
    expect(eventLoop).toContain('playerAt(s, state.carrierIdx)');
  });

  it('guards the slide origin instead of asserting the slider still exists', () => {
    expect(eventLoop).not.toContain('playerAt(s, e.by)!');
  });
});
