import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { GAME_SCHEMA_VERSION } from '../../game/types';
import { createProvisionalSponsorPortfolio } from '../../game/sponsors';
import {
  migrateStoredGameState,
  parseStoredGameState,
  serializeGameState,
} from '../game-state-codec';
import { CorruptCareerSaveError, UnsupportedGameSchemaError } from '../errors';

type MutableRecord = Record<string, unknown>;

describe('stored game state migrations', () => {
  it('passes a save already at the current version through unchanged', () => {
    const save = {
      schemaVersion: GAME_SCHEMA_VERSION,
      season: 3,
      userClubId: 'c1',
    };

    expect(migrateStoredGameState(save)).toEqual(save);
  });

  it('refuses a save written by a newer build rather than guessing', () => {
    const save = { schemaVersion: GAME_SCHEMA_VERSION + 1 };

    expect(() => migrateStoredGameState(save)).toThrow(
      UnsupportedGameSchemaError,
    );
  });

  it('walks a representative schema-2 career through 2 -> 3 -> 4', () => {
    const legacy = schema3Career();
    legacy.schemaVersion = 2;
    delete legacy.playerRequestRules;
    delete legacy.playerRequests;

    const migrated = migrateStoredGameState(legacy) as MutableRecord;

    expect(migrated.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(migrated.clubBusiness).toEqual(
      expect.objectContaining({
        supporters: { consecutiveLosses: 0 },
        pendingUserMatchImpacts: [],
        sponsorship: { activeContracts: [], offers: [], portfolioSeason: 1 },
      }),
    );
  });

  it('round-trips a representative schema-3 career through the final schema', () => {
    const legacy = schema3Career();
    const restored = parseStoredGameState(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(restored.clubBusiness.pendingUserMatchImpacts).toEqual([]);
    expect(restored.clubBusiness.supporters).toEqual({ consecutiveLosses: 0 });
    expect(parseStoredGameState(serializeGameState(restored))).toEqual(
      restored,
    );
  });

  it('migrates schema-4 assistant wages, passive D5 sponsor, and paid Stadium Stand bases once', () => {
    const current = createCareer(createLaunchCareerSetup(20260806));
    const legacy = JSON.parse(JSON.stringify(current)) as MutableRecord;
    legacy.schemaVersion = 4;
    legacy.week = 5;
    const clubs = legacy.clubs as MutableRecord[];
    const userClub = clubs.find((club) => club.id === legacy.userClubId)!;
    userClub.cash = 1_000;
    userClub.sponsorMonthlyFee = 2_000;
    const market = legacy.market as MutableRecord;
    const candidates = market.coachCandidates as MutableRecord[];
    market.headCoach = candidates[0];
    market.assistantCoach = { ...candidates[1], weeklyWage: 500 };
    market.coachCandidates = candidates.slice(2);
    const ledgersBefore = JSON.parse(JSON.stringify(legacy.ledgers));
    legacy.cashTransactions = [
      {
        id: 'cash-transaction-economy-rebalance-v5-1',
        season: 1,
        week: 1,
        kind: 'facility-build',
        label: 'Existing history',
        amount: -1,
        balanceAfter: 1_000,
      },
    ];
    legacy.facilities = {
      trainingGroundBuilt: false,
      grid: {
        width: 8,
        height: 6,
        nextBuildingId: 6,
        buildings: [
          {
            id: 'stand-build',
            type: 'stadium-stand',
            level: 1,
            capitalInvested: 15_000,
            x: 0,
            y: 0,
          },
          {
            id: 'stand-upgraded',
            type: 'stadium-stand',
            level: 2,
            capitalInvested: 34_000,
            x: 2,
            y: 0,
          },
          {
            id: 'stand-seeded',
            type: 'stadium-stand',
            level: 1,
            capitalInvested: 0,
            x: 4,
            y: 0,
            seeded: true,
          },
          {
            id: 'stand-custom-low',
            type: 'stadium-stand',
            level: 1,
            capitalInvested: 12_000,
            x: 0,
            y: 2,
          },
          {
            id: 'stand-custom-high',
            type: 'stadium-stand',
            level: 1,
            capitalInvested: 20_000,
            x: 2,
            y: 2,
          },
        ],
        discoveredAdjacencies: [],
        construction: {
          kind: 'BUILD',
          buildingId: 'stand-build',
          type: 'stadium-stand',
          targetLevel: 1,
          weeksRemaining: 2,
          totalWeeks: 3,
        },
      },
    };

    const migrated = migrateStoredGameState(legacy) as MutableRecord;
    const migratedClub = (migrated.clubs as MutableRecord[]).find(
      (club) => club.id === migrated.userClubId,
    )!;
    const migratedMarket = migrated.market as MutableRecord;
    const assistant = migratedMarket.assistantCoach as MutableRecord;
    const facilities = migrated.facilities as MutableRecord;
    const grid = facilities.grid as MutableRecord;
    const buildings = grid.buildings as MutableRecord[];
    const transactions = migrated.cashTransactions as MutableRecord[];

    expect(migrated.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(assistant.weeklyWage).toBe(250);
    expect((migratedMarket.headCoach as MutableRecord).weeklyWage).toBe(
      (market.headCoach as MutableRecord).weeklyWage,
    );
    expect(migratedClub).toMatchObject({
      cash: 11_000,
      sponsorMonthlyFee: 3_000,
    });
    expect(
      buildings.map((building) => [building.id, building.capitalInvested]),
    ).toEqual([
      ['stand-build', 10_000],
      ['stand-upgraded', 29_000],
      ['stand-seeded', 0],
      ['stand-custom-low', 12_000],
      ['stand-custom-high', 20_000],
    ]);
    expect(transactions.at(-1)).toMatchObject({
      id: 'cash-transaction-economy-rebalance-v5-2',
      kind: 'balance-adjustment',
      label: 'Stadium Stand price protection',
      amount: 10_000,
      balanceAfter: 11_000,
      referenceId: 'economy-rebalance-v5',
    });
    expect(migrated.ledgers).toEqual(ledgersBefore);
    expect(parseStoredGameState(JSON.stringify(migrated))).toEqual(migrated);
  });

  it('preserves custom and managed sponsor values during schema-4 migration', () => {
    const custom = JSON.parse(
      JSON.stringify(createCareer(createLaunchCareerSetup(20260807))),
    ) as MutableRecord;
    custom.schemaVersion = 4;
    const customClub = (custom.clubs as MutableRecord[]).find(
      (club) => club.id === custom.userClubId,
    )!;
    customClub.sponsorMonthlyFee = 2_750;
    const migratedCustom = migrateStoredGameState(custom) as MutableRecord;
    expect(
      (migratedCustom.clubs as MutableRecord[]).find(
        (club) => club.id === migratedCustom.userClubId,
      )!.sponsorMonthlyFee,
    ).toBe(2_750);

    const managed = JSON.parse(JSON.stringify(custom)) as MutableRecord;
    managed.schemaVersion = 4;
    const managedClub = (managed.clubs as MutableRecord[]).find(
      (club) => club.id === managed.userClubId,
    )!;
    managedClub.sponsorMonthlyFee = 2_000;
    const business = managed.clubBusiness as MutableRecord;
    const sponsorship = business.sponsorship as MutableRecord;
    sponsorship.activeContracts = createProvisionalSponsorPortfolio(
      2_000,
      1,
      1,
    );
    const migratedManaged = migrateStoredGameState(managed) as MutableRecord;
    expect(
      (migratedManaged.clubs as MutableRecord[]).find(
        (club) => club.id === migratedManaged.userClubId,
      )!.sponsorMonthlyFee,
    ).toBe(2_000);
  });
  it.each([
    [5, 0],
    [4, 1],
    [3, 2],
    [2, 3],
  ] as const)(
    'preserves an exact sponsor scalar after highest Division %i with %i managed slots',
    (highestDivision, expectedSlots) => {
      const legacy = schema3Career();
      const m2 = legacy.m2 as MutableRecord;
      m2.highestDivisionReached = highestDivision;
      const clubs = legacy.clubs as MutableRecord[];
      const userClub = clubs.find((club) => club.id === legacy.userClubId)!;
      userClub.sponsorMonthlyFee = 4_123;

      const migrated = migrateStoredGameState(legacy) as MutableRecord;
      const business = migrated.clubBusiness as MutableRecord;
      const sponsorship = business.sponsorship as MutableRecord;
      const contracts = sponsorship.activeContracts as MutableRecord[];

      expect(contracts).toHaveLength(expectedSlots);
      expect(
        contracts.reduce(
          (sum, contract) => sum + (contract.nominalMonthlyFee as number),
          0,
        ),
      ).toBe(expectedSlots === 0 ? 0 : 4_123);
      expect(userClub.sponsorMonthlyFee).toBe(4_123);
      expect(migrated.sponsorRules).toBeUndefined();
      expect(
        contracts.every(
          (contract) =>
            contract.provisional === true &&
            contract.objective === undefined &&
            contract.profile === undefined,
        ),
      ).toBe(true);
    },
  );

  it.each([
    [
      'clubBusiness',
      (legacy: MutableRecord) => {
        legacy.clubBusiness = {};
      },
    ],
    [
      'sponsorRules',
      (legacy: MutableRecord) => {
        legacy.sponsorRules = {};
      },
    ],
    [
      'capitalInvested',
      (legacy: MutableRecord) => {
        const facilities = legacy.facilities as MutableRecord;
        const grid = facilities.grid as MutableRecord;
        grid.buildings = [
          {
            id: 'facility-1',
            type: 'gym',
            level: 1,
            capitalInvested: 7_000,
            x: 0,
            y: 0,
          },
        ];
      },
    ],
  ] as const)(
    'refuses contaminated schema-3 %s data',
    (_label, contaminate) => {
      const legacy = schema3Career();
      contaminate(legacy);

      expect(() => migrateStoredGameState(legacy)).toThrow(
        CorruptCareerSaveError,
      );
      expect(() => migrateStoredGameState(legacy)).toThrow(
        /cannot be remigrated/,
      );
    },
  );

  it('cannot serialize schema-4 fields under a schema-3 version stamp', () => {
    const current = createCareer(createLaunchCareerSetup(20260809));
    const wronglyStamped = { ...current, schemaVersion: 3 };

    expect(() =>
      serializeGameState(wronglyStamped, { validate: false }),
    ).toThrow(UnsupportedGameSchemaError);
  });

  it('refuses an older save when no rung covers its version', () => {
    expect(() => migrateStoredGameState({ schemaVersion: 0 })).toThrow(
      UnsupportedGameSchemaError,
    );
  });

  it('reports a missing or non-integer schemaVersion as a corrupt save', () => {
    expect(() => migrateStoredGameState({})).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState({ schemaVersion: 1.5 })).toThrow(
      CorruptCareerSaveError,
    );
    expect(() => migrateStoredGameState('not an object')).toThrow(
      CorruptCareerSaveError,
    );
  });

  it('names both versions in the error so a downgrade is diagnosable', () => {
    expect(() => migrateStoredGameState({ schemaVersion: 99 })).toThrow(
      `game state schema 99 is unsupported; this build supports schema ${GAME_SCHEMA_VERSION}`,
    );
  });
});

function schema3Career(): MutableRecord {
  const legacy = JSON.parse(
    JSON.stringify(createCareer(createLaunchCareerSetup(20260805))),
  ) as MutableRecord;
  legacy.schemaVersion = 3;
  delete legacy.clubBusiness;
  delete legacy.sponsorRules;
  const facilities = legacy.facilities as MutableRecord;
  const grid = facilities.grid as MutableRecord | undefined;
  if (grid !== undefined && Array.isArray(grid.buildings)) {
    for (const building of grid.buildings) {
      if (typeof building === 'object' && building !== null) {
        delete (building as MutableRecord).capitalInvested;
      }
    }
  }
  return legacy;
}
