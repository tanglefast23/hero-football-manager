import { z } from 'zod';

import type { ReplayEnvelope } from '../sim/types';
import { ENGINE_VERSION, validateEnvelope } from '../sim/match';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { isPlayerLookIdForRole } from '../game/player-appearance';
import {
  CorruptReplayEnvelopeError,
  InvalidReplayEnvelopeError,
  UnsupportedReplayEngineError,
  UnsupportedReplaySchemaError,
} from './errors';

export const REPLAY_SCHEMA_VERSION = 1;

const safeInteger = z
  .number()
  .refine(Number.isSafeInteger, 'must be a safe integer');
const nonnegativeInteger = safeInteger.refine(
  (value) => value >= 0,
  'must be nonnegative',
);
const positiveInteger = safeInteger.refine(
  (value) => value >= 1,
  'input tick must be positive',
);
const uint32 = nonnegativeInteger.refine(
  (value) => value <= 4294967295,
  'must fit uint32',
);
const playerAttribute = safeInteger.refine(
  (value) => value >= 1 && value <= MAX_PLAYER_ATTRIBUTE,
  `must be from 1 to ${MAX_PLAYER_ATTRIBUTE}`,
);
const nonemptyString = z.string().min(1);

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

const replayPlayerSchema = z
  .object({
    id: nonemptyString,
    name: nonemptyString,
    role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
    lookId: nonemptyString.optional(),
    attrs: attributesSchema,
    // MAGNET_TOUCH was retired at M4; an envelope taped before the cut must
    // still parse, so it maps to the surviving utility power it became.
    power: z
      .enum([
        'SUPER_SPEED',
        'BLINK_RUN',
        'THUNDER_STRIKE',
        'FIRE_TORCH',
        'PHASE_RUN',
        'PORTAL_PASS',
        'MAGNET_TOUCH',
        'DECOY_DOUBLE',
        'FUTURE_SIGHT',
        'SUPER_STRENGTH',
        'WEB_TRAP',
        'ELASTIC_KEEPER',
        'RALLY_CRY',
        'ICE_RINK',
        'SHADOW_MARK',
        'GRAVITY_WELL',
        'GIANT_GK',
        'GUST',
      ])
      .optional()
      .transform((power) =>
        power === 'MAGNET_TOUCH' ? ('PORTAL_PASS' as const) : power,
      ),
    powerTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .passthrough()
  .superRefine((player, context) => {
    if (
      player.lookId !== undefined &&
      !isPlayerLookIdForRole(player.lookId, player.role)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lookId'],
        message: `must be a valid ${player.role} appearance`,
      });
    }
  });

const teamSchema = z
  .object({
    id: nonemptyString,
    name: nonemptyString,
    players: z.array(replayPlayerSchema).length(11),
    bench: z.array(replayPlayerSchema).optional(),
  })
  .passthrough()
  .superRefine((team, context) => {
    const playerIds = new Set<string>();
    for (let index = 0; index < team.players.length; index += 1) {
      const id = team.players[index].id;
      if (playerIds.has(id)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'id'],
          message: 'player ID must be unique within a team',
        });
      }
      playerIds.add(id);
    }
  });

const formationSchema = z.enum([
  '4-4-2',
  '4-3-3',
  '3-5-2',
  '5-3-2',
  '4-5-1',
  '3-4-3',
]);

const inputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('POWER_TAP'),
      player: nonnegativeInteger,
    })
    .passthrough(),
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('SET_AUTO_POWERS'),
      enabled: z.boolean(),
    })
    .passthrough(),
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('SET_FORMATION'),
      formation: formationSchema,
    })
    .passthrough(),
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('SET_MENTALITY'),
      mentality: z.enum(['BALANCED', 'ATTACK', 'PROTECT']),
    })
    .passthrough(),
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('SET_ENERGY_USE'),
      energyUse: z.enum(['SAVE_ENERGY', 'BALANCED', 'ALL_OUT']),
    })
    .passthrough(),
  z
    .object({
      tick: positiveInteger,
      kind: z.literal('SUBSTITUTE'),
      player: nonnegativeInteger,
      replacementId: nonemptyString,
    })
    .passthrough(),
]);

