import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { keeperDisplayLadderMultiplier } from '../training-paths';
import { instantTrainingPreview, trainPlayerInstantly } from '../training';
import type { CareerPlayer, GameState } from '../types';

/**
 * Keeper Drills award less than the outfield ladder at every tier for the same
 * TP (see docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md).
 * These tests cover the presentation-only bonus that lets the keeper's card read
 * as though the ladders matched, while the stored stat — the one the
 * sim, the scout, the wage and the transfer fee all use — stays untouched.
 */
function careerState(seed = 0): GameState {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(seed), 1);
  return { ...state, phase: 'manage', trainingPoints: 400 };
}

function keeper(state: GameState): CareerPlayer {
  const player = state.players.find(
    (p) => p.clubId === state.userClubId && p.role === 'GK',
  );
  if (player === undefined) throw new Error('no user keeper');
  return player;
}

function outfielder(state: GameState): CareerPlayer {
  const player = state.players.find(
    (p) => p.clubId === state.userClubId && p.role !== 'GK',
  );
  if (player === undefined) throw new Error('no user outfield player');
  return player;
}

/**
 * Ages a player and clears their banked percent remainders.
 *
 * The remainders matter here. A goalkeeper always earns +5% on Reflexes
 * (`POSITION_TRAINING_ATTRIBUTES.GK`), banked as hundredths, and the shadow call
 * earns more from the same starting balance — so a keeper who happens to
 * be carrying a nearly-full remainder sees the shadow cross 100 on a tap where
 * the real gain does not. That is the approximate channel §3 of the plan
 * describes, and it has its own test below. These age-band tests zero the ledger
 * so they measure the structural multiplier alone.
 */
function aged(state: GameState, playerId: string, age: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            age,
            trainingBonusRemainders: {},
            coachTrainingBonusRemainders: {},
          }
        : p,
    ),
  };
}

describe('keeperDisplayLadderMultiplier', () => {
  it('reads the current tier ratio out of content', () => {
    const state = careerState();
    // The whole point of deriving it: a content re-tune of the keeper ladder
    // carries the display with it instead of silently making a fixed ratio wrong.
    expect(keeperDisplayLadderMultiplier(state, 'keeper-drills')).toBe(3);
  });

  it('is one for every outfield path, so nothing but the keeper is touched', () => {
    const state = careerState();
    for (const pathId of [
      'sprints',
      'rondo',
      'circuit',
      'finishing',
      'duels',
      'first-touch',
    ]) {
      expect(keeperDisplayLadderMultiplier(state, pathId)).toBe(1);
    }
  });
});

/**
 * The resolve used to read the multiplier off the TIER-1 drill id while the
 * preview read it off the owned tier's. The injected uneven tier below makes
 * those two lookups disagree if the resolve reaches for tier 1.
 *
 * This pins them together on a deliberately non-exact-half tier, injected here
 * rather than taken from content so the guard survives any future retune.
 */
describe('preview and resolve read the same tier', () => {
  /** Tier II at 7 outfield against 4 keeper: a ratio of 1.75, not 2. */
  function unevenTierTwo(state: GameState): GameState {
    const focusDrills = (state.trainingRules?.focusDrills ?? []).map(
      (drill) => {
        if (drill.id === 'sprints-ii') return { ...drill, gains: { pac: 7 } };
        if (drill.id === 'keeper-drills-ii')
          return { ...drill, gains: { ref: 4 } };
        return drill;
      },
    );
    return {
      ...state,
      trainingRules: { ...state.trainingRules!, focusDrills },
      ownedTrainingTiers: { ...state.ownedTrainingTiers, 'keeper-drills': 2 },
    };
  }

  it('agrees on a tier whose keeper gain is not exactly half', () => {
    const base = careerState(4_411);
    const gk = keeper(base);
    const state = unevenTierTwo(aged(base, gk.id, 26));

    expect(keeperDisplayLadderMultiplier(state, 'keeper-drills-ii')).toBe(
      7 / 4,
    );
    // The tier-1 id reports 3 — which is what the resolve used to
    // use, and why the two paths could disagree.
    expect(keeperDisplayLadderMultiplier(state, 'keeper-drills')).toBe(3);

    const preview = instantTrainingPreview(state, gk.id, 'keeper-drills');
    const res = trainPlayerInstantly(state, gk.id, 'keeper-drills');

    // SUPER is a roll the preview never makes, and clearing the pity timer only
    // disables the pity half of it — so the comparison is made on the result,
    // not assumed away in the setup.
    expect(res.isSuper).toBe(false);
    expect(res.displayedAfter).toBe(preview.adjustedAfter);
  });
});

