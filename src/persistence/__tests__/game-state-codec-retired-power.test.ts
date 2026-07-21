import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game';
import { LAUNCH_POWER_IDS } from '../../game/power-catalog';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('retired power migration', () => {
  it('loads a save whose hero still carries the retired Magnet Touch', () => {
    const base = createCareer(createLaunchCareerSetup(20260721, undefined, undefined, 'full'));
    const target = base.players.find(p => p.clubId === base.userClubId && p.role === 'FWD')!;
    const legacy = serializeGameState({
      ...base,
      players: base.players.map(p => (
        p.id === target.id ? { ...p, power: 'SUPER_SPEED' as const, licensed: true } : p
      )),
    }).replace(/"power":"SUPER_SPEED"/, '"power":"MAGNET_TOUCH"');

    expect(legacy).toContain('MAGNET_TOUCH');

    const loaded = parseStoredGameState(legacy);
    const hero = loaded.players.find(p => p.id === target.id)!;

    expect(hero.power).toBeDefined();
    expect(LAUNCH_POWER_IDS).toContain(hero.power);
    expect(hero.power).not.toBe('MAGNET_TOUCH');
  });
});
