import { z } from 'zod';

import { validateFacilityGrid } from '../game/facilities';
import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import { isPlayerLookIdForRole } from '../game/player-appearance';
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
    kind: z.enum([
      'tickets',
      'sponsor',
      'prize',
      'merch',
      'training',
      'facilities',
      'wages',
      'subsidy',
      'emergency-loan',
      'board-sale',
      'loan-repayment',
    ]),
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

const cashTransactionSchema = z.object({
  id: nonemptyString,
  season: positiveInteger,
  week: positiveInteger,
  kind: z.enum([
    'facility-build',
    'facility-upgrade',
    'facility-relocation',
    'scouting',
    'transfer-buy',
    'transfer-sell',
    'youth-signing',
    'coach-hiring',
    'coach-dismissal',
  ]),
  label: nonemptyString,
  amount: safeInteger.refine(value => value !== 0, 'must be non-zero'),
  balanceAfter: nonnegativeInteger,
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
    maxFocusDrillsPerWeek: positiveInteger,
    baseConditioning: trainingDrillSchema,
  })
  .passthrough();

const trainingPlanSchema = z
  .object({
    assignedPlayerIds: z.array(nonemptyString).min(1),
    drills: z.array(trainingDrillSchema).min(1),
  })
  .passthrough();

const trainingCapNoticeSchema = z
  .object({
    id: nonemptyString,
    season: positiveInteger,
    week: positiveInteger,
    playerId: nonemptyString,
    playerName: nonemptyString,
    attribute: z.enum(['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref']),
    cap: positiveInteger.refine(value => value <= 99, 'must be at most 99'),
    drillId: nonemptyString,
    kind: z.enum(['reached', 'skipped']).optional(),
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

const seasonGoalTallySchema = z
  .object({
    season: positiveInteger,
    playerId: nonemptyString,
    goals: nonnegativeInteger,
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
  squadStrength: positiveInteger.refine(value => value <= 99, 'must be at most 99'),
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
  }).passthrough()).min(1),
  championClubId: nonemptyString.optional(),
  seedDivisionByClubId: z.record(nonemptyString, divisionLevelSchema).optional(),
}).passthrough();
const m2CareerSchema = z.object({
  schemaVersion: z.literal(1),
  careerSeed: uint32,
  userClubId: nonemptyString,
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
const scoutFocusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('POSITION'), role: z.enum(['GK', 'DEF', 'MID', 'FWD']) }),
  z.object({ kind: z.literal('AGE'), minimumAge: positiveInteger, maximumAge: positiveInteger }),
  z.object({ kind: z.literal('ELITE_PROSPECT') }),
  z.object({ kind: z.literal('RUMORED_HERO') }),
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
}).passthrough();

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
    clubs: z.array(clubSchema).length(10),
    fixtures: z.array(fixtureSchema),
    players: z.array(playerSchema),
    lineups: z.array(lineupSchema),
    facilities: facilitiesSchema,
    trainingRules: trainingRulesSchema.optional(),
    trainingPlan: trainingPlanSchema.optional(),
    trainingCapNotices: z.array(trainingCapNoticeSchema).optional(),
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
    ledgers: z.array(ledgerSchema),
    seasonOpeningCash: safeInteger.optional(),
    cashTransactions: z.array(cashTransactionSchema).optional(),
    seasonGoalTallies: z.array(seasonGoalTallySchema).optional(),
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
            message: 'National Cup seed must match the career seed',
          });
        }
        if (cupSeasons.has(cup.season) || cup.season > state.season) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'nationalCups', cupIndex, 'season'],
            message: 'National Cup season must be unique and not be in the future',
          });
        }
        cupSeasons.add(cup.season);
        if (cup.championClubId === undefined) activeCupCount += 1;
        else if (!pyramidClubIds.has(cup.championClubId)) {
          context.addIssue({
            code: 'custom',
            path: ['m2', 'nationalCups', cupIndex, 'championClubId'],
            message: 'National Cup champion must exist in the pyramid',
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
          message: 'only one National Cup may be active',
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

    const goalTallyKeys = new Set<string>();
    for (let index = 0; index < (state.seasonGoalTallies ?? []).length; index += 1) {
      const tally = state.seasonGoalTallies![index];
      const key = `${tally.season}:${tally.playerId}`;
      if (goalTallyKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['seasonGoalTallies', index],
          message: 'season and player ID must be unique',
        });
      }
      goalTallyKeys.add(key);
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
        if (playerClubById.get(talks.playerId) === state.userClubId
          || !playerIds.has(talks.playerId)
          || talks.transferQuote.playerId !== talks.playerId
          || talks.negotiation.playerId !== talks.playerId) {
          context.addIssue({
            code: 'custom',
            path: ['market', 'transferTalks', 'playerId'],
            message: 'transfer talks must consistently reference an active target from another club',
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

    if (state.trainingPlan !== undefined) {
      const maxDrills = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
      const assignedIds = new Set<string>();
      const drillIds = new Set<string>();
      if (state.trainingPlan.drills.length > maxDrills) {
        context.addIssue({
          code: 'custom',
          path: ['trainingPlan', 'drills'],
          message: `cannot contain more than ${maxDrills} drills`,
        });
      }
      for (let index = 0; index < state.trainingPlan.assignedPlayerIds.length; index += 1) {
        const playerId = state.trainingPlan.assignedPlayerIds[index];
        if (assignedIds.has(playerId)) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'assignedPlayerIds', index],
            message: 'assigned player ID must be unique',
          });
        }
        assignedIds.add(playerId);
        if (!playerIds.has(playerId) || playerClubById.get(playerId) !== state.userClubId) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'assignedPlayerIds', index],
            message: 'assigned player must belong to the user club',
          });
        }
      }
      for (let index = 0; index < state.trainingPlan.drills.length; index += 1) {
        const drillId = state.trainingPlan.drills[index].id;
        if (drillIds.has(drillId)) {
          context.addIssue({
            code: 'custom',
            path: ['trainingPlan', 'drills', index, 'id'],
            message: 'training drill ID must be unique',
          });
        }
        drillIds.add(drillId);
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

  value = removeRetiredHeroSystems(value);
  value = migrateRetiredPowers(value);
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
  const parsed = validation.data as Omit<GameState, 'awakening'> & {
    awakening?: Omit<GameState['awakening'], 'usedTriggerIds'> & { usedTriggerIds?: string[] };
  };
  return {
    ...parsed,
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
