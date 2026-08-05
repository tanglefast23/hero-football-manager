import { z } from 'zod';

import { createClubBusinessState } from '../game/club-business';
import { validateFacilityGrid } from '../game/facilities';
import {
  createProvisionalSponsorPortfolio,
  managedSponsorCapacity,
} from '../game/sponsors';
import { coachWeeklyWageForRole } from '../game/market-career';
import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import { isPlayerLookIdForRole } from '../game/player-appearance';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
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
const powerIdSchema = z.enum([
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
]);
const playerAttribute = positiveInteger.refine(
  value => value <= MAX_PLAYER_ATTRIBUTE,
  `must be at most ${MAX_PLAYER_ATTRIBUTE}`,
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
    kind: z.enum([
      'tickets',
      'sponsor',
      'buzz',
      'prize',
      'merch',
      'training',
      'facilities',
      'wages',
      'subsidy',
      'emergency-loan',
      'board-sale',
      'loan-repayment',
      'board-rescue',
    ]),
    label: nonemptyString,
    amount: safeInteger,
    idempotencyKey: nonemptyString.optional(),
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

const cashTransactionSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  week: positiveInteger,
  kind: z.enum([
    'facility-build',
    'facility-upgrade',
    'facility-relocation',
    'facility-closure',
    'training-upgrade',
    'scouting',
    'transfer-buy',
    'transfer-sell',
    'youth-signing',
    'coach-hiring',
    'coach-dismissal',
    'player-request',
    'event',
    'balance-adjustment',
  ]),
  label: nonemptyString,
  amount: safeInteger.refine(value => value !== 0, 'must be non-zero'),
  // Signed, like `ledgerSchema` above. Every kind here used to be a purchase,
  // which a club can only make with money, so the balance left after one was
  // always positive. Closing a facility is a credit and is deliberately
  // reachable while the club is under water — the difficulty cash floor parks
  // it at -15,000 or -30,000 — so the balance after one can be negative.
  balanceAfter: safeInteger,
  referenceId: nonemptyString.optional(),
}).passthrough();

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

const trainingRemaindersSchema = z
  .object({
    pac: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    sho: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    pas: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    def: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    tec: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    sta: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
    ref: nonnegativeInteger.refine(value => value < 100, 'must be at most 99').optional(),
  })
  .passthrough();

const playerSchema = z
  .object({
    id: nonemptyString,
    clubId: nonemptyString,
    name: nonemptyString,
    role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
    lookId: nonemptyString.optional(),
    createdAppearance: z.object({
      skinTone: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      hairstyle: z.union([
        z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
        z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9),
      ]),
      kitAccent: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    }).passthrough().optional(),
    attrs: attributesSchema,
    power: powerIdSchema.optional(),
    powerTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    licensed: z.boolean(),
    weeklyWage: nonnegativeInteger,
    onHeroWage: z.boolean(),
    contractSeasonsRemaining: nonnegativeInteger,
    contractPromise: z.object({
      perk: z.enum(['GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10']),
      agreedSeason: positiveInteger,
    }).passthrough().optional(),
    shirtNumber: positiveInteger.refine(value => value <= 99, 'must be at most 99').optional(),
    isCaptain: z.boolean().optional(),
    morale: nonnegativeInteger.refine(
      (value) => value <= 100,
      'must be at most 100',
    ),
    injuryWeeks: nonnegativeInteger,
    loyalty: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100').optional(),
    awayWeeks: nonnegativeInteger.refine(value => value <= 10, 'must be at most 10').optional(),
    age: positiveInteger.refine((value) => value <= 99, 'must be at most 99').optional(),
    archetype: z.enum([
      'Speedster', 'Sniper', 'Playmaker', 'Anchor', 'Wall', 'Engine', 'All-Rounder', 'Prodigy',
    ]).optional(),
    potential: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    potentialCeiling: positiveInteger.refine(
      (value) => value >= 46 && value <= 99,
      'must be from 46 to 99',
    ).optional(),
    consistency: nonnegativeInteger.refine((value) => value <= 100, 'must be at most 100').optional(),
    personality: z.enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid']).optional(),
    condition: nonnegativeInteger.refine((value) => value <= 100, 'must be at most 100').optional(),
    seasonsAtClub: nonnegativeInteger.optional(),
    fame: nonnegativeInteger.optional(),
    retirementAge: positiveInteger.refine((value) => value >= 33 && value <= 38, 'must be from 33 to 38').optional(),
    retirementAnnounced: z.boolean().optional(),
    retirementAnnouncementSeason: positiveInteger.optional(),
    consecutiveLowMoraleWeeks: nonnegativeInteger.optional(),
    transferRequested: z.boolean().optional(),
    motivatorMoraleRemainder: nonnegativeInteger.refine(
      (value) => value < 100,
      'must be at most 99',
    ).optional(),
    motivatorMoraleRemainderHalfPoints: nonnegativeInteger.refine(
      (value) => value < 200,
      'must be at most 199',
    ).optional(),
    signingStatTotal: positiveInteger.optional(),
    facilityStaBonusRemainder: nonnegativeInteger.refine(
      (value) => value < 100,
      'must be at most 99',
    ).optional(),
    coachTrainingBonusRemainders: trainingRemaindersSchema.optional(),
    trainingBonusRemainders: trainingRemaindersSchema.optional(),
    drillsSinceSuper: nonnegativeInteger.optional(),
    priorityDrillsRemaining: nonnegativeInteger.optional(),
    // Presentation only — how far a keeper's displayed Reflexes runs ahead of
    // the stored stat. `playerSchema` passes unknown keys through, so this line
    // is not what makes it survive a round trip; it is here to declare intent
    // and to fail a save that carries a nonsense value, like its neighbours.
    refDisplayBonus: nonnegativeInteger.optional(),
  })
  .passthrough()
  .superRefine((player, context) => {
    if (player.lookId !== undefined && !isPlayerLookIdForRole(player.lookId, player.role)) {
      context.addIssue({
        code: 'custom',
        path: ['lookId'],
        message: `must be a valid ${player.role} appearance`,
      });
    }
  });

const lineupSchema = z
  .object({
    clubId: nonemptyString,
    playerIds: z.array(nonemptyString),
  })
  .passthrough();

const facilityGridSchema = z
  .object({
    width: z.literal(8),
    height: z.literal(6),
    nextBuildingId: positiveInteger,
    buildings: z.array(z.object({
      id: nonemptyString,
      type: z.enum([
        'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
        'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
        'fan-shop', 'stadium-stand',
      ]),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      capitalInvested: nonnegativeInteger,
      x: nonnegativeInteger,
      y: nonnegativeInteger,
      seeded: z.literal(true).optional(),
    }).passthrough()),
    discoveredAdjacencies: z.array(z.enum([
      'gym-dorm', 'fan-shop-stadium', 'medical-training-pitch',
    ])),
    construction: z.object({
      kind: z.enum(['BUILD', 'UPGRADE']),
      buildingId: nonemptyString,
      type: z.enum([
        'training-pitch', 'gym', 'tech-center', 'shooting-range', 'keeper-court',
        'medical-bay', 'dorm', 'scout-office', 'coaching-office', 'youth-field',
        'fan-shop', 'stadium-stand',
      ]),
      targetLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      weeksRemaining: positiveInteger,
      totalWeeks: positiveInteger,
    }).passthrough().optional(),
  })
  .passthrough()
  .superRefine((grid, context) => {
    try {
      validateFacilityGrid(grid);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'invalid facility grid',
      });
    }
  });

const facilitiesSchema = z
  .object({
    trainingGroundBuilt: z.boolean(),
    grid: facilityGridSchema.optional(),
  })
  .passthrough();

const trainingGainsSchema = z
  .strictObject({
    pac: nonnegativeInteger.optional(),
    sho: nonnegativeInteger.optional(),
    pas: nonnegativeInteger.optional(),
    def: nonnegativeInteger.optional(),
    tec: nonnegativeInteger.optional(),
    sta: nonnegativeInteger.optional(),
    ref: nonnegativeInteger.optional(),
  })
  .refine(gains => Object.keys(gains).length > 0, 'must improve at least one attribute');

const trainingDrillSchema = z
  .object({
    id: nonemptyString,
    moneyCost: nonnegativeInteger,
    tpCost: nonnegativeInteger,
    gains: trainingGainsSchema,
  })
  .passthrough();

const trainingRulesSchema = z
  .object({
    focusDrills: z.array(trainingDrillSchema),
  })
  .passthrough();

/**
 * The baked player-request catalog.
 *
 * Deliberately loose — `.passthrough()` on the request entries, no re-check of
 * cost shapes. `src/content/schemas.ts` is the authority on what a valid
 * catalog is and validates it at load; repeating those rules here would be a
 * second copy to keep in step, and the only thing this file actually needs to
 * guarantee is that what comes back off disk is the shape the engine reads.
 */
const playerRequestRulesSchema = z
  .object({
    schemaVersion: z.literal(1),
    tuning: z
      .object({
        startSeason: positiveInteger,
        startWeek: positiveInteger,
        baseChancePercent: positiveInteger,
        starFameThreshold: nonnegativeInteger,
        starGoalRank: positiveInteger,
        minSeasonsAtClub: nonnegativeInteger,
        answerWeeks: positiveInteger,
        cadence: z.record(z.string(), z.object({
          minWeeks: positiveInteger,
          guaranteeWeeks: positiveInteger,
          starMinWeeks: positiveInteger,
          starGuaranteeWeeks: positiveInteger,
        }).passthrough()),
      })
      .passthrough(),
    requests: z.array(z.object({
      id: nonemptyString,
      title: nonemptyString,
      line: nonemptyString,
      art: z.array(nonemptyString),
      cost: z.object({ kind: nonemptyString }).passthrough(),
      grantBonus: z.object({ kind: nonemptyString }).passthrough().optional(),
    }).passthrough()),
  })
  .passthrough();

const sponsorProfileIdSchema = z.enum(['STEADY', 'BALANCED', 'BOLD']);
const sponsorObjectiveLevelSchema = z.enum(['EASY', 'NORMAL', 'HARD']);
const sponsorObjectiveKindSchema = z.enum([
  'LEAGUE_WINS',
  'LEAGUE_GOALS',
  'LEAGUE_FINISH',
]);
const sponsorSlotSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const sponsorBonusPercentByObjectiveSchema = z.strictObject({
  LEAGUE_WINS: nonnegativeInteger.optional(),
  LEAGUE_GOALS: nonnegativeInteger.optional(),
  LEAGUE_FINISH: nonnegativeInteger.optional(),
});

