import { z } from 'zod';

import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import {
  CorruptCareerSaveError,
  InvalidGameStateError,
  UnsupportedGameSchemaError,
} from './errors';

const safeInteger = z
  .number()
  .refine(Number.isSafeInteger, 'must be a safe integer');
const nonnegativeInteger = safeInteger.refine(
  (value) => value >= 0,
  'must be nonnegative',
);
const positiveInteger = safeInteger.refine(
  (value) => value > 0,
  'must be positive',
);
const uint32 = nonnegativeInteger.refine(
  (value) => value <= 4294967295,
  'must fit uint32',
);
const nonemptyString = z.string().min(1);
const playerAttribute = positiveInteger.refine(
  (value) => value <= 99,
  'must be at most 99',
);

const clubSchema = z
  .object({
    id: nonemptyString,
    name: nonemptyString,
    cash: safeInteger,
    fans: nonnegativeInteger,
    ticketPrice: nonnegativeInteger,
    sponsorMonthlyFee: nonnegativeInteger,
    weeklyWages: nonnegativeInteger,
  })
  .passthrough();

const scoreSchema = z
  .object({
    homeGoals: nonnegativeInteger,
    awayGoals: nonnegativeInteger,
  })
  .passthrough();

const fixtureSchema = z
  .object({
    id: nonemptyString,
    season: positiveInteger,
    round: positiveInteger,
    week: positiveInteger,
    homeClubId: nonemptyString,
    awayClubId: nonemptyString,
    matchSeed: uint32,
    status: z.enum(['scheduled', 'played']),
    score: scoreSchema.optional(),
  })
  .passthrough()
  .superRefine((fixture, context) => {
    if (fixture.status === 'played' && fixture.score === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'played fixture needs a score',
      });
    }
    if (fixture.status === 'scheduled' && fixture.score !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'scheduled fixture cannot have a score',
      });
    }
  });

const ledgerLineSchema = z
  .object({
    kind: z.enum(['tickets', 'sponsor', 'prize', 'wages', 'subsidy']),
    label: nonemptyString,
    amount: safeInteger,
  })
  .passthrough();

const ledgerSchema = z
  .object({
    season: positiveInteger,
    week: positiveInteger,
    lines: z.array(ledgerLineSchema),
    balanceAfter: safeInteger,
  })
  .passthrough();

const attributesSchema = z
  .object({
    pac: playerAttribute,
    sho: playerAttribute,
    pas: playerAttribute,
    def: playerAttribute,
    tec: playerAttribute,
    sta: playerAttribute,
    ref: playerAttribute,
  })
  .passthrough();

const playerSchema = z
  .object({
    id: nonemptyString,
    clubId: nonemptyString,
    name: nonemptyString,
    role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
    attrs: attributesSchema,
    power: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']).optional(),
    licensed: z.boolean(),
    weeklyWage: nonnegativeInteger,
    onHeroWage: z.boolean(),
    contractSeasonsRemaining: nonnegativeInteger,
    morale: nonnegativeInteger.refine(
      (value) => value <= 100,
      'must be at most 100',
    ),
    injuryWeeks: nonnegativeInteger,
  })
  .passthrough();

const lineupSchema = z
  .object({
    clubId: nonemptyString,
    playerIds: z.array(nonemptyString),
  })
  .passthrough();

const facilitiesSchema = z
  .object({
    trainingGroundBuilt: z.boolean(),
  })
  .passthrough();

const eventClockSchema = z
  .object({
    weeksWithoutEvent: nonnegativeInteger,
    riskyChoices: nonnegativeInteger,
  })
  .passthrough();

const pendingEventSchema = z
  .object({
    eventId: nonemptyString,
    selectedPlayerId: nonemptyString.optional(),
    resolvedChoiceId: nonemptyString.optional(),
    outcomeText: nonemptyString.optional(),
  })
  .passthrough();

