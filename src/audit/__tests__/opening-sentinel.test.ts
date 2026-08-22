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
import {
  BASE_WEEKLY_TRAINING_POINTS,
  coachWeeklyTrainingPoints,
} from '../../game';
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
const SEEDS = [
  4_000_000, 4_007_919, 4_015_838, 4_023_757, 4_031_676, 4_039_595, 4_047_514,
  4_055_433,
];
const CREATION: CreationRatings = {
  pac: 50,
  sho: 65,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
};

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
  return SEEDS.map((seed) => {
    const run = runOpening({
      seed,
      difficulty: 'COZY',
      policy,
      creation: CREATION,
      content,
    });
    reconcileTrainingPoints(run, LAUNCH_TP);
    return run;
  });
}

function outcomeDigest(runs: readonly OpeningRun[]): string {
  return runs.map((run) => run.opener.outcome).join('');
}

describe('opening sentinel', () => {
  const byArm = new Map(ARMS.map((policy) => [policy.id, runArm(policy)]));

  it.each(ARMS.map((policy) => [policy.id, policy] as const))(
    'keeps %s on a reconciled production ledger',
    (_id, policy) => {
      const runs = byArm.get(policy.id)!;
      expect(runs).toHaveLength(SEEDS.length);
      for (const run of runs) {
        expect(run.skippedIntents).toBe(0);
        expect(run.opener.powersActive).toBe(false);
        // The whole pre-kickoff bank: the launch grant plus two weekly
        // settlements, each the baseline plus a Level 1 coach once hired.
        expect(run.tpSpent + run.tpBanked).toBe(
          LAUNCH_TP +
            (BASE_WEEKLY_TRAINING_POINTS +
              (usesCoach(policy.id)
                ? coachWeeklyTrainingPoints(1, 'HEAD')
                : 0)) *
              2,
        );
      }
    },
  );

  it('spends the opening bank as each arm intends', () => {
    // Tap counts follow from the bank, so they move whenever the launch grant
    // does. Asserted as absolutes because a silent change in how much
    // preparation the opener allows is exactly what this sentinel is for.
    expect(
      byArm
        .get('ordinary')!
        .every((run) => run.tapCount === 6 && run.tpBanked === 0),
    ).toBe(true);
    expect(
      byArm
        .get('smart-breadth')!
        .every((run) => run.tapCount === 6 && run.tpBanked === 0),
    ).toBe(true);
    expect(
      byArm.get('smart-extra-fwd')!.every((run) => run.tapCount === 6),
    ).toBe(true);
    expect(
      byArm.get('joe-observed-no-coach')!.every((run) => run.tapCount === 4),
    ).toBe(true);
    expect(
      byArm
        .get('no-training')!
        .every(
          (run) =>
            run.tapCount === 0 &&
            run.tpBanked === LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS * 2,
        ),
    ).toBe(true);
  });

  it('keeps every trained arm ahead of the untrained control on squad strength', () => {
    const control = mean(
      byArm.get('no-training')!.map((run) => run.opener.userStrength),
    );
    for (const policy of ARMS) {
      if (policy.id === 'no-training') continue;
      const armStrength = mean(
        byArm.get(policy.id)!.map((run) => run.opener.userStrength),
      );
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
      ARMS.map((policy) => [policy.id, outcomeDigest(byArm.get(policy.id)!)]),
    );
    // Updated 2026-08-02 for two owner-approved changes that both push the
    // opener the same way: the outfield drill ladder cut to four fifths
    // (5/8/12/17/23 → 4/6/10/14/18, Keeper Drills untouched), and +5 on each
    // position attribute of the season's first opponent. Every arm moved,
    // including the two that stayed put for the last revision — this change is
    // not aimed at one training path, it is aimed at the fixture itself, so a
    // split digest would have been the surprising result.
    //
    // The direction is intended. The opener's contract is at most 5% wins and
    // at least 90% losses, and before these changes it sat at 10.2% and 71.8% —
    // too easy on both counts. Six of seven arms are now a clean sweep of
    // defeats across these eight seeds.
    //
    // Eight seeds cannot show a rate, and the 500-seed figures quoted here
    // previously (10.2% Ordinary, 10.8% Smart) now predate the tree they
    // describe. They are deliberately not restated: re-derive them from
    // real-player-opening-probe before quoting a rate again.
    // Updated 2026-08-07 for the owner-approved 20% cut to every TP grant in the
    // game (`TRAINING_POINT_SCALE_PERCENT`): the weekly baseline, the Training
    // Pitch, the coaches, the launch grant, and the one-off event rewards. The
    // pre-kickoff bank falls from 102 to 84 TP with a coach and from 78 to 64
    // without, so every coached arm taps eight times instead of nine or ten and
    // the uncoached arm six instead of seven.
    //
    // Updated deliberately, 2026-08-08, for the named superheroes: the opening
    // fixture is always against the division's strongest rival, and that club
    // now fields Larry Alan. The three scattered draws this digest used to
    // carry — one for smart-concentration, two for joe-observed-no-coach — are
    // gone, so every arm loses the opener on all eight seeds.
    //
    // The direction of the contract is unchanged and now held more firmly: at
    // most 5% wins, at least 90% losses. What moved is one fixture out of
    // eighteen, and it moved the way adding a superpowered striker to the
    // hardest club in the division should move it. Every other rail in
    // src/audit, the training-leverage ones included, is untouched.
    //
    // Eight seeds still cannot measure a rate. The season-level question — does
    // a manager who trains and builds still promote in season 2 — needs
    // real-player-opening-probe, which is opt-in and slow, and has not been run
    // for this change.
    //
    // Updated 2026-08-10 for the approved 7 TP and +3 Tier 1 drill. The coached
    // 42 TP opening bank now buys six taps, while the uncoached 32 TP bank buys
    // four. The previous uncoached draw returns to a loss.
    // REBASELINED 2026-08-13, and this one is a reversal rather than a drift.
    //
    // The opener was a scripted loss: 56 of 56 across seven arms and eight
    // seeds, because the schedule pinned the division's STRONGEST club to match
    // one and that club fields Larry Alan. An owner review of a real Season 1
    // found the cost — that career lost its opening match 0-13 and finished the
    // season with eleven draws in eighteen.
    //
    // Two changes land together: the pin now opens on the division's upper-mid
    // club and eases (see `pinOpeningLeagueOpponents`), and the user's opening
    // squad strength went 40 -> 42. The opener is now winnable — 20 wins, 10
    // draws, 26 losses out of 56 — which is the intended outcome, not a
    // regression.
    //
    // Nothing in the story depends on losing it: `completeFirstOnboardingMatch`
    // gates on the fixture being PLAYED, so the collapse-and-awaken beat fires
    // after a win exactly as it does after a defeat. Verified before rebaselining.
    //
    // The old direction-of-contract note ("at most 5% wins, at least 90%
    // losses") is deliberately retired with it. Eight seeds still cannot measure
    // a rate; this is a fingerprint, not a win-rate rail.
    // REBASELINED 2026-08-15 for main's drill and condition changes, which is a
    // drift rather than a reversal: 14 wins, 10 draws, 32 losses out of 56,
    // against 20/10/26 at the 2026-08-13 mark. Closing the pre-Green Bull drill
    // exploit (440a8fdb) removed sessions that used to run before the trip, so
    // the opening squad arrives weaker and the opener is harder again. Verified
    // deterministic: two consecutive runs produced byte-identical digests.
    //
    // REBASELINED again for match-day form (`matchFormPercent`), which gives
    // every club a +-2% week, so two squads no longer produce the same margin
    // every time they meet. The engine is untouched — the golden replay is
    // byte-identical and stored envelopes carry their own team defs — so this
    // is an input change, not an ENGINE_VERSION one. The opening's shape holds:
    // still loss-heavy, still no policy running away with it.
    //
    // REBASELINED for the m2.5 pass-combo speed bonus. This one IS an
    // ENGINE_VERSION change — players who touch the ball in a passing move run
    // up to 20% faster for 3s — so every arm moved, as a movement change over
    // eight seeds will.
    //
    // The shape the sentinel exists to protect holds. Across 7 arms x 8 seeds:
    // 8 wins, 13 draws, 35 losses, against 14/10/32 at the last mark. Still
    // loss-heavy, and still no policy running away with it — the best arm wins
    // twice out of eight. Balance rails were measured separately and moved
    // barely at all (goals/match 2.060 -> 2.080).
    //
    // The line flagged last time reversed: `ordinary` and `smart-breadth` share
    // a digest again, and `smart-extra-fwd` joins them. Three arms on one
    // fingerprint means this sample no longer separates the training plans at
    // all. That is a discrimination loss in the sentinel, not a balance
    // regression, but it is worth watching — if it persists, this sample needs
    // more seeds to stay useful.
    // Moved once more within the same m2.5 change, by one character on two
    // arms, when the passer began being enrolled by stable id instead of by
    // slot. Auto-coaching substitutes mid-pass-flight in these runs, so the
    // wrong player used to inherit the bonus. Totals across 7 arms x 8 seeds
    // are now 7 wins, 12 draws, 37 losses. The approved 7% head-coach ladder
    // later moved the observed coach arm to eight losses: 6 wins, 11 draws,
    // 39 losses across the same sample.
    expect(digests).toEqual({
      ordinary: 'LLDLDWLL',
      'smart-breadth': 'LLDLDWLL',
      'smart-extra-fwd': 'LLDLDWLL',
      'smart-concentration': 'LLLDLLDL',
      'joe-observed-coach': 'LLLLLLLL',
      'joe-observed-no-coach': 'LWLLLWLL',
      'no-training': 'LLDLLWDD',
    });
  });
});

function usesCoach(policyId: string): boolean {
  return (
    policyId !== 'joe-observed-no-coach' &&
    policyId !== 'no-training' &&
    policyId !== 'pac-control'
  );
}

function minCondition(runs: readonly OpeningRun[]): number {
  return Math.min(
    ...runs.flatMap((run) => Object.values(run.kickoffCondition)),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