const sponsorRulesSchema = z.strictObject({
  brands: z.array(z.strictObject({
    id: nonemptyString,
    name: nonemptyString,
    offerLine: nonemptyString,
  })),
  profiles: z.strictObject({
    STEADY: z.strictObject({
      monthlyPercent: positiveInteger,
      objectiveLevel: sponsorObjectiveLevelSchema,
      bonusPercent: nonnegativeInteger,
      bonusPercentByObjective: sponsorBonusPercentByObjectiveSchema.optional(),
    }),
    BALANCED: z.strictObject({
      monthlyPercent: positiveInteger,
      objectiveLevel: sponsorObjectiveLevelSchema,
      bonusPercent: nonnegativeInteger,
      bonusPercentByObjective: sponsorBonusPercentByObjectiveSchema.optional(),
    }),
    BOLD: z.strictObject({
      monthlyPercent: positiveInteger,
      objectiveLevel: sponsorObjectiveLevelSchema,
      bonusPercent: nonnegativeInteger,
      bonusPercentByObjective: sponsorBonusPercentByObjectiveSchema.optional(),
    }),
  }),
  objectives: z.array(z.strictObject({
    id: nonemptyString,
    kind: sponsorObjectiveKindSchema,
    labelTemplate: nonemptyString,
    targets: z.strictObject({
      EASY: positiveInteger,
      NORMAL: positiveInteger,
      HARD: positiveInteger,
    }),
    chairmanDelta: safeInteger,
  })),
});

const sponsorObjectiveSnapshotSchema = z.strictObject({
  kind: sponsorObjectiveKindSchema,
  label: nonemptyString,
  target: positiveInteger,
  nominalBonus: nonnegativeInteger,
});

const sponsorObjectiveOutcomeSchema = z.strictObject({
  met: z.boolean(),
  settledSeason: positiveInteger,
  actualBonus: nonnegativeInteger,
});

const sponsorContractSnapshotSchema = z.strictObject({
  contractId: nonemptyString,
  sponsorContentId: nonemptyString,
  sponsorName: nonemptyString,
  offerLine: nonemptyString,
  season: positiveInteger,
  slot: sponsorSlotSchema,
  nominalMonthlyFee: nonnegativeInteger,
  profile: sponsorProfileIdSchema.optional(),
  objective: sponsorObjectiveSnapshotSchema.optional(),
  provisional: z.boolean(),
  signedSeason: positiveInteger.optional(),
  signedWeek: positiveInteger.optional(),
  replacedContinuity: z.boolean().optional(),
  objectiveOutcome: sponsorObjectiveOutcomeSchema.optional(),
});

const sponsorOfferSnapshotSchema = z.strictObject({
  offerId: nonemptyString,
  sponsorContentId: nonemptyString,
  sponsorName: nonemptyString,
  offerLine: nonemptyString,
  season: positiveInteger,
  slot: sponsorSlotSchema,
  profile: sponsorProfileIdSchema,
  nominalMonthlyFee: nonnegativeInteger,
  objective: sponsorObjectiveSnapshotSchema,
});

const sponsorshipStateSchema = z.strictObject({
  activeContracts: z.array(sponsorContractSnapshotSchema),
  offers: z.array(sponsorOfferSnapshotSchema),
  portfolioSeason: positiveInteger,
  offerSeason: positiveInteger.optional(),
}).superRefine((sponsorship, context) => {
  const contractIds = new Set<string>();
  const occupiedSlots = new Set<number>();
  sponsorship.activeContracts.forEach((contract, index) => {
    if (contractIds.has(contract.contractId)) {
      context.addIssue({
        code: 'custom',
        path: ['activeContracts', index, 'contractId'],
        message: 'active sponsor contract ID must be unique',
      });
    }
    if (occupiedSlots.has(contract.slot)) {
      context.addIssue({
        code: 'custom',
        path: ['activeContracts', index, 'slot'],
        message: 'active sponsor slot must be unique',
      });
    }
    if (contract.season !== sponsorship.portfolioSeason) {
      context.addIssue({
        code: 'custom',
        path: ['activeContracts', index, 'season'],
        message: 'must match the sponsor portfolio season',
      });
    }
    contractIds.add(contract.contractId);
    occupiedSlots.add(contract.slot);
  });

  const offerIds = new Set<string>();
  sponsorship.offers.forEach((offer, index) => {
    if (offerIds.has(offer.offerId)) {
      context.addIssue({
        code: 'custom',
        path: ['offers', index, 'offerId'],
        message: 'sponsor offer ID must be unique',
      });
    }
    if (offer.season !== sponsorship.portfolioSeason
      || offer.season !== sponsorship.offerSeason) {
      context.addIssue({
        code: 'custom',
        path: ['offers', index, 'season'],
        message: 'must match the active offer and portfolio season',
      });
    }
    offerIds.add(offer.offerId);
  });
});

const userMatchCompetitionSchema = z.enum(['LEAGUE', 'CUP']);
const userMatchOutcomeSchema = z.enum(['WIN', 'DRAW', 'LOSS']);

const pendingUserMatchImpactSchema = z.strictObject({
  fixtureId: nonemptyString,
  competition: userMatchCompetitionSchema,
  settlementOrder: z.union([z.literal(0), z.literal(1)]),
  source: z.enum(['PRODUCTION', 'SYNTHETIC']),
  outcome: userMatchOutcomeSchema,
  regulationGoals: nonnegativeInteger,
  participantPlayerIds: z.array(nonemptyString),
  powerFiredPlayerIds: z.array(nonemptyString),
  heroAppearancePlayerIds: z.array(nonemptyString),
  divisionScale: positiveInteger,
  supporterWinUnits: nonnegativeInteger,
  supporterHeroUnits: nonnegativeInteger,
  buzzWin: nonnegativeInteger,
  buzzGoals: nonnegativeInteger,
  buzzHeroMoments: nonnegativeInteger,
}).superRefine((impact, context) => {
  if ((impact.competition === 'LEAGUE' ? 0 : 1) !== impact.settlementOrder) {
    context.addIssue({
      code: 'custom',
      path: ['settlementOrder'],
      message: 'must order league before Cup',
    });
  }
  const participants = new Set(impact.participantPlayerIds);
  for (const [field, playerIds] of [
    ['participantPlayerIds', impact.participantPlayerIds],
    ['powerFiredPlayerIds', impact.powerFiredPlayerIds],
    ['heroAppearancePlayerIds', impact.heroAppearancePlayerIds],
  ] as const) {
    const seen = new Set<string>();
    playerIds.forEach((playerId, index) => {
      if (seen.has(playerId)) {
        context.addIssue({
          code: 'custom',
          path: [field, index],
          message: 'match player IDs must be unique',
        });
      }
      seen.add(playerId);
    });
  }
  for (const [field, playerIds] of [
    ['powerFiredPlayerIds', impact.powerFiredPlayerIds],
    ['heroAppearancePlayerIds', impact.heroAppearancePlayerIds],
  ] as const) {
    playerIds.forEach((playerId, index) => {
      if (!participants.has(playerId)) {
        context.addIssue({
          code: 'custom',
          path: [field, index],
          message: 'must reference a match participant',
        });
      }
    });
  }
});

const appliedSupporterImpactSummarySchema = z.strictObject({
  fixtureId: nonemptyString,
  outcome: userMatchOutcomeSchema,
  streakAfter: nonnegativeInteger,
  resultDelta: safeInteger,
  heroDelta: safeInteger,
  realizedDelta: safeInteger,
});

const supporterWeekSummarySchema = z.strictObject({
  season: positiveInteger,
  week: positiveInteger,
  before: nonnegativeInteger,
  after: nonnegativeInteger,
  totalDelta: safeInteger,
  impacts: z.array(appliedSupporterImpactSummarySchema),
});

const supporterBusinessStateSchema = z.strictObject({
  consecutiveLosses: nonnegativeInteger,
  lastAppliedImpact: supporterWeekSummarySchema.optional(),
});

const buzzMatchSummarySchema = z.strictObject({
  fixtureId: nonemptyString,
  win: nonnegativeInteger,
  goals: nonnegativeInteger,
  heroMoments: nonnegativeInteger,
  rawEarned: nonnegativeInteger,
});

const buzzSettlementSummarySchema = z.strictObject({
  season: positiveInteger,
  half: z.union([z.literal(1), z.literal(2)]),
  before: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  rawEarned: nonnegativeInteger,
  realizedEarned: nonnegativeInteger,
  prePayoutValue: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  payout: nonnegativeInteger,
  resetValue: z.literal(0),
  impacts: z.array(buzzMatchSummarySchema),
});

const buzzStateSchema = z.strictObject({
  value: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  lastSettledSeason: positiveInteger.optional(),
  lastSettledHalf: z.union([z.literal(1), z.literal(2)]).optional(),
  lastSettlementSummary: buzzSettlementSummarySchema.optional(),
}).superRefine((buzz, context) => {
  if ((buzz.lastSettledSeason === undefined) !== (buzz.lastSettledHalf === undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['lastSettledSeason'],
      message: 'season and half settlement markers must be present together',
    });
  }
  if (buzz.lastSettlementSummary !== undefined
    && (buzz.lastSettlementSummary.season !== buzz.lastSettledSeason
      || buzz.lastSettlementSummary.half !== buzz.lastSettledHalf)) {
    context.addIssue({
      code: 'custom',
      path: ['lastSettlementSummary'],
      message: 'must match the latest settlement marker',
    });
  }
});

const clubBusinessStateSchema = z.strictObject({
  supporters: supporterBusinessStateSchema,
  pendingUserMatchImpacts: z.array(pendingUserMatchImpactSchema),
  sponsorship: sponsorshipStateSchema,
  buzz: buzzStateSchema,
}).superRefine((business, context) => {
  const fixtureIds = new Set<string>();
  let previousOrder = -1;
  business.pendingUserMatchImpacts.forEach((impact, index) => {
    if (fixtureIds.has(impact.fixtureId)) {
      context.addIssue({
        code: 'custom',
        path: ['pendingUserMatchImpacts', index, 'fixtureId'],
        message: 'pending match impact must be unique',
      });
    }
    if (impact.settlementOrder < previousOrder) {
      context.addIssue({
        code: 'custom',
        path: ['pendingUserMatchImpacts', index, 'settlementOrder'],
        message: 'pending match impacts must settle league before Cup',
      });
    }
    fixtureIds.add(impact.fixtureId);
    previousOrder = impact.settlementOrder;
  });
});

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
    resolvedOutcomeIndex: nonnegativeInteger.optional(),
    resolvedRisky: z.boolean().optional(),
    resolvedSuccess: z.boolean().optional(),
    resolvedNextEventId: nonemptyString.optional(),
  })
  .passthrough();

const pendingAwakeningSchema = z
  .object({
    fixtureId: nonemptyString,
    playerId: nonemptyString,
    power: powerIdSchema,
    triggerId: nonemptyString,
    firstHero: z.boolean(),
  })
  .passthrough();

const awakeningSchema = z
  .object({
    matchesSinceLastAwakening: nonnegativeInteger,
    usedTriggerIds: z.array(nonemptyString).optional(),
    pending: pendingAwakeningSchema.optional(),
  })
  .passthrough();

const onboardingSchema = z
  .object({
    stage: z.enum(['create-player', 'first-match', 'collapse', 'reveal', 'complete']),
    createdPlayerId: nonemptyString.optional(),
    firstFixtureId: nonemptyString.optional(),
    selectedOrigin: z.enum(['CHEMICAL', 'CREATURE', 'SERUM']).optional(),
    awakenedPower: powerIdSchema.optional(),
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
      if (onboarding.awakenedPower === undefined) {
        context.addIssue({ code: 'custom', path: ['awakenedPower'], message: 'is required after awakening' });
      }
    }
  });

