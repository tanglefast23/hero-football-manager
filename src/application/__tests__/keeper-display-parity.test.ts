import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { trainPlayerInstantly } from '../../game/training';
import type { CareerPlayer, GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

/**
 * The keeper's card, end to end.
 *
 * Keeper Drills award half the outfield ladder at every tier for the same TP.
 * That is correct balance and must not move — Reflexes is contested on every
 * shot faced — but on screen it reads as the keeper being short-changed, in one
 * column, at the same price. These tests cover the presentation layer that
 * closes the gap, and the boundary where the stored number has to survive it.
 *
 * See docs/superpowers/plans/2026-08-04-keeper-drill-display-parity.md.
 */
const content = loadLaunchContent();

function careerState(): GameState {
  const state = createCareer(
    createLaunchCareerSetup(20260804, undefined, content),
  );
  return { ...state, trainingPoints: 400 };
}

function keeper(state: GameState): CareerPlayer {
  const player = state.players.find(
    (p) => p.clubId === state.userClubId && p.role === 'GK',
  );
  if (player === undefined) throw new Error('no user keeper');
  return player;
}

describe('keeper drill rows', () => {
  it("prints the same gain on all four of a keeper's paths", () => {
    const state = careerState();
    const options = squadTrainingViewModel(
      state,
      content,
      keeper(state).id,
    ).selectedPlayerStatOptions!;

    // The whole reason the change exists: this is the side-by-side comparison
    // that made the strongest per-TP purchase in the game look like the weakest.
    expect(options.map((option) => option.pathId)).toEqual([
      'sprints',
      'rondo',
      'circuit',
      'keeper-drills',
    ]);
    const gains = options.map((option) => option.gain);
    expect(new Set(gains).size).toBe(1);
    expect(gains.every((gain) => gain === gains[0])).toBe(true);
  });

  it("leaves an outfield player's rows exactly as authored", () => {
    const state = careerState();
    const outfielder = state.players.find(
      (p) => p.clubId === state.userClubId && p.role !== 'GK',
    )!;
    const options = squadTrainingViewModel(
      state,
      content,
      outfielder.id,
    ).selectedPlayerStatOptions!;

    for (const option of options) {
      const authored = content.training.focusDrills.find(
        (drill) => drill.id === option.pathId,
      )!.gains;
      expect(option.gain).toBe(
        authored[option.shortCode.toLowerCase() as keyof typeof authored],
      );
    }
  });
});

describe('keeper confirm card', () => {
  it('quotes only the last visible point at 998', () => {
    const state = careerState();
    const player = state.players.find(
      (candidate) =>
        candidate.clubId === state.userClubId && candidate.role !== 'GK',
    )!;
    const nearMax: GameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, attrs: { ...candidate.attrs, pac: 998 } }
          : candidate,
      ),
    };
    const sprints = squadTrainingViewModel(
      nearMax,
      content,
      player.id,
    ).selectedPlayerStatOptions!.find((option) => option.pathId === 'sprints')!;

    expect(sprints).toMatchObject({
      currentValue: 998,
      baseValueAfter: 999,
      gain: 1,
      atSafetyCeiling: false,
    });
  });

  it('agrees with the row it was opened from, base line included', () => {
    const state = careerState();
    const gk = keeper(state);
    const options = squadTrainingViewModel(
      state,
      content,
      gk.id,
    ).selectedPlayerStatOptions!;
    const drills = options.find((option) => option.pathId === 'keeper-drills')!;

    // The base line is `baseValueAfter - currentValue`. Shadow only the adjusted
    // half and the card reads +2 over a +4 count-up, which is the exact
    // card/count-up disagreement the shadow preview exists to prevent.
    expect(drills.baseValueAfter - drills.currentValue).toBe(drills.gain);
  });

  it('never reduces the headline gain or the realised result for a keeper', () => {
    const state = careerState();
    const gk = keeper(state);

    /*
     * A keeper's headline is the outfield ladder's number and what they actually
     * receive is always a gain, at every age. The *net difference* line below it
     * may well be negative — a veteran trains slower and the card says so in red
     * — but that is the modifiers' doing and applies identically to a striker of
     * the same age. Nothing here may be reduced for being a goalkeeper.
     */
    for (const age of [22, 26, 31, 34]) {
      const aged: GameState = {
        ...state,
        players: state.players.map((p) => (p.id === gk.id ? { ...p, age } : p)),
      };
      const options = squadTrainingViewModel(
        aged,
        content,
        gk.id,
      ).selectedPlayerStatOptions!;
      for (const option of options) {
        const headline = option.baseValueAfter - option.currentValue;
        const forThisPlayer =
          option.baseValueAfter +
          option.trainingAdjustment -
          option.currentValue;
        expect(headline).toBeGreaterThan(0);
        expect(forThisPlayer).toBeGreaterThan(0);
      }
    }
  });

  it('reports the displayed current value, not the stored one', () => {
    const state = careerState();
    const gk = keeper(state);
    const banked: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id ? { ...p, refDisplayBonus: 9 } : p,
      ),
    };
    const options = squadTrainingViewModel(
      banked,
      content,
      gk.id,
    ).selectedPlayerStatOptions!;
    const drills = options.find((option) => option.pathId === 'keeper-drills')!;

    expect(drills.currentValue).toBe(gk.attrs.ref + 9);
  });

  it('marks a keeper maxed when the displayed value reaches 999', () => {
    const state = careerState();
    const gk = keeper(state);
    // The stored stat still has room, but the manager can only see the capped
    // value. Paid training must stop at that visible boundary.
    const nearCeiling: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id
          ? { ...p, attrs: { ...p.attrs, ref: 990 }, refDisplayBonus: 40 }
          : p,
      ),
    };
    const options = squadTrainingViewModel(
      nearCeiling,
      content,
      gk.id,
    ).selectedPlayerStatOptions!;
    const drills = options.find((option) => option.pathId === 'keeper-drills')!;

    expect(drills.atSafetyCeiling).toBe(true);
    expect(drills.currentValue).toBe(999);
  });
});

