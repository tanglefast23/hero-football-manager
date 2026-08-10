import { loadLaunchContent } from '../../content';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  hireCareerCoach,
  weeklyAmbientTrainingPoints,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';

/** Runs the crew off the board so whatever was ordered is standing. */
function finishConstruction(state: GameState): GameState {
  let grid = state.facilities.grid!;
  while (grid.construction !== undefined)
    grid = advanceFacilityConstruction(grid).grid;
  return {
    ...state,
    facilities: { ...state.facilities, trainingGroundBuilt: true, grid },
  };
}

describe('training point income view model', () => {
  const content = loadLaunchContent();
  const career = () =>
    createCareer(createLaunchCareerSetup(20260803, undefined, content));

  it('shows the baseline alone before anything is built or hired', () => {
    const income = clubFinancesViewModel(career()).trainingPointIncome;

    expect(income.rows).toEqual([
      expect.objectContaining({
        label: 'Club baseline',
        points: BASE_WEEKLY_TRAINING_POINTS,
      }),
    ]);
    expect(income.total).toBe(BASE_WEEKLY_TRAINING_POINTS);
  });

  it('names the Training Pitch and its level once the pitch is standing', () => {
    const built = finishConstruction(
      buildCareerFacility(career(), 'training-pitch', { x: 0, y: 0 }).state,
    );
    const income = clubFinancesViewModel(built).trainingPointIncome;

    expect(income.rows.map((row) => row.label)).toEqual([
      'Club baseline',
      'Training Pitch · Level 1',
    ]);
    expect(income.rows[1].points).toBe(TRAINING_PITCH_TP_PER_LEVEL);
    expect(income.total).toBe(
      BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL,
    );
  });

  it('gives a hired coach their own row, under their own name', () => {
    const initial = career();
    const candidate = { ...initial.market!.coachCandidates[0], level: 1 };
    const market = hireCareerCoach(
      initial,
      { ...initial.market!, coachCandidates: [candidate] },
      candidate.id,
      'HEAD',
    );
    const income = clubFinancesViewModel({
      ...initial,
      market,
    }).trainingPointIncome;

    expect(income.rows[1]).toEqual(
      expect.objectContaining({
        label: candidate.name,
        detail: 'Head coach · Level 1',
      }),
    );
    expect(income.rows[1].points).toBeGreaterThan(0);
  });

  it('uses event-adjusted coach and Training Pitch income', () => {
    const initial = career();
    const built = finishConstruction(
      buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state,
    );
    const candidate = { ...built.market!.coachCandidates[0], level: 1 };
    const market = hireCareerCoach(
      built,
      { ...built.market!, coachCandidates: [candidate] },
      candidate.id,
      'HEAD',
    );
    const adjusted: GameState = {
      ...built,
      market: {
        ...market,
        headCoach: {
          ...market.headCoach!,
          boosts: { weeklyTp: -1 },
        },
      },
      facilities: {
        ...built.facilities,
        grid: {
          ...built.facilities.grid!,
          buildings: built.facilities.grid!.buildings.map((building) =>
            building.type === 'training-pitch'
              ? { ...building, boosts: { tpBonusPercent: -20 } }
              : building,
          ),
        },
      },
    };

    const income = clubFinancesViewModel(adjusted).trainingPointIncome;

    expect(
      income.rows.find((row) => row.id === 'training-points-pitch')?.points,
    ).toBe(10);
    expect(
      income.rows.find((row) => row.id === 'training-points-head-coach')
        ?.points,
    ).toBe(4);
    expect(income.rows.reduce((sum, row) => sum + row.points, 0)).toBe(
      income.total,
    );
    expect(income.total).toBe(weeklyAmbientTrainingPoints(adjusted));
  });

  /**
   * The whole point of the section: it explains a number the engine credits,
   * so the rows may never add up to anything else. The view model throws rather
   * than render a breakdown that disagrees, and this is what proves the two
   * stay tied together as the sources change.
   */
  it('always sums to exactly what the week credits', () => {
    const initial = career();
    // The assistant seat only opens once the Coaching Office is standing.
    const withOffice = finishConstruction(
      buildCareerFacility(initial, 'coaching-office', { x: 6, y: 5 }).state,
    );
    const built = finishConstruction(
      buildCareerFacility(withOffice, 'training-pitch', { x: 0, y: 0 }).state,
    );
    const head = { ...built.market!.coachCandidates[0], level: 1 };
    const assistant = { ...built.market!.coachCandidates[1], level: 1 };
    const withHead = {
      ...built,
      market: hireCareerCoach(
        built,
        { ...built.market!, coachCandidates: [head, assistant] },
        head.id,
        'HEAD',
      ),
    };
    const full = {
      ...withHead,
      market: hireCareerCoach(
        withHead,
        withHead.market,
        assistant.id,
        'ASSISTANT',
      ),
    };

    for (const state of [initial, withOffice, built, withHead, full]) {
      const income = clubFinancesViewModel(state).trainingPointIncome;
      expect(income.rows.reduce((sum, row) => sum + row.points, 0)).toBe(
        income.total,
      );
      expect(income.total).toBe(weeklyAmbientTrainingPoints(state));
    }
    expect(full.market.assistantCoach).toBeDefined();
    expect(clubFinancesViewModel(full).trainingPointIncome.rows).toHaveLength(
      4,
    );
  });
});