const seasonStatLineSchema = z
  .object({
    season: positiveInteger,
    playerId: nonemptyString,
    clubId: nonemptyString,
    competition: z.enum(['league', 'cup']),
    goals: nonnegativeInteger,
    assists: nonnegativeInteger,
    tacklesWon: nonnegativeInteger,
    saves: nonnegativeInteger,
    passesCompleted: nonnegativeInteger,
  })
  .passthrough();

const pendingPlayerRequestSchema = z
  .object({
    requestId: nonemptyString,
    playerId: nonemptyString,
    askedSeason: positiveInteger,
    askedWeek: positiveInteger,
    costAmount: nonnegativeInteger.optional(),
    warned: z.boolean(),
  })
  .passthrough();

const activeRequestEffectSchema = z
  .object({
    kind: z.enum(['DRILL_PLAYER', 'DRILL_SQUAD']),
    playerId: nonemptyString.optional(),
    weeksRemaining: positiveInteger.refine(value => value <= 30, 'must be at most 30'),
    multiplierPercent: positiveInteger
      .refine(value => value <= 200, 'must be at most 200')
      .optional(),
  })
  .passthrough();

const resolvedPlayerRequestSchema = z
  .object({
    requestId: nonemptyString,
    playerId: nonemptyString,
    season: positiveInteger,
    week: positiveInteger,
    resolution: z.enum(['GRANTED', 'REFUSED', 'LAPSED']),
    costAmount: nonnegativeInteger.optional(),
  })
  .passthrough();

const playerRequestStateSchema = z
  .object({
    weeksSinceRequest: nonnegativeInteger.refine(value => value <= 200, 'must be at most 200'),
    pending: pendingPlayerRequestSchema.optional(),
    effects: z.array(activeRequestEffectSchema).max(20),
    history: z.array(resolvedPlayerRequestSchema).max(40),
    lastAskingPlayerId: nonemptyString.optional(),
  })
  .passthrough();

const divisionLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);
const pyramidPlayerSchema = z.object({
  id: nonemptyString,
  clubId: nonemptyString,
  name: nonemptyString,
  role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
  lookId: nonemptyString.optional(),
  attrs: attributesSchema,
  archetype: z.enum([
    'Speedster', 'Sniper', 'Playmaker', 'Anchor', 'Wall', 'Engine', 'All-Rounder', 'Prodigy',
  ]),
  personality: z.enum(['Fiery', 'Loyal', 'Greedy', 'Joker', 'Professional', 'Timid']),
  age: positiveInteger,
  fame: nonnegativeInteger,
  seasonsAtClub: nonnegativeInteger,
  morale: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  condition: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  consecutiveLowMoraleWeeks: nonnegativeInteger,
  retirementAnnouncementSeason: positiveInteger.optional(),
}).passthrough().superRefine((player, context) => {
  if (player.lookId !== undefined && !isPlayerLookIdForRole(player.lookId, player.role)) {
    context.addIssue({
      code: 'custom',
      path: ['lookId'],
      message: `must be a valid ${player.role} appearance`,
    });
  }
});
const pyramidClubSchema = z.object({
  id: nonemptyString,
  name: nonemptyString,
  division: divisionLevelSchema,
  squadStrength: positiveInteger.refine(
    value => value <= MAX_PLAYER_ATTRIBUTE,
    `must be at most ${MAX_PLAYER_ATTRIBUTE}`,
  ),
  squad: z.array(pyramidPlayerSchema),
}).passthrough();
const cupFixtureSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  round: positiveInteger,
  homeClubId: nonemptyString,
  awayClubId: nonemptyString,
  matchSeed: uint32,
  status: z.enum(['scheduled', 'played']),
  score: scoreSchema.optional(),
  winnerClubId: nonemptyString.optional(),
}).passthrough();
const nationalCupSchema = z.object({
  careerSeed: uint32,
  season: positiveInteger,
  rounds: z.array(z.object({
    number: positiveInteger,
    label: z.enum(['Play-in', 'Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']),
    entrantClubIds: z.array(nonemptyString),
    byeClubIds: z.array(nonemptyString),
    fixtures: z.array(cupFixtureSchema),
    // A settled cup outside the bracket-retention window keeps its result and
    // gives up its rounds, so "has rounds" is no longer a shape invariant. The
    // cross-check below still requires them while a cup is being played.
  }).passthrough()),
  championClubId: nonemptyString.optional(),
  seedDivisionByClubId: z.record(nonemptyString, divisionLevelSchema).optional(),
}).passthrough();
const m2CareerSchema = z.object({
  schemaVersion: z.literal(2),
  careerSeed: uint32,
  userClubId: nonemptyString,
  opponentGrowthThroughSeason: positiveInteger,
  highestDivisionReached: divisionLevelSchema.optional(),
  pyramid: z.object({
    careerSeed: uint32,
    divisions: z.array(z.object({
      level: divisionLevelSchema,
      clubs: z.array(pyramidClubSchema).length(10),
    }).passthrough()).length(5),
  }).passthrough(),
  nationalCups: z.array(nationalCupSchema),
}).passthrough();

const marketPersonalitySchema = z.enum([
  'FIERY', 'LOYAL', 'GREEDY', 'JOKER', 'PROFESSIONAL', 'TIMID',
]);
// Passthrough like every other career-codec object: a field added to a focus
// later must survive a round trip instead of being silently stripped on load.
const scoutFocusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('POSITION'), role: z.enum(['GK', 'DEF', 'MID', 'FWD']) }).passthrough(),
  z.object({ kind: z.literal('AGE'), minimumAge: positiveInteger, maximumAge: positiveInteger }).passthrough(),
  z.object({ kind: z.literal('ELITE_PROSPECT') }).passthrough(),
  z.object({ kind: z.literal('RUMORED_HERO') }).passthrough(),
]);
const scoutMissionSchema = z.object({
  id: nonemptyString,
  missionSeed: uint32,
  startWeek: positiveInteger,
  dueWeek: positiveInteger,
  cost: nonnegativeInteger,
  region: z.enum(['LOCAL', 'EUROPE', 'SOUTH_AMERICA', 'AFRICA', 'ASIA']),
  focus: scoutFocusSchema,
  scoutOfficeLevel: divisionLevelSchema.refine(value => value <= 3, 'must be at most 3'),
}).passthrough();
const scoutedRangeSchema = z.object({ minimum: positiveInteger, maximum: positiveInteger }).passthrough();
const scoutReportSchema = z.object({
  playerId: nonemptyString,
  role: z.enum(['GK', 'DEF', 'MID', 'FWD']),
  age: positiveInteger,
  statRanges: z.object({
    pac: scoutedRangeSchema,
    sho: scoutedRangeSchema,
    pas: scoutedRangeSchema,
    def: scoutedRangeSchema,
    tec: scoutedRangeSchema,
    sta: scoutedRangeSchema,
    ref: scoutedRangeSchema,
  }).passthrough(),
  potentialRange: scoutedRangeSchema,
  power: powerIdSchema.optional(),
  powerTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  rumoredHeroLead: z.literal(true).optional(),
}).passthrough();
const coachCandidateSchema = z.object({
  id: nonemptyString,
  portraitId: nonemptyString.optional(),
  name: nonemptyString,
  age: z.number().int().min(30).max(60).optional(),
  specialties: z.tuple([z.enum([
    'ATTACK', 'DEFENSE', 'FITNESS', 'TECHNIQUE', 'GOALKEEPING', 'MOTIVATOR',
  ]), z.enum([
    'ATTACK', 'DEFENSE', 'FITNESS', 'TECHNIQUE', 'GOALKEEPING', 'MOTIVATOR',
  ])]),
  level: divisionLevelSchema,
  weeklyWage: nonnegativeInteger,
  personality: marketPersonalitySchema,
  requiredDivision: divisionLevelSchema,
  requiredFame: nonnegativeInteger,
  loyaltyDiscountPercent: nonnegativeInteger.refine(value => value <= 100, 'must be at most 100'),
  unlockId: nonemptyString.optional(),
  retiredLegendPlayerId: nonemptyString.optional(),
}).passthrough();
const contractOfferSchema = z.object({
  weeklyWage: positiveInteger,
  termSeasons: positiveInteger.refine(value => value <= 3, 'must be at most 3'),
  perk: z.enum(['GUARANTEED_STARTER', 'CAPTAINCY', 'TRAINING_PRIORITY', 'JERSEY_10']),
}).passthrough();
const transferQuoteSchema = z.object({
  playerId: nonemptyString,
  valuation: nonnegativeInteger,
  fee: nonnegativeInteger,
  bandPercent: nonnegativeInteger,
}).passthrough();
const negotiationSchema = z.object({
  id: nonemptyString,
  playerId: nonemptyString,
  personality: marketPersonalitySchema,
  weeklyAsk: positiveInteger,
  round: nonnegativeInteger.refine(value => value <= 3, 'must be at most 3'),
  mood: z.enum(['ANGRY', 'UNHAPPY', 'NEUTRAL', 'PLEASED', 'THRILLED']),
  pitchInfluencePercent: safeInteger,
  pitchCards: z.array(z.enum(['FLATTERY', 'TROPHY_PROMISE', 'HOMETOWN_TIES', 'MONEY_TALKS', 'STRAIGHT_TALK'])),
  usedPitchCards: z.array(z.enum(['FLATTERY', 'TROPHY_PROMISE', 'HOMETOWN_TIES', 'MONEY_TALKS', 'STRAIGHT_TALK'])),
  status: z.enum(['OPEN', 'ACCEPTED', 'REJECTED']),
  history: z.array(z.object({ round: positiveInteger, offer: contractOfferSchema }).passthrough()),
  acceptedOffer: contractOfferSchema.optional(),
  consequence: z.object({
    moraleDelta: safeInteger,
    clubFameDelta: safeInteger,
  }).passthrough().optional(),
}).passthrough();
const careerMarketSchema = z.object({
  nextMissionNumber: positiveInteger,
  activeScoutMission: scoutMissionSchema.optional(),
  scoutReports: z.array(scoutReportSchema),
  coachCandidates: z.array(coachCandidateSchema),
  headCoach: coachCandidateSchema.optional(),
  headCoachSeasonsEmployed: nonnegativeInteger.optional(),
  assistantCoach: coachCandidateSchema.optional(),
  assistantCoachSeasonsEmployed: nonnegativeInteger.optional(),
  unlockedCoachContentIds: z.array(nonemptyString).optional(),
  transferListings: z.array(z.object({
    playerId: nonemptyString,
    listedSeason: positiveInteger,
    listedWeek: positiveInteger,
    bids: z.array(z.object({
      id: nonemptyString,
      playerId: nonemptyString,
      buyerClubId: nonemptyString,
      quote: transferQuoteSchema,
      madeSeason: positiveInteger,
      madeWeek: positiveInteger,
    }).passthrough()),
  }).passthrough()).optional(),
  clubFameAdjustment: safeInteger.optional(),
  transferTalks: z.object({
    playerId: nonemptyString,
    transferQuote: transferQuoteSchema,
    negotiation: negotiationSchema,
    consequenceApplied: z.boolean().optional(),
  }).passthrough().optional(),
  renewalTalks: z.object({
    playerId: nonemptyString,
    negotiation: negotiationSchema,
    consequenceApplied: z.boolean().optional(),
  }).passthrough().optional(),
  abandonedTransferNegotiationIds: z.array(nonemptyString).optional(),
  abandonedRenewalNegotiationIds: z.array(nonemptyString).optional(),
}).passthrough();