const onboardingSchema = z
  .object({
    stage: z.enum(['create-player', 'first-match', 'collapse', 'reveal', 'complete']),
    createdPlayerId: nonemptyString.optional(),
    firstFixtureId: nonemptyString.optional(),
    selectedOrigin: z.enum(['CHEMICAL', 'CREATURE', 'SERUM']).optional(),
    awakenedPower: z.enum(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']).optional(),
  })
  .passthrough()
  .superRefine((onboarding, context) => {
    if (onboarding.stage === 'create-player') return;
    if (onboarding.createdPlayerId === undefined) {
      context.addIssue({ code: 'custom', path: ['createdPlayerId'], message: 'is required after creation' });
    }
    if (onboarding.firstFixtureId === undefined) {
      context.addIssue({ code: 'custom', path: ['firstFixtureId'], message: 'is required after creation' });
    }
    if (onboarding.stage === 'reveal' || onboarding.stage === 'complete') {
      if (onboarding.selectedOrigin === undefined) {
        context.addIssue({ code: 'custom', path: ['selectedOrigin'], message: 'is required after awakening' });
      }
      if (onboarding.awakenedPower === undefined) {
        context.addIssue({ code: 'custom', path: ['awakenedPower'], message: 'is required after awakening' });
      }
    }
  });

const gameStateSchema = z
  .object({
    schemaVersion: z.literal(GAME_SCHEMA_VERSION),
    careerSeed: uint32,
    userClubId: nonemptyString,
    season: positiveInteger,
    week: positiveInteger,
    phase: z.enum(['manage', 'matchday', 'season-end', 'complete']),
    clubs: z.array(clubSchema).length(10),
    fixtures: z.array(fixtureSchema),
    players: z.array(playerSchema),
    lineups: z.array(lineupSchema),
    facilities: facilitiesSchema,
    eventClock: eventClockSchema,
    eventFlags: z.array(nonemptyString),
    resolvedEventIds: z.array(nonemptyString),
    pendingEvent: pendingEventSchema.optional(),
    onboarding: onboardingSchema.optional(),
    trainingPoints: nonnegativeInteger,
    heroEssence: nonnegativeInteger,
    ledgers: z.array(ledgerSchema),
  })
  .passthrough()
  .superRefine((state, context) => {
    const clubIds = new Set<string>();
    for (let index = 0; index < state.clubs.length; index += 1) {
      const clubId = state.clubs[index].id;
      if (clubIds.has(clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['clubs', index, 'id'],
          message: 'club ID must be unique',
        });
      }
      clubIds.add(clubId);
    }
    if (!clubIds.has(state.userClubId)) {
      context.addIssue({
        code: 'custom',
        path: ['userClubId'],
        message: 'user club does not exist',
      });
    }

    const fixtureIds = new Set<string>();
    for (let index = 0; index < state.fixtures.length; index += 1) {
      const fixture = state.fixtures[index];
      if (fixtureIds.has(fixture.id)) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index, 'id'],
          message: 'fixture ID must be unique',
        });
      }
      fixtureIds.add(fixture.id);
      if (
        !clubIds.has(fixture.homeClubId) ||
        !clubIds.has(fixture.awayClubId)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index],
          message: 'fixture references an unknown club',
        });
      }
      if (fixture.homeClubId === fixture.awayClubId) {
        context.addIssue({
          code: 'custom',
          path: ['fixtures', index],
          message: 'fixture clubs must be different',
        });
      }
    }

    const playerIds = new Set<string>();
    const playerClubById = new Map<string, string>();
    for (let index = 0; index < state.players.length; index += 1) {
      const player = state.players[index];
      if (playerIds.has(player.id)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'id'],
          message: 'player ID must be unique',
        });
      }
      playerIds.add(player.id);
      playerClubById.set(player.id, player.clubId);
      if (!clubIds.has(player.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'clubId'],
          message: 'player references an unknown club',
        });
      }
    }

    if (state.onboarding?.createdPlayerId !== undefined
      && !playerIds.has(state.onboarding.createdPlayerId)) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'createdPlayerId'],
        message: 'created player does not exist',
      });
    }
    if (state.onboarding?.firstFixtureId !== undefined
      && !fixtureIds.has(state.onboarding.firstFixtureId)) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'firstFixtureId'],
        message: 'first fixture does not exist',
      });
    }
    const onboardingPlayer = state.onboarding?.createdPlayerId === undefined
      ? undefined
      : state.players.find(player => player.id === state.onboarding?.createdPlayerId);
    if (onboardingPlayer !== undefined && onboardingPlayer.clubId !== state.userClubId) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'createdPlayerId'],
        message: 'created player must belong to the user club',
      });
    }
    if (
      state.onboarding?.awakenedPower !== undefined
      && (
        onboardingPlayer?.power !== state.onboarding.awakenedPower
        || onboardingPlayer.licensed !== true
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'awakenedPower'],
        message: 'awakened power must be licensed on the created player',
      });
    }

    const lineupClubIds = new Set<string>();
    if ((state.players.length === 0) !== (state.lineups.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['lineups'],
        message: 'career players and lineups must be present together',
      });
    }
    if (
      state.players.length > 0 &&
      state.lineups.length !== state.clubs.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lineups'],
        message: 'full career state needs one lineup per club',
      });
    }
    for (let index = 0; index < state.lineups.length; index += 1) {
      const lineup = state.lineups[index];
      if (!clubIds.has(lineup.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'clubId'],
          message: 'lineup references an unknown club',
        });
      }
      if (lineupClubIds.has(lineup.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'clubId'],
          message: 'club can have only one lineup',
        });
      }
      lineupClubIds.add(lineup.clubId);

      if (lineup.playerIds.length !== 11) {
        context.addIssue({
          code: 'custom',
          path: ['lineups', index, 'playerIds'],
          message: 'lineup must contain 11 players',
        });
      }

      const lineupPlayerIds = new Set<string>();
      for (
        let playerIndex = 0;
        playerIndex < lineup.playerIds.length;
        playerIndex += 1
      ) {
        const playerId = lineup.playerIds[playerIndex];
        if (lineupPlayerIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup player ID must be unique',
          });
        }
        lineupPlayerIds.add(playerId);
        if (!playerIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup references an unknown player',
          });
        } else if (playerClubById.get(playerId) !== lineup.clubId) {
          context.addIssue({
            code: 'custom',
            path: ['lineups', index, 'playerIds', playerIndex],
            message: 'lineup player belongs to another club',
          });
        }
      }
    }
  });

