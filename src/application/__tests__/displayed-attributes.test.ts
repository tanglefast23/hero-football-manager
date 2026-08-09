import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../../game/headless';
import type { CareerPlayer, GameState } from '../../game/types';
import {
  displayedAttributeValue,
  displayedDrillGain,
} from '../displayed-attributes';

/**
 * The one place the keeper's display bonus is added in, and the one place to
 * delete when the Reflexes axis is eventually rescaled for real. Every read in
 * the squad screen, the drill popup and the upgrade shop goes through these two
 * functions so the trick has a single audit point.
 */
function careerState(seed = 0): GameState {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(seed), 1);
  return { ...state, phase: 'manage', trainingPoints: 400 };
}

function withBonus(
  player: CareerPlayer,
  ref: number,
  bonus?: number,
): CareerPlayer {
  return {
    ...player,
    attrs: { ...player.attrs, ref },
    ...(bonus === undefined ? {} : { refDisplayBonus: bonus }),
  };
}

function anyPlayer(state: GameState): CareerPlayer {
  const player = state.players.find((p) => p.clubId === state.userClubId);
  if (player === undefined) throw new Error('no user player');
  return player;
}

describe('displayedAttributeValue', () => {
  it('adds the banked bonus to Reflexes', () => {
    const player = withBonus(anyPlayer(careerState()), 60, 14);
    expect(displayedAttributeValue(player, 'ref')).toBe(74);
  });

  it('leaves a player with no bonus reading their stored value', () => {
    const player = withBonus(anyPlayer(careerState()), 60);
    expect(displayedAttributeValue(player, 'ref')).toBe(60);
  });

  it('never touches an attribute other than Reflexes', () => {
    const player = withBonus(anyPlayer(careerState()), 60, 14);
    for (const attribute of [
      'pac',
      'sho',
      'pas',
      'def',
      'tec',
      'sta',
    ] as const) {
      expect(displayedAttributeValue(player, attribute)).toBe(
        player.attrs[attribute],
      );
    }
  });

  it('stalls at the shared ceiling rather than printing above it', () => {
    // Q3: the display stops at 999 while the true stat keeps climbing. Letting
    // it exceed would break the range every other attribute is validated on.
    const player = withBonus(anyPlayer(careerState()), 995, 20);
    expect(displayedAttributeValue(player, 'ref')).toBe(999);
  });
});

describe('displayedDrillGain', () => {
  it('prints the outfield ladder for every keeper drill tier', () => {
    const state = careerState();
    // Authored keeper ladder is 2/4/6/8/11 against the outfield 4/7/11/16/22.
    // Tiers II and III no longer halve exactly, so the card rounds up to the
    // outfield step rather than doubling a half.
    const expected: ReadonlyArray<[string, number, number]> = [
      ['keeper-drills', 2, 4],
      ['keeper-drills-ii', 4, 7],
      ['keeper-drills-iii', 6, 11],
      ['keeper-drills-iv', 8, 16],
      ['keeper-drills-v', 11, 22],
    ];
    for (const [drillId, authored, shown] of expected) {
      expect(displayedDrillGain(state, drillId, authored)).toBe(shown);
    }
  });

  it('leaves every outfield drill untouched', () => {
    const state = careerState();
    for (const drillId of [
      'sprints',
      'rondo-ii',
      'circuit-iii',
      'finishing-iv',
      'duels-v',
    ]) {
      expect(displayedDrillGain(state, drillId, 6)).toBe(6);
    }
  });
});
