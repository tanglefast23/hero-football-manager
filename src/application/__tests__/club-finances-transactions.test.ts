import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';
import { advanceFacilityConstruction, buildCareerFacility, createCareer, relocateCareerFacility } from '../../game';

describe('club finances immediate transaction history', () => {
  test('shows newest M2 purchases separately from the weekly statement', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const building = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const built = {
      ...building,
      facilities: {
        ...building.facilities,
        grid: advanceFacilityConstruction(building.facilities.grid!).grid,
      },
    };
    const moved = relocateCareerFacility(built, 'facility-1', { x: 2, y: 2 }).state;

    const viewModel = clubFinancesViewModel(moved);

    expect(viewModel.ledger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Gym construction started' }),
    ]));
    expect(viewModel.recentTransactions).toEqual([
      expect.objectContaining({
        periodLabel: 'S1 · W1',
        label: 'Relocated Gym',
        amount: -350,
        balanceAfter: 37_650,
      }),
      expect.objectContaining({
        label: 'Gym construction started',
        amount: -7_000,
        balanceAfter: 38_000,
      }),
    ]);
    expect(moved.ledgers).toHaveLength(0);
  });
});