const youthIntakeSchema = z.object({
  schemaVersion: z.literal(1),
  season: positiveInteger,
  status: z.enum(['OPEN', 'CLOSED']),
  offers: z.array(z.object({
    player: playerSchema,
    signingBonus: nonnegativeInteger,
  }).passthrough()).max(2),
  signedPlayerIds: z.array(nonemptyString),
  declined: z.boolean(),
}).passthrough();

const boardSaleCandidateSchema = z.object({
  playerId: nonemptyString,
  marketValue: positiveInteger,
  forcedSaleFee: positiveInteger,
  discountPercent: z.literal(30),
}).passthrough();

const boardUltimatumSchema = z.object({
  id: nonemptyString,
  issuedSeason: positiveInteger,
  issuedWeek: positiveInteger.refine(value => value <= 30, 'must be at most 30'),
  weeksRemaining: positiveInteger.refine(value => value <= 4, 'must be at most 4'),
  targetCash: nonnegativeInteger,
  candidates: z.array(boardSaleCandidateSchema).min(3).max(4),
  protectedPlayerId: nonemptyString.optional(),
}).passthrough();

const boardUltimatumResolutionSchema = z.discriminatedUnion('kind', [
  z.object({
    id: nonemptyString,
    kind: z.literal('TARGET_MET'),
    resolvedSeason: positiveInteger,
    resolvedWeek: positiveInteger.refine(value => value <= 30, 'must be at most 30'),
    targetCash: nonnegativeInteger,
  }).passthrough(),
  z.object({
    id: nonemptyString,
    kind: z.literal('FORCED_SALE'),
    resolvedSeason: positiveInteger,
    resolvedWeek: positiveInteger.refine(value => value <= 30, 'must be at most 30'),
    targetCash: nonnegativeInteger,
    playerId: nonemptyString,
    buyerClubId: nonemptyString,
    replacementPlayerId: nonemptyString,
    fee: positiveInteger,
    discountPercent: z.literal(30),
    moraleDelta: z.literal(-8),
    fansLost: nonnegativeInteger,
  }).passthrough(),
]);

const seasonRecapAwardSchema = z.object({
  playerId: nonemptyString,
  playerName: nonemptyString,
  label: nonemptyString,
  detail: nonemptyString,
}).passthrough();

const divisionAwardPlacementSchema = z.object({
  playerId: nonemptyString,
  playerName: nonemptyString,
  clubId: nonemptyString,
  value: nonnegativeInteger,
}).passthrough();

/** One podium per category, and a podium is three deep. */
const divisionAwardsSchema = z.object({
  goals: z.array(divisionAwardPlacementSchema).max(3),
  passesCompleted: z.array(divisionAwardPlacementSchema).max(3),
  tacklesWon: z.array(divisionAwardPlacementSchema).max(3),
  saves: z.array(divisionAwardPlacementSchema).max(3),
}).passthrough();

/**
 * The grant, not the projection: written once by the season transition. Four
 * boards exist, so four is the ceiling, and each may only be claimed once.
 */
const divisionAwardPrizeSchema = z.object({
  trainingPoints: nonnegativeInteger,
  categoriesWon: z
    .array(z.enum(['goals', 'passesCompleted', 'tacklesWon', 'saves']))
    .max(4)
    .refine(value => new Set(value).size === value.length, 'must not repeat a category'),
}).passthrough();

const seasonRecapSchema = z.object({
  season: positiveInteger,
  division: positiveInteger.refine(value => value <= 5, 'must be at most 5'),
  finalPosition: positiveInteger.refine(value => value <= 10, 'must be at most 10'),
  played: nonnegativeInteger,
  won: nonnegativeInteger,
  drawn: nonnegativeInteger,
  lost: nonnegativeInteger,
  goalsFor: nonnegativeInteger,
  goalsAgainst: nonnegativeInteger,
  cashChange: safeInteger,
  closingCash: safeInteger,
  trainingCapsReached: nonnegativeInteger,
  cupResult: nonemptyString,
  memorableEventId: nonemptyString.optional(),
  topScorer: seasonRecapAwardSchema.optional(),
  playerOfSeason: seasonRecapAwardSchema.optional(),
  youngPlayer: seasonRecapAwardSchema.optional(),
  heroOfSeason: seasonRecapAwardSchema.optional(),
  divisionAwards: divisionAwardsSchema.optional(),
  divisionAwardPrize: divisionAwardPrizeSchema.optional(),
}).passthrough();

const divisionLevel = positiveInteger.refine(value => value <= 5, 'must be at most 5');
const leaguePosition = positiveInteger.refine(value => value <= 10, 'must be at most 10');

/**
 * The record written once, at the summit.
 *
 * Validated as strictly as a recap because it is the same kind of thing: a
 * denormalised snapshot that can never be rebuilt from live state, so a
 * malformed one is not a display bug but a permanently wrong career record. A
 * nameless player is rejected outright — an unnamed top scorer renders as a raw
 * ID, which is the exact failure the snapshot exists to prevent.
 */
const hallOfFameSchema = z.object({
  season: positiveInteger,
  clubName: nonemptyString,
  played: nonnegativeInteger,
  won: nonnegativeInteger,
  drawn: nonnegativeInteger,
  lost: nonnegativeInteger,
  goalsFor: nonnegativeInteger,
  goalsAgainst: nonnegativeInteger,
  divisionTitles: z.array(z.object({
    season: positiveInteger,
    division: divisionLevel,
  }).passthrough()),
  cupWinSeasons: z.array(positiveInteger),
  // Five tiers exist, and a tier folds every spell at that level into one row.
  tiers: z.array(z.object({
    division: divisionLevel,
    firstSeason: positiveInteger,
    seasons: positiveInteger,
    bestPosition: leaguePosition,
  }).passthrough()).max(5),
  topScorer: z.object({
    playerId: nonemptyString,
    playerName: nonemptyString,
    goals: nonnegativeInteger,
    goldenBoots: positiveInteger,
  }).passthrough().optional(),
  star: z.object({
    playerId: nonemptyString,
    playerName: nonemptyString,
    fame: nonnegativeInteger,
    seasonsAtClub: nonnegativeInteger,
  }).passthrough().optional(),
}).passthrough().superRefine((record, context) => {
  if (record.won + record.drawn + record.lost !== record.played) {
    context.addIssue({
      code: 'custom',
      path: ['played'],
      message: 'results must add up to the games played',
    });
  }
  const divisions = new Set(record.tiers.map(tier => tier.division));
  if (divisions.size !== record.tiers.length) {
    context.addIssue({
      code: 'custom',
      path: ['tiers'],
      message: 'each tier may appear once',
    });
  }
  const cupSeasons = new Set(record.cupWinSeasons);
  if (cupSeasons.size !== record.cupWinSeasons.length) {
    context.addIssue({
      code: 'custom',
      path: ['cupWinSeasons'],
      message: 'a Cup can only be won once a season',
    });
  }
  const titleKeys = new Set(record.divisionTitles.map(title => title.season));
  if (titleKeys.size !== record.divisionTitles.length) {
    context.addIssue({
      code: 'custom',
      path: ['divisionTitles'],
      message: 'a season can only produce one division title',
    });
  }
});

