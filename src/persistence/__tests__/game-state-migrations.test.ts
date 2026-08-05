import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { GAME_SCHEMA_VERSION } from '../../game/types';
import {
  migrateStoredGameState,
  parseStoredGameState,
  serializeGameState,
} from '../game-state-codec';
import { CorruptCareerSaveError, UnsupportedGameSchemaError } from '../errors';

type MutableRecord = Record<string, unknown>;

describe('stored game state migrations', () => {
  it('passes a save already at the current version through unchanged', () => {
    const save = { schemaVersion: GAME_SCHEMA_VERSION, season: 3, userClubId: 'c1' };

    expect(migrateStoredGameState(save)).toEqual(save);
  });

  it('refuses a save written by a newer build rather than guessing', () => {
    const save = { schemaVersion: GAME_SCHEMA_VERSION + 1 };

    expect(() => migrateStoredGameState(save)).toThrow(UnsupportedGameSchemaError);
  });

  it('walks a representative schema-2 career through 2 -> 3 -> 4', () => {
    const legacy = schema3Career();
    legacy.schemaVersion = 2;
    delete legacy.playerRequestRules;
    delete legacy.playerRequests;

    const migrated = migrateStoredGameState(legacy) as MutableRecord;

    expect(migrated.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(migrated.clubBusiness).toEqual(expect.objectContaining({
      supporters: { consecutiveLosses: 0 },
      pendingUserMatchImpacts: [],
      sponsorship: { activeContracts: [], offers: [], portfolioSeason: 1 },
      buzz: { value: 0 },
    }));
  });

  it('round-trips a representative schema-3 career through the final schema', () => {
    const legacy = schema3Career();
    const restored = parseStoredGameState(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(restored.clubBusiness.pendingUserMatchImpacts).toEqual([]);
    expect(restored.clubBusiness.supporters).toEqual({ consecutiveLosses: 0 });
    expect(parseStoredGameState(serializeGameState(restored))).toEqual(restored);
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
      const userClub = clubs.find(club => club.id === legacy.userClubId)!;
      userClub.sponsorMonthlyFee = 4_123;

      const migrated = migrateStoredGameState(legacy) as MutableRecord;
      const business = migrated.clubBusiness as MutableRecord;
      const sponsorship = business.sponsorship as MutableRecord;
      const contracts = sponsorship.activeContracts as MutableRecord[];

      expect(contracts).toHaveLength(expectedSlots);
      expect(contracts.reduce(
        (sum, contract) => sum + (contract.nominalMonthlyFee as number),
        0,
      )).toBe(expectedSlots === 0 ? 0 : 4_123);
      expect(userClub.sponsorMonthlyFee).toBe(4_123);
      expect(migrated.sponsorRules).toBeUndefined();
      expect(contracts.every(contract => (
        contract.provisional === true
        && contract.objective === undefined
        && contract.profile === undefined
      ))).toBe(true);
    },
  );

  it.each([
    {
      label: 'Season 2 Week 30', season: 2, week: 30, phase: 'season-end',
      ledgerWeeks: [30], expected: { value: 0 },
    },
    {
      label: 'Week 2', season: 3, week: 2, phase: 'manage',
      ledgerWeeks: [], expected: { value: 0, lastSettledSeason: 2, lastSettledHalf: 2 },
    },
    {
      label: 'Week 4 before settlement', season: 3, week: 4, phase: 'matchday',
      ledgerWeeks: [], expected: { value: 0, lastSettledSeason: 2, lastSettledHalf: 2 },
    },
    {
      label: 'Week 5', season: 3, week: 5, phase: 'manage',
      ledgerWeeks: [4], expected: { value: 0, lastSettledSeason: 2, lastSettledHalf: 2 },
    },
    {
      label: 'Week 15 before settlement', season: 3, week: 15, phase: 'matchday',
      ledgerWeeks: [], expected: { value: 0, lastSettledSeason: 2, lastSettledHalf: 2 },
    },
    {
      label: 'Week 15 after settlement despite stale phase', season: 3, week: 15, phase: 'matchday',
      ledgerWeeks: [15], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 1 },
    },
    {
      label: 'Week 16', season: 3, week: 16, phase: 'manage',
      ledgerWeeks: [15], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 1 },
    },
    {
      label: 'Week 30 before settlement', season: 3, week: 30, phase: 'matchday',
      ledgerWeeks: [15], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 1 },
    },
    {
      label: 'Week 30 after ledger despite stale phase', season: 3, week: 30, phase: 'matchday',
      ledgerWeeks: [15, 30], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 2 },
    },
    {
      label: 'Week 30 season end', season: 3, week: 30, phase: 'season-end',
      ledgerWeeks: [15], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 2 },
    },
    {
      label: 'next-season Week 1', season: 4, week: 1, phase: 'manage',
      ledgerWeeks: [], expected: { value: 0, lastSettledSeason: 3, lastSettledHalf: 2 },
    },
  ] as const)('maps the Buzz boundary without cash: $label', testCase => {
    const legacy = schema3Career();
    legacy.season = testCase.season;
    legacy.week = testCase.week;
    legacy.phase = testCase.phase;
    legacy.ledgers = testCase.ledgerWeeks.map(week => ({
      season: testCase.season,
      week,
      lines: [],
      balanceAfter: 31_337,
    }));
    const clubsBefore = JSON.parse(JSON.stringify(legacy.clubs));
    const ledgersBefore = JSON.parse(JSON.stringify(legacy.ledgers));

    const migrated = migrateStoredGameState(legacy) as MutableRecord;
    const business = migrated.clubBusiness as MutableRecord;

    expect(business.buzz).toEqual(testCase.expected);
    expect(migrated.clubs).toEqual(clubsBefore);
    expect(migrated.ledgers).toEqual(ledgersBefore);
  });

  it.each([
    ['clubBusiness', (legacy: MutableRecord) => { legacy.clubBusiness = {}; }],
    ['sponsorRules', (legacy: MutableRecord) => { legacy.sponsorRules = {}; }],
    ['capitalInvested', (legacy: MutableRecord) => {
      const facilities = legacy.facilities as MutableRecord;
      const grid = facilities.grid as MutableRecord;
      grid.buildings = [{
        id: 'facility-1', type: 'gym', level: 1, capitalInvested: 7_000, x: 0, y: 0,
      }];
    }],
  ] as const)('refuses contaminated schema-3 %s data', (_label, contaminate) => {
    const legacy = schema3Career();
    contaminate(legacy);

    expect(() => migrateStoredGameState(legacy)).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState(legacy)).toThrow(/cannot be remigrated/);
  });

  it('cannot serialize schema-4 fields under a schema-3 version stamp', () => {
    const current = createCareer(createLaunchCareerSetup(20260809));
    const wronglyStamped = { ...current, schemaVersion: 3 };

    expect(() => serializeGameState(wronglyStamped, { validate: false }))
      .toThrow(UnsupportedGameSchemaError);
  });

  it('refuses an older save when no rung covers its version', () => {
    expect(() => migrateStoredGameState({ schemaVersion: 0 })).toThrow(UnsupportedGameSchemaError);
  });

  it('reports a missing or non-integer schemaVersion as a corrupt save', () => {
    expect(() => migrateStoredGameState({})).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState({ schemaVersion: 1.5 })).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState('not an object')).toThrow(CorruptCareerSaveError);
  });

  it('names both versions in the error so a downgrade is diagnosable', () => {
    expect(() => migrateStoredGameState({ schemaVersion: 99 }))
      .toThrow(`game state schema 99 is unsupported; this build supports schema ${GAME_SCHEMA_VERSION}`);
  });
});

function schema3Career(): MutableRecord {
  const legacy = JSON.parse(JSON.stringify(
    createCareer(createLaunchCareerSetup(20260805)),
  )) as MutableRecord;
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