const matchOptionsSchema = z
  .object({
    homePolicy: z.enum(['SAVE_FOR_TAP', 'FIRE_WHEN_READY']).optional(),
    awayPolicy: z.enum(['SAVE_FOR_TAP', 'FIRE_WHEN_READY']).optional(),
    blindAutoHome: z.boolean().optional(),
    controlledTeam: z.union([z.literal(0), z.literal(1)]).optional(),
    homeFormation: formationSchema.optional(),
    awayFormation: formationSchema.optional(),
  })
  .passthrough();

const replayEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(REPLAY_SCHEMA_VERSION),
    engineVersion: nonemptyString,
    seed: uint32,
    home: teamSchema,
    away: teamSchema,
    inputs: z.array(inputSchema),
    opts: matchOptionsSchema.optional(),
  })
  .passthrough()
  .superRefine((envelope, context) => {
    if (envelope.home.id === envelope.away.id) {
      context.addIssue({
        code: 'custom',
        path: ['away', 'id'],
        message: 'home and away teams must be different',
      });
    }
    for (let index = 1; index < envelope.inputs.length; index += 1) {
      if (envelope.inputs[index].tick < envelope.inputs[index - 1].tick) {
        context.addIssue({
          code: 'custom',
          path: ['inputs', index, 'tick'],
          message: 'replay inputs must be ordered by tick',
        });
      }
    }
  });

export function serializeReplayEnvelope(envelope: ReplayEnvelope): string {
  assertSupportedSchema(envelope, false);
  const validation = safelyValidate(envelope, false);
  if (!validation.success) {
    throw new InvalidReplayEnvelopeError(formatIssues(validation.error.issues));
  }
  assertEngineValid(validation.data as ReplayEnvelope, false);

  try {
    const serialized = JSON.stringify(envelope);
    if (serialized === undefined)
      throw new Error('JSON.stringify returned undefined');
    return serialized;
  } catch {
    throw new InvalidReplayEnvelopeError('envelope is not JSON-serializable');
  }
}

export function parseStoredReplayEnvelope(serialized: string): ReplayEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new CorruptReplayEnvelopeError('envelope_json is not valid JSON');
  }

  assertSupportedSchema(value, true);
  const validation = safelyValidate(value, true);
  if (!validation.success) {
    throw new CorruptReplayEnvelopeError(formatIssues(validation.error.issues));
  }
  const envelope = validation.data as ReplayEnvelope;
  // Refused here rather than at replay time. An envelope taped by another
  // engine version is not corrupt, but replaying it desyncs silently: the
  // stored inputs consume the PRNG differently, so the match simply plays out
  // wrong instead of failing. `runReplay` makes the same comparison; making it
  // here means nothing can hand an unusable envelope to a caller in the first
  // place.
  if (envelope.engineVersion !== ENGINE_VERSION) {
    throw new UnsupportedReplayEngineError(
      envelope.engineVersion,
      ENGINE_VERSION,
    );
  }
  assertEngineValid(envelope, true);
  return envelope;
}

function assertEngineValid(envelope: ReplayEnvelope, stored: boolean): void {
  try {
    validateEnvelope(envelope);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (stored) throw new CorruptReplayEnvelopeError(message);
    throw new InvalidReplayEnvelopeError(message);
  }
}

function safelyValidate(
  value: unknown,
  stored: boolean,
): z.ZodSafeParseResult<unknown> {
  try {
    return replayEnvelopeSchema.safeParse(value);
  } catch {
    if (stored)
      throw new CorruptReplayEnvelopeError('validation failed unexpectedly');
    throw new InvalidReplayEnvelopeError('validation failed unexpectedly');
  }
}

function assertSupportedSchema(value: unknown, stored: boolean): void {
  if (!isRecord(value) || !Number.isSafeInteger(value.schemaVersion)) {
    if (stored)
      throw new CorruptReplayEnvelopeError(
        'schemaVersion is missing or invalid',
      );
    throw new InvalidReplayEnvelopeError('schemaVersion is missing or invalid');
  }
  if (value.schemaVersion !== REPLAY_SCHEMA_VERSION) {
    throw new UnsupportedReplaySchemaError(
      value.schemaVersion as number,
      REPLAY_SCHEMA_VERSION,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'envelope'} ${issue.message}`)
    .join('; ');
}