const gameStateSchema = z
  .object({
    schemaVersion: z.literal(GAME_SCHEMA_VERSION),
    launchRosterVersion: positiveInteger.optional(),
    careerSeed: uint32,
    userClubId: nonemptyString,
    season: positiveInteger,
    week: positiveInteger,
    phase: z.enum(['manage', 'matchday', 'season-end', 'complete']),
    difficulty: z.enum(['COZY', 'CHAIRMAN']).optional(),
    assistantMode: z.enum(['teacher', 'advisor']).optional(),
    clubs: z.array(clubSchema).length(10),
    fixtures: z.array(fixtureSchema),
    players: z.array(playerSchema),
    lineups: z.array(lineupSchema),
    facilities: facilitiesSchema,
    trainingRules: trainingRulesSchema.optional(),
    playerRequestRules: playerRequestRulesSchema.optional(),
    sponsorRules: sponsorRulesSchema.optional(),
    eventClock: eventClockSchema,
    eventFlags: z.array(nonemptyString),
    resolvedEventIds: z.array(nonemptyString),
    resolvedEventHistory: z.array(z.object({
      eventId: nonemptyString,
      season: positiveInteger,
      week: positiveInteger,
    }).passthrough()).optional(),
    pendingEvent: pendingEventSchema.optional(),
    // Optional at decode time so pre-cutscene schema-1 saves can be upgraded
    // by the application reconciliation pass without being treated as corrupt.
    awakening: awakeningSchema.optional(),
    onboarding: onboardingSchema.optional(),
    trainingPoints: nonnegativeInteger,
    // Optional so a save written before drill upgrades became a purchase still
    // loads; every path it does not name is owned at tier 1.
    ownedTrainingTiers: z.record(
      nonemptyString,
      z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    ).optional(),
    totalInstantDrills: nonnegativeInteger.optional(),
    ledgers: z.array(ledgerSchema),
    seasonOpeningCash: safeInteger.optional(),
    cashTransactions: z.array(cashTransactionSchema).optional(),
    // Absent on saves written before ids became a counter; the recorder seeds
    // it from the history length those saves minted their ids with.
    cashTransactionIdCounter: nonnegativeInteger.optional(),
    seasonStatLines: z.array(seasonStatLineSchema).optional(),
    // `'m1-slice'` was a second, finite career mode that no longer exists. The
    // value stays legal on read so saves written while it did are still
    // decodable; `parseStoredGameState` normalises it and the launch
    // reconciliation pass builds the M2 sidecars such a save never had.
    careerMode: z.enum(['m1-slice', 'full']).optional(),
    m2: m2CareerSchema.optional(),
    market: careerMarketSchema.optional(),
    youthIntake: youthIntakeSchema.optional(),
    retiredPlayers: z.array(playerSchema).optional(),
    pendingLegacyPlayerIds: z.array(nonemptyString).optional(),
    retirementAnnouncements: z.array(z.object({
      playerId: nonemptyString,
      playerName: nonemptyString,
      announcedInSeason: positiveInteger,
      retirementAge: positiveInteger.refine(value => value >= 33 && value <= 38, 'must be from 33 to 38'),
    }).passthrough()).optional(),
    seasonRecaps: z.array(seasonRecapSchema).optional(),
    hallOfFame: hallOfFameSchema.optional(),
    playerRequests: playerRequestStateSchema.optional(),
    financialSafety: z.object({
      consecutiveNegativeWeeks: nonnegativeInteger,
      emergencyLoanUsed: z.boolean(),
      loan: z.object({
        originalAmount: positiveInteger,
        remainingBalance: nonnegativeInteger,
        repaymentStartsSeason: positiveInteger,
        remainingWeeks: nonnegativeInteger,
      }).passthrough().optional(),
      boardUltimatum: boardUltimatumSchema.optional(),
      latestBoardResolution: boardUltimatumResolutionSchema.optional(),
    }).passthrough().optional(),
    pendingCupGiantKillingCelebrations: z.array(z.object({
      fixtureId: nonemptyString,
      divisionGap: positiveInteger,
      title: nonemptyString,
      body: nonemptyString,
    }).passthrough()).optional(),
    clubBusiness: clubBusinessStateSchema,
  })
  .passthrough()
  .superRefine((state, context) => {
    if (state.careerMode === 'full' && (state.m2 === undefined || state.market === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['careerMode'],
        message: 'full careers require M2 pyramid and market state',
      });
    }
    if (state.m2 !== undefined && state.m2.userClubId !== state.userClubId) {
      context.addIssue({
        code: 'custom',
        path: ['m2', 'userClubId'],
        message: 'must match the active user club',
      });
    }
    if (state.m2 !== undefined) {
      if (state.m2.careerSeed !== state.careerSeed
        || state.m2.pyramid.careerSeed !== state.careerSeed) {
        context.addIssue({
          code: 'custom',
          path: ['m2', 'careerSeed'],
          message: 'M2 career, pyramid, and active career seeds must match',
        });
      }

      const divisionLevels = new Set<number>();
      const pyramidClubIds = new Set<string>();
      const pyramidPlayerIds = new Set<string>();
      let userDivisionClubIds: Set<string> | undefined;
      let userClubAppearances = 0;
      for (let divisionIndex = 0; divisionIndex < state.m2.pyramid.divisions.length; divisionIndex += 1) {
        const division = state.m2.pyramid.divisions[divisionIndex];
        if (divisionLevels.has(division.level)) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'pyramid', 'divisions', divisionIndex, 'level'],
            message: 'division level must be unique',
          });
        }
        divisionLevels.add(division.level);
        const currentDivisionClubIds = new Set<string>();
        for (let clubIndex = 0; clubIndex < division.clubs.length; clubIndex += 1) {
          const club = division.clubs[clubIndex];
          currentDivisionClubIds.add(club.id);
          if (club.division !== division.level) {
            context.addIssue({
              code: 'custom',
              path: ['m2', 'pyramid', 'divisions', divisionIndex, 'clubs', clubIndex, 'division'],
              message: 'club division must match its containing tier',
            });
          }
          if (pyramidClubIds.has(club.id)) {
            context.addIssue({
              code: 'custom',
              path: ['m2', 'pyramid', 'divisions', divisionIndex, 'clubs', clubIndex, 'id'],
              message: 'pyramid club ID must be unique',
            });
          }
          pyramidClubIds.add(club.id);
          if (club.id === state.userClubId) {
            userClubAppearances += 1;
            userDivisionClubIds = currentDivisionClubIds;
          }
          for (let playerIndex = 0; playerIndex < club.squad.length; playerIndex += 1) {
            const player = club.squad[playerIndex];
            if (player.clubId !== club.id) {
              context.addIssue({
                code: 'custom',
                path: ['m2', 'pyramid', 'divisions', divisionIndex, 'clubs', clubIndex, 'squad', playerIndex, 'clubId'],
                message: 'pyramid player must belong to the containing club',
              });
            }
            if (pyramidPlayerIds.has(player.id)) {
              context.addIssue({
                code: 'custom',
                path: ['m2', 'pyramid', 'divisions', divisionIndex, 'clubs', clubIndex, 'squad', playerIndex, 'id'],
                message: 'pyramid player ID must be unique',
              });
            }
            pyramidPlayerIds.add(player.id);
          }
        }
        if (currentDivisionClubIds.has(state.userClubId)) {
          userDivisionClubIds = currentDivisionClubIds;
        }
      }
      if (divisionLevels.size !== 5 || [1, 2, 3, 4, 5].some(level => !divisionLevels.has(level))) {
        context.addIssue({
          code: 'custom',
          path: ['m2', 'pyramid', 'divisions'],
          message: 'pyramid must contain Divisions 1 through 5 exactly once',
        });
      }
      if (userClubAppearances !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['m2', 'userClubId'],
          message: 'user club must appear in exactly one pyramid division',
        });
      }

      const activeClubIds = new Set(state.clubs.map(club => club.id));
      if (userDivisionClubIds === undefined
        || userDivisionClubIds.size !== activeClubIds.size
        || [...activeClubIds].some(clubId => !userDivisionClubIds?.has(clubId))) {
        context.addIssue({
          code: 'custom',
          path: ['clubs'],
          message: 'active clubs must match the user pyramid division',
        });
      }

      const cupSeasons = new Set<number>();
      let activeCupCount = 0;
      const cupFixtureIds = new Set<string>();
      for (let cupIndex = 0; cupIndex < state.m2.nationalCups.length; cupIndex += 1) {
        const cup = state.m2.nationalCups[cupIndex];
        if (cup.careerSeed !== state.careerSeed) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'nationalCups', cupIndex, 'careerSeed'],
            message: 'Hero Cup seed must match the career seed',
          });
        }
        if (cupSeasons.has(cup.season) || cup.season > state.season) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'nationalCups', cupIndex, 'season'],
            message: 'Hero Cup season must be unique and not be in the future',
          });
        }
        cupSeasons.add(cup.season);
        if (cup.championClubId === undefined) {
          activeCupCount += 1;
          // Pruning only ever takes the rounds of a cup that already has a
          // champion, so a cup still being played without them is corruption.
          if (cup.rounds.length === 0) {
            context.addIssue({
              code: 'custom',
              path: ['m2', 'nationalCups', cupIndex, 'rounds'],
              message: 'an unfinished Hero Cup must keep its rounds',
            });
          }
        } else if (!pyramidClubIds.has(cup.championClubId)) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'nationalCups', cupIndex, 'championClubId'],
            message: 'Hero Cup champion must exist in the pyramid',
          });
        }
        for (let roundIndex = 0; roundIndex < cup.rounds.length; roundIndex += 1) {
          const round = cup.rounds[roundIndex];
          const entrantClubIds = new Set(round.entrantClubIds);
          const byeClubIds = new Set(round.byeClubIds);
          if (entrantClubIds.size !== round.entrantClubIds.length
            || byeClubIds.size !== round.byeClubIds.length
            || round.entrantClubIds.some(clubId => !pyramidClubIds.has(clubId))
            || round.byeClubIds.some(clubId => !entrantClubIds.has(clubId))) {
            context.addIssue({
              code: 'custom',
              path: ['m2', 'nationalCups', cupIndex, 'rounds', roundIndex],
              message: 'Cup entrants must be unique pyramid clubs and byes must be entrants',
            });
          }
          for (let fixtureIndex = 0; fixtureIndex < round.fixtures.length; fixtureIndex += 1) {
            const fixture = round.fixtures[fixtureIndex];
            const fixturePath = ['m2', 'nationalCups', cupIndex, 'rounds', roundIndex, 'fixtures', fixtureIndex] as const;
            if (cupFixtureIds.has(fixture.id)) {
              context.addIssue({ code: 'custom', path: [...fixturePath, 'id'], message: 'Cup fixture ID must be unique' });
            }
            cupFixtureIds.add(fixture.id);
            const participants = new Set([fixture.homeClubId, fixture.awayClubId]);
            if (fixture.season !== cup.season
              || fixture.round !== round.number
              || participants.size !== 2
              || [...participants].some(clubId => !entrantClubIds.has(clubId) || byeClubIds.has(clubId))) {
              context.addIssue({ code: 'custom', path: [...fixturePath], message: 'Cup fixture must match its round and pyramid clubs' });
            }
            const played = fixture.status === 'played';
            if (played !== (fixture.score !== undefined)
              || played !== (fixture.winnerClubId !== undefined)
              || (fixture.winnerClubId !== undefined && !participants.has(fixture.winnerClubId))) {
              context.addIssue({ code: 'custom', path: [...fixturePath, 'status'], message: 'Cup fixture status, score, and winner must agree' });
            }
          }
        }
      }
      if (activeCupCount > 1) {
        context.addIssue({
          code: 'custom',
          path: ['m2', 'nationalCups'],
          message: 'only one Hero Cup may be active',
        });
      }
    }
    if (state.youthIntake !== undefined) {
      if (state.youthIntake.season !== state.season) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'season'],
          message: 'must match the active season',
        });
      }
      if (state.youthIntake.status === 'OPEN' && state.youthIntake.offers.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'offers'],
          message: 'open youth intake needs an offer',
        });
      }
      if (state.youthIntake.status === 'CLOSED' && state.youthIntake.offers.length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['youthIntake', 'offers'],
          message: 'closed youth intake cannot retain offers',
        });
      }
      const youthOfferIds = new Set<string>();
      for (let index = 0; index < state.youthIntake.offers.length; index += 1) {
        const offer = state.youthIntake.offers[index];
        if (youthOfferIds.has(offer.player.id)) {
          context.addIssue({
            code: 'custom',
            path: ['youthIntake', 'offers', index, 'player', 'id'],
            message: 'youth offer player ID must be unique',
          });
        }
        youthOfferIds.add(offer.player.id);
        if (offer.player.clubId !== state.userClubId) {
          context.addIssue({
            code: 'custom',
            path: ['youthIntake', 'offers', index, 'player', 'clubId'],
            message: 'must match the active user club',
          });
        }
      }
    }
    if (state.hallOfFame !== undefined) {
      // The record is a snapshot of seasons already played, so nothing in it
      // may postdate the career carrying it. Catches a record grafted onto the
      // wrong save far more cheaply than a screen full of impossible seasons.
      const futureSeason = state.hallOfFame.season > state.season
        || state.hallOfFame.divisionTitles.some(title => title.season > state.season)
        || state.hallOfFame.cupWinSeasons.some(season => season > state.season)
        || state.hallOfFame.tiers.some(tier => tier.firstSeason > state.season);
      if (futureSeason) {
        context.addIssue({
          code: 'custom',
          path: ['hallOfFame', 'season'],
          message: 'the record cannot contain a season the career has not played',
        });
      }
    }

    const cashTransactionIds = new Set<string>();
    for (let index = 0; index < (state.cashTransactions ?? []).length; index += 1) {
      const transaction = state.cashTransactions![index];
      if (cashTransactionIds.has(transaction.id)) {
        context.addIssue({
          code: 'custom',
          path: ['cashTransactions', index, 'id'],
          message: 'cash transaction ID must be unique',
        });
      }
      cashTransactionIds.add(transaction.id);
    }

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

    const statLineKeys = new Set<string>();
    for (let index = 0; index < (state.seasonStatLines ?? []).length; index += 1) {
      const line = state.seasonStatLines![index];
      const key = `${line.season}:${line.playerId}:${line.clubId}:${line.competition}`;
      if (statLineKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['seasonStatLines', index],
          message: 'season, player ID, club ID and competition must be unique',
        });
      }
      statLineKeys.add(key);
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
    const shirtNumbersByClub = new Map<string, Set<number>>();
    const captainCountByClub = new Map<string, number>();
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
      if (player.contractPromise !== undefined
        && player.contractPromise.agreedSeason > state.season) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'contractPromise', 'agreedSeason'],
          message: 'contract promise cannot be agreed in a future season',
        });
      }
      if (player.shirtNumber !== undefined) {
        const assigned = shirtNumbersByClub.get(player.clubId) ?? new Set<number>();
        if (assigned.has(player.shirtNumber)) {
          context.addIssue({
            code: 'custom',
            path: ['players', index, 'shirtNumber'],
            message: 'shirt number must be unique within a club',
          });
        }
        assigned.add(player.shirtNumber);
        shirtNumbersByClub.set(player.clubId, assigned);
      }
      if (player.isCaptain === true) {
        captainCountByClub.set(player.clubId, (captainCountByClub.get(player.clubId) ?? 0) + 1);
        if (captainCountByClub.get(player.clubId)! > 1) {
          context.addIssue({
            code: 'custom',
            path: ['players', index, 'isCaptain'],
            message: 'a club can have only one captain',
          });
        }
      }
    }

    const retiredPlayerIds = new Set<string>();
    for (let index = 0; index < (state.retiredPlayers ?? []).length; index += 1) {
      const player = state.retiredPlayers![index];
      if (retiredPlayerIds.has(player.id) || playerIds.has(player.id)) {
        context.addIssue({
          code: 'custom',
          path: ['retiredPlayers', index, 'id'],
          message: 'retired player ID must be unique and absent from active players',
        });
      }
      retiredPlayerIds.add(player.id);
    }
    const retirementAnnouncementKeys = new Set<string>();
    for (let index = 0; index < (state.retirementAnnouncements ?? []).length; index += 1) {
      const announcement = state.retirementAnnouncements![index];
      const key = `${announcement.announcedInSeason}:${announcement.playerId}`;
      if (retirementAnnouncementKeys.has(key)
        || announcement.announcedInSeason > state.season) {
        context.addIssue({
          code: 'custom',
          path: ['retirementAnnouncements', index],
          message: 'retirement announcement must be unique and come from a completed season',
        });
      }
      retirementAnnouncementKeys.add(key);
    }
    const safety = state.financialSafety;
    const ultimatum = safety?.boardUltimatum;
    if (ultimatum !== undefined) {
      if (state.careerMode !== 'full' || ultimatum.issuedSeason > state.season) {
        context.addIssue({
          code: 'custom',
          path: ['financialSafety', 'boardUltimatum', 'issuedSeason'],
          message: 'board ultimatum must belong to a current full career',
        });
      }
      const candidateIds = new Set<string>();
      for (let index = 0; index < ultimatum.candidates.length; index += 1) {
        const candidate = ultimatum.candidates[index];
        if (candidateIds.has(candidate.playerId)
          || candidate.forcedSaleFee > candidate.marketValue) {
          context.addIssue({
            code: 'custom',
            path: ['financialSafety', 'boardUltimatum', 'candidates', index],
            message: 'board candidates must be unique and priced below market value',
          });
        }
        candidateIds.add(candidate.playerId);
      }
      if (ultimatum.protectedPlayerId !== undefined
        && !candidateIds.has(ultimatum.protectedPlayerId)) {
        context.addIssue({
          code: 'custom',
          path: ['financialSafety', 'boardUltimatum', 'protectedPlayerId'],
          message: 'protected player must come from the visible board candidates',
        });
      }
    }
    const boardResolution = safety?.latestBoardResolution;
    if (boardResolution !== undefined && boardResolution.resolvedSeason > state.season) {
      context.addIssue({
        code: 'custom',
        path: ['financialSafety', 'latestBoardResolution', 'resolvedSeason'],
        message: 'board resolution cannot come from a future season',
      });
    }
    if (state.market !== undefined) {
      // A scout report is read back as a transfer target: the market tab looks
      // the scouted player up and throws when they are gone. Every other
      // reference in this save is checked, so this one is too — and
      // `parseStoredGameState` drops the danglers saves in the field already have.
      const transferTargetIds = new Set<string>();
      for (const [playerId, clubId] of playerClubById) {
        if (clubId !== state.userClubId) transferTargetIds.add(playerId);
      }
      for (const division of state.m2?.pyramid.divisions ?? []) {
        for (const club of division.clubs) {
          if (club.id === state.userClubId) continue;
          for (const player of club.squad) transferTargetIds.add(player.id);
        }
      }
      for (let index = 0; index < state.market.scoutReports.length; index += 1) {
        const report = state.market.scoutReports[index];
        if (transferTargetIds.has(report.playerId)) continue;
        context.addIssue({
          code: 'custom',
          path: ['market', 'scoutReports', index, 'playerId'],
          message: 'scout report must reference a player at another club',
        });
      }
      if (state.market.headCoach !== undefined
        && state.market.assistantCoach?.id === state.market.headCoach.id) {
        context.addIssue({
          code: 'custom',
          path: ['market', 'assistantCoach', 'id'],
          message: 'head and assistant coach must be different people',
        });
      }
      const listingPlayerIds = new Set<string>();
      const bidIds = new Set<string>();
      for (let listingIndex = 0; listingIndex < (state.market.transferListings ?? []).length; listingIndex += 1) {
        const listing = state.market.transferListings![listingIndex];
        if (listingPlayerIds.has(listing.playerId)
          || playerClubById.get(listing.playerId) !== state.userClubId
          || listing.listedSeason > state.season) {
          context.addIssue({
            code: 'custom',
            path: ['market', 'transferListings', listingIndex, 'playerId'],
            message: 'listing must uniquely reference a current user-club player',
          });
        }
        listingPlayerIds.add(listing.playerId);
        for (let bidIndex = 0; bidIndex < listing.bids.length; bidIndex += 1) {
          const bid = listing.bids[bidIndex];
          if (bidIds.has(bid.id)
            || bid.playerId !== listing.playerId
            || bid.quote.playerId !== listing.playerId
            || !clubIds.has(bid.buyerClubId)
            || bid.buyerClubId === state.userClubId
            || bid.madeSeason > state.season) {
            context.addIssue({
              code: 'custom',
              path: ['market', 'transferListings', listingIndex, 'bids', bidIndex],
              message: 'transfer bid must uniquely match its listing and an active buying club',
            });
          }
          bidIds.add(bid.id);
        }
      }
      if (state.market.transferTalks !== undefined) {
        const talks = state.market.transferTalks;
        const pyramidTargetClubId = state.m2?.pyramid.divisions
          .flatMap(division => division.clubs)
          .flatMap(club => club.squad)
          .find(player => player.id === talks.playerId)?.clubId;
        const targetClubId = playerClubById.get(talks.playerId) ?? pyramidTargetClubId;
        if (targetClubId === state.userClubId
          || targetClubId === undefined
          || talks.transferQuote.playerId !== talks.playerId
          || talks.negotiation.playerId !== talks.playerId) {
          context.addIssue({
            code: 'custom',
            path: ['market', 'transferTalks', 'playerId'],
            message: 'transfer talks must consistently reference a target from another club',
          });
        }
      }
      if (state.market.renewalTalks !== undefined) {
        const talks = state.market.renewalTalks;
        if (playerClubById.get(talks.playerId) !== state.userClubId
          || talks.negotiation.playerId !== talks.playerId) {
          context.addIssue({
            code: 'custom',
            path: ['market', 'renewalTalks', 'playerId'],
            message: 'renewal talks must consistently reference a current user-club player',
          });
        }
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
      && state.onboarding.stage !== 'complete'
      && !fixtureIds.has(state.onboarding.firstFixtureId)) {
      context.addIssue({
        code: 'custom',
        path: ['onboarding', 'firstFixtureId'],
        message: 'first fixture does not exist',
      });
    }
    if (state.awakening?.pending !== undefined) {
      const pending = state.awakening.pending;
      if (!fixtureIds.has(pending.fixtureId)) {
        context.addIssue({
          code: 'custom',
          path: ['awakening', 'pending', 'fixtureId'],
          message: 'awakening fixture does not exist',
        });
      }
      const awakeningPlayer = state.players.find(player => player.id === pending.playerId);
      if (awakeningPlayer?.clubId !== state.userClubId || awakeningPlayer.power !== pending.power) {
        context.addIssue({
          code: 'custom',
          path: ['awakening', 'pending', 'playerId'],
          message: 'pending awakening must match a user-club hero',
        });
      }
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

/**
 * `validate: false` skips the full zod pass — ~95% of serialize cost, paid on
 * every store action because a save follows each one. The state always came
 * from the typed game module, and `parseStoredGameState` re-validates on the
 * next load with the backup generation still intact, so production saves may
 * skip it. Dev builds and every other caller keep the full check.
 */
export function serializeGameState(
  state: GameState,
  options?: { readonly validate?: boolean },
): string {
  assertSupportedSchema(state, false);
  if (options?.validate !== false) {
    let validation: z.ZodSafeParseResult<unknown>;
    try {
      validation = gameStateSchema.safeParse(state);
    } catch {
      throw new InvalidGameStateError('validation failed unexpectedly');
    }
    if (!validation.success) {
      throw new InvalidGameStateError(formatIssues(validation.error.issues));
    }
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

  // Content-churn normalisers first: they clean up retired fields and ids within
  // a version, so every migration rung below sees already-normalised input.
  value = removeRetiredHeroSystems(value);
  value = removeRetiredWeeklyTraining(value);
  value = migrateRetiredPowers(value);
  // Then walk the save up to the current schema version. This is the step that
  // lets a shipped update change the save shape without wiping the field.
  value = migrateStoredGameState(value);
  // Referential fail-soft, after the ladder so it sees the final shape: the
  // schema now requires every scout report and every open transfer talk to
  // resolve, and saves written before it did must still load.
  value = dropUnresolvableScoutReports(value);
  value = dropUnresolvableTransferTalks(value);
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
  const parsed = validation.data as Omit<GameState, 'awakening' | 'careerMode'> & {
    awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & { usedTriggerIds?: string[] };
  };
  return {
    ...parsed,
    // Retired slice saves (and pre-`careerMode` saves) become full careers. Only
    // the label is set here; `reconcileLaunchRoster` runs `enableFullCareer` on
    // every load, which synthesises the M2 and market state they lack.
    careerMode: 'full',
    awakening: parsed.awakening === undefined
      ? { matchesSinceLastAwakening: 0, usedTriggerIds: [] }
      : {
          ...parsed.awakening,
          usedTriggerIds: parsed.awakening.usedTriggerIds ?? [],
        },
  };
}

/**
 * Hero Essence and the unavailable Hero Lab were removed before either had a
 * playable source or action. Strip their inert schema-v1 data so development
 * saves made before the removal remain loadable.
 */
/**
 * Magnet Touch was cut from the launch catalog: its trigger is a loose ball
 * near the hero, which almost never coincided with the Zone window, so it
 * measured 3.4 Zones and 0 fires per match. The id stays legal in this codec so
 * a save written before the cut still loads — retiring content out from under a
 * persisted reference is how you brick a career. Affected heroes inherit Portal
 * Pass, the nearest surviving utility power.
 */
const RETIRED_POWER_REPLACEMENT: Readonly<Record<string, string>> = {
  MAGNET_TOUCH: 'PORTAL_PASS',
};

function migrateRetiredPowers(value: unknown): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!isRecord(node)) return node;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      const replacement = typeof child === 'string' ? RETIRED_POWER_REPLACEMENT[child] : undefined;
      next[key] = replacement !== undefined && (key === 'power' || key === 'awakenedPower')
        ? replacement
        : walk(child);
    }
    return next;
  };
  return walk(value);
}

