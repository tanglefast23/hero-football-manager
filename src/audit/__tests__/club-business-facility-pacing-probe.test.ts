/**
 * OPT-IN CLUB BUSINESS FACILITY PACING PROBE.
 *
 * Smoke:
 *   npm run test:probe -- src/audit/__tests__/club-business-facility-pacing-probe.test.ts
 * Approval sample:
 *   CLUB_BUSINESS_SEEDS=300 CLUB_BUSINESS_SEED_OFFSET=20000 npm run test:probe -- \
 *     src/audit/__tests__/club-business-facility-pacing-probe.test.ts
 *
 * The frozen table below is the schema-3 catalog at ea929d8. Keeping it here is
 * deliberate: a comparison that imports two values from the new live catalog
 * cannot catch accidental repricing or a bad migration assumption.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  FACILITY_CATALOG,
  activeCareerMatchday,
  advanceWeek,
  buildCareerFacility,
  completeMatchday,
  createCareer,
  isFacilityOperational,
  type DifficultyMode,
  type FacilityType,
  type GameState,
} from '../../game';
import { CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT } from '../club-business-balance-harness';

const content = loadLaunchContent();
const SEEDS = positiveIntegerEnv('CLUB_BUSINESS_SEEDS', 12, 10_000);
const SEED_OFFSET = nonNegativeIntegerEnv(
  'CLUB_BUSINESS_SEED_OFFSET',
  20_000,
  100_000,
);

const SCHEMA_3_PRICES: Readonly<
  Record<
    Exclude<FacilityType, 'coaching-office'>,
    {
      readonly build: number;
      readonly level2: number;
      readonly level3: number;
    }
  >
> = {
  'training-pitch': { build: 8_000, level2: 8_000, level3: 12_000 },
  gym: { build: 7_000, level2: 7_000, level3: 10_500 },
  'tech-center': { build: 9_000, level2: 9_000, level3: 13_500 },
  'shooting-range': { build: 7_500, level2: 7_500, level3: 11_250 },
  'keeper-court': { build: 7_500, level2: 7_500, level3: 11_250 },
  'medical-bay': { build: 10_000, level2: 10_000, level3: 15_000 },
  dorm: { build: 6_000, level2: 6_000, level3: 9_000 },
  'scout-office': { build: 6_000, level2: 6_000, level3: 9_000 },
  'youth-field': { build: 12_000, level2: 12_000, level3: 18_000 },
  'fan-shop': { build: 5_000, level2: 5_000, level3: 7_500 },
  'stadium-stand': { build: 15_000, level2: 15_000, level3: 22_500 },
};

const APPROVED_UPGRADE_PRICES: Readonly<
  Record<keyof typeof SCHEMA_3_PRICES, readonly [number, number]>
> = {
  'training-pitch': [20_000, 40_000],
  gym: [18_000, 36_000],
  'tech-center': [22_000, 44_000],
  'shooting-range': [20_000, 40_000],
  'keeper-court': [20_000, 40_000],
  'medical-bay': [25_000, 50_000],
  dorm: [15_000, 35_000],
  'scout-office': [15_000, 35_000],
  'youth-field': [25_000, 50_000],
  'fan-shop': [15_000, 35_000],
  'stadium-stand': [25_000, 50_000],
};

describe('Club Business facility repricing and pacing probe', () => {
  it('keeps Level 1 friendly and freezes the approved later upgrade prices', () => {
    let level2Uplift = 0;
    let level3Uplift = 0;
    for (const [type, old] of Object.entries(SCHEMA_3_PRICES) as Array<
      [
        keyof typeof SCHEMA_3_PRICES,
        (typeof SCHEMA_3_PRICES)[keyof typeof SCHEMA_3_PRICES],
      ]
    >) {
      const current = FACILITY_CATALOG[type];
      expect(current.buildCost).toBe(
        type === 'stadium-stand' ? 10_000 : old.build,
      );
      expect(current.upgradeCosts).toEqual(APPROVED_UPGRADE_PRICES[type]);
      level2Uplift += current.upgradeCosts[0] - old.level2;
      level3Uplift += current.upgradeCosts[1] - old.level3;
    }

    expect(level2Uplift).toBe(127_000);
    expect(level3Uplift).toBe(315_500);
    expect(level2Uplift + level3Uplift).toBe(
      CLUB_BUSINESS_FACILITY_UPGRADE_UPLIFT,
    );
    expect(
      FACILITY_CATALOG['training-pitch'].upgradeCosts[0] -
        SCHEMA_3_PRICES['training-pitch'].level2,
    ).toBe(12_000);
    expect(
      () => FACILITY_CATALOG['coaching-office'].upgradeCosts[0],
    ).not.toThrow();
  });

  it.each(['COZY', 'CHAIRMAN'] as const)(
    'keeps the prepared D5 Level 1 Training Pitch operational on %s',
    (difficulty) => {
      const runs = Array.from({ length: SEEDS }, (_, index) =>
        preparedLevelOnePitchPath(
          4_100_009 + (SEED_OFFSET + index) * 104_729,
          difficulty,
        ),
      );

      expect(runs.every((run) => run.levelOneOperationalWeek === 3)).toBe(true);
      expect(runs.every((run) => run.cashAtFirstOpportunity >= 0)).toBe(true);
    },
  );
});

function preparedLevelOnePitchPath(
  seed: number,
  difficulty: DifficultyMode,
): {
  readonly levelOneOperationalWeek: number;
  readonly cashAtFirstOpportunity: number;
} {
  let state = createCareer(
    createLaunchCareerSetup(seed, undefined, content, difficulty),
  );
  state = buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
  const pitchId = state.facilities.grid!.buildings[0].id;

  while (!isFacilityOperational(state.facilities.grid!, pitchId)) {
    state = progressOneDecision(state);
  }
  const levelOneOperationalWeek = state.week;
  while (state.phase !== 'manage') state = progressOneDecision(state);
  return {
    levelOneOperationalWeek,
    cashAtFirstOpportunity: userCash(state),
  };
}

function progressOneDecision(state: GameState): GameState {
  if (state.phase === 'manage') return advanceWeek(state);
  if (state.phase !== 'matchday') {
    throw new Error(
      `prepared pitch path entered unsupported phase ${state.phase}`,
    );
  }
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('prepared pitch path has no active matchday');
  return completeMatchday(
    state,
    matchday.fixtures.map((fixture, index) => ({
      fixtureId: fixture.id,
      homeGoals: index === 0 ? 1 : 0,
      awayGoals: 0,
    })),
  );
}

function userCash(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error('prepared pitch path lost the user club');
  return club.cash;
}

function positiveIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return value;
}

function nonNegativeIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${name} must be an integer from 0 to ${maximum}`);
  }
  return value;
}
