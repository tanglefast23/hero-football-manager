import { PASS_COMBO_DECAY_TICKS, tierForCount } from '../../sim/pass-combo';
import {
  SPEED_BOOST_CELLS,
  SPEED_BOOST_CELL_HEIGHT,
  SPEED_BOOST_CELL_WIDTH,
  SPEED_BOOST_MIN_COUNT,
  speedBoostMask,
} from '../speed-boost-labels';

function boosted(count: number) {
  return {
    comboTierD: tierForCount(count),
    comboTicks: PASS_COMBO_DECAY_TICKS,
  };
}

describe('SPEED+ plate', () => {
  it('marks players a x5 or longer chain sped up, and nobody else', () => {
    const players = [
      boosted(4),
      boosted(SPEED_BOOST_MIN_COUNT),
      { comboTierD: 0, comboTicks: 0 },
      boosted(8),
    ];
    expect(speedBoostMask(players)).toBe(0b1010);
  });

  it('drops a player the moment their bonus runs out', () => {
    const spent = { comboTierD: tierForCount(6), comboTicks: 0 };
    expect(speedBoostMask([spent])).toBe(0);
    expect(speedBoostMask([{ ...spent, comboTicks: 1 }])).toBe(1);
  });

  it('draws every letter of SPEED+', () => {
    // 6 characters at 3 wide with a 1px gap between them.
    expect(SPEED_BOOST_CELL_WIDTH).toBe(6 * 3 + 5);
    expect(SPEED_BOOST_CELL_HEIGHT).toBe(5);
    expect(SPEED_BOOST_CELLS.length).toBeGreaterThan(0);
    expect(SPEED_BOOST_CELLS.length % 2).toBe(0);
    // The + is the last character, so its cells are past the fifth gap.
    const columns = SPEED_BOOST_CELLS.filter((_value, at) => at % 2 === 0);
    expect(Math.max(...columns)).toBeGreaterThanOrEqual(5 * 4);
  });
});
