/**
 * OPT-IN bounded commercial and Cup measurement.
 *
 *   npm run test:probe -- src/audit/__tests__/commercial-cup-measurement-probe.test.ts
 *
 * COMMERCIAL_CUP_SEASONS defaults to 3: two career seeds, Cozy/Chairman,
 * balanced/stack, and Green Bull use/non-use. Set it to 1 only for the
 * distinct one-season smoke. Green Bull does not unlock in a first D5
 * season, so that smoke is not a spend sample. This file reports evidence.
 * It does not change a price.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS,
  runClubBusinessLongCareer,
} from '../club-business-long-career-harness';
import {
  COMMERCIAL_MEASUREMENT_SEEDS,
  productionArms,
  renderMeasurementReport,
  summarizeCommercialArm,
  type CommercialArmSummary,
  type PenaltyCalibrationStat,
} from '../commercial-income-study';
import {
  buildCupCandidate,
  runCupCatchUpStudy,
  type CupCatchUpStudy,
} from '../cup-catchup-study';

const SEASON_HORIZON = Number(process.env.COMMERCIAL_CUP_SEASONS ?? 3);
const ARTIFACT_DIR = path.resolve(
  process.cwd(),
  process.env.HFM_BALANCE_ARTIFACT_DIR ?? 'artifacts/balance-design-2026-10-19',
);

jest.setTimeout(240 * 60 * 1_000);

function mergeCupStudies(
  studies: readonly CupCatchUpStudy[],
): CupCatchUpStudy & {
  readonly seeds: readonly number[];
} {
  const first = studies[0];
  if (first === undefined) {
    throw new Error('cup study produced no seed');
  }
  const rows = studies.flatMap((study) => study.rows);
  const unreachable = studies.flatMap((study) => study.unreachable);
  return {
    kind: 'cup-catchup-measurement',
    status: 'MEASUREMENT_ONLY',
    seed: first.seed,
    seeds: studies.map((study) => study.seed),
    difficulties: first.difficulties,
    gaps: first.gaps,
    rounds: first.rounds,
    catchupPercent: first.catchupPercent,
    penaltyCalibrationPath: first.penaltyCalibrationPath,
    rows,
    unreachable,
    candidate: buildCupCandidate(rows, unreachable),
  };
}

describe('bounded commercial and Cup measurement', () => {
  it('writes the paired Cup cohort and the production career arms', () => {
    if (
      !Number.isSafeInteger(SEASON_HORIZON) ||
      SEASON_HORIZON < 1 ||
      SEASON_HORIZON > CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS
    ) {
      throw new Error(
        `COMMERCIAL_CUP_SEASONS must be an integer from 1 to ${CLUB_BUSINESS_LONG_CAREER_MAX_SEASONS}`,
      );
    }
    const oneSeasonSmoke = SEASON_HORIZON === 1;
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    const studies = COMMERCIAL_MEASUREMENT_SEEDS.map((seed) =>
      runCupCatchUpStudy(seed),
    );
    const cup = mergeCupStudies(studies);
    console.log(
      `cup seeds ${cup.seeds.join(',')} rows ${cup.rows.length} unreachable ${cup.unreachable.length}`,
    );
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'cup-catchup.json'),
      `${JSON.stringify(cup, null, 2)}\n`,
    );

    const planned = productionArms(SEASON_HORIZON);
    const arms: CommercialArmSummary[] = [];
    const writePartial = (status: string, error?: string) => {
      fs.writeFileSync(
        path.join(ARTIFACT_DIR, 'commercial-income.json'),
        `${JSON.stringify(
          {
            kind: oneSeasonSmoke
              ? 'commercial-income-one-season-smoke'
              : 'commercial-income-cohort',
            status,
            oneSeasonSmoke,
            seeds: [...COMMERCIAL_MEASUREMENT_SEEDS],
            seasonHorizon: SEASON_HORIZON,
            lockedArm: 'OMITTED',
            plannedArms: planned.length,
            completedArms: arms.length,
            ...(error === undefined ? {} : { error }),
            arms,
          },
          null,
          2,
        )}\n`,
      );
    };

    try {
      for (const [index, arm] of planned.entries()) {
        const started = Date.now();
        const result = runClubBusinessLongCareer(arm.seed, arm.difficulty, arm);
        const elapsedMs = Date.now() - started;
        console.log(
          `arm ${index + 1}/${planned.length} seed ${arm.seed} ${arm.difficulty} ${arm.investment} ${arm.greenBull} ${elapsedMs}ms`,
        );
        arms.push(summarizeCommercialArm(result, arm, elapsedMs));
        writePartial('PARTIAL');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writePartial('PARTIAL_ERROR', message);
      throw error;
    }

    const calibrationPath = path.join(ARTIFACT_DIR, 'penalty-calibration.json');
    const penaltyStats: PenaltyCalibrationStat[] = [];
    if (fs.existsSync(calibrationPath)) {
      const parsed = JSON.parse(fs.readFileSync(calibrationPath, 'utf8')) as {
        stats?: PenaltyCalibrationStat[];
      };
      for (const stat of parsed.stats ?? []) {
        penaltyStats.push({
          name: stat.name,
          runs: stat.runs,
          homeWins: stat.homeWins,
          homeWinRate: stat.homeWinRate,
          kickConversion: stat.kickConversion,
        });
      }
    }
    const receipt = {
      kind: oneSeasonSmoke
        ? 'commercial-income-one-season-smoke'
        : 'commercial-income-cohort',
      status: 'MEASUREMENT_ONLY',
      oneSeasonSmoke,
      seeds: [...COMMERCIAL_MEASUREMENT_SEEDS],
      seasonHorizon: SEASON_HORIZON,
      lockedArm: 'OMITTED',
      plannedArms: planned.length,
      completedArms: arms.length,
      candidates: {
        status: 'UNAPPROVED_NOT_APPLIED',
        commercial: {
          proposal: 'no numerical change',
          standFirstCopyGateBonusPercent: 100,
          standUpgradeGateBonusPercent: 50,
          shopFirstCopyMerchandisePercent: 100,
          shopUpgradeMerchandisePercent: 50,
        },
        cupCatchUp: cup.candidate,
        week19: {
          rule: 'APPROVED_ONE_WEEK_CAP',
          furtherChange: 'none',
          baseline: 'ORIGINAL_WHOLE_BANK_NOT_APPLIED',
        },
        greenBull: {
          proposal: 'no price change',
          fullBankDrain: true,
        },
      },
      arms,
    };
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'commercial-income.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'measurement-report.md'),
      renderMeasurementReport({
        cup,
        arms,
        penaltyStats,
        lockedOmitted: true,
        seasonHorizon: SEASON_HORIZON,
      }),
    );
    expect(new Set(cup.rows.map((row) => row.seed)).size).toBe(
      COMMERCIAL_MEASUREMENT_SEEDS.length,
    );
    expect(cup.rows.length).toBeGreaterThan(0);
    expect(arms.length).toBe(planned.length);
    expect(arms.every((arm) => arm.seasonHorizon === SEASON_HORIZON)).toBe(
      true,
    );
    expect(cup.candidate.status).toBe('UNAPPROVED_NOT_APPLIED');
  });
});