export function serializeGameState(state: GameState): string {
  assertSupportedSchema(state, false);
  let validation: z.ZodSafeParseResult<unknown>;
  try {
    validation = gameStateSchema.safeParse(state);
  } catch {
    throw new InvalidGameStateError('validation failed unexpectedly');
  }
  if (!validation.success) {
    throw new InvalidGameStateError(formatIssues(validation.error.issues));
  }

  try {
    const serialized = JSON.stringify(state);
    if (serialized === undefined)
      throw new Error('JSON.stringify returned undefined');
    return serialized;
  } catch {
    throw new InvalidGameStateError('state is not JSON-serializable');
  }
}

export function parseStoredGameState(serialized: string): GameState {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new CorruptCareerSaveError('state_json is not valid JSON');
  }

  assertSupportedSchema(value, true);
  let validation: z.ZodSafeParseResult<unknown>;
  try {
    validation = gameStateSchema.safeParse(value);
  } catch {
    throw new CorruptCareerSaveError('state validation failed unexpectedly');
  }
  if (!validation.success) {
    throw new CorruptCareerSaveError(formatIssues(validation.error.issues));
  }
  return validation.data as GameState;
}

function assertSupportedSchema(value: unknown, stored: boolean): void {
  if (!isRecord(value) || !Number.isSafeInteger(value.schemaVersion)) {
    if (stored)
      throw new CorruptCareerSaveError('schemaVersion is missing or invalid');
    throw new InvalidGameStateError('schemaVersion is missing or invalid');
  }
  if (value.schemaVersion !== GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(
      value.schemaVersion as number,
      GAME_SCHEMA_VERSION,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'state'} ${issue.message}`)
    .join('; ');
}
