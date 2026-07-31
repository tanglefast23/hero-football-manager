/**
 * Fast opening sentinel — runs on every normal CI pass.
 *
 * The decision probes are opt-in and slow, so nothing would notice if an engine
 * change quietly moved the opening. This runs every arm on a small fixed seed
 * list and pins the relationships that must hold whatever the absolute rates
 * are. It detects drift; it does not decide balance.
 *
 * Update the digest deliberately. A changed digest means the opening moved, and
 * that is a balance decision with an ENGINE_VERSION question attached, not a
 * snapshot to refresh.
 */
import { loadLaunchContent } from '../../content';
import { BASE_WEEKLY_TRAINING_POINTS } from '../../game';
import {
  JOE_OBSERVED_COACH_POLICY,
  JOE_OBSERVED_NO_COACH_POLICY,
  NO_TRAINING_POLICY,
  ORDINARY_POLICY,
  SMART_BREADTH_POLICY,
  SMART_CONCENTRATION_POLICY,
  SMART_EXTRA_FWD_POLICY,
  type OpeningPolicy,
} from '../opening/policies';
import {
  reconcileTrainingPoints,
  runOpening,
  type CreationRatings,
  type OpeningRun,
  productionLaunchTrainingPoints,
} from '../opening/runner';

const content = loadLaunchContent();
const LAUNCH_TP = productionLaunchTrainingPoints(content);
const SEEDS = [4_000_000, 4_007_919, 4_015_838, 4_023_757, 4_031_676, 4_039_595, 4_047_514, 4_055_433];
const CREATION: CreationRatings = { pac: 50, sho: 65, pas: 50, def: 50, tec: 50, sta: 50 };

const ARMS: readonly OpeningPolicy[] = [
  ORDINARY_POLICY,
  SMART_BREADTH_POLICY,
  SMART_EXTRA_FWD_POLICY,
  SMART_CONCENTRATION_POLICY,
  JOE_OBSERVED_COACH_POLICY,
  JOE_OBSERVED_NO_COACH_POLICY,
  NO_TRAINING_POLICY,
];

function runArm(policy: OpeningPolicy): OpeningRun[] {
  return SEEDS.map(seed => {
    const run = runOpening({ seed, difficulty: 'COZY', policy, creation: CREATION, content });
    reconcileTrainingPoints(run, LAUNCH_TP);
    return run;
  });
}

function outcomeDigest(runs: readonly OpeningRun[]): string {
  return runs.map(run => run.opener.outcome).join('');
}

describe('opening sentinel', () => {
  const byArm = new Map(ARMS.map(policy => [policy.id, runArm(policy)]));

  it.each(ARMS.map(policy => [policy.id, policy] as const))(
    'keeps %s on a reconciled production ledger',
    (_id, policy) => {
      const runs = byArm.get(policy.id)!;
      expect(runs).toHaveLength(SEEDS.length);
      for (const run of runs) {
        expect(run.skippedIntents).toBe(0);
        expect(run.opener.powersActive).toBe(false);
        // The whole pre-kickoff bank: the launch grant plus two weekly
        // settlements, each 24 base and 12 more once a Level 1 coach is hired.
        expect(run.tpSpent + run.tpBanked).toBe(
          LAUNCH_TP + (BASE_WEEKLY_TRAINING_POINTS + (usesCoach(policy.id) ? 12 : 0)) * 2,
        );
      }
    },
  );

  it('spends the opening bank as each arm intends', () => {
    // Tap counts follow from the bank, so they move whenever the launch grant
    // does. Asserted as absolutes because a silent change in how much
    // preparation the opener allows is exactly what this sentinel is for.
    expect(byArm.get('ordinary')!.every(run => run.tapCount === 9 && run.tpBanked === 12)).toBe(true);
    expect(byArm.get('smart-breadth')!.every(run => run.tapCount === 10 && run.tpBanked === 2)).toBe(true);
    expect(byArm.get('smart-extra-fwd')!.every(run => run.tapCount === 10)).toBe(true);
    expect(byArm.get('joe-observed-no-coach')!.every(run => run.tapCount === 7)).toBe(true);
    expect(byArm.get('no-training')!.every(run => (
      run.tapCount === 0 && run.tpBanked === LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS * 2
    ))).toBe(true);
  });

  it('keeps every trained arm ahead of the untrained control on squad strength', () => {
    const control = mean(byArm.get('no-training')!.map(run => run.opener.userStrength));
    for (const policy of ARMS) {
      if (policy.id === 'no-training') continue;
      const armStrength = mean(byArm.get(policy.id)!.map(run => run.opener.userStrength));
      expect(armStrength).toBeGreaterThan(control);
    }
  });

  it('leaves the concentration arm fatigued at kickoff', () => {
    // Ten taps on one player is legal and never triggers an injury roll, but it
    // must still cost visible condition — that trade-off is the whole point of
    // the arm. Compare the trained striker, not the squad average.
    const concentrated = byArm.get('smart-concentration')!;
    const spread = byArm.get('ordinary')!;
    expect(minCondition(concentrated)).toBeLessThan(minCondition(spread));
  });

  it('matches the recorded opening digest', () => {
    const digests = Object.fromEntries(
      ARMS.map(policy => [policy.id, outcomeDigest(byArm.get(policy.id)!)]),
    );
    // Updated 2026-07-30 for the Keeper Drills gain ladder: 2/3/5/7/9 against
    // every other path's 5/8/12/17/23. Every arm that taps the keeper moved;
    // exactly the two that never do — smart-concentration, which pours the bank
    // into the striker, and no-training — kept their previous digest. That split
    // is itself the check that the change reached only what it was aimed at.
    // Eight seeds cannot show a rate; the 500-seed measurement behind this
    // digest is 10.2% wins for Ordinary and 10.8% for Smart, against 23.4% and
    // 23.8% before.
    expect(digests).toEqual({
      ordinary: 'LLWLLDWL',
      'smart-breadth': 'LLLLLLDL',
      'smart-extra-fwd': 'LLWLLLLL',
      'smart-concentration': 'LLLLLLLL',
      'joe-observed-coach': 'LLWLLLWL',
      'joe-observed-no-coach': 'LLLDDLWL',
      'no-training': 'LLLLLLLD',
    });
  });
});

function usesCoach(policyId: string): boolean {
  return policyId !== 'joe-observed-no-coach' && policyId !== 'no-training' && policyId !== 'pac-control';
}

function minCondition(runs: readonly OpeningRun[]): number {
  return Math.min(...runs.flatMap(run => Object.values(run.kickoffCondition)));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
