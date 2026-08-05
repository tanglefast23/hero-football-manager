import { runClubBusinessBalanceScenario } from '../../audit/club-business-balance-harness';

describe('Club Business deterministic balance inputs', () => {
  it('replays six independent season scenarios byte-identically without ambient randomness or time', () => {
    const random = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Club Business called ambient random');
    });
    const now = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Club Business called ambient time');
    });
    try {
      const run = () => Array.from({ length: 6 }, (_, seasonIndex) => (
        runClubBusinessBalanceScenario({
          seed: 5_100_011 + seasonIndex * 104_729,
          division: ([5, 4, 3, 2, 1, 1] as const)[seasonIndex],
          difficulty: seasonIndex % 2 === 0 ? 'COZY' : 'CHAIRMAN',
          profile: (['STEADY', 'BALANCED', 'BOLD'] as const)[seasonIndex % 3],
        })
      ));
      expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });
});
