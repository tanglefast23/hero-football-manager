import { EVEN_DELTA, STRENGTH_LADDER, scaleTeam } from '../probe-calibration';
import type { TeamDef } from '../../sim/types';

describe('shared balance-probe calibration', () => {
  it('pins the m2.0 measured even point and centered worth ladder', () => {
    expect(EVEN_DELTA).toBe(-12);
    expect(STRENGTH_LADDER).toEqual([-16, -15, -14, -13, -12, -11, -10, -9, -8]);
    expect(STRENGTH_LADDER[Math.floor(STRENGTH_LADDER.length / 2)]).toBe(EVEN_DELTA);
  });

  it('uses the full legal 1–999 scale when synthesising opponents', () => {
    const team: TeamDef = {
      id: 'probe',
      name: 'Probe',
      players: [{
        id: 'probe-player',
        name: 'Probe Player',
        role: 'FWD',
        attrs: { pac: 1, sho: 995, pas: 50, def: 50, tec: 50, sta: 50, ref: 1 },
      }],
    };

    expect(scaleTeam(team, 10).players[0].attrs).toMatchObject({ pac: 11, sho: 999 });
    expect(scaleTeam(team, -10).players[0].attrs).toMatchObject({ pac: 1, sho: 985 });
  });
});