/**
 * Weekly training plans, cap notices, promise bumps, and the slot cap were
 * replaced by tap-time instant drills. Strip their inert data so saves made
 * before the change remain loadable, discarding any pending plan silently.
 */
function removeRetiredWeeklyTraining(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const {
    trainingPlan: _trainingPlan,
    trainingCapNotices: _trainingCapNotices,
    pendingTrainingPromiseBump: _pendingTrainingPromiseBump,
    ...withoutWeeklyTraining
  } = value;
  const trainingRules = withoutWeeklyTraining.trainingRules;
  if (!isRecord(trainingRules)) return withoutWeeklyTraining;

  const { maxFocusDrillsPerWeek: _maxFocusDrillsPerWeek, ...rulesWithoutCap } = trainingRules;
  return { ...withoutWeeklyTraining, trainingRules: rulesWithoutCap };
}

/**
 * Drops scout reports whose scouted player is no longer somewhere the market can
 * find them — retired, or gone with a regenerated pyramid. The report is a
 * shopping note, so losing it costs nothing; keeping it crashes the Market tab
 * on every visit, and the tab is reachable from a save that loads.
 */
function dropUnresolvableScoutReports(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const market = value.market;
  if (!isRecord(market) || !Array.isArray(market.scoutReports)) return value;
  const userClubId = value.userClubId;
  if (typeof userClubId !== 'string') return value;

  const targetIds = transferTargetPlayerIds(value, userClubId);
  // Malformed reports are kept so the validator still reports them rather than
  // this quietly hiding a corrupt save.
  const scoutReports = market.scoutReports.filter(report => (
    !isRecord(report)
    || typeof report.playerId !== 'string'
    || targetIds.has(report.playerId)
  ));
  if (scoutReports.length === market.scoutReports.length) return value;
  return { ...value, market: { ...market, scoutReports } };
}

