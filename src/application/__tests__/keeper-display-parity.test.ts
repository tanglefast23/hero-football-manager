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
  const state = createCareer(createLaunchCareerSetup(20260804, undefined, content));
  return { ...state, trainingPoints: 400 };
}

function keeper(state: GameState): CareerPlayer {
  const player = state.players.find(p => p.clubId === state.userClubId && p.role === 'GK');
  if (player === undefined) throw new Error('no user keeper');
  return player;
}

describe('keeper drill rows', () => {
  it("prints the same gain on all four of a keeper's paths", () => {
    const state = careerState();
    const options = squadTrainingViewModel(state, content, keeper(state).id).selectedPlayerStatOptions!;

    // The whole reason the change exists: this is the side-by-side comparison
    // that made the strongest per-TP purchase in the game look like the weakest.
    expect(options.map(option => option.pathId))
      .toEqual(['sprints', 'rondo', 'circuit', 'keeper-drills']);
    const gains = options.map(option => option.gain);
    expect(new Set(gains).size).toBe(1);
    expect(gains.every(gain => gain === gains[0])).toBe(true);
  });

  it("leaves an outfield player's rows exactly as authored", () => {
    const state = careerState();
    const outfielder = state.players.find(p => p.clubId === state.userClubId && p.role !== 'GK')!;
    const options = squadTrainingViewModel(state, content, outfielder.id).selectedPlayerStatOptions!;

    for (const option of options) {
      const authored = content.training.focusDrills
        .find(drill => drill.id === option.pathId)!.gains;
      expect(option.gain).toBe(authored[option.shortCode.toLowerCase() as keyof typeof authored]);
    }
  });
});

describe('keeper confirm card', () => {
  it('agrees with the row it was opened from, base line included', () => {
    const state = careerState();
    const gk = keeper(state);
    const options = squadTrainingViewModel(state, content, gk.id).selectedPlayerStatOptions!;
    const drills = options.find(option => option.pathId === 'keeper-drills')!;

    // The base line is `baseValueAfter - currentValue`. Shadow only the adjusted
    // half and the card reads +2 over a +4 count-up, which is the exact
    // card/count-up disagreement the shadow preview exists to prevent.
    expect(drills.baseValueAfter - drills.currentValue).toBe(drills.gain);
  });

  it('never puts a negative number in front of a keeper, at any age', () => {
    const state = careerState();
    const gk = keeper(state);

    // The rule, stated by the owner: never show a negative modifier or a reduced
    // headline gain on the keeper card. A thirty-year-old reading "VETERAN … -2"
    // is being told off for their age on a card that exists to sell them a
    // session. Both numbers the card prints have to be things they receive.
    for (const age of [22, 26, 31, 34]) {
      const aged: GameState = {
        ...state,
        players: state.players.map(p => (p.id === gk.id ? { ...p, age } : p)),
      };
      const options = squadTrainingViewModel(aged, content, gk.id).selectedPlayerStatOptions!;
      for (const option of options) {
        const headline = option.baseValueAfter - option.currentValue;
        const forThisPlayer = option.baseValueAfter
          + option.trainingAdjustment
          - option.currentValue;
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
      players: state.players.map(p => (p.id === gk.id ? { ...p, refDisplayBonus: 9 } : p)),
    };
    const options = squadTrainingViewModel(banked, content, gk.id).selectedPlayerStatOptions!;
    const drills = options.find(option => option.pathId === 'keeper-drills')!;

    expect(drills.currentValue).toBe(gk.attrs.ref + 9);
  });

  it('flips the safety ceiling on the stored value, never the displayed one', () => {
    const state = careerState();
    const gk = keeper(state);
    // Displayed is over 999, stored is not. The drill is still legal, so the
    // row must not claim the keeper is maxed out.
    const nearCeiling: GameState = {
      ...state,
      players: state.players.map(p => (p.id === gk.id
        ? { ...p, attrs: { ...p.attrs, ref: 990 }, refDisplayBonus: 40 }
        : p)),
    };
    const options = squadTrainingViewModel(nearCeiling, content, gk.id).selectedPlayerStatOptions!;
    const drills = options.find(option => option.pathId === 'keeper-drills')!;

    expect(drills.atSafetyCeiling).toBe(false);
    // And the display stalls rather than printing past the shared ceiling.
    expect(drills.currentValue).toBe(999);
  });
});

describe('keeper stat row', () => {
  it('shows the displayed Reflexes on the squad card', () => {
    const state = careerState();
    const gk = keeper(state);
    const banked: GameState = {
      ...state,
      players: state.players.map(p => (p.id === gk.id ? { ...p, refDisplayBonus: 12 } : p)),
    };
    const player = squadTrainingViewModel(banked, content, gk.id)
      .players.find(p => p.id === gk.id)!;

    expect(player.attributes.find(a => a.label === 'REF')!.value).toBe(gk.attrs.ref + 12);
    // Every other stat is the stored number, untouched.
    expect(player.attributes.find(a => a.label === 'PAC')!.value).toBe(gk.attrs.pac);
  });
});

describe('drill upgrade shop', () => {
  it('quotes the keeper ladder at outfield numbers on both tiers it shows', () => {
    const state = careerState();
    const upgrades = squadTrainingViewModel(state, content, keeper(state).id).drillUpgrades;
    const keeperRow = upgrades.find(row => row.pathId === 'keeper-drills')!;
    const sprintRow = upgrades.find(row => row.pathId === 'sprints')!;

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
    const trained = res.state.players.find(p => p.id === gk.id)!;

    // The real tripwire for the stored/displayed split. store.test.ts asserts
    // this relationship on PAC, where the two are equal and an overload would
    // pass unnoticed.
    expect(res.after).toBe(trained.attrs.ref);
    expect(res.displayedAfter).toBeGreaterThan(res.after);
    expect(res.displayedAfter).toBe(trained.attrs.ref + trained.refDisplayBonus!);
  });
});
