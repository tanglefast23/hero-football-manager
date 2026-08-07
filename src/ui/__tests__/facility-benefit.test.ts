import {
  FACILITY_CATALOG,
  TRAINING_PITCH_TP_PER_LEVEL,
  type FacilityType,
} from '../../game/facilities';
import { facilityBenefit } from '../facility-benefit';

describe('facilityBenefit', () => {
  it('gives every facility a non-empty benefit line', () => {
    for (const type of Object.keys(FACILITY_CATALOG) as FacilityType[]) {
      expect(facilityBenefit(type).length).toBeGreaterThan(0);
    }
  });

  it('describes the gym as speed and stamina training', () => {
    const gym = facilityBenefit('gym');
    expect(gym).toMatch(/pace/);
    expect(gym).toMatch(/stamina/);
    // Previously pinned "Level 2+", from the era when a level-1 facility gave
    // exactly x1.0 and the copy had to admit it. Level 1 is now +25%, so the
    // guarantee is that the line quotes a real per-level figure.
    expect(gym).toMatch(/Level 1/);
    expect(gym).toMatch(/%/);
  });

  it('never tells the player a facility does nothing', () => {
    for (const type of Object.keys(FACILITY_CATALOG) as FacilityType[]) {
      const line = facilityBenefit(type);
      expect(line).not.toMatch(/no training bonus/i);
      expect(line).not.toMatch(/value comes from the right neighbour/i);
    }
  });

  it('states the training pitch training-point bonus', () => {
    expect(facilityBenefit('training-pitch'))
      .toContain(`+${TRAINING_PITCH_TP_PER_LEVEL} TP per completed level`);
    expect(facilityBenefit('training-pitch')).not.toContain('+10');
  });

  it('states the repeatable income-building rule on both commercial facilities', () => {
    expect(facilityBenefit('fan-shop')).toMatch(/Build up to 3.*every Shop and Level/i);
    expect(facilityBenefit('stadium-stand')).toMatch(/Build up to 3.*every Stand and Level/i);
  });
});
