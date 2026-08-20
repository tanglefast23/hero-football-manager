import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { CorruptCareerSaveError, InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

function fullClubBusinessCareer(): GameState {
  const state = createCareer(createLaunchCareerSetup(20260808));
  return {
    ...state,
    clubBusiness: {
      supporters: {
        consecutiveLosses: 3,
        lastAppliedImpact: {
          season: 3,
          week: 8,
          before: 1_200,
          after: 1_197,
          totalDelta: -3,
          impacts: [
            {
              fixtureId: 'league-s3-r8',
              outcome: 'LOSS',
              streakAfter: 3,
              resultDelta: -6,
              heroDelta: 3,
              realizedDelta: -3,
            },
          ],
        },
      },
      pendingUserMatchImpacts: [
        {
          fixtureId: 'league-s3-r9',
          competition: 'LEAGUE',
          settlementOrder: 0,
          source: 'PRODUCTION',
          outcome: 'WIN',
          regulationGoals: 3,
          participantPlayerIds: ['hero-1', 'player-2'],
          powerFiredPlayerIds: ['hero-1'],
          heroAppearancePlayerIds: ['hero-1'],
          divisionScale: 2,
          supporterWinUnits: 10,
          supporterHeroUnits: 2,
        },
      ],
      sponsorship: {
        activeContracts: [
          {
            contractId: 'contract-s3-slot0',
            sponsorContentId: 'northstar-tools',
            sponsorName: 'Northstar Tools',
            offerLine: 'Build something worth cheering for.',
            season: 3,
            slot: 0,
            nominalMonthlyFee: 4_200,
            profile: 'STEADY',
            objective: {
              kind: 'LEAGUE_WINS',
              label: 'Win 5 league matches',
              target: 5,
              nominalBonus: 1_000,
            },
            provisional: false,
            signedSeason: 3,
            signedWeek: 2,
            replacedContinuity: true,
            objectiveOutcome: {
              met: true,
              settledSeason: 3,
              actualBonus: 1_000,
            },
          },
        ],
        offers: [
          {
            offerId: 'offer-s3-slot1-balanced',
            sponsorContentId: 'pixel-peak-mobile',
            sponsorName: 'Pixel Peak Mobile',
            offerLine: 'Every highlight, right in your pocket.',
            season: 3,
            slot: 1,
            profile: 'BALANCED',
            nominalMonthlyFee: 3_000,
            objective: {
              kind: 'LEAGUE_GOALS',
              label: 'Score 26 league goals',
              target: 26,
              nominalBonus: 3_000,
            },
          },
        ],
        portfolioSeason: 3,
        offerSeason: 3,
        weeklyChallenge: {
          id: 'sponsor-sprint-s3',
          kind: 'CLEAN_SHEET',
          sponsorName: 'Northstar Tools',
          season: 3,
          chosenWeek: 15,
          fixtureId: 'league-s3-r16',
          fixtureWeek: 16,
          nominalBonus: 8_400,
        },
      },
    },
  };
}

describe('Club Business game-state persistence', () => {
  test('round-trips every persisted sidecar and baked sponsor-rule shape', () => {
    const state = fullClubBusinessCareer();

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored.clubBusiness).toEqual(state.clubBusiness);
    expect(restored.sponsorRules).toEqual(state.sponsorRules);
  });

  test('keeps early schema-4 sponsor rules readable before family overrides existed', () => {
    const stored = JSON.parse(serializeGameState(fullClubBusinessCareer())) as {
      sponsorRules: {
        profiles: Record<
          'STEADY' | 'BALANCED' | 'BOLD',
          {
            bonusPercentByObjective?: unknown;
          }
        >;
      };
    };
    delete stored.sponsorRules.profiles.STEADY.bonusPercentByObjective;
    delete stored.sponsorRules.profiles.BALANCED.bonusPercentByObjective;
    delete stored.sponsorRules.profiles.BOLD.bonusPercentByObjective;

    const restored = parseStoredGameState(JSON.stringify(stored));

    expect(
      restored.sponsorRules?.profiles.STEADY.bonusPercentByObjective,
    ).toBeUndefined();
    expect(restored.sponsorRules?.profiles.BOLD.bonusPercent).toBe(650);
  });

  test('rejects unknown fields inside strict persisted snapshots', () => {
    const state = fullClubBusinessCareer();
    const contaminated = JSON.parse(JSON.stringify(state)) as GameState & {
      clubBusiness: GameState['clubBusiness'] & {
        pendingUserMatchImpacts: Array<Record<string, unknown>>;
      };
    };
    contaminated.clubBusiness.pendingUserMatchImpacts[0].inventedReward = 99;

    expect(() => serializeGameState(contaminated as GameState)).toThrow(
      InvalidGameStateError,
    );
    expect(() => serializeGameState(contaminated as GameState)).toThrow(
      /inventedReward|unrecognized/i,
    );
    expect(() => parseStoredGameState(JSON.stringify(contaminated))).toThrow(
      CorruptCareerSaveError,
    );
  });

  test('rejects inconsistent pending-impact ordering', () => {
    const state = fullClubBusinessCareer();
    const invalid = {
      ...state,
      clubBusiness: {
        ...state.clubBusiness,
        pendingUserMatchImpacts: state.clubBusiness.pendingUserMatchImpacts.map(
          (impact) => ({
            ...impact,
            settlementOrder: 1 as const,
          }),
        ),
      },
    };

    expect(() => serializeGameState(invalid as GameState)).toThrow(
      /settlementOrder/,
    );
  });

  test('migrates schema 5 saves by dropping retired Buzz state', () => {
    const stored = JSON.parse(serializeGameState(fullClubBusinessCareer())) as {
      schemaVersion: number;
      clubBusiness: {
        buzz?: unknown;
        pendingUserMatchImpacts: Array<Record<string, unknown>>;
      };
    };
    stored.schemaVersion = 5;
    stored.clubBusiness.buzz = { value: 64 };
    (stored as unknown as { eventFlags: string[] }).eventFlags.push(
      'guide:bert:inbox:queued:sponsor-buzz',
      'guide:bert:sponsor-desk:first-delivered:s3:w1:guide:sponsor-desk',
    );
    Object.assign(stored.clubBusiness.pendingUserMatchImpacts[0], {
      buzzWin: 4,
      buzzGoals: 3,
      buzzHeroMoments: 2,
    });

    const restored = parseStoredGameState(JSON.stringify(stored));

    expect(restored.schemaVersion).toBe(6);
    expect(restored.clubBusiness).not.toHaveProperty('buzz');
    expect(restored.clubBusiness.pendingUserMatchImpacts[0]).not.toHaveProperty(
      'buzzWin',
    );
    expect(
      restored.eventFlags.some((flag) => flag.includes('sponsor-buzz')),
    ).toBe(false);
  });

  test('rejects duplicate participant IDs before a loaded save can brick settlement', () => {
    const state = fullClubBusinessCareer();
    const duplicate = {
      ...state,
      clubBusiness: {
        ...state.clubBusiness,
        pendingUserMatchImpacts: state.clubBusiness.pendingUserMatchImpacts.map(
          (impact) => ({
            ...impact,
            participantPlayerIds: [
              impact.participantPlayerIds[0],
              impact.participantPlayerIds[0],
            ],
          }),
        ),
      },
    };

    expect(() => serializeGameState(duplicate as GameState)).toThrow(/unique/);
    expect(() => parseStoredGameState(JSON.stringify(duplicate))).toThrow(
      CorruptCareerSaveError,
    );
  });
});