/**
 * Drops open transfer talks whose target is no longer somewhere the market can
 * find them — signed elsewhere, retired, or gone with a regenerated pyramid. The
 * negotiation is a conversation the player can restart, so losing it costs
 * nothing; keeping it crashes the Market tab on every visit, and the tab is
 * reachable from a save that loads.
 */
function dropUnresolvableTransferTalks(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const market = value.market;
  if (!isRecord(market)) return value;
  const talks = market.transferTalks;
  if (talks === undefined) return value;
  // Malformed talks are kept so the validator still reports them rather than
  // this quietly hiding a corrupt save. That includes a quote or negotiation
  // pointing at a different player than the talks themselves.
  if (!isRecord(talks) || typeof talks.playerId !== 'string') return value;
  const userClubId = value.userClubId;
  if (typeof userClubId !== 'string') return value;
  if (transferTargetPlayerIds(value, userClubId).has(talks.playerId)) return value;

  const { transferTalks: _transferTalks, ...marketWithoutTalks } = market;
  return { ...value, market: marketWithoutTalks };
}

function transferTargetPlayerIds(
  state: Record<string, unknown>,
  userClubId: string,
): Set<string> {
  const ids = new Set<string>();
  if (Array.isArray(state.players)) {
    for (const player of state.players) {
      if (!isRecord(player) || typeof player.id !== 'string') continue;
      if (player.clubId === userClubId) continue;
      ids.add(player.id);
    }
  }
  const m2 = state.m2;
  const pyramid = isRecord(m2) ? m2.pyramid : undefined;
  const divisions = isRecord(pyramid) ? pyramid.divisions : undefined;
  if (!Array.isArray(divisions)) return ids;
  for (const division of divisions) {
    if (!isRecord(division) || !Array.isArray(division.clubs)) continue;
    for (const club of division.clubs) {
      if (!isRecord(club) || club.id === userClubId || !Array.isArray(club.squad)) continue;
      for (const player of club.squad) {
        if (isRecord(player) && typeof player.id === 'string') ids.add(player.id);
      }
    }
  }
  return ids;
}

function removeRetiredHeroSystems(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const { heroEssence: _heroEssence, ...withoutEssence } = value;
  const facilities = withoutEssence.facilities;
  if (!isRecord(facilities) || !isRecord(facilities.grid)) return withoutEssence;

  const grid = facilities.grid;
  const buildings = Array.isArray(grid.buildings)
    ? grid.buildings.filter(building => !isRecord(building) || building.type !== 'hero-lab')
    : grid.buildings;
  const construction = isRecord(grid.construction) && grid.construction.type === 'hero-lab'
    ? undefined
    : grid.construction;
  const { construction: _construction, ...gridWithoutConstruction } = grid;

  return {
    ...withoutEssence,
    facilities: {
      ...facilities,
      grid: {
        ...gridWithoutConstruction,
        buildings,
        ...(construction === undefined ? {} : { construction }),
      },
    },
  };
}

/**
 * One upgrade step across a single schema-version boundary.
 *
 * `up` receives a save already at version `to - 1` and returns it at version
 * `to`. It must not assume anything the previous version did not guarantee, and
 * it must not set `schemaVersion` — the ladder stamps that, so a step can never
 * disagree with its own position.
 */
interface GameStateMigration {
  readonly to: number;
  up(value: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Frozen schema-3 prices. Never replace these with `FACILITY_CATALOG`: doing so
 * would make a future balance patch rewrite the refund basis of an old save.
 */
const SCHEMA_3_FACILITY_PRICES = {
  'training-pitch': { build: 8_000, upgrades: [8_000, 12_000] },
  gym: { build: 7_000, upgrades: [7_000, 10_500] },
  'tech-center': { build: 9_000, upgrades: [9_000, 13_500] },
  'shooting-range': { build: 7_500, upgrades: [7_500, 11_250] },
  'keeper-court': { build: 7_500, upgrades: [7_500, 11_250] },
  'medical-bay': { build: 10_000, upgrades: [10_000, 15_000] },
  dorm: { build: 6_000, upgrades: [6_000, 9_000] },
  'scout-office': { build: 6_000, upgrades: [6_000, 9_000] },
  'coaching-office': { build: 6_500, upgrades: [6_500, 9_750] },
  'youth-field': { build: 12_000, upgrades: [12_000, 18_000] },
  'fan-shop': { build: 5_000, upgrades: [5_000, 7_500] },
  'stadium-stand': { build: 15_000, upgrades: [15_000, 22_500] },
} as const;

function migrateSchema3To4(state: Record<string, unknown>): Record<string, unknown> {
  assertUncontaminatedSchema3(state);
  const season = migrationPositiveInteger(state.season, 'season');
  const week = migrationPositiveInteger(state.week, 'week');
  const phase = migrationPhase(state.phase);
  const settledLedgerWeeks = schema3SettledLedgerWeeks(state, season);
  const baseBusiness = createClubBusinessState({
    season,
    week,
    phase,
    settledLedgerWeeks,
  });
  const highestDivision = schema3HighestDivisionReached(state);
  const sponsorMonthlyFee = schema3UserSponsorMonthlyFee(state);
  const capacity = highestDivision === undefined
    ? 0
    : managedSponsorCapacity(highestDivision);
  const activeContracts = capacity === 0
    ? []
    : createProvisionalSponsorPortfolio(sponsorMonthlyFee, capacity, season);

  return {
    ...state,
    facilities: migrateSchema3Facilities(state.facilities),
    clubBusiness: {
      ...baseBusiness,
      sponsorship: {
        activeContracts,
        offers: [],
        portfolioSeason: season,
      },
    },
  };
}

const SCHEMA_4_D5_SPONSOR_FEE = 2_000;
const SCHEMA_5_D5_SPONSOR_FEE = 3_000;
const SCHEMA_4_STADIUM_BUILD_COST = 15_000;
const SCHEMA_5_STADIUM_BUILD_COST = 10_000;

function migrateSchema4To5(state: Record<string, unknown>): Record<string, unknown> {
  const userClubId = state.userClubId;
  if (typeof userClubId !== 'string' || !Array.isArray(state.clubs)) {
    throw new CorruptCareerSaveError('schema 4 save is missing its user club');
  }

  const assistantAdjusted = migrateSchema4AssistantWage(state.market);
  const standAdjustment = migrateSchema4StadiumBases(state.facilities);
  const managedSponsor = schema4HasManagedSponsor(state.clubBusiness);
  const d5PassiveSponsor = !managedSponsor && schema4UserIsInD5(state);
  const credit = standAdjustment.credit;
  let userFound = false;
  const clubs = state.clubs.map(club => {
    if (!isRecord(club) || club.id !== userClubId) return club;
    userFound = true;
    if (!Number.isSafeInteger(club.cash)) {
      throw new CorruptCareerSaveError('schema 4 user club has invalid cash');
    }
    const sponsorMonthlyFee = d5PassiveSponsor
      && club.sponsorMonthlyFee === SCHEMA_4_D5_SPONSOR_FEE
      ? SCHEMA_5_D5_SPONSOR_FEE
      : club.sponsorMonthlyFee;
    return {
      ...club,
      cash: checkedMigrationCash(club.cash as number, credit, 'schema 5 Stadium Stand credit'),
      sponsorMonthlyFee,
    };
  });
  if (!userFound) throw new CorruptCareerSaveError('schema 4 save has no matching user club');

  const next: Record<string, unknown> = {
    ...state,
    clubs,
    ...(assistantAdjusted === undefined ? {} : { market: assistantAdjusted }),
    ...(standAdjustment.facilities === undefined ? {} : { facilities: standAdjustment.facilities }),
  };
  if (credit === 0) return next;

  const history = state.cashTransactions;
  if (history !== undefined && !Array.isArray(history)) {
    throw new CorruptCareerSaveError('schema 4 cash transactions are invalid');
  }
  const season = migrationPositiveInteger(state.season, 'season');
  const week = migrationPositiveInteger(state.week, 'week');
  const migratedHistory = history ?? [];
  const balanceAfter = (clubs.find(club => isRecord(club) && club.id === userClubId) as Record<string, unknown>).cash;
  return {
    ...next,
    cashTransactions: [
      ...migratedHistory,
      {
        id: nextMigrationCashTransactionId(migratedHistory),
        season,
        week,
        kind: 'balance-adjustment',
        label: 'Stadium Stand price protection',
        amount: credit,
        balanceAfter,
        referenceId: 'economy-rebalance-v5',
      },
    ],
  };
}

function migrateSchema4AssistantWage(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const assistant = value.assistantCoach;
  if (!isRecord(assistant)) return value;
  if (!Number.isSafeInteger(assistant.weeklyWage) || (assistant.weeklyWage as number) < 0) {
    throw new CorruptCareerSaveError('schema 4 assistant wage is invalid');
  }
  return {
    ...value,
    assistantCoach: {
      ...assistant,
      weeklyWage: coachWeeklyWageForRole(
        { weeklyWage: assistant.weeklyWage as number },
        'ASSISTANT',
      ),
    },
  };
}

function migrateSchema4StadiumBases(value: unknown): {
  facilities: Record<string, unknown> | undefined;
  credit: number;
} {
  if (!isRecord(value) || !isRecord(value.grid)) {
    return { facilities: isRecord(value) ? value : undefined, credit: 0 };
  }
  const grid = value.grid;
  if (!Array.isArray(grid.buildings)) {
    return { facilities: value, credit: 0 };
  }
  let protectedCount = 0;
  const buildings = grid.buildings.map((building: unknown) => {
    if (!isRecord(building)
      || building.type !== 'stadium-stand'
      || building.seeded === true
      || !schema4StadiumBasisMatchesCatalog(building, grid.construction)) {
      return building;
    }
    protectedCount += 1;
    return {
      ...building,
      capitalInvested: (building.capitalInvested as number)
        - (SCHEMA_4_STADIUM_BUILD_COST - SCHEMA_5_STADIUM_BUILD_COST),
    };
  });
  const credit = checkedMigrationSum(
    0,
    protectedCount * (SCHEMA_4_STADIUM_BUILD_COST - SCHEMA_5_STADIUM_BUILD_COST),
    'schema 5 Stadium Stand credit',
  );
  return {
    facilities: {
      ...value,
      grid: { ...grid, buildings },
    },
    credit,
  };
}

/**
 * Price protection is for known schema-4 catalog purchases, not every custom
 * historical number above the old build price. The saved building level is the
 * last completed level; an active upgrade has already charged its target cost.
 */
function schema4StadiumBasisMatchesCatalog(
  building: Record<string, unknown>,
  construction: unknown,
): boolean {
  if (!Number.isSafeInteger(building.capitalInvested)) return false;
  const project = isRecord(construction) && construction.buildingId === building.id
    ? construction
    : undefined;
  const paidLevel = project?.kind === 'UPGRADE' && Number.isSafeInteger(project.targetLevel)
    ? project.targetLevel
    : building.level;
  const expectedBasis = paidLevel === 1
    ? 15_000
    : paidLevel === 2
      ? 34_000
      : paidLevel === 3
        ? 68_000
        : undefined;
  return expectedBasis !== undefined && building.capitalInvested === expectedBasis;
}

function schema4HasManagedSponsor(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.sponsorship)) return false;
  return Array.isArray(value.sponsorship.activeContracts)
    && value.sponsorship.activeContracts.length > 0;
}

