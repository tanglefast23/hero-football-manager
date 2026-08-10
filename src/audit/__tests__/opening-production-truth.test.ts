/**
 * Production-truth contract for the opening balance harness.
 *
 * These pin the rules every opening measurement rests on, so a later engine
 * change that quietly reintroduces a training cap, moves the TP timeline, or
 * makes Cozy and Chairman diverge before kickoff fails here rather than
 * silently invalidating an artifact.
 *
 * The retired `maxFocusDrillsPerWeek` save field is covered separately by
 * src/persistence/__tests__/game-state-codec-weekly-training.test.ts.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  BASE_WEEKLY_TRAINING_POINTS,
  createCareer,
  coachWeeklyTrainingPoints,
  DORM_CONDITION_RECOVERY_PER_LEVEL,
  hireCareerCoach,
  INSTANT_DRILL_CONDITION_COST,
  isFacilityOperational,
  OVERTRAINING_CONDITION_THRESHOLD,
  overtrainingInjuryChancePercent,
  resolveTrainingDrillForPath,
  trainPlayerInstantly,
  TRAINING_PITCH_TP_PER_LEVEL,
  weeklyConditionRecovery,
  type DifficultyMode,
  type GameState,
} from '../../game';
import { buildCareerFacility } from '../../game/management';
import { ORDINARY_POLICY, SMART_BREADTH_POLICY } from '../opening/policies';
import {
  productionLaunchTrainingPoints,
  reconcileTrainingPoints,
  runOpening,
} from '../opening/runner';

const content = loadLaunchContent();
const LAUNCH_TP = productionLaunchTrainingPoints(content);
const CREATION = {
  pac: 50,
  sho: 65,
  pas: 50,
  def: 50,
  tec: 50,
  sta: 50,
} as const;
const SEED = 4_000_000;

function freshCareer(
  difficulty: DifficultyMode = 'COZY',
  seed = SEED,
): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(seed, undefined, content, difficulty),
      ),
    ),
    { name: 'Contract Rookie', ratings: { ...CREATION } },
  );
}

function userStarters(state: GameState) {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined)
    throw new Error('the career must have a user lineup');
  return lineup.playerIds.map((id) =>
    state.players.find((player) => player.id === id)!,
  );
}

describe('training capacity has no weekly cap', () => {
  it('lets four distinct players train in the same week when TP permits', () => {
    let state = freshCareer();
    // Capacity is independent from the opening economy, which is pinned below.
    // Supply four drill costs directly so this test remains a cap test.
    state = { ...state, trainingPoints: 40 };

    const outfielders = userStarters(state)
      .filter((player) => player.role !== 'GK')
      .slice(0, 4);
    expect(outfielders).toHaveLength(4);
    const trainedIds = new Set<string>();
    for (const player of outfielders) {
      state = trainPlayerInstantly(state, player.id, 'sprints').state;
      trainedIds.add(player.id);
    }
    expect(trainedIds.size).toBe(4);
  });

  it('lets the same player train repeatedly in one week, paying condition each time', () => {
    let state = freshCareer();
    state = { ...state, trainingPoints: 40 };
    const target = userStarters(state).find((player) => player.role === 'FWD')!;
    const startingCondition = target.condition ?? 100;

    let taps = 0;
    while (
      state.trainingPoints >=
        resolveTrainingDrillForPath(state, 'finishing').tpCost &&
      taps < 4
    ) {
      state = trainPlayerInstantly(state, target.id, 'finishing').state;
      taps += 1;
    }
    expect(taps).toBeGreaterThanOrEqual(4);
    const after = state.players.find((player) => player.id === target.id)!;
    expect(after.condition).toBe(
      startingCondition - taps * INSTANT_DRILL_CONDITION_COST,
    );
  });
});

describe('condition, recovery, and overtraining', () => {
  it('charges exactly 8 condition per instant drill', () => {
    expect(INSTANT_DRILL_CONDITION_COST).toBe(8);
    const state = freshCareer();
    const target = userStarters(state).find((player) => player.role === 'DEF')!;
    const resolution = trainPlayerInstantly(state, target.id, 'duels');
    expect(resolution.conditionAfter).toBe((target.condition ?? 100) - 8);
  });

  it('recovers 10 a week, plus 3 per completed Dorm level', () => {
    expect(weeklyConditionRecovery(0)).toBe(10);
    expect(DORM_CONDITION_RECOVERY_PER_LEVEL).toBe(3);
    expect(weeklyConditionRecovery(1)).toBe(13);
    expect(weeklyConditionRecovery(3)).toBe(19);
  });

  it('rolls for injury only when a drill starts below condition 30', () => {
    expect(OVERTRAINING_CONDITION_THRESHOLD).toBe(30);
    expect(overtrainingInjuryChancePercent(30)).toBe(0);
    expect(overtrainingInjuryChancePercent(100)).toBe(0);
    expect(overtrainingInjuryChancePercent(29)).toBeGreaterThan(0);
  });
});

describe('opening TP timeline', () => {
  it('accrues the launch grant plus two settlements with no head coach', () => {
    let state = freshCareer();
    expect(state.trainingPoints).toBe(LAUNCH_TP);
    expect(state.week).toBe(1);
    state = advanceWeek(state);
    expect(state.trainingPoints).toBe(LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS);
    state = advanceWeek(state);
    expect(state.trainingPoints).toBe(
      LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS * 2,
    );
    expect(state.week).toBe(3);
    expect(state.phase).toBe('manage');
    state = advanceWeek(state);
    expect(state.phase).toBe('matchday');
    // Entering matchday grants nothing: the fixture sits inside week 3.
    expect(state.trainingPoints).toBe(
      LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS * 2,
    );
  });

  it('adds 10 TP a settlement once a Level 1 head coach is hired in week 1', () => {
    let state = freshCareer();
    const candidate = state.market!.coachCandidates[0];
    expect(candidate.level).toBe(1);
    expect(coachWeeklyTrainingPoints(1, 'HEAD')).toBe(5);
    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, candidate.id),
    };
    state = advanceWeek(state);
    expect(state.trainingPoints).toBe(
      LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS + 5,
    );
    state = advanceWeek(state);
    expect(state.trainingPoints).toBe(
      LAUNCH_TP + (BASE_WEEKLY_TRAINING_POINTS + 5) * 2,
    );
  });

  it('spends the opening bank as each arm intends', () => {
    const ordinary = runOpening({
      seed: SEED,
      difficulty: 'COZY',
      policy: ORDINARY_POLICY,
      creation: CREATION,
      content,
    });
    expect(ordinary.tapCount).toBe(6);
    expect(ordinary.tpSpent).toBe(42);
    expect(ordinary.tpBanked).toBe(0);
    reconcileTrainingPoints(ordinary, LAUNCH_TP);

    const smart = runOpening({
      seed: SEED,
      difficulty: 'COZY',
      policy: SMART_BREADTH_POLICY,
      creation: CREATION,
      content,
    });
    expect(smart.tapCount).toBe(6);
    expect(smart.tpSpent).toBe(42);
    expect(smart.tpBanked).toBe(0);
    reconcileTrainingPoints(smart, LAUNCH_TP);
  });
});

describe('Training Pitch timing', () => {
  it('is operational for week 3 DEF training but pays no TP before kickoff', () => {
    let state = freshCareer();
    const club = state.clubs.find(
      (candidate) => candidate.id === state.userClubId,
    )!;
    expect(club.cash).toBeGreaterThanOrEqual(8_000);
    state = buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;

    const pitchId = state.facilities.grid!.buildings.find(
      (building) => building.type === 'training-pitch',
    )!.id;
    expect(isFacilityOperational(state.facilities.grid!, pitchId)).toBe(false);

    state = advanceWeek(state);
    state = advanceWeek(state);
    expect(state.week).toBe(3);
    expect(isFacilityOperational(state.facilities.grid!, pitchId)).toBe(true);

    // Two weekly settlements have passed and neither included the Pitch's TP.
    expect(state.trainingPoints).toBe(
      LAUNCH_TP + BASE_WEEKLY_TRAINING_POINTS * 2,
    );
    expect(TRAINING_PITCH_TP_PER_LEVEL).toBe(12);

    // The operational Pitch applies x1.10. At a +3 Tier 1 drill, whole-point
    // rounding raises the immediate result to +4.
    const defender = userStarters(state).find(
      (player) => player.role === 'DEF',
    )!;
    const withPitch = trainPlayerInstantly(state, defender.id, 'duels');
    const bare = trainPlayerInstantly(
      freshCareerAtWeekThree(),
      defender.id,
      'duels',
    );
    expect(withPitch.after - defender.attrs.def).toBe(4);
    expect(bare.after - defender.attrs.def).toBe(3);
  });
});

function freshCareerAtWeekThree(): GameState {
  return advanceWeek(advanceWeek(freshCareer()));
}

describe('difficulty identity before kickoff', () => {
  it.each([
    ['ordinary', ORDINARY_POLICY],
    ['smart breadth', SMART_BREADTH_POLICY],
  ])(
    'gives %s the same opener in Cozy and Chairman on the same seed',
    (_label, policy) => {
      const cozy = runOpening({
        seed: SEED,
        difficulty: 'COZY',
        policy,
        creation: CREATION,
        content,
      });
      const chairman = runOpening({
        seed: SEED,
        difficulty: 'CHAIRMAN',
        policy,
        creation: CREATION,
        content,
      });

      expect(
        chairman.actions.map(
          (record) => `${record.action}|${record.completed}`,
        ),
      ).toEqual(
        cozy.actions.map((record) => `${record.action}|${record.completed}`),
      );
      expect(chairman.weeklyTp).toEqual(cozy.weeklyTp);
      expect(chairman.opener.outcome).toBe(cozy.opener.outcome);
      expect(chairman.opener.goalsFor).toBe(cozy.opener.goalsFor);
      expect(chairman.opener.goalsAgainst).toBe(cozy.opener.goalsAgainst);
      expect(chairman.opener.userStrength).toBe(cozy.opener.userStrength);
      expect(chairman.opener.opponentStrength).toBe(
        cozy.opener.opponentStrength,
      );
    },
  );
});

describe('the opening fixture', () => {
  it('is a week 3 league match against the strongest club in the division', () => {
    const run = runOpening({
      seed: SEED,
      difficulty: 'COZY',
      policy: ORDINARY_POLICY,
      creation: CREATION,
      content,
    });
    expect(run.opener.fixtureId).toBe('s1-r1-m1');

    // The README still calls this the third-strongest D5 club; production makes
    // it the strongest. Pin the truth so the docs fix has something to cite.
    const state = freshCareer();
    const keys = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;
    const meanFor = (clubId: string) => {
      const squad = state.players.filter((player) => player.clubId === clubId);
      return (
        squad.reduce(
          (sum, player) =>
            sum +
            keys.reduce((inner, key) => inner + player.attrs[key], 0) /
              keys.length,
          0,
        ) / squad.length
      );
    };
    const ranked = state.clubs
      .map((club) => ({ id: club.id, mean: meanFor(club.id) }))
      .sort((left, right) => right.mean - left.mean);
    expect(ranked[0].id).toBe(run.opener.opponentClubId);
    expect(ranked[ranked.length - 1].id).toBe(state.userClubId);
  });

  it('is power-free, so the opener is a bare-stat contest', () => {
    const run = runOpening({
      seed: SEED,
      difficulty: 'COZY',
      policy: ORDINARY_POLICY,
      creation: CREATION,
      content,
    });
    expect(run.opener.powersActive).toBe(false);
  });
});