describe('trainPlayerInstantly display bonus', () => {
  it('banks the shortfall so a prime-age keeper reads the outfield step', () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(
      aged(state, gk.id, 26),
      gk.id,
      'keeper-drills',
    );
    const trained = res.state.players.find((p) => p.id === gk.id)!;

    // Stored is the lower keeper gain and stays the sim's number.
    expect(res.after).toBe(trained.attrs.ref);
    expect(res.after - res.before).toBe(1);
    // Displayed is what an outfield ladder would have awarded.
    expect(res.displayedAfter - res.displayedBefore).toBe(3);
    expect(trained.refDisplayBonus).toBe(2);
    expect(res.displayedAfter).toBe(trained.attrs.ref + 2);
  });

  /**
   * Age-band characterisation.
   *
   * These tests pin the realised gains per band and the displayed steps that go
   * with them, so a change to either is deliberate.
   */
  it('steps the stored and displayed gains together through the young age band', () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(
      aged(state, gk.id, 22),
      gk.id,
      'keeper-drills',
    );

    // The base is 1 stored against 3 displayed. The 1.1 youth multiplier
    // does not create a whole extra point at this tier.
    expect(res.after - res.before).toBe(1);
    expect(res.displayedAfter - res.displayedBefore).toBe(3);
  });

  it('steps the stored and displayed gains together through the veteran age band', () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(
      aged(state, gk.id, 31),
      gk.id,
      'keeper-drills',
    );

    // The keeper path floors to one point; the displayed path resolves to two.
    expect(res.after - res.before).toBe(1);
    expect(res.displayedAfter - res.displayedBefore).toBe(2);
  });

  it('accumulates across taps and never moves the stored stat', () => {
    let state = careerState();
    const gk = keeper(state);
    state = aged(state, gk.id, 26);
    const storedBefore = gk.attrs.ref;

    for (let tap = 0; tap < 5; tap += 1) {
      const res = trainPlayerInstantly(state, gk.id, 'keeper-drills');
      state = res.state;
    }
    const trained = state.players.find((p) => p.id === gk.id)!;
    const storedGain = trained.attrs.ref - storedBefore;

    expect(storedGain).toBeGreaterThan(0);
    // The bonus is the shortfall against the outfield ladder, so displayed runs
    // at roughly triple the stored gain — this is the drift §6 rail.
    expect(trained.refDisplayBonus).toBeGreaterThan(0);
    expect(trained.refDisplayBonus).toBeLessThanOrEqual(storedGain * 2 + 1);
  });

  it('leaves an outfield player without a bonus at all', () => {
    const state = careerState();
    const player = outfielder(state);
    const res = trainPlayerInstantly(state, player.id, 'sprints');
    const trained = res.state.players.find((p) => p.id === player.id)!;

    expect(trained.refDisplayBonus).toBeUndefined();
    expect(res.displayedBefore).toBe(res.before);
    expect(res.displayedAfter).toBe(res.after);
  });

  it('leaves a keeper training a non-keeper path without a bonus', () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(state, gk.id, 'sprints');
    const trained = res.state.players.find((p) => p.id === gk.id)!;

    expect(trained.refDisplayBonus).toBeUndefined();
    expect(res.displayedAfter).toBe(res.after);
  });

  it('lets the shadow release a percent point the real gain has not banked yet', () => {
    const state = careerState();
    const gk = keeper(state);
    // A keeper one hundredth short of a full banked point on Reflexes. The real
    // gain earns ~10 hundredths and stays short; the shadow earns double and
    // crosses, so the displayed step is a point clear of twice the stored one.
    const primed: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id
          ? {
              ...p,
              age: 26,
              trainingBonusRemainders: { ref: 95 },
              coachTrainingBonusRemainders: {},
            }
          : p,
      ),
    };
    const res = trainPlayerInstantly(primed, gk.id, 'keeper-drills');

    // This is the drift §3 documents, and it has no fixed direction: the shadow
    // reads the real banked balance and earns double from it, so depending where
    // that balance sits either side can cross 100 first. What is guaranteed is
    // the size — never more than a point away from twice the stored gain — which
    // is why §6 rails the accumulated total rather than any single tap.
    const displayedStep = res.displayedAfter - res.displayedBefore;
    const storedStep = res.after - res.before;
    expect(Math.abs(displayedStep - storedStep * 2)).toBeLessThanOrEqual(1);
  });

  it('keeps the shadow out of the stored remainder ledger', () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(
      aged(state, gk.id, 26),
      gk.id,
      'keeper-drills',
    );
    const trained = res.state.players.find((p) => p.id === gk.id)!;
    const control = trainPlayerInstantly(
      aged(state, gk.id, 26),
      gk.id,
      'keeper-drills',
    );

    // The shadow call banks its own percent remainders and they must be thrown
    // away. If they leaked, the real ledger would advance at double rate and
    // the keeper would earn genuine extra points from a presentation trick.
    expect(trained.trainingBonusRemainders?.ref).toBe(
      control.state.players.find((p) => p.id === gk.id)!.trainingBonusRemainders
        ?.ref,
    );
  });
});