function schema4UserIsInD5(state: Record<string, unknown>): boolean {
  const m2 = state.m2;
  if (!isRecord(m2) || !isRecord(m2.pyramid) || !Array.isArray(m2.pyramid.divisions)) {
    return true;
  }
  const userClubId = state.userClubId;
  for (const division of m2.pyramid.divisions) {
    if (!isRecord(division) || !Array.isArray(division.clubs)) continue;
    if (division.clubs.some(club => isRecord(club) && club.id === userClubId)) {
      return division.level === 5;
    }
  }
  return false;
}

function nextMigrationCashTransactionId(history: readonly unknown[]): string {
  const ids = new Set(history.flatMap(transaction => (
    isRecord(transaction) && typeof transaction.id === 'string' ? [transaction.id] : []
  )));
  let suffix = 1;
  while (ids.has(`cash-transaction-economy-rebalance-v5-${suffix}`)) suffix += 1;
  return `cash-transaction-economy-rebalance-v5-${suffix}`;
}

function checkedMigrationCash(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new CorruptCareerSaveError(`${label} exceeds the safe integer range`);
  }
  return result;
}

function assertUncontaminatedSchema3(state: Record<string, unknown>): void {
  if (hasOwn(state, 'clubBusiness') || hasOwn(state, 'sponsorRules')) {
    throw new CorruptCareerSaveError(
      'schema 3 save contains schema-4 Club Business data and cannot be remigrated',
    );
  }
  const facilities = state.facilities;
  const grid = isRecord(facilities) ? facilities.grid : undefined;
  const buildings = isRecord(grid) ? grid.buildings : undefined;
  if (Array.isArray(buildings)
    && buildings.some(building => isRecord(building) && hasOwn(building, 'capitalInvested'))) {
    throw new CorruptCareerSaveError(
      'schema 3 save contains schema-4 facility basis and cannot be remigrated',
    );
  }
}

function migrateSchema3Facilities(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.grid) || !Array.isArray(value.grid.buildings)) {
    return value;
  }
  const construction = isRecord(value.grid.construction)
    ? value.grid.construction
    : undefined;
  return {
    ...value,
    grid: {
      ...value.grid,
      buildings: value.grid.buildings.map(building => {
        if (!isRecord(building)) return building;
        return {
          ...building,
          capitalInvested: schema3FacilityBasis(building, construction),
        };
      }),
    },
  };
}

function schema3FacilityBasis(
  building: Record<string, unknown>,
  construction: Record<string, unknown> | undefined,
): number {
  if (typeof building.type !== 'string'
    || !hasOwn(SCHEMA_3_FACILITY_PRICES, building.type)) {
    throw new CorruptCareerSaveError('schema 3 facility has an unknown type');
  }
  if (!Number.isSafeInteger(building.level)
    || (building.level as number) < 1
    || (building.level as number) > 3) {
    throw new CorruptCareerSaveError('schema 3 facility has an invalid level');
  }
  const prices = SCHEMA_3_FACILITY_PRICES[
    building.type as keyof typeof SCHEMA_3_FACILITY_PRICES
  ];
  const level = building.level as number;
  let basis = building.seeded === true ? 0 : prices.build;
  for (let completedLevel = 2; completedLevel <= level; completedLevel += 1) {
    basis = checkedMigrationSum(
      basis,
      prices.upgrades[completedLevel - 2],
      'schema 3 facility basis',
    );
  }
  if (construction?.kind === 'UPGRADE'
    && construction.buildingId === building.id) {
    const targetLevel = construction.targetLevel;
    if (!Number.isSafeInteger(targetLevel)
      || (targetLevel as number) < 2
      || (targetLevel as number) > 3) {
      throw new CorruptCareerSaveError('schema 3 facility upgrade has an invalid target level');
    }
    basis = checkedMigrationSum(
      basis,
      prices.upgrades[(targetLevel as number) - 2],
      'schema 3 in-flight facility basis',
    );
  }
  return basis;
}

function schema3SettledLedgerWeeks(
  state: Record<string, unknown>,
  season: number,
): number[] {
  if (!Array.isArray(state.ledgers)) return [];
  return state.ledgers.flatMap(ledger => (
    isRecord(ledger)
      && ledger.season === season
      && Number.isSafeInteger(ledger.week)
      && (ledger.week as number) > 0
      ? [ledger.week as number]
      : []
  ));
}

function schema3UserSponsorMonthlyFee(state: Record<string, unknown>): number {
  if (typeof state.userClubId !== 'string' || !Array.isArray(state.clubs)) {
    throw new CorruptCareerSaveError('schema 3 save is missing its user club');
  }
  const userClub = state.clubs.find(club => (
    isRecord(club) && club.id === state.userClubId
  ));
  if (!isRecord(userClub)
    || !Number.isSafeInteger(userClub.sponsorMonthlyFee)
    || (userClub.sponsorMonthlyFee as number) < 0) {
    throw new CorruptCareerSaveError('schema 3 user club has an invalid sponsor fee');
  }
  return userClub.sponsorMonthlyFee as number;
}

function schema3HighestDivisionReached(state: Record<string, unknown>): 1 | 2 | 3 | 4 | 5 | undefined {
  const m2 = state.m2;
  const pyramid = isRecord(m2) ? m2.pyramid : undefined;
  const divisions = isRecord(pyramid) ? pyramid.divisions : undefined;
  if (!isRecord(m2) || !Array.isArray(divisions) || typeof state.userClubId !== 'string') {
    return undefined;
  }
  const currentLevels = divisions.flatMap(division => {
    if (!isRecord(division) || !Array.isArray(division.clubs)) return [];
    const containsUser = division.clubs.some(club => (
      isRecord(club) && club.id === state.userClubId
    ));
    return containsUser && isDivisionLevel(division.level)
      ? [division.level]
      : [];
  });
  if (currentLevels.length !== 1) return undefined;
  const current = currentLevels[0];
  const recorded = isDivisionLevel(m2.highestDivisionReached)
    ? m2.highestDivisionReached
    : current;
  return Math.min(current, recorded) as 1 | 2 | 3 | 4 | 5;
}

function migrationPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new CorruptCareerSaveError(`schema 3 ${label} is missing or invalid`);
  }
  return value as number;
}

function migrationPhase(value: unknown): 'manage' | 'matchday' | 'season-end' | 'complete' {
  if (value !== 'manage' && value !== 'matchday' && value !== 'season-end' && value !== 'complete') {
    throw new CorruptCareerSaveError('schema 3 phase is missing or invalid');
  }
  return value;
}

function checkedMigrationSum(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new CorruptCareerSaveError(`${label} exceeds the safe integer range`);
  }
  return result;
}

function isDivisionLevel(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * The save-upgrade ladder, ordered by ascending `to`.
 *
 * Schema 2 deliberately has no schema-1 rung: the honest division ladder
 * changes every persisted rival. Development policy permits the break, while
 * refusing here prevents a half-old/half-new pyramid from loading silently.
 *
 * To add a version: raise `GAME_SCHEMA_VERSION` in `src/game/types.ts` and append
 * `{ to: <new version>, up }` here. Anything the new schema requires must be
 * synthesised by `up`, because an old save will not carry it.
 */
const GAME_STATE_MIGRATIONS: readonly GameStateMigration[] = [
  {
    to: 3,
    // Player requests added `loyalty`, `awayWeeks` and `playerRequests`, and
    // every one of them is optional — loyalty is derived from the career seed
    // whenever the field is absent (`src/game/loyalty.ts`), and the request
    // state is defaulted during reconciliation. A schema-2 save is therefore
    // already a valid schema-3 save and needs nothing synthesised.
    //
    // The rung still has to exist: the ladder refuses a missing boundary
    // outright, so without it every save written before this feature would fail
    // to load rather than upgrade.
    up: state => state,
  },
  {
    to: 4,
    up: migrateSchema3To4,
  },
  {
    to: 5,
    up: migrateSchema4To5,
  },
];

function readSchemaVersion(value: unknown, stored: boolean): number {
  if (!isRecord(value) || !Number.isSafeInteger(value.schemaVersion)) {
    if (stored)
      throw new CorruptCareerSaveError('schemaVersion is missing or invalid');
    throw new InvalidGameStateError('schemaVersion is missing or invalid');
  }
  return value.schemaVersion as number;
}

/**
 * Walks a stored save up to `GAME_SCHEMA_VERSION`, one boundary at a time.
 *
 * A version newer than this build is refused outright: that is a downgrade, and
 * nothing here can invent the meaning of a field written by a future version. A
 * missing rung is refused for the same reason — silently accepting it would hand
 * a half-upgraded save to the validator and report a corrupt save instead of the
 * real cause.
 */
export function migrateStoredGameState(value: unknown): unknown {
  let current = value;
  let version = readSchemaVersion(current, true);
  if (version > GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(version, GAME_SCHEMA_VERSION);
  }
  while (version < GAME_SCHEMA_VERSION) {
    const step = GAME_STATE_MIGRATIONS.find(migration => migration.to === version + 1);
    if (step === undefined) {
      throw new UnsupportedGameSchemaError(version, GAME_SCHEMA_VERSION);
    }
    if (!isRecord(current)) {
      throw new CorruptCareerSaveError(`schema ${version} save is not an object`);
    }
    const upgraded = step.up(current);
    if (!isRecord(upgraded)) {
      throw new CorruptCareerSaveError(`schema migration to ${step.to} produced a non-object`);
    }
    current = { ...upgraded, schemaVersion: step.to };
    version = step.to;
  }
  return current;
}

function assertSupportedSchema(value: unknown, stored: boolean): void {
  const version = readSchemaVersion(value, stored);
  if (version !== GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(version, GAME_SCHEMA_VERSION);
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
