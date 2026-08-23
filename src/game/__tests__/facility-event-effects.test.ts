import {
  applyFacilityEventEffect,
  selectCareerEventFacility,
} from '../career-events';
import { weeklyAmbientTrainingPoints } from '../career';
import {
  FACILITY_TRAINING_MULTIPLIER,
  instantTrainingPreview,
} from '../training';
import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { TRAINING_PITCH_TP_PER_LEVEL } from '../facilities';
import type { FacilityType, PlacedFacility } from '../facilities';
import type { GameState } from '../types';

/**
 * A facility boost that is stored but never read is the worst outcome here: the
 * save looks improved, the panel says so, and not one number moves. Every test
 * below asserts a *produced* figure, never that the field was written.
 */

function building(
  id: string,
  type: FacilityType,
  level: 1 | 2 | 3,
  x: number,
): PlacedFacility {
  return { id, type, level, capitalInvested: 1000, x, y: 0 };
}

function careerWith(buildings: PlacedFacility[]): GameState {
  const base = createCareer(createLaunchCareerSetup());
  return {
    ...base,
    pendingEvent: { eventId: 'a-story' },
    facilities: {
      trainingGroundBuilt: true,
      grid: {
        width: 8,
        height: 6,
        nextBuildingId: buildings.length + 1,
        buildings,
        discoveredAdjacencies: [],
      },
    },
  } as unknown as GameState;
}

describe('pointing a story at a building', () => {
  it('refuses one that is still going up', () => {
    const base = careerWith([building('facility-1', 'training-pitch', 1, 0)]);
    const mid = {
      ...base,
      facilities: {
        ...base.facilities,
        grid: {
          ...base.facilities.grid!,
          construction: {
            kind: 'BUILD' as const,
            buildingId: 'facility-1',
            type: 'training-pitch' as const,
            targetLevel: 1 as const,
            weeksRemaining: 1,
            totalWeeks: 2,
          },
        },
      },
    };
    expect(() => selectCareerEventFacility(mid, 'facility-1')).toThrow(
      'still under construction',
    );
  });

  it('accepts a finished one', () => {
    const state = careerWith([building('facility-1', 'training-pitch', 2, 0)]);
    expect(
      selectCareerEventFacility(state, 'facility-1').pendingEvent
        ?.selectedFacilityId,
    ).toBe('facility-1');
  });
});

describe('the boost reaches the number, not just the record', () => {
  it("moves the pitch's weekly training points", () => {
    const before = careerWith([building('facility-1', 'training-pitch', 2, 0)]);
    const after = applyFacilityEventEffect(
      before,
      'facility-1',
      'tpBonusPercent',
      20,
    );

    const pointsBefore = weeklyAmbientTrainingPoints(before);
    const pointsAfter = weeklyAmbientTrainingPoints(after);
    expect(pointsAfter).toBeGreaterThan(pointsBefore);
    // Derived from the constant rather than written out, because every weekly
    // TP source is scaled by TRAINING_POINT_SCALE_PERCENT and a literal would
    // go stale the next time that dial moves.
    const pitchContribution = 2 * TRAINING_PITCH_TP_PER_LEVEL;
    expect(pointsAfter - pointsBefore).toBe(
      Math.round(pitchContribution * 1.2) - pitchContribution,
    );
  });

  it('takes points away again when the story goes badly', () => {
    const before = careerWith([building('facility-1', 'training-pitch', 2, 0)]);
    const after = applyFacilityEventEffect(
      before,
      'facility-1',
      'tpBonusPercent',
      -15,
    );
    expect(weeklyAmbientTrainingPoints(after)).toBeLessThan(
      weeklyAmbientTrainingPoints(before),
    );
  });

  it('accumulates across stories and stops at the cap', () => {
    let state = careerWith([building('facility-1', 'training-pitch', 2, 0)]);
    for (let round = 0; round < 5; round += 1) {
      state = applyFacilityEventEffect(
        state,
        'facility-1',
        'tpBonusPercent',
        10,
      );
    }
    // Five +10s is +50 unclamped; the cap is +20.
    expect(state.facilities.grid?.buildings[0].boosts?.tpBonusPercent).toBe(20);
  });

  it('changes only the building the story pointed at', () => {
    let state = careerWith([
      building('facility-1', 'training-pitch', 2, 0),
      building('facility-2', 'gym', 1, 3),
    ]);
    state = applyFacilityEventEffect(
      state,
      'facility-2',
      'trainingBonusPercent',
      10,
    );
    expect(state.facilities.grid?.buildings[0].boosts).toBeUndefined();
    expect(
      state.facilities.grid?.buildings[1].boosts?.trainingBonusPercent,
    ).toBe(10);
  });

  it('refuses to change a building that is still going up', () => {
    const base = careerWith([building('facility-1', 'gym', 1, 0)]);
    const mid = {
      ...base,
      facilities: {
        ...base.facilities,
        grid: {
          ...base.facilities.grid!,
          construction: {
            kind: 'BUILD' as const,
            buildingId: 'facility-1',
            type: 'gym' as const,
            targetLevel: 1 as const,
            weeksRemaining: 1,
            totalWeeks: 2,
          },
        },
      },
    };
    expect(() =>
      applyFacilityEventEffect(mid, 'facility-1', 'trainingBonusPercent', 10),
    ).toThrow('still being built');
  });
});