describe('keeper stat row', () => {
  it('shows the displayed Reflexes on the squad card', () => {
    const state = careerState();
    const gk = keeper(state);
    const banked: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id ? { ...p, refDisplayBonus: 12 } : p,
      ),
    };
    const player = squadTrainingViewModel(banked, content, gk.id).players.find(
      (p) => p.id === gk.id,
    )!;

    expect(player.attributes.find((a) => a.label === 'REF')!.value).toBe(
      gk.attrs.ref + 12,
    );
    // Every other stat is the stored number, untouched.
    expect(player.attributes.find((a) => a.label === 'PAC')!.value).toBe(
      gk.attrs.pac,
    );
  });
});

describe('drill upgrade shop', () => {
  it('quotes the keeper ladder at outfield numbers on both tiers it shows', () => {
    const state = careerState();
    const upgrades = squadTrainingViewModel(
      state,
      content,
      keeper(state).id,
    ).drillUpgrades;
    const keeperRow = upgrades.find((row) => row.pathId === 'keeper-drills')!;
    const sprintRow = upgrades.find((row) => row.pathId === 'sprints')!;

    // The panel sits on the same screen as the drill rows above it. Fixing one
    // and not the other moves the defect rather than removing it.
    expect(keeperRow.ownedGain).toBe(sprintRow.ownedGain);
    expect(keeperRow.nextGain).toBe(sprintRow.nextGain);
  });
});

describe('the stored value at the store boundary', () => {
  it("keeps the resolution's stored pair real while the displayed pair leads it", () => {
    const state = careerState();
    const gk = keeper(state);
    const res = trainPlayerInstantly(state, gk.id, 'keeper-drills');
    const trained = res.state.players.find((p) => p.id === gk.id)!;

    // The real tripwire for the stored/displayed split. store.test.ts asserts
    // this relationship on PAC, where the two are equal and an overload would
    // pass unnoticed.
    expect(res.after).toBe(trained.attrs.ref);
    expect(res.displayedAfter).toBeGreaterThan(res.after);
    expect(res.displayedAfter).toBe(
      trained.attrs.ref + trained.refDisplayBonus!,
    );
  });
});

/**
 * The confirm card's second box is the *net difference* the player's own
 * modifiers make, coloured by which way it goes — and each modifier name carries
 * its own colour, because "Veteran + GK + Prodigy" mixes one that costs with
 * two that pay and a single colour cannot say so.
 */
describe('training modifier signs', () => {
  it('marks the age penalty as a cost and every bonus as a gain', () => {
    const state = careerState();
    const gk = keeper(state);
    const veteran: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id ? { ...p, age: 31 } : p,
      ),
    };
    const option = squadTrainingViewModel(
      veteran,
      content,
      gk.id,
    ).selectedPlayerStatOptions!.find((o) => o.pathId === 'keeper-drills')!;

    const veteranEntry = option.trainingModifiers.find(
      (m) => m.label === 'Veteran',
    );
    expect(veteranEntry).toBeDefined();
    expect(veteranEntry!.helps).toBe(false);
    // Everything else on the list is only ever added when it pays.
    for (const modifier of option.trainingModifiers.filter(
      (m) => m.label !== 'Veteran',
    )) {
      expect(modifier.helps).toBe(true);
    }
  });

  it('leaves a young player with nothing but gains', () => {
    const state = careerState();
    const gk = keeper(state);
    const young: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === gk.id ? { ...p, age: 22 } : p,
      ),
    };
    const option = squadTrainingViewModel(
      young,
      content,
      gk.id,
    ).selectedPlayerStatOptions!.find((o) => o.pathId === 'keeper-drills')!;

    expect(option.trainingModifiers.map((m) => m.label)).toContain('Youth');
    expect(option.trainingModifiers.every((m) => m.helps)).toBe(true);
    // Small positive modifiers can bank progress without crossing an integer
    // boundary on a one-point keeper drill, but they must never reduce it.
    expect(option.trainingAdjustment).toBeGreaterThanOrEqual(0);
  });
});
