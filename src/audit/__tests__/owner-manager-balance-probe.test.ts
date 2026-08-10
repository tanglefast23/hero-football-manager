/**
 * OPT-IN measurement for Joe's final high-TP owner policy.
 *
 * Run one seed per difficulty:
 *   npm run test:probe -- src/audit/__tests__/owner-manager-balance-probe.test.ts
 *
 * Run a wider sample:
 *   OWNER_MANAGER_BALANCE_SEEDS=5 npm run test:probe -- \
 *     src/audit/__tests__/owner-manager-balance-probe.test.ts
 *
 * This probe reports evidence. It has no balance pass/fail thresholds.
 */
import type { DifficultyMode } from '../../game';
import { runClubBusinessLongCareer } from '../club-business-long-career-harness';

const SEED_COUNT = Number(process.env.OWNER_MANAGER_BALANCE_SEEDS ?? 1);
const DIFFICULTY_FILTER = process.env.OWNER_MANAGER_BALANCE_DIFFICULTY;
const DIFFICULTIES: readonly DifficultyMode[] =
  DIFFICULTY_FILTER === 'COZY' || DIFFICULTY_FILTER === 'CHAIRMAN'
    ? [DIFFICULTY_FILTER]
    : ['COZY', 'CHAIRMAN'];

jest.setTimeout(15 * 60 * 1_000);

describe('owner manager balance measurement', () => {
  it('runs the exact high-TP policy through production career systems', () => {
    if (!Number.isSafeInteger(SEED_COUNT) || SEED_COUNT < 1 || SEED_COUNT > 50)
      throw new Error(
        'OWNER_MANAGER_BALANCE_SEEDS must be an integer from 1 to 50',
      );
    const runs = DIFFICULTIES.flatMap((difficulty, difficultyIndex) =>
      Array.from({ length: SEED_COUNT }, (_, index) => {
        const seed =
          (0x6d61_6e61 + difficultyIndex * 0x1000 + index * 104_729) >>> 0;
        const result = runClubBusinessLongCareer(seed, difficulty, {
          ownerMaxTp: true,
        });
        expect(result.runMode).toBe('OWNER_MAX_TP');
        expect(result.seasons.length).toBeGreaterThan(0);
        expect(
          result.seasons.some((season) => season.trainingPointSpend > 0),
        ).toBe(true);
        return {
          seed,
          difficulty,
          censored: result.censored,
          completedFirstD1: result.completedFirstD1,
          finalStateFingerprint: result.finalStateFingerprint,
          totals: {
            trainingDrills: result.totals.trainingDrills,
            endingCash: result.endingCash,
            endingFans: result.endingFans,
            emergencyLoans: result.totals.emergencyLoans,
            boardForcedSales: result.totals.boardForcedSales,
            boardRescues: result.totals.boardRescues,
          },
          seasons: result.seasons.map((season) => ({
            season: season.season,
            division: season.division,
            firstSeasonInDivision: season.firstSeasonInDivision,
            position: season.position,
            promoted: season.promoted,
            relegated: season.relegated,
            startingElevenStrength: season.startingElevenStrength,
            trainingDrills: season.trainingDrills,
            trainingPointStart: season.trainingPointStart,
            trainingPointAmbientIncome: season.trainingPointAmbientIncome,
            trainingPointStoryDelta: season.trainingPointStoryDelta,
            trainingPointOtherDelta: season.trainingPointOtherDelta,
            trainingPointSpend: season.trainingPointSpend,
            trainingPointEnd: season.trainingPointEnd,
            superTrainingSessions: season.superTrainingSessions,
            createdPlayerTrainingDrills: season.createdPlayerTrainingDrills,
            createdPlayerTrainingPointSpend:
              season.createdPlayerTrainingPointSpend,
            createdPlayerSuperTrainingSessions:
              season.createdPlayerSuperTrainingSessions,
            highestImportantAttribute: season.highestImportantAttribute,
            importantAttributeMedian: season.importantAttributeMedian,
            importantAttributesByRole: season.importantAttributesByRole,
            createdPlayerImportantAttributes:
              season.createdPlayerImportantAttributes,
            endingCash: season.endingCash,
            endingFans: season.endingFans,
            facilityCapitalSpend: season.facilityCapitalSpend,
            drillUpgradeSpend: season.drillUpgradeSpend,
            facilities: season.facilities,
            emergencyLoans: season.emergencyLoans,
            boardForcedSales: season.boardForcedSales,
            boardRescues: season.boardRescues,
          })),
        };
      }),
    );
    process.stdout.write(
      `OWNER_MANAGER_BALANCE_JSON ${JSON.stringify({ runs })}\n`,
    );
  });
});