describe('the training multiplier scales the bonus, not the whole thing', () => {
  it('uses the exact 10%, 15%, and 20% facility ladder', () => {
    expect(FACILITY_TRAINING_MULTIPLIER).toEqual([1, 1.1, 1.15, 1.2]);
  });

  /**
   * A level-3 gym adds 30% to the drill; that earned part sits above the 1.0
   * every club gets for free. A −20% boost must take a fifth of *that*, not
   * a fifth of the whole multiplier — otherwise a bad building drags a club
   * toward the result of owning nothing, and at a big enough negative it would
   * go below it.
   *
   * This uses the top drill tier because the smaller tier-one gain can bank a
   * fractional change without moving the first displayed integer. Exact results
   * still distinguish bonus-part scaling from whole-multiplier scaling.
   */
  it('takes its cut of the bonus only', () => {
    const topTier = (state: GameState): GameState => ({
      ...state,
      ownedTrainingTiers: { ...state.ownedTrainingTiers, sprints: 5 },
    });
    const neutralPacPlayer = (state: GameState): GameState => {
      const playerId = state.players.find(
        (player) => player.clubId === state.userClubId,
      )!.id;
      return {
        ...state,
        players: state.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                age: 25,
                role: 'MID' as const,
                archetype: 'Sniper' as const,
                trainingBonusRemainders: {},
              }
            : player,
        ),
      };
    };
    const none = neutralPacPlayer(topTier(careerWith([])));
    const gym = neutralPacPlayer(
      topTier(careerWith([building('facility-1', 'gym', 3, 0)])),
    );
    const worse = applyFacilityEventEffect(
      gym,
      'facility-1',
      'trainingBonusPercent',
      -20,
    );
    const better = applyFacilityEventEffect(
      gym,
      'facility-1',
      'trainingBonusPercent',
      20,
    );

    const noneResult = trainingResultFor(none);
    const gymResult = trainingResultFor(gym);
    const worseResult = trainingResultFor(worse);
    const betterResult = trainingResultFor(better);
    const startingPac = none.players.find(
      (player) => player.clubId === none.userClubId,
    )!.attrs.pac;
    const baseGain = noneResult - startingPac;
    const gymMultiplier = FACILITY_TRAINING_MULTIPLIER[3];
    expect(gymResult - startingPac).toBe(Math.round(baseGain * gymMultiplier));
    expect(worseResult - startingPac).toBe(
      Math.round(baseGain * (1 + (gymMultiplier - 1) * 0.8)),
    );
    expect(betterResult - startingPac).toBe(
      Math.round(baseGain * (1 + (gymMultiplier - 1) * 1.2)),
    );
    // Whatever the boost, a building never leaves the club worse off than
    // having no building at all.
    expect(worseResult).toBeGreaterThan(noneResult);
  });
});

/** The value a PAC drill would actually leave the player on — the gym's number. */
function trainingResultFor(state: GameState): number {
  const player = state.players.find(
    (candidate) => candidate.clubId === state.userClubId,
  )!;
  return instantTrainingPreview(state, player.id, 'sprints').adjustedAfter;
}
