import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  applyCareerEventOutcome,
  offerCareerEvent,
  selectCareerEventPlayer,
} from '../career-events';
import { FIRST_FAN_GAIN_FLAG, hasEverGainedFans, recordFanGain } from '../fan-growth';
import type { GameState } from '../types';

/**
 * The flag Bert's fans lesson waits on. It is written at the three places fans
 * are added rather than derived from the count, because the count also falls.
 */
describe('first fan gain', () => {
  const fresh = (): GameState => createCareer(createLaunchCareerSetup(4242));

  it('is unset on a new career', () => {
    expect(hasEverGainedFans(fresh())).toBe(false);
  });

  it('records a gain once and never again', () => {
    const first = recordFanGain(fresh(), 6);

    expect(hasEverGainedFans(first)).toBe(true);
    expect(first.eventFlags.filter(flag => flag === FIRST_FAN_GAIN_FLAG)).toEqual([
      FIRST_FAN_GAIN_FLAG,
    ]);
    // Same state back, so a re-record cannot churn the save.
    expect(recordFanGain(first, 120)).toBe(first);
  });

  it('ignores a flat week and a fan setback', () => {
    const state = fresh();

    expect(recordFanGain(state, 0)).toBe(state);
    expect(recordFanGain(state, -40)).toBe(state);
    expect(hasEverGainedFans(recordFanGain(state, -40))).toBe(false);
  });

  it('is set by a story outcome that brings supporters in', () => {
    const initial = fresh();
    const playerId = 'bramble-rovers-p13';
    const pending = selectCareerEventPlayer(
      offerCareerEvent(initial, 'giant-spider-arrives'),
      playerId,
    );

    const resolved = applyCareerEventOutcome(
      pending,
      'adopt-spider',
      'The mascot meeting requires two weeks of ice packs.',
      { fanDelta: 20 },
    );

    expect(hasEverGainedFans(resolved)).toBe(true);
  });

  it('is left alone by a story outcome that costs the club supporters', () => {
    const initial = fresh();
    const playerId = 'bramble-rovers-p13';
    const pending = selectCareerEventPlayer(
      offerCareerEvent(initial, 'giant-spider-arrives'),
      playerId,
    );

    const resolved = applyCareerEventOutcome(
      pending,
      'adopt-spider',
      'The mascot meeting empties a stand.',
      { fanDelta: -20 },
    );

    expect(hasEverGainedFans(resolved)).toBe(false);
  });

  /**
   * The derived alternative — "more fans than the club started with" — was
   * rejected because the count falls too, so the flag has to be written where
   * the fans are added. That only holds while every such place writes it. A
   * fourth source added without the call is silent: Bert's lesson simply never
   * arrives for the career that earned it.
   */
  it('is written at all three places the club is handed fans', () => {
    const gameDir = join(process.cwd(), 'src/game');
    // A cup round, a story outcome, the step a promotion gives. Anything added
    // later that raises the count owes this call too — the only other file that
    // touches the number is board-ultimatum.ts, and it only ever subtracts.
    for (const name of ['career.ts', 'career-events.ts', 'full-career.ts']) {
      expect(readFileSync(join(gameDir, name), 'utf8')).toContain('recordFanGain');
    }
    expect(readFileSync(join(gameDir, 'board-ultimatum.ts'), 'utf8'))
      .toContain('fans: Math.max(0, club.fans - resolution.fansLost)');
  });
});
