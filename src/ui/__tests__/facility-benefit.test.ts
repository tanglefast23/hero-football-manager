import { FACILITY_CATALOG, type FacilityType } from '../../game/facilities';
import { facilityBenefit } from '../facility-benefit';

describe('facilityBenefit', () => {
  it('gives every facility a non-empty benefit line', () => {
    for (const type of Object.keys(FACILITY_CATALOG) as FacilityType[]) {
      expect(facilityBenefit(type).length).toBeGreaterThan(0);
    }
  });

  it('describes the gym as speed and stamina training', () => {
    const gym = facilityBenefit('gym');
    expect(gym).toMatch(/PAC/);
    expect(gym).toMatch(/STA/);
  });

  it('states the training pitch training-point bonus', () => {
    expect(facilityBenefit('training-pitch')).toMatch(/\+5/);
  });
});
