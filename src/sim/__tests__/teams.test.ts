import { ROVERS, UNITED } from '../teams';

describe('demo teams', () => {
  for (const team of [ROVERS, UNITED]) {
    it(`${team.name} has 11 players with a GK first`, () => {
      expect(team.players).toHaveLength(11);
      expect(team.players[0].role).toBe('GK');
      expect(team.players.filter(p => p.role === 'DEF')).toHaveLength(4);
      expect(team.players.filter(p => p.role === 'MID')).toHaveLength(4);
      expect(team.players.filter(p => p.role === 'FWD')).toHaveLength(2);
    });
  }

  it('Rovers field 2 heroes (license cap); United fields 1 rival hero — all 3 M0 powers covered', () => {
    expect(ROVERS.players.map(p => p.power).filter(Boolean).sort()).toEqual(['FIRE_TORCH', 'SUPER_SPEED']);
    expect(UNITED.players.map(p => p.power).filter(Boolean)).toEqual(['SUPER_STRENGTH']);
  });

  it('all attributes are 1-99', () => {
    for (const p of [...ROVERS.players, ...UNITED.players]) {
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('index positions are locked: engine and renderer hardcode these', () => {
    expect(ROVERS.players[9].power).toBe('FIRE_TORCH');   // global idx 9 (Dario Flint)
    expect(ROVERS.players[10].power).toBe('SUPER_SPEED'); // global idx 10 (Zip Vela)
    expect(UNITED.players[3].power).toBe('SUPER_STRENGTH'); // global idx 14 (Rex Bould)
    expect(ROVERS.players[0].role).toBe('GK');  // global idx 0
    expect(UNITED.players[0].role).toBe('GK');  // global idx 11
  });
});
